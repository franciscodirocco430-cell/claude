import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import type { DbExecutor } from "@/db/rls";
import { connectedAccounts, connectedAccountSecrets } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";
import { DomainError } from "@/server/errors";
import {
  GoogleOAuthError,
  refreshAccessToken,
  revokeToken,
  type GoogleOAuthConfig,
  type GoogleTokens,
} from "./oauth";

export const DEFAULT_MAILBOX_DAILY_LIMIT = 30;
export const MAX_MAILBOX_DAILY_LIMIT = 500;

/**
 * Guarda (o actualiza) la casilla conectada. Los tokens van cifrados con
 * AES-256-GCM y atados al id de la cuenta (AAD): no se pueden mover de fila.
 */
export async function saveGoogleMailbox(
  db: Database,
  input: {
    organizationId: string;
    userId: string;
    email: string;
    tokens: GoogleTokens;
    encryptionKey: string;
    /** Calendar se guarda como cuenta aparte (sin canal) aunque sea el mismo email. */
    kind?: "mailbox" | "calendar";
  },
) {
  const calendar = input.kind === "calendar";
  const email = input.email.toLowerCase();
  return db.transaction(async (tx) => {
    const [account] = await tx
      .insert(connectedAccounts)
      .values({
        organizationId: input.organizationId,
        provider: "google",
        channel: calendar ? null : "email",
        externalId: calendar ? `calendar:${email}` : email,
        displayName: email,
        settings: calendar ? { kind: "calendar" } : {},
        scopes: input.tokens.scopes,
        status: "active",
        tokenExpiresAt: input.tokens.expiresAt,
        dailySendLimit: DEFAULT_MAILBOX_DAILY_LIMIT,
        connectedBy: input.userId,
      })
      .onConflictDoUpdate({
        target: [
          connectedAccounts.organizationId,
          connectedAccounts.provider,
          connectedAccounts.externalId,
        ],
        set: {
          scopes: input.tokens.scopes,
          status: "active",
          tokenExpiresAt: input.tokens.expiresAt,
          connectedBy: input.userId,
          lastError: null,
        },
      })
      .returning({ id: connectedAccounts.id });
    const id = account!.id;

    const [existing] = await tx
      .select({ refresh: connectedAccountSecrets.refreshTokenEnc })
      .from(connectedAccountSecrets)
      .where(eq(connectedAccountSecrets.connectedAccountId, id));
    // Google a veces no repite el refresh token al reconectar: se conserva el anterior.
    const refreshEnc = input.tokens.refreshToken
      ? encryptSecret(input.tokens.refreshToken, input.encryptionKey, `${id}:refresh`)
      : (existing?.refresh ?? null);
    if (!refreshEnc) {
      throw new DomainError(
        "no_refresh_token",
        "Google no devolvió permiso offline. Volvé a conectar la cuenta.",
      );
    }
    const values = {
      connectedAccountId: id,
      organizationId: input.organizationId,
      accessTokenEnc: encryptSecret(input.tokens.accessToken, input.encryptionKey, `${id}:access`),
      refreshTokenEnc: refreshEnc,
    };
    await tx
      .insert(connectedAccountSecrets)
      .values(values)
      .onConflictDoUpdate({ target: connectedAccountSecrets.connectedAccountId, set: values });
    return id;
  });
}

export class MailboxUnavailableError extends Error {}

/** Token de acceso vigente; lo refresca si está por vencer. Si Google lo revocó, marca la casilla. */
export async function getMailboxAccessToken(
  db: Database,
  input: {
    accountId: string;
    config: GoogleOAuthConfig;
    encryptionKey: string;
    fetchImpl?: typeof fetch;
  },
): Promise<string> {
  const [row] = await db
    .select({ account: connectedAccounts, secret: connectedAccountSecrets })
    .from(connectedAccounts)
    .innerJoin(
      connectedAccountSecrets,
      eq(connectedAccountSecrets.connectedAccountId, connectedAccounts.id),
    )
    .where(eq(connectedAccounts.id, input.accountId));
  if (!row || row.account.status !== "active")
    throw new MailboxUnavailableError("La casilla no está conectada.");
  const id = row.account.id;

  const expiresAt = row.account.tokenExpiresAt?.getTime() ?? 0;
  if (expiresAt - Date.now() > 60_000) {
    return decryptSecret(row.secret.accessTokenEnc, input.encryptionKey, `${id}:access`);
  }

  const refresh = row.secret.refreshTokenEnc
    ? decryptSecret(row.secret.refreshTokenEnc, input.encryptionKey, `${id}:refresh`)
    : null;
  if (!refresh) throw new MailboxUnavailableError("Falta el permiso offline de la casilla.");
  try {
    const tokens = await refreshAccessToken(input.config, refresh, input.fetchImpl);
    await db.transaction(async (tx) => {
      await tx
        .update(connectedAccountSecrets)
        .set({
          accessTokenEnc: encryptSecret(tokens.accessToken, input.encryptionKey, `${id}:access`),
        })
        .where(eq(connectedAccountSecrets.connectedAccountId, id));
      await tx
        .update(connectedAccounts)
        .set({ tokenExpiresAt: tokens.expiresAt, lastError: null })
        .where(eq(connectedAccounts.id, id));
    });
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof GoogleOAuthError && error.code === "invalid_grant") {
      await db
        .update(connectedAccounts)
        .set({
          status: "revoked",
          lastError: "Google revocó el acceso. Volvé a conectar la casilla.",
        })
        .where(eq(connectedAccounts.id, id));
      throw new MailboxUnavailableError("Google revocó el acceso a la casilla.");
    }
    throw error;
  }
}

/** Desconecta: revoca en Google, borra los tokens y deja la cuenta como revocada. */
export async function disconnectMailbox(
  db: Database,
  input: {
    organizationId: string;
    accountId: string;
    config: GoogleOAuthConfig | null;
    encryptionKey: string;
  },
) {
  const [row] = await db
    .select({ secret: connectedAccountSecrets })
    .from(connectedAccounts)
    .leftJoin(
      connectedAccountSecrets,
      eq(connectedAccountSecrets.connectedAccountId, connectedAccounts.id),
    )
    .where(
      and(
        eq(connectedAccounts.id, input.accountId),
        eq(connectedAccounts.organizationId, input.organizationId),
      ),
    );
  if (!row) throw new DomainError("not_found", "La casilla no existe.");
  if (row.secret?.refreshTokenEnc && input.config) {
    try {
      const token = decryptSecret(
        row.secret.refreshTokenEnc,
        input.encryptionKey,
        `${input.accountId}:refresh`,
      );
      await revokeToken(input.config, token);
    } catch {
      // Si no se puede revocar en Google, igual se borran los tokens locales.
    }
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(connectedAccountSecrets)
      .where(eq(connectedAccountSecrets.connectedAccountId, input.accountId));
    await tx
      .update(connectedAccounts)
      .set({ status: "revoked", tokenExpiresAt: null })
      .where(eq(connectedAccounts.id, input.accountId));
  });
}

/** Alias: el refresco de tokens es el mismo para cualquier cuenta de Google. */
export const getGoogleAccessToken = getMailboxAccessToken;

/** Calendarios de Google conectados (para agendar reuniones). */
export async function listCalendars(db: DbExecutor, organizationId: string) {
  return db
    .select({
      id: connectedAccounts.id,
      email: connectedAccounts.displayName,
      status: connectedAccounts.status,
      lastError: connectedAccounts.lastError,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.organizationId, organizationId),
        eq(connectedAccounts.provider, "google"),
        sql`${connectedAccounts.settings}->>'kind' = 'calendar'`,
      ),
    )
    .orderBy(connectedAccounts.displayName);
}

/** Casillas de email de la organización (sin tokens: esos nunca salen del servidor). */
export async function listMailboxes(db: DbExecutor, organizationId: string) {
  return db
    .select({
      id: connectedAccounts.id,
      email: connectedAccounts.externalId,
      status: connectedAccounts.status,
      dailySendLimit: connectedAccounts.dailySendLimit,
      signature: connectedAccounts.signature,
      lastError: connectedAccounts.lastError,
    })
    .from(connectedAccounts)
    .where(
      and(
        eq(connectedAccounts.organizationId, organizationId),
        eq(connectedAccounts.provider, "google"),
        eq(connectedAccounts.channel, "email"),
      ),
    )
    .orderBy(connectedAccounts.externalId);
}

export async function updateMailboxSettings(
  db: DbExecutor,
  input: {
    organizationId: string;
    accountId: string;
    dailySendLimit: number;
    signature: string | null;
  },
) {
  const [row] = await db
    .update(connectedAccounts)
    .set({ dailySendLimit: input.dailySendLimit, signature: input.signature })
    .where(
      and(
        eq(connectedAccounts.id, input.accountId),
        eq(connectedAccounts.organizationId, input.organizationId),
      ),
    )
    .returning({ id: connectedAccounts.id });
  if (!row) throw new DomainError("not_found", "La casilla no existe.");
}
