import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { READ_ONLY, createdAt, id, tenantPolicies, timestamps } from "./_helpers";
import { aiRunStatus, aiRunType, jobStatus } from "./enums";
import { organizations } from "./tenancy";

/**
 * Auditoría de cada decisión de la IA. Sin FKs a entidades de negocio a
 * propósito: el registro tiene que sobrevivir aunque se borre el prospecto.
 */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: aiRunType("type").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    inputSummary: text("input_summary"),
    output: jsonb("output"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Null si no hay precios configurados para el modelo. */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    durationMs: integer("duration_ms"),
    status: aiRunStatus("status").notNull().default("ok"),
    error: text("error"),
    prospectId: uuid("prospect_id"),
    conversationId: uuid("conversation_id"),
    ...createdAt(),
  },
  (t) => [
    index("ai_runs_org_created_idx").on(t.organizationId, t.createdAt),
    ...tenantPolicies("ai_runs", t.organizationId, READ_ONLY),
  ],
);

/** Cola de trabajos en segundo plano. RLS activo sin políticas: solo el worker/servidor. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: jobStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    /** Si se repite, el encolado es un no-op: garantiza idempotencia. */
    idempotencyKey: text("idempotency_key").unique(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [index("jobs_ready_idx").on(t.status, t.runAt)],
).enableRLS();
