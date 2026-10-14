"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/server/actions";
import { requireUser, setActiveOrganization } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { acceptInvitation } from "@/server/invitations/service";

export async function acceptInvitationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const user = await requireUser(`/invitacion/${token}`);
  let organizationId: string;
  try {
    ({ organizationId } = await acceptInvitation(getDb(), {
      token,
      userId: user.id,
      userEmail: user.email,
    }));
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  await setActiveOrganization(organizationId);
  redirect("/campanas");
}
