import { pgEnum } from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["owner", "admin", "setter"]);

/** Canales por los que se contacta a un prospecto. */
export const channel = pgEnum("channel", ["instagram", "facebook", "tiktok", "whatsapp", "email"]);

/** Proveedores OAuth oficiales. No existe otra forma de conectar cuentas. */
export const oauthProvider = pgEnum("oauth_provider", ["google", "meta", "tiktok"]);

export const connectedAccountStatus = pgEnum("connected_account_status", [
  "active",
  "expired",
  "revoked",
  "error",
]);

export const campaignStatus = pgEnum("campaign_status", ["draft", "active", "paused", "archived"]);

export const prospectSource = pgEnum("prospect_source", [
  "manual",
  "csv",
  "url",
  "public_business_data",
  "inbound",
]);

export const outreachTaskStatus = pgEnum("outreach_task_status", [
  "pending",
  "ready",
  "sent_manual",
  "skipped",
  "failed",
]);

export const messageDirection = pgEnum("message_direction", ["in", "out"]);

export const messageAuthor = pgEnum("message_author", ["human", "ai", "prospect"]);

export const stageKind = pgEnum("stage_kind", ["open", "won", "lost"]);

export const sequenceStatus = pgEnum("sequence_status", ["draft", "active", "paused", "archived"]);

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "stopped_replied",
  "stopped_bounced",
  "stopped_unsubscribed",
  "stopped_manual",
]);

export const suppressionKind = pgEnum("suppression_kind", ["email", "phone", "handle"]);

export const suppressionReason = pgEnum("suppression_reason", [
  "unsubscribed",
  "bounced",
  "complaint",
  "requested",
  "manual",
]);

export const aiRunType = pgEnum("ai_run_type", [
  "research",
  "draft",
  "classify",
  "score",
  "reply",
  "handoff_check",
]);

export const aiRunStatus = pgEnum("ai_run_status", ["ok", "error"]);

export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "dead"]);
