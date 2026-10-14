"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "@/app/actions/organization";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { idle, type ActionState } from "@/server/actions";

export function CreateOrgForm({ defaultName }: { defaultName?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createOrganizationAction, idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      <Field
        label="Nombre de la organización"
        name="organizationName"
        autoComplete="organization"
        placeholder="Ej.: Agencia Norte"
        defaultValue={values?.organizationName ?? defaultName}
        error={errors?.organizationName}
        required
      />
      <SubmitButton className="w-full" pendingText="Creando…">
        Crear organización
      </SubmitButton>
    </form>
  );
}
