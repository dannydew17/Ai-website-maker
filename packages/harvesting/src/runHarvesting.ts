import type { Prisma } from "@prisma/client";
import { prisma, logger, transitionStage, markFailed } from "@ai-website-maker/core";
import { extractContent } from "./extractContent.js";

export async function runHarvesting(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  if (lead.stage !== "QUALIFIED") {
    logger.warn({ leadId, stage: lead.stage }, "Skipping harvesting: lead not in QUALIFIED stage");
    return;
  }

  // No-website leads (and unreachable-site leads) have nothing to harvest —
  // they proceed straight to generation using OSM data alone.
  if (!lead.hasWebsite || !lead.existingWebsite) {
    await transitionStage(lead.id, "HARVESTED", {
      note: "No website to harvest — proceeding with OSM data only",
    });
    return;
  }

  await transitionStage(lead.id, "HARVESTING", { note: "Harvesting existing website content" });

  let extracted;
  try {
    extracted = await extractContent(lead.existingWebsite);
  } catch (err) {
    await markFailed(lead.id, "HARVESTING", err);
    return;
  }

  await transitionStage(lead.id, "HARVESTED", {
    note: extracted.robotsAllowed
      ? "Harvested existing site content"
      : "robots.txt disallowed harvesting — proceeding with OSM data only",
    within: async (tx) => {
      await tx.scrapedContent.upsert({
        where: { leadId: lead.id },
        update: {
          sourceUrl: extracted.sourceUrl,
          aboutText: extracted.aboutText,
          services: extracted.services as Prisma.InputJsonValue,
          photos: extracted.photos as unknown as Prisma.InputJsonValue,
          testimonials: extracted.testimonials as unknown as Prisma.InputJsonValue,
          contactEmail: extracted.contactEmail,
          robotsAllowed: extracted.robotsAllowed,
        },
        create: {
          leadId: lead.id,
          sourceUrl: extracted.sourceUrl,
          aboutText: extracted.aboutText,
          services: extracted.services as Prisma.InputJsonValue,
          photos: extracted.photos as unknown as Prisma.InputJsonValue,
          testimonials: extracted.testimonials as unknown as Prisma.InputJsonValue,
          contactEmail: extracted.contactEmail,
          robotsAllowed: extracted.robotsAllowed,
        },
      });
    },
  });
}
