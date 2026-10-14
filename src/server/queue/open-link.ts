import type { SocialChannel } from "@/server/compliance/channels";

export interface OpenTarget {
  phone: string | null;
  handles: { channel: string; handle: string | null; url: string | null }[];
}

/**
 * Link para abrir la conversación del canal. El envío lo hace SIEMPRE la
 * persona desde la app de la red: acá solo se arma el link.
 * - WhatsApp: wa.me con el mensaje prellenado.
 * - Instagram: ig.me/m/<usuario> (abre el chat) o el perfil.
 * - TikTok y Facebook: el perfil o la página.
 */
export function buildOpenUrl(
  channel: SocialChannel,
  target: OpenTarget,
  message: string,
): string | null {
  if (channel === "whatsapp") {
    const digits = target.phone?.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
  }
  const h = target.handles.find((x) => x.channel === channel);
  if (!h) return null;
  if (channel === "instagram") {
    return h.handle ? `https://ig.me/m/${encodeURIComponent(h.handle)}` : h.url;
  }
  if (channel === "tiktok") {
    return h.handle ? `https://www.tiktok.com/@${encodeURIComponent(h.handle)}` : h.url;
  }
  // Facebook: el id numérico de profile.php no sirve como usuario: va el link guardado.
  if (h.url) return h.url;
  return h.handle ? `https://www.facebook.com/${encodeURIComponent(h.handle)}` : null;
}

/** Inicio del día de hoy en una zona horaria IANA, como instante UTC. */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMs = asIfUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - offsetMs,
  );
}
