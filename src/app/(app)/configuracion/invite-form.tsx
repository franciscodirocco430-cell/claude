"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import type { ActionState } from "@/server/actions";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import { inviteMemberAction } from "./team-actions";

type State = ActionState<{ inviteUrl: string; email: string }>;

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label="Link de invitación"
        className="bg-muted min-w-0 flex-1 rounded-md border px-3 text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function InviteForm({ roles }: { roles: Role[] }) {
  const [state, action] = useActionState<State, FormData>(inviteMemberAction, { status: "idle" });
  useRefreshOnSuccess(state);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <div className="grid gap-3">
      <form
        action={action}
        className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
        noValidate
      >
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          placeholder="setter@tuagencia.com"
          defaultValue={values?.email}
          error={errors?.email}
          required
        />
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Rol</Label>
          <NativeSelect id="invite-role" name="role" defaultValue={values?.role ?? "setter"}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <SubmitButton pendingText="Invitando…">Invitar</SubmitButton>
      </form>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.data ? (
        <Alert variant="success" className="grid gap-2">
          <p>
            Invitación creada para <strong>{state.data.email}</strong>. Mandale este link (vence en
            7 días y solo funciona con ese email):
          </p>
          <CopyLink url={state.data.inviteUrl} />
        </Alert>
      ) : null}
    </div>
  );
}
