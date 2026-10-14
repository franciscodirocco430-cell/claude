import { describe, expect, it, vi } from "vitest";
import { ATTACHMENT_PLACEHOLDER, MetaAdapter, parseMetaWebhook } from "./meta";
import { buildMockWebhook, MOCK_SIGNATURE_HEADER, MockChannelAdapter } from "./mock";
import { channelAdaptersFromEnv } from "./registry";
import { hmacSha256Hex } from "./signature";
import { TikTokAdapter, verifyTikTokSignature } from "./tiktok";
import { ChannelSendError, inboundMessageSchema, type WebhookRequest } from "./types";

const APP_SECRET = "meta-app-secret";
const VERIFY = "verify-token-1234567890";

function post(rawBody: string, headers: Record<string, string> = {}): WebhookRequest {
  return { method: "POST", headers: new Headers(headers), query: new URLSearchParams(), rawBody };
}

function metaSigned(body: unknown) {
  const raw = JSON.stringify(body);
  return post(raw, { "x-hub-signature-256": `sha256=${hmacSha256Hex(APP_SECRET, raw)}` });
}

const meta = new MetaAdapter({ appSecret: APP_SECRET, verifyToken: VERIFY, graphApiUrl: null });

const igPayload = {
  object: "instagram",
  entry: [
    {
      id: "ig-biz-1",
      time: 1_760_000_000_000,
      messaging: [
        {
          sender: { id: "igsid-9" },
          recipient: { id: "ig-biz-1" },
          timestamp: 1_760_000_000_000,
          message: { mid: "mid.1", text: "Hola, ¿cuánto sale?" },
        },
        {
          sender: { id: "ig-biz-1" },
          recipient: { id: "igsid-9" },
          timestamp: 1_760_000_000_500,
          message: { mid: "mid.2", text: "eco", is_echo: true },
        },
        {
          sender: { id: "igsid-9" },
          recipient: { id: "ig-biz-1" },
          timestamp: 1,
          read: { mid: "x" },
        },
      ],
    },
  ],
};

const waPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "5491100000000", phone_number_id: "pn-1" },
            contacts: [{ profile: { name: "Laura" }, wa_id: "5491122334455" }],
            messages: [
              {
                from: "5491122334455",
                id: "wamid.A",
                timestamp: "1760000000",
                type: "text",
                text: { body: "Quiero info" },
              },
              { from: "5491122334455", id: "wamid.B", timestamp: "1760000001", type: "image" },
            ],
          },
        },
        {
          field: "messages",
          value: { metadata: { phone_number_id: "pn-1" }, statuses: [{ id: "wamid.X" }] },
        },
      ],
    },
  ],
};

describe("Meta", () => {
  it("responde el handshake solo con el verify token correcto", () => {
    const ok = meta.receiveWebhook({
      method: "GET",
      headers: new Headers(),
      query: new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY,
        "hub.challenge": "12345",
      }),
      rawBody: "",
    });
    expect(ok).toEqual({ kind: "challenge", body: "12345" });
    const bad = meta.receiveWebhook({
      method: "GET",
      headers: new Headers(),
      query: new URLSearchParams({
        "hub.mode": "subscribe",
        "hub.verify_token": "otro",
        "hub.challenge": "12345",
      }),
      rawBody: "",
    });
    expect(bad).toMatchObject({ kind: "rejected", status: 403 });
  });

  it("rechaza webhooks sin firma, con firma de otro secreto o con el cuerpo alterado", () => {
    const raw = JSON.stringify(igPayload);
    expect(meta.receiveWebhook(post(raw))).toMatchObject({ status: 401 });
    expect(
      meta.receiveWebhook(
        post(raw, { "x-hub-signature-256": `sha256=${hmacSha256Hex("otro", raw)}` }),
      ),
    ).toMatchObject({ status: 401 });
    const signed = metaSigned(igPayload);
    expect(meta.receiveWebhook({ ...signed, rawBody: raw.replace("Hola", "Chau") })).toMatchObject({
      status: 401,
    });
  });

  it("normaliza Instagram ignorando ecos y lecturas", () => {
    const result = meta.receiveWebhook(metaSigned(igPayload));
    expect(result.kind).toBe("messages");
    if (result.kind !== "messages") return;
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      provider: "meta",
      channel: "instagram",
      mock: false,
      accountExternalId: "ig-biz-1",
      senderId: "igsid-9",
      externalMessageId: "mid.1",
      text: "Hola, ¿cuánto sale?",
    });
    expect(inboundMessageSchema.safeParse(result.messages[0]).success).toBe(true);
  });

  it("Messenger (object=page) se normaliza como facebook", () => {
    const [msg] = parseMetaWebhook({ ...igPayload, object: "page" });
    expect(msg?.channel).toBe("facebook");
  });

  it("normaliza WhatsApp con nombre y teléfono, adjuntos con marcador y sin estados", () => {
    const list = parseMetaWebhook(waPayload);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      channel: "whatsapp",
      accountExternalId: "pn-1",
      senderId: "5491122334455",
      senderPhone: "+5491122334455",
      senderName: "Laura",
      text: "Quiero info",
      sentAt: new Date(1_760_000_000_000).toISOString(),
    });
    expect(list[1]?.text).toBe(ATTACHMENT_PLACEHOLDER);
  });

  it("ignora payloads de otros objetos", () => {
    expect(parseMetaWebhook({ object: "user", entry: [] })).toEqual([]);
    expect(parseMetaWebhook("basura")).toEqual([]);
  });

  it("envía por Instagram y WhatsApp con el formato de la Graph API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ recipient_id: "igsid-9", message_id: "m-out" }))
      .mockResolvedValueOnce(Response.json({ messages: [{ id: "wamid.out" }] }));
    const adapter = new MetaAdapter(
      { appSecret: APP_SECRET, verifyToken: VERIFY, graphApiUrl: "https://graph.example/v1/" },
      fetchMock,
    );
    const ig = await adapter.sendMessage(
      {
        channel: "instagram",
        accountExternalId: "ig-biz-1",
        accessToken: "tok",
        recipientId: "igsid-9",
      },
      "Hola!",
    );
    expect(ig.externalMessageId).toBe("m-out");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://graph.example/v1/me/messages");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: "igsid-9" },
      messaging_type: "RESPONSE",
      message: { text: "Hola!" },
    });

    const wa = await adapter.sendMessage(
      { channel: "whatsapp", accountExternalId: "pn-1", accessToken: "tok", recipientId: "549112" },
      "Hola WA",
    );
    expect(wa.externalMessageId).toBe("wamid.out");
    const [waUrl, waInit] = fetchMock.mock.calls[1]!;
    expect(waUrl).toBe("https://graph.example/v1/pn-1/messages");
    expect(JSON.parse(waInit.body)).toMatchObject({
      messaging_product: "whatsapp",
      to: "549112",
      type: "text",
      text: { body: "Hola WA" },
    });
  });

  it("clasifica errores de envío como reintentables o no", async () => {
    const make = (status: number) =>
      new MetaAdapter(
        { appSecret: APP_SECRET, verifyToken: VERIFY, graphApiUrl: "https://graph.example/v1" },
        vi.fn().mockResolvedValue(Response.json({ error: { message: "x" } }, { status })),
      );
    const target = {
      channel: "instagram" as const,
      accountExternalId: "a",
      accessToken: "t",
      recipientId: "r",
    };
    await expect(make(500).sendMessage(target, "x")).rejects.toMatchObject({ retryable: true });
    await expect(make(429).sendMessage(target, "x")).rejects.toMatchObject({ retryable: true });
    await expect(make(400).sendMessage(target, "x")).rejects.toMatchObject({ retryable: false });
    await expect(meta.sendMessage(target, "x")).rejects.toBeInstanceOf(ChannelSendError);
  });

  it("la conexión real queda no disponible hasta tener la app aprobada", async () => {
    expect(await meta.connect()).toMatchObject({ kind: "unavailable" });
  });
});

describe("TikTok", () => {
  const secret = "tiktok-secret";
  const now = new Date("2026-10-14T12:00:00Z");
  const t = String(Math.floor(now.getTime() / 1000));
  const body = '{"event":"x"}';
  const sig = hmacSha256Hex(secret, `${t}.${body}`);

  it("verifica la firma con timestamp y rechaza firmas viejas o alteradas", () => {
    expect(verifyTikTokSignature(`t=${t},s=${sig}`, secret, body, now)).toBe(true);
    expect(verifyTikTokSignature(`t=${t},s=${sig}`, secret, body + " ", now)).toBe(false);
    expect(verifyTikTokSignature(`t=${t},s=${sig}`, "otro", body, now)).toBe(false);
    const later = new Date(now.getTime() + 10 * 60_000);
    expect(verifyTikTokSignature(`t=${t},s=${sig}`, secret, body, later)).toBe(false);
    expect(verifyTikTokSignature(null, secret, body, now)).toBe(false);
    expect(verifyTikTokSignature("basura", secret, body, now)).toBe(false);
  });

  it("no inventa el parseo: firma válida → 501, firma inválida → 401", () => {
    const adapter = new TikTokAdapter({ clientSecret: secret });
    const nowT = String(Math.floor(Date.now() / 1000));
    const valid = hmacSha256Hex(secret, `${nowT}.${body}`);
    expect(
      adapter.receiveWebhook(post(body, { "tiktok-signature": `t=${nowT},s=${valid}` })),
    ).toMatchObject({ kind: "rejected", status: 501 });
    expect(adapter.receiveWebhook(post(body))).toMatchObject({ status: 401 });
  });

  it("aplica la ventana de TikTok: 48 h y máximo 10 mensajes", () => {
    const adapter = new TikTokAdapter({ clientSecret: secret });
    const base = { channel: "tiktok" as const, lastInboundAt: now };
    expect(
      adapter.getWindowStatus({
        ...base,
        businessMessagesSinceInbound: 9,
        now: new Date(now.getTime() + 47 * 3_600_000),
      }),
    ).toMatchObject({ kind: "open", remainingMessages: 1 });
    expect(
      adapter.getWindowStatus({ ...base, businessMessagesSinceInbound: 10, now }),
    ).toMatchObject({ kind: "closed", reason: "message_cap" });
    expect(
      adapter.getWindowStatus({
        ...base,
        businessMessagesSinceInbound: 0,
        now: new Date(now.getTime() + 48 * 3_600_000),
      }),
    ).toMatchObject({ kind: "closed", reason: "expired" });
  });
});

describe("Mock", () => {
  const secret = "mock-secret-1234567890";
  const adapter = new MockChannelAdapter(secret);
  const payload = {
    channel: "whatsapp" as const,
    accountId: "mock-whatsapp-1",
    from: { id: "u1", phone: "+5491122334455", name: "Ana" },
    messageId: "m1",
    text: "Hola",
    timestamp: "2026-10-14T12:00:00.000Z",
  };

  it("acepta su propio webhook firmado y lo normaliza", () => {
    const { rawBody, signature } = buildMockWebhook(payload, secret);
    const result = adapter.receiveWebhook(post(rawBody, { [MOCK_SIGNATURE_HEADER]: signature }));
    expect(result).toMatchObject({
      kind: "messages",
      messages: [
        {
          provider: "meta",
          channel: "whatsapp",
          mock: true,
          senderPhone: "+5491122334455",
          externalMessageId: "m1",
        },
      ],
    });
  });

  it("rechaza firmas de otro secreto y payloads inválidos", () => {
    const { rawBody, signature } = buildMockWebhook(payload, "otro-secreto-123456");
    expect(
      adapter.receiveWebhook(post(rawBody, { [MOCK_SIGNATURE_HEADER]: signature })),
    ).toMatchObject({
      status: 401,
    });
    const bad = buildMockWebhook({ ...payload, text: "" }, secret);
    expect(
      adapter.receiveWebhook(post(bad.rawBody, { [MOCK_SIGNATURE_HEADER]: bad.signature })),
    ).toMatchObject({ status: 400 });
  });
});

describe("registry", () => {
  const base = {
    NODE_ENV: "development" as const,
    APP_URL: "https://app.example.com",
    CHANNELS_MOCK: "false" as const,
    META_APP_SECRET: undefined,
    META_WEBHOOK_VERIFY_TOKEN: undefined,
    META_GRAPH_API_URL: undefined,
    TIKTOK_CLIENT_SECRET: undefined,
    CHANNELS_MOCK_SECRET: undefined,
  };

  it("sin credenciales no hay adapters", () => {
    expect(channelAdaptersFromEnv(base)).toEqual({ meta: null, tiktok: null, mock: null });
  });

  it("el mock está prohibido en producción y exige secreto", () => {
    expect(() =>
      channelAdaptersFromEnv({
        ...base,
        NODE_ENV: "production",
        CHANNELS_MOCK: "true",
        CHANNELS_MOCK_SECRET: "x".repeat(16),
      }),
    ).toThrow(/producción/);
    expect(() => channelAdaptersFromEnv({ ...base, CHANNELS_MOCK: "true" })).toThrow(/SECRET/);
    // `next start` local (e2e): producción pero servida desde localhost.
    const local = channelAdaptersFromEnv({
      ...base,
      NODE_ENV: "production",
      APP_URL: "http://localhost:3100",
      CHANNELS_MOCK: "true",
      CHANNELS_MOCK_SECRET: "x".repeat(16),
    });
    expect(local.mock).toBeInstanceOf(MockChannelAdapter);
  });

  it("Meta necesita secreto y verify token", () => {
    const adapters = channelAdaptersFromEnv({
      ...base,
      META_APP_SECRET: "s",
      META_WEBHOOK_VERIFY_TOKEN: VERIFY,
    });
    expect(adapters.meta).toBeInstanceOf(MetaAdapter);
    expect(adapters.tiktok).toBeNull();
  });
});
