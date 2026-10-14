"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { disconnectMailboxAction } from "./mailbox-actions";

export function CalendarRow({
  calendar,
  canManage,
}: {
  calendar: { id: string; email: string | null; status: string; lastError: string | null };
  canManage: boolean;
}) {
  const [state, disconnect] = useActionState<ActionState, FormData>(disconnectMailboxAction, idle);
  useRefreshOnSuccess(state);
  const active = calendar.status === "active";
  return (
    <li className="grid gap-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{calendar.email}</p>
        <Badge variant={active ? "secondary" : "outline"}>
          {active ? "Conectado" : "Desconectado"}
        </Badge>
      </div>
      {calendar.lastError ? <p className="text-destructive text-sm">{calendar.lastError}</p> : null}
      {canManage && active ? (
        <form
          action={disconnect}
          onSubmit={(e) => {
            if (!confirm(`¿Desconectar ${calendar.email}? El agente deja de ofrecer horarios.`))
              e.preventDefault();
          }}
        >
          <input type="hidden" name="accountId" value={calendar.id} />
          <SubmitButton size="sm" variant="ghost" pendingText="Desconectando…">
            Desconectar
          </SubmitButton>
        </form>
      ) : null}
    </li>
  );
}
