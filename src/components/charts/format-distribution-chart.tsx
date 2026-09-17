"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card } from "@/components/ui/card";

export interface FormatCount {
  format: string;
  count: number;
}

const COLORS = ["#4C7CFF", "#8B5CF6", "#34D399", "#FBBF24", "#F87171", "#60A5FA"];

export function FormatDistributionChart({ data }: { data: FormatCount[] }) {
  return (
    <Card className="h-full p-5">
      <p className="mb-4 font-display text-base font-semibold">Format distribution</p>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No content analyzed yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="format" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#151515",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
