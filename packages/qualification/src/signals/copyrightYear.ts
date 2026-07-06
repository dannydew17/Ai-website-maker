import type { SignalResult } from "./types.js";

export function checkCopyrightYear(bodyText: string): SignalResult {
  const match = bodyText.match(/©\s*(\d{4})|copyright\s*©?\s*(\d{4})/i);
  const yearStr = match?.[1] ?? match?.[2];
  if (!yearStr) {
    // No copyright notice at all isn't itself a sign of an underdeveloped
    // site (plenty of fine modern sites omit one) — only a stale year counts.
    return { triggered: false, deduction: 0, detail: "no copyright year found" };
  }
  const year = Number(yearStr);
  const currentYear = new Date().getFullYear();
  const triggered = year < currentYear - 2;
  return { triggered, deduction: triggered ? 10 : 0, detail: `${year}` };
}
