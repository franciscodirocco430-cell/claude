import { createHash, randomBytes } from "node:crypto";

/**
 * Scopes mínimos: enviar (gmail.send) y leer hilos para detectar respuestas y
 * rebotes (gmail.readonly). No se pide acceso a contactos, calendario ni a borrar.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

/**
 * Calendar: solo `calendar.events` (ver y crear eventos; la disponibilidad se
 * calcula listando eventos) + `openid email` para saber qué cuenta se conectó.
 */
export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export type GooglePurpose = "gmail" | "calendar";

/** Scopes que tienen que volver concedidos (openid/email vuelven con otro nombre). */
const REQUIRED_SCOPES: Record<GooglePurpose, readonly string[]> = {
  gmail: GMAIL_SCOPES,
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
};

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scopes: string[];
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  config: GoogleOAuthConfig,
  state: string,
  codeChallenge: string,
  purpose: GooglePurpose = "gmail",
): string {
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: (purpose === "calendar" ? CALENDAR_SCOPES : GMAIL_SCOPES).join(" "),
    access_type: "offline", // refresh token para que el worker envíe sin el usuario
    prompt: "consent",
    include_granted_scopes: "false",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export class GoogleOAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

async function tokenRequest(
  config: GoogleOAuthConfig,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<GoogleTokens> {
  const res = await fetchImpl(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    throw new GoogleOAuthError(
      String(data.error ?? res.status),
      String(data.error_description ?? "Error de OAuth"),
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
    expiresAt: new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000),
    scopes: typeof data.scope === "string" ? data.scope.split(" ") : [],
  };
}

export function exchangeCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl = fetch,
) {
  return tokenRequest(
    config,
    {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.redirectUri,
    },
    fetchImpl,
  );
}

export function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl = fetch,
) {
  return tokenRequest(
    config,
    { grant_type: "refresh_token", refresh_token: refreshToken },
    fetchImpl,
  );
}

export async function revokeToken(config: GoogleOAuthConfig, token: string, fetchImpl = fetch) {
  await fetchImpl(config.revokeUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

/** Faltan scopes necesarios: el usuario destildó permisos en la pantalla de Google. */
export function missingScopes(granted: string[], purpose: GooglePurpose = "gmail"): string[] {
  return REQUIRED_SCOPES[purpose].filter((s) => !granted.includes(s));
}
