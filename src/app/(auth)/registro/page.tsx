import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/server/auth/redirects";
import { getAuthUser } from "@/server/auth/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>;
}) {
  const { next, email } = await searchParams;
  const safeNext = next ? safeNextPath(next) : undefined;
  if (await getAuthUser()) redirect(safeNext ?? "/campanas");
  const invited = !!safeNext?.startsWith("/invitacion/");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          Crear cuenta
        </CardTitle>
        <CardDescription>
          {invited
            ? "Creá tu cuenta para sumarte al equipo que te invitó."
            : "Creá tu cuenta y tu organización en un paso."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm next={safeNext} email={email} invited={invited} />
      </CardContent>
    </Card>
  );
}
