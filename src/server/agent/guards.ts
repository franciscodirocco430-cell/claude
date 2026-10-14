import type { QualificationAnswers, QualificationCriterion } from "@/db/schema";

/*
 * Guardas deterministas alrededor del agente. La IA puede equivocarse; estas
 * reglas no: se aplican sobre la entrada y la salida, en código.
 */

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const BOT_QUESTION =
  /\b(sos|eres|es|sera|seras|estoy hablando con)\s+(un|una)?\s*(bot|robot|ia|inteligencia artificial|maquina|chatbot|persona real|humano|humana|persona)\b|\b(bot|ia|robot|humano)\s*\?/;

const HUMAN_REQUEST =
  /\b(hablar|hablo|comunicarme|pasame|pasar|quiero|necesito)\b.{0,30}\b(persona|humano|humana|alguien (real|del equipo)|asesor|asesora|vendedor|vendedora|encargad[oa])\b/;

/** El prospecto pregunta si habla con un bot/IA o con una persona. */
export function asksIfBot(text: string): boolean {
  return BOT_QUESTION.test(norm(text));
}

/** El prospecto pide hablar con una persona. */
export function asksForHuman(text: string): boolean {
  return HUMAN_REQUEST.test(norm(text));
}

const DISCLOSES_AI =
  /\b(ia|inteligencia artificial|bot|asistente virtual|asistente automatico|automatizad[oa])\b/;
const DENIES_AI =
  /\b(no soy (un|una)? ?(bot|robot|ia|maquina|inteligencia artificial)|soy (una persona|un humano|una humana|humano|humana|una persona real))\b/;

export function honestDisclosure(teamName: string) {
  return `Sí, soy un asistente con inteligencia artificial del equipo de ${teamName}. Si preferís hablar con una persona, decime y te paso con alguien del equipo.`;
}

/**
 * Nunca negar que es una IA. Si la respuesta lo niega, se reemplaza. Si el
 * prospecto preguntó y la respuesta no lo aclara, se antepone la aclaración.
 */
export function enforceHonesty(
  reply: string,
  opts: { askedIfBot: boolean; teamName: string },
): { reply: string; corrected: boolean } {
  const n = norm(reply);
  if (DENIES_AI.test(n)) return { reply: honestDisclosure(opts.teamName), corrected: true };
  if (opts.askedIfBot && !DISCLOSES_AI.test(n)) {
    return { reply: `${honestDisclosure(opts.teamName)}\n\n${reply}`.trim(), corrected: true };
  }
  return { reply, corrected: false };
}

export const AGENT_MAX_CHARS = 700;

/** Problemas de forma de la respuesta (se corrigen con un reintento). */
export function validateAgentReply(reply: string): string[] {
  const errors: string[] = [];
  if (!reply.trim()) errors.push("La respuesta está vacía.");
  if (reply.length > AGENT_MAX_CHARS) {
    errors.push(`La respuesta tiene ${reply.length} caracteres; el máximo es ${AGENT_MAX_CHARS}.`);
  }
  if (/\{\{|\}\}|\[[A-ZÁÉÍÓÚ _]{3,}\]/.test(reply)) {
    errors.push("La respuesta tiene marcadores sin completar ({{…}} o [ALGO]).");
  }
  return errors;
}

/**
 * Puntaje 0-100: suma de pesos de criterios cumplidos sobre el total. Los
 * criterios sin evaluar no suman.
 */
export function scoreLead(
  criteria: readonly QualificationCriterion[],
  met: ReadonlyMap<number, boolean | null>,
): number {
  const total = criteria.reduce((acc, c) => acc + Math.max(0, c.weight), 0);
  if (total <= 0) return 0;
  const got = criteria.reduce(
    (acc, c, i) => acc + (met.get(i) === true ? Math.max(0, c.weight) : 0),
    0,
  );
  return Math.round((got / total) * 100);
}

/** Índices (desde 0) de preguntas de calificación sin respuesta todavía. */
export function pendingQuestions(questions: readonly string[], answers: QualificationAnswers) {
  return questions.map((_, i) => i).filter((i) => !answers[`q${i + 1}`]?.answer);
}
