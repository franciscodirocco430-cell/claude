import React from "react";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContractCard } from "@/components/contracts/contract-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Contract, Profile } from "@/lib/types/database.types";

export const metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .or(`freelo_id.eq.${user.id},freelier_id.eq.${user.id}`)
    .order("created_at", { ascending: false }) as unknown as { data: Contract[] | null; error: unknown };

  const contractsWithParties = await Promise.all(
    (contracts ?? []).map(async (contract) => {
      const [{ data: freelo }, { data: freelier }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", contract.freelo_id).single() as unknown as { data: Profile | null; error: unknown },
        supabase.from("profiles").select("*").eq("id", contract.freelier_id).single() as unknown as { data: Profile | null; error: unknown },
      ]);
      return { ...contract, freelo: freelo ?? undefined, freelier: freelier ?? undefined };
    })
  );

  const active = contractsWithParties.filter((c) => c.status === "active");
  const completed = contractsWithParties.filter((c) => c.status === "completed");
  const other = contractsWithParties.filter(
    (c) => c.status !== "active" && c.status !== "completed"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
          Contracts
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {contracts?.length ?? 0} total contracts
        </p>
      </div>

      {contractsWithParties.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts yet"
          description="Accept a proposal to create your first contract."
          cta={{ label: "Browse Projects", href: "/feed" }}
        />
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            {other.length > 0 && (
              <TabsTrigger value="other">Other ({other.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="active">
            {active.length === 0 ? (
              <EmptyState icon={FileText} title="No active contracts" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {active.map((c) => (
                  <ContractCard key={c.id} contract={c} currentUserId={user.id} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completed.length === 0 ? (
              <EmptyState icon={FileText} title="No completed contracts" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {completed.map((c) => (
                  <ContractCard key={c.id} contract={c} currentUserId={user.id} />
                ))}
              </div>
            )}
          </TabsContent>

          {other.length > 0 && (
            <TabsContent value="other">
              <div className="grid gap-4 sm:grid-cols-2">
                {other.map((c) => (
                  <ContractCard key={c.id} contract={c} currentUserId={user.id} />
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
