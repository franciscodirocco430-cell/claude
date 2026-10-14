import "dotenv/config";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { createDatabase } from "@/db/client";
import { getWorkerEnv } from "@/lib/env";
import { createAiClient } from "@/server/ai/factory";
import { GmailProvider } from "@/server/email/gmail";
import { dispatchEmailWork } from "@/server/email/sender";
import { googleConfigFromEnv } from "@/server/google/config";
import { getGoogleAccessToken, getMailboxAccessToken } from "@/server/google/mailboxes";
import { claimNextJob, completeJob, failJob } from "@/server/jobs/queue";
import { PublicWebsiteFetcher } from "@/server/research/website";
import { GoogleCalendarProvider } from "@/server/calendar/google-calendar";
import { channelAdaptersFromEnv } from "@/server/channels/registry";
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
const google = googleConfigFromEnv(env);
const emailEnabled = !!google && !!env.UNSUBSCRIBE_SIGNING_SECRET;
const handlers = buildHandlers(
  { ai, config, fetcher: new PublicWebsiteFetcher() },
  emailEnabled
    ? {
        mail: new GmailProvider(env.GMAIL_API_URL, (mailbox) =>
          getMailboxAccessToken(db, {
            accountId: mailbox.id,
            config: google!,
            encryptionKey: env.TOKEN_ENCRYPTION_KEY,
          }),
        ),
        appUrl: env.APP_URL,
        unsubscribeSecret: env.UNSUBSCRIBE_SIGNING_SECRET!,
        defaultTimeZone: env.DEFAULT_TIMEZONE,
        minGapSeconds: env.EMAIL_MIN_GAP_SECONDS,
        maxGapSeconds: Math.max(env.EMAIL_MIN_GAP_SECONDS, env.EMAIL_MAX_GAP_SECONDS),
      }
    : null,
  {
    ai,
    config,
    adapters: channelAdaptersFromEnv(env),
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    calendar: google
      ? new GoogleCalendarProvider(env.GOOGLE_CALENDAR_API_URL, (accountId) =>
          getGoogleAccessToken(db, {
            accountId,
            config: google,
            encryptionKey: env.TOKEN_ENCRYPTION_KEY,
          }),
        )
      : null,
  },
);
if (!emailEnabled)
  log("email deshabilitado: faltan GOOGLE_CLIENT_ID/SECRET o UNSUBSCRIBE_SIGNING_SECRET");

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
  // Despachador de emails: encola envíos vencidos y lecturas de hilos (idempotente).
  const dispatcher = emailEnabled
    ? setInterval(() => {
        dispatchEmailWork(db, new Date(), env.EMAIL_SYNC_INTERVAL_MS).catch((error) =>
          log("error despachando emails", { error: String(error) }),
        );
      }, env.EMAIL_DISPATCH_INTERVAL_MS)
    : null;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    log("apagando: termino los jobs en curso");
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await Promise.all(Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => loop(i)));
  if (dispatcher) clearInterval(dispatcher);
  health?.close();
  await sql.end();
  log("worker detenido");
}

main().catch((error) => {
  log("error fatal", { error: String(error) });
  process.exit(1);
});
