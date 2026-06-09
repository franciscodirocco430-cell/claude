import { NextResponse } from "next/server";

// V2 stub — AI Brief Assistant not yet implemented
export async function POST() {
  return NextResponse.json(
    { error: "AI Brief Assistant coming in V2", code: "NOT_IMPLEMENTED" },
    { status: 501 }
  );
}
