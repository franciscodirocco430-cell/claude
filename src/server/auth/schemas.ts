import { z } from "zod";
import { memberRole } from "@/db/schema/enums";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresá un email válido." }));

const password = z
  .string()
  .min(8, { error: "La contraseña tiene que tener al menos 8 caracteres." })
  .max(72, { error: "La contraseña puede tener hasta 72 caracteres." });

const orgName = z
  .string()
  .trim()
  .min(2, { error: "El nombre de la organización es muy corto." })
  .max(80, { error: "El nombre de la organización es muy largo." });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Ingresá tu contraseña." }),
});

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Ingresá tu nombre." })
    .max(80, { error: "El nombre es muy largo." }),
  email,
  password,
  organizationName: orgName,
});

/** Registro desde un link de invitación: la organización ya existe. */
export const signupInvitedSchema = signupSchema.omit({ organizationName: true });

export const createOrganizationSchema = z.object({ organizationName: orgName });

export const inviteSchema = z.object({
  email,
  role: z.enum(memberRole.enumValues, { error: "Elegí un rol." }),
});

export const changeRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(memberRole.enumValues),
});

export const membershipIdSchema = z.object({ membershipId: z.uuid() });
export const invitationIdSchema = z.object({ invitationId: z.uuid() });

/** Errores por campo, listos para mostrar en un formulario. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
