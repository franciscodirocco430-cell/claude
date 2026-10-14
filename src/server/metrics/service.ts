import { sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import {
  groupMetrics,
  SETTER_AI,
  SETTER_AUTO,
  totalMetrics,
  type MetricRow,
  type RawMetrics,
} from "./aggregate";

export interface MetricsQuery {
  organizationId: string;
  from: Date;
  /** Exclusivo. */
  to: Date;
  campaignId?: string | null;
}

/** Setter al que se atribuye un mensaje saliente. */
const setterExpr = (author: string, sentBy: string) =>
  sql.raw(
    `case when ${author} = 'ai' then '${SETTER_AI}' when ${sentBy} is not null then ${sentBy}::text else '${SETTER_AUTO}' end`,
  );

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

/**
 * Lee lo necesario para las métricas del período (con el RLS del usuario si
 * `db` es una transacción de `withUserContext`). Definiciones:
 * - enviados: mensajes salientes del período (personas, IA y secuencias);
 * - contactados: prospectos con un saliente en el período; respondieron: los que
 *   escribieron DESPUÉS de ese primer saliente (cualquier canal; por canal, en ese canal);
 * - calificados: leads que entraron a calificado, agendado o ganado en el período;
 * - agendados: reuniones creadas en el período;
 * - costo de IA: suma de `ai_runs` del período (null si faltan precios).
 * Atribución de calificados y agendados: canal de la primera respuesta del prospecto
 * y setter del primer mensaje que se le envió.
 */
export async function loadRawMetrics(db: DbExecutor, q: MetricsQuery): Promise<RawMetrics> {
  const org = q.organizationId;
  const from = q.from.toISOString();
  const to = q.to.toISOString();
  const camp = q.campaignId ?? null;
  const campFilter = (col: string) => (camp ? sql`and ${sql.raw(col)} = ${camp}::uuid` : sql``);

  const sent = (await db.execute(sql`
    select c.campaign_id, c.channel::text as channel,
           ${setterExpr("m.author", "m.sent_by_user_id")} as setter,
           count(*)::int as n
    from messages m
    join conversations c on c.id = m.conversation_id
    where m.organization_id = ${org} and m.direction = 'out'
      and m.sent_at >= ${from}::timestamptz and m.sent_at < ${to}::timestamptz
      ${campFilter("c.campaign_id")}
    group by 1, 2, 3`)) as Row[];

  const outs = sql`
    select c.prospect_id, c.channel, c.campaign_id, m.sent_at, m.author, m.sent_by_user_id,
           row_number() over (partition by c.prospect_id order by m.sent_at, m.id) as rn_p,
           row_number() over (partition by c.prospect_id, c.channel order by m.sent_at, m.id) as rn_pc
    from messages m
    join conversations c on c.id = m.conversation_id
    where m.organization_id = ${org} and m.direction = 'out'
      and m.sent_at >= ${from}::timestamptz and m.sent_at < ${to}::timestamptz
      ${campFilter("c.campaign_id")}`;

  const touches = (await db.execute(sql`
    with outs as (${outs})
    select o.campaign_id, o.channel::text as channel,
           ${setterExpr("o.author", "o.sent_by_user_id")} as setter,
           exists (
             select 1 from messages mi join conversations ci on ci.id = mi.conversation_id
             where ci.organization_id = ${org} and ci.prospect_id = o.prospect_id
               and mi.direction = 'in' and mi.sent_at > o.sent_at
           ) as responded
    from outs o where o.rn_p = 1`)) as Row[];

  const channelTouches = (await db.execute(sql`
    with outs as (${outs})
    select o.channel::text as channel,
           exists (
             select 1 from messages mi join conversations ci on ci.id = mi.conversation_id
             where ci.organization_id = ${org} and ci.prospect_id = o.prospect_id
               and ci.channel = o.channel and mi.direction = 'in' and mi.sent_at > o.sent_at
           ) as responded
    from outs o where o.rn_pc = 1`)) as Row[];

  // Canal de la primera respuesta y setter del primer envío de cada prospecto (para atribuir).
  const attribution = sql`
    left join lateral (
      select ci.channel::text as channel from messages mi join conversations ci on ci.id = mi.conversation_id
      where ci.organization_id = ${org} and ci.prospect_id = x.prospect_id and mi.direction = 'in'
      order by mi.sent_at limit 1
    ) first_in on true
    left join lateral (
      select ${setterExpr("mo.author", "mo.sent_by_user_id")} as setter, co.channel::text as channel
      from messages mo join conversations co on co.id = mo.conversation_id
      where co.organization_id = ${org} and co.prospect_id = x.prospect_id and mo.direction = 'out'
      order by mo.sent_at limit 1
    ) first_out on true`;

  const qualified = (await db.execute(sql`
    select x.campaign_id, coalesce(first_in.channel, first_out.channel) as channel, first_out.setter
    from (
      select distinct on (e.lead_score_id) e.lead_score_id, e.prospect_id, e.campaign_id
      from lead_stage_events e
      where e.organization_id = ${org} and e.stage_key in ('calificado', 'agendado', 'ganado')
        and e.at >= ${from}::timestamptz and e.at < ${to}::timestamptz
        ${campFilter("e.campaign_id")}
      order by e.lead_score_id, e.at
    ) x
    ${attribution}`)) as Row[];

  const booked = (await db.execute(sql`
    select x.campaign_id, coalesce(cm.channel::text, first_in.channel, first_out.channel) as channel,
           first_out.setter
    from meetings x
    left join conversations cm on cm.id = x.conversation_id
    ${attribution}
    where x.organization_id = ${org} and x.status = 'scheduled'
      and x.created_at >= ${from}::timestamptz and x.created_at < ${to}::timestamptz
      ${campFilter("x.campaign_id")}`)) as Row[];

  const aiRuns = (await db.execute(sql`
    select coalesce(c.campaign_id, p.campaign_id) as campaign_id,
           coalesce(c.channel::text, t.channel::text) as channel,
           count(*)::int as n,
           count(r.cost_usd)::int as priced,
           sum(r.cost_usd)::float8 as cost
    from ai_runs r
    left join conversations c on c.id = r.conversation_id
    left join prospects p on p.id = r.prospect_id
    left join lateral (
      select ot.channel from outreach_tasks ot where ot.ai_run_id = r.id limit 1
    ) t on true
    where r.organization_id = ${org}
      and r.created_at >= ${from}::timestamptz and r.created_at < ${to}::timestamptz
      ${camp ? sql`and coalesce(c.campaign_id, p.campaign_id) = ${camp}::uuid` : sql``}
    group by 1, 2`)) as Row[];

  return {
    sent: sent.map((r) => ({
      campaignId: str(r.campaign_id),
      channel: str(r.channel),
      setter: str(r.setter),
      count: Number(r.n),
    })),
    touches: touches.map((r) => ({
      campaignId: str(r.campaign_id),
      channel: str(r.channel),
      setter: str(r.setter),
      responded: r.responded === true,
    })),
    channelTouches: channelTouches.map((r) => ({
      channel: String(r.channel),
      responded: r.responded === true,
    })),
    qualified: qualified.map((r) => ({
      campaignId: str(r.campaign_id),
      channel: str(r.channel),
      setter: str(r.setter),
    })),
    booked: booked.map((r) => ({
      campaignId: str(r.campaign_id),
      channel: str(r.channel),
      setter: str(r.setter),
    })),
    aiRuns: aiRuns.map((r) => ({
      campaignId: str(r.campaign_id),
      channel: str(r.channel),
      count: Number(r.n),
      // Si alguna corrida no tiene precio, el costo del grupo queda incompleto: se informa aparte.
      costUsd: Number(r.priced) > 0 ? Number(r.cost) : null,
    })),
  };
}

export interface MetricsReport {
  totals: MetricRow;
  byCampaign: MetricRow[];
  byChannel: MetricRow[];
  bySetter: MetricRow[];
  /** Corridas de IA sin costo (faltan precios en el env). */
  unpricedAiRuns: number;
}

export async function getMetrics(db: DbExecutor, q: MetricsQuery): Promise<MetricsReport> {
  const raw = await loadRawMetrics(db, q);
  const [unpriced] = (await db.execute(sql`
    select count(*)::int as n from ai_runs r
    left join conversations c on c.id = r.conversation_id
    left join prospects p on p.id = r.prospect_id
    where r.organization_id = ${q.organizationId} and r.cost_usd is null
      and r.created_at >= ${q.from.toISOString()}::timestamptz
      and r.created_at < ${q.to.toISOString()}::timestamptz
      ${q.campaignId ? sql`and coalesce(c.campaign_id, p.campaign_id) = ${q.campaignId}::uuid` : sql``}`)) as Row[];
  return {
    totals: totalMetrics(raw),
    byCampaign: groupMetrics(raw, "campaign"),
    byChannel: groupMetrics(raw, "channel"),
    bySetter: groupMetrics(raw, "setter"),
    unpricedAiRuns: Number(unpriced?.n ?? 0),
  };
}
