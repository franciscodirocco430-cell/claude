"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { outreachTasks } from "@/db/schema";
import { withUserContext } from "@/db/rls";
import type { ActionState } from "@/server/actions";
import { queueDraftRegeneration } from "@/server/ai/preparation";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { getOrganizationTimeZone, markTaskSent, skipTask } from "@/server/queue/service";

const taskId = z.uuid();

async function scope() {
  const ctx = await requireAppContext();
  return { ctx, organizationId: ctx.organizationId, userId: ctx.user.id };
}

export async function markSentAction(input: {
  taskId: string;
  message: string;
}): Promise<ActionState> {
  const { organizationId, userId } = await scope();
  if (!taskId.safeParse(input.taskId).success || typeof input.message !== "string") {
    return { status: "error", message: "Datos inválidos." };
  }
  try {
    await withUserContext(getDb(), { sub: userId }, async (tx) =>
      markTaskSent(tx, {
        organizationId,
        userId,
        timeZone: await getOrganizationTimeZone(tx, organizationId),
        taskId: input.taskId,
        message: input.message.slice(0, 5000),
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Marcado como enviado." };
}

export async function skipTaskAction(input: {
  taskId: string;
  reason?: string;
}): Promise<ActionState> {
  const { organizationId, userId } = await scope();
  if (!taskId.safeParse(input.taskId).success)
    return { status: "error", message: "Datos inválidos." };
  try {
    await withUserContext(getDb(), { sub: userId }, async (tx) =>
      skipTask(tx, {
        organizationId,
        userId,
        timeZone: await getOrganizationTimeZone(tx, organizationId),
        taskId: input.taskId,
        reason: input.reason,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Tarea salteada." };
}

export async function regenerateFromQueueAction(input: { taskId: string }): Promise<ActionState> {
  const { organizationId, userId } = await scope();
  if (!taskId.safeParse(input.taskId).success)
    return { status: "error", message: "Datos inválidos." };
  try {
    // Con RLS: la tarea tiene que ser de la organización del usuario.
    const [task] = await withUserContext(getDb(), { sub: userId }, (tx) =>
      tx
        .select({
          prospectId: outreachTasks.prospectId,
          channel: outreachTasks.channel,
          status: outreachTasks.status,
        })
        .from(outreachTasks)
        .where(
          and(eq(outreachTasks.id, input.taskId), eq(outreachTasks.organizationId, organizationId)),
        ),
    );
    if (!task || task.status !== "ready")
      return { status: "error", message: "Esta tarea ya no está disponible." };
    await queueDraftRegeneration(getDb(), {
      organizationId,
      prospectId: task.prospectId,
      channel: task.channel,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return {
    status: "success",
    message: "Regenerando el mensaje: la tarea vuelve a la cola cuando esté lista.",
  };
}
