import type { channel } from "@/db/schema/enums";

export type Channel = (typeof channel.enumValues)[number];

export type SocialChannel = Exclude<Channel, "email">;

export const SOCIAL_CHANNELS = [
  "instagram",
  "facebook",
  "tiktok",
  "whatsapp",
] as const satisfies readonly SocialChannel[];

export function isSocialChannel(c: Channel): c is SocialChannel {
  return c !== "email";
}
