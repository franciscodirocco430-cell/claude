"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { idle, type ActionState } from "@/server/actions";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;
  const registerHref = next ? `/registro?next=${encodeURIComponent(next)}` : "/registro";

  return (
    <form action={action} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={values?.email}
        error={errors?.email}
        required
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        error={errors?.password}
        required
      />
      <SubmitButton className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
      <p className="text-muted-foreground text-center text-sm">
        ¿No tenés cuenta?{" "}
        <Link
          href={registerHref}
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Creá una
        </Link>
      </p>
    </form>
  );
}
