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
