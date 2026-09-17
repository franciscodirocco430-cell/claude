import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MetricsSchema } from "@/lib/validations/content";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = MetricsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid metrics", issues: parsed.error.issues }, { status: 400 });
  }

  const m = parsed.data;
  const ctr = m.clicks && m.impressions ? (m.clicks / m.impressions) * 100 : undefined;

  const { data, error } = await supabase
    .from("content_metrics")
    .insert({
      content_id: params.id,
      views: m.views ?? null,
      reach: m.reach ?? null,
      impressions: m.impressions ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: m.shares ?? null,
      saves: m.saves ?? null,
      watch_time_seconds: m.watchTimeSeconds ?? null,
      average_watch_time_seconds: m.averageWatchTimeSeconds ?? null,
      completion_rate: m.completionRate ?? null,
      clicks: m.clicks ?? null,
      ctr: ctr ?? null,
      leads: m.leads ?? null,
      conversions: m.conversions ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ metrics: data });
}
