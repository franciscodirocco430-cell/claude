"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formValues, type ActionState } from "@/server/actions";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/server/auth/redirects";
import { fieldErrors, loginSchema, signupInvitedSchema, signupSchema } from "@/server/auth/schemas";
import { ACTIVE_ORG_COOKIE, setActiveOrganization } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { createOrganization } from "@/server/organizations/service";

const AUTH_UNAVAILABLE =
  "No pudimos conectar con el servicio de autenticación. Probá en unos minutos.";

/** Error de red o del servidor de Auth (no de credenciales). */
function isAuthUnavailable(error: { status?: number; name?: string }) {
  return error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500;
}

/** Nunca devolvemos la contraseña al formulario. */
function safeValues(raw: Record<string, string>) {
  const { password: _password, ...rest } = raw;
  return rest;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: safeValues(raw) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = isAuthUnavailable(error)
      ? AUTH_UNAVAILABLE
      : error.code === "email_not_confirmed"
        ? "Confirmá tu email antes de entrar. Revisá tu bandeja de entrada."
        : "Email o contraseña incorrectos.";
    return { status: "error", message, values: safeValues(raw) };
  }
  redirect(safeNextPath(raw.next));
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData);
  const next = safeNextPath(raw.next, "");
  const invited = next.startsWith("/invitacion/");
  const parsed = invited ? signupInvitedSchema.safeParse(raw) : signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: safeValues(raw) };
  }
  const data = parsed.data;
  const organizationName: string | undefined =
    "organizationName" in data ? String(data.organizationName) : undefined;

  const supabase = await createSupabaseServerClient();
  const callbackNext = invited ? next : "/bienvenida";
  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { full_name: data.fullName, organization_name: organizationName },
      emailRedirectTo: `${getServerEnv().APP_URL}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
    },
  });

  if (error) {
    const message = isAuthUnavailable(error)
      ? AUTH_UNAVAILABLE
      : error.code === "user_already_exists"
        ? "Ya existe una cuenta con ese email. Iniciá sesión."
        : error.code === "weak_password"
          ? "La contraseña es muy débil. Probá con una más larga."
          : "No pudimos crear la cuenta. Probá de nuevo en unos minutos.";
    return { status: "error", message, values: safeValues(raw) };
  }

  // Sin sesión = Supabase pide confirmar el email antes de entrar.
  if (!result.session || !result.user) {
    return {
      status: "success",
      message: `Te mandamos un mail a ${data.email} para confirmar tu cuenta.`,
    };
  }

  if (!invited && organizationName) {
    try {
      const org = await createOrganization(getDb(), {
        userId: result.user.id,
        name: organizationName,
      });
      await setActiveOrganization(org.id);
    } catch (error) {
      // La cuenta ya existe: que reintente crear la organización desde el onboarding.
      console.error(error);
      redirect("/bienvenida");
    }
  }
  redirect(invited ? next : DEFAULT_AFTER_LOGIN);
}

export async function signoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/login");
}
