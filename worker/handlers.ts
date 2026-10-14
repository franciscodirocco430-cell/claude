import type { Database } from "@/db/client";
import type { Job } from "@/server/jobs/queue";

export interface JobContext {
  db: Database;
  job: Job;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

export type JobHandler = (ctx: JobContext) => Promise<void>;

/**
 * Registro de handlers por tipo de job. Cada fase suma los suyos
 * (research_prospect, draft_message, send_sequence_step, ...).
 * Los handlers tienen que ser idempotentes: un job puede ejecutarse más de una vez.
 */
export const handlers: Record<string, JobHandler> = {
  noop: async () => {},
};
