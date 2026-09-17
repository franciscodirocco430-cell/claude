"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, Bell, Sparkles, X } from "lucide-react";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SidebarContent } from "./sidebar";

export function Topbar({
  title,
  userEmail,
}: {
  title: string;
  userEmail?: string | null;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.08] bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <button
          className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.06] lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="font-display text-lg font-semibold">{title}</h1>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search content..."
              aria-label="Search content"
              className="h-9 w-56 rounded-lg border border-white/[0.08] bg-surface-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            aria-label="Notifications"
            className="relative rounded-lg p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
          </button>

          <LiquidButton
            size="default"
            icon={<Sparkles className="h-4 w-4" />}
            onClick={() => router.push("/content/new")}
          >
            Analyze Content
          </LiquidButton>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl animate-slide-up">
            <button
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06]"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} userEmail={userEmail} />
          </div>
        </div>
      )}
    </>
  );
}
