import React from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { DollarSign, Clock, Users, ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Project, Profile, Match } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkillChip } from "@/components/profile/skill-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("title")
    .eq("id", params.id)
    .single() as unknown as { data: Pick<Project, "title"> | null; error: unknown };
  return { title: data?.title ?? "Project" };
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", params.id).single() as unknown as { data: Project | null; error: unknown },
    supabase.from("profiles").select("*").eq("id", user.id).single() as unknown as { data: Profile | null; error: unknown },
  ]);

  if (!project) notFound();

  const isOwner = project.freelier_id === user.id;
  const isFreelo = profile?.role === "freelo";

  // Get applicants if owner
  let matches: Array<{ id: string; freelo_id: string; status: string; created_at: string }> = [];
  let matchProfiles: Record<string, { id: string; display_name: string | null; avatar_url: string | null; xp_score: number }> = {};

  if (isOwner) {
    const { data: m } = await supabase
      .from("matches")
      .select("*")
      .eq("project_id", params.id)
      .order("created_at", { ascending: false }) as unknown as { data: Match[] | null; error: unknown };
    matches = m ?? [];

    if (matches.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, xp_score")
        .in("id", matches.map((m) => m.freelo_id)) as unknown as { data: Pick<Profile, "id" | "display_name" | "avatar_url" | "xp_score">[] | null; error: unknown };
      matchProfiles = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    }
  }

  // Check if current freelo applied
  const { data: myMatch } = (isFreelo
    ? await supabase
        .from("matches")
        .select("id, status")
        .eq("project_id", params.id)
        .eq("freelo_id", user.id)
        .single()
    : { data: null }) as unknown as { data: Pick<Match, "id" | "status"> | null; error: unknown };

  const statusColors = {
    draft: "outline" as const,
    open: "success" as const,
    in_progress: "default" as const,
    completed: "outline" as const,
    cancelled: "destructive" as const,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href={isOwner ? "/projects" : "/feed"}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
              {project.title}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Posted {formatDate(project.created_at)}
            </p>
          </div>
          <Badge variant={statusColors[project.status]}>
            {project.status.replace("_", " ")}
          </Badge>
        </div>

        {/* Details */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {(project.budget_min || project.budget_max) && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {project.budget_min && project.budget_max
                    ? `${formatCurrency(project.budget_min)} – ${formatCurrency(project.budget_max)}`
                    : project.budget_min
                    ? `From ${formatCurrency(project.budget_min)}`
                    : `Up to ${formatCurrency(project.budget_max!)}`}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Applicants</p>
              <p className="font-semibold text-gray-900 dark:text-white">{matches.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="font-semibold capitalize text-gray-900 dark:text-white">
                {project.status.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
              Description
            </h2>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {project.description}
            </p>
          </div>
        )}

        {/* Required Skills */}
        {project.required_skills.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
              Required Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {project.required_skills.map((skill) => (
                <SkillChip key={skill} skill={skill} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Freelo: Apply button */}
        {isFreelo && project.status === "open" && (
          <div className="mt-8 flex gap-3">
            {myMatch ? (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <span className="text-sm font-medium">
                  Applied — Status: {myMatch.status}
                </span>
              </div>
            ) : (
              <form action="/api/matches" method="POST">
                <input type="hidden" name="project_id" value={project.id} />
                <Button type="submit" size="lg">
                  Apply to This Project
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Owner: Applicants list */}
        {isOwner && matches.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
              Applicants ({matches.length})
            </h2>
            <div className="space-y-3">
              {matches.map((match) => {
                const p = matchProfiles[match.freelo_id];
                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={p?.avatar_url} alt={p?.display_name ?? ""} size="sm" />
                        <AvatarFallback name={p?.display_name} />
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {p?.display_name ?? "Freelancer"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {p?.xp_score ?? 0} XP · Applied {formatDate(match.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          match.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : match.status === "accepted"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {match.status}
                      </span>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/profile/${match.freelo_id}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
