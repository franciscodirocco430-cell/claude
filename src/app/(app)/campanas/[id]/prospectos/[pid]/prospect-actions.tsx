"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { regenerateDraftAction, reresearchProspectAction } from "../../../actions";

export function ReresearchButton({
  campaignId,
  prospectId,
  disabled,
}: {
  campaignId: string;
  prospectId: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(reresearchProspectAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="prospectId" value={prospectId} />
      <SubmitButton size="sm" variant="outline" disabled={disabled} pendingText="Encolando…">
        <RefreshCw aria-hidden /> Volver a investigar
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-destructive text-xs">{state.message}</p>
      ) : null}
    </form>
  );
}

export function RegenerateButton(props: {
  campaignId: string;
  prospectId: string;
  channel: string;
  label: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(regenerateDraftAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="campaignId" value={props.campaignId} />
      <input type="hidden" name="prospectId" value={props.prospectId} />
      <input type="hidden" name="channel" value={props.channel} />
      <SubmitButton
        size="sm"
        variant="ghost"
        disabled={props.disabled}
        pendingText="Encolando…"
        aria-label={`Regenerar mensaje de ${props.label}`}
      >
        <RefreshCw aria-hidden /> Regenerar
      </SubmitButton>
      {state.status === "error" ? (
        <p className="text-destructive text-xs">{state.message}</p>
      ) : null}
    </form>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={`Copiar mensaje de ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}
