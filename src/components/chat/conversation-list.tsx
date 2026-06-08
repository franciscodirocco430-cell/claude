"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn, formatRelativeTime, getInitials, truncate } from "@/lib/utils";
import type { Conversation, Message, Profile } from "@/lib/types/database.types";

interface ConversationWithDetails extends Conversation {
  lastMessage?: Message;
  otherParticipant?: Profile;
  unreadCount?: number;
}

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  currentUserId: string;
}

export function ConversationList({ conversations, currentUserId }: ConversationListProps) {
  const pathname = usePathname();

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No conversations yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Apply to projects or accept applications to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {conversations.map((conv) => {
        const isActive = pathname === `/chat/${conv.id}`;
        const other = conv.otherParticipant;
        const hasUnread = (conv.unreadCount ?? 0) > 0;

        return (
          <Link
            key={conv.id}
            href={`/chat/${conv.id}`}
            className={cn(
              "flex items-center gap-3 p-4 transition-colors",
              isActive
                ? "bg-primary/5 border-r-2 border-primary"
                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            )}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">
                {getInitials(other?.display_name ?? other?.email)}
              </div>
              {hasUnread && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs text-white font-bold">
                  {conv.unreadCount}
                </span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-sm truncate",
                    hasUnread
                      ? "font-semibold text-gray-900 dark:text-white"
                      : "font-medium text-gray-700 dark:text-gray-300"
                  )}
                >
                  {other?.display_name ?? other?.email ?? "Unknown"}
                </p>
                {conv.lastMessage && (
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatRelativeTime(conv.lastMessage.created_at)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p
                  className={cn(
                    "text-xs truncate mt-0.5",
                    hasUnread
                      ? "text-gray-700 dark:text-gray-300 font-medium"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  {conv.lastMessage.sender_id === currentUserId ? "You: " : ""}
                  {conv.lastMessage.message_type === "proposal"
                    ? "Sent a proposal"
                    : conv.lastMessage.message_type === "system"
                    ? "System message"
                    : truncate(conv.lastMessage.body, 50)}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
