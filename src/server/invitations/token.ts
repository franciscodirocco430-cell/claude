import { createHash, randomBytes } from "node:crypto";

export const INVITATION_TTL_DAYS = 7;

/** Token aleatorio de 256 bits para el link. Solo se persiste su hash. */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
