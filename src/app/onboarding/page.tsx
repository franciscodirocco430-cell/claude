"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FreeloStep } from "@/components/onboarding/freelo-step";
import { FreelierStep } from "@/components/onboarding/freelier-step";
import { useToast } from "@/components/ui/toast";
import type { Profile } from "@/lib/types/database.types";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(data);
    }
    fetchProfile();
  }, []);

  const handleFreeloComplete = async (data: {
    bio: string;
    hourly_rate: number;
    availability: "available" | "busy" | "open_to_offers";
    skills: string[];
    portfolio_items: { title: string; url: string }[];
    stack: string[];
  }) => {
    if (!profile) return;
    setLoading(true);
    try {
      const { error: profileError } = await (supabase.from("freelo_profiles") as unknown as any)
        .upsert({
          id: profile.id,
          bio: data.bio,
          hourly_rate: data.hourly_rate,
          availability: data.availability,
          skills: data.skills,
          portfolio_items: data.portfolio_items,
          stack: data.stack,
        }) as unknown as { error: unknown };

      if (profileError) throw profileError;

      await (supabase.from("profiles") as unknown as any)
        .update({ onboarding_complete: true })
        .eq("id", profile.id);

      setStep(3);
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to save profile",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFreelierComplete = async (data: {
    company_name: string;
    kyc_full_name: string;
    kyc_tax_id: string;
  }) => {
    if (!profile) return;
    setLoading(true);
    try {
      const { error } = await (supabase.from("freelier_profiles") as unknown as any)
        .upsert({
          id: profile.id,
          company_name: data.company_name,
          kyc_full_name: data.kyc_full_name,
          kyc_tax_id: data.kyc_tax_id,
          kyc_verified: false,
        }) as unknown as { error: unknown };

      if (error) throw error;

      await (supabase.from("profiles") as unknown as any)
        .update({ onboarding_complete: true })
        .eq("id", profile.id);

      setStep(3);
    } catch (err) {
      toast({
        type: "error",
        title: "Failed to save profile",
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { label: "Account", description: "Role confirmed" },
    { label: "Profile", description: profile?.role === "freelo" ? "Skills & portfolio" : "Company info" },
    { label: "Done", description: "Start using Freelie" },
  ];

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <span className="text-sm font-bold text-white">F</span>
            </div>
            <span className="font-display text-xl font-bold text-gray-900 dark:text-white">
              Free<span className="text-primary">lie</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((s, i) => {
                const stepNum = (i + 1) as Step;
                const isComplete = step > stepNum;
                const isCurrent = step === stepNum;

                return (
                  <React.Fragment key={s.label}>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                          isComplete
                            ? "bg-green-500 text-white"
                            : isCurrent
                            ? "bg-primary text-white ring-4 ring-primary/20"
                            : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {isComplete ? <CheckCircle className="h-5 w-5" /> : stepNum}
                      </div>
                      <div className="text-center">
                        <p className={`text-xs font-medium ${isCurrent ? "text-primary" : "text-gray-500"}`}>
                          {s.label}
                        </p>
                        <p className="text-xs text-gray-400 hidden sm:block">{s.description}</p>
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`flex-1 mx-3 h-0.5 transition-all ${
                          step > i + 1 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Step content */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {step === 1 && (
              <div className="text-center">
                <div className="mb-6 flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10">
                  <span className="text-3xl">
                    {profile.role === "freelo" ? "🚀" : "🏢"}
                  </span>
                </div>
                <h1 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
                  Welcome to Freelie,{" "}
                  {profile.display_name?.split(" ")[0] ?? "there"}!
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  You&apos;re joining as a{" "}
                  <strong className="text-primary">
                    {profile.role === "freelo" ? "Freelancer (Freelo)" : "Client (Freelier)"}
                  </strong>
                  .
                </p>
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  {profile.role === "freelo"
                    ? "Next, let's build your profile so clients can find you."
                    : "Next, let's set up your company profile so freelancers trust your projects."}
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-600"
                >
                  Let&apos;s go <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="mb-1 font-display text-xl font-bold text-gray-900 dark:text-white">
                  {profile.role === "freelo" ? "Build your talent profile" : "Company setup"}
                </h2>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                  {profile.role === "freelo"
                    ? "This is your public profile. Make it stand out!"
                    : "Help freelancers understand who they're working with."}
                </p>
                {profile.role === "freelo" ? (
                  <FreeloStep onComplete={handleFreeloComplete} loading={loading} />
                ) : (
                  <FreelierStep onComplete={handleFreelierComplete} loading={loading} />
                )}
              </div>
            )}

            {step === 3 && (
              <div className="text-center">
                <div className="mb-6 flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-green-50 dark:bg-green-900/20">
                  <span className="text-4xl">🎉</span>
                </div>
                <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-white">
                  You&apos;re all set!
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Your profile is ready. Start{" "}
                  {profile.role === "freelo"
                    ? "finding amazing projects"
                    : "hiring top talent"}
                  .
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => router.push("/feed")}
                    className="rounded-xl bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-600"
                  >
                    {profile.role === "freelo" ? "Browse Projects →" : "Find Talent →"}
                  </button>
                  <button
                    onClick={() => router.push(`/profile/${profile.id}`)}
                    className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    View My Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
