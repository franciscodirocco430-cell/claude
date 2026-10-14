import type { z } from "zod";
import type { AiClient, StructuredRequest, StructuredResult } from "./client";

const line = (text: string, label: string) =>
  new RegExp(`^${label}: (.+)$`, "m").exec(text)?.[1]?.replace("(sin dato)", "").trim() || null;

/**
 * Cliente SIMULADO para desarrollo y tests: respuestas deterministas, sin llamar
 * a ninguna API ni gastar tokens. `createAiClient` impide usarlo en producción.
 */
export class FakeAiClient implements AiClient {
  public readonly calls: StructuredRequest<z.ZodType>[] = [];
  constructor(private readonly overrides: Partial<Record<string, unknown[]>> = {}) {}

  async generateStructured<S extends z.ZodType>(
    req: StructuredRequest<S>,
  ): Promise<StructuredResult<z.infer<S>>> {
    this.calls.push(req);
    const queued = this.overrides[req.task]?.shift();
    if (queued instanceof Error) throw queued;
    const company = line(req.user, "Empresa") ?? line(req.user, "Nombre") ?? "tu negocio";
    const fallback: Record<string, unknown> = {
      research: {
        summary: `[Simulado] ${company} es un prospecto del nicho de la campaña. Notas generadas sin IA real.`,
        businessType: null,
        pains: ["Probablemente le cuesta conseguir clientes nuevos de forma predecible."],
        hooks: [`Trabaja en ${company}.`],
        icpFit: "desconocido",
        confidence: "baja",
      },
      "draft:email": {
        subject: `Una idea para ${company}`.slice(0, 60),
        body: `Hola, te escribo porque trabajamos con negocios como ${company}. ¿Te interesaría que te cuente cómo lo hacemos?`,
      },
    };
    if (req.task === "agent_reply") fallback.agent_reply = fakeAgentReply(req.user);
    const data = queued ??
      fallback[req.task] ?? {
        message: `[Simulado] Hola! Vi lo que hacen en ${company}. ¿Cómo vienen con los clientes nuevos este mes?`,
      };
    return {
      data: req.schema.parse(data),
      model: `fake-${req.tier}`,
      usage: { inputTokens: Math.ceil(req.user.length / 4), outputTokens: 50 },
      durationMs: 1,
    };
  }
}

/**
 * Agente simulado: responde la pregunta que toca, registra la respuesta si el
 * último mensaje nuestro era esa pregunta, marca todos los criterios como
 * cumplidos y elige el horario 1/2/3 si el prospecto lo nombra.
 */
function fakeAgentReply(user: string) {
  const convo = /<conversacion>\n([\s\S]*?)\n<\/conversacion>/.exec(user)?.[1] ?? "";
  const lines = convo.split("\n");
  const lastIn =
    [...lines]
      .reverse()
      .find((l) => l.startsWith("Prospecto: "))
      ?.slice(11) ?? "";
  const lastOut =
    [...lines]
      .reverse()
      .find((l) => l.startsWith("Nosotros: "))
      ?.slice(10) ?? "";
  const questions = [...user.matchAll(/^- (\d+)\. (.+?) → (respondida|sin responder)/gm)].map(
    (m) => ({ n: Number(m[1]), text: m[2]!, answered: m[3] === "respondida" }),
  );
  const criteria = [...user.matchAll(/^- (\d+)\. /gm)]
    .map((m) => Number(m[1]))
    .slice(questions.length);
  const pending = questions.filter((q) => !q.answered);
  const current = pending[0];
  const answeredNow = current && lastOut.includes(current.text) ? current : null;
  const next = answeredNow ? pending[1] : current;
  const lower = lastIn.toLowerCase();
  const slotPick = /horarios que ya le ofrecimos/i.test(user)
    ? (/\b([123])\b/.exec(lower)?.[1] ??
      (/primer/.test(lower) ? "1" : /segund/.test(lower) ? "2" : /tercer/.test(lower) ? "3" : null))
    : null;
  const angry = /estafa|molest|enojad|basta/.test(lower);
  return {
    reply: angry
      ? "[Simulado] Perdón por la molestia. Le aviso a alguien del equipo para que te escriba."
      : next
        ? `[Simulado] ¡Gracias por escribir! ${next.text}`
        : "[Simulado] ¡Buenísimo, gracias por contarme!",
    askedIfBot: /\b(bot|ia|robot|humano)\b/.test(lower),
    handoff: { needed: angry, reason: angry ? "angry" : null, summary: angry ? lastIn : "" },
    answers: answeredNow ? [{ question: answeredNow.n, answer: lastIn }] : [],
    criteria:
      !next && questions.length
        ? criteria.map((n) => ({ criterion: n, met: true, evidence: "[Simulado]" }))
        : [],
    wantsMeeting: false,
    selectedSlotId: slotPick ? `h${slotPick}` : null,
  };
}
