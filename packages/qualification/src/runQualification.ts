import type { Prisma } from "@prisma/client";
import { prisma, logger, transitionStage, markFailed } from "@ai-website-maker/core";
import { scoreSite } from "./scoreSite.js";

// Deliberately conservative: a single weak signal shouldn't flag an
// otherwise-fine site. Calibrate against real scored sites before trusting
// this unattended (see plan's Phase 2 build notes).
export const QUALIFY_THRESHOLD = 50;

export async function runQualification(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.stage !== "DISCOVERED") {
    logger.warn({ leadId, stage: lead.stage }, "Skipping qualification: lead not in DISCOVERED stage");
    return;
  }

  if (!lead.hasWebsite || !lead.existingWebsite) {
    await transitionStage(lead.id, "QUALIFIED", {
      note: "No website on file — auto-qualified",
      within: async (tx) => {
        await tx.qualification.upsert({
          where: { leadId: lead.id },
          update: { reason: "NO_WEBSITE", score: null, scoreBreakdown: undefined },
          create: { leadId: lead.id, reason: "NO_WEBSITE" },
        });
      },
    });
    return;
  }

  await transitionStage(lead.id, "QUALIFYING", { note: "Scoring existing website" });

  let result;
  try {
    result = await scoreSite(lead.existingWebsite);
  } catch (err) {
    await markFailed(lead.id, "QUALIFYING", err);
    return;
  }

  const reason = result.unreachable
    ? "SITE_UNREACHABLE"
    : result.score < QUALIFY_THRESHOLD
      ? "UNDERDEVELOPED_WEBSITE"
      : "DISQUALIFIED_ADEQUATE_SITE";
  const toStage = reason === "DISQUALIFIED_ADEQUATE_SITE" ? "DISQUALIFIED" : "QUALIFIED";

  await transitionStage(lead.id, toStage, {
    note: `Qualification: ${reason} (score=${result.unreachable ? "n/a" : result.score})`,
    within: async (tx) => {
      await tx.qualification.upsert({
        where: { leadId: lead.id },
        update: {
          reason,
          score: result.unreachable ? null : result.score,
          scoreBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        },
        create: {
          leadId: lead.id,
          reason,
          score: result.unreachable ? null : result.score,
          scoreBreakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        },
      });
    },
  });
}
