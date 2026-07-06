import { chromium } from "playwright";
import { logger, getChromiumLaunchOptions } from "@ai-website-maker/core";
import type { SignalResult } from "./signals/types.js";
import { checkHttps } from "./signals/https.js";
import { checkPlaceholderText, checkWordCount, checkInternalLinks } from "./signals/textSignals.js";
import { checkViewportMeta } from "./signals/viewport.js";
import { checkCopyrightYear } from "./signals/copyrightYear.js";
import { checkContactInfo } from "./signals/contactInfo.js";
import { checkStyling } from "./signals/styling.js";

export interface ScoreResult {
  score: number;
  breakdown: Record<string, SignalResult>;
  unreachable: boolean;
}

export async function scoreSite(url: string): Promise<ScoreResult> {
  const browser = await chromium.launch(getChromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (err) {
      logger.info({ url, err }, "Site unreachable during qualification scoring");
      return { score: 0, breakdown: {}, unreachable: true };
    }

    // Let any client-side rendering settle before inspecting the DOM.
    await page.waitForTimeout(500);

    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText ?? "");

    const breakdown: Record<string, SignalResult> = {
      https: checkHttps(finalUrl),
      placeholderText: checkPlaceholderText(bodyText),
      wordCount: checkWordCount(bodyText),
      internalLinks: await checkInternalLinks(page, finalUrl),
      viewportMeta: await checkViewportMeta(page),
      copyrightYear: checkCopyrightYear(bodyText),
      contactInfo: await checkContactInfo(page, bodyText),
      styling: await checkStyling(page),
    };

    let score = 100;
    for (const signal of Object.values(breakdown)) {
      if (signal.triggered) score -= signal.deduction;
    }

    return { score: Math.max(0, score), breakdown, unreachable: false };
  } finally {
    await browser.close();
  }
}
