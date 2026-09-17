import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
