import { NextResponse } from "next/server";
import { regenerateRecommendations } from "@/lib/ai/recommend-content";
import { RegenerateRecommendationsRequestSchema } from "@/lib/validations/content";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RegenerateRecommendationsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { recommendations, model, promptVersion } = await regenerateRecommendations(parsed.data);
    return NextResponse.json({ recommendations, model, promptVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate recommendations";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
