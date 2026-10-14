"use server";

import { z } from "zod";
import { withUserContext } from "@/db/rls";
import type { ActionState } from "@/server/actions";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { moveLead } from "@/server/pipeline/board";

const schema = z.object({ leadId: z.uuid(), stageId: z.uuid() });

/** Mover un lead de etapa (drag and drop o selector). Cualquier miembro puede. */
export async function moveLeadAction(input: {
  leadId: string;
  stageId: string;
}): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      moveLead(tx, { organizationId: ctx.organizationId, ...parsed.data }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success" };
}
