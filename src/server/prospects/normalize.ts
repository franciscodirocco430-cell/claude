import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "AR";

/** Email en minúsculas y sin espacios; null si no parece un email. */
export function normalizeEmail(input: string | null | undefined): string | null {
  const email = (input ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Teléfono en E.164 (+5491123456789); null si no es válido. */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const phone = parsePhoneNumberFromString(raw, defaultCountry);
  return phone?.isValid() ? phone.number : null;
}

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|igshid$|ref$|si$)/i;

/** Normaliza una URL http(s): agrega https, host en minúsculas, sin tracking ni barra final. */
export function normalizeUrl(input: string | null | undefined): string | null {
  let raw = (input ?? "").trim();
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  const out = url.toString();
  return out.endsWith("/") && url.pathname === "/" && !url.search ? out.slice(0, -1) : out;
}

/**
 * Dominios compartidos por miles de negocios (agregadores de links, hostings
 * gratuitos): no sirven para detectar duplicados.
 */
const SHARED_DOMAINS = new Set([
  "linktr.ee",
  "beacons.ai",
  "bio.link",
  "linkin.bio",
  "bit.ly",
  "wa.me",
  "google.com",
  "sites.google.com",
  "business.site",
  "wixsite.com",
  "blogspot.com",
  "mercadolibre.com.ar",
  "mercadoshops.com.ar",
]);

/** Dominio registrable aproximado ("www.clinica.com.ar" → "clinica.com.ar"). */
export function websiteDomain(url: string | null | undefined): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const host = new URL(normalized).hostname.replace(/^www\./, "");
  if ([...SHARED_DOMAINS].some((d) => host === d || host.endsWith(`.${d}`))) return null;
  return host;
}

/** Handle sin @, en minúsculas y sin espacios. */
export function normalizeHandle(input: string | null | undefined): string | null {
  const handle = (input ?? "").trim().replace(/^@+/, "").toLowerCase();
  return handle && /^[a-z0-9._-]{1,100}$/.test(handle) ? handle : null;
}
