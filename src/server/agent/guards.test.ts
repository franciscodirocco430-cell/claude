import { describe, expect, it } from "vitest";
import {
  asksForHuman,
  asksIfBot,
  enforceHonesty,
  pendingQuestions,
  scoreLead,
  validateAgentReply,
} from "./guards";
import { agentSettingsSchema, parseAgentSettings, replyDelaySeconds } from "./settings";

describe("guardas del agente", () => {
  it("detecta preguntas sobre si es un bot", () => {
    for (const t of ["¿Sos un bot?", "sos humano?", "estoy hablando con una IA?", "Es un robot?"]) {
      expect(asksIfBot(t), t).toBe(true);
    }
    for (const t of [
      "Hola, ¿cuánto sale?",
      "Tengo un bote",
      "La IA nos interesa para la clínica",
    ]) {
      expect(asksIfBot(t), t).toBe(false);
    }
  });

  it("detecta pedidos de hablar con una persona", () => {
    for (const t of [
      "Quiero hablar con una persona",
      "pasame con alguien del equipo",
      "Necesito hablar con un asesor",
    ]) {
      expect(asksForHuman(t), t).toBe(true);
    }
    expect(asksForHuman("Somos 3 personas en la clínica")).toBe(false);
  });

  it("nunca deja negar que es IA y aclara si preguntaron", () => {
    const denied = enforceHonesty("No, soy una persona real 😊", {
      askedIfBot: true,
      teamName: "Norte",
    });
    expect(denied.corrected).toBe(true);
    expect(denied.reply).toMatch(/inteligencia artificial del equipo de Norte/);
    expect(denied.reply).not.toMatch(/persona real/);

    const evasive = enforceHonesty("¡Contame más de tu clínica!", {
      askedIfBot: true,
      teamName: "Norte",
    });
    expect(evasive.reply).toMatch(/^Sí, soy un asistente con inteligencia artificial/);
    expect(evasive.reply).toMatch(/Contame más/);

    const honest = enforceHonesty("Sí, soy un asistente de IA. ¿Querés hablar con alguien?", {
      askedIfBot: true,
      teamName: "Norte",
    });
    expect(honest.corrected).toBe(false);
    expect(enforceHonesty("Hola!", { askedIfBot: false, teamName: "N" }).corrected).toBe(false);
  });

  it("valida la forma de la respuesta", () => {
    expect(validateAgentReply("Hola")).toEqual([]);
    expect(validateAgentReply("")).toHaveLength(1);
    expect(validateAgentReply("x".repeat(800))[0]).toMatch(/máximo/);
    expect(validateAgentReply("Hola {{nombre}}")[0]).toMatch(/marcadores/);
  });

  it("calcula el puntaje con los pesos de los criterios", () => {
    const criteria = [
      { label: "a", weight: 60 },
      { label: "b", weight: 40 },
    ];
    expect(scoreLead(criteria, new Map([[0, true]]))).toBe(60);
    expect(
      scoreLead(
        criteria,
        new Map([
          [0, true],
          [1, true],
        ]),
      ),
    ).toBe(100);
    expect(
      scoreLead(
        criteria,
        new Map([
          [0, false],
          [1, null],
        ]),
      ),
    ).toBe(0);
    expect(scoreLead([], new Map())).toBe(0);
  });

  it("lista las preguntas pendientes", () => {
    expect(pendingQuestions(["a", "b", "c"], { q2: { answer: "x", met: null } })).toEqual([0, 2]);
  });
});

describe("configuración del agente", () => {
  it("arranca apagado y con defaults conservadores; config rota → defaults", () => {
    const s = parseAgentSettings({});
    expect(s.enabled).toBe(false);
    expect(s.replyDelayMinSeconds).toBeGreaterThan(0);
    expect(parseAgentSettings({ enabled: "quizás", replyDelayMinSeconds: -5 }).enabled).toBe(false);
  });

  it("valida rangos", () => {
    expect(
      agentSettingsSchema.safeParse({ replyDelayMinSeconds: 100, replyDelayMaxSeconds: 10 })
        .success,
    ).toBe(false);
    expect(agentSettingsSchema.safeParse({ meetingStartHour: 18, meetingEndHour: 9 }).success).toBe(
      false,
    );
  });

  it("la demora aleatoria queda dentro del rango", () => {
    const s = parseAgentSettings({ replyDelayMinSeconds: 30, replyDelayMaxSeconds: 90 });
    expect(replyDelaySeconds(s, () => 0)).toBe(30);
    expect(replyDelaySeconds(s, () => 0.999999)).toBe(90);
    for (let i = 0; i < 50; i++) {
      const d = replyDelaySeconds(s);
      expect(d).toBeGreaterThanOrEqual(30);
      expect(d).toBeLessThanOrEqual(90);
    }
  });
});
