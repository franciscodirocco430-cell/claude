"use server";

import { getServerEnv } from "@/lib/env";
import { formValues, type ActionState } from "@/server/actions";
import {
  changeRoleSchema,
  fieldErrors,
  invitationIdSchema,
  inviteSchema,
  membershipIdSchema,
} from "@/server/auth/schemas";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { createInvitation, revokeInvitation } from "@/server/invitations/service";
import { changeMemberRole, removeMember } from "@/server/organizations/service";

// La organización siempre sale de la sesión, nunca del formulario.
//
// Estas acciones NO llaman a revalidatePath: combinado con useActionState dejaba
// la transición pendiente de forma intermitente (reproducido en e2e, ~25 % de los
// envíos). El componente cliente hace router.refresh() cuando la acción termina bien.

export async function inviteMemberAction(
  _prev: ActionState<{ inviteUrl: string; email: string }>,
  formData: FormData,
): Promise<ActionState<{ inviteUrl: string; email: string }>> {
  const ctx = await requireAppContext();
  const raw = formValues(formData);
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  try {
    const { token, invitation } = await createInvitation(getDb(), {
      actorId: ctx.user.id,
      organizationId: ctx.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
    });
    return {
      status: "success",
      data: {
        inviteUrl: `${getServerEnv().APP_URL}/invitacion/${token}`,
        email: invitation.email,
      },
    };
  } catch (error) {
    return { status: "error", message: userMessage(error), values: raw };
  }
}

export async function revokeInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = invitationIdSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    await revokeInvitation(getDb(), {
      actorId: ctx.user.id,
      organizationId: ctx.organizationId,
      invitationId: parsed.data.invitationId,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Invitación revocada." };
}

export async function changeRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = changeRoleSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    await changeMemberRole(getDb(), {
      actorId: ctx.user.id,
      organizationId: ctx.organizationId,
      ...parsed.data,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Rol actualizado." };
}

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = membershipIdSchema.safeParse(formValues(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    await removeMember(getDb(), {
      actorId: ctx.user.id,
      organizationId: ctx.organizationId,
      membershipId: parsed.data.membershipId,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Miembro quitado." };
}
