import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SidebarNav } from "./nav-links";

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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="bg-sidebar hidden border-r md:flex md:flex-col md:gap-6 md:p-4">
        <div className="px-2 pt-1">
          <Brand />
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center border-b px-4 backdrop-blur md:hidden">
          <Brand />
        </header>
        <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
