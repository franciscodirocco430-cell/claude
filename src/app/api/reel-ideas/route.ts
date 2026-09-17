import { NextResponse } from "next/server";
import { generateProfileReelIdeas } from "@/lib/ai/generate-profile-reel-ideas";
import { ReelIdeasRequestSchema } from "@/lib/validations/content";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ReelIdeasRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const { ideas, model, promptVersion } = await generateProfileReelIdeas({
      niche: parsed.data.niche,
      targetAudience: parsed.data.targetAudience ?? null,
      contentTone: parsed.data.contentTone ?? null,
      contentGoals: parsed.data.contentGoals ?? null,
    });
    return NextResponse.json({ ideas, model, promptVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate reel ideas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
