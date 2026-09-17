"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { UploadZone, type SelectedFile, type SourceKind } from "@/components/content/upload-zone";
import { AnalysisProgress, type ProcessingStep } from "@/components/content/analysis-progress";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { buildUserStoragePath } from "@/lib/supabase/storage";
import { CONTENT_TYPES, GOALS, PLATFORMS } from "@/lib/validations/content";
import { useToast } from "@/components/ui/toast";

const INITIAL_STEPS: ProcessingStep[] = [
  { key: "upload", label: "Uploading content", status: "pending" },
  { key: "extract", label: "Extracting media", status: "pending" },
  { key: "understand", label: "Understanding content", status: "pending" },
  { key: "hook", label: "Evaluating hook", status: "pending" },
  { key: "structure", label: "Analyzing structure", status: "pending" },
  { key: "engagement", label: "Evaluating engagement potential", status: "pending" },
  { key: "recommendations", label: "Generating recommendations", status: "pending" },
];

export default function NewContentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [sourceKind, setSourceKind] = React.useState<SourceKind>("file");
  const [selectedFile, setSelectedFile] = React.useState<SelectedFile | null>(null);
  const [rawText, setRawText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [contentType, setContentType] = React.useState("");
  const [platform, setPlatform] = React.useState("");
  const [goal, setGoal] = React.useState("");
  const [topic, setTopic] = React.useState("");

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [steps, setSteps] = React.useState<ProcessingStep[]>(INITIAL_STEPS);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const updateStep = (key: string, status: ProcessingStep["status"]) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status } : s)));
  };

  const canSubmit =
    sourceKind !== "url" &&
    title.trim().length > 0 &&
    contentType &&
    platform &&
    (sourceKind === "file" ? Boolean(selectedFile) : rawText.trim().length > 0);

  const handleAnalyze = async () => {
    setSubmitError(null);
    setUploadError(null);

    if (sourceKind === "file" && !selectedFile) {
      setUploadError("Select a file to continue.");
      return;
    }
    if (sourceKind === "text" && rawText.trim().length === 0) {
      setUploadError("Paste some content to continue.");
      return;
    }

    setIsProcessing(true);
    setSteps(INITIAL_STEPS);

    try {
      const supabase = createClient();
      let storagePath: string | null = null;
      let durationSeconds: number | null = null;

      updateStep("upload", "active");
      if (sourceKind === "file" && selectedFile) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be signed in.");

        const path = buildUserStoragePath(user.id, selectedFile.file.name);
        const { error: uploadErr } = await supabase.storage
          .from("content")
          .upload(path, selectedFile.file, { contentType: selectedFile.file.type });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        storagePath = path;
        durationSeconds = selectedFile.durationSeconds;
      }
      updateStep("upload", "done");

      updateStep("extract", "active");
      // Real extraction (client-side thumbnail/duration) already happened at
      // selection time for video; nothing further runs here for images/text.
      await new Promise((r) => setTimeout(r, 300));
      updateStep("extract", "done");

      const createRes = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentType,
          platform,
          goal: goal || null,
          topic: topic || null,
          sourceKind,
          rawText: sourceKind === "text" ? rawText : null,
          storagePath,
          mimeType: selectedFile?.file.type ?? null,
          fileSizeBytes: selectedFile?.file.size ?? null,
          durationSeconds,
        }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save this content.");
      }

      const { content } = await createRes.json();

      updateStep("understand", "active");
      const analyzeRes = await fetch(`/api/content/${content.id}/analyze`, { method: "POST" });
      updateStep("understand", "done");
      updateStep("hook", "done");
      updateStep("structure", "done");
      updateStep("engagement", "done");
      updateStep("recommendations", "done");

      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Analysis failed.");
      }

      toast({ type: "success", title: "Analysis complete" });
      router.push(`/content/${content.id}`);
    } catch (err) {
      setIsProcessing(false);
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setSubmitError(message);
      setSteps((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
      );
      toast({ type: "error", title: "Analysis failed", description: message });
    }
  };

  if (isProcessing) {
    return <AnalysisProgress steps={steps} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-2xl font-bold">Upload your content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze videos, reels, images, carousels and long-form content with AI.
        </p>
      </div>

      <Card className="p-6">
        <UploadZone
          sourceKind={sourceKind}
          onSourceKindChange={setSourceKind}
          selectedFile={selectedFile}
          onFileSelected={setSelectedFile}
          rawText={rawText}
          onRawTextChange={setRawText}
          url={url}
          onUrlChange={setUrl}
          error={uploadError}
        />
      </Card>

      {sourceKind !== "url" && (selectedFile || rawText.trim().length > 0) && (
        <Card className="space-y-5 p-6">
          <h2 className="font-display text-lg font-semibold">Content details</h2>

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this piece a short, recognizable name"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Content type"
              value={contentType}
              onChange={setContentType}
              options={CONTENT_TYPES.map((c) => ({ value: c.value, label: c.label }))}
              placeholder="Select content type"
            />
            <Select
              label="Platform"
              value={platform}
              onChange={setPlatform}
              options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
              placeholder="Select platform"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Goal (optional)"
              value={goal}
              onChange={setGoal}
              options={GOALS.map((g) => ({ value: g.value, label: g.label }))}
              placeholder="Select a goal"
            />
            <Input
              label="Topic (optional)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. onboarding, pricing, testimonial"
            />
          </div>

          {submitError && (
            <p role="alert" className="text-sm text-red-400">
              {submitError}
            </p>
          )}

          <LiquidButton
            icon={<Sparkles className="h-4 w-4" />}
            disabled={!canSubmit}
            onClick={handleAnalyze}
            className="w-full sm:w-auto"
          >
            Analyze Content
          </LiquidButton>
        </Card>
      )}
    </div>
  );
}
