"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback?next=/settings`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ll email you a link to set a new password.
          </p>
        </div>

        {sent ? (
          <p className="rounded-xl border border-white/[0.08] bg-surface-card p-4 text-center text-sm text-muted-foreground">
            If an account exists for {email}, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-muted-foreground" />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <LiquidButton type="submit" loading={loading} className="w-full">
              Send reset link
            </LiquidButton>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
