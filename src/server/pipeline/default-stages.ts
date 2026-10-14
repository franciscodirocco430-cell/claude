import type { stageKind } from "@/db/schema";

export interface StageDefinition {
  key: string;
  name: string;
  position: number;
  kind: (typeof stageKind.enumValues)[number];
}

/** Etapas con las que nace toda organización. Las claves son estables: el código las usa. */
export const DEFAULT_PIPELINE_STAGES = [
  { key: "nuevo", name: "Nuevo", position: 0, kind: "open" },
  { key: "contactado", name: "Contactado", position: 1, kind: "open" },
  { key: "respondio", name: "Respondió", position: 2, kind: "open" },
  { key: "calificado", name: "Calificado", position: 3, kind: "open" },
  { key: "agendado", name: "Agendado", position: 4, kind: "open" },
  { key: "ganado", name: "Ganado", position: 5, kind: "won" },
  { key: "perdido", name: "Perdido", position: 6, kind: "lost" },
] as const satisfies readonly StageDefinition[];

export type StageKey = (typeof DEFAULT_PIPELINE_STAGES)[number]["key"];
