/*
 * Agregación pura de métricas (sin base): recibe filas "crudas" ya filtradas por
 * período y las agrupa por campaña, canal y setter. Cada fila trae a qué
 * campaña/canal/setter se atribuye.
 */

export type Dimension = "campaign" | "channel" | "setter";

/** Claves especiales de setter: mensajes que no mandó una persona. */
export const SETTER_AI = "__ai__";
export const SETTER_AUTO = "__auto__";

export interface Attribution {
  campaignId: string | null;
  channel: string | null;
  /** uuid del usuario, SETTER_AI, SETTER_AUTO o null (sin atribuir). */
  setter: string | null;
}

export interface RawMetrics {
  /** Un registro por grupo de mensajes salientes. */
  sent: (Attribution & { count: number })[];
  /** Primer contacto de cada prospecto en el período (para la tasa a nivel prospecto). */
  touches: (Attribution & { responded: boolean })[];
  /** Primer contacto de cada prospecto en cada canal (tasa por canal). */
  channelTouches: { channel: string; responded: boolean }[];
  qualified: Attribution[];
  booked: Attribution[];
  aiRuns: {
    campaignId: string | null;
    channel: string | null;
    costUsd: number | null;
    count: number;
  }[];
}

export interface MetricRow {
  key: string | null;
  sent: number;
  contacted: number;
  responded: number;
  /** 0..1, null si no hubo contactados. */
  responseRate: number | null;
  qualified: number;
  booked: number;
  /** null = no aplica (setters) o sin precios configurados. */
  aiCostUsd: number | null;
  aiRuns: number;
}

const empty = (key: string | null): MetricRow => ({
  key,
  sent: 0,
  contacted: 0,
  responded: 0,
  responseRate: null,
  qualified: 0,
  booked: 0,
  aiCostUsd: null,
  aiRuns: 0,
});

function keyOf(a: Attribution, d: Dimension) {
  return d === "campaign" ? a.campaignId : d === "channel" ? a.channel : a.setter;
}

function finish(rows: Map<string | null, MetricRow>) {
  return [...rows.values()]
    .map((r) => ({ ...r, responseRate: r.contacted ? r.responded / r.contacted : null }))
    .sort(
      (a, b) =>
        b.sent - a.sent || b.contacted - a.contacted || String(a.key).localeCompare(String(b.key)),
    );
}

/** Agrupa por una dimensión. La IA no se atribuye a setters (su costo no es de nadie). */
export function groupMetrics(raw: RawMetrics, d: Dimension): MetricRow[] {
  const rows = new Map<string | null, MetricRow>();
  const row = (k: string | null) => {
    let r = rows.get(k);
    if (!r) rows.set(k, (r = empty(k)));
    return r;
  };
  for (const s of raw.sent) row(keyOf(s, d)).sent += s.count;
  if (d === "channel") {
    for (const t of raw.channelTouches) {
      const r = row(t.channel);
      r.contacted += 1;
      if (t.responded) r.responded += 1;
    }
  } else {
    for (const t of raw.touches) {
      const r = row(keyOf(t, d));
      r.contacted += 1;
      if (t.responded) r.responded += 1;
    }
  }
  for (const q of raw.qualified) row(keyOf(q, d)).qualified += 1;
  for (const b of raw.booked) row(keyOf(b, d)).booked += 1;
  if (d !== "setter") {
    for (const run of raw.aiRuns) {
      const r = row(d === "campaign" ? run.campaignId : run.channel);
      r.aiRuns += run.count;
      if (run.costUsd !== null) r.aiCostUsd = (r.aiCostUsd ?? 0) + run.costUsd;
    }
  }
  return finish(rows);
}

/** Totales de toda la organización (o de la campaña filtrada). */
export function totalMetrics(raw: RawMetrics): MetricRow {
  const t = empty("total");
  t.sent = raw.sent.reduce((a, s) => a + s.count, 0);
  t.contacted = raw.touches.length;
  t.responded = raw.touches.filter((x) => x.responded).length;
  t.responseRate = t.contacted ? t.responded / t.contacted : null;
  t.qualified = raw.qualified.length;
  t.booked = raw.booked.length;
  t.aiRuns = raw.aiRuns.reduce((a, r) => a + r.count, 0);
  const priced = raw.aiRuns.filter((r) => r.costUsd !== null);
  t.aiCostUsd = priced.length ? priced.reduce((a, r) => a + (r.costUsd ?? 0), 0) : null;
  return t;
}
