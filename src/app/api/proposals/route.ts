import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile, Conversation, Proposal } from "@/lib/types/database.types";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversation_id, amount, milestones = [], deliverables = [] } = body;

    if (!conversation_id || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: conversation_id, amount" },
        { status: 400 }
      );
    }

    // Verify user is a participant and is a freelo
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single() as unknown as { data: Pick<Profile, "role"> | null; error: unknown };

    if (profile?.role !== "freelo") {
      return NextResponse.json(
        { error: "Only freelancers can send proposals" },
        { status: 403 }
      );
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .single() as unknown as { data: Conversation | null; error: unknown };

    if (
      !conversation ||
      (conversation.participant_a !== user.id && conversation.participant_b !== user.id)
    ) {
      return NextResponse.json({ error: "Conversation not found or unauthorized" }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // Create proposal
    const { data: proposal, error: proposalError } = await (serviceClient
      .from("proposals") as unknown as any)
      .insert({
        conversation_id,
        freelo_id: user.id,
        amount: Number(amount),
        milestones,
        deliverables,
        status: "pending",
      })
      .select()
      .single() as unknown as { data: Proposal | null; error: unknown };

    if (proposalError || !proposal) {
      return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
    }

    // Create a proposal message in the conversation
    await (serviceClient.from("messages") as unknown as any).insert({
      conversation_id,
      sender_id: user.id,
      body: `Proposal for ${formatCurrency(amount)}`,
      message_type: "proposal",
      metadata: {
        proposal_id: proposal.id,
        amount: proposal.amount,
        platform_fee: proposal.platform_fee,
        milestones: proposal.milestones,
        deliverables: proposal.deliverables,
        status: proposal.status,
      },
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (err) {
    console.error("Proposals route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}
