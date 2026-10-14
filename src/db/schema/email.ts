import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { ADMIN_WRITE, MEMBER_WRITE, id, tenantFk, tenantPolicies, timestamps } from "./_helpers";
import { campaigns } from "./campaigns";
import { enrollmentStatus, sequenceStatus } from "./enums";
import { prospects } from "./prospects";
import { connectedAccounts, organizations } from "./tenancy";

const orgId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export const emailSequences = pgTable(
  "email_sequences",
  {
    id: id(),
    organizationId: orgId(),
    campaignId: uuid("campaign_id"),
    name: text("name").notNull(),
    mailboxAccountId: uuid("mailbox_account_id"),
    status: sequenceStatus("status").notNull().default("draft"),
    /** Franja de envío en la hora local del prospecto: [inicio, fin) y días (0 = domingo). */
    sendStartHour: integer("send_start_hour").notNull().default(9),
    sendEndHour: integer("send_end_hour").notNull().default(18),
    sendDays: integer("send_days")
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5}'::integer[]`),
    ...timestamps(),
  },
  (t) => [
    check(
      "email_sequences_send_hours",
      sql`${t.sendStartHour} >= 0 and ${t.sendEndHour} <= 24 and ${t.sendStartHour} < ${t.sendEndHour}`,
    ),
    unique("email_sequences_org_id_unique").on(t.organizationId, t.id),
    tenantFk("email_sequences_campaign_fk", t.organizationId, t.campaignId, campaigns).onDelete(
      "set null",
    ),
    tenantFk(
      "email_sequences_mailbox_fk",
      t.organizationId,
      t.mailboxAccountId,
      connectedAccounts,
    ).onDelete("set null"),
    ...tenantPolicies("email_sequences", t.organizationId, ADMIN_WRITE),
  ],
);

export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: id(),
    organizationId: orgId(),
    sequenceId: uuid("sequence_id").notNull(),
    position: integer("position").notNull(),
    /** Demora desde el paso anterior (o desde la inscripción si es el primero). */
    delayHours: integer("delay_hours").notNull().default(0),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    ...timestamps(),
  },
  (t) => [
    tenantFk("sequence_steps_sequence_fk", t.organizationId, t.sequenceId, emailSequences).onDelete(
      "cascade",
    ),
    unique("sequence_steps_sequence_position_unique").on(t.sequenceId, t.position),
    ...tenantPolicies("sequence_steps", t.organizationId, ADMIN_WRITE),
  ],
);

export const sequenceEnrollments = pgTable(
  "sequence_enrollments",
  {
    id: id(),
    organizationId: orgId(),
    sequenceId: uuid("sequence_id").notNull(),
    prospectId: uuid("prospect_id").notNull(),
    status: enrollmentStatus("status").notNull().default("active"),
    currentStep: integer("current_step").notNull().default(0),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    gmailThreadId: text("gmail_thread_id"),
    /** Message-ID del primer email: los siguientes van como respuesta en el mismo hilo. */
    firstMessageRfcId: text("first_message_rfc_id"),
    firstSubject: text("first_subject"),
    stopReason: text("stop_reason"),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    tenantFk(
      "sequence_enrollments_sequence_fk",
      t.organizationId,
      t.sequenceId,
      emailSequences,
    ).onDelete("cascade"),
    tenantFk(
      "sequence_enrollments_prospect_fk",
      t.organizationId,
      t.prospectId,
      prospects,
    ).onDelete("cascade"),
    unique("sequence_enrollments_sequence_prospect_unique").on(t.sequenceId, t.prospectId),
    index("sequence_enrollments_due_idx").on(t.status, t.nextSendAt),
    ...tenantPolicies("sequence_enrollments", t.organizationId, MEMBER_WRITE),
  ],
);
