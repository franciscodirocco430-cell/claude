import "server-only";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb } from "@/server/db";
import { listUserOrganizations, type UserOrganization } from "@/server/organizations/service";
import type { Role } from "./permissions";
import { LOGIN_PATH } from "./redirects";

export const ACTIVE_ORG_COOKIE = "sc_org";

/** Usuario verificado contra Supabase Auth (no confía en la cookie sin validar). */
export const getAuthUser = cache(async (): Promise<User | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
});

export async function requireUser(next?: string): Promise<User> {
  const user = await getAuthUser();
  if (!user) redirect(next ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH);
  return user;
}

export interface AppContext {
  user: User;
  organizations: UserOrganization[];
  organizationId: string;
  organizationName: string;
  role: Role;
}

/**
 * Contexto de la app: usuario + organización activa (cookie, o la primera).
 * La cookie solo elige entre organizaciones de las que el usuario ES miembro:
 * manipularla no da acceso a nada.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const organizations = await listUserOrganizations(getDb(), user.id);
  if (organizations.length === 0) return null;
  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = organizations.find((o) => o.organizationId === preferred) ?? organizations[0]!;
  return {
    user,
    organizations,
    organizationId: active.organizationId,
    organizationName: active.name,
    role: active.role,
  };
});

export async function requireAppContext(): Promise<AppContext> {
  await requireUser();
  const ctx = await getAppContext();
  if (!ctx) redirect("/bienvenida");
  return ctx;
}

export async function setActiveOrganization(organizationId: string) {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
