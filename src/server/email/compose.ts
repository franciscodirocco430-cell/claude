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
    `—\nSi no querés recibir más mensajes, podés darte de baja acá: ${UNSUBSCRIBE_PLACEHOLDER}`,
  ].join("\n\n");
}
