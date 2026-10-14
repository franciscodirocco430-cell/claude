import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUserContext } from "@/db/rls";
import {
  campaigns,
  conversations,
  leadScores,
  messages,
  outreachTasks,
  pipelineStages,
  prospects,
  suppressionList,
} from "@/db/schema";
import { campaignInputSchema, emptyCampaign } from "@/server/campaigns/schemas";
import { createCampaign } from "@/server/campaigns/service";
import { createOrganization } from "@/server/organizations/service";
import { ingestProspects } from "@/server/prospects/ingest";
import { getLeadStage, getQueueState, markTaskSent, skipTask } from "@/server/queue/service";
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from "./setup";

const TZ = "America/Argentina/Buenos_Aires";

describe.skipIf(!TEST_DATABASE_URL)("cola del setter", () => {
  let t: TestDatabase;
  let orgId: string;
  let ownerId: string;
  let setterA: string;
  let setterB: string;
  let campaignId: string;

  const as = <T>(userId: string, fn: Parameters<typeof withUserContext<T>>[2]) =>
    withUserContext(t.db, { sub: userId }, fn);
  const state = (userId: string) =>
    as(userId, (tx) => getQueueState(tx, { organizationId: orgId, userId, timeZone: TZ }));

  async function user(email: string) {
    const id = randomUUID();
    await t.db.execute(sql`insert into auth.users (id, email) values (${id}, ${email})`);
    return id;
  }

  /** Crea un prospecto con tareas listas (como si la IA ya hubiera redactado). */
  async function prospectWithTasks(
    raw: Record<string, string>,
    channels: ("instagram" | "whatsapp" | "email")[],
  ) {
    const report = await as(ownerId, (tx) =>
      ingestProspects(tx, {
        organizationId: orgId,
        campaignId,
        source: "manual",
        rows: [{ row: 1, raw }],
      }),
    );
    const prospectId = report.outcomes[0]!.prospectId!;
    for (const channel of channels) {
      await t.db.insert(outreachTasks).values({
        organizationId: orgId,
        campaignId,
        prospectId,
        channel,
        status: "ready",
        draftMessage: `Hola desde ${channel}, ¿cómo va?`,
      });
    }
    return prospectId;
  }

  beforeAll(async () => {
    t = await createTestDatabase();
    ownerId = await user(`o-${randomUUID()}@example.com`);
    setterA = await user(`a-${randomUUID()}@example.com`);
    setterB = await user(`b-${randomUUID()}@example.com`);
    orgId = (await createOrganization(t.db, { userId: ownerId, name: "Org cola" })).id;
    await t.db.execute(sql`insert into memberships (organization_id, user_id, role) values
      (${orgId}, ${setterA}, 'setter'), (${orgId}, ${setterB}, 'setter')`);
    const data = campaignInputSchema.parse({
      ...emptyCampaign(),
      name: "Campaña cola",
      niche: "Clínicas",
      offer: "Oferta de prueba larga",
      icp: "ICP de prueba largo",
      qualificationCriteria: [{ label: "Presupuesto", weight: 50 }],
      qualificationQuestions: ["¿Cuántos?"],
      channels: ["instagram", "whatsapp", "email"],
      dailyLimits: { instagram: 2, whatsapp: 5, email: 40 },
    });
    campaignId = (
      await as(ownerId, (tx) =>
        createCampaign(tx, {
          organizationId: orgId,
          actorId: ownerId,
          actorRole: "owner",
          data,
          activate: true,
        }),
      )
    ).id;
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("dos setters a la vez nunca reciben la misma tarea", async () => {
    await prospectWithTasks({ company: "Uno", instagram: "uno.ig" }, ["instagram"]);
    await prospectWithTasks({ company: "Dos", instagram: "dos.ig" }, ["instagram"]);
    const [a, b] = await Promise.all([state(setterA), state(setterB)]);
    expect(a.task && b.task).toBeTruthy();
    expect(a.task!.id).not.toBe(b.task!.id);
    // Volver a pedir devuelve la misma (ya asignada), no otra.
    expect((await state(setterA)).task!.id).toBe(a.task!.id);
    expect(a.task!.openUrl).toMatch(/^https:\/\/ig\.me\/m\//);
    // El email nunca aparece en la cola manual.
    expect(a.task!.channel).toBe("instagram");
  });

  it("marcar enviado: conversación, mensaje humano, etapa contactado y saltea los otros canales", async () => {
    const pid = await prospectWithTasks(
      {
        company: "Multi",
        instagram: "multi.ig",
        phone: "+5491133334444",
        email: "m@multi.example.com",
      },
      ["instagram", "whatsapp", "email"],
    );
    // Avanzar la cola de A hasta este prospecto.
    let s = await state(setterA);
    while (s.task && s.task.prospect.id !== pid) {
      await as(setterA, (tx) =>
        skipTask(tx, { organizationId: orgId, userId: setterA, timeZone: TZ, taskId: s.task!.id }),
      );
      s = await state(setterA);
    }
    expect(s.task?.prospect.id).toBe(pid);
    const taskId = s.task!.id;
    const channel = s.task!.channel;
    await as(setterA, (tx) =>
      markTaskSent(tx, {
        organizationId: orgId,
        userId: setterA,
        timeZone: TZ,
        taskId,
        message: "  Mensaje editado  ",
      }),
    );

    const [task] = await t.db.select().from(outreachTasks).where(eq(outreachTasks.id, taskId));
    expect(task).toMatchObject({
      status: "sent_manual",
      sentBy: setterA,
      draftMessage: "Mensaje editado",
    });
    const [conv] = await t.db.select().from(conversations).where(eq(conversations.prospectId, pid));
    expect(conv).toMatchObject({ channel, businessMessagesSinceInbound: 1 });
    const [msg] = await t.db.select().from(messages).where(eq(messages.conversationId, conv!.id));
    expect(msg).toMatchObject({
      direction: "out",
      author: "human",
      body: "Mensaje editado",
      sentByUserId: setterA,
    });
    expect(await as(setterA, (tx) => getLeadStage(tx, orgId, pid, campaignId))).toEqual({
      name: "Contactado",
      key: "contactado",
    });

    const others = await t.db
      .select()
      .from(outreachTasks)
      .where(and(eq(outreachTasks.prospectId, pid)));
    const other = others.find((o) => o.channel !== channel && o.channel !== "email")!;
    expect(other).toMatchObject({ status: "skipped", skippedReason: /Ya se contactó/ });
    // El email (automático) no se toca.
    expect(others.find((o) => o.channel === "email")?.status).toBe("ready");

    // No se puede marcar dos veces.
    await expect(
      as(setterA, (tx) =>
        markTaskSent(tx, {
          organizationId: orgId,
          userId: setterA,
          timeZone: TZ,
          taskId,
          message: "x",
        }),
      ),
    ).rejects.toThrow(/ya no está disponible/);
  });

  it("no hace retroceder la etapa de un lead más avanzado", async () => {
    const pid = await prospectWithTasks({ company: "Avanzado", instagram: "avanzado.ig" }, [
      "instagram",
    ]);
    const [agendado] = await t.db
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.organizationId, orgId), eq(pipelineStages.key, "agendado")));
    await t.db
      .insert(leadScores)
      .values({ organizationId: orgId, prospectId: pid, campaignId, stageId: agendado!.id });
    const [task] = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    await as(setterB, (tx) =>
      markTaskSent(tx, {
        organizationId: orgId,
        userId: setterB,
        timeZone: TZ,
        taskId: task!.id,
        message: "Hola",
      }),
    );
    expect((await as(setterB, (tx) => getLeadStage(tx, orgId, pid, campaignId))).key).toBe(
      "agendado",
    );
  });

  it("respeta el tope diario por setter y canal", async () => {
    // Instagram tiene tope 2. B ya envió 1 en el test anterior.
    const fresh = await user(`c-${randomUUID()}@example.com`);
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgId}, ${fresh}, 'setter')`,
    );
    for (let i = 0; i < 3; i++)
      await prospectWithTasks({ company: `Tope ${i}`, instagram: `tope${i}.ig` }, ["instagram"]);
    for (let i = 0; i < 2; i++) {
      const s = await as(fresh, (tx) =>
        getQueueState(tx, { organizationId: orgId, userId: fresh, timeZone: TZ }),
      );
      await as(fresh, (tx) =>
        markTaskSent(tx, {
          organizationId: orgId,
          userId: fresh,
          timeZone: TZ,
          taskId: s.task!.id,
          message: "Hola",
        }),
      );
    }
    const s = await as(fresh, (tx) =>
      getQueueState(tx, { organizationId: orgId, userId: fresh, timeZone: TZ }),
    );
    expect(s.task).toBeNull();
    expect(s.limitReached).toBe(true);
    expect(s.counters.find((c) => c.channel === "instagram")).toMatchObject({ sent: 2, limit: 2 });
    // El tope es por setter: otro setter sigue pudiendo.
    expect((await state(setterA)).task).not.toBeNull();
  });

  it("saltea automáticamente contactos que entraron a la lista de supresión", async () => {
    const pid = await prospectWithTasks({ company: "Suprimir", phone: "+5491155556666" }, [
      "whatsapp",
    ]);
    await t.db.insert(suppressionList).values({
      organizationId: orgId,
      kind: "phone",
      value: "+5491155556666",
      reason: "requested",
    });
    const lone = await user(`d-${randomUUID()}@example.com`);
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgId}, ${lone}, 'setter')`,
    );
    for (let i = 0; i < 20; i++) {
      const s = await as(lone, (tx) =>
        getQueueState(tx, { organizationId: orgId, userId: lone, timeZone: TZ }),
      );
      if (!s.task) break;
      expect(s.task.prospect.id).not.toBe(pid);
      await as(lone, (tx) =>
        skipTask(tx, { organizationId: orgId, userId: lone, timeZone: TZ, taskId: s.task!.id }),
      );
    }
    const [task] = await t.db.select().from(outreachTasks).where(eq(outreachTasks.prospectId, pid));
    expect(task).toMatchObject({ status: "skipped", skippedReason: "En lista de supresión." });
  });

  it("mientras la IA regenera el mensaje, la tarea no se muestra", async () => {
    const pid = await prospectWithTasks({ company: "Regenera", instagram: "regenera.ig" }, [
      "instagram",
    ]);
    const other = await user(`r-${randomUUID()}@example.com`);
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgId}, ${other}, 'setter')`,
    );
    await t.db.update(prospects).set({ aiStatus: "drafting" }).where(eq(prospects.id, pid));
    for (let i = 0; i < 20; i++) {
      const s = await as(other, (tx) =>
        getQueueState(tx, { organizationId: orgId, userId: other, timeZone: TZ }),
      );
      if (!s.task) break;
      expect(s.task.prospect.id).not.toBe(pid);
      await as(other, (tx) =>
        skipTask(tx, { organizationId: orgId, userId: other, timeZone: TZ, taskId: s.task!.id }),
      );
    }
    await t.db.update(prospects).set({ aiStatus: "ready" }).where(eq(prospects.id, pid));
    const s = await as(other, (tx) =>
      getQueueState(tx, { organizationId: orgId, userId: other, timeZone: TZ }),
    );
    expect(s.task?.prospect.id).toBe(pid);
  });

  it("no muestra tareas de campañas pausadas", async () => {
    await prospectWithTasks({ company: "Pausa", instagram: "pausa.ig" }, ["instagram"]);
    await t.db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaignId));
    const other = await user(`e-${randomUUID()}@example.com`);
    await t.db.execute(
      sql`insert into memberships (organization_id, user_id, role) values (${orgId}, ${other}, 'setter')`,
    );
    const s = await as(other, (tx) =>
      getQueueState(tx, { organizationId: orgId, userId: other, timeZone: TZ }),
    );
    expect(s.task).toBeNull();
    await t.db.update(campaigns).set({ status: "active" }).where(eq(campaigns.id, campaignId));
  });

  it("alguien de otra organización no puede marcar tareas de esta", async () => {
    const outsider = await user(`x-${randomUUID()}@example.com`);
    const otherOrg = (await createOrganization(t.db, { userId: outsider, name: "Ajena" })).id;
    const [task] = await t.db
      .select()
      .from(outreachTasks)
      .where(eq(outreachTasks.status, "ready"))
      .limit(1);
    await expect(
      as(outsider, (tx) =>
        markTaskSent(tx, {
          organizationId: orgId,
          userId: outsider,
          timeZone: TZ,
          taskId: task!.id,
          message: "x",
        }),
      ),
    ).rejects.toThrow(/ya no está disponible/);
    await expect(
      as(outsider, (tx) =>
        markTaskSent(tx, {
          organizationId: otherOrg,
          userId: outsider,
          timeZone: TZ,
          taskId: task!.id,
          message: "x",
        }),
      ),
    ).rejects.toThrow(/ya no está disponible/);
    const [after] = await t.db.select().from(outreachTasks).where(eq(outreachTasks.id, task!.id));
    expect(after?.status).toBe("ready");
  });
});
