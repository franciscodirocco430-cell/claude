"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { idle, type ActionState } from "@/server/actions";
import { signupAction } from "../actions";

export function SignupForm({
  next,
  email,
  invited,
}: {
  next?: string;
  email?: string;
  invited: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(signupAction, idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  if (state.status === "success") {
    return (
      <div className="grid gap-4">
        <Alert variant="success">{state.message}</Alert>
        <p className="text-muted-foreground text-sm">
          Abrí el link del mail para activar tu cuenta. Si no lo ves, revisá spam.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      <Field
        label="Tu nombre"
        name="fullName"
        autoComplete="name"
        defaultValue={values?.fullName}
        error={errors?.fullName}
        required
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={values?.email ?? email}
        readOnly={invited && !!email}
        error={errors?.email}
        required
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
        error={errors?.password}
        required
      />
      {invited ? null : (
        <Field
          label="Nombre de tu organización"
          name="organizationName"
          autoComplete="organization"
          placeholder="Ej.: Agencia Norte"
          defaultValue={values?.organizationName}
          error={errors?.organizationName}
          required
        />
      )}
      <SubmitButton className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
      <p className="text-muted-foreground text-center text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={loginHref}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Iniciá sesión
        </Link>
      </p>
    </form>
  );
}
