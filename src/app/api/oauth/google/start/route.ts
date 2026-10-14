import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { isAdminRole } from "@/server/auth/permissions";
import { getAppContext } from "@/server/auth/session";
import { googleConfigFromEnv } from "@/server/google/config";
import { savePendingAuth } from "@/server/google/connect";
import { buildAuthorizeUrl, createPkcePair } from "@/server/google/oauth";

/** `?para=calendario` conecta Google Calendar; sin parámetro, Gmail. */
export async function GET(request: NextRequest) {
  const purpose = request.nextUrl.searchParams.get("para") === "calendario" ? "calendar" : "gmail";
  const param = purpose === "calendar" ? "calendario" : "gmail";
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/configuracion?${param}=${error}`, request.nextUrl.origin));
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  if (!isAdminRole(ctx.role)) return back("sin_permiso");
  const config = googleConfigFromEnv(getServerEnv());
  if (!config) return back("sin_configurar");

  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkcePair();
  await savePendingAuth({
    state,
    verifier,
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
    purpose,
  });
  return NextResponse.redirect(buildAuthorizeUrl(config, state, challenge, purpose));
}
