import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GitMerge, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import type { Match, Profile } from "@/lib/types/database.types";

export const metadata = { title: "Matches" };

export default async function MatchesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as unknown as { data: Pick<Profile, "role"> | null; error: unknown };

  const isFreelo = profile?.role === "freelo";

  let matchData: Array<{
    id: string;
    project_id: string;
    freelo_id: string;
    status: string;
    created_at: string;
    project?: { title: string; status: string };
    freeloProfile?: { display_name: string | null; avatar_url: string | null };
  }> = [];

  if (isFreelo) {
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .eq("freelo_id", user.id)
      .order("created_at", { ascending: false }) as unknown as { data: Match[] | null; error: unknown };

    if (matches && matches.length > 0) {
      const projectIds = matches.map((m) => m.project_id);
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, status")
        .in("id", projectIds) as unknown as { data: { id: string; title: string; status: string }[] | null; error: unknown };

      const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));
      matchData = matches.map((m) => ({
        ...m,
        project: projectMap.get(m.project_id),
      }));
    }
  } else {
    // Freelier: see applications to their projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("freelier_id", user.id) as unknown as { data: { id: string }[] | null; error: unknown };

    const projectIds = (projects ?? []).map((p) => p.id);

    if (projectIds.length > 0) {
      const { data: matches } = await supabase
        .from("matches")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false }) as unknown as { data: Match[] | null; error: unknown };

      if (matches && matches.length > 0) {
        const { data: projectDetails } = await supabase
          .from("projects")
          .select("id, title, status")
          .in("id", projectIds) as unknown as { data: { id: string; title: string; status: string }[] | null; error: unknown };

        const { data: freeloProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", matches.map((m) => m.freelo_id)) as unknown as { data: Pick<Profile, "id" | "display_name" | "avatar_url">[] | null; error: unknown };

        const projectMap = new Map((projectDetails ?? []).map((p) => [p.id, p]));
        const profileMap = new Map((freeloProfiles ?? []).map((p) => [p.id, p]));

        matchData = matches.map((m) => ({
          ...m,
          project: projectMap.get(m.project_id),
          freeloProfile: profileMap.get(m.freelo_id),
        }));
      }
    }
  }

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    withdrawn: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
          {isFreelo ? "My Applications" : "Incoming Applications"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {matchData.length} {isFreelo ? "applications" : "applicants"}
        </p>
      </div>

      {matchData.length === 0 ? (
        <EmptyState
          icon={GitMerge}
          title={isFreelo ? "No applications yet" : "No applicants yet"}
          description={
            isFreelo
              ? "Apply to projects from the feed to see them here."
              : "Post projects to start receiving applications."
          }
          cta={
            isFreelo
              ? { label: "Browse Projects", href: "/feed" }
              : { label: "Create Project", href: "/projects/new" }
          }
        />
      ) : (
        <div className="space-y-3">
          {matchData.map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center gap-3">
                {!isFreelo && match.freeloProfile && (
                  <Avatar size="sm">
                    <AvatarImage
                      src={match.freeloProfile.avatar_url}
                      alt={match.freeloProfile.display_name ?? ""}
                      size="sm"
                    />
                    <AvatarFallback name={match.freeloProfile.display_name} />
                  </Avatar>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {isFreelo
                      ? (match.project?.title ?? "Unknown Project")
                      : (match.freeloProfile?.display_name ?? "Freelancer")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {isFreelo
                      ? `Project: ${match.project?.title}`
                      : `For: ${match.project?.title ?? "Unknown project"}`}{" "}
                    · {formatDate(match.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    statusColors[match.status as keyof typeof statusColors] ?? ""
                  }`}
                >
                  {match.status}
                </span>
                <Link
                  href={`/projects/${match.project_id}`}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
