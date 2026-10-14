import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withUserContext } from "@/db/rls";
import { getAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { buildMetricsPage, metricsCsv } from "@/server/metrics/report";

const VISTAS = { campanas: "campaign", canales: "channel", setters: "setter" } as const;

/** Exporta una vista de métricas a CSV (con el RLS del usuario). */
export async function GET(request: NextRequest) {
  const ctx = await getAppContext();
  if (!ctx) return new NextResponse(null, { status: 401 });
  const p = request.nextUrl.searchParams;
  const vista = z.enum(["campanas", "canales", "setters"]).safeParse(p.get("vista"));
  if (!vista.success) return new NextResponse("Vista inválida", { status: 400 });
  const page = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    buildMetricsPage(tx, {
      organizationId: ctx.organizationId,
      desde: p.get("desde") ?? undefined,
      hasta: p.get("hasta") ?? undefined,
      campana: p.get("campana") ?? undefined,
    }),
  );
  const filename = `metricas-${vista.data}-${page.period.desde}-a-${page.period.hasta}.csv`;
  return new NextResponse(metricsCsv(page, VISTAS[vista.data]), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
