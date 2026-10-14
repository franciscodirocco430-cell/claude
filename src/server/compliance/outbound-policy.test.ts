import { describe, expect, it } from "vitest";
import { SOCIAL_CHANNELS } from "./channels";
import { getWindowStatus } from "./messaging-window";
import { decideOutbound } from "./outbound-policy";

const now = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

function decide(
  channel: Parameters<typeof decideOutbound>[0]["channel"],
  opts: { lastInboundAt?: Date | null; sent?: number; suppressed?: boolean; optIn?: boolean } = {},
) {
  return decideOutbound({
    channel,
    window: getWindowStatus({
      channel,
      lastInboundAt: opts.lastInboundAt ?? null,
      businessMessagesSinceInbound: opts.sent ?? 0,
      now,
    }),
    suppressed: opts.suppressed ?? false,
    whatsappOptIn: opts.optIn ?? false,
  });
}

describe("decideOutbound", () => {
  it.each(SOCIAL_CHANNELS)("%s: el primer contacto nunca es automático", (channel) => {
    expect(decide(channel, { optIn: true })).toEqual({
      action: "manual_task",
      reason: "first_contact_requires_human",
    });
  });

  it.each(SOCIAL_CHANNELS)("%s: dentro de la ventana se puede responder", (channel) => {
    expect(decide(channel, { lastInboundAt: hoursAgo(1) })).toEqual({ action: "auto_send" });
  });

  it.each(["instagram", "facebook", "tiktok"] as const)(
    "%s: ventana vencida → tarea manual",
    (channel) => {
      expect(decide(channel, { lastInboundAt: hoursAgo(72) })).toEqual({
        action: "manual_task",
        reason: "window_expired",
      });
    },
  );

  it("whatsapp vencido con opt-in → solo plantilla aprobada", () => {
    expect(decide("whatsapp", { lastInboundAt: hoursAgo(30), optIn: true })).toEqual({
      action: "whatsapp_template",
    });
  });

  it("whatsapp vencido sin opt-in → tarea manual, nunca plantilla", () => {
    expect(decide("whatsapp", { lastInboundAt: hoursAgo(30), optIn: false })).toEqual({
      action: "manual_task",
      reason: "window_expired",
    });
  });

  it("tiktok con 10 mensajes del negocio → tarea manual", () => {
    expect(decide("tiktok", { lastInboundAt: hoursAgo(1), sent: 10 })).toEqual({
      action: "manual_task",
      reason: "message_cap_reached",
    });
  });

  it("email se envía automático", () => {
    expect(decide("email")).toEqual({ action: "auto_send" });
  });

  it.each([...SOCIAL_CHANNELS, "email"] as const)(
    "%s: la lista de supresión bloquea siempre, incluso con ventana abierta",
    (channel) => {
      expect(
        decide(channel, { lastInboundAt: hoursAgo(1), suppressed: true, optIn: true }),
      ).toEqual({ action: "blocked", reason: "suppressed" });
    },
  );
});
