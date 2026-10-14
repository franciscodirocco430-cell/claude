"use server";

import { withUserContext } from "@/db/rls";
import type { ActionState } from "@/server/actions";
import { updateAgentSettings } from "@/server/agent/config-service";
import { agentSettingsSchema } from "@/server/agent/settings";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";

export async function saveAgentSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  const text = (k: string) => String(formData.get(k) ?? "");
  const parsed = agentSettingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    script: text("script"),
    replyDelayMinSeconds: text("replyDelayMinSeconds"),
    replyDelayMaxSeconds: text("replyDelayMaxSeconds"),
    qualifyScore: text("qualifyScore"),
    calendarAccountId: text("calendarAccountId") || null,
    meetingTitle: text("meetingTitle"),
    meetingDurationMinutes: text("meetingDurationMinutes"),
    meetingStartHour: text("meetingStartHour"),
    meetingEndHour: text("meetingEndHour"),
    meetingDays: formData.getAll("meetingDays").map(String),
    minNoticeHours: text("minNoticeHours"),
    bookingWindowDays: text("bookingWindowDays"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      updateAgentSettings(tx, {
        organizationId: ctx.organizationId,
        campaignId,
        actorRole: ctx.role,
        settings: parsed.data,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return {
    status: "success",
    message: parsed.data.enabled
      ? "Guardado. El agente está activo."
      : "Guardado. El agente está apagado.",
  };
}
