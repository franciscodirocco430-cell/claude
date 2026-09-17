import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayoutSchema } from "@/lib/validations/content";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("dashboard_layouts")
    .select("layout_json")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ layout: data?.layout_json ?? null });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DashboardLayoutSchema.safeParse(body?.layout);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid layout" }, { status: 400 });
  }

  const { error } = await supabase
    .from("dashboard_layouts")
    .upsert({ user_id: user.id, layout_json: parsed.data, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
