import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signoutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppContext, requireUser } from "@/server/auth/session";
import { CreateOrgForm } from "./create-org-form";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function WelcomePage() {
  const user = await requireUser("/bienvenida");
  if (await getAppContext()) redirect("/campanas");

  const suggested =
    typeof user.user_metadata?.organization_name === "string"
      ? user.user_metadata.organization_name
      : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            ¡Bienvenido/a!
          </CardTitle>
          <CardDescription>
            Creá tu organización para empezar. Si te invitaron a un equipo, abrí el link de la
            invitación.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CreateOrgForm defaultName={suggested} />
          <form action={signoutAction}>
            <Button type="submit" variant="ghost" className="w-full">
              Salir ({user.email})
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
