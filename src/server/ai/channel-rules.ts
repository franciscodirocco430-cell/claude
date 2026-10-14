import type { Channel } from "@/server/compliance/channels";

export interface ChannelRule {
  label: string;
  maxChars: number;
  allowLinks: boolean;
  /** Guía de estilo que va al prompt. */
  guidance: string[];
}

/**
 * Reglas del PRIMER mensaje por canal. Se usan en el prompt y además se
 * validan sobre la salida: la IA puede equivocarse, la validación no.
 */
export const CHANNEL_RULES: Record<Channel, ChannelRule> = {
  instagram: {
    label: "Instagram (mensaje directo)",
    maxChars: 400,
    allowLinks: false,
    guidance: [
      "Corto: 2 a 4 oraciones.",
      "Sin links en el primer mensaje.",
      "Arrancá por algo concreto del prospecto, no por vos.",
      "Cerrá con una pregunta simple y fácil de responder.",
      "Nada de pitch de venta ni precios.",
    ],
  },
  tiktok: {
    label: "TikTok (mensaje directo)",
    maxChars: 300,
    allowLinks: false,
    guidance: [
      "Muy corto: 2 o 3 oraciones.",
      "Sin links en el primer mensaje.",
      "Tono casual y directo.",
      "Cerrá con una pregunta simple.",
    ],
  },
  facebook: {
    label: "Facebook / Messenger",
    maxChars: 450,
    allowLinks: false,
    guidance: [
      "Corto: 2 a 4 oraciones.",
      "Sin links en el primer mensaje.",
      "Cerrá con una pregunta simple.",
    ],
  },
  whatsapp: {
    label: "WhatsApp",
    maxChars: 350,
    allowLinks: false,
    guidance: [
      "Corto y directo: decí quién sos y por qué escribís en la primera oración.",
      "Sin links en el primer mensaje.",
      "Una sola pregunta al final.",
    ],
  },
  email: {
    label: "Email en frío",
    maxChars: 1200,
    allowLinks: false,
    guidance: [
      "Asunto corto (máx. 60 caracteres), sin mayúsculas sostenidas ni signos de exclamación.",
      "Cuerpo de 60 a 150 palabras, en párrafos cortos.",
      "Sin links: el sistema agrega la firma y el link de baja.",
      "No incluyas firma ni despedida con nombre: la agrega el sistema.",
      "Cerrá con una pregunta o un pedido concreto y de bajo compromiso.",
    ],
  },
};

export const EMAIL_SUBJECT_MAX = 70;

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ar|app|me|ly)(\.[a-z]{2})?\b)/i;
const TEMPLATE_RESIDUE =
  /(\{\{|\}\}|\[(tu |su )?(nombre|empresa|apellido|firma)[^\]]*\]|<nombre>)/i;

/** Errores del borrador respecto de las reglas del canal (vacío = válido). */
export function validateDraft(
  channel: Channel,
  draft: { message: string; subject?: string | null },
): string[] {
  const rule = CHANNEL_RULES[channel];
  const errors: string[] = [];
  const message = draft.message.trim();
  if (!message) errors.push("El mensaje está vacío.");
  if (message.length > rule.maxChars) {
    errors.push(`Supera los ${rule.maxChars} caracteres (tiene ${message.length}).`);
  }
  if (!rule.allowLinks && LINK.test(message))
    errors.push("Incluye un link, y en este canal no van.");
  if (TEMPLATE_RESIDUE.test(message))
    errors.push("Quedaron marcadores sin completar (ej. [nombre]).");
  if (channel === "email") {
    const subject = draft.subject?.trim() ?? "";
    if (!subject) errors.push("Falta el asunto.");
    if (subject.length > EMAIL_SUBJECT_MAX)
      errors.push(`El asunto supera los ${EMAIL_SUBJECT_MAX} caracteres.`);
    if (LINK.test(subject) || TEMPLATE_RESIDUE.test(subject))
      errors.push("El asunto tiene links o marcadores.");
  }
  return errors;
}
