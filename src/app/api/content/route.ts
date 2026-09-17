import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateContentSchema } from "@/lib/validations/content";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const input = parsed.data;

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      user_id: user.id,
      title: input.title,
      content_type: input.contentType,
      platform: input.platform,
      goal: input.goal ?? null,
      topic: input.topic ?? null,
      campaign_id: input.campaignId ?? null,
      source_kind: input.sourceKind,
      raw_text: input.rawText ?? null,
      source_url: input.sourceUrl ?? null,
      storage_url: input.sourceKind === "file" ? input.storagePath ?? null : null,
      duration_seconds: input.durationSeconds ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (input.storagePath) {
    await supabase.from("content_assets").insert({
      content_id: data.id,
      asset_type: "original",
      storage_path: input.storagePath,
      metadata_json: {
        mimeType: input.mimeType,
        sizeBytes: input.fileSizeBytes,
      },
    });
  }

  return NextResponse.json({ content: data });
}
