"use client";

import React, { useEffect, useRef } from "react";
import { cn, formatRelativeTime, getInitials } from "@/lib/utils";
import type { Message, Profile } from "@/lib/types/database.types";
import { ProposalCard } from "./proposal-card";
import type { Proposal } from "@/lib/types/database.types";

interface MessageWithSender extends Message {
  sender?: Profile;
}

interface MessageListProps {
  messages: MessageWithSender[];
  currentUserId: string;
  conversationId: string;
  onProposalAction?: (proposalId: string, action: "accept" | "reject") => void;
}

export function MessageList({
  messages,
  currentUserId,
  conversationId,
  onProposalAction,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No messages yet. Say hello!
        </p>
      </div>
    );
  }

  // Group messages by sender (consecutive same-sender messages)
  const groupedMessages: MessageWithSender[][] = [];
  let currentGroup: MessageWithSender[] = [];
  let lastSenderId = "";

  for (const msg of messages) {
    if (msg.sender_id !== lastSenderId || msg.message_type !== "text") {
      if (currentGroup.length > 0) {
        groupedMessages.push(currentGroup);
      }
      currentGroup = [msg];
      lastSenderId = msg.sender_id;
    } else {
      currentGroup.push(msg);
    }
  }
  if (currentGroup.length > 0) {
    groupedMessages.push(currentGroup);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {groupedMessages.map((group, groupIdx) => {
        const firstMsg = group[0];
        const isOwn = firstMsg.sender_id === currentUserId;

        if (firstMsg.message_type === "system") {
          return (
            <div key={groupIdx} className="flex justify-center">
              <span className="rounded-full bg-gray-100 px-4 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {firstMsg.body}
              </span>
            </div>
          );
        }

        if (firstMsg.message_type === "proposal") {
          const proposalId = firstMsg.metadata?.proposal_id as string | undefined;
          return (
            <div key={groupIdx} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
              <div className="max-w-sm w-full">
                <ProposalCard
                  message={firstMsg}
                  isOwn={isOwn}
                  onAction={onProposalAction}
                />
              </div>
            </div>
          );
        }

        return (
          <div
            key={groupIdx}
            className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}
          >
            {/* Avatar */}
            {!isOwn && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white">
                {getInitials(firstMsg.sender?.display_name ?? firstMsg.sender?.email)}
              </div>
            )}

            {/* Message bubbles */}
            <div className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
              {!isOwn && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                  {firstMsg.sender?.display_name ?? "User"}
                </span>
              )}
              {group.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "max-w-xs rounded-2xl px-4 py-2.5 text-sm lg:max-w-md",
                    isOwn
                      ? "rounded-br-sm bg-primary text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                  )}
                >
                  {msg.body}
                </div>
              ))}
              <span className="px-1 text-xs text-gray-400">
                {formatRelativeTime(firstMsg.created_at)}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
