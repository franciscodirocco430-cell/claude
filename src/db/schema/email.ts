import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
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
    ...timestamps(),
  },
  (t) => [
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
