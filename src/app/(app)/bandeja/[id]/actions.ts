"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withUserContext } from "@/db/rls";
import { conversations } from "@/db/schema";
import type { ActionState } from "@/server/actions";
import { pauseAgent, resumeAgent } from "@/server/agent/agent";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";

const schema = z.object({ conversationId: z.uuid(), op: z.enum(["pause", "resume"]) });

/** Pausar / reanudar la IA en una conversación. Cualquier miembro puede hacerlo. */
export async function toggleAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const { conversationId, op } = parsed.data;
  try {
    // RLS: la conversación tiene que ser de la organización del usuario.
    const visible = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
      const [row] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, ctx.organizationId),
            eq(conversations.id, conversationId),
          ),
        );
      if (row && op === "pause") {
        await pauseAgent(tx, {
          organizationId: ctx.organizationId,
          conversationId,
          reason: "Pausada a mano por el equipo.",
        });
      }
      return !!row;
    });
    if (!visible) return { status: "error", message: "La conversación no existe." };
    if (op === "resume") {
      await resumeAgent(getDb(), { organizationId: ctx.organizationId, conversationId });
    }
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: op === "pause" ? "IA pausada." : "IA reanudada." };
}
