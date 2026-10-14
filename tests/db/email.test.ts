import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  connectedAccounts,
  connectedAccountSecrets,
  conversations,
  jobs,
  messages,
  outreachTasks,
  sequenceEnrollments,
  suppressionList,
} from "@/db/schema";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign } from "@/server/campaigns/service";
import { FakeMailProvider } from "@/server/email/gmail";
import {
  dispatchEmailWork,
  runSendJob,
  runSyncJob,
  SEND_JOB,
  SYNC_JOB,
  unsubscribeEmail,
  type EmailDeps,
} from "@/server/email/sender";
import { verifyUnsubscribeToken } from "@/server/email/unsubscribe";
import { getMailboxAccessToken, saveGoogleMailbox } from "@/server/google/mailboxes";
import { claimNextJob, completeJob } from "@/server/jobs/queue";
import { createOrganization } from "@/server/organizations/service";
import { ingestProspects } from "@/server/prospects/ingest";
import { getLeadStage } from "@/server/queue/service";
import { sequenceInputSchema } from "@/server/sequences/schemas";
import { changeSequenceStatus, createSequence, enrollEligible } from "@/server/sequences/service";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const KEY = randomBytes(32).toString("base64");
const SECRET = "x".repeat(40);
const WED_11_BA = new Date("2026-10-14T14:00:00Z"); // miércoles 11:00 en Buenos Aires
const googleConfig = {
  clientId: "id",
  clientSecret: "secret",
  redirectUri: "https://app.example.com/cb",
  authorizeUrl: "https://g.example.com/auth",
  tokenUrl: "https://g.example.com/token",
  revokeUrl: "https://g.example.com/revoke",
};

describe.skipIf(!TEST_DATABASE_URL)("email en frío", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let campaignId: string;
  let mailboxId: string;
  let mail: FakeMailProvider;
  let clock: Date;
  let deps: EmailDeps;

  async function user(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  async function prospect(raw: Record<string, string>, aiDraft = true) {
    const r = await withUserContext(t.db, { sub: ownerId }, (tx) =>
      ingestProspects(tx, {
        organizationId: orgId,
        campaignId,
        source: "manual",
        rows: [{ row: 1, raw }],
      }),
    );
    const id = r.outcomes[0]!.prospectId!;
    if (aiDraft) {
      await t.db.insert(outreachTasks).values({
        organizationId: orgId,
        campaignId,
        prospectId: id,
        channel: "email",
        status: "ready",
        draftSubject: `Idea para ${raw.company ?? "vos"}`,
        draftMessage: "Hola, cuerpo de la IA.\n\n{{firma}}\n\n—\nbaja: {{link_baja}}",
      });
    }
    return id;
  }

  async function sequence(
    steps = sequenceInputSchema.parse({
      name: "Secuencia test",
      mailboxAccountId: mailboxId,
      steps: [
        { subject: "{{asunto_ia}}", body: "{{mensaje_ia}}", delayDays: 0 },
        { subject: "", body: "Hola {{nombre|}}, ¿lo viste?", delayDays: 3 },
      ],
    }),
  ) {
    const id = await withUserContext(t.db, { sub: ownerId }, async (tx) => {
      const sid = await createSequence(tx, {
        organizationId: orgId,
        campaignId,
        actorRole: "owner",
        data: steps,
      });
      await changeSequenceStatus(tx, {
        organizationId: orgId,
        sequenceId: sid,
        actorRole: "owner",
        action: "activate",
      });
      return sid;
    });
    return id;
  }

  const enroll = (sequenceId: string) =>
    withUserContext(t.db, { sub: ownerId }, (tx) =>
      enrollEligible(tx, { organizationId: orgId, sequenceId, actorRole: "owner", now: clock }),
    );

  /** Simula el worker: despacha y procesa todo lo que haya. */
  async function work() {
    await dispatchEmailWork(t.db, clock);
    for (let i = 0; i < 50; i++) {
      const job = await claimNextJob(t.db, "test", { types: [SEND_JOB, SYNC_JOB] });
      if (!job) return;
      await (job.type === SEND_JOB ? runSendJob : runSyncJob)(deps, job);
      await completeJob(t.db, job);
    }
  }

  const enrollmentOf = async (prospectId: string) =>
    (
      await t.db
        .select()
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.prospectId, prospectId))
    )[0]!;

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = await user(`o-${randomUUID()}@example.com`);
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org email" })).id;
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña email",
      niche: "Clínicas",
      offer: "Oferta de prueba larga",
      icp: "ICP de prueba largo",
      qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
      qualificationQuestions: ["¿Cuántos?"],
      channels: ["email"],
    });
    campaignId = (
      await withUserContext(t.db, { sub: ownerId }, (tx) =>
        createCampaign(tx, {
          organizationId: orgId,
          actorId: ownerId,
          actorRole: "owner",
          data,
          activate: true,
        }),
      )
    ).id;
    mailboxId = await saveGoogleMailbox(t.db, {
      organizationId: orgId,
      userId: ownerId,
      email: "Ventas@Agencia.example.com",
      tokens: {
        accessToken: "acc-1",
        refreshToken: "ref-1",
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: [],
      },
      encryptionKey: KEY,
    });
    await t.db
      .update(connectedAccounts)
      .set({ signature: "Ana — Agencia Demo", dailySendLimit: 50 })
      .where(eq(connectedAccounts.id, mailboxId));
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.db.delete(jobs);
    await t.db
      .update(connectedAccounts)
      .set({ lastSentAt: null })
      .where(eq(connectedAccounts.id, mailboxId));
    mail = new FakeMailProvider();
    clock = WED_11_BA;
    deps = {
      db: t.db,
      mail,
      appUrl: "https://app.example.com",
      unsubscribeSecret: SECRET,
      defaultTimeZone: "America/Argentina/Buenos_Aires",
      minGapSeconds: 0,
      maxGapSeconds: 0,
      now: () => clock,
      random: (min) => min,
    };
  });

  it("los tokens de la casilla se guardan cifrados y atados a la cuenta", async () => {
    const [secret] = await t.db
      .select()
      .from(connectedAccountSecrets)
      .where(eq(connectedAccountSecrets.connectedAccountId, mailboxId));
    expect(secret!.accessTokenEnc).not.toContain("acc-1");
    expect(secret!.refreshTokenEnc).not.toContain("ref-1");
    const token = await getMailboxAccessToken(t.db, {
      accountId: mailboxId,
      config: googleConfig,
      encryptionKey: KEY,
    });
    expect(token).toBe("acc-1");
  });

  it("refresca el token vencido y marca la casilla si Google lo revocó", async () => {
    const other = await saveGoogleMailbox(t.db, {
      organizationId: orgId,
      userId: ownerId,
      email: "otra@agencia.example.com",
      tokens: {
        accessToken: "viejo",
        refreshToken: "ref-2",
        expiresAt: new Date(Date.now() - 1000),
        scopes: [],
      },
      encryptionKey: KEY,
    });
    const ok = (async () =>
      new Response(JSON.stringify({ access_token: "nuevo", expires_in: 3600 }), {
        status: 200,
      })) as unknown as typeof fetch;
    expect(
      await getMailboxAccessToken(t.db, {
        accountId: other,
        config: googleConfig,
        encryptionKey: KEY,
        fetchImpl: ok,
      }),
    ).toBe("nuevo");

    await t.db
      .update(connectedAccounts)
      .set({ tokenExpiresAt: new Date(0) })
      .where(eq(connectedAccounts.id, other));
    const revoked = (async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
      })) as unknown as typeof fetch;
    await expect(
      getMailboxAccessToken(t.db, {
        accountId: other,
        config: googleConfig,
        encryptionKey: KEY,
        fetchImpl: revoked,
      }),
    ).rejects.toThrow(/revocó/);
    const [acct] = await t.db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, other));
    expect(acct?.status).toBe("revoked");
  });

  it("inscribe solo elegibles: con email, sin supresión, con borrador de IA si la plantilla lo usa", async () => {
    const ok = await prospect({ company: "Ok", email: "ok@clinica.example.com" });
    await prospect({ company: "Sin borrador", email: "sinia@clinica.example.com" }, false);
    await prospect({ company: "Sin email", instagram: "sin.email" });
    const sup = await prospect({ company: "Suprimido", email: "baja@clinica.example.com" });
    await t.db.insert(suppressionList).values({
      organizationId: orgId,
      kind: "email",
      value: "baja@clinica.example.com",
      reason: "unsubscribed",
    });
    const sid = await sequence();
    const r = await enroll(sid);
    expect(r).toEqual({ enrolled: 1, needsAi: true });
    expect((await enrollmentOf(ok)).status).toBe("active");
    expect(
      await t.db.select().from(sequenceEnrollments).where(eq(sequenceEnrollments.prospectId, sup)),
    ).toHaveLength(0);
    // Volver a inscribir no duplica.
    expect((await enroll(sid)).enrolled).toBe(0);
  });

  it("envía el primer email con firma, link de baja firmado y encabezado de baja en un clic", async () => {
    const pid = await prospect({
      company: "Primero",
      fullName: "Laura Gómez",
      email: "laura@primero.example.com",
    });
    await enroll(await sequence());
    await work();
    const sent = mail.sent.find((s) => s.raw.includes("laura@primero.example.com"))!;
    expect(sent).toBeTruthy();
    const body = Buffer.from(
      sent.raw.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""),
      "base64",
    ).toString("utf8");
    expect(body).toContain("Hola, cuerpo de la IA.");
    expect(body).toContain("Ana — Agencia Demo");
    expect(body).not.toContain("{{");
    const url = /https:\/\/app\.example\.com\/baja\/(\S+)/.exec(body)![1]!;
    expect(verifyUnsubscribeToken(url, SECRET)).toMatchObject({
      o: orgId,
      e: "laura@primero.example.com",
    });
    expect(sent.raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(sent.raw).toContain("List-Unsubscribe: <https://app.example.com/api/baja/");

    const e = await enrollmentOf(pid);
    expect(e).toMatchObject({
      currentStep: 1,
      status: "active",
      firstSubject: "Idea para Primero",
    });
    expect(e.nextSendAt?.toISOString()).toBe(
      new Date(WED_11_BA.getTime() + 3 * 86_400_000).toISOString(),
    );
    expect(
      (
        await withUserContext(t.db, { sub: ownerId }, (tx) =>
          getLeadStage(tx, orgId, pid, campaignId),
        )
      ).key,
    ).toBe("contactado");
  });

  it("el seguimiento va en el mismo hilo con Re: y In-Reply-To", async () => {
    const pid = await prospect({
      company: "Hilo",
      fullName: "Martín",
      email: "martin@hilo.example.com",
    });
    await enroll(await sequence());
    await work();
    const first = mail.sent.at(-1)!;
    clock = new Date(WED_11_BA.getTime() + 3 * 86_400_000); // sábado: fuera de horario
    await work();
    expect(mail.sent.at(-1)).toBe(first);
    const e = await enrollmentOf(pid);
    expect(e.nextSendAt!.toISOString()).toBe("2026-10-19T12:00:00.000Z"); // lunes 9:00 BA
    clock = new Date("2026-10-19T12:05:00Z");
    await work();
    const follow = mail.sent.at(-1)!;
    expect(follow.threadId).toBe(first.threadId);
    expect(follow.raw).toContain("Subject: Re: Idea para Hilo");
    expect(follow.raw).toMatch(/In-Reply-To: <msg-[a-z0-9]+-\d+@fake\.mail>/);
    expect((await enrollmentOf(pid)).status).toBe("completed");
  });

  it("una respuesta frena la secuencia, se guarda en la conversación y mueve a 'respondió'", async () => {
    const pid = await prospect({ company: "Responde", email: "responde@x.example.com" });
    await enroll(await sequence());
    await work();
    const { threadId } = mail.sent.at(-1)!;
    mail.addReply(threadId, {
      from: "Respondo <responde@x.example.com>",
      text: "Me interesa, hablemos.\n\nEl lun, Ana escribió:\n> hola",
    });
    clock = new Date("2026-10-19T12:05:00Z");
    await work();
    // No se le envió el seguimiento.
    expect(mail.sent.filter((x) => x.raw.includes("responde@x.example.com"))).toHaveLength(1);
    expect(await enrollmentOf(pid)).toMatchObject({ status: "stopped_replied" });
    const [conv] = await t.db.select().from(conversations).where(eq(conversations.prospectId, pid));
    const inbound = await t.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conv!.id), eq(messages.direction, "in")));
    expect(inbound.map((m) => m.body)).toEqual(["Me interesa, hablemos."]);
    expect(conv!.lastInboundAt).not.toBeNull();
    expect(
      (
        await withUserContext(t.db, { sub: ownerId }, (tx) =>
          getLeadStage(tx, orgId, pid, campaignId),
        )
      ).key,
    ).toBe("respondio");
  });

  it("una respuesta automática (fuera de oficina) no frena la secuencia", async () => {
    const pid = await prospect({ company: "Vacaciones", email: "vacas@x.example.com" });
    await enroll(await sequence());
    await work();
    mail.addReply(mail.sent.at(-1)!.threadId, {
      from: "vacas@x.example.com",
      text: "Estoy de vacaciones",
      autoSubmitted: true,
    });
    clock = new Date(clock.getTime() + 6 * 60_000); // próxima tanda de lectura (cada 5 min)
    await work();
    expect((await enrollmentOf(pid)).status).toBe("active");
    // Se guardó como respuesta automática, sin mover la etapa a "respondió".
    const [conv] = await t.db.select().from(conversations).where(eq(conversations.prospectId, pid));
    const inbound = await t.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conv!.id), eq(messages.direction, "in")));
    expect(inbound[0]?.body).toMatch(/^\[Respuesta automática\]/);
  });

  it("un rebote frena y suprime el email", async () => {
    const pid = await prospect({ company: "Rebote", email: "noexiste@x.example.com" });
    await enroll(await sequence());
    await work();
    mail.addReply(mail.sent.at(-1)!.threadId, {
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      text: "Address not found",
      isBounce: true,
    });
    clock = new Date(clock.getTime() + 6 * 60_000);
    await work();
    expect(await enrollmentOf(pid)).toMatchObject({ status: "stopped_bounced" });
    const sup = await t.db
      .select()
      .from(suppressionList)
      .where(
        and(
          eq(suppressionList.organizationId, orgId),
          eq(suppressionList.value, "noexiste@x.example.com"),
        ),
      );
    expect(sup[0]?.reason).toBe("bounced");
  });

  it("respeta el tope diario y el espaciado de la casilla", async () => {
    const seqId = await sequence();
    const a = await prospect({ company: "Tope A", email: "a@tope.example.com" });
    const b = await prospect({ company: "Tope B", email: "b@tope.example.com" });
    await enroll(seqId);
    // Espaciado: con 5 minutos de gap, el segundo se reprograma.
    deps = { ...deps, minGapSeconds: 300, maxGapSeconds: 300 };
    await work();
    const [ea, eb] = [await enrollmentOf(a), await enrollmentOf(b)];
    const sentOne = [ea, eb].filter((e) => e.currentStep === 1);
    const waiting = [ea, eb].find((e) => e.currentStep === 0)!;
    expect(sentOne).toHaveLength(1);
    expect(waiting.nextSendAt!.getTime()).toBe(WED_11_BA.getTime() + 300_000);

    // Tope: con límite alcanzado, pasa al día hábil siguiente.
    await t.db
      .update(connectedAccounts)
      .set({ dailySendLimit: 1, lastSentAt: null })
      .where(eq(connectedAccounts.id, mailboxId));
    deps = { ...deps, minGapSeconds: 0, maxGapSeconds: 0 };
    clock = new Date(WED_11_BA.getTime() + 600_000);
    await work();
    const after = await enrollmentOf(waiting.prospectId);
    expect(after.currentStep).toBe(0);
    expect(after.nextSendAt!.toISOString()).toBe("2026-10-15T12:00:00.000Z"); // jueves 9:00 BA
    await t.db
      .update(connectedAccounts)
      .set({ dailySendLimit: 50 })
      .where(eq(connectedAccounts.id, mailboxId));
  });

  it("la baja suprime el email y frena las secuencias; un suprimido nunca recibe", async () => {
    const pid = await prospect({ company: "Baja", email: "chau@x.example.com" });
    await enroll(await sequence());
    await unsubscribeEmail(t.db, { organizationId: orgId, email: "Chau@X.example.com" });
    await unsubscribeEmail(t.db, { organizationId: orgId, email: "chau@x.example.com" }); // idempotente
    expect(await enrollmentOf(pid)).toMatchObject({ status: "stopped_unsubscribed" });
    await work();
    expect(mail.sent.some((s) => s.raw.includes("chau@x.example.com"))).toBe(false);
  });

  it("si alguien entra a supresión entre inscripción y envío, no se envía", async () => {
    const pid = await prospect({ company: "Tarde", email: "tarde@x.example.com" });
    await enroll(await sequence());
    await t.db.insert(suppressionList).values({
      organizationId: orgId,
      kind: "email",
      value: "tarde@x.example.com",
      reason: "manual",
    });
    await work();
    expect(await enrollmentOf(pid)).toMatchObject({ status: "stopped_unsubscribed" });
    expect(mail.sent.some((s) => s.raw.includes("tarde@x.example.com"))).toBe(false);
  });

  it("procesar dos veces el mismo job no manda dos emails", async () => {
    const pid = await prospect({ company: "Doble", email: "doble@x.example.com" });
    await enroll(await sequence());
    await dispatchEmailWork(t.db, clock);
    const job = await claimNextJob(t.db, "test", { types: [SEND_JOB] });
    await runSendJob(deps, job!);
    await runSendJob(deps, job!);
    expect(mail.sent.filter((s) => s.raw.includes("doble@x.example.com"))).toHaveLength(1);
    expect((await enrollmentOf(pid)).currentStep).toBe(1);
  });

  it("si falta el borrador de IA al enviar, frena con el motivo (no sale un email roto)", async () => {
    const pid = await prospect({ company: "Sin dato", email: "sindato@x.example.com" });
    await enroll(await sequence());
    await t.db.delete(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    await work();
    expect(await enrollmentOf(pid)).toMatchObject({
      status: "stopped_manual",
      stopReason: /mensaje_ia|asunto_ia/,
    });
  });

  it("un setter no puede crear ni activar secuencias", async () => {
    const setter = await user(`s-${randomUUID()}@example.com`);
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgId}, ${setter}, 'setter')`,
    );
    await expect(
      withUserContext(t.db, { sub: setter }, (tx) =>
        createSequence(tx, {
          organizationId: orgId,
          campaignId,
          actorRole: "setter",
          data: sequenceInputSchema.parse({
            name: "x x x",
            mailboxAccountId: null,
            steps: [{ subject: "a", body: "cuerpo largo", delayDays: 0 }],
          }),
        }),
      ),
    ).rejects.toThrow(/Solo owners y admins/);
  });
});
