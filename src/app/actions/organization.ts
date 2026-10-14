"use server";

import { redirect } from "next/navigation";
import { formValues, type ActionState } from "@/server/actions";
import { createOrganizationSchema, fieldErrors } from "@/server/auth/schemas";
import { getAppContext, requireUser, setActiveOrganization } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import { createOrganization } from "@/server/organizations/service";

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const raw = formValues(formData);
  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed.error), values: raw };
  }
  let orgId: string;
  try {
    const org = await createOrganization(getDb(), {
      userId: user.id,
      name: parsed.data.organizationName,
    });
    orgId = org.id;
  } catch (error) {
    console.error(error);
    return { status: "error", message: userMessage(error), values: raw };
  }
  await setActiveOrganization(orgId);
  redirect("/campanas");
}

/** Cambia la organización activa. Solo acepta organizaciones de las que el usuario es miembro. */
export async function switchOrganizationAction(formData: FormData) {
  const ctx = await getAppContext();
  const target = formData.get("organizationId");
  if (
    ctx &&
    typeof target === "string" &&
    ctx.organizations.some((o) => o.organizationId === target)
  ) {
    await setActiveOrganization(target);
  }
  redirect("/campanas");
}
