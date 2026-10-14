import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const GOOGLE_OAUTH_COOKIE = "sc_google_oauth";

export interface PendingGoogleAuth {
  state: string;
  verifier: string;
  organizationId: string;
  userId: string;
}

export async function savePendingAuth(pending: PendingGoogleAuth) {
  (await cookies()).set(GOOGLE_OAUTH_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/oauth/google",
    maxAge: 600,
  });
}

/** Lee y BORRA el estado pendiente (un solo uso). */
export async function consumePendingAuth(state: string | null): Promise<PendingGoogleAuth | null> {
  const store = await cookies();
  const raw = store.get(GOOGLE_OAUTH_COOKIE)?.value;
  store.delete({ name: GOOGLE_OAUTH_COOKIE, path: "/api/oauth/google" });
  if (!raw || !state) return null;
  try {
    const pending = JSON.parse(raw) as PendingGoogleAuth;
    const a = Buffer.from(pending.state);
    const b = Buffer.from(state);
    return a.length === b.length && timingSafeEqual(a, b) ? pending : null;
  } catch {
    return null;
  }
}
