import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { WebhookLog } from "@/lib/types/database.types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_type, payload } = body;

    if (!event_type) {
      return NextResponse.json({ error: "Missing event_type" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Log to webhooks_log
    await (serviceClient.from("webhooks_log") as unknown as any).insert({
      event_type,
      payload: payload ?? {},
    } as Omit<WebhookLog, "id" | "delivered_at">);

    // If webhook endpoint configured, forward the payload
    const webhookEndpoint = process.env.WEBHOOK_ENDPOINT;
    if (webhookEndpoint) {
      try {
        await fetch(webhookEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Freelie-Event": event_type,
          },
          body: JSON.stringify({
            event_type,
            payload,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (forwardErr) {
        console.error("Webhook forward error:", forwardErr);
        // Don't fail the request if forwarding fails
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
