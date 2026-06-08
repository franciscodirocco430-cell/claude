import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "./chat-room";
import type { Conversation, Message, Profile } from "@/lib/types/database.types";

export const metadata = { title: "Chat" };

export default async function ChatRoomPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", params.id)
    .single() as unknown as { data: Conversation | null; error: unknown };

  if (!conversation) notFound();

  // Verify user is a participant
  if (conversation.participant_a !== user.id && conversation.participant_b !== user.id) {
    redirect("/chat");
  }

  // Get initial messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })
    .limit(100) as unknown as { data: Message[] | null; error: unknown };

  // Get sender profiles
  const senderIds = [...new Set((messages ?? []).map((m) => m.sender_id))];
  const { data: senderProfiles } = (senderIds.length > 0
    ? await supabase.from("profiles").select("*").in("id", senderIds)
    : { data: [] }) as unknown as { data: Profile[] | null; error: unknown };

  const profileMap = new Map((senderProfiles ?? []).map((p) => [p.id, p]));

  const messagesWithSenders = (messages ?? []).map((m) => ({
    ...m,
    sender: profileMap.get(m.sender_id),
  }));

  // Get other participant
  const otherId = conversation.participant_a === user.id
    ? conversation.participant_b
    : conversation.participant_a;

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", otherId)
    .single() as unknown as { data: Profile | null; error: unknown };

  return (
    <ChatRoom
      conversationId={params.id}
      currentUserId={user.id}
      initialMessages={messagesWithSenders}
      otherProfile={otherProfile}
    />
  );
}
