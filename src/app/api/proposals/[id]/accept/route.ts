import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Proposal, Conversation, Match, Project, Contract } from "@/lib/types/database.types";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const proposalId = params.id;

    // Get the proposal
    const { data: proposal } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .single() as unknown as { data: Proposal | null; error: unknown };

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Proposal is no longer pending" },
        { status: 400 }
      );
    }

    // Get the conversation to find participants
    const { data: conversation } = await supabase
      .from("conversations")
      .select("*, match:matches(*)")
      .eq("id", proposal.conversation_id)
      .single() as unknown as { data: Conversation | null; error: unknown };

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Verify the user is a participant in the conversation
    const isParticipant =
      conversation.participant_a === user.id || conversation.participant_b === user.id;

    if (!isParticipant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // Get the project from the match
    const { data: match } = await serviceClient
      .from("matches")
      .select("*")
      .eq("id", conversation.match_id)
      .single() as unknown as { data: Match | null; error: unknown };

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Get project to find freelier_id
    const { data: project } = await serviceClient
      .from("projects")
      .select("freelier_id")
      .eq("id", match.project_id)
      .single() as unknown as { data: Pick<Project, "freelier_id"> | null; error: unknown };

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only the freelier (project owner) can accept proposals
    if (user.id !== project.freelier_id) {
      return NextResponse.json(
        { error: "Only the freelier can accept proposals" },
        { status: 403 }
      );
    }

    // Update proposal status
    await (serviceClient.from("proposals") as unknown as any)
      .update({ status: "accepted" })
      .eq("id", proposalId);

    // Create contract with platform_fee locked at insert time
    const { data: contract, error: contractError } = await (serviceClient
      .from("contracts") as unknown as any)
      .insert({
        proposal_id: proposalId,
        project_id: match.project_id,
        freelo_id: proposal.freelo_id,
        freelier_id: project.freelier_id,
        total_amount: proposal.amount,
        platform_fee: proposal.platform_fee,
        status: "active",
        escrow_status: "pending",
        agreement_text: `Contract between freelancer and client for project. Platform fee: ${proposal.platform_fee}. Total: ${proposal.amount}.`,
      })
      .select()
      .single() as unknown as { data: Contract | null; error: unknown };

    if (contractError || !contract) {
      console.error("Contract creation error:", contractError);
      return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
    }

    // Send system message
    await (serviceClient.from("messages") as unknown as any).insert({
      conversation_id: proposal.conversation_id,
      sender_id: user.id,
      body: "🎉 Proposal accepted! A contract has been created.",
      message_type: "system",
      metadata: { contract_id: contract.id },
    });

    // Trigger webhook
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "contract.created",
        payload: { contract_id: contract.id, proposal_id: proposalId },
      }),
    }).catch(() => {}); // Best effort

    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    console.error("Accept proposal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
