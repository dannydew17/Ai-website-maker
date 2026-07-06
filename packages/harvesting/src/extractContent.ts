import { chromium, type Page } from "playwright";
import { getChromiumLaunchOptions, logger } from "@ai-website-maker/core";
import { isHarvestAllowed } from "./robots.js";
import { waitForDomainSlot } from "./rateLimiter.js";

export interface Testimonial {
  quote: string;
  author: string | null;
}

export interface ExtractedContent {
  sourceUrl: string;
  aboutText: string | null;
  services: string[] | null;
  photos: { url: string; alt: string }[] | null;
  testimonials: Testimonial[] | null;
  contactEmail: string | null;
  robotsAllowed: boolean;
}

const MAX_PAGES_PER_LEAD = 3;
const IGNORE_IMAGE_PATTERNS = /(logo|icon|favicon|sprite|pixel|spacer)/i;

interface HeadingSection {
  heading: string;
  text: string;
  listItems: string[];
}

interface RawPageData {
  headingSections: HeadingSection[];
  mailtoEmails: string[];
  bodyText: string;
  images: { src: string; alt: string }[];
  testimonials: Testimonial[];
  internalLinks: string[];
}

// NOTE: this callback runs inside the browser via page.evaluate, which sends
// only fn.toString() across — no closure over the outer module. It must not
// contain any named function/const-bound function value (declarations or
// `const x = () => ...`): tsx's esbuild transform wraps named functions with
// a `__name(...)` helper call that only exists in the outer module scope, so
// the re-evaluated string throws "__name is not defined" in the browser.
// Anonymous inline callbacks (e.g. arguments to .map/.filter) are unaffected
// and safe to use; only avoid binding a function value to an identifier.
async function extractFromPage(page: Page, hostname: string): Promise<RawPageData> {
  return page.evaluate((host) => {
    const headingEls = Array.from(document.querySelectorAll("h1, h2, h3"));
    const headingSections: HeadingSection[] = [];
    for (const h of headingEls) {
      let text = "";
      const listItems: string[] = [];
      let el = h.nextElementSibling;
      let guard = 0;
      while (el && !/^H[1-3]$/.test(el.tagName) && guard < 10) {
        text += " " + (el.textContent ?? "");
        const liEls = Array.from(el.querySelectorAll("li"));
        for (const li of liEls) {
          const itemText = (li.textContent ?? "").trim();
          if (itemText) listItems.push(itemText);
        }
        el = el.nextElementSibling;
        guard++;
      }
      headingSections.push({ heading: (h.textContent ?? "").trim(), text: text.trim(), listItems });
    }

    const mailtoEmails = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(
      (a) => (a as HTMLAnchorElement).href.replace(/^mailto:/i, "").split("?")[0].trim()
    );

    const images = Array.from(document.querySelectorAll("img[src]"))
      .map((img) => ({
        src: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt ?? "",
      }))
      .filter((img) => img.src && !/^data:/.test(img.src));

    const testimonials: Testimonial[] = [];

    // 1. schema.org Review microdata — a strong, unambiguous structural signal.
    const reviewEls = Array.from(document.querySelectorAll('[itemtype*="Review" i]'));
    for (const el of reviewEls) {
      const bodyEl = el.querySelector('[itemprop="reviewBody"], [itemprop="description"]');
      const authorEl = el.querySelector('[itemprop="author"] [itemprop="name"], [itemprop="author"]');
      const quote = (bodyEl?.textContent ?? "").trim();
      if (quote) testimonials.push({ quote, author: (authorEl?.textContent ?? "").trim() || null });
    }

    // 2. A section explicitly labeled as testimonials/reviews.
    const labeledContainers = Array.from(document.querySelectorAll("*")).filter((el) => {
      const label = `${el.className} ${el.id}`.toLowerCase();
      return /testimonial|review/.test(label);
    });
    for (const container of labeledContainers) {
      const quotes = Array.from(container.querySelectorAll("blockquote, p"));
      for (const q of quotes) {
        const cite = q.querySelector("cite");
        const author = (cite?.textContent ?? "").trim() || null;
        const quoteClone = q.cloneNode(true) as Element;
        quoteClone.querySelector("cite")?.remove();
        const quote = (quoteClone.textContent ?? "").trim();
        if (quote.length > 15 && quote.length < 1000) {
          testimonials.push({ quote, author });
        }
      }
    }

    // 3. Bare <blockquote>+<cite> pairs, a conventional structural marker
    // for an attributed quotation even outside a labeled section.
    const blockquotes = Array.from(document.querySelectorAll("blockquote"));
    for (const bq of blockquotes) {
      const cite = bq.querySelector("cite");
      if (!cite) continue;
      const author = (cite.textContent ?? "").trim() || null;
      const bqClone = bq.cloneNode(true) as Element;
      bqClone.querySelector("cite")?.remove();
      const quote = (bqClone.textContent ?? "").trim();
      if (quote.length > 15) {
        testimonials.push({ quote, author });
      }
    }

    // De-dupe by quote text.
    const seenQuotes = new Set<string>();
    const dedupedTestimonials = testimonials.filter((t) => {
      if (seenQuotes.has(t.quote)) return false;
      seenQuotes.add(t.quote);
      return true;
    });

    const anchorEls = Array.from(document.querySelectorAll("a[href]"));
    const internalLinksSet = new Set<string>();
    for (const a of anchorEls) {
      try {
        const url = new URL((a as HTMLAnchorElement).href);
        if (url.hostname === host && /(about|contact)/i.test(url.pathname)) {
          internalLinksSet.add(url.toString());
        }
      } catch {
        // ignore unparsable hrefs
      }
    }

    return {
      headingSections,
      mailtoEmails,
      bodyText: document.body.innerText ?? "",
      images,
      testimonials: dedupedTestimonials,
      internalLinks: Array.from(internalLinksSet),
    };
  }, hostname);
}

function pickAboutText(sections: HeadingSection[]): string | null {
  const aboutSection = sections.find((s) => /about/i.test(s.heading) && s.text.trim().length > 20);
  return aboutSection ? aboutSection.text.trim().slice(0, 2000) : null;
}

function pickServices(sections: HeadingSection[]): string[] | null {
  const servicesSection = sections.find((s) =>
    /services|products|what we (do|offer)/i.test(s.heading)
  );
  if (!servicesSection) return null;
  if (servicesSection.listItems.length > 0) {
    return servicesSection.listItems.slice(0, 20);
  }
  // No <li> structure found — fall back to splitting the section's plain
  // text into lines as a best-effort approximation.
  const items = servicesSection.text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 200);
  return items.length ? items.slice(0, 20) : null;
}

/**
 * Harvests reusable content from a business's existing website: about text,
 * services, a few images, a contact email, and testimonials — but only ever
 * testimonials that are structurally marked as reviews (never inferred from
 * plain body text), since a misattributed quote is a real risk to the
 * business being pitched. Crawls at most a handful of same-domain pages
 * (home + about/contact if linked), respecting robots.txt and a per-domain
 * rate limit.
 */
export async function extractContent(startUrl: string): Promise<ExtractedContent> {
  const hostname = new URL(startUrl).hostname;

  const robotsAllowed = await isHarvestAllowed(startUrl);
  if (!robotsAllowed) {
    logger.info({ startUrl }, "robots.txt disallows harvesting — falling back to OSM data only");
    return {
      sourceUrl: startUrl,
      aboutText: null,
      services: null,
      photos: null,
      testimonials: null,
      contactEmail: null,
      robotsAllowed: false,
    };
  }

  const browser = await chromium.launch(getChromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    const visited = new Set<string>();
    const toVisit = [startUrl];

    let aboutText: string | null = null;
    let services: string[] | null = null;
    const photos: { url: string; alt: string }[] = [];
    const testimonials: Testimonial[] = [];
    let contactEmail: string | null = null;

    while (toVisit.length > 0 && visited.size < MAX_PAGES_PER_LEAD) {
      const url = toVisit.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      if (visited.size > 1) {
        const allowed = await isHarvestAllowed(url);
        if (!allowed) continue;
      }

      await waitForDomainSlot(hostname);

      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch (err) {
        logger.debug({ url, err }, "Failed to load page during harvesting, skipping");
        continue;
      }
      await page.waitForTimeout(300);

      const data = await extractFromPage(page, hostname);

      if (!aboutText) aboutText = pickAboutText(data.headingSections);
      if (!services) services = pickServices(data.headingSections);
      if (!contactEmail && data.mailtoEmails.length > 0) contactEmail = data.mailtoEmails[0];

      for (const img of data.images) {
        if (photos.length >= 5) break;
        if (IGNORE_IMAGE_PATTERNS.test(img.src)) continue;
        if (!photos.some((p) => p.url === img.src)) photos.push({ url: img.src, alt: img.alt });
      }

      for (const t of data.testimonials) {
        if (!testimonials.some((existing) => existing.quote === t.quote)) testimonials.push(t);
      }

      for (const link of data.internalLinks) {
        if (!visited.has(link) && !toVisit.includes(link)) toVisit.push(link);
      }
    }

    return {
      sourceUrl: startUrl,
      aboutText,
      services,
      photos: photos.length ? photos : null,
      testimonials: testimonials.length ? testimonials : null,
      contactEmail,
      robotsAllowed: true,
    };
  } finally {
    await browser.close();
  }
}
