import { describe, expect, it } from "vitest";
import { groupMetrics, SETTER_AI, totalMetrics, type RawMetrics } from "./aggregate";
import { toCsv } from "./csv";
import { parsePeriod } from "./period";

const raw: RawMetrics = {
  sent: [
    { campaignId: "a", channel: "instagram", setter: "u1", count: 3 },
    { campaignId: "b", channel: "instagram", setter: SETTER_AI, count: 2 },
  ],
  touches: [
    { campaignId: "a", channel: "instagram", setter: "u1", responded: true },
    { campaignId: "a", channel: "instagram", setter: "u1", responded: false },
    { campaignId: "b", channel: "instagram", setter: SETTER_AI, responded: true },
  ],
  channelTouches: [
    { channel: "instagram", responded: true },
    { channel: "instagram", responded: false },
    { channel: "whatsapp", responded: false },
  ],
  qualified: [{ campaignId: "a", channel: "instagram", setter: "u1" }],
  booked: [{ campaignId: "b", channel: null, setter: SETTER_AI }],
  aiRuns: [
    { campaignId: "a", channel: "instagram", costUsd: 0.25, count: 2 },
    { campaignId: "b", channel: null, costUsd: null, count: 1 },
  ],
};

describe("agregación", () => {
  it("totales con tasa de respuesta", () => {
    expect(totalMetrics(raw)).toMatchObject({
      sent: 5,
      contacted: 3,
      responded: 2,
      qualified: 1,
      booked: 1,
      aiRuns: 3,
      aiCostUsd: 0.25,
    });
    expect(totalMetrics(raw).responseRate).toBeCloseTo(2 / 3);
  });

  it("por campaña, canal (con sus propios contactos) y setter (sin costo de IA)", () => {
    const byCampaign = groupMetrics(raw, "campaign");
    expect(byCampaign.find((r) => r.key === "a")).toMatchObject({
      sent: 3,
      contacted: 2,
      responseRate: 0.5,
      aiCostUsd: 0.25,
    });
    expect(byCampaign.find((r) => r.key === "b")).toMatchObject({
      booked: 1,
      aiCostUsd: null,
      aiRuns: 1,
    });
    const byChannel = groupMetrics(raw, "channel");
    expect(byChannel.find((r) => r.key === "whatsapp")).toMatchObject({
      contacted: 1,
      responseRate: 0,
    });
    expect(byChannel.find((r) => r.key === null)).toMatchObject({ booked: 1, aiRuns: 1 });
    const bySetter = groupMetrics(raw, "setter");
    expect(bySetter.every((r) => r.aiCostUsd === null && r.aiRuns === 0)).toBe(true);
    expect(bySetter[0]!.key).toBe("u1"); // ordenado por enviados
  });

  it("sin contactados la tasa es null (no 0 %)", () => {
    const empty: RawMetrics = {
      sent: [],
      touches: [],
      channelTouches: [],
      qualified: [],
      booked: [],
      aiRuns: [],
    };
    expect(totalMetrics(empty).responseRate).toBeNull();
    expect(totalMetrics(empty).aiCostUsd).toBeNull();
  });
});

describe("CSV", () => {
  it("escapa comillas, comas y saltos; BOM y CRLF", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ['dice "hola", chau', "dos\nlíneas"],
        [1.5, null],
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿a,b\r\n"dice ""hola"", chau","dos\nlíneas"\r\n1.5,\r\n');
  });

  it("neutraliza fórmulas en textos (inyección CSV) pero no en números", () => {
    const csv = toCsv(["x"], [['=HYPERLINK("http://malo")'], ["+1"], ["@SUM(A1)"], [-5]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://malo"")"`);
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("\r\n-5\r\n");
  });
});

describe("período", () => {
  const tz = "America/Argentina/Buenos_Aires";
  // 14/10/2026 01:00 en Buenos Aires = 04:00 UTC.
  const now = new Date("2026-10-14T04:00:00Z");

  it("por defecto: últimos 30 días incluido hoy, en la zona de la organización", () => {
    const p = parsePeriod({}, tz, now);
    expect(p).toMatchObject({ desde: "2026-09-15", hasta: "2026-10-14" });
    expect(p.from.toISOString()).toBe("2026-09-15T03:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-10-15T03:00:00.000Z");
  });

  it("respeta fechas válidas e ignora inválidas o invertidas", () => {
    expect(parsePeriod({ desde: "2026-10-01", hasta: "2026-10-07" }, tz, now)).toMatchObject({
      desde: "2026-10-01",
      hasta: "2026-10-07",
    });
    expect(parsePeriod({ desde: "basura", hasta: "2026-10-07" }, tz, now).desde).toBe("2026-09-08");
    expect(parsePeriod({ desde: "2026-10-10", hasta: "2026-10-01" }, tz, now).desde).toBe(
      "2026-09-02",
    );
  });

  it("limita a un año", () => {
    const p = parsePeriod({ desde: "2020-01-01", hasta: "2026-10-14" }, tz, now);
    expect((p.to.getTime() - p.from.getTime()) / 86_400_000).toBeLessThanOrEqual(366);
  });
});
