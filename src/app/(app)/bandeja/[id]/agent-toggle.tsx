"use client";

import { Pause, Play } from "lucide-react";
import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { toggleAgentAction } from "./actions";

export function AgentToggle({
  conversationId,
  paused,
}: {
  conversationId: string;
  paused: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(toggleAgentAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="op" value={paused ? "resume" : "pause"} />
      <SubmitButton size="sm" variant="outline" pendingText={paused ? "Reanudando…" : "Pausando…"}>
        {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
        {paused ? "Reanudar IA" : "Pausar IA"}
      </SubmitButton>
      {state.status === "error" ? (
        <span role="status" className="text-destructive text-xs">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
