import { ChevronLeft, Mail, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import { isAdminRole } from "@/server/auth/permissions";
import { getDb } from "@/server/db";
import { listSequences } from "@/server/sequences/service";
import { loadCampaign } from "../load";
import { StatsLine } from "./stats-line";

export const metadata: Metadata = { title: "Secuencias de email" };

const STATUS: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  paused: "Pausada",
  archived: "Archivada",
};

export default async function SequencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, campaign } = await loadCampaign(id);
  const sequences = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    listSequences(tx, ctx.organizationId, campaign.id),
  );
  const canCreate = isAdminRole(ctx.role);
  const newButton = canCreate ? (
    <Button asChild>
      <Link href={`/campanas/${campaign.id}/secuencias/nueva`}>
        <Plus aria-hidden /> Nueva secuencia
      </Link>
    </Button>
  ) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/campanas/${campaign.id}`}
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden /> {campaign.name}
      </Link>
      <PageHeader
        title="Secuencias de email"
        description="Emails en frío automáticos con seguimientos. Se frenan solos si el prospecto responde, rebota o se da de baja."
        actions={newButton}
      />
      {sequences.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Todavía no hay secuencias"
          description="Armá una secuencia de 1 a 6 emails para los prospectos de esta campaña."
          action={newButton}
        />
      ) : (
        <ul className="grid gap-3">
          {sequences.map((s) => (
            <li key={s.id}>
              <Card className="gap-3">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle as="h2">
                      <Link
                        href={`/campanas/${campaign.id}/secuencias/${s.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </CardTitle>
                    <Badge variant={s.status === "active" ? "default" : "outline"}>
                      {STATUS[s.status] ?? s.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{s.mailbox ?? "Sin casilla"}</p>
                </CardHeader>
                <CardContent>
                  <StatsLine stats={s.stats} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
