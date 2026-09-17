"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Mail, Lock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { useToast } from "@/components/ui/toast";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "register") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        toast({
          type: "success",
          title: "Account created",
          description: "Check your inbox to confirm your email if required, then sign in.",
        });
        router.push("/login");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h1 className="font-display text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to keep analyzing your content."
            : "Start turning your content into insights."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-muted-foreground" />
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              required
              className="pl-9"
            />
          </div>
        )}

        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-muted-foreground" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="pl-9"
          />
        </div>

        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-muted-foreground" />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
            className="pl-9"
          />
        </div>

        {mode === "login" && (
          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}

        <LiquidButton type="submit" loading={loading} className="w-full">
          {mode === "login" ? "Sign in" : "Create account"}
        </LiquidButton>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            No account yet?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
