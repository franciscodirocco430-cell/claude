"use client";

import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/content": "Content Library",
  "/content/new": "Analyze Content",
  "/ideas": "Reel Ideas",
  "/compare": "Compare Content",
  "/insights": "Insights",
  "/recommendations": "Recommendations",
  "/settings": "Settings",
};

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/content/")) return "Content Analysis";
  return "Content Intelligence";
}

export function AppShellClient({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
}) {
  const pathname = usePathname();
  return (
    <>
      <Topbar title={resolveTitle(pathname)} userEmail={userEmail} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </>
  );
}
