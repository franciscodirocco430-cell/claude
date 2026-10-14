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
import { getReplyDeps } from "@/server/inbox/deps";
import { replyManually, MAX_REPLY_CHARS } from "@/server/inbox/reply";
import { assignConversation } from "@/server/inbox/service";

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

const replySchema = z.object({
  conversationId: z.uuid(),
  text: z
    .string()
    .trim()
    .min(1, { error: "Escribí un mensaje." })
    .max(MAX_REPLY_CHARS, { error: `Hasta ${MAX_REPLY_CHARS} caracteres.` }),
});

/** Respuesta manual desde la Bandeja (respeta ventanas y supresión). */
export async function replyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = replySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    // RLS: la conversación tiene que ser visible para el usuario.
    const visible = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
      const [row] = await tx
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, ctx.organizationId),
            eq(conversations.id, parsed.data.conversationId),
          ),
        );
      return !!row;
    });
    if (!visible) return { status: "error", message: "La conversación no existe." };
    const result = await replyManually(getReplyDeps(), {
      organizationId: ctx.organizationId,
      conversationId: parsed.data.conversationId,
      userId: ctx.user.id,
      text: parsed.data.text,
    });
    if (result.status === "sent") return { status: "success", message: "Enviado." };
    if (result.status === "manual_task") return { status: "success", message: result.message };
    return { status: "error", message: result.message };
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
}

const assignSchema = z.object({
  conversationId: z.uuid(),
  userId: z.union([z.uuid(), z.literal("")]),
});

export async function assignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = assignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      assignConversation(tx, {
        organizationId: ctx.organizationId,
        conversationId: parsed.data.conversationId,
        userId: parsed.data.userId || null,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Asignación guardada." };
}
