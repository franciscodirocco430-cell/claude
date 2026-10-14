import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import type { DbExecutor } from "@/db/rls";
import type { prospectSource } from "@/db/schema";
import { campaigns, prospectHandles, prospects, suppressionList } from "@/db/schema";
import { DomainError } from "@/server/errors";
import { dedupeKeys, toCandidate, type ProspectCandidate, type RawProspect } from "./candidate";
import { websiteDomain } from "./normalize";

export type ProspectSourceKind = (typeof prospectSource.enumValues)[number];

export type RowStatus =
  "created" | "duplicate_in_file" | "duplicate_existing" | "suppressed" | "invalid";

export interface RowOutcome {
  /** Número de fila tal como lo ve el usuario (en CSV, la 2 es la primera de datos). */
  row: number;
  status: RowStatus;
  reason?: string;
  warnings: string[];
  prospectId?: string;
}

export interface IngestReport {
  created: number;
  duplicatesInFile: number;
  duplicatesExisting: number;
  suppressed: number;
  invalid: number;
  outcomes: RowOutcome[];
}

export interface IngestInput {
  organizationId: string;
  campaignId: string;
  source: ProspectSourceKind;
  sourceRef?: string | null;
  ownerId?: string | null;
  rows: { row: number; raw: RawProspect }[];
  now?: Date;
}

const BATCH = 500;

function chunks<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Carga prospectos en una campaña: normaliza, descarta inválidos, deduplica
 * (dentro del lote y contra la organización), respeta la lista de supresión e
 * inserta. Correr dentro de `withUserContext` para que aplique RLS.
 */
export async function ingestProspects(db: DbExecutor, input: IngestInput): Promise<IngestReport> {
  const [campaign] = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(
      and(eq(campaigns.id, input.campaignId), eq(campaigns.organizationId, input.organizationId)),
    );
  if (!campaign) throw new DomainError("not_found", "La campaña no existe.");
  if (campaign.status === "archived") {
    throw new DomainError("archived", "La campaña está archivada: no se pueden sumar prospectos.");
  }

  const outcomes: RowOutcome[] = [];
  const valid: { row: number; candidate: ProspectCandidate; keys: string[]; warnings: string[] }[] =
    [];
  const seen = new Set<string>();

  for (const { row, raw } of input.rows) {
    const result = toCandidate(raw, input.now);
    if (!result.ok) {
      outcomes.push({ row, status: "invalid", reason: result.error, warnings: result.warnings });
      continue;
    }
    const keys = dedupeKeys(result.candidate);
    if (keys.some((k) => seen.has(k))) {
      outcomes.push({
        row,
        status: "duplicate_in_file",
        reason: "Repetido dentro del mismo archivo.",
        warnings: result.warnings,
      });
      continue;
    }
    keys.forEach((k) => seen.add(k));
    valid.push({ row, candidate: result.candidate, keys, warnings: result.warnings });
  }

  const existing = await existingKeys(
    db,
    input.organizationId,
    valid.map((v) => v.candidate),
  );
  const suppressed = await suppressedKeys(
    db,
    input.organizationId,
    valid.map((v) => v.candidate),
  );

  const toInsert: (typeof valid)[number][] = [];
  for (const v of valid) {
    if (v.keys.some((k) => suppressed.has(k))) {
      outcomes.push({
        row: v.row,
        status: "suppressed",
        reason: "Está en la lista de supresión.",
        warnings: v.warnings,
      });
    } else if (v.keys.some((k) => existing.has(k))) {
      outcomes.push({
        row: v.row,
        status: "duplicate_existing",
        reason: "Ya existe en tu organización.",
        warnings: v.warnings,
      });
    } else {
      toInsert.push(v);
    }
  }

  for (const batch of chunks(toInsert)) {
    const values = batch.map((v) => ({
      id: randomUUID(),
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      fullName: v.candidate.fullName,
      company: v.candidate.company,
      industry: v.candidate.industry,
      website: v.candidate.website,
      websiteDomain: websiteDomain(v.candidate.website),
      email: v.candidate.email,
      phone: v.candidate.phone,
      notes: v.candidate.notes,
      source: input.source,
      sourceRef: input.sourceRef ?? null,
      ownerId: input.ownerId ?? null,
      whatsappOptIn: v.candidate.whatsappOptInAt !== null,
      whatsappOptInAt: v.candidate.whatsappOptInAt,
      whatsappOptInSource: v.candidate.whatsappOptInAt ? input.source : null,
    }));
    // ON CONFLICT: si otro import cargó el mismo email/teléfono en paralelo, gana el primero.
    const inserted = await db
      .insert(prospects)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: prospects.id });
    const insertedIds = new Set(inserted.map((r) => r.id));

    const handleRows = batch.flatMap((v, i) =>
      insertedIds.has(values[i]!.id)
        ? v.candidate.handles.map((h) => ({
            organizationId: input.organizationId,
            prospectId: values[i]!.id,
            channel: h.channel,
            handle: h.handle,
            url: h.url,
          }))
        : [],
    );
    if (handleRows.length > 0) {
      await db.insert(prospectHandles).values(handleRows).onConflictDoNothing();
    }

    batch.forEach((v, i) => {
      const id = values[i]!.id;
      outcomes.push(
        insertedIds.has(id)
          ? { row: v.row, status: "created", warnings: v.warnings, prospectId: id }
          : {
              row: v.row,
              status: "duplicate_existing",
              reason: "Ya existe en tu organización.",
              warnings: v.warnings,
            },
      );
    });
  }

  outcomes.sort((a, b) => a.row - b.row);
  const count = (s: RowStatus) => outcomes.filter((o) => o.status === s).length;
  return {
    created: count("created"),
    duplicatesInFile: count("duplicate_in_file"),
    duplicatesExisting: count("duplicate_existing"),
    suppressed: count("suppressed"),
    invalid: count("invalid"),
    outcomes,
  };
}

async function existingKeys(db: DbExecutor, organizationId: string, list: ProspectCandidate[]) {
  const keys = new Set<string>();
  const emails = [...new Set(list.flatMap((c) => (c.email ? [c.email] : [])))];
  const phones = [...new Set(list.flatMap((c) => (c.phone ? [c.phone] : [])))];
  const domains = [...new Set(list.flatMap((c) => websiteDomain(c.website) ?? []))];
  const handles = list.flatMap((c) => c.handles);

  const conditions = [
    emails.length ? inArray(prospects.email, emails) : undefined,
    phones.length ? inArray(prospects.phone, phones) : undefined,
    domains.length ? inArray(prospects.websiteDomain, domains) : undefined,
  ].filter(Boolean);
  if (conditions.length) {
    const rows = await db
      .select({ email: prospects.email, phone: prospects.phone, domain: prospects.websiteDomain })
      .from(prospects)
      .where(and(eq(prospects.organizationId, organizationId), or(...conditions)));
    for (const r of rows) {
      if (r.email) keys.add(`email:${r.email}`);
      if (r.phone) keys.add(`phone:${r.phone}`);
      if (r.domain) keys.add(`domain:${r.domain}`);
    }
  }

  if (handles.length) {
    const values = [...new Set(handles.map((h) => h.handle))];
    const rows = await db
      .select({ channel: prospectHandles.channel, handle: prospectHandles.handle })
      .from(prospectHandles)
      .where(
        and(
          eq(prospectHandles.organizationId, organizationId),
          inArray(prospectHandles.handle, values),
        ),
      );
    for (const r of rows) if (r.handle) keys.add(`handle:${r.channel}:${r.handle}`);
  }
  return keys;
}

async function suppressedKeys(db: DbExecutor, organizationId: string, list: ProspectCandidate[]) {
  const keys = new Set<string>();
  const emails = list.flatMap((c) => (c.email ? [c.email] : []));
  const phones = list.flatMap((c) => (c.phone ? [c.phone] : []));
  const handles = list.flatMap((c) => c.handles.map((h) => h.handle));
  const values = [...new Set([...emails, ...phones, ...handles])];
  if (values.length === 0) return keys;

  const rows = await db
    .select({
      kind: suppressionList.kind,
      value: suppressionList.value,
      channel: suppressionList.channel,
    })
    .from(suppressionList)
    .where(
      and(
        eq(suppressionList.organizationId, organizationId),
        inArray(suppressionList.value, values),
      ),
    );
  for (const r of rows) {
    if (r.kind === "email") keys.add(`email:${r.value}`);
    else if (r.kind === "phone") keys.add(`phone:${r.value}`);
    else if (r.channel) keys.add(`handle:${r.channel}:${r.value}`);
    else for (const ch of ["instagram", "tiktok", "facebook"]) keys.add(`handle:${ch}:${r.value}`);
  }
  return keys;
}
