import { AppShell } from "@/components/layout/app-shell";
import { requireAppContext } from "@/server/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAppContext();
  return (
    <AppShell
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
