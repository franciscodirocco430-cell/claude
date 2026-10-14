"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { withUserContext } from "@/db/rls";
import type { ActionState } from "@/server/actions";
import { requireAppContext } from "@/server/auth/session";
import { queueCampaignPreparation, queueDraftRegeneration } from "@/server/ai/preparation";
import { isAdminRole } from "@/server/auth/permissions";
import {
  campaignInputSchema,
  fewShotExamplesSchema,
  issuesByPath,
} from "@/server/campaigns/schemas";
import {
  changeCampaignStatus,
  createCampaign,
  getProspectDetail,
  updateCampaign,
  updateFewShotExamples,
  type StatusAction,
} from "@/server/campaigns/service";
import { getDb } from "@/server/db";
import { userMessage } from "@/server/errors";
import type { RawProspect } from "@/server/prospects/candidate";
import {
  applyMapping,
  CSV_FIELDS,
  CsvError,
  parseCsv,
  validateMapping,
} from "@/server/prospects/csv";
import { ingestProspects, type IngestReport, type RowOutcome } from "@/server/prospects/ingest";
import { parseProfileInput } from "@/server/prospects/profile-url";

// La organización y el actor salen siempre de la sesión. Todas las escrituras
// corren con withUserContext: RLS es la última barrera aunque falle un chequeo.

const uuid = z.uuid();

export async function saveCampaignAction(input: {
  campaignId?: string;
  values: unknown;
  activate?: boolean;
}): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = campaignInputSchema.safeParse(input.values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos marcados.",
      fieldErrors: issuesByPath(parsed.error),
    };
  }
  if (input.campaignId && !uuid.safeParse(input.campaignId).success) {
    return { status: "error", message: "Campaña inválida." };
  }

  let id: string;
  try {
    id = await withUserContext(getDb(), { sub: ctx.user.id }, async (tx) => {
      if (input.campaignId) {
        const row = await updateCampaign(tx, {
          organizationId: ctx.organizationId,
          actorRole: ctx.role,
          id: input.campaignId,
          data: parsed.data,
        });
        return row.id;
      }
      const row = await createCampaign(tx, {
        organizationId: ctx.organizationId,
        actorId: ctx.user.id,
        actorRole: ctx.role,
        data: parsed.data,
        activate: input.activate,
      });
      return row.id;
    });
  } catch (error) {
    console.error(error);
    return { status: "error", message: userMessage(error) };
  }
  redirect(`/campanas/${id}`);
}

const statusSchema = z.object({
  campaignId: z.uuid(),
  action: z.enum(["activate", "pause", "archive", "restore"]),
});

export async function changeCampaignStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Acción inválida." };
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      changeCampaignStatus(tx, {
        organizationId: ctx.organizationId,
        actorRole: ctx.role,
        id: parsed.data.campaignId,
        action: parsed.data.action as StatusAction,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success" };
}

/** Lo que vuelve al cliente: totales y solo las filas con algún problema o aviso. */
export interface ImportResult {
  report: Omit<IngestReport, "outcomes">;
  issues: RowOutcome[];
}

const MAX_ISSUES = 500;

const importSchema = z.object({
  campaignId: z.uuid(),
  fileName: z.string().max(200),
  csvText: z.string(),
  mapping: z.array(z.enum(CSV_FIELDS).nullable()),
});

export async function importCsvAction(input: unknown): Promise<ActionState<ImportResult>> {
  const ctx = await requireAppContext();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Datos de importación inválidos." };
  const { campaignId, fileName, csvText, mapping } = parsed.data;

  // El servidor vuelve a parsear: no confía en lo que el navegador mostró.
  let csv;
  try {
    csv = parseCsv(csvText);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof CsvError ? error.message : "No pudimos leer el archivo.",
    };
  }
  const mappingError = validateMapping(mapping, csv.headers.length);
  if (mappingError) return { status: "error", message: mappingError };

  try {
    const report = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      ingestProspects(tx, {
        organizationId: ctx.organizationId,
        campaignId,
        source: "csv",
        sourceRef: fileName,
        rows: csv.rows.map((row, i) => ({ row: i + 2, raw: applyMapping(row, mapping) })),
      }),
    );
    const { outcomes, ...totals } = report;
    return {
      status: "success",
      data: {
        report: totals,
        issues: outcomes
          .filter((o) => o.status !== "created" || o.warnings.length > 0)
          .slice(0, MAX_ISSUES),
      },
    };
  } catch (error) {
    console.error(error);
    return { status: "error", message: userMessage(error) };
  }
}

const manualSchema = z.object({
  campaignId: z.uuid(),
  target: z.string().trim().max(500).optional().default(""),
  fullName: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  whatsappOptIn: z.string().optional(),
  whatsappOptInDate: z.string().optional(),
});

export async function addProspectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const values = Object.fromEntries(
    [...formData.entries()].filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const parsed = manualSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Datos inválidos.", values };
  const { campaignId, target, whatsappOptIn, ...rest } = parsed.data;

  const raw: RawProspect = { ...rest, whatsappOptIn: whatsappOptIn === "on" ? "si" : "" };
  const detected = target ? parseProfileInput(target) : null;
  if (target && !detected) {
    return {
      status: "error",
      fieldErrors: { target: "No reconocemos ese link. Pegá un perfil, una web o un email." },
      values,
    };
  }
  if (detected?.kind === "handle") {
    if (detected.channel === "whatsapp") raw.phone ||= detected.handle;
    else raw[detected.channel] = detected.url;
  } else if (detected?.kind === "website") raw.website = detected.url;
  else if (detected?.kind === "email") raw.email ||= detected.email;

  let report: IngestReport;
  try {
    report = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      ingestProspects(tx, {
        organizationId: ctx.organizationId,
        campaignId,
        source: detected ? "url" : "manual",
        ownerId: ctx.user.id,
        rows: [{ row: 1, raw }],
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error), values };
  }

  const outcome = report.outcomes[0];
  if (outcome?.status !== "created") {
    const message =
      outcome?.status === "duplicate_existing"
        ? "Este prospecto ya existe en tu organización."
        : outcome?.status === "suppressed"
          ? "Este contacto está en la lista de supresión: no se puede cargar."
          : (outcome?.reason ?? "No pudimos cargar el prospecto.");
    return { status: "error", message, values };
  }
  redirect(`/campanas/${campaignId}?agregado=1`);
}

// ───────────────────────────── IA (Fase 3) ─────────────────────────────

const prepareSchema = z.object({ campaignId: z.uuid() });

/** Encola investigación + borradores para los prospectos pendientes (solo owner/admin: tiene costo). */
export async function prepareCampaignAction(
  _prev: ActionState<{ queued: number }>,
  formData: FormData,
): Promise<ActionState<{ queued: number }>> {
  const ctx = await requireAppContext();
  if (!isAdminRole(ctx.role)) {
    return { status: "error", message: "Solo owners y admins pueden preparar mensajes en lote." };
  }
  const parsed = prepareSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Campaña inválida." };
  try {
    const result = await queueCampaignPreparation(getDb(), {
      organizationId: ctx.organizationId,
      campaignId: parsed.data.campaignId,
    });
    return {
      status: "success",
      message:
        result.queued === 0
          ? "No hay prospectos pendientes."
          : `Preparando ${result.queued} ${result.queued === 1 ? "prospecto" : "prospectos"}.`,
      data: result,
    };
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
}

const prospectActionSchema = z.object({
  campaignId: z.uuid(),
  prospectId: z.uuid(),
  channel: z.enum(["instagram", "facebook", "tiktok", "whatsapp", "email"]).optional(),
});

/** Vuelve a investigar un prospecto (y rehace sus borradores). */
export async function reresearchProspectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = prospectActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  try {
    const { queued } = await queueCampaignPreparation(getDb(), {
      organizationId: ctx.organizationId,
      campaignId: parsed.data.campaignId,
      prospectIds: [parsed.data.prospectId],
    });
    if (queued === 0)
      return { status: "error", message: "La IA ya está trabajando en este prospecto." };
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success" };
}

export async function regenerateDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  const parsed = prospectActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.channel)
    return { status: "error", message: "Datos inválidos." };
  try {
    // Verifica que el prospecto sea de esta organización y campaña antes de encolar.
    const detail = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      getProspectDetail(tx, {
        organizationId: ctx.organizationId,
        campaignId: parsed.data.campaignId,
        prospectId: parsed.data.prospectId,
      }),
    );
    if (!detail) return { status: "error", message: "El prospecto no existe." };
    await queueDraftRegeneration(getDb(), {
      organizationId: ctx.organizationId,
      prospectId: parsed.data.prospectId,
      channel: parsed.data.channel,
    });
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success" };
}

export async function saveExamplesAction(input: {
  campaignId: string;
  examples: unknown;
}): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!uuid.safeParse(input.campaignId).success)
    return { status: "error", message: "Campaña inválida." };
  const parsed = fewShotExamplesSchema.safeParse(input.examples);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los ejemplos marcados.",
      fieldErrors: issuesByPath(parsed.error),
    };
  }
  try {
    await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
      updateFewShotExamples(tx, {
        organizationId: ctx.organizationId,
        actorRole: ctx.role,
        id: input.campaignId,
        examples: parsed.data,
      }),
    );
  } catch (error) {
    return { status: "error", message: userMessage(error) };
  }
  return { status: "success", message: "Ejemplos guardados." };
}
