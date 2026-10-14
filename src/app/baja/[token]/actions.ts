"use server";

import { getServerEnv } from "@/lib/env";
import type { ActionState } from "@/server/actions";
import { getDb } from "@/server/db";
import { unsubscribeEmail } from "@/server/email/sender";
import { verifyUnsubscribeToken } from "@/server/email/unsubscribe";

export async function confirmUnsubscribeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const secret = getServerEnv().UNSUBSCRIBE_SIGNING_SECRET;
  const payload = secret ? verifyUnsubscribeToken(token, secret) : null;
  if (!payload) return { status: "error", message: "El link de baja no es válido." };
  await unsubscribeEmail(getDb(), { organizationId: payload.o, email: payload.e });
  return { status: "success" };
}
