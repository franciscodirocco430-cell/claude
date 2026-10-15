/**
 * Marcadores que el envío de emails (Fase 5) reemplaza por la firma de la
 * casilla y por el link de baja firmado. Nunca los escribe la IA.
 */
export const SIGNATURE_PLACEHOLDER = "{{firma}}";
export const UNSUBSCRIBE_PLACEHOLDER = "{{link_baja}}";

/** Cuerpo final del email: lo de la IA + firma + pie con link de baja (obligatorio). */
export function composeEmailBody(body: string): string {
  return [
    body.trim(),
    SIGNATURE_PLACEHOLDER,
    `—\nSi preferís que no te vuelva a escribir, avisame acá: ${UNSUBSCRIBE_PLACEHOLDER}`,
  ].join("\n\n");
}

/** Reemplaza firma y link de baja reales. Si no hay firma, se quita la línea. */
export function finalizeEmailBody(
  composed: string,
  signature: string | null,
  unsubscribeUrl: string,
): string {
  return composed
    .replace(SIGNATURE_PLACEHOLDER, (signature ?? "").trim())
    .replace(UNSUBSCRIBE_PLACEHOLDER, unsubscribeUrl)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
