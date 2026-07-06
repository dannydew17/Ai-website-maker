import type { SignalResult } from "./types.js";

export function checkHttps(finalUrl: string): SignalResult {
  const triggered = !finalUrl.startsWith("https://");
  return { triggered, deduction: triggered ? 15 : 0, detail: finalUrl };
}
