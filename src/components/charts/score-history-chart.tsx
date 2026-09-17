"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";

export interface ScorePoint {
  date: string;
  score: number;
}

export function ScoreHistoryChart({ data }: { data: ScorePoint[] }) {
  return (
    <Card className="h-full p-5">
      <p className="mb-4 font-display text-base font-semibold">Score evolution</p>
      {data.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Analyze more content to see your score trend over time.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#151515",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="score" stroke="#4C7CFF" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
