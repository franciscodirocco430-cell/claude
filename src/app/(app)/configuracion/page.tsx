import { Ban, Link2, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configuración" };

const PROVIDERS = [
  { name: "Google", detail: "Gmail y Google Calendar" },
  { name: "Meta", detail: "Instagram, Messenger y WhatsApp Cloud API" },
  { name: "TikTok for Business", detail: "TikTok Business Messaging" },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" description="Cuentas, equipo y lista de supresión." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4" aria-hidden /> Cuentas conectadas
            </CardTitle>
            <CardDescription>
              Solo conexión por OAuth oficial. Nunca te vamos a pedir contraseñas de tus redes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {PROVIDERS.map((p) => (
                <li
                  key={p.name}
                  className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Sin conectar</Badge>
                    <Button size="sm" variant="outline" disabled>
                      Conectar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" aria-hidden /> Equipo
            </CardTitle>
            <CardDescription>Invitá setters y administradores a tu organización.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Todavía no invitaste a nadie.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="size-4" aria-hidden /> Lista de supresión
            </CardTitle>
            <CardDescription>
              Emails, teléfonos y usuarios que nunca van a recibir mensajes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">La lista está vacía.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
