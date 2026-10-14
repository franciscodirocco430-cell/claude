import "dotenv/config";
import { hostname } from "node:os";
import { createDatabase } from "@/db/client";
import { getServerEnv } from "@/lib/env";
import { claimNextJob, completeJob, failJob } from "@/server/jobs/queue";
import { handlers } from "./handlers";

const env = getServerEnv();
const workerId = `${hostname()}:${process.pid}`;
const { db, sql } = createDatabase(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 1 });

let stopping = false;

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), workerId, message, ...extra }));
}

async function runOnce(): Promise<boolean> {
  const job = await claimNextJob(db, workerId, { types: Object.keys(handlers) });
  if (!job) return false;

  const handler = handlers[job.type];
  const started = Date.now();
  try {
    if (!handler) throw new Error(`Sin handler para el tipo "${job.type}"`);
    await handler({ db, job, log: (m, e) => log(m, { jobId: job.id, ...e }) });
    await completeJob(db, job);
    log("job ok", { jobId: job.id, type: job.type, ms: Date.now() - started });
  } catch (error) {
    const outcome = await failJob(db, job, error);
    log("job falló", { jobId: job.id, type: job.type, outcome, error: String(error) });
  }
  return true;
}

async function loop(slot: number) {
  while (!stopping) {
    try {
      const worked = await runOnce();
      if (!worked) await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
    } catch (error) {
      log("error en el loop", { slot, error: String(error) });
      await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

async function main() {
  log("worker iniciado", { concurrency: env.WORKER_CONCURRENCY });
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log("apagando: termino los jobs en curso");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => loop(i)));
  await sql.end();
  log("worker detenido");
}

main().catch((error) => {
  log("error fatal", { error: String(error) });
  process.exit(1);
});
