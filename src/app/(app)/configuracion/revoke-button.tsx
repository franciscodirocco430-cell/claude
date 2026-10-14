"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { revokeInvitationAction } from "./team-actions";

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(revokeInvitationAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.status === "error" ? (
        <span className="text-destructive text-xs">{state.message}</span>
      ) : null}
      <SubmitButton size="sm" variant="ghost" pendingText="Revocando…">
        Revocar
      </SubmitButton>
    </form>
  );
}
