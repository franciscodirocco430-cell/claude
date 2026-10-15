import { LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import { BottomNav, SidebarNav, type NavBadges } from "./nav-links";
import { OrgSwitcher } from "./org-switcher";

export interface ShellAccount {
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  organizations: { organizationId: string; name: string }[];
}

function Brand() {
  return (
    <Link href="/campanas" className="group flex items-center gap-2 font-semibold">
      <span className="brand-mark flex size-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <span>
        Setter <span className="text-gradient">Copilot</span>
      </span>
    </Link>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signoutAction}>
      <Button
        type="submit"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className={compact ? undefined : "w-full justify-start"}
        aria-label="Salir"
      >
        <LogOut aria-hidden />
        {compact ? null : "Salir"}
      </Button>
    </form>
  );
}

export function AppShell({
  account,
  badges,
  children,
}: {
  account: ShellAccount;
  badges?: NavBadges;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar hidden border-r md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:p-4">
        <div className="px-2 pt-1">
          <Brand />
        </div>
        <SidebarNav badges={badges} />
        <div className="mt-auto grid gap-3 border-t pt-4">
          <div className="grid gap-1 px-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium" title={account.organizationName}>
                {account.organizationName}
              </p>
              <Badge variant="secondary">{ROLE_LABELS[account.role]}</Badge>
            </div>
            <p className="text-muted-foreground truncate text-xs" title={account.email}>
              {account.email}
            </p>
          </div>
          <OrgSwitcher organizations={account.organizations} activeId={account.organizationId} />
          <SignOutButton />
        </div>
      </aside>

      <div className="relative isolate flex min-w-0 flex-col">
        <div
          className="from-primary/10 via-brand-2/5 pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b to-transparent"
          aria-hidden
        />
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b px-4 backdrop-blur md:hidden">
          <Brand />
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground truncate text-xs">
              {account.organizationName}
            </span>
            <SignOutButton compact />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <BottomNav badges={badges} />
    </div>
  );
}
