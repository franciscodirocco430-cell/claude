import { asc, eq } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import { campaigns, organizations } from "@/db/schema";
import { listMembers } from "@/server/organizations/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { SETTER_AI, SETTER_AUTO, type Dimension, type MetricRow } from "./aggregate";
import { toCsv } from "./csv";
import { parsePeriod, type Period } from "./period";
import { getMetrics, type MetricsReport } from "./service";

export interface LabeledRow extends MetricRow {
  label: string;
}

export interface MetricsPage {
  period: Period;
  timeZone: string;
  campaignId: string | null;
  campaigns: { id: string; name: string }[];
  report: MetricsReport;
  rows: Record<Dimension, LabeledRow[]>;
}

/** Arma el reporte con etiquetas legibles (nombres de campañas, personas y canales). */
export async function buildMetricsPage(
  db: DbExecutor,
  input: {
    organizationId: string;
    desde?: string;
    hasta?: string;
    campana?: string;
    now?: Date;
  },
): Promise<MetricsPage> {
  const [org] = await db
    .select({ timeZone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId));
  const timeZone = org?.timeZone ?? "America/Argentina/Buenos_Aires";
  const period = parsePeriod({ desde: input.desde, hasta: input.hasta }, timeZone, input.now);
  const campaignList = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.organizationId, input.organizationId))
    .orderBy(asc(campaigns.name));
  const campaignId = campaignList.some((c) => c.id === input.campana) ? input.campana! : null;
  const report = await getMetrics(db, {
    organizationId: input.organizationId,
    from: period.from,
    to: period.to,
    campaignId,
  });
  const members = await listMembers(db, input.organizationId);
  const campaignName = new Map(campaignList.map((c) => [c.id, c.name]));
  const memberName = new Map(members.map((m) => [m.userId, m.fullName ?? m.email ?? "Sin nombre"]));
  const label = (d: Dimension, key: string | null) => {
    if (d === "campaign") return key ? (campaignName.get(key) ?? "Campaña borrada") : "Sin campaña";
    if (d === "channel")
      return key ? (CHANNEL_LABELS[key as keyof typeof CHANNEL_LABELS] ?? key) : "Sin canal";
    if (key === SETTER_AI) return "IA (agente)";
    if (key === SETTER_AUTO) return "Automático (secuencias de email)";
    return key ? (memberName.get(key) ?? "Ex miembro") : "Sin atribuir";
  };
  const withLabels = (d: Dimension, list: MetricRow[]) =>
    list.map((r) => ({ ...r, label: label(d, r.key) }));
  return {
    period,
    timeZone,
    campaignId,
    campaigns: campaignList,
    report,
    rows: {
      campaign: withLabels("campaign", report.byCampaign),
      channel: withLabels("channel", report.byChannel),
      setter: withLabels("setter", report.bySetter),
    },
  };
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  campaign: "Campaña",
  channel: "Canal",
  setter: "Setter",
};

/** CSV de una vista (números sin formato local: se leen bien en cualquier planilla). */
export function metricsCsv(page: MetricsPage, d: Dimension): string {
  const headers = [
    DIMENSION_LABELS[d],
    "Enviados",
    "Contactados",
    "Respondieron",
    "Tasa de respuesta (%)",
    "Calificados",
    "Agendados",
    ...(d === "setter" ? [] : ["Corridas de IA", "Costo de IA (USD)"]),
    "Desde",
    "Hasta",
  ];
  const rows = page.rows[d].map((r) => [
    r.label,
    r.sent,
    r.contacted,
    r.responded,
    r.responseRate === null ? null : Math.round(r.responseRate * 1000) / 10,
    r.qualified,
    r.booked,
    ...(d === "setter"
      ? []
      : [r.aiRuns, r.aiCostUsd === null ? null : Number(r.aiCostUsd.toFixed(4))]),
    page.period.desde,
    page.period.hasta,
  ]);
  return toCsv(headers, rows);
}
