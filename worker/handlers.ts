import type { Database } from "@/db/client";
import {
  runDraftJob,
  runResearchJob,
  DRAFT_JOB,
  RESEARCH_JOB,
  type PipelineDeps,
} from "@/server/ai/pipeline";
import { INBOUND_JOB, runInboundJob } from "@/server/channels/inbound";
import { runSendJob, runSyncJob, SEND_JOB, SYNC_JOB, type EmailDeps } from "@/server/email/sender";
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
export function buildHandlers(
  deps: Omit<PipelineDeps, "db">,
  email: Omit<EmailDeps, "db"> | null,
): Record<string, JobHandler> {
  return {
    noop: async () => {},
    [RESEARCH_JOB]: ({ db, job }) => runResearchJob({ ...deps, db }, job),
    [DRAFT_JOB]: ({ db, job }) => runDraftJob({ ...deps, db }, job),
    [INBOUND_JOB]: async ({ db, job, log }) => {
      const outcome = await runInboundJob(db, job);
      log("mensaje entrante", { ...outcome });
    },
    // Sin Google configurado, los jobs de email no se toman (quedan en cola).
    ...(email
      ? {
          [SEND_JOB]: ({ db, job }: JobContext) => runSendJob({ ...email, db }, job),
          [SYNC_JOB]: ({ db, job }: JobContext) => runSyncJob({ ...email, db }, job),
        }
      : {}),
  };
}
