"use server";

import { z } from "zod";
import { withUserContext } from "@/db/rls";
import { getServerEnv } from "@/lib/env";
import type { ActionState } from "@/server/actions";
import { isAdminRole } from "@/server/auth/permissions";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { googleConfigFromEnv } from "@/server/google/config";
import {
  disconnectMailbox,
  MAX_MAILBOX_DAILY_LIMIT,
  updateMailboxSettings,
} from "@/server/google/mailboxes";

const settingsSchema = z.object({
  accountId: z.uuid(),
  dailySendLimit: z.coerce
    .number({ error: "Límite inválido." })
    .int({ error: "Tiene que ser un número entero." })
    .min(1, { error: "El mínimo es 1." })
    .max(MAX_MAILBOX_DAILY_LIMIT, { error: `El máximo es ${MAX_MAILBOX_DAILY_LIMIT}.` }),
  signature: z.string().trim().max(500, { error: "La firma puede tener hasta 500 caracteres." }),
});

export async function updateMailboxAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) return { status: "error", message: "Solo owners y admins." };
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  try {
    // RLS: solo owners/admins pueden escribir connected_accounts.
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      updateMailboxSettings(tx, {
        organizationId: ctx.organizationId,
        accountId: parsed.data.accountId,
        dailySendLimit: parsed.data.dailySendLimit,
        signature: parsed.data.signature || null,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Guardado." };
}

export async function disconnectMailboxAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) return { status: "error", message: "Solo owners y admins." };
  const accountId = z.uuid().safeParse(formData.get("accountId"));
  if (!accountId.success) return { status: "error", message: "Datos inválidos." };
  const env = getServerEnv();
  try {
    await disconnectMailbox(getDb(), {
      organizationId: ctx.organizationId,
      accountId: accountId.data,
      config: googleConfigFromEnv(env),
      encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Casilla desconectada." };
}
