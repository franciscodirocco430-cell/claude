import Papa from "papaparse";
import type { RawProspect } from "./candidate";

export const CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 5000;

export const CSV_FIELDS = [
  "fullName",
  "company",
  "industry",
  "website",
  "email",
  "phone",
  "instagram",
  "tiktok",
  "facebook",
  "whatsapp",
  "whatsappOptIn",
  "whatsappOptInDate",
  "notes",
] as const satisfies readonly (keyof RawProspect)[];

export type CsvField = (typeof CSV_FIELDS)[number];
/** Para cada columna del CSV: a qué campo va, o null si se ignora. */
export type ColumnMapping = (CsvField | null)[];

export const CSV_FIELD_LABELS: Record<CsvField, string> = {
  fullName: "Nombre",
  company: "Empresa",
  industry: "Rubro",
  website: "Sitio web",
  email: "Email",
  phone: "Teléfono",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  whatsappOptIn: "Consentimiento WhatsApp (sí/no)",
  whatsappOptInDate: "Fecha del consentimiento",
  notes: "Notas",
};

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export class CsvError extends Error {}

export function parseCsv(text: string): ParsedCsv {
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) {
    throw new CsvError("El archivo supera los 2 MB.");
  }
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
  });
  const [headerRow, ...rows] = result.data;
  if (!headerRow || headerRow.every((h) => !h.trim())) {
    throw new CsvError("El archivo está vacío o no tiene encabezados.");
  }
  if (rows.length === 0) throw new CsvError("El archivo no tiene filas de datos.");
  if (rows.length > CSV_MAX_ROWS) {
    throw new CsvError(`El archivo tiene ${rows.length} filas; el máximo es ${CSV_MAX_ROWS}.`);
  }
  return { headers: headerRow.map((h) => h.trim()), rows };
}

const SYNONYMS: Record<CsvField, string[]> = {
  fullName: ["nombre", "nombre completo", "name", "full name", "contacto", "persona"],
  company: ["empresa", "negocio", "compania", "company", "business", "razon social", "clinica"],
  industry: ["rubro", "industria", "sector", "categoria", "industry", "category"],
  website: ["web", "sitio", "sitio web", "pagina", "website", "url", "site"],
  email: ["email", "e-mail", "mail", "correo", "correo electronico"],
  phone: ["telefono", "tel", "celular", "movil", "phone", "mobile", "numero"],
  instagram: ["instagram", "ig", "insta"],
  tiktok: ["tiktok", "tik tok"],
  facebook: ["facebook", "fb"],
  whatsapp: ["whatsapp", "wa", "wpp", "whats"],
  whatsappOptIn: [
    "opt-in whatsapp",
    "optin whatsapp",
    "consentimiento whatsapp",
    "whatsapp opt-in",
    "opt in",
  ],
  whatsappOptInDate: ["fecha opt-in", "fecha consentimiento", "fecha optin", "opt-in date"],
  notes: ["notas", "nota", "observaciones", "comentarios", "notes"],
};

const simplify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Sugiere un mapeo por nombre de columna (español e inglés). Cada campo se usa una sola vez. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const used = new Set<CsvField>();
  // Primero coincidencias exactas, después las que contienen el sinónimo.
  const exact = headers.map((h) => {
    const s = simplify(h);
    const field = CSV_FIELDS.find((f) => !used.has(f) && SYNONYMS[f].includes(s));
    if (field) used.add(field);
    return field ?? null;
  });
  return exact.map((field, i) => {
    if (field) return field;
    const s = simplify(headers[i] ?? "");
    const loose = CSV_FIELDS.find(
      (f) => !used.has(f) && SYNONYMS[f].some((syn) => syn.length > 2 && s.includes(syn)),
    );
    if (loose) used.add(loose);
    return loose ?? null;
  });
}

export function validateMapping(mapping: ColumnMapping, columnCount: number): string | null {
  if (mapping.length !== columnCount) return "El mapeo no coincide con las columnas del archivo.";
  const fields = mapping.filter((m): m is CsvField => m !== null);
  if (fields.length === 0) return "Elegí al menos una columna para importar.";
  const dup = fields.find((f, i) => fields.indexOf(f) !== i);
  if (dup) return `La columna "${CSV_FIELD_LABELS[dup]}" está asignada dos veces.`;
  return null;
}

export function applyMapping(row: string[], mapping: ColumnMapping): RawProspect {
  const raw: RawProspect = {};
  mapping.forEach((field, i) => {
    if (field) raw[field] = row[i] ?? "";
  });
  return raw;
}
