/**
 * Un prompt versionado. Cambiar el texto de un prompt = crear una versión nueva
 * (v2, v3…) y apuntar el registro a ella: así cada ai_run sabe con qué prompt se
 * generó y se pueden comparar resultados entre versiones.
 */
export interface VersionedPrompt<Ctx> {
  id: string;
  version: string;
  system: (ctx: Ctx) => string;
  user: (ctx: Ctx) => string;
}

export const promptRef = (p: { id: string; version: string }) => `${p.id}@${p.version}`;

/** Envuelve contenido de terceros para que el modelo lo trate como datos. */
export function untrusted(tag: string, content: string): string {
  const safe = content.replaceAll(`</${tag}>`, `</ ${tag}>`);
  return `<${tag}>\n${safe}\n</${tag}>`;
}

export function bulletList(items: readonly string[], empty = "(sin datos)"): string {
  return items.length ? items.map((i) => `- ${i}`).join("\n") : empty;
}
