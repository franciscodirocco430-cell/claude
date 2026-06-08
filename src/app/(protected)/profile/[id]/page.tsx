import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, FreeloProfile } from "@/lib/types/database.types";
import { BentoGrid } from "@/components/profile/bento-grid";
import { BentoCell } from "@/components/profile/bento-cell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getBadges } from "@/lib/xp";
import { TIER_LABELS } from "@/lib/constants";
import Link from "next/link";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", params.id)
    .single() as unknown as { data: Pick<Profile, "display_name"> | null; error: unknown };

  return {
    title: profile?.display_name ?? "Profile",
  };
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: freeloProfile }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", params.id).single() as unknown as { data: Profile | null; error: unknown },
    supabase.from("freelo_profiles").select("*").eq("id", params.id).single() as unknown as { data: FreeloProfile | null; error: unknown },
  ]);

  if (!profile) notFound();

  const badges = getBadges(profile);
  const isOwn = user?.id === profile.id;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Profile header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar size="xl">
            <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} size="xl" />
            <AvatarFallback name={profile.display_name} />
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
                {profile.display_name ?? "Anonymous"}
              </h1>
              <Badge variant={profile.subscription_tier as "free" | "pro" | "elite"}>
                {TIER_LABELS[profile.subscription_tier]}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 capitalize">
              {profile.role === "freelo" ? "Freelancer" : "Client"}
            </p>
            {badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {badges.slice(0, 3).map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {isOwn ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">Edit Profile</Link>
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm">
                Message
              </Button>
              {user && (
                <Button size="sm">
                  {profile.role === "freelo" ? "Invite to Project" : "View Projects"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bento Grid */}
      {profile.role === "freelo" && freeloProfile ? (
        <BentoGrid>
          {/* Bio - col-span-2 */}
          <BentoCell
            variant="bio"
            profile={profile}
            freeloProfile={freeloProfile}
            data-col-span="2"
          />

          {/* Skills */}
          <BentoCell
            variant="skills"
            profile={profile}
            freeloProfile={freeloProfile}
          />

          {/* Availability */}
          <BentoCell
            variant="availability"
            profile={profile}
            freeloProfile={freeloProfile}
          />

          {/* Portfolio - col-span-2 row-span-2 */}
          <BentoCell
            variant="portfolio"
            profile={profile}
            freeloProfile={freeloProfile}
            data-col-span="2"
            data-row-span="2"
          />

          {/* XP Bar */}
          <BentoCell
            variant="xp"
            profile={profile}
            freeloProfile={freeloProfile}
          />

          {/* Badges */}
          <BentoCell
            variant="badges"
            profile={profile}
            freeloProfile={freeloProfile}
            badges={badges}
          />

          {/* Stats */}
          <BentoCell
            variant="stats"
            profile={profile}
            freeloProfile={freeloProfile}
          />
        </BentoGrid>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">
            This is a client profile. Client profiles have limited public information.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">Client</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Member Since</p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Tier</p>
              <p className="mt-1 font-semibold text-primary capitalize">
                {profile.subscription_tier}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
