"use client";

import { Loader2, Send } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { assignAction, replyAction } from "./actions";

export function ReplyForm({
  conversationId,
  hint,
  canSend,
}: {
  conversationId: string;
  /** Aviso sobre la ventana (ej. vencida → irá a la Cola). */
  hint: string | null;
  canSend: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(replyAction, idle);
  useRefreshOnSuccess(state);
  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);
  // Solo se limpia el texto si salió bien (un error no borra lo escrito).
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      className="grid gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <Label htmlFor="reply-text">Tu respuesta</Label>
      <Textarea
        id="reply-text"
        name="text"
        required
        maxLength={2000}
        className="min-h-20"
        placeholder="Escribí tu respuesta…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={!hydrated || pending || !canSend}
          aria-busy={pending}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? "Enviando…" : "Enviar"}
        </Button>
        {state.status !== "idle" && state.message ? (
          <p
            role="status"
            className={
              state.status === "error"
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function AssignSelect({
  conversationId,
  assignedTo,
  members,
}: {
  conversationId: string;
  assignedTo: string | null;
  members: { userId: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(assignAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="grid gap-1">
        <Label htmlFor="assign">Asignada a</Label>
        <NativeSelect
          // Remonta al cambiar en el servidor: un select no controlado solo lee defaultValue al montarse.
          key={assignedTo ?? "none"}
          id="assign"
          name="userId"
          defaultValue={assignedTo ?? ""}
          className="w-56 max-w-full"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {state.status === "error" ? (
        <span role="status" className="text-destructive text-xs">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
