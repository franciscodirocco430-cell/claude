import { desc, eq, sql } from "drizzle-orm";
import { Ban, Link2, Mail } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withUserContext } from "@/db/rls";
import { suppressionList } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { isAdminRole } from "@/server/auth/permissions";
import { requireAppContext } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listChannelAccounts } from "@/server/channels/accounts";
import { getChannelAdapters } from "@/server/channels/env";
import type { SocialChannel } from "@/server/compliance/channels";
import { googleConfigFromEnv } from "@/server/google/config";
import { listMailboxes } from "@/server/google/mailboxes";
import { ChannelAccountRow, ConnectMockAccountForm } from "./channel-accounts";
import { MailboxRow } from "./mailbox-row";
import { TeamSection } from "./team-section";

export const metadata: Metadata = { title: "Configuración" };

const GMAIL_RESULTS: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Gmail conectado." },
  cancelado: { ok: false, text: "Se canceló la conexión con Google." },
  faltan_permisos: {
    ok: false,
    text: "Faltan permisos: hay que aceptar enviar y leer emails para detectar respuestas y rebotes.",
  },
  estado_invalido: { ok: false, text: "La conexión expiró o no es válida. Probá de nuevo." },
  sin_permiso: { ok: false, text: "Solo owners y admins pueden conectar cuentas." },
  sin_configurar: {
    ok: false,
    text: "Falta configurar las credenciales de Google en el servidor.",
  },
  error: { ok: false, text: "No pudimos conectar Gmail. Probá de nuevo en unos minutos." },
};

const OTHER_PROVIDERS = [
  { key: "meta", name: "Meta", detail: "Instagram, Messenger y WhatsApp Cloud API" },
  { key: "tiktok", name: "TikTok for Business", detail: "TikTok Business Messaging" },
] as const;

const REASONS: Record<string, string> = {
  unsubscribed: "Se dio de baja",
  bounced: "Rebotó",
  complaint: "Reportó spam",
  requested: "Lo pidió",
  manual: "Manual",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const ctx = await requireAppContext();
  const { gmail } = await searchParams;
  const isAdmin = isAdminRole(ctx.role);
  const googleReady = !!googleConfigFromEnv(getServerEnv());
  const adapters = getChannelAdapters();
  const { mailboxes, channelAccounts, suppressed, suppressedCount } = await withUserContext(
    getDb(),
    { sub: ctx.user.id },
    async (tx) => ({
      mailboxes: await listMailboxes(tx, ctx.organizationId),
      channelAccounts: await listChannelAccounts(tx, ctx.organizationId),
      suppressed: await tx
        .select()
        .from(suppressionList)
        .where(eq(suppressionList.organizationId, ctx.organizationId))
        .orderBy(desc(suppressionList.createdAt))
        .limit(10),
      suppressedCount:
        (
          await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(suppressionList)
            .where(eq(suppressionList.organizationId, ctx.organizationId))
        )[0]?.n ?? 0,
    }),
  );
  const result = gmail ? GMAIL_RESULTS[gmail] : undefined;

  return (
    <>
      <PageHeader title="Configuración" description="Cuentas, equipo y lista de supresión." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden /> Gmail
            </CardTitle>
            <CardDescription>
              Casillas para las secuencias de email. Se conectan por OAuth oficial de Google: nunca
              te pedimos la contraseña. Pedimos permiso para enviar y para leer las respuestas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {result ? (
              <Alert variant={result.ok ? "success" : "destructive"}>{result.text}</Alert>
            ) : null}
            {mailboxes.length ? (
              <ul className="divide-y rounded-lg border">
                {mailboxes.map((m) => (
                  <MailboxRow key={m.id} mailbox={m} canManage={isAdmin} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Todavía no conectaste ninguna casilla.
              </p>
            )}
            {isAdmin ? (
              googleReady ? (
                <Button asChild variant="outline" className="w-fit">
                  {/* Navegación completa: el flujo de OAuth sale a Google y vuelve. */}
                  <a href="/api/oauth/google/start">Conectar Gmail</a>
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Para conectar Gmail falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el
                  servidor.
                </p>
              )
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Link2 className="size-4" aria-hidden /> Redes y mensajería
            </CardTitle>
            <CardDescription>
              Solo conexión por OAuth oficial. Nunca te vamos a pedir contraseñas de tus redes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {channelAccounts.length ? (
              <ul className="divide-y rounded-lg border">
                {channelAccounts.map((a) => (
                  <ChannelAccountRow
                    key={a.id}
                    account={{ ...a, channel: a.channel as SocialChannel }}
                    canManage={isAdmin}
                  />
                ))}
              </ul>
            ) : null}
            <ul className="divide-y rounded-lg border">
              {OTHER_PROVIDERS.map((p) => (
                <li
                  key={p.name}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.detail}</p>
                  </div>
                  <Badge variant="outline">
                    {adapters[p.key] ? "Webhook listo · conexión pendiente" : "Próximamente"}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-xs">
              Conectar cuentas reales requiere apps aprobadas por Meta y TikTok. Mientras tanto, los
              mensajes entrantes se prueban con cuentas de prueba.
            </p>
            {isAdmin && adapters.mock ? <ConnectMockAccountForm /> : null}
          </CardContent>
        </Card>

        <TeamSection ctx={ctx} />

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Ban className="size-4" aria-hidden /> Lista de supresión
            </CardTitle>
            <CardDescription>
              Emails, teléfonos y usuarios que nunca van a recibir mensajes ({suppressedCount}).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suppressed.length ? (
              <ul className="divide-y rounded-lg border text-sm">
                {suppressed.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 p-2">
                    <span className="min-w-0 truncate">{s.value}</span>
                    <Badge variant="outline">{REASONS[s.reason] ?? s.reason}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">La lista está vacía.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
