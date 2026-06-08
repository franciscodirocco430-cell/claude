import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { Profile } from "@/lib/types/database.types";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as unknown as { data: Profile | null; error: unknown };

  if (!profile) {
    redirect("/auth");
  }

  if (!profile.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar profile={profile} />
      <div className="flex flex-1">
        <Sidebar profile={profile} />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav role={profile.role} profileId={profile.id} />
    </div>
  );
}
