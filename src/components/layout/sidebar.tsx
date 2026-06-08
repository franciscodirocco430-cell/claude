"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Rss,
  Briefcase,
  GitMerge,
  MessageCircle,
  FileText,
  Settings,
  User,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/types/database.types";
import { TIER_LABELS } from "@/lib/constants";

interface SidebarProps {
  profile: Profile;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  const freeloLinks = [
    { href: "/feed", label: "Project Feed", icon: Rss },
    { href: "/matches", label: "My Applications", icon: GitMerge },
    { href: "/chat", label: "Messages", icon: MessageCircle },
    { href: "/contracts", label: "Contracts", icon: FileText },
    { href: `/profile/${profile.id}`, label: "My Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const freelierLinks = [
    { href: "/feed", label: "Find Talent", icon: Rss },
    { href: "/projects", label: "My Projects", icon: Briefcase },
    { href: "/matches", label: "Applications", icon: GitMerge },
    { href: "/chat", label: "Messages", icon: MessageCircle },
    { href: "/contracts", label: "Contracts", icon: FileText },
    { href: `/profile/${profile.id}`, label: "My Profile", icon: User },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const links = profile.role === "freelo" ? freeloLinks : freelierLinks;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 md:flex">
      <div className="flex flex-1 flex-col overflow-y-auto py-4">
        {/* User info */}
        <div className="mb-4 px-4">
          <div className="rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 p-3 border border-primary/10">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {profile.display_name ?? "User"}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge
                variant={profile.subscription_tier as "free" | "pro" | "elite"}
                className="text-xs"
              >
                {TIER_LABELS[profile.subscription_tier]}
              </Badge>
              <span className="text-xs text-gray-500 capitalize dark:text-gray-400">
                {profile.role === "freelo" ? "Freelancer" : "Client"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/feed"
                ? pathname === "/feed"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                {label}
              </Link>
            );
          })}

          {/* Admin link */}
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname === "/admin"
                ? "bg-primary/10 text-primary"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            Admin
          </Link>
        </nav>
      </div>

      {/* XP display at bottom */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>XP Score</span>
          <span className="font-semibold text-primary">{profile.xp_score}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style={{ width: `${Math.min(100, (profile.xp_score / 1000) * 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
