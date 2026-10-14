import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import {
  assignableRoles,
  canChangeRole,
  canRemoveMember,
  isAdminRole,
  ROLE_LABELS,
} from "@/server/auth/permissions";
import type { AppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listPendingInvitations } from "@/server/invitations/service";
import { listMembers } from "@/server/organizations/service";
import { InviteForm } from "./invite-form";
import { MemberRow, type MemberView } from "./member-row";
import { RevokeButton } from "./revoke-button";

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

export async function TeamSection({ ctx }: { ctx: AppContext }) {
  const isAdmin = isAdminRole(ctx.role);
  // Lecturas con RLS del usuario: defensa en profundidad además del filtro por organización.
  const { members, pending } = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => ({
    members: await listMembers(tx, ctx.organizationId),
    pending: isAdmin ? await listPendingInvitations(tx, ctx.organizationId) : [],
  }));
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const views: MemberView[] = members.map((m) => {
    const change = {
      actorId: ctx.user.id,
      actorRole: ctx.role,
      targetId: m.userId,
      targetRole: m.role,
      ownerCount,
    };
    const roles = assignableRoles(ctx.role).filter(
      (r) => r === m.role || canChangeRole(change, r).ok,
    );
    // La UI deriva de las mismas reglas que valida el servidor.
    const canManage = canRemoveMember(change).ok || roles.length > 1;
    return {
      membershipId: m.membershipId,
      name: m.fullName ?? m.email ?? "Sin nombre",
      email: m.fullName ? m.email : null,
      role: m.role,
      isSelf: m.userId === ctx.user.id,
      canManage,
      assignableRoles: roles,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Users className="size-4" aria-hidden /> Equipo
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "Invitá setters y administradores a tu organización."
            : "Las personas de tu organización."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="divide-y rounded-lg border">
          {views.map((v) => (
            <MemberRow key={v.membershipId} member={v} />
          ))}
        </ul>

        {isAdmin ? (
          <>
            <InviteForm roles={assignableRoles(ctx.role)} />
            {pending.length > 0 ? (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">Invitaciones pendientes</h3>
                <ul className="divide-y rounded-lg border">
                  {pending.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{inv.email}</p>
                        <p className="text-muted-foreground text-xs">
                          Vence el {dateFormat.format(inv.expiresAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                        <RevokeButton invitationId={inv.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
