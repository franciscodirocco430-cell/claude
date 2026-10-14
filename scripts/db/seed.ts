import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDatabase } from "@/db/client";
import * as s from "@/db/schema";
import { DEFAULT_PIPELINE_STAGES } from "@/server/pipeline/default-stages";
import { websiteDomain } from "@/server/prospects/normalize";

/**
 * Datos de ejemplo para desarrollo local. Todos los datos son ficticios
 * (dominios example.com, teléfonos inexistentes). IDs fijos → idempotente.
 *
 * Los usuarios se insertan directo en auth.users solo para tener dueños de los
 * datos; para loguearte creá tu usuario desde la app (Fase 1).
 */
export const SEED = {
  ownerId: "00000000-0000-4000-8000-000000000001",
  setterId: "00000000-0000-4000-8000-000000000002",
  orgId: "00000000-0000-4000-8000-0000000000a1",
  campaignId: "00000000-0000-4000-8000-0000000000c1",
  sequenceId: "00000000-0000-4000-8000-0000000000e1",
} as const;

// IDs fijos también en handles: re-ejecutar el seed no los duplica.
const prospectSeeds = [
  {
    id: "00000000-0000-4000-8000-000000000b01",
    fullName: "Laura Gómez",
    company: "Sonrisas Palermo",
    industry: "Odontología",
    website: "https://sonrisas-palermo.example.com",
    email: "laura@sonrisas-palermo.example.com",
    phone: "+5491100000001",
    handles: [
      {
        id: "00000000-0000-4000-8000-000000000d01",
        channel: "instagram" as const,
        handle: "sonrisaspalermo.demo",
      },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000b02",
    fullName: "Martín Ruiz",
    company: "Clínica Dental Ruiz",
    industry: "Odontología",
    website: "https://dentalruiz.example.com",
    email: "martin@dentalruiz.example.com",
    phone: "+5491100000002",
    handles: [
      {
        id: "00000000-0000-4000-8000-000000000d02",
        channel: "whatsapp" as const,
        handle: "+5491100000002",
      },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000b03",
    fullName: "Carla Benítez",
    company: "Ortodoncia Belgrano",
    industry: "Odontología",
    website: null,
    email: "carla@orto-belgrano.example.com",
    phone: null,
    handles: [
      {
        id: "00000000-0000-4000-8000-000000000d03",
        channel: "tiktok" as const,
        handle: "ortobelgrano.demo",
      },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000b04",
    fullName: "Diego Fernández",
    company: "Implantes Caballito",
    industry: "Odontología",
    website: "https://implantes-caballito.example.com",
    email: "diego@implantes-caballito.example.com",
    phone: "+5491100000004",
    handles: [
      {
        id: "00000000-0000-4000-8000-000000000d04",
        channel: "facebook" as const,
        url: "https://facebook.com/implantes.demo",
      },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const { db, sql: client } = createDatabase(url, { max: 1 });

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into auth.users (id, email) values
          (${SEED.ownerId}, 'owner@demo.example.com'),
          (${SEED.setterId}, 'setter@demo.example.com')
        on conflict (id) do nothing`);

      await tx
        .insert(s.organizations)
        .values({ id: SEED.orgId, name: "Agencia Demo", slug: "agencia-demo" })
        .onConflictDoNothing();

      await tx
        .insert(s.memberships)
        .values([
          { organizationId: SEED.orgId, userId: SEED.ownerId, role: "owner" },
          { organizationId: SEED.orgId, userId: SEED.setterId, role: "setter" },
        ])
        .onConflictDoNothing();

      await tx
        .insert(s.pipelineStages)
        .values(DEFAULT_PIPELINE_STAGES.map((st) => ({ ...st, organizationId: SEED.orgId })))
        .onConflictDoNothing();

      await tx
        .insert(s.campaigns)
        .values({
          id: SEED.campaignId,
          organizationId: SEED.orgId,
          name: "Odontólogos CABA — Q4",
          status: "active",
          niche: "Clínicas odontológicas independientes",
          nicheReferences: [
            "Referente de marketing dental (ejemplo)",
            "Podcast del sector (ejemplo)",
          ],
          offer: "Sistema de captación de pacientes particulares con turnos agendados",
          icp: "Clínicas con 2 a 10 sillones en CABA que dependen de obras sociales",
          qualificationCriteria: [
            { label: "Tiene presupuesto de marketing", weight: 40 },
            { label: "Capacidad ociosa en la agenda", weight: 30 },
            { label: "Decisor en la conversación", weight: 30 },
          ],
          qualificationQuestions: [
            "¿Cuántos pacientes particulares nuevos reciben por mes?",
            "¿Hoy invierten en publicidad? ¿Cuánto aproximadamente?",
            "¿Quién toma las decisiones de marketing en la clínica?",
          ],
          channels: ["instagram", "whatsapp", "email"],
          tone: "Cercano, profesional, sin vender de entrada",
          dailyLimits: { instagram: 30, whatsapp: 20, email: 40 },
          createdBy: SEED.ownerId,
        })
        .onConflictDoNothing();

      for (const p of prospectSeeds) {
        const { handles, ...data } = p;
        await tx
          .insert(s.prospects)
          .values({
            ...data,
            websiteDomain: websiteDomain(data.website),
            organizationId: SEED.orgId,
            campaignId: SEED.campaignId,
            source: "manual",
            ownerId: SEED.setterId,
          })
          .onConflictDoNothing();
        await tx
          .insert(s.prospectHandles)
          .values(handles.map((h) => ({ ...h, organizationId: SEED.orgId, prospectId: p.id })))
          .onConflictDoNothing();
      }

      await tx
        .insert(s.suppressionList)
        .values({
          organizationId: SEED.orgId,
          kind: "email",
          value: "no-contactar@example.com",
          reason: "unsubscribed",
        })
        .onConflictDoNothing();

      await tx
        .insert(s.emailSequences)
        .values({
          id: SEED.sequenceId,
          organizationId: SEED.orgId,
          campaignId: SEED.campaignId,
          name: "Secuencia inicial odontólogos",
        })
        .onConflictDoNothing();

      await tx
        .insert(s.sequenceSteps)
        .values([
          {
            organizationId: SEED.orgId,
            sequenceId: SEED.sequenceId,
            position: 0,
            delayHours: 0,
            subject: "Una idea para {{company}}",
            body: "Hola {{first_name}}, ...",
          },
          {
            organizationId: SEED.orgId,
            sequenceId: SEED.sequenceId,
            position: 1,
            delayHours: 72,
            subject: "Re: Una idea para {{company}}",
            body: "{{first_name}}, te escribo de nuevo por si se perdió el mail anterior...",
          },
        ])
        .onConflictDoNothing();
    });
    console.log("Seed aplicado: org 'Agencia Demo' con 1 campaña y 4 prospectos.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
