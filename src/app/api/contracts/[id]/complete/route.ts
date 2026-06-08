import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { XP_AWARD_AMOUNTS, calculateXPFromReview } from "@/lib/xp";
import type { Contract, Profile } from "@/lib/types/database.types";

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

    const contractId = params.id;

    // Get contract
    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single() as unknown as { data: Contract | null; error: unknown };

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.freelo_id !== user.id && contract.freelier_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status !== "active") {
      return NextResponse.json(
        { error: "Contract is not active" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Mark contract complete
    const { error: updateError } = await (serviceClient
      .from("contracts") as unknown as any)
      .update({
        status: "completed",
        escrow_status: "released",
        completed_at: new Date().toISOString(),
      })
      .eq("id", contractId) as unknown as { error: unknown };

    if (updateError) {
      return NextResponse.json({ error: "Failed to complete contract" }, { status: 500 });
    }

    // Award XP to freelo
    const xpToAward = XP_AWARD_AMOUNTS.CONTRACT_COMPLETED;
    await (serviceClient.from("profiles") as unknown as any)
      .update({ xp_score: contract.freelo_id })
      .eq("id", contract.freelo_id);

    // Use RPC or direct update for XP increment
    const { data: freeloProfile } = await serviceClient
      .from("profiles")
      .select("xp_score")
      .eq("id", contract.freelo_id)
      .single() as unknown as { data: Pick<Profile, "xp_score"> | null; error: unknown };

    if (freeloProfile) {
      await (serviceClient.from("profiles") as unknown as any)
        .update({ xp_score: freeloProfile.xp_score + xpToAward })
        .eq("id", contract.freelo_id);
    }

    // Trigger webhook for contract completion
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("supabase.co", "")}/api/webhooks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "contract.completed",
          payload: {
            contract_id: contractId,
            freelo_id: contract.freelo_id,
            freelier_id: contract.freelier_id,
            total_amount: contract.total_amount,
            platform_fee: contract.platform_fee,
            xp_awarded: xpToAward,
          },
        }),
      }
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      contract_id: contractId,
      xp_awarded: xpToAward,
    });
  } catch (err) {
    console.error("Complete contract error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
