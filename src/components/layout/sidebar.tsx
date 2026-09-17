"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Sparkles,
  GitCompare,
  Lightbulb,
  ListChecks,
  Settings,
  Upload,
  LogOut,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/content", label: "Content", icon: Library },
  { href: "/content/new", label: "Analyze", icon: Sparkles },
  { href: "/ideas", label: "Reel Ideas", icon: Wand2 },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/recommendations", label: "Recommendations", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarContent({
  onNavigate,
  userEmail,
}: {
  onNavigate?: () => void;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-base font-bold leading-tight tracking-tight">
          CONTENT
          <br />
          INTELLIGENCE
        </span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/content"
              ? pathname === "/content"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/[0.06] text-foreground"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/[0.08] p-3">
        <Link
          href="/content/new"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
        >
          <Upload className="h-4 w-4" />
          Upload content
        </Link>

        <div className="flex items-center gap-2 rounded-xl px-2 py-2">
          <Avatar size="sm">
            <AvatarFallback name={userEmail} />
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">
              {userEmail ?? "Account"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/[0.08] bg-surface lg:block">
      <div className="sticky top-0 h-screen">
        <SidebarContent userEmail={userEmail} />
      </div>
    </aside>
  );
}
