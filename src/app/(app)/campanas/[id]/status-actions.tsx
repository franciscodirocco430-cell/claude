"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import type { CampaignStatus, StatusAction } from "@/server/campaigns/service";
import { changeCampaignStatusAction } from "../actions";

const ACTIONS: Record<
  CampaignStatus,
  { action: StatusAction; label: string; variant: "default" | "outline" | "ghost" }[]
> = {
  draft: [
    { action: "activate", label: "Activar", variant: "default" },
    { action: "archive", label: "Archivar", variant: "ghost" },
  ],
  active: [
    { action: "pause", label: "Pausar", variant: "outline" },
    { action: "archive", label: "Archivar", variant: "ghost" },
  ],
  paused: [
    { action: "activate", label: "Reanudar", variant: "default" },
    { action: "archive", label: "Archivar", variant: "ghost" },
  ],
  archived: [{ action: "restore", label: "Restaurar", variant: "outline" }],
};

function StatusButton(props: {
  campaignId: string;
  action: StatusAction;
  label: string;
  variant: "default" | "outline" | "ghost";
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    changeCampaignStatusAction,
    idle,
  );
  useRefreshOnSuccess(state);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          props.action === "archive" &&
          !confirm("¿Archivar la campaña? Se deja de trabajar pero no se borra nada.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="campaignId" value={props.campaignId} />
      <input type="hidden" name="action" value={props.action} />
      <SubmitButton size="sm" variant={props.variant}>
        {props.label}
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-destructive mt-1 text-xs">{state.message}</p>
      ) : null}
    </form>
  );
}

export function StatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS[status].map((a) => (
        <StatusButton key={a.action} campaignId={campaignId} {...a} />
      ))}
    </div>
  );
}
