import robotsParserImport from "robots-parser";
import { logger } from "@ai-website-maker/core";

const USER_AGENT = "AiWebsiteMakerBot";
const FETCH_TIMEOUT_MS = 8000;

interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

// The robots-parser package ships a broken .d.ts (a shorthand ambient module
// declaration that shadows its own real exports), so its default import
// doesn't type-check as callable. Cast once here rather than fight it.
const robotsParser = robotsParserImport as unknown as (url: string, robotstxt: string) => Robot;

/**
 * Fails open: if robots.txt is missing or unreachable, the page is treated
 * as allowed (that's the standard interpretation of no robots.txt existing).
 * Only an explicit disallow rule blocks harvesting.
 */
export async function isHarvestAllowed(url: string): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", url).toString();
  try {
    const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return true;
    const body = await response.text();
    const robots = robotsParser(robotsUrl, body);
    return robots.isAllowed(url, USER_AGENT) ?? true;
  } catch (err) {
    logger.debug({ url, err }, "robots.txt fetch failed, defaulting to allowed");
    return true;
  }
}
