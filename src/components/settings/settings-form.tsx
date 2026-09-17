"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Database } from "@/lib/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function SettingsForm({ email, profile }: { email: string; profile: Profile | null }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [company, setCompany] = React.useState(profile?.company ?? "");
  const [niche, setNiche] = React.useState(profile?.niche ?? "");
  const [targetAudience, setTargetAudience] = React.useState(profile?.target_audience ?? "");
  const [contentTone, setContentTone] = React.useState(profile?.content_tone ?? "");
  const [contentGoals, setContentGoals] = React.useState(profile?.content_goals ?? "");

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          company,
          niche,
          targetAudience,
          contentTone,
          contentGoals,
        }),
      });
      if (!res.ok) throw new Error("Could not save your settings.");
      toast({ type: "success", title: "Settings saved" });
    } catch (err) {
      toast({ type: "error", title: "Failed to save", description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your sign-in details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input label="Email" value={email} disabled />
          <Input label="Full name" value={fullName ?? ""} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Company (optional)" value={company ?? ""} onChange={(e) => setCompany(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator profile</CardTitle>
          <CardDescription>
            Used to generate Reel Ideas tailored to you, independent of any single analyzed piece.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Niche"
            value={niche ?? ""}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. personal finance for freelancers"
          />
          <Textarea
            label="Target audience"
            value={targetAudience ?? ""}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Who are you creating for?"
          />
          <Input
            label="Tone"
            value={contentTone ?? ""}
            onChange={(e) => setContentTone(e.target.value)}
            placeholder="e.g. direct, playful, authoritative"
          />
          <Textarea
            label="Goals"
            value={contentGoals ?? ""}
            onChange={(e) => setContentGoals(e.target.value)}
            placeholder="What are you trying to achieve with your content?"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>Configured via environment variables — never exposed to the browser.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Content analysis currently runs on Anthropic Claude. The provider is swappable via{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">AI_PROVIDER</code> without
            changing application code — see <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-xs">/lib/ai/provider.ts</code>.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} loading={loading}>
        Save changes
      </Button>
    </div>
  );
}
