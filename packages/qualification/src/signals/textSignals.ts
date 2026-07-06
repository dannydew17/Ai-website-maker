import type { Page } from "playwright";
import type { SignalResult } from "./types.js";

const PLACEHOLDER_PHRASES = [
  "coming soon",
  "under construction",
  "domain for sale",
  "this domain is parked",
  "buy this domain",
  "default web site page",
  "lorem ipsum",
  "website builder",
  "start your own website",
];

export function checkPlaceholderText(bodyText: string): SignalResult {
  const lower = bodyText.toLowerCase();
  const matched = PLACEHOLDER_PHRASES.find((phrase) => lower.includes(phrase));
  return { triggered: Boolean(matched), deduction: matched ? 30 : 0, detail: matched };
}

export function checkWordCount(bodyText: string): SignalResult {
  const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const triggered = wordCount < 150;
  return { triggered, deduction: triggered ? 20 : 0, detail: `${wordCount} words` };
}

export async function checkInternalLinks(page: Page, finalUrl: string): Promise<SignalResult> {
  const hostname = new URL(finalUrl).hostname;
  const internalLinkCount = await page.evaluate((host) => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const internal = new Set<string>();
    for (const a of anchors) {
      try {
        const href = (a as HTMLAnchorElement).href;
        const url = new URL(href);
        if (url.hostname === host) internal.add(url.pathname);
      } catch {
        // ignore unparsable hrefs (mailto:, tel:, javascript:, etc.)
      }
    }
    return internal.size;
  }, hostname);

  const triggered = internalLinkCount <= 1;
  return { triggered, deduction: triggered ? 10 : 0, detail: `${internalLinkCount} internal links` };
}
