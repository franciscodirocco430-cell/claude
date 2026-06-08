import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Project, Profile } from "@/lib/types/database.types";
import { ProjectCard } from "@/components/feed/project-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "My Projects" };

export default async function ProjectsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as unknown as { data: Pick<Profile, "role"> | null; error: unknown };

  // Freelos don't have projects page
  if (profile?.role === "freelo") {
    redirect("/feed");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("freelier_id", user.id)
    .order("created_at", { ascending: false }) as unknown as { data: Project[] | null; error: unknown };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
            My Projects
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {projects?.length ?? 0} projects
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects yet"
          description="Create your first project to start finding talent."
          cta={{ label: "Create Project", href: "/projects/new" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showApply={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
