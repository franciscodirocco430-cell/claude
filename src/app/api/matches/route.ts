import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SUBSCRIPTION_LIMITS } from "@/lib/constants";
import type { Profile, Project, Match, Conversation } from "@/lib/types/database.types";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { project_id } = body;

    if (!project_id) {
      return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
    }

    // Get user profile to check role and subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, subscription_tier")
      .eq("id", user.id)
      .single() as unknown as { data: Pick<Profile, "role" | "subscription_tier"> | null; error: unknown };

    if (profile?.role !== "freelo") {
      return NextResponse.json(
        { error: "Only freelancers can apply to projects" },
        { status: 403 }
      );
    }

    // Check subscription limits
    const limits = SUBSCRIPTION_LIMITS[profile.subscription_tier];
    const { count: existingMatchCount } = await supabase
      .from("matches")
      .select("id", { count: "exact" })
      .eq("freelo_id", user.id)
      .gte("created_at", new Date(new Date().setDate(1)).toISOString()); // This month

    const currentCount = existingMatchCount ?? 0;
    if (currentCount >= limits.maxApplications) {
      return NextResponse.json(
        {
          error: "Application limit reached",
          limit: limits.maxApplications,
          current: currentCount,
          message: `Your ${profile.subscription_tier} plan allows ${limits.maxApplications} applications per month. Upgrade to apply to more projects.`,
        },
        { status: 429 }
      );
    }

    // Check project exists and is open
    const { data: project } = await supabase
      .from("projects")
      .select("id, status, freelier_id")
      .eq("id", project_id)
      .single() as unknown as { data: Pick<Project, "id" | "status" | "freelier_id"> | null; error: unknown };

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "open") {
      return NextResponse.json(
        { error: "Project is not accepting applications" },
        { status: 400 }
      );
    }

    if (project.freelier_id === user.id) {
      return NextResponse.json(
        { error: "You cannot apply to your own project" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Create match
    const { data: match, error: matchError } = await (serviceClient
      .from("matches") as unknown as any)
      .insert({
        project_id,
        freelo_id: user.id,
        status: "pending",
      })
      .select()
      .single() as unknown as { data: Match | null; error: { code?: string } | null };

    if (matchError || !match) {
      if (matchError?.code === "23505") {
        return NextResponse.json(
          { error: "You have already applied to this project" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
    }

    // Create conversation between freelo and freelier
    const { data: conversation } = await (serviceClient
      .from("conversations") as unknown as any)
      .insert({
        match_id: match.id,
        participant_a: user.id,
        participant_b: project.freelier_id,
      })
      .select()
      .single() as unknown as { data: Conversation | null; error: unknown };

    // Send system message to kick off the conversation
    if (conversation) {
      await (serviceClient.from("messages") as unknown as any).insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        body: "Application submitted. You can now message directly to discuss the project.",
        message_type: "system",
        metadata: { match_id: match.id, project_id },
      });
    }

    return NextResponse.json({ match, conversation }, { status: 201 });
  } catch (err) {
    console.error("Matches route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
