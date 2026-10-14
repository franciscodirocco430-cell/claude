import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { jobs } from "@/db/schema";
import { claimNextJob, completeJob, enqueueJob, failJob } from "@/server/jobs/queue";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

describe.skipIf(!TEST_DATABASE_URL)("cola de jobs", () => {
  let t: TestDatabase;

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.db.delete(jobs);
  });

  it("es idempotente por clave", async () => {
    const first = await enqueueJob(t.db, { type: "noop", idempotencyKey: "k1" });
    const second = await enqueueJob(t.db, { type: "noop", idempotencyKey: "k1" });
    expect(second.id).toBe(first.id);
    expect(await t.db.select().from(jobs)).toHaveLength(1);
  });

  it("dos workers nunca toman el mismo job", async () => {
    await enqueueJob(t.db, { type: "noop" });
    const [x, y] = await Promise.all([claimNextJob(t.db, "w1"), claimNextJob(t.db, "w2")]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
  });

  it("no toma jobs programados a futuro", async () => {
    await enqueueJob(t.db, { type: "noop", runAt: new Date(Date.now() + 60_000) });
    expect(await claimNextJob(t.db, "w1")).toBeNull();
  });

  it("reintenta con backoff y después marca dead", async () => {
    const job = await enqueueJob(t.db, { type: "noop", maxAttempts: 2 });
    const c1 = await claimNextJob(t.db, "w1");
    expect(await failJob(t.db, c1!, new Error("boom"), { random: () => 0 })).toBe("retry");
    const c2 = await claimNextJob(t.db, "w1");
    expect(c2?.attempts).toBe(2);
    expect(await failJob(t.db, c2!, new Error("boom"))).toBe("dead");
    const [row] = await t.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(row).toMatchObject({ status: "dead", lastError: "boom" });
  });

  it("completa un job", async () => {
    const job = await enqueueJob(t.db, { type: "noop" });
    const claimed = await claimNextJob(t.db, "w1");
    await completeJob(t.db, claimed!);
    const [row] = await t.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(row?.status).toBe("succeeded");
    expect(row?.completedAt).not.toBeNull();
  });

  it("filtra por tipos conocidos", async () => {
    await enqueueJob(t.db, { type: "desconocido" });
    expect(await claimNextJob(t.db, "w1", { types: ["noop"] })).toBeNull();
  });
});
