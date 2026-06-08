import React from "react";
import Link from "next/link";
import { FileText, DollarSign, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MilestoneList } from "@/components/shared/milestone-list";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Contract, Profile, Milestone } from "@/lib/types/database.types";

interface ContractWithDetails extends Contract {
  freelo?: Profile;
  freelier?: Profile;
  milestones?: Milestone[];
}

interface ContractCardProps {
  contract: ContractWithDetails;
  currentUserId: string;
}

const statusConfig = {
  active: { label: "Active", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  disputed: { label: "Disputed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const escrowConfig = {
  pending: { label: "Escrow Pending", color: "text-yellow-600" },
  held: { label: "Funds in Escrow", color: "text-blue-600" },
  released: { label: "Funds Released", color: "text-green-600" },
};

export function ContractCard({ contract, currentUserId }: ContractCardProps) {
  const isFreelo = contract.freelo_id === currentUserId;
  const statusInfo = statusConfig[contract.status];
  const escrowInfo = escrowConfig[contract.escrow_status];

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Contract #{contract.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(contract.created_at)}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>

        {/* Parties */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Freelancer</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {contract.freelo?.display_name ?? "Freelancer"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Client</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {contract.freelier?.display_name ?? "Client"}
            </p>
          </div>
        </div>

        {/* Financials */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-primary/5 p-3 border border-primary/10">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(contract.total_amount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Platform Fee (1%)</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {formatCurrency(contract.platform_fee)}
            </p>
          </div>
        </div>

        {/* Escrow status */}
        <div className={`mb-4 flex items-center gap-2 text-sm ${escrowInfo.color}`}>
          {contract.escrow_status === "held" ? (
            <DollarSign className="h-4 w-4" />
          ) : contract.escrow_status === "released" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          {escrowInfo.label}
        </div>

        {/* Milestones */}
        {(contract.milestones ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Milestones
            </p>
            <MilestoneList milestones={contract.milestones ?? []} readonly />
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/contracts`}>View Details</Link>
        </Button>
        {contract.status === "active" && (
          <Button variant="ghost" size="sm" asChild className="text-primary">
            <Link href={`/chat`}>Open Chat</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
