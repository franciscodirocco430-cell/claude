"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { disconnectMailboxAction, updateMailboxAction } from "./mailbox-actions";

const STATUS: Record<string, { label: string; variant: "secondary" | "destructive" | "outline" }> =
  {
    active: { label: "Conectada", variant: "secondary" },
    expired: { label: "Vencida", variant: "destructive" },
    revoked: { label: "Desconectada", variant: "outline" },
    error: { label: "Con error", variant: "destructive" },
  };

export interface MailboxView {
  id: string;
  email: string;
  status: string;
  dailySendLimit: number;
  signature: string | null;
  lastError: string | null;
}

export function MailboxRow({ mailbox, canManage }: { mailbox: MailboxView; canManage: boolean }) {
  const [saveState, save] = useActionState<ActionState, FormData>(updateMailboxAction, idle);
  const [discState, disconnect] = useActionState<ActionState, FormData>(
    disconnectMailboxAction,
    idle,
  );
  useRefreshOnSuccess(saveState);
  useRefreshOnSuccess(discState);
  const status = STATUS[mailbox.status] ?? STATUS.error!;
  const active = mailbox.status === "active";

  return (
    <li className="grid gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{mailbox.email}</p>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      {mailbox.lastError ? <p className="text-destructive text-sm">{mailbox.lastError}</p> : null}
      {canManage && mailbox.status !== "revoked" ? (
        <>
          <form action={save} className="grid gap-3 sm:grid-cols-[8rem_1fr] sm:items-start">
            <input type="hidden" name="accountId" value={mailbox.id} />
            <div className="grid gap-1">
              <Label htmlFor={`limit-${mailbox.id}`}>Tope diario</Label>
              <Input
                id={`limit-${mailbox.id}`}
                name="dailySendLimit"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={mailbox.dailySendLimit}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`signature-${mailbox.id}`}>Firma</Label>
              <Textarea
                id={`signature-${mailbox.id}`}
                name="signature"
                defaultValue={mailbox.signature ?? ""}
                placeholder={"Ana Pérez\nAgencia Norte"}
                className="min-h-16"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <SubmitButton size="sm" variant="outline" pendingText="Guardando…">
                Guardar
              </SubmitButton>
              {saveState.status !== "idle" ? (
                <span
                  className={
                    saveState.status === "error"
                      ? "text-destructive text-xs"
                      : "text-muted-foreground text-xs"
                  }
                >
                  {saveState.message}
                </span>
              ) : null}
            </div>
          </form>
          <form
            action={disconnect}
            onSubmit={(e) => {
              if (
                !confirm(
                  `¿Desconectar ${mailbox.email}? Las secuencias que la usan dejan de enviar.`,
                )
              )
                e.preventDefault();
            }}
          >
            <input type="hidden" name="accountId" value={mailbox.id} />
            <SubmitButton size="sm" variant="ghost" pendingText="Desconectando…">
              Desconectar
            </SubmitButton>
            {discState.status === "error" ? (
              <p className="text-destructive text-xs">{discState.message}</p>
            ) : null}
          </form>
        </>
      ) : !active ? null : (
        <p className="text-muted-foreground text-xs">
          Tope diario: {mailbox.dailySendLimit} emails.
        </p>
      )}
    </li>
  );
}
