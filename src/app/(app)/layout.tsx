import { AppShell } from "@/components/layout/app-shell";
import { withUserContext } from "@/db/rls";
import { countUnreadNotifications } from "@/server/agent/notifications";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAppContext();
  const unread = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    countUnreadNotifications(tx, ctx.organizationId, ctx.user.id),
  );
  return (
    <AppShell
      badges={{ "/bandeja": unread }}
      account={{
        email: ctx.user.email ?? "",
        organizationId: ctx.organizationId,
        organizationName: ctx.organizationName,
        role: ctx.role,
        organizations: ctx.organizations,
      }}
    >
      {children}
    </AppShell>
  );
}
