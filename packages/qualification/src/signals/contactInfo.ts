import type { Page } from "playwright";
import type { SignalResult } from "./types.js";

const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/;

export async function checkContactInfo(page: Page, bodyText: string): Promise<SignalResult> {
  const hasMailto = await page.evaluate(
    () => document.querySelector('a[href^="mailto:"]') !== null
  );
  const hasContactLink = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a"));
    return anchors.some((a) => /contact/i.test(a.textContent ?? ""));
  });
  const hasPhone = PHONE_PATTERN.test(bodyText);

  const hasAnyContactInfo = hasMailto || hasContactLink || hasPhone;
  return {
    triggered: !hasAnyContactInfo,
    deduction: hasAnyContactInfo ? 0 : 10,
    detail: `mailto=${hasMailto} contactLink=${hasContactLink} phone=${hasPhone}`,
  };
}
