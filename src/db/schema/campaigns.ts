import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { ADMIN_WRITE, id, tenantPolicies, timestamps } from "./_helpers";
import { campaignStatus, channel } from "./enums";
import { organizations } from "./tenancy";

export interface QualificationCriterion {
  label: string;
  description?: string;
  weight: number;
}

export interface FewShotExample {
  channel: (typeof channel.enumValues)[number];
  context: string;
  message: string;
}

/** Tope diario de mensajes por setter y canal. */
export type DailyLimits = Partial<Record<(typeof channel.enumValues)[number], number>>;

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: campaignStatus("status").notNull().default("draft"),
    niche: text("niche").notNull(),
    /** Referentes del nicho: se usan para entender lenguaje y dolores, nunca se scrapean. */
    nicheReferences: text("niche_references")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    offer: text("offer").notNull(),
    icp: text("icp").notNull(),
    qualificationCriteria: jsonb("qualification_criteria")
      .$type<QualificationCriterion[]>()
      .notNull()
      .default([]),
    qualificationQuestions: jsonb("qualification_questions")
      .$type<string[]>()
      .notNull()
      .default([]),
    channels: channel("channels")
      .array()
      .notNull()
      .default(sql`'{}'::channel[]`),
    tone: text("tone"),
    dailyLimits: jsonb("daily_limits").$type<DailyLimits>().notNull().default({}),
    fewShotExamples: jsonb("few_shot_examples").$type<FewShotExample[]>().notNull().default([]),
    bookingUrl: text("booking_url"),
    /** Configuración del agente conversacional (validada con Zod en src/server/agent/settings.ts). */
    agentSettings: jsonb("agent_settings").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("campaigns_org_id_unique").on(t.organizationId, t.id),
    ...tenantPolicies("campaigns", t.organizationId, ADMIN_WRITE),
  ],
);
