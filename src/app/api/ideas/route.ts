import { NextResponse } from "next/server";
import { generateContentIdeas } from "@/lib/ai/generate-content-ideas";
import { RegenerateIdeasRequestSchema } from "@/lib/validations/content";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RegenerateIdeasRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { ideas, model, promptVersion } = await generateContentIdeas({
      title: parsed.data.title,
      contentType: parsed.data.contentType,
      platform: parsed.data.platform,
      topic: parsed.data.topic ?? null,
      summary: parsed.data.summary,
    });
    return NextResponse.json({ ideas, model, promptVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate ideas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
