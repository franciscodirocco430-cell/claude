import type { Database } from "@/db/client";
import {
  runDraftJob,
  runResearchJob,
  DRAFT_JOB,
  RESEARCH_JOB,
  type PipelineDeps,
} from "@/server/ai/pipeline";
import type { Job } from "@/server/jobs/queue";

export interface JobContext {
  db: Database;
  job: Job;
  log: (message: string, extra?: Record<string, unknown>) => void;
}

export type JobHandler = (ctx: JobContext) => Promise<void>;

/**
 * Registro de handlers por tipo de job. Los handlers tienen que ser
 * idempotentes: un job puede ejecutarse más de una vez.
 */
export function buildHandlers(deps: Omit<PipelineDeps, "db">): Record<string, JobHandler> {
  return {
    noop: async () => {},
    [RESEARCH_JOB]: ({ db, job }) => runResearchJob({ ...deps, db }, job),
    [DRAFT_JOB]: ({ db, job }) => runDraftJob({ ...deps, db }, job),
  };
}
