import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Wand2,
  BarChart3,
  Layers,
  MessageSquareText,
  ImageIcon,
  Video,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CONTENT_KINDS = [
  { icon: Video, label: "Reels, TikToks & Shorts" },
  { icon: Layers, label: "Long-form video & podcasts" },
  { icon: ImageIcon, label: "Images, carousels & ads" },
  { icon: MessageSquareText, label: "Captions, scripts & copy" },
];

const FLOW = [
  "Upload",
  "Processing",
  "AI Analysis",
  "Score",
  "Insights",
  "Recommendations",
  "Next Content Ideas",
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight">
              CONTENT INTELLIGENCE
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonVariants({ size: "sm" }))}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface-card px-4 py-2 text-sm font-medium text-muted-foreground">
            <Wand2 className="h-4 w-4 text-primary" />
            AI content analysis, not vanity metrics
          </div>

          <h1 className="text-balance font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Know exactly why your content <span className="gradient-text">worked — or didn&apos;t</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload reels, long-form video, images, carousels or copy. Get an honest,
            structured breakdown: hook strength, retention risk, structure, visuals, CTA —
            plus concrete recommendations and next content ideas.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "xl" }), "gap-2")}
            >
              Analyze your first content <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/login" className={cn(buttonVariants({ size: "xl", variant: "outline" }))}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-surface-card/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CONTENT_KINDS.map((kind) => (
              <div
                key={kind.label}
                className="flex items-center gap-3 rounded-card border border-white/[0.08] bg-surface-card p-5"
              >
                <kind.icon className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium">{kind.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            One flow, from raw content to your next idea
          </h2>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="rounded-full border border-white/[0.08] bg-surface-card px-4 py-2 text-sm font-medium">
                  {step}
                </span>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card-lg border border-white/[0.08] bg-gradient-to-br from-primary/10 to-secondary/10 p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-8 w-8 text-primary" />
          <h2 className="font-display text-3xl font-bold">Scores you can trust</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            We separate AI-estimated content potential from real performance data.
            No fake analytics, no viral predictions — just honest signal.
          </p>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: "lg" }), "mt-8 gap-2")}
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span>&copy; {new Date().getFullYear()} Content Intelligence</span>
          <span>Built with Next.js, Supabase &amp; Claude</span>
        </div>
      </footer>
    </div>
  );
}
