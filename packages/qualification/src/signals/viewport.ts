import type { Page } from "playwright";
import type { SignalResult } from "./types.js";

export async function checkViewportMeta(page: Page): Promise<SignalResult> {
  const hasViewport = await page.evaluate(
    () => document.querySelector('meta[name="viewport"]') !== null
  );
  return { triggered: !hasViewport, deduction: hasViewport ? 0 : 10 };
}
