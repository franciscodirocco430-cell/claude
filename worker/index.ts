import "dotenv/config";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { createDatabase } from "@/db/client";
import { getWorkerEnv } from "@/lib/env";
import { createAiClient } from "@/server/ai/factory";
import { claimNextJob, completeJob, failJob } from "@/server/jobs/queue";
import { PublicWebsiteFetcher } from "@/server/research/website";
import { buildHandlers } from "./handlers";

const env = getWorkerEnv();
const workerId = `${hostname()}:${process.pid}`;
const { db, sql } = createDatabase(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 1 });

let stopping = false;
let lastLoopAt = Date.now();

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), workerId, message, ...extra }));
}

const { client: ai, config } = createAiClient(env);
if (env.AI_FAKE === "true") log("ATENCIÓN: IA simulada (AI_FAKE=true)");
const handlers = buildHandlers({ ai, config, fetcher: new PublicWebsiteFetcher() });

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
    lastLoopAt = Date.now();
    try {
      const worked = await runOnce();
      if (!worked) await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
    } catch (error) {
      log("error en el loop", { slot, error: String(error) });
      await new Promise((r) => setTimeout(r, env.WORKER_POLL_INTERVAL_MS));
    }
  }
}

/** Health check para la plataforma de deploy: 200 si el loop está vivo. */
function startHealthServer(port: number) {
  const server = createServer((_req, res) => {
    const healthy = !stopping && Date.now() - lastLoopAt < 5 * 60_000;
    res.writeHead(healthy ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: healthy, workerId }));
  });
  server.listen(port, () => log("health check escuchando", { port }));
  return server;
}

async function main() {
  log("worker iniciado", {
    concurrency: env.WORKER_CONCURRENCY,
    models: { fast: config.fast.model, smart: config.smart.model },
  });
  const health = env.WORKER_HEALTH_PORT ? startHealthServer(env.WORKER_HEALTH_PORT) : null;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log("apagando: termino los jobs en curso");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => loop(i)));
  health?.close();
  await sql.end();
  log("worker detenido");
}

main().catch((error) => {
  log("error fatal", { error: String(error) });
  process.exit(1);
});
