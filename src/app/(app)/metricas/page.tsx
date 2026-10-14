import { BarChart3, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { withUserContext } from "@/db/rls";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import type { Dimension } from "@/server/metrics/aggregate";
import { buildMetricsPage, DIMENSION_LABELS, type LabeledRow } from "@/server/metrics/report";

export const metadata: Metadata = { title: "Métricas" };

const int = new Intl.NumberFormat("es-AR");
const pct = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const rate = (r: number | null) => (r === null ? "—" : pct.format(r));
const cost = (c: number | null) => (c === null ? "—" : usd.format(c));

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid content-start gap-1 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

const VISTA: Record<Dimension, string> = {
  campaign: "campanas",
  channel: "canales",
  setter: "setters",
};

function MetricsTable({
  dimension,
  rows,
  exportHref,
}: {
  dimension: Dimension;
  rows: LabeledRow[];
  exportHref: string;
}) {
  const showAi = dimension !== "setter";
  const title = `Por ${DIMENSION_LABELS[dimension].toLowerCase()}`;
  return (
    <section aria-label={title} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button asChild size="sm" variant="outline">
          <a href={exportHref} download>
            <Download aria-hidden /> Exportar CSV
          </a>
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin datos en el período.</p>
      ) : (
        // El scroll horizontal es de la tabla, no de la página.
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="p-2 text-left font-medium">
                  {DIMENSION_LABELS[dimension]}
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Enviados
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Contactados
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Respuesta
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Calificados
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Agendados
                </th>
                {showAi ? (
                  <th scope="col" className="p-2 text-right font-medium">
                    Costo IA
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.key ?? "null"}>
                  <th scope="row" className="max-w-56 truncate p-2 text-left font-medium">
                    {r.label}
                  </th>
                  <td className="p-2 text-right tabular-nums">{int.format(r.sent)}</td>
                  <td className="p-2 text-right tabular-nums">{int.format(r.contacted)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {rate(r.responseRate)}
                    {r.contacted ? (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({int.format(r.responded)})
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 text-right tabular-nums">{int.format(r.qualified)}</td>
                  <td className="p-2 text-right tabular-nums">{int.format(r.booked)}</td>
                  {showAi ? (
                    <td className="p-2 text-right tabular-nums">{cost(r.aiCostUsd)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAppContext();
  const raw = await searchParams;
  const one = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : undefined);
  const page = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    buildMetricsPage(tx, {
      organizationId: ctx.organizationId,
      desde: one("desde"),
      hasta: one("hasta"),
      campana: one("campana"),
    }),
  );
  const { report, period } = page;
  const t = report.totals;
  const qs = (vista: string) =>
    `/api/metricas/csv?${new URLSearchParams({
      vista,
      desde: period.desde,
      hasta: period.hasta,
      ...(page.campaignId ? { campana: page.campaignId } : {}),
    })}`;
  const empty =
    t.sent === 0 && t.contacted === 0 && t.qualified === 0 && t.booked === 0 && t.aiRuns === 0;

  return (
    <>
      <PageHeader
        title="Métricas"
        description="Enviados, tasa de respuesta, calificados, agendados y costo de IA por campaña, canal y setter."
      />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="m-desde">Desde</Label>
          <Input
            id="m-desde"
            name="desde"
            type="date"
            defaultValue={period.desde}
            className="w-40"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="m-hasta">Hasta</Label>
          <Input
            id="m-hasta"
            name="hasta"
            type="date"
            defaultValue={period.hasta}
            className="w-40"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="m-campana">Campaña</Label>
          <NativeSelect
            id="m-campana"
            name="campana"
            defaultValue={page.campaignId ?? ""}
            className="w-56 max-w-full"
          >
            <option value="">Todas</option>
            {page.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" size="sm">
          Ver
        </Button>
        {one("desde") || one("hasta") || one("campana") ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/metricas">Últimos 30 días</Link>
          </Button>
        ) : null}
      </form>

      {empty ? (
        <EmptyState
          icon={BarChart3}
          title="Sin actividad en el período"
          description="Las métricas aparecen cuando se envían mensajes, responden prospectos o trabaja la IA."
        />
      ) : (
        <div className="grid gap-8">
          <section
            aria-label="Totales"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            <Tile label="Enviados" value={int.format(t.sent)} />
            <Tile label="Contactados" value={int.format(t.contacted)} />
            <Tile
              label="Tasa de respuesta"
              value={rate(t.responseRate)}
              hint={`${int.format(t.responded)} respondieron`}
            />
            <Tile label="Calificados" value={int.format(t.qualified)} />
            <Tile label="Agendados" value={int.format(t.booked)} />
            <Tile
              label="Costo de IA"
              value={cost(t.aiCostUsd)}
              hint={
                report.unpricedAiRuns
                  ? `${int.format(report.unpricedAiRuns)} corridas sin precio configurado`
                  : `${int.format(t.aiRuns)} corridas`
              }
            />
          </section>
          <MetricsTable
            dimension="campaign"
            rows={page.rows.campaign}
            exportHref={qs(VISTA.campaign)}
          />
          <MetricsTable
            dimension="channel"
            rows={page.rows.channel}
            exportHref={qs(VISTA.channel)}
          />
          <MetricsTable dimension="setter" rows={page.rows.setter} exportHref={qs(VISTA.setter)} />
        </div>
      )}

      <details className="text-muted-foreground mt-8 rounded-lg border p-3 text-sm">
        <summary className="text-foreground cursor-pointer font-medium">Cómo se calcula</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Período en la zona horaria de la organización ({page.timeZone}), ambos días incluidos.
          </li>
          <li>Enviados: mensajes salientes (de personas, de la IA y de secuencias de email).</li>
          <li>
            Contactados: prospectos con al menos un mensaje enviado en el período. Respuesta: los
            que escribieron después de ese primer mensaje (por canal, en ese mismo canal).
          </li>
          <li>Calificados: leads que entraron a Calificado, Agendado o Ganado en el período.</li>
          <li>Agendados: reuniones creadas en el período.</li>
          <li>
            Calificados y agendados se atribuyen al canal de la primera respuesta del prospecto y a
            quien le envió el primer mensaje.
          </li>
          <li>
            Costo de IA: estimado con los precios configurados en el servidor. La investigación no
            tiene canal; el costo no se atribuye a setters.
          </li>
          <li>
            Antes de esta versión no se guardaba el historial de etapas: para datos anteriores se
            usó la fecha del último cambio de cada lead (aproximado).
          </li>
        </ul>
      </details>
    </>
  );
}
