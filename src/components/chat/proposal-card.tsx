"use client";

import React, { useState } from "react";
import { FileText, DollarSign, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MilestoneList } from "@/components/shared/milestone-list";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { Message } from "@/lib/types/database.types";

interface ProposalCardProps {
  message: Message;
  isOwn: boolean;
  onAction?: (proposalId: string, action: "accept" | "reject") => void;
}

export function ProposalCard({ message, isOwn, onAction }: ProposalCardProps) {
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const { toast } = useToast();

  const metadata = message.metadata as {
    proposal_id?: string;
    amount?: number;
    platform_fee?: number;
    milestones?: Array<{ title: string; amount: number; due_date: string; status: "pending" | "in_progress" | "completed" }>;
    deliverables?: string[];
    status?: string;
  };

  const { proposal_id, amount, platform_fee, milestones = [], deliverables = [], status } = metadata;

  const handleAction = async (action: "accept" | "reject") => {
    if (!proposal_id || !onAction) return;
    setLoading(action);
    try {
      await onAction(proposal_id, action);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {isOwn ? "Your Proposal" : "Proposal Received"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(message.created_at)}
            </p>
          </div>
          {status && status !== "pending" && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                status === "accepted"
                  ? "bg-green-100 text-green-700"
                  : status === "rejected"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {status}
            </span>
          )}
        </div>

        {/* Amount */}
        {amount && (
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(amount)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                + {formatCurrency(platform_fee ?? amount * 0.01)} platform fee (1%)
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-gray-900 dark:text-white">
                Total: {formatCurrency(amount + (platform_fee ?? amount * 0.01))}
              </p>
            </div>
          </div>
        )}

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              Deliverables
            </p>
            <ul className="space-y-1">
              {deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              Milestones
            </p>
            <MilestoneList milestones={milestones} readonly />
          </div>
        )}
      </CardContent>

      {!isOwn && (!status || status === "pending") && (
        <CardFooter className="gap-2 border-t border-primary/10 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => handleAction("reject")}
            loading={loading === "reject"}
            disabled={!!loading}
          >
            <XCircle className="h-4 w-4" />
            Decline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:bg-primary/10"
            disabled={!!loading}
          >
            <RefreshCw className="h-4 w-4" />
            Counter
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => handleAction("accept")}
            loading={loading === "accept"}
            disabled={!!loading}
          >
            <CheckCircle className="h-4 w-4" />
            Accept
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
