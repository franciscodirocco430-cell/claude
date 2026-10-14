"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import { changeRoleAction, removeMemberAction } from "./team-actions";

export interface MemberView {
  membershipId: string;
  name: string;
  email: string | null;
  role: Role;
  isSelf: boolean;
  canManage: boolean;
  assignableRoles: Role[];
}

export function MemberRow({ member }: { member: MemberView }) {
  const [roleState, roleAction] = useActionState<ActionState, FormData>(changeRoleAction, idle);
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    removeMemberAction,
    idle,
  );
  useRefreshOnSuccess(roleState);
  useRefreshOnSuccess(removeState);
  const error =
    (roleState.status === "error" && roleState.message) ||
    (removeState.status === "error" && removeState.message) ||
    null;

  return (
    <li className="grid gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.name}
            {member.isSelf ? <span className="text-muted-foreground"> (vos)</span> : null}
          </p>
          {member.email ? (
            <p className="text-muted-foreground truncate text-xs">{member.email}</p>
          ) : null}
        </div>
        {member.canManage ? (
          <div className="flex items-center gap-2">
            <form action={roleAction}>
              <input type="hidden" name="membershipId" value={member.membershipId} />
              <label htmlFor={`role-${member.membershipId}`} className="sr-only">
                Rol de {member.name}
              </label>
              <NativeSelect
                id={`role-${member.membershipId}`}
                name="role"
                defaultValue={member.role}
                className="h-8 w-28"
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
              >
                {member.assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!confirm(`¿Quitar a ${member.name} del equipo?`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="membershipId" value={member.membershipId} />
              <SubmitButton size="sm" variant="ghost" pendingText="Quitando…">
                Quitar
              </SubmitButton>
            </form>
          </div>
        ) : (
          <Badge variant="secondary">{ROLE_LABELS[member.role]}</Badge>
        )}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </li>
  );
}
