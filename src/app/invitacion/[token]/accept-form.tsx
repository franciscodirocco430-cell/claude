"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { idle, type ActionState } from "@/server/actions";
import { acceptInvitationAction } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState<ActionState, FormData>(acceptInvitationAction, idle);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state.status === "error" ? <Alert variant="destructive">{state.message}</Alert> : null}
      <SubmitButton className="w-full" pendingText="Uniéndote…">
        Aceptar invitación
      </SubmitButton>
    </form>
  );
}
