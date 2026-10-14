"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { idle, type ActionState } from "@/server/actions";
import { confirmUnsubscribeAction } from "./actions";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(confirmUnsubscribeAction, idle);
  if (state.status === "success") {
    return <Alert variant="success">Listo: no vas a recibir más emails nuestros.</Alert>;
  }
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" ? <Alert variant="destructive">{state.message}</Alert> : null}
      <SubmitButton className="w-full" pendingText="Procesando…">
        Darme de baja
      </SubmitButton>
    </form>
  );
}
