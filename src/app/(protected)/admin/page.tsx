import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Profile, WebhookLog } from "@/lib/types/database.types";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Fetch all profiles (admin view)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100) as unknown as { data: Profile[] | null; error: unknown };

  const { data: webhookLogs } = await supabase
    .from("webhooks_log")
    .select("*")
    .order("delivered_at", { ascending: false })
    .limit(50) as unknown as { data: WebhookLog[] | null; error: unknown };

  const stats = {
    totalUsers: profiles?.length ?? 0,
    freelos: profiles?.filter((p) => p.role === "freelo").length ?? 0,
    freeliers: profiles?.filter((p) => p.role === "freelier").length ?? 0,
    proUsers: profiles?.filter((p) => p.subscription_tier !== "free").length ?? 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Read-only platform overview
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Users", value: stats.totalUsers },
          { label: "Freelancers", value: stats.freelos },
          { label: "Clients", value: stats.freeliers },
          { label: "Paid Users", value: stats.proUsers },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-3xl font-bold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
            Users
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {["Name", "Email", "Role", "Tier", "XP", "Onboarded", "Joined"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(profiles ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {p.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {p.email}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-gray-500 dark:text-gray-400">
                    {p.role}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        p.subscription_tier === "elite"
                          ? "bg-purple-100 text-purple-700"
                          : p.subscription_tier === "pro"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.subscription_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-primary">{p.xp_score}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {p.onboarding_complete ? "✓" : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Webhooks log */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
            Webhook Log
          </h2>
        </div>
        {!webhookLogs || webhookLogs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No webhook events yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {["Event Type", "Payload Preview", "Delivered At"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {webhookLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {log.event_type}
                      </code>
                    </td>
                    <td className="px-4 py-3 max-w-xs text-xs text-gray-500 dark:text-gray-400 truncate">
                      {JSON.stringify(log.payload).slice(0, 80)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(log.delivered_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
