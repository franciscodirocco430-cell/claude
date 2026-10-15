"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Contadores por ruta (ej. avisos sin leer en la Bandeja). */
export type NavBadges = Partial<Record<string, number>>;

function CountBadge({ count, className }: { count: number | undefined; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px] leading-4 font-semibold",
        className,
      )}
      aria-label={`${count} sin leer`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SidebarNav({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5",
            )}
          >
            {active ? (
              <span
                className="bg-primary animate-in fade-in zoom-in-50 absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full"
                aria-hidden
              />
            ) : null}
            <Icon
              className="size-4 transition-transform duration-200 group-hover:scale-110"
              aria-hidden
            />
            {item.label}
            <CountBadge count={badges[item.href]} className="ml-auto" />
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative rounded-full px-3 py-0.5 transition-all duration-300",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <CountBadge count={badges[item.href]} className="absolute -top-1.5 -right-3" />
                </span>
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
