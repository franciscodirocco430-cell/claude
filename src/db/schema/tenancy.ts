import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";
import { ADMIN_WRITE, id, tenantFk, tenantPolicies, timestamps } from "./_helpers";
import { channel, connectedAccountStatus, memberRole, oauthProvider } from "./enums";

export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** Zona horaria por defecto para horario hábil cuando el prospecto no tiene una. */
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    ...timestamps(),
  },
  (t) => [
    // Alta y baja de organizaciones solo desde el servidor (service role).
    pgPolicy("organizations_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_org_member(${t.id})`,
    }),
    pgPolicy("organizations_update", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_org_admin(${t.id})`,
      withCheck: sql`public.is_org_admin(${t.id})`,
    }),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("setter"),
    ...timestamps(),
  },
  (t) => [
    unique("memberships_org_user_unique").on(t.organizationId, t.userId),
    index("memberships_user_idx").on(t.userId),
    // Los miembros ven a sus compañeros. Altas, bajas y cambios de rol se hacen
    // desde el servidor (Fase 1: invitaciones) para evitar escaladas de privilegios.
    pgPolicy("memberships_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_org_member(${t.organizationId})`,
    }),
  ],
);

/**
 * Cuentas conectadas por OAuth oficial (Google, Meta, TikTok for Business).
 * Los tokens NO viven acá: están cifrados en `connected_account_secrets`,
 * que no es legible desde el cliente.
 */
export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: oauthProvider("provider").notNull(),
    channel: channel("channel"),
    externalId: text("external_id").notNull(),
    displayName: text("display_name"),
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: connectedAccountStatus("status").notNull().default("active"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    /** Tope diario de envíos (casillas de email). Por defecto conservador. */
    dailySendLimit: integer("daily_send_limit").notNull().default(30),
    settings: jsonb("settings").notNull().default({}),
    connectedBy: uuid("connected_by").references(() => authUsers.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [
    unique("connected_accounts_org_id_unique").on(t.organizationId, t.id),
    unique("connected_accounts_provider_external_unique").on(
      t.organizationId,
      t.provider,
      t.externalId,
    ),
    ...tenantPolicies("connected_accounts", t.organizationId, ADMIN_WRITE),
  ],
);

/** Tokens OAuth cifrados con AES-256-GCM. RLS activo sin políticas: solo servidor. */
export const connectedAccountSecrets = pgTable(
  "connected_account_secrets",
  {
    connectedAccountId: uuid("connected_account_id").primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    ...timestamps(),
  },
  (t) => [
    tenantFk(
      "connected_account_secrets_account_fk",
      t.organizationId,
      t.connectedAccountId,
      connectedAccounts,
    ).onDelete("cascade"),
  ],
).enableRLS();
