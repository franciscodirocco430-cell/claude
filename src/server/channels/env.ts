import "server-only";
import { getServerEnv } from "@/lib/env";
import { channelAdaptersFromEnv, type ChannelAdapters } from "./registry";

let cached: ChannelAdapters | undefined;

/** Adapters del servidor Next (una instancia por proceso). */
export function getChannelAdapters(): ChannelAdapters {
  cached ??= channelAdaptersFromEnv(getServerEnv());
  return cached;
}
