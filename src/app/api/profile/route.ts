import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileUpdateSchema } from "@/lib/validations/content";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const input = parsed.data;

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name: input.fullName ?? null,
      company: input.company ?? null,
      niche: input.niche ?? null,
      target_audience: input.targetAudience ?? null,
      content_tone: input.contentTone ?? null,
      content_goals: input.contentGoals ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}
