import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { moderateContent } from "@/lib/moderate-message";
import type { Conversation, Message } from "@/lib/types/database.types";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const { conversation_id, body: messageBody, message_type = "text", metadata = {} } = body;

    if (!conversation_id || !messageBody) {
      return NextResponse.json(
        { error: "Missing required fields: conversation_id, body" },
        { status: 400 }
      );
    }

    // Verify user is a participant in this conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("participant_a, participant_b")
      .eq("id", conversation_id)
      .single() as unknown as { data: Pick<Conversation, "participant_a" | "participant_b"> | null; error: unknown };

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (
      conversation.participant_a !== user.id &&
      conversation.participant_b !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Moderate content (only for text messages)
    if (message_type === "text") {
      const moderation = moderateContent(messageBody);
      if (!moderation.allowed) {
        return NextResponse.json(
          { error: "Message blocked", reason: moderation.reason },
          { status: 422 }
        );
      }
    }

    // 4. Insert using service role key (bypasses RLS)
    const serviceClient = createServiceClient();
    const { data: message, error: insertError } = await (serviceClient
      .from("messages") as unknown as any)
      .insert({
        conversation_id,
        sender_id: user.id,
        body: messageBody,
        message_type,
        is_moderated: false,
        metadata,
      })
      .select()
      .single() as unknown as { data: Message | null; error: unknown };

    if (insertError) {
      console.error("Message insert error:", insertError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // 5. Return inserted message
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("moderate-message error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
