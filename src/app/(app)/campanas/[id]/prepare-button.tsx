"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { ActionState } from "@/server/actions";
import { prepareCampaignAction } from "../actions";

export function PrepareButton({ campaignId, pending }: { campaignId: string; pending: number }) {
  const [state, action] = useActionState<ActionState<{ queued: number }>, FormData>(
    prepareCampaignAction,
    { status: "idle" },
  );
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <SubmitButton size="sm" variant="secondary" disabled={pending === 0} pendingText="Encolando…">
        <Sparkles aria-hidden /> Preparar mensajes ({pending})
      </SubmitButton>
      {state.status !== "idle" && state.message ? (
        <p
          className={
            state.status === "error" ? "text-destructive text-xs" : "text-muted-foreground text-xs"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
