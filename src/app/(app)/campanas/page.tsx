import { Megaphone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CampaignStatusBadge, ChannelBadges } from "@/components/campaigns/campaign-badges";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import { isAdminRole } from "@/server/auth/permissions";
import { requireAppContext } from "@/server/auth/session";
import { listCampaigns } from "@/server/campaigns/service";
import { getDb } from "@/server/db";

export const metadata: Metadata = { title: "Campañas" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ archivadas?: string }>;
}) {
  const ctx = await requireAppContext();
  const showArchived = (await searchParams).archivadas === "1";
  const campaigns = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    listCampaigns(tx, ctx.organizationId, { includeArchived: showArchived }),
  );
  const canCreate = isAdminRole(ctx.role);
  const newButton = canCreate ? (
    <Button asChild>
      <Link href="/campanas/nueva">
        <Plus aria-hidden /> Nueva campaña
      </Link>
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Campañas"
        description="Nicho, referentes, oferta, cliente ideal y canales de cada campaña."
        actions={newButton}
      />
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={showArchived ? "No hay campañas" : "Todavía no hay campañas"}
          description={
            canCreate
              ? "Creá tu primera campaña para cargar prospectos y que la IA prepare los mensajes."
              : "Cuando un admin cree una campaña, la vas a ver acá."
          }
          action={newButton}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/campanas/${c.id}`}
                className="focus-visible:ring-ring/50 block h-full rounded-xl focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Card className="hover:bg-muted/40 h-full gap-3 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle as="h2" className="leading-snug">
                        {c.name}
                      </CardTitle>
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    <CardDescription className="line-clamp-2">{c.niche}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <ChannelBadges channels={c.channels} />
                    <span className="text-muted-foreground text-sm">
                      {c.prospectCount} {c.prospectCount === 1 ? "prospecto" : "prospectos"}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm">
        <Link
          href={showArchived ? "/campanas" : "/campanas?archivadas=1"}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          {showArchived ? "Ocultar archivadas" : "Ver archivadas"}
        </Link>
      </p>
    </>
  );
}
