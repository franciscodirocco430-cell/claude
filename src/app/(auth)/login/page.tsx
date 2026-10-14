import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/server/auth/redirects";
import { getAuthUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const ERRORS: Record<string, string> = {
  callback: "El link de confirmación no es válido o ya venció. Probá iniciar sesión.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = next ? safeNextPath(next) : undefined;
  if (await getAuthUser()) redirect(safeNext ?? "/campanas");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          Iniciar sesión
        </CardTitle>
        <CardDescription>Entrá para seguir con tu cola de tareas.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && ERRORS[error] ? <Alert variant="destructive">{ERRORS[error]}</Alert> : null}
        <LoginForm next={safeNext} />
      </CardContent>
    </Card>
  );
}
