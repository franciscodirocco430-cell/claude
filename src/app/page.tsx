import React from "react";
import Link from "next/link";
import {
  Shield,
  Zap,
  Users,
  CheckCircle,
  Star,
  ArrowRight,
  MessageCircle,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Shield,
    title: "Anti-Leakage Chat",
    description:
      "Our server-side moderation prevents contact details, social handles, and external URLs from leaking outside the platform.",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: FileText,
    title: "Escrow Contracts",
    description:
      "Milestone-based contracts with 1% platform fee. Funds held in escrow, released on milestone approval.",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: Star,
    title: "XP Gamification",
    description:
      "Freelancers earn XP for completing contracts and receiving reviews. Unlock badges and tier upgrades.",
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
  },
  {
    icon: Zap,
    title: "Smart Matching",
    description:
      "AI-powered matching based on skills, XP tier, availability, and project requirements.",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20",
  },
  {
    icon: MessageCircle,
    title: "Real-Time Chat",
    description:
      "Supabase Realtime powers instant messaging with proposal cards and milestone tracking.",
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  {
    icon: Users,
    title: "Bento Profiles",
    description:
      "Rich talent profiles with portfolio, skills, XP bar, and badges displayed in a modern bento grid.",
    color: "text-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
];

const steps = [
  {
    number: "01",
    title: "Create Your Profile",
    description:
      "Sign up as a freelancer or client. Build your bento-grid profile with skills, portfolio, and rates.",
  },
  {
    number: "02",
    title: "Match & Negotiate",
    description:
      "Apply to projects or post your needs. Chat securely, send proposals, and negotiate milestones.",
  },
  {
    number: "03",
    title: "Ship & Get Paid",
    description:
      "Work with milestone-based contracts. Earn XP, unlock badges, and grow your reputation.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-lg dark:border-gray-900 dark:bg-gray-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
              <span className="text-sm font-bold text-white">F</span>
            </div>
            <span className="font-display text-xl font-bold text-gray-900 dark:text-white">
              Free<span className="text-primary">lie</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm font-medium text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary"
            >
              Sign In
            </Link>
            <Button size="sm" asChild>
              <Link href="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl dark:bg-primary/5" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-3xl dark:bg-secondary/5" />
        </div>

        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            <Zap className="h-4 w-4" />
            <span>SaaS Marketplace for Digital Talent</span>
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl">
            Find talent.{" "}
            <span className="gradient-text">Ship faster.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Freelie connects ambitious clients with elite digital freelancers.
            Anti-leakage messaging, escrow contracts, milestone tracking, and XP-driven
            profiles — all in one platform.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="xl" asChild>
              <Link href="/auth">
                Start for Free <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/auth">Find Talent</Link>
            </Button>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            {["Anti-leakage chat", "1% platform fee", "XP gamification", "Escrow-backed"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 px-4 py-20 dark:bg-gray-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Everything you need to{" "}
              <span className="gradient-text">work smarter</span>
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Purpose-built features for modern freelance engagements.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
                >
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${feature.bg}`}>
                    <Icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Get started in minutes. Transact with confidence.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute left-full top-6 hidden w-full -translate-x-4 border-t-2 border-dashed border-primary/30 md:block" />
                )}
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-display font-bold text-lg">
                    {step.number}
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold text-gray-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary p-12 text-center text-white">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Ready to ship faster?
          </h2>
          <p className="mt-4 text-white/80">
            Join Freelie today. Free to start, upgrade when you&apos;re ready.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="xl"
              variant="muted"
              className="bg-white text-primary hover:bg-gray-50"
              asChild
            >
              <Link href="/auth">
                Get Started Free <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-12 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
                <span className="text-xs font-bold text-white">F</span>
              </div>
              <span className="font-display text-lg font-bold text-gray-900 dark:text-white">
                Free<span className="text-primary">lie</span>
              </span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} Freelie. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <Link href="#" className="hover:text-primary">Privacy</Link>
              <Link href="#" className="hover:text-primary">Terms</Link>
              <Link href="#" className="hover:text-primary">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
