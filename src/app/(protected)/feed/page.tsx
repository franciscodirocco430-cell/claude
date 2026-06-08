import React from "react";
import { redirect } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectCard } from "@/components/feed/project-card";
import { FreeloCard } from "@/components/feed/freelo-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { Profile, FreeloProfile, Project, Match } from "@/lib/types/database.types";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single() as unknown as { data: Profile | null; error: unknown };

  if (!profile) redirect("/auth");

  if (profile.role === "freelo") {
    // Freelo sees open projects
    const { data: projects } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50) as unknown as { data: Project[] | null; error: unknown };

    // Get freelier profiles
    const freelierIds = [...new Set((projects ?? []).map((p) => p.freelier_id))];
    const { data: freelierProfiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", freelierIds) as unknown as { data: Profile[] | null; error: unknown };

    const freelierMap = new Map(
      (freelierProfiles ?? []).map((p) => [p.id, p])
    );

    // Get user's existing matches
    const { data: matches } = await supabase
      .from("matches")
      .select("project_id")
      .eq("freelo_id", user.id) as unknown as { data: Pick<Match, "project_id">[] | null; error: unknown };

    const appliedProjectIds = new Set((matches ?? []).map((m) => m.project_id));

    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
              Project Feed
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {projects?.length ?? 0} open projects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search projects..."
                className="h-9 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {!projects || projects.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No open projects"
            description="Check back later or update your skills to match more projects."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                freelier={freelierMap.get(project.freelier_id)}
                hasApplied={appliedProjectIds.has(project.id)}
                showApply={true}
              />
            ))}
          </div>
        )}
      </div>
    );
  } else {
    // Freelier sees available talent
    const { data: freeloProfiles } = await supabase
      .from("freelo_profiles")
      .select("*")
      .order("id") as unknown as { data: FreeloProfile[] | null; error: unknown };

    const freeloIds = (freeloProfiles ?? []).map((fp) => fp.id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", freeloIds)
      .eq("role", "freelo") as unknown as { data: Profile[] | null; error: unknown };

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
              Find Talent
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {freeloProfiles?.length ?? 0} freelancers available
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search talent..."
                className="h-9 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {!freeloProfiles || freeloProfiles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No freelancers yet"
            description="The talent pool is growing. Check back soon!"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {freeloProfiles.map((fp) => {
              const p = profileMap.get(fp.id);
              if (!p) return null;
              return (
                <FreeloCard
                  key={fp.id}
                  profile={p}
                  freeloProfile={fp}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
