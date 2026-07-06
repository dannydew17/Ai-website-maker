import { logger, loadConfig } from "@ai-website-maker/core";

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function buildQuery(categoryTag: string, bbox: BoundingBox): string {
  const [key, value] = categoryTag.split("=");
  if (!key || !value) {
    throw new Error(`Invalid category tag "${categoryTag}", expected "key=value" (e.g. "shop=bakery")`);
  }
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const filter = `["${key}"="${value}"]`;
  return `
[out:json][timeout:60];
(
  node${filter}(${bboxStr});
  way${filter}(${bboxStr});
  relation${filter}(${bboxStr});
);
out center tags;
`.trim();
}

const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 503, 504]);

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queries the Overpass API for one OSM tag (e.g. "shop=bakery") within a
 * bounding box. Retries with backoff on rate-limit/server-busy responses,
 * since the public overpass-api.de instance has no formal SLA.
 */
export async function queryOverpass(
  categoryTag: string,
  bbox: BoundingBox
): Promise<OverpassElement[]> {
  const url = loadConfig().OVERPASS_API_URL;
  const query = buildQuery(categoryTag, bbox);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = 2 ** attempt * 1000;
      logger.warn({ categoryTag, attempt, backoffMs }, "Retrying Overpass query after backoff");
      await sleep(backoffMs);
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`Overpass returned ${response.status}`);
          continue;
        }
        throw new Error(`Overpass request failed: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as OverpassResponse;
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_RETRIES) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
