import React from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = {
  title: "Sign In",
};

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 dark:from-gray-950 dark:to-gray-900">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl dark:bg-primary/5" />
        <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-3xl dark:bg-secondary/5" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/25">
              <span className="font-display text-lg font-bold text-white">F</span>
            </div>
            <span className="font-display text-2xl font-bold text-gray-900 dark:text-white">
              Free<span className="text-primary">lie</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The talent marketplace built for results
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <AuthForm />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          By continuing, you agree to our{" "}
          <Link href="#" className="text-primary hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="#" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
