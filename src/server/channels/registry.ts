import type { ServerEnv } from "@/lib/env";
import type { SocialChannel } from "@/server/compliance/channels";
import { MetaAdapter } from "./meta";
import { MockChannelAdapter } from "./mock";
import { TikTokAdapter } from "./tiktok";
import { CHANNEL_PROVIDER, type ChannelAdapter } from "./types";

export interface ChannelAdapters {
  meta: MetaAdapter | null;
  tiktok: TikTokAdapter | null;
  mock: MockChannelAdapter | null;
}

type ChannelEnv = Pick<
  ServerEnv,
  | "NODE_ENV"
  | "APP_URL"
  | "META_APP_SECRET"
  | "META_WEBHOOK_VERIFY_TOKEN"
  | "META_GRAPH_API_URL"
  | "TIKTOK_CLIENT_SECRET"
  | "CHANNELS_MOCK"
  | "CHANNELS_MOCK_SECRET"
>;

function isLocalUrl(url: string) {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Arma los adapters habilitados según el entorno. Un adapter sin credenciales no existe. */
export function channelAdaptersFromEnv(env: ChannelEnv): ChannelAdapters {
  let mock: MockChannelAdapter | null = null;
  if (env.CHANNELS_MOCK === "true") {
    // `next start` corre con NODE_ENV=production también en local y en e2e: se permite
    // solo si la app se sirve desde localhost (un deploy real nunca lo hace).
    if (env.NODE_ENV === "production" && !isLocalUrl(env.APP_URL)) {
      throw new Error("CHANNELS_MOCK=true no está permitido en producción.");
    }
    if (!env.CHANNELS_MOCK_SECRET)
      throw new Error("CHANNELS_MOCK=true requiere CHANNELS_MOCK_SECRET.");
    mock = new MockChannelAdapter(env.CHANNELS_MOCK_SECRET);
  }
  return {
    meta:
      env.META_APP_SECRET && env.META_WEBHOOK_VERIFY_TOKEN
        ? new MetaAdapter({
            appSecret: env.META_APP_SECRET,
            verifyToken: env.META_WEBHOOK_VERIFY_TOKEN,
            graphApiUrl: env.META_GRAPH_API_URL ?? null,
          })
        : null,
    tiktok: env.TIKTOK_CLIENT_SECRET
      ? new TikTokAdapter({ clientSecret: env.TIKTOK_CLIENT_SECRET })
      : null,
    mock,
  };
}

/** Adapter del endpoint `/api/webhooks/[provider]`. */
export function adapterForWebhook(
  adapters: ChannelAdapters,
  provider: string,
): ChannelAdapter | null {
  if (provider === "meta") return adapters.meta;
  if (provider === "tiktok") return adapters.tiktok;
  if (provider === "mock") return adapters.mock;
  return null;
}

/** Adapter con el que se envía desde una cuenta conectada. */
export function adapterForAccount(
  adapters: ChannelAdapters,
  account: { channel: SocialChannel; mock: boolean },
): ChannelAdapter | null {
  if (account.mock) return adapters.mock;
  return CHANNEL_PROVIDER[account.channel] === "meta" ? adapters.meta : adapters.tiktok;
}
