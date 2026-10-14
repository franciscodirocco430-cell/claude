import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { MEMBER_WRITE, createdAt, id, tenantFk, tenantPolicies, timestamps } from "./_helpers";
import { campaigns } from "./campaigns";
import { channel, messageAuthor, messageDirection, outreachTaskStatus } from "./enums";
import { prospects } from "./prospects";
import { connectedAccounts, organizations } from "./tenancy";

const orgId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

/**
 * Tarea manual del setter (modo copiloto). El primer mensaje en Instagram,
 * Facebook, TikTok y WhatsApp SIEMPRE lo envía una persona desde acá.
 */
export const outreachTasks = pgTable(
  "outreach_tasks",
  {
    id: id(),
    organizationId: orgId(),
    campaignId: uuid("campaign_id"),
    prospectId: uuid("prospect_id").notNull(),
    channel: channel("channel").notNull(),
    draftMessage: text("draft_message"),
    /** Solo email: asunto del borrador. */
    draftSubject: text("draft_subject"),
    aiRunId: uuid("ai_run_id"),
    status: outreachTaskStatus("status").notNull().default("pending"),
    assignedTo: uuid("assigned_to").references(() => authUsers.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Quién lo envió (cuenta para su tope diario). */
    sentBy: uuid("sent_by").references(() => authUsers.id, { onDelete: "set null" }),
    skippedReason: text("skipped_reason"),
    failureReason: text("failure_reason"),
    ...timestamps(),
  },
  (t) => [
    tenantFk("outreach_tasks_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete(
      "cascade",
    ),
    tenantFk("outreach_tasks_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "set null",
    ),
    index("outreach_tasks_queue_idx").on(t.organizationId, t.assignedTo, t.status),
    index("outreach_tasks_sent_idx").on(t.organizationId, t.sentBy, t.sentAt),
    // Una sola tarea abierta por prospecto y canal: regenerar actualiza, no duplica.
    uniqueIndex("outreach_tasks_open_unique")
      .on(t.organizationId, t.prospectId, t.channel)
      .where(sql`${t.status} in ('pending', 'ready')`),
    ...tenantPolicies("outreach_tasks", t.organizationId, MEMBER_WRITE),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    organizationId: orgId(),
    prospectId: uuid("prospect_id").notNull(),
    campaignId: uuid("campaign_id"),
    channel: channel("channel").notNull(),
    connectedAccountId: uuid("connected_account_id"),
    externalThreadId: text("external_thread_id"),
    aiPaused: boolean("ai_paused").notNull().default(false),
    aiPausedReason: text("ai_paused_reason"),
    assignedTo: uuid("assigned_to").references(() => authUsers.id, { onDelete: "set null" }),
    /** Base para calcular la ventana de respuesta de cada plataforma. */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
    lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
    /** Mensajes del negocio desde el último entrante (TikTok: máx. 10 por ventana). */
    businessMessagesSinceInbound: integer("business_messages_since_inbound").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique("conversations_org_id_unique").on(t.organizationId, t.id),
    tenantFk("conversations_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete(
      "cascade",
    ),
    tenantFk("conversations_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "set null",
    ),
    tenantFk(
      "conversations_account_fk",
      t.organizationId,
      t.connectedAccountId,
      connectedAccounts,
    ).onDelete("set null"),
    unique("conversations_external_thread_unique").on(
      t.organizationId,
      t.channel,
      t.externalThreadId,
    ),
    index("conversations_prospect_idx").on(t.prospectId),
    ...tenantPolicies("conversations", t.organizationId, MEMBER_WRITE),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    organizationId: orgId(),
    conversationId: uuid("conversation_id").notNull(),
    direction: messageDirection("direction").notNull(),
    author: messageAuthor("author").notNull(),
    body: text("body").notNull(),
    sentByUserId: uuid("sent_by_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    aiRunId: uuid("ai_run_id"),
    externalId: text("external_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    ...createdAt(),
  },
  (t) => [
    tenantFk(
      "messages_conversation_fk",
      t.organizationId,
      t.conversationId,
      conversations,
    ).onDelete("cascade"),
    unique("messages_conversation_external_unique").on(t.conversationId, t.externalId),
    index("messages_conversation_sent_idx").on(t.conversationId, t.sentAt),
    ...tenantPolicies("messages", t.organizationId, MEMBER_WRITE),
  ],
);
