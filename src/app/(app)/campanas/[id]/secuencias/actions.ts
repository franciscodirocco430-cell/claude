"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { withUserContext } from "@/db/rls";
import type { ActionState } from "@/server/actions";
import { requireAppContext } from "@/server/auth/session";
import { issuesByPath } from "@/server/campaigns/schemas";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { sequenceInputSchema } from "@/server/sequences/schemas";
import {
  changeSequenceStatus,
  createSequence,
  enrollEligible,
  previewStep,
  updateSequence,
} from "@/server/sequences/service";

const uuid = z.uuid();

export async function saveSequenceAction(input: {
  campaignId: string;
  sequenceId?: string;
  values: unknown;
}): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (
    !uuid.safeParse(input.campaignId).success ||
    (input.sequenceId && !uuid.safeParse(input.sequenceId).success)
  ) {
    return { status: "error", message: "Datos inválidos." };
  }
  const parsed = sequenceInputSchema.safeParse(input.values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los campos marcados.",
      fieldErrors: issuesByPath(parsed.error),
    };
  }
  let id = input.sequenceId;
  try {
    // RLS: email_sequences y sequence_steps solo se escriben como owner/admin.
    await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
      if (id) {
        await updateSequence(tx, {
          organizationId: ctx.organizationId,
          sequenceId: id,
          actorRole: ctx.role,
          data: parsed.data,
        });
      } else {
        id = await createSequence(tx, {
          organizationId: ctx.organizationId,
          campaignId: input.campaignId,
          actorRole: ctx.role,
          data: parsed.data,
        });
      }
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  if (!input.sequenceId) redirect(`/campanas/${input.campaignId}/secuencias/${id}?guardada=1`);
  return { status: "success", message: "Secuencia guardada." };
}

export async function sequenceStatusAction(input: {
  sequenceId: string;
  action: "activate" | "pause";
}): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!uuid.safeParse(input.sequenceId).success)
    return { status: "error", message: "Datos inválidos." };
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      changeSequenceStatus(tx, {
        organizationId: ctx.organizationId,
        sequenceId: input.sequenceId,
        actorRole: ctx.role,
        action: input.action,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return {
    status: "success",
    message: input.action === "activate" ? "Secuencia activa." : "Secuencia pausada.",
  };
}

export async function enrollAction(input: {
  sequenceId: string;
}): Promise<ActionState<{ enrolled: number }>> {
  const ctx = await requireAppContext();
  if (!uuid.safeParse(input.sequenceId).success)
    return { status: "error", message: "Datos inválidos." };
  try {
    const r = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      enrollEligible(tx, {
        organizationId: ctx.organizationId,
        sequenceId: input.sequenceId,
        actorRole: ctx.role,
      }),
    );
    const message =
      r.enrolled > 0
        ? `${r.enrolled} ${r.enrolled === 1 ? "prospecto inscripto" : "prospectos inscriptos"}.`
        : r.needsAi
          ? "No hay prospectos elegibles. El primer email usa el borrador de la IA: prepará mensajes en la campaña."
          : "No hay prospectos elegibles (con email, sin baja y sin otra secuencia activa).";
    return { status: "success", message, data: { enrolled: r.enrolled } };
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
}

export async function previewAction(input: {
  campaignId: string;
  prospectId: string;
  subject: string;
  body: string;
  firstSubject: string;
}) {
  const ctx = await requireAppContext();
  if (!uuid.safeParse(input.campaignId).success || !uuid.safeParse(input.prospectId).success) {
    return { status: "error" as const, message: "Datos inválidos." };
  }
  try {
    const preview = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      previewStep(tx, { organizationId: ctx.organizationId, ...input }),
    );
    return { status: "success" as const, preview };
  } catch (error) {
    return { status: "error" as const, message: userMessage(error) };
  }
}
