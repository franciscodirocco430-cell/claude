import type { Metadata } from "next";
import Link from "next/link";
import { signoutAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/server/auth/permissions";
import { getAuthUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { findInvitationByToken } from "@/server/invitations/service";
import { normalizeEmail } from "@/server/invitations/token";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitación", robots: { index: false } };

const STATUS_MESSAGES = {
  expired: "Esta invitación venció. Pedile a quien te invitó que te mande una nueva.",
  accepted: "Esta invitación ya fue usada.",
  revoked: "Esta invitación fue cancelada.",
} as const;

function Shell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            {title}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="grid gap-3">{children}</CardContent>
      </Card>
    </div>
  );
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findInvitationByToken(getDb(), token);

  if (!found) {
    return (
      <Shell title="Invitación no encontrada">
        <p className="text-muted-foreground text-sm">Revisá que el link esté completo.</p>
      </Shell>
    );
  }
  if (found.status !== "valid") {
    return (
      <Shell title="Invitación no disponible">
        <Alert variant="destructive">{STATUS_MESSAGES[found.status]}</Alert>
      </Shell>
    );
  }

  const { invitation, organizationName } = found;
  const description = `Te invitaron a ${organizationName} como ${ROLE_LABELS[invitation.role]}.`;
  const here = `/invitacion/${token}`;
  const user = await getAuthUser();

  if (!user) {
    return (
      <Shell title="Sumate al equipo" description={description}>
        <p className="text-muted-foreground text-sm">
          La invitación es para <strong>{invitation.email}</strong>.
        </p>
        <Button asChild>
          <Link
            href={`/registro?next=${encodeURIComponent(here)}&email=${encodeURIComponent(invitation.email)}`}
          >
            Crear cuenta
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/login?next=${encodeURIComponent(here)}`}>Ya tengo cuenta</Link>
        </Button>
      </Shell>
    );
  }

  if (normalizeEmail(user.email ?? "") !== invitation.email) {
    return (
      <Shell title="Cuenta equivocada" description={description}>
        <Alert variant="destructive">
          Esta invitación es para {invitation.email} y entraste como {user.email}.
        </Alert>
        <form action={signoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            Salir y entrar con otra cuenta
          </Button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Sumate al equipo" description={description}>
      <AcceptForm token={token} />
    </Shell>
  );
}
