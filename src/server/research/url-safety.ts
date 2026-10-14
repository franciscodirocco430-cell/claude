import { isIP } from "node:net";

/**
 * Dominios de redes sociales y mensajería: PROHIBIDO acceder (ver CLAUDE.md).
 * La investigación solo usa sitios web de negocios.
 */
const FORBIDDEN_DOMAINS = [
  "instagram.com",
  "instagr.am",
  "ig.me",
  "facebook.com",
  "fb.com",
  "fb.me",
  "m.me",
  "messenger.com",
  "tiktok.com",
  "whatsapp.com",
  "wa.me",
  "threads.net",
  "x.com",
  "twitter.com",
  "linkedin.com",
];

export function isForbiddenSocialHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return FORBIDDEN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** IPs a las que nunca hay que conectarse desde el servidor (SSRF). */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
  }
  return true;
}
