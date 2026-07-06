import type { OverpassElement } from "./overpass.js";

export interface NormalizedLead {
  osmId: string;
  osmType: string;
  name: string;
  category: string;
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  openingHours: string | null;
  existingWebsite: string | null;
  hasWebsite: boolean;
}

function firstTag(tags: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = tags[key];
    if (value) return value;
  }
  return null;
}

/**
 * Converts a raw Overpass element into normalized Lead fields. Returns null
 * for elements missing a name (can't meaningfully pitch a business we can't
 * address by name) or missing coordinates.
 */
export function normalizeElement(
  element: OverpassElement,
  categoryTag: string
): NormalizedLead | null {
  const tags = element.tags ?? {};
  const name = tags.name;
  if (!name) return null;

  const lat = element.lat ?? element.center?.lat ?? null;
  const lon = element.lon ?? element.center?.lon ?? null;
  if (lat === null || lon === null) return null;

  const houseNumber = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const addressLine = houseNumber && street ? `${houseNumber} ${street}` : street ?? null;

  const website = firstTag(tags, ["website", "contact:website"]);

  return {
    osmId: `${element.type}/${element.id}`,
    osmType: element.type,
    name,
    category: categoryTag,
    addressLine,
    city: tags["addr:city"] ?? null,
    postcode: tags["addr:postcode"] ?? null,
    latitude: lat,
    longitude: lon,
    phone: firstTag(tags, ["phone", "contact:phone"]),
    openingHours: tags.opening_hours ?? null,
    existingWebsite: website,
    hasWebsite: Boolean(website),
  };
}
