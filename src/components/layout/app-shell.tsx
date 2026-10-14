import { LogOut, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, type Role } from "@/server/auth/permissions";
import { BottomNav, SidebarNav } from "./nav-links";
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
    <Link href="/campanas" className="flex items-center gap-2 font-semibold">
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
        <Sparkles className="size-4" aria-hidden />
      </span>
      Setter Copilot
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

export function AppShell({ account, children }: { account: ShellAccount; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar hidden border-r md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-6 md:p-4">
        <div className="px-2 pt-1">
          <Brand />
        </div>
        <SidebarNav />
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

      <div className="flex min-w-0 flex-col">
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

      <BottomNav />
    </div>
  );
}
