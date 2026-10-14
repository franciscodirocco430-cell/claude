import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isAdminRole } from "@/server/auth/permissions";
import { getAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { googleConfigFromEnv } from "@/server/google/config";
import { consumePendingAuth } from "@/server/google/connect";
import { saveGoogleMailbox } from "@/server/google/mailboxes";
import { exchangeCode, missingScopes } from "@/server/google/oauth";

export async function GET(request: NextRequest) {
  const back = (result: string) =>
    NextResponse.redirect(new URL(`/configuracion?gmail=${result}`, request.nextUrl.origin));
  const params = request.nextUrl.searchParams;
  const pending = await consumePendingAuth(params.get("state"));
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
    if (missingScopes(tokens.scopes).length) return back("faltan_permisos");
    const profile = await fetch(`${env.GMAIL_API_URL}/users/me/profile`, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const { emailAddress } = (await profile.json()) as { emailAddress?: string };
    if (!profile.ok || !emailAddress) return back("error");
    await saveGoogleMailbox(getDb(), {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      email: emailAddress,
      tokens,
      encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    });
  } catch (error) {
    console.error("Error conectando Gmail", error);
    return back("error");
  }
  return back("conectado");
}
