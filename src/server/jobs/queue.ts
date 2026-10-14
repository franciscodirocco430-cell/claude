import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { jobs } from "@/db/schema";
import { computeBackoffMs, type BackoffOptions } from "./backoff";

export type Job = typeof jobs.$inferSelect;

export interface EnqueueInput {
  type: string;
  payload?: Record<string, unknown>;
  organizationId?: string | null;
  runAt?: Date;
  maxAttempts?: number;
  /** Misma clave = mismo trabajo. Volver a encolar no crea un duplicado. */
  idempotencyKey?: string;
}

/** Encola un trabajo. Devuelve el job existente si la clave de idempotencia ya estaba. */
export async function enqueueJob(db: Database, input: EnqueueInput): Promise<Job> {
  const [inserted] = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload ?? {},
      organizationId: input.organizationId ?? null,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.idempotencyKey, input.idempotencyKey!));
  if (!existing) throw new Error("No se pudo encolar el trabajo.");
  return existing;
}

/**
 * Toma el próximo trabajo listo. `FOR UPDATE SKIP LOCKED` permite correr varios
 * workers en paralelo sin que dos tomen el mismo job. También recupera jobs
 * que quedaron "running" de un worker caído (lock vencido).
 */
export async function claimNextJob(
  db: Database,
  workerId: string,
  options: { lockTimeoutMs?: number; types?: string[] } = {},
): Promise<Job | null> {
  const lockTimeout = `${Math.floor((options.lockTimeoutMs ?? 10 * 60_000) / 1000)} seconds`;
  const typeFilter =
    options.types && options.types.length > 0
      ? sql`and type in (${sql.join(
          options.types.map((t) => sql`${t}`),
          sql`, `,
        )})`
      : sql``;

  const rows = await db.execute<{ id: string }>(sql`
    update jobs set
      status = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = ${workerId}
    where id = (
      select id from jobs
      where (
        (status = 'queued' and run_at <= now())
        or (
          status = 'running'
          and locked_at < now() - ${lockTimeout}::interval
          and attempts < max_attempts
        )
      )
      ${typeFilter}
      order by run_at
      for update skip locked
      limit 1
    )
    returning id`);

  const id = rows[0]?.id;
  if (!id) return null;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job ?? null;
}

export async function completeJob(db: Database, job: Pick<Job, "id">) {
  await db
    .update(jobs)
    .set({ status: "succeeded", completedAt: new Date(), lockedAt: null, lastError: null })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, "running")));
}

/** Registra el fallo y reprograma con backoff, o lo marca `dead` si agotó intentos. */
export async function failJob(
  db: Database,
  job: Pick<Job, "id" | "attempts" | "maxAttempts">,
  error: unknown,
  backoff: BackoffOptions = {},
): Promise<"retry" | "dead"> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set(
      exhausted
        ? { status: "dead", lastError: message, lockedAt: null }
        : {
            status: "queued",
            lastError: message,
            lockedAt: null,
            runAt: new Date(Date.now() + computeBackoffMs(job.attempts, backoff)),
          },
    )
    .where(eq(jobs.id, job.id));
  return exhausted ? "dead" : "retry";
}
