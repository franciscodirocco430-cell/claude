import type { Channel } from "@/server/compliance/channels";
import { normalizeHandle, normalizePhone, normalizeUrl } from "./normalize";

export type ParsedTarget =
  | { kind: "handle"; channel: Exclude<Channel, "email">; handle: string; url: string }
  | { kind: "website"; url: string }
  | { kind: "email"; email: string };

/** Rutas de Instagram/TikTok/Facebook que no son perfiles. */
const RESERVED_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "share",
  "sharer",
  "watch",
  "groups",
  "events",
  "login",
  "profile.php",
  "video",
  "tag",
  "music",
  "discover",
]);

function firstSegment(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? decodeURIComponent(seg) : null;
}

/**
 * Interpreta lo que el usuario pega: URL de perfil, web o email.
 * IMPORTANTE: solo analiza el TEXTO de la URL. Nunca se accede al perfil
 * (prohibido scrapear redes, ver CLAUDE.md).
 */
export function parseProfileInput(input: string): ParsedTarget | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(raw)) return { kind: "email", email: raw.toLowerCase() };

  const normalized = normalizeUrl(raw);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.replace(/^(www|m|mobile|web)\./, "");

  if (host === "instagram.com" || host === "instagr.am" || host === "ig.me") {
    const segments = url.pathname.split("/").filter(Boolean);
    const seg = host === "ig.me" && segments[0] === "m" ? segments[1] : segments[0];
    const handle = seg && !RESERVED_PATHS.has(seg) ? normalizeHandle(seg) : null;
    return handle
      ? { kind: "handle", channel: "instagram", handle, url: `https://instagram.com/${handle}` }
      : null;
  }

  if (host === "tiktok.com") {
    const seg = firstSegment(url.pathname);
    const handle = seg?.startsWith("@") ? normalizeHandle(seg) : null;
    return handle
      ? { kind: "handle", channel: "tiktok", handle, url: `https://www.tiktok.com/@${handle}` }
      : null;
  }

  if (host === "facebook.com" || host === "fb.com" || host === "m.me") {
    const seg = firstSegment(url.pathname);
    if (seg === "profile.php") {
      const id = url.searchParams.get("id");
      return id && /^\d+$/.test(id)
        ? {
            kind: "handle",
            channel: "facebook",
            handle: id,
            url: `https://facebook.com/profile.php?id=${id}`,
          }
        : null;
    }
    const handle = seg && !RESERVED_PATHS.has(seg.toLowerCase()) ? normalizeHandle(seg) : null;
    return handle
      ? { kind: "handle", channel: "facebook", handle, url: `https://facebook.com/${handle}` }
      : null;
  }

  if (host === "wa.me" || host === "api.whatsapp.com") {
    const digits = host === "wa.me" ? firstSegment(url.pathname) : url.searchParams.get("phone");
    const phone = normalizePhone(digits ? `+${digits.replace(/\D/g, "")}` : null);
    return phone
      ? {
          kind: "handle",
          channel: "whatsapp",
          handle: phone,
          url: `https://wa.me/${phone.slice(1)}`,
        }
      : null;
  }

  return { kind: "website", url: normalized };
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  email: "Email",
};
