import type { Lead, LeadStage, Prisma } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Advances a Lead to a new stage and records a StageEvent in the same
 * transaction, so "current state" and "full history" never drift apart.
 * `extraData` lets a stage attach its own related-row writes in the same
 * transaction (e.g. creating the Qualification row alongside the transition).
 */
export async function transitionStage(
  leadId: string,
  toStage: LeadStage,
  options: {
    note?: string;
    leadData?: Prisma.LeadUpdateInput;
    within?: (tx: Prisma.TransactionClient) => Promise<void>;
  } = {}
): Promise<Lead> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: { ...options.leadData, stage: toStage },
    });

    await tx.stageEvent.create({
      data: {
        leadId,
        fromStage: current.stage,
        toStage,
        note: options.note,
      },
    });

    if (options.within) {
      await options.within(tx);
    }

    return updated;
  });
}

/**
 * Marks a lead FAILED with the error captured, incrementing retryCount,
 * without losing track of which stage it failed at.
 */
export async function markFailed(
  leadId: string,
  failedAtStage: LeadStage,
  error: unknown
): Promise<Lead> {
  const message = error instanceof Error ? error.message : String(error);
  return prisma.$transaction(async (tx) => {
    const current = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        stage: "FAILED",
        failedAtStage,
        lastError: message,
        retryCount: { increment: 1 },
      },
    });
    await tx.stageEvent.create({
      data: {
        leadId,
        fromStage: current.stage,
        toStage: "FAILED",
        note: `Failed at ${failedAtStage}: ${message}`,
      },
    });
    return updated;
  });
}
