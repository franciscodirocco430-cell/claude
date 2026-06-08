"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, Briefcase, GitMerge, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database.types";

interface MobileNavProps {
  role: UserRole;
  profileId: string;
}

export function MobileNav({ role, profileId }: MobileNavProps) {
  const pathname = usePathname();

  const freeloTabs = [
    { href: "/feed", label: "Feed", icon: Rss },
    { href: "/matches", label: "Matches", icon: GitMerge },
    { href: "/chat", label: "Chat", icon: MessageCircle },
    { href: `/profile/${profileId}`, label: "Profile", icon: User },
  ];

  const freelierTabs = [
    { href: "/feed", label: "Talent", icon: Rss },
    { href: "/projects", label: "Projects", icon: Briefcase },
    { href: "/matches", label: "Applications", icon: GitMerge },
    { href: "/chat", label: "Chat", icon: MessageCircle },
    { href: `/profile/${profileId}`, label: "Profile", icon: User },
  ];

  const tabs = role === "freelo" ? freeloTabs : freelierTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/90 md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/feed"
              ? pathname === "/feed"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "scale-110 transition-transform")} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </div>
              <span className="mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
