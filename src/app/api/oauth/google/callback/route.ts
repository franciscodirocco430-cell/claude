import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isAdminRole } from "@/server/auth/permissions";
import { getAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { googleConfigFromEnv } from "@/server/google/config";
import { consumePendingAuth } from "@/server/google/connect";
import { saveGoogleMailbox } from "@/server/google/mailboxes";
import { exchangeCode, missingScopes } from "@/server/google/oauth";

/** Email de la cuenta: Gmail lo da su perfil; Calendar, el userinfo de OpenID. */
async function accountEmail(purpose: "gmail" | "calendar", accessToken: string) {
  const env = getServerEnv();
  const url =
    purpose === "gmail" ? `${env.GMAIL_API_URL}/users/me/profile` : env.GOOGLE_USERINFO_URL;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { emailAddress?: string; email?: string };
  return (purpose === "gmail" ? data.emailAddress : data.email) ?? null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pending = await consumePendingAuth(params.get("state"));
  const purpose = pending?.purpose ?? "gmail";
  const param = purpose === "calendar" ? "calendario" : "gmail";
  const back = (result: string) =>
    NextResponse.redirect(new URL(`/configuracion?${param}=${result}`, request.nextUrl.origin));
  if (params.get("error")) return back("cancelado");
  const code = params.get("code");
  if (!pending || !code) return back("estado_invalido");

  // La sesión actual tiene que ser la misma persona, en la misma organización, y admin.
  const ctx = await getAppContext();
  if (!ctx || ctx.user.id !== pending.userId || ctx.organizationId !== pending.organizationId) {
    return back("estado_invalido");
  }
  if (!isAdminRole(ctx.role)) return back("sin_permiso");

  const env = getServerEnv();
  const config = googleConfigFromEnv(env);
  if (!config) return back("sin_configurar");

  try {
    const tokens = await exchangeCode(config, code, pending.verifier);
    if (missingScopes(tokens.scopes, purpose).length) return back("faltan_permisos");
    const email = await accountEmail(purpose, tokens.accessToken);
    if (!email) return back("error");
    await saveGoogleMailbox(getDb(), {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      email,
      tokens,
      encryptionKey: env.TOKEN_ENCRYPTION_KEY,
      kind: purpose === "calendar" ? "calendar" : "mailbox",
    });
  } catch (error) {
    console.error("Error conectando Google", error);
    return back("error");
  }
  return back("conectado");
}
