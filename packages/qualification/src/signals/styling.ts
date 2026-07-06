import type { Page } from "playwright";
import type { SignalResult } from "./types.js";

// Unstyled HTML renders body text in the browser's default serif stack
// (e.g. "Times New Roman") — a strong tell that no CSS is being applied.
const DEFAULT_FONT_MARKERS = ["times new roman", "times", "serif"];

export async function checkStyling(page: Page): Promise<SignalResult> {
  const info = await page.evaluate(() => {
    const styleSheetCount = document.styleSheets.length;
    const inlineStyleTags = Array.from(document.querySelectorAll("style")).filter(
      (el) => (el.textContent ?? "").trim().length > 20
    ).length;
    const fontFamily = getComputedStyle(document.body).fontFamily.toLowerCase();
    return { styleSheetCount, inlineStyleTags, fontFamily };
  });

  const looksUnstyled =
    info.styleSheetCount === 0 &&
    info.inlineStyleTags === 0 &&
    DEFAULT_FONT_MARKERS.some((marker) => info.fontFamily.includes(marker));

  return {
    triggered: looksUnstyled,
    deduction: looksUnstyled ? 15 : 0,
    detail: JSON.stringify(info),
  };
}
