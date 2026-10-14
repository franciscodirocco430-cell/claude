"use server";

import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import type { ActionState } from "@/server/actions";
import { isAdminRole } from "@/server/auth/permissions";
import { requireAppContext } from "@/server/auth/session";
import {
  connectMockAccount,
  disconnectChannelAccount,
  simulateInboundMessage,
} from "@/server/channels/accounts";
import { getChannelAdapters } from "@/server/channels/env";
import { SOCIAL_CHANNELS } from "@/server/compliance/channels";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { normalizeHandle, normalizePhone } from "@/server/prospects/normalize";

export async function connectMockAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) return { status: "error", message: "Solo owners y admins." };
  const channel = z.enum(SOCIAL_CHANNELS).safeParse(formData.get("channel"));
  if (!channel.success) return { status: "error", message: "Canal inválido." };
  try {
    await connectMockAccount(getDb(), getChannelAdapters(), {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      channel: channel.data,
      encryptionKey: getServerEnv().TOKEN_ENCRYPTION_KEY,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Cuenta de prueba conectada." };
}

export async function disconnectChannelAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) return { status: "error", message: "Solo owners y admins." };
  const accountId = z.uuid().safeParse(formData.get("accountId"));
  if (!accountId.success) return { status: "error", message: "Datos inválidos." };
  try {
    await disconnectChannelAccount(getDb(), {
      organizationId: ctx.organizationId,
      accountId: accountId.data,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Cuenta desconectada." };
}

const simulateSchema = z.object({
  accountId: z.uuid(),
  channel: z.enum(SOCIAL_CHANNELS),
  contact: z.string().trim().min(1, { error: "Completá quién escribe." }).max(100),
  name: z.string().trim().max(100).optional(),
  text: z
    .string()
    .trim()
    .min(1, { error: "Escribí el mensaje." })
    .max(1000, { error: "Hasta 1000 caracteres." }),
});

export async function simulateInboundAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) return { status: "error", message: "Solo owners y admins." };
  const parsed = simulateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { accountId, channel, contact, name, text } = parsed.data;
  const isWhatsapp = channel === "whatsapp";
  const phone = isWhatsapp ? normalizePhone(contact) : null;
  const handle = isWhatsapp ? null : normalizeHandle(contact);
  if (isWhatsapp ? !phone : !handle) {
    return {
      status: "error",
      message: isWhatsapp ? "Teléfono inválido (ej. +54 9 11 2345 6789)." : "Usuario inválido.",
    };
  }
  const env = getServerEnv();
  try {
    await simulateInboundMessage(getDb(), getChannelAdapters(), {
      organizationId: ctx.organizationId,
      accountId,
      secret: env.CHANNELS_MOCK_SECRET ?? "",
      from: { handle, phone, name: name || null },
      text,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return {
    status: "success",
    message: "Mensaje simulado. En unos segundos aparece en la Bandeja.",
  };
}
