import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { READ_ONLY, createdAt, id, tenantFk, tenantPolicies, timestamps } from "./_helpers";
import { campaigns } from "./campaigns";
import { conversations } from "./outreach";
import { prospects } from "./prospects";
import { connectedAccounts, organizations } from "./tenancy";

const orgId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

/**
 * Avisos para el equipo (handoff de la IA, reunión agendada…). Los crea el
 * servidor; los miembros solo pueden marcarlos como leídos.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    organizationId: orgId(),
    /** Destinatario; null = para owners/admins y el asignado de la conversación. */
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    conversationId: uuid("conversation_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...createdAt(),
  },
  (t) => [
    tenantFk(
      "notifications_conversation_fk",
      t.organizationId,
      t.conversationId,
      conversations,
    ).onDelete("cascade"),
    index("notifications_org_unread_idx").on(t.organizationId, t.readAt),
    ...tenantPolicies("notifications", t.organizationId, {
      select: "member",
      insert: false,
      update: "member",
      delete: false,
    }),
  ],
);

/** Reuniones agendadas por el agente en Google Calendar. */
export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    organizationId: orgId(),
    prospectId: uuid("prospect_id").notNull(),
    conversationId: uuid("conversation_id"),
    campaignId: uuid("campaign_id"),
    calendarAccountId: uuid("calendar_account_id"),
    externalEventId: text("external_event_id").notNull(),
    htmlLink: text("html_link"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("scheduled"),
    ...timestamps(),
  },
  (t) => [
    tenantFk("meetings_prospect_fk", t.organizationId, t.prospectId, prospects).onDelete("cascade"),
    tenantFk(
      "meetings_conversation_fk",
      t.organizationId,
      t.conversationId,
      conversations,
    ).onDelete("set null"),
    tenantFk("meetings_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "set null",
    ),
    tenantFk(
      "meetings_calendar_account_fk",
      t.organizationId,
      t.calendarAccountId,
      connectedAccounts,
    ).onDelete("set null"),
    unique("meetings_org_event_unique").on(t.organizationId, t.externalEventId),
    index("meetings_org_starts_idx").on(t.organizationId, t.startsAt),
    ...tenantPolicies("meetings", t.organizationId, READ_ONLY),
  ],
);
