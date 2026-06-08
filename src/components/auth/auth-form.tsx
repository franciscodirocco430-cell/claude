"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { UserRole } from "@/lib/types/database.types";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  role: z.enum(["freelo", "freelier"] as const),
});

type SignInData = z.infer<typeof signInSchema>;
type SignUpData = z.infer<typeof signUpSchema>;

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const supabase = createClient();

  const signInForm = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
  });

  const signUpForm = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: "freelo" },
  });

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast({ type: "error", title: "Google sign in failed", description: error.message });
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (data: SignInData) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast({ type: "error", title: "Sign in failed", description: error.message });
      setLoading(false);
      return;
    }

    router.push("/feed");
    router.refresh();
  };

  const handleSignUp = async (data: SignUpData) => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.displayName,
          role: data.role,
        },
      },
    });

    if (error) {
      toast({ type: "error", title: "Sign up failed", description: error.message });
      setLoading(false);
      return;
    }

    toast({
      type: "success",
      title: "Account created!",
      description: "Please check your email to verify your account.",
    });
    setLoading(false);
  };

  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="signin" className="flex-1">
          Sign In
        </TabsTrigger>
        <TabsTrigger value="signup" className="flex-1">
          Sign Up
        </TabsTrigger>
      </TabsList>

      {/* Google OAuth - shared between tabs */}
      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          onClick={handleGoogleSignIn}
          loading={googleLoading}
        >
          <Chrome className="h-4 w-4" />
          Continue with Google
        </Button>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              or continue with email
            </span>
          </div>
        </div>
      </div>

      {/* Sign In Form */}
      <TabsContent value="signin">
        <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            {...signInForm.register("email")}
            error={signInForm.formState.errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            {...signInForm.register("password")}
            error={signInForm.formState.errors.password?.message}
          />
          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>
      </TabsContent>

      {/* Sign Up Form */}
      <TabsContent value="signup">
        <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
          <Input
            label="Display Name"
            type="text"
            placeholder="Jane Smith"
            {...signUpForm.register("displayName")}
            error={signUpForm.formState.errors.displayName?.message}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            {...signUpForm.register("email")}
            error={signUpForm.formState.errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            {...signUpForm.register("password")}
            error={signUpForm.formState.errors.password?.message}
          />

          {/* Role Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["freelo", "freelier"] as UserRole[]).map((role) => {
                const labels = {
                  freelo: { title: "Freelancer", desc: "I offer services" },
                  freelier: { title: "Client", desc: "I hire talent" },
                };
                const selected = signUpForm.watch("role") === role;
                return (
                  <label
                    key={role}
                    className={`flex cursor-pointer flex-col rounded-xl border-2 p-3 transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-primary/50 dark:border-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      value={role}
                      className="sr-only"
                      {...signUpForm.register("role")}
                    />
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {labels[role].title}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {labels[role].desc}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Create Account
          </Button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>
      </TabsContent>
    </Tabs>
  );
}
