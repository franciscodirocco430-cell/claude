import React from "react";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "@/components/chat/conversation-list";
import { EmptyState } from "@/components/shared/empty-state";
import type { Conversation, Message, Profile } from "@/lib/types/database.types";

export const metadata = { title: "Messages" };

export default async function ChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("created_at", { ascending: false }) as unknown as { data: Conversation[] | null; error: unknown };

  if (!conversations || conversations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
          Messages
        </h1>
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="Start chatting by applying to projects or accepting applications."
          cta={{ label: "Browse Projects", href: "/feed" }}
        />
      </div>
    );
  }

  // Get other participants
  const otherIds = conversations.map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );

  const { data: otherProfiles } = await supabase
    .from("profiles")
    .select("*")
    .in("id", otherIds) as unknown as { data: Profile[] | null; error: unknown };

  const profileMap = new Map((otherProfiles ?? []).map((p) => [p.id, p]));

  // Get last messages
  const convIds = conversations.map((c) => c.id);
  const { data: lastMessages } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false }) as unknown as { data: Message[] | null; error: unknown };

  const lastMessageMap = new Map<string, Message>();
  if (lastMessages) {
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    }
  }

  const convsWithDetails = conversations.map((c) => {
    const otherId = c.participant_a === user.id ? c.participant_b : c.participant_a;
    return {
      ...c,
      otherParticipant: profileMap.get(otherId),
      lastMessage: lastMessageMap.get(c.id),
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
        Messages
      </h1>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        <ConversationList
          conversations={convsWithDetails}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
