"use client";

import React, { useState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Message } from "@/lib/types/database.types";

interface MessageInputProps {
  conversationId: string;
  onMessageSent?: (message: Message) => void;
  disabled?: boolean;
}

export function MessageInput({
  conversationId,
  onMessageSent,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending || disabled) return;

    setSending(true);
    try {
      const res = await fetch("/api/moderate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          body,
          message_type: "text",
          metadata: {},
        }),
      });

      const data = await res.json();

      if (res.status === 422) {
        toast({
          type: "warning",
          title: "Message blocked",
          description: data.reason ?? "Your message contains disallowed content.",
          duration: 6000,
        });
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send message");
      }

      setText("");
      onMessageSent?.(data.message);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
          disabled={disabled || sending}
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-white dark:placeholder-gray-500"
          style={{ maxHeight: "160px" }}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || sending || disabled}
        loading={sending}
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
