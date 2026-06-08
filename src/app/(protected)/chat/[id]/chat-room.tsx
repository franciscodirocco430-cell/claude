"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import type { Message, Profile } from "@/lib/types/database.types";

interface MessageWithSender extends Message {
  sender?: Profile;
}

interface ChatRoomProps {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageWithSender[];
  otherProfile: Profile | null;
}

export function ChatRoom({
  conversationId,
  currentUserId,
  initialMessages,
  otherProfile,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to realtime messages
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, sender: undefined }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleMessageSent = (message: Message) => {
    setMessages((prev) => {
      if (prev.find((m) => m.id === message.id)) return prev;
      return [...prev, { ...message, sender: undefined }];
    });
  };

  const handleProposalAction = async (proposalId: string, action: "accept" | "reject") => {
    try {
      if (action === "accept") {
        const res = await fetch(`/api/proposals/${proposalId}/accept`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to accept proposal");
        toast({ type: "success", title: "Proposal accepted!", description: "A contract has been created." });
      } else {
        const res = await fetch(`/api/proposals/${proposalId}/reject`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to reject proposal");
        toast({ type: "info", title: "Proposal declined." });
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <Link
          href="/chat"
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Avatar size="sm">
          <AvatarImage src={otherProfile?.avatar_url} alt={otherProfile?.display_name ?? ""} size="sm" />
          <AvatarFallback name={otherProfile?.display_name} />
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {otherProfile?.display_name ?? "User"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {otherProfile?.role === "freelo" ? "Freelancer" : "Client"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        conversationId={conversationId}
        onProposalAction={handleProposalAction}
      />

      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        onMessageSent={handleMessageSent}
      />
    </div>
  );
}
