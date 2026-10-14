import type { ServerEnv } from "@/lib/env";
import type { GoogleOAuthConfig } from "./oauth";

type GoogleEnv = Pick<
  ServerEnv,
  | "APP_URL"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "GOOGLE_OAUTH_AUTHORIZE_URL"
  | "GOOGLE_OAUTH_TOKEN_URL"
  | "GOOGLE_OAUTH_REVOKE_URL"
>;

export function googleConfigFromEnv(env: GoogleEnv): GoogleOAuthConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.APP_URL}/api/oauth/google/callback`,
    authorizeUrl: env.GOOGLE_OAUTH_AUTHORIZE_URL,
    tokenUrl: env.GOOGLE_OAUTH_TOKEN_URL,
    revokeUrl: env.GOOGLE_OAUTH_REVOKE_URL,
  };
}
