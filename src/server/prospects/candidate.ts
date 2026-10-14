import type { SocialChannel } from "@/server/compliance/channels";
import {
  normalizeEmail,
  normalizeHandle,
  normalizePhone,
  normalizeUrl,
  websiteDomain,
} from "./normalize";
import { parseProfileInput } from "./profile-url";

export interface CandidateHandle {
  channel: Exclude<SocialChannel, "whatsapp">;
  handle: string;
  url: string | null;
}

/** Prospecto normalizado, listo para deduplicar e insertar. */
export interface ProspectCandidate {
  fullName: string | null;
  company: string | null;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  handles: CandidateHandle[];
  whatsappOptInAt: Date | null;
}

/** Campos crudos (de CSV, formulario o fuente pública) antes de normalizar. */
export interface RawProspect {
  fullName?: string;
  company?: string;
  industry?: string;
  website?: string;
  email?: string;
  phone?: string;
  notes?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  whatsapp?: string;
  whatsappOptIn?: string;
  whatsappOptInDate?: string;
}

export type CandidateResult =
  | { ok: true; candidate: ProspectCandidate; warnings: string[] }
  | { ok: false; error: string; warnings: string[] };

const text = (v: string | undefined, max = 500) => {
  const t = (v ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};

const TRUTHY = new Set(["si", "sí", "s", "yes", "y", "true", "1", "x", "ok"]);

/** Fecha ISO (2026-03-01) o argentina (01/03/2026). Nunca a futuro. */
export function parseConsentDate(input: string | undefined, now = new Date()): Date | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  let date: Date | null = null;
  const ar = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(raw);
  if (ar) {
    const [, d, m, y] = ar;
    date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (date.getUTCDate() !== Number(d)) return null;
  } else if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    date = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
  }
  if (!date || Number.isNaN(date.getTime()) || date.getTime() > now.getTime()) return null;
  return date;
}

function socialHandle(
  channel: CandidateHandle["channel"],
  value: string | undefined,
): CandidateHandle | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = parseProfileInput(raw);
  if (parsed?.kind === "handle" && parsed.channel === channel) {
    return { channel, handle: parsed.handle, url: parsed.url };
  }
  const handle = normalizeHandle(raw);
  return handle ? { channel, handle, url: null } : null;
}

/**
 * Normaliza y valida un prospecto. Para ser útil necesita al menos una vía de
 * contacto o investigación: email, teléfono, usuario en una red o sitio web.
 */
export function toCandidate(raw: RawProspect, now = new Date()): CandidateResult {
  const warnings: string[] = [];

  const email = normalizeEmail(raw.email);
  if (raw.email?.trim() && !email) warnings.push(`Email inválido ignorado: "${raw.email.trim()}"`);

  const phoneInput = raw.phone?.trim() || raw.whatsapp?.trim();
  let phone = normalizePhone(phoneInput);
  if (!phone && raw.whatsapp?.trim()) {
    const parsed = parseProfileInput(raw.whatsapp);
    if (parsed?.kind === "handle" && parsed.channel === "whatsapp") phone = parsed.handle;
  }
  if (phoneInput && !phone) warnings.push(`Teléfono inválido ignorado: "${phoneInput}"`);

  const website = normalizeUrl(raw.website);
  if (raw.website?.trim() && !website)
    warnings.push(`Web inválida ignorada: "${raw.website.trim()}"`);

  const handles: CandidateHandle[] = [];
  for (const channel of ["instagram", "tiktok", "facebook"] as const) {
    const value = raw[channel];
    const h = socialHandle(channel, value);
    if (h) handles.push(h);
    else if (value?.trim())
      warnings.push(`Usuario de ${channel} inválido ignorado: "${value.trim()}"`);
  }

  // El opt-in de WhatsApp solo vale con fecha: sin fecha no hay consentimiento registrado.
  let whatsappOptInAt: Date | null = null;
  if (TRUTHY.has((raw.whatsappOptIn ?? "").trim().toLowerCase())) {
    whatsappOptInAt = parseConsentDate(raw.whatsappOptInDate, now);
    if (!whatsappOptInAt) {
      warnings.push("Opt-in de WhatsApp sin fecha válida: se cargó sin consentimiento.");
    } else if (!phone) {
      whatsappOptInAt = null;
      warnings.push("Opt-in de WhatsApp sin teléfono válido: se cargó sin consentimiento.");
    }
  }

  const candidate: ProspectCandidate = {
    fullName: text(raw.fullName, 200),
    company: text(raw.company, 200),
    industry: text(raw.industry, 200),
    website,
    email,
    phone,
    notes: text(raw.notes, 2000),
    handles,
    whatsappOptInAt,
  };

  if (!email && !phone && !website && handles.length === 0) {
    return {
      ok: false,
      error: "Sin email, teléfono, usuario de red ni web válidos.",
      warnings,
    };
  }
  return { ok: true, candidate, warnings };
}

/** Claves de deduplicación: si dos prospectos comparten alguna, son el mismo. */
export function dedupeKeys(c: ProspectCandidate): string[] {
  const keys: string[] = [];
  if (c.email) keys.push(`email:${c.email}`);
  if (c.phone) keys.push(`phone:${c.phone}`);
  const domain = websiteDomain(c.website);
  if (domain) keys.push(`domain:${domain}`);
  for (const h of c.handles) keys.push(`handle:${h.channel}:${h.handle}`);
  return keys;
}
