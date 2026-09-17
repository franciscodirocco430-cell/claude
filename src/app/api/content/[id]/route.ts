import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: content, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: analysis }, { data: metrics }, { data: recommendations }, { data: ideas }] =
    await Promise.all([
      supabase
        .from("content_analysis")
        .select("*")
        .eq("content_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("content_metrics")
        .select("*")
        .eq("content_id", params.id)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("recommendations").select("*").eq("content_id", params.id),
      supabase.from("content_ideas").select("*").eq("content_id", params.id),
    ]);

  return NextResponse.json({ content, analysis, metrics, recommendations, ideas });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("content_items").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
