import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import {
  ADMIN_WRITE,
  MEMBER_WRITE,
  createdAt,
  id,
  tenantFk,
  tenantPolicies,
  timestamps,
} from "./_helpers";
import { campaigns } from "./campaigns";
import { channel, prospectSource, stageKind, suppressionKind, suppressionReason } from "./enums";
import { organizations } from "./tenancy";

const orgId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export const prospects = pgTable(
  "prospects",
  {
    id: id(),
    organizationId: orgId(),
    campaignId: uuid("campaign_id"),
    fullName: text("full_name"),
    company: text("company"),
    industry: text("industry"),
    website: text("website"),
    /** Dominio normalizado de `website` (null si es un agregador de links). Para deduplicar. */
    websiteDomain: text("website_domain"),
    email: text("email"),
    /** Formato E.164 (ej. +5491123456789). */
    phone: text("phone"),
    notes: text("notes"),
    source: prospectSource("source").notNull().default("manual"),
    /** Detalle del origen: nombre del CSV, id de la fuente pública, etc. */
    sourceRef: text("source_ref"),
    timezone: text("timezone"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    whatsappOptInAt: timestamp("whatsapp_opt_in_at", { withTimezone: true }),
    whatsappOptInSource: text("whatsapp_opt_in_source"),
    ownerId: uuid("owner_id").references(() => authUsers.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("prospects_org_id_unique").on(t.organizationId, t.id),
    tenantFk("prospects_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "set null",
    ),
    // Un mismo email o teléfono no puede estar dos veces en la organización: la
    // deduplicación del importador se apoya en esto para ser segura ante carreras.
    uniqueIndex("prospects_org_email_unique")
      .on(t.organizationId, t.email)
      .where(sql`${t.email} is not null`),
    uniqueIndex("prospects_org_phone_unique")
      .on(t.organizationId, t.phone)
      .where(sql`${t.phone} is not null`),
    index("prospects_org_domain_idx").on(t.organizationId, t.websiteDomain),
    index("prospects_org_campaign_idx").on(t.organizationId, t.campaignId),
    // Sin fecha de opt-in no hay consentimiento registrado.
    check(
      "prospects_whatsapp_opt_in_has_date",
      sql`not ${t.whatsappOptIn} or ${t.whatsappOptInAt} is not null`,
    ),
    ...tenantPolicies("prospects", t.organizationId, MEMBER_WRITE),
  ],
);

export const prospectHandles = pgTable(
  "prospect_handles",
  {
    id: id(),
    organizationId: orgId(),
    prospectId: uuid("prospect_id").notNull(),
    channel: channel("channel").notNull(),
    handle: text("handle"),
    url: text("url"),
    ...createdAt(),
  },
  (t) => [
    tenantFk("prospect_handles_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete(
      "cascade",
    ),
    unique("prospect_handles_org_channel_handle_unique").on(t.organizationId, t.channel, t.handle),
    index("prospect_handles_prospect_idx").on(t.prospectId),
    check("prospect_handles_has_value", sql`${t.handle} is not null or ${t.url} is not null`),
    ...tenantPolicies("prospect_handles", t.organizationId, MEMBER_WRITE),
  ],
);

export interface ResearchSource {
  url: string;
  kind: "user_input" | "csv" | "website" | "official_api";
}

export const researchNotes = pgTable(
  "research_notes",
  {
    id: id(),
    organizationId: orgId(),
    prospectId: uuid("prospect_id").notNull(),
    summary: text("summary").notNull(),
    pains: jsonb("pains").$type<string[]>().notNull().default([]),
    hooks: jsonb("hooks").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<ResearchSource[]>().notNull().default([]),
    aiRunId: uuid("ai_run_id"),
    ...createdAt(),
  },
  (t) => [
    tenantFk("research_notes_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete(
      "cascade",
    ),
    index("research_notes_prospect_idx").on(t.prospectId),
    ...tenantPolicies("research_notes", t.organizationId, MEMBER_WRITE),
  ],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: id(),
    organizationId: orgId(),
    /** Clave estable: nuevo, contactado, respondio, calificado, agendado, ganado, perdido. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    kind: stageKind("kind").notNull().default("open"),
    ...timestamps(),
  },
  (t) => [
    unique("pipeline_stages_org_id_unique").on(t.organizationId, t.id),
    unique("pipeline_stages_org_key_unique").on(t.organizationId, t.key),
    ...tenantPolicies("pipeline_stages", t.organizationId, ADMIN_WRITE),
  ],
);

export type QualificationAnswers = Record<string, { answer: string; met: boolean | null }>;

export const leadScores = pgTable(
  "lead_scores",
  {
    id: id(),
    organizationId: orgId(),
    prospectId: uuid("prospect_id").notNull(),
    campaignId: uuid("campaign_id"),
    score: integer("score").notNull().default(0),
    answers: jsonb("answers").$type<QualificationAnswers>().notNull().default({}),
    stageId: uuid("stage_id").notNull(),
    ...timestamps(),
  },
  (t) => [
    tenantFk("lead_scores_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete(
      "cascade",
    ),
    tenantFk("lead_scores_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "cascade",
    ),
    tenantFk("lead_scores_stage_fk", t.organizationId, t.stageId, pipelineStages),
    unique("lead_scores_prospect_campaign_unique")
      .on(t.organizationId, t.prospectId, t.campaignId)
      .nullsNotDistinct(),
    index("lead_scores_stage_idx").on(t.organizationId, t.stageId),
    check("lead_scores_score_range", sql`${t.score} between 0 and 100`),
    ...tenantPolicies("lead_scores", t.organizationId, MEMBER_WRITE),
  ],
);

/** Lista de supresión global por organización: nadie de acá recibe mensajes. */
export const suppressionList = pgTable(
  "suppression_list",
  {
    id: id(),
    organizationId: orgId(),
    kind: suppressionKind("kind").notNull(),
    /** Valor normalizado (email en minúsculas, teléfono E.164, handle sin @). */
    value: text("value").notNull(),
    channel: channel("channel"),
    reason: suppressionReason("reason").notNull(),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    ...createdAt(),
  },
  (t) => [
    unique("suppression_list_org_kind_value_unique").on(t.organizationId, t.kind, t.value),
    // Cualquier miembro puede suprimir; sacar a alguien de la lista requiere admin.
    ...tenantPolicies("suppression_list", t.organizationId, {
      select: "member",
      insert: "member",
      update: "admin",
      delete: "admin",
    }),
  ],
);
