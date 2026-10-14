import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizations } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { verifyUnsubscribeToken } from "@/server/email/unsubscribe";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Darse de baja", robots: { index: false } };

/**
 * Confirmación de baja. Se pide un clic (en vez de dar de baja al abrir el link)
 * para que los escáneres de links de los servidores de correo no den de baja solos.
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = getServerEnv().UNSUBSCRIBE_SIGNING_SECRET;
  const payload = secret ? verifyUnsubscribeToken(decodeURIComponent(token), secret) : null;
  const [org] = payload
    ? await getDb()
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, payload.o))
    : [];

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            Darse de baja
          </CardTitle>
          {payload && org ? (
            <CardDescription>
              Vas a dejar de recibir emails de {org.name} en {payload.e}.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {payload && org ? (
            <UnsubscribeForm token={decodeURIComponent(token)} />
          ) : (
            <Alert variant="destructive">El link de baja no es válido o está incompleto.</Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
