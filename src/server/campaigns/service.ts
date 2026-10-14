import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import type { campaignStatus } from "@/db/schema";
import { campaigns, outreachTasks, prospectHandles, prospects, researchNotes } from "@/db/schema";
import { isAdminRole, type Role } from "@/server/auth/permissions";
import { DomainError } from "@/server/errors";
import type { CampaignInput } from "./schemas";

export type Campaign = typeof campaigns.$inferSelect;
export type CampaignStatus = (typeof campaignStatus.enumValues)[number];

function assertAdmin(role: Role) {
  if (!isAdminRole(role)) {
    throw new DomainError("forbidden", "Solo owners y admins pueden gestionar campañas.");
  }
}

export interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  niche: string;
  channels: Campaign["channels"];
  prospectCount: number;
  updatedAt: Date;
}

export async function listCampaigns(
  db: DbExecutor,
  organizationId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<CampaignListItem[]> {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      niche: campaigns.niche,
      channels: campaigns.channels,
      updatedAt: campaigns.updatedAt,
      prospectCount: sql<number>`count(${prospects.id})::int`,
    })
    .from(campaigns)
    .leftJoin(
      prospects,
      and(
        eq(prospects.campaignId, campaigns.id),
        eq(prospects.organizationId, campaigns.organizationId),
      ),
    )
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        opts.includeArchived ? undefined : ne(campaigns.status, "archived"),
      ),
    )
    .groupBy(campaigns.id)
    .orderBy(
      sql`case ${campaigns.status} when 'active' then 0 when 'draft' then 1 when 'paused' then 2 else 3 end`,
      desc(campaigns.updatedAt),
    );
}

export async function getCampaign(db: DbExecutor, organizationId: string, id: string) {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)));
  return row ?? null;
}

export async function createCampaign(
  db: DbExecutor,
  input: {
    organizationId: string;
    actorId: string;
    actorRole: Role;
    data: CampaignInput;
    activate?: boolean;
  },
) {
  assertAdmin(input.actorRole);
  const [row] = await db
    .insert(campaigns)
    .values({
      ...input.data,
      organizationId: input.organizationId,
      createdBy: input.actorId,
      status: input.activate ? "active" : "draft",
    })
    .returning();
  return row!;
}

export async function updateCampaign(
  db: DbExecutor,
  input: { organizationId: string; actorRole: Role; id: string; data: CampaignInput },
) {
  assertAdmin(input.actorRole);
  const [row] = await db
    .update(campaigns)
    .set(input.data)
    .where(and(eq(campaigns.id, input.id), eq(campaigns.organizationId, input.organizationId)))
    .returning();
  if (!row) throw new DomainError("not_found", "La campaña no existe.");
  return row;
}

export type StatusAction = "activate" | "pause" | "archive" | "restore";

const TRANSITIONS: Record<StatusAction, { from: CampaignStatus[]; to: CampaignStatus }> = {
  activate: { from: ["draft", "paused"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  archive: { from: ["draft", "active", "paused"], to: "archived" },
  restore: { from: ["archived"], to: "paused" },
};

export function nextStatus(current: CampaignStatus, action: StatusAction): CampaignStatus | null {
  const t = TRANSITIONS[action];
  return t.from.includes(current) ? t.to : null;
}

export async function changeCampaignStatus(
  db: DbExecutor,
  input: { organizationId: string; actorRole: Role; id: string; action: StatusAction },
) {
  assertAdmin(input.actorRole);
  const current = await getCampaign(db, input.organizationId, input.id);
  if (!current) throw new DomainError("not_found", "La campaña no existe.");
  const to = nextStatus(current.status, input.action);
  if (!to) throw new DomainError("invalid_transition", "Esa acción no aplica al estado actual.");
  await db
    .update(campaigns)
    .set({ status: to })
    .where(and(eq(campaigns.id, input.id), eq(campaigns.organizationId, input.organizationId)));
  return to;
}

export const PROSPECTS_PAGE_SIZE = 50;

export async function countCampaignProspects(
  db: DbExecutor,
  organizationId: string,
  campaignId: string,
) {
  const [row] = await db
    .select({ n: count() })
    .from(prospects)
    .where(and(eq(prospects.organizationId, organizationId), eq(prospects.campaignId, campaignId)));
  return row?.n ?? 0;
}

export async function listCampaignProspects(
  db: DbExecutor,
  input: { organizationId: string; campaignId: string; search?: string; page?: number },
) {
  const page = Math.max(1, input.page ?? 1);
  const term = input.search?.trim();
  const filter = and(
    eq(prospects.organizationId, input.organizationId),
    eq(prospects.campaignId, input.campaignId),
    term
      ? sql`(${prospects.fullName} ilike ${`%${term}%`} or ${prospects.company} ilike ${`%${term}%`} or ${prospects.email} ilike ${`%${term}%`} or exists (select 1 from prospect_handles h where h.prospect_id = ${prospects.id} and h.handle ilike ${`%${term}%`}))`
      : undefined,
  );
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: prospects.id,
        fullName: prospects.fullName,
        company: prospects.company,
        email: prospects.email,
        phone: prospects.phone,
        website: prospects.website,
        source: prospects.source,
        whatsappOptIn: prospects.whatsappOptIn,
        aiStatus: prospects.aiStatus,
        aiError: prospects.aiError,
        createdAt: prospects.createdAt,
        // Ojo: en el SELECT, Drizzle no califica ${prospects.id} y dentro de la
        // subconsulta "id" se resolvería como h.id. Por eso va escrito a mano.
        handles: sql<{ channel: string; handle: string | null; url: string | null }[]>`coalesce(
          (select json_agg(json_build_object('channel', h.channel, 'handle', h.handle, 'url', h.url) order by h.channel)
           from prospect_handles h where h.prospect_id = prospects.id), '[]'::json)`,
      })
      .from(prospects)
      .where(filter)
      .orderBy(desc(prospects.createdAt), asc(prospects.id))
      .limit(PROSPECTS_PAGE_SIZE)
      .offset((page - 1) * PROSPECTS_PAGE_SIZE),
    db.select({ n: count() }).from(prospects).where(filter),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize: PROSPECTS_PAGE_SIZE };
}

export async function updateFewShotExamples(
  db: DbExecutor,
  input: {
    organizationId: string;
    actorRole: Role;
    id: string;
    examples: Campaign["fewShotExamples"];
  },
) {
  assertAdmin(input.actorRole);
  const [row] = await db
    .update(campaigns)
    .set({ fewShotExamples: input.examples })
    .where(and(eq(campaigns.id, input.id), eq(campaigns.organizationId, input.organizationId)))
    .returning({ id: campaigns.id });
  if (!row) throw new DomainError("not_found", "La campaña no existe.");
}

export async function getProspectDetail(
  db: DbExecutor,
  input: { organizationId: string; campaignId: string; prospectId: string },
) {
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(
      and(
        eq(prospects.id, input.prospectId),
        eq(prospects.organizationId, input.organizationId),
        eq(prospects.campaignId, input.campaignId),
      ),
    );
  if (!prospect) return null;
  const [handles, notes, tasks] = await Promise.all([
    db.select().from(prospectHandles).where(eq(prospectHandles.prospectId, prospect.id)),
    db
      .select()
      .from(researchNotes)
      .where(eq(researchNotes.prospectId, prospect.id))
      .orderBy(desc(researchNotes.createdAt))
      .limit(1),
    db
      .select()
      .from(outreachTasks)
      .where(eq(outreachTasks.prospectId, prospect.id))
      .orderBy(desc(outreachTasks.updatedAt)),
  ]);
  return { prospect, handles, research: notes[0] ?? null, tasks };
}
