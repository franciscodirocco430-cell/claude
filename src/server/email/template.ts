/**
 * Plantillas de secuencias: `{{variable}}` o `{{variable|valor por defecto}}`.
 * Solo se permiten las variables de VARIABLES: un error de tipeo se detecta al
 * guardar, no cuando el email ya salió con "{{nombr}}" adentro.
 */
export const TEMPLATE_VARIABLES = {
  nombre: "Primer nombre del prospecto",
  nombre_completo: "Nombre completo",
  empresa: "Empresa",
  rubro: "Rubro",
  web: "Sitio web",
  asunto_ia: "Asunto del borrador de email que preparó la IA",
  mensaje_ia: "Cuerpo del borrador de email que preparó la IA",
} as const;

export type TemplateVariable = keyof typeof TEMPLATE_VARIABLES;
export type TemplateValues = Partial<Record<TemplateVariable, string | null>>;

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;

export function templateVariables(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((m) => m[1]!);
}

/** Variables desconocidas en la plantilla (vacío = válida). */
export function unknownVariables(template: string): string[] {
  return [...new Set(templateVariables(template).filter((v) => !(v in TEMPLATE_VARIABLES)))];
}

export type RenderResult = { ok: true; text: string } | { ok: false; missing: string[] };

/** Reemplaza variables. Si falta un valor y no hay default, no renderiza (no sale un email roto). */
export function renderTemplate(template: string, values: TemplateValues): RenderResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN, (_m, name: string, fallback?: string) => {
    const value = values[name as TemplateVariable]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback.trim();
    missing.push(name);
    return "";
  });
  return missing.length ? { ok: false, missing: [...new Set(missing)] } : { ok: true, text };
}

export function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || null;
}
