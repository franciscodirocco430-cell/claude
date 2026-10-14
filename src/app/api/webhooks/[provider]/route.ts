import { NextResponse, type NextRequest } from "next/server";
import { enqueueInboundMessages } from "@/server/channels/inbound";
import { getChannelAdapters } from "@/server/channels/env";
import { adapterForWebhook } from "@/server/channels/registry";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Los webhooks de mensajería son chicos; nada legítimo pesa más que esto. */
const MAX_BODY_BYTES = 1024 * 1024;

async function handle(req: NextRequest, provider: string, method: "GET" | "POST") {
  const adapter = adapterForWebhook(getChannelAdapters(), provider);
  if (!adapter) return new NextResponse(null, { status: 404 });

  let rawBody = "";
  if (method === "POST") {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    rawBody = await req.text();
    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  }

  const result = adapter.receiveWebhook({
    method,
    headers: req.headers,
    query: req.nextUrl.searchParams,
    rawBody,
  });
  switch (result.kind) {
    case "challenge":
      return new NextResponse(result.body, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    case "rejected":
      return new NextResponse(null, { status: result.status });
    case "messages":
      // Solo se encola: el worker asocia y guarda. Responder rápido evita reintentos.
      await enqueueInboundMessages(getDb(), result.messages);
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return handle(req, (await ctx.params).provider, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  return handle(req, (await ctx.params).provider, "POST");
}
