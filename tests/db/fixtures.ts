import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { DEFAULT_PIPELINE_STAGES } from "@/server/pipeline/default-stages";

export interface OrgFixture {
  orgId: string;
  ownerId: string;
  setterId: string;
  campaignId: string;
  prospectId: string;
  conversationId: string;
  accountId: string;
  sequenceId: string;
  stageId: string;
}

/** Crea una organización con al menos una fila en cada tabla multi-tenant. */
export async function createOrgFixture(db: Database, label: string): Promise<OrgFixture> {
  const f: OrgFixture = {
    orgId: randomUUID(),
    ownerId: randomUUID(),
    setterId: randomUUID(),
    campaignId: randomUUID(),
    prospectId: randomUUID(),
    conversationId: randomUUID(),
    accountId: randomUUID(),
    sequenceId: randomUUID(),
    stageId: randomUUID(),
  };

  await db.transaction(async (tx) => {
    await tx.execute(sql`insert into auth.users (id, email) values
      (${f.ownerId}, ${`owner-${label}-${f.orgId}@example.com`}),
      (${f.setterId}, ${`setter-${label}-${f.orgId}@example.com`})`);
    await tx
      .insert(s.organizations)
      .values({ id: f.orgId, name: label, slug: `${label}-${f.orgId}` });
    await tx.insert(s.memberships).values([
      { organizationId: f.orgId, userId: f.ownerId, role: "owner" },
      { organizationId: f.orgId, userId: f.setterId, role: "setter" },
    ]);
    await tx.insert(s.pipelineStages).values(
      DEFAULT_PIPELINE_STAGES.map((st, i) => ({
        ...st,
        id: i === 0 ? f.stageId : undefined,
        organizationId: f.orgId,
      })),
    );
    await tx.insert(s.connectedAccounts).values({
      id: f.accountId,
      organizationId: f.orgId,
      provider: "google",
      channel: "email",
      externalId: `mailbox-${label}`,
    });
    await tx.insert(s.connectedAccountSecrets).values({
      connectedAccountId: f.accountId,
      organizationId: f.orgId,
      accessTokenEnc: "v1.fake.fake.fake",
    });
    await tx.insert(s.campaigns).values({
      id: f.campaignId,
      organizationId: f.orgId,
      name: `Campaña ${label}`,
      niche: "nicho",
      offer: "oferta",
      icp: "icp",
    });
    await tx.insert(s.prospects).values({
      id: f.prospectId,
      organizationId: f.orgId,
      campaignId: f.campaignId,
      fullName: `Prospecto ${label}`,
    });
    await tx.insert(s.prospectHandles).values({
      organizationId: f.orgId,
      prospectId: f.prospectId,
      channel: "instagram",
      handle: `handle_${label}`,
    });
    await tx.insert(s.researchNotes).values({
      organizationId: f.orgId,
      prospectId: f.prospectId,
      summary: "resumen",
    });
    await tx.insert(s.leadScores).values({
      organizationId: f.orgId,
      prospectId: f.prospectId,
      campaignId: f.campaignId,
      stageId: f.stageId,
    });
    await tx.insert(s.outreachTasks).values({
      organizationId: f.orgId,
      prospectId: f.prospectId,
      campaignId: f.campaignId,
      channel: "instagram",
    });
    await tx.insert(s.conversations).values({
      id: f.conversationId,
      organizationId: f.orgId,
      prospectId: f.prospectId,
      channel: "instagram",
    });
    await tx.insert(s.messages).values({
      organizationId: f.orgId,
      conversationId: f.conversationId,
      direction: "out",
      author: "human",
      body: "hola",
    });
    await tx.insert(s.notifications).values({
      organizationId: f.orgId,
      kind: "handoff",
      title: "aviso",
      conversationId: f.conversationId,
    });
    await tx.insert(s.meetings).values({
      organizationId: f.orgId,
      prospectId: f.prospectId,
      conversationId: f.conversationId,
      externalEventId: `evento-${label}`,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 1_800_000),
    });
    await tx.insert(s.emailSequences).values({
      id: f.sequenceId,
      organizationId: f.orgId,
      name: "Secuencia",
    });
    await tx.insert(s.sequenceSteps).values({
      organizationId: f.orgId,
      sequenceId: f.sequenceId,
      position: 0,
      subject: "asunto",
      body: "cuerpo",
    });
    await tx.insert(s.sequenceEnrollments).values({
      organizationId: f.orgId,
      sequenceId: f.sequenceId,
      prospectId: f.prospectId,
    });
    await tx.insert(s.suppressionList).values({
      organizationId: f.orgId,
      kind: "email",
      value: `baja-${label}@example.com`,
      reason: "unsubscribed",
    });
    await tx.insert(s.invitations).values({
      organizationId: f.orgId,
      email: `pendiente-${label}@example.com`,
      tokenHash: `fixture-${f.orgId}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await tx.insert(s.aiRuns).values({ organizationId: f.orgId, type: "research", model: "test" });
    await tx.insert(s.jobs).values({ organizationId: f.orgId, type: "noop" });
  });

  return f;
}
