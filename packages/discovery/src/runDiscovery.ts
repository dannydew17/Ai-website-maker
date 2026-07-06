import { prisma, logger } from "@ai-website-maker/core";
import { queryOverpass, type BoundingBox } from "./overpass.js";
import { normalizeElement } from "./parseOsmTags.js";

export interface RunDiscoveryOptions {
  categories: string[]; // e.g. ["shop=bakery", "amenity=restaurant"]
  bbox: BoundingBox;
}

export interface DiscoveryResult {
  category: string;
  found: number;
  upserted: number;
  skipped: number;
}

// Single delay between per-category queries out of courtesy to the shared
// public Overpass instance, which has no formal rate-limit contract.
const DELAY_BETWEEN_CATEGORIES_MS = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runDiscovery(options: RunDiscoveryOptions): Promise<DiscoveryResult[]> {
  const results: DiscoveryResult[] = [];

  for (let i = 0; i < options.categories.length; i++) {
    const category = options.categories[i];
    logger.info({ category, bbox: options.bbox }, "Querying Overpass for category");

    const elements = await queryOverpass(category, options.bbox);
    let upserted = 0;
    let skipped = 0;

    for (const element of elements) {
      const normalized = normalizeElement(element, category);
      if (!normalized) {
        skipped++;
        continue;
      }

      await prisma.lead.upsert({
        where: { osmId: normalized.osmId },
        // Discovery only ever establishes initial facts; later stages own
        // stage/qualification/etc, so a re-run must not clobber progress.
        update: {},
        create: {
          osmId: normalized.osmId,
          osmType: normalized.osmType,
          name: normalized.name,
          category: normalized.category,
          addressLine: normalized.addressLine,
          city: normalized.city,
          postcode: normalized.postcode,
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          phone: normalized.phone,
          openingHours: normalized.openingHours,
          existingWebsite: normalized.existingWebsite,
          hasWebsite: normalized.hasWebsite,
        },
      });
      upserted++;
    }

    results.push({ category, found: elements.length, upserted, skipped });
    logger.info(
      { category, found: elements.length, upserted, skipped },
      "Discovery pass complete for category"
    );

    if (i < options.categories.length - 1) {
      await sleep(DELAY_BETWEEN_CATEGORIES_MS);
    }
  }

  return results;
}
