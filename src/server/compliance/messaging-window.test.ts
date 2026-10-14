import { describe, expect, it } from "vitest";
import { getWindowStatus } from "./messaging-window";

const H = 60 * 60 * 1000;
const inbound = new Date("2026-10-01T12:00:00Z");
const at = (hours: number) => new Date(inbound.getTime() + hours * H);

describe("getWindowStatus", () => {
  it("email no tiene ventana", () => {
    expect(
      getWindowStatus({
        channel: "email",
        lastInboundAt: null,
        businessMessagesSinceInbound: 0,
        now: at(0),
      }),
    ).toEqual({ kind: "not_applicable" });
  });

  it.each(["instagram", "facebook", "whatsapp", "tiktok"] as const)(
    "%s: sin mensaje entrante la ventana está cerrada",
    (channel) => {
      expect(
        getWindowStatus({
          channel,
          lastInboundAt: null,
          businessMessagesSinceInbound: 0,
          now: at(0),
        }),
      ).toEqual({ kind: "closed", reason: "no_inbound", expiresAt: null });
    },
  );

  it.each(["instagram", "facebook", "whatsapp"] as const)("%s: ventana de 24 h", (channel) => {
    const base = { channel, lastInboundAt: inbound, businessMessagesSinceInbound: 50 };
    const open = getWindowStatus({ ...base, now: at(23.99) });
    expect(open).toEqual({ kind: "open", expiresAt: at(24), remainingMessages: null });
    expect(getWindowStatus({ ...base, now: at(24) })).toEqual({
      kind: "closed",
      reason: "expired",
      expiresAt: at(24),
    });
  });

  it("tiktok: ventana de 48 h", () => {
    const base = {
      channel: "tiktok" as const,
      lastInboundAt: inbound,
      businessMessagesSinceInbound: 0,
    };
    expect(getWindowStatus({ ...base, now: at(47.9) }).kind).toBe("open");
    expect(getWindowStatus({ ...base, now: at(48) })).toMatchObject({
      kind: "closed",
      reason: "expired",
    });
  });

  it("tiktok: máximo 10 mensajes del negocio dentro de la ventana", () => {
    const base = { channel: "tiktok" as const, lastInboundAt: inbound, now: at(1) };
    expect(getWindowStatus({ ...base, businessMessagesSinceInbound: 9 })).toMatchObject({
      kind: "open",
      remainingMessages: 1,
    });
    expect(getWindowStatus({ ...base, businessMessagesSinceInbound: 10 })).toMatchObject({
      kind: "closed",
      reason: "message_cap",
    });
  });
});
