import { asc, eq } from "drizzle-orm";
import { KanbanSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { withUserContext } from "@/db/rls";
import { campaigns } from "@/db/schema";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { boardFiltersSchema, getBoard } from "@/server/pipeline/board";

export const metadata: Metadata = { title: "CRM" };

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAppContext();
  const raw = await searchParams;
  const filters = boardFiltersSchema.parse({
    campana: (typeof raw.campana === "string" && raw.campana) || undefined,
    q: (typeof raw.q === "string" && raw.q) || undefined,
  });
  const { columns, campaignOptions } = await withUserContext(
    getDb(),
    { sub: ctx.user.id },
    async (tx) => ({
      columns: await getBoard(tx, ctx.organizationId, filters),
      campaignOptions: await tx
        .select({ id: campaigns.id, name: campaigns.name })
        .from(campaigns)
        .where(eq(campaigns.organizationId, ctx.organizationId))
        .orderBy(asc(campaigns.name)),
    }),
  );
  const total = columns.reduce((acc, c) => acc + c.total, 0);
  const filtered = !!(filters.campana || filters.q);

  return (
    <>
      <PageHeader
        title="CRM"
        description="Pipeline de leads por etapa. Arrastrá una tarjeta (o usá su selector) para moverla."
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="crm-q">Buscar</Label>
          <Input
            id="crm-q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Nombre, empresa, email o usuario"
            className="w-64 max-w-full"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="crm-campana">Campaña</Label>
          <NativeSelect
            id="crm-campana"
            name="campana"
            defaultValue={filters.campana ?? ""}
            className="w-56 max-w-full"
          >
            <option value="">Todas</option>
            <option value="sin">Sin campaña</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {filtered ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/crm">Limpiar</Link>
          </Button>
        ) : null}
      </form>
      {total === 0 && !filtered ? (
        <EmptyState
          icon={KanbanSquare}
          title="Todavía no hay leads"
          description="Los prospectos aparecen acá cuando los cargás en una campaña o cuando te escriben."
        />
      ) : (
        <PipelineBoard columns={columns} />
      )}
    </>
  );
}
