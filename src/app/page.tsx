"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Video, ImageIcon, MessageSquareText, Wand2 } from "lucide-react";
import { UploadZone, type SelectedFile, type SourceKind } from "@/components/content/upload-zone";
import { AnalysisProgress, type ProcessingStep } from "@/components/content/analysis-progress";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OverallScore } from "@/components/analysis/overall-score";
import { ScoreBreakdown } from "@/components/analysis/score-breakdown";
import { HookAnalysis } from "@/components/analysis/hook-analysis";
import { RetentionAnalysis } from "@/components/analysis/retention-analysis";
import { VisualAnalysis } from "@/components/analysis/visual-analysis";
import { RecommendationsList } from "@/components/analysis/recommendations-list";
import { NextContentIdeas } from "@/components/analysis/next-content-ideas";
import { CONTENT_TYPES, GOALS, PLATFORMS } from "@/lib/validations/content";
import { useToast } from "@/components/ui/toast";
import type { ContentAnalysisResult } from "@/lib/ai/schemas";

const INITIAL_STEPS: ProcessingStep[] = [
  { key: "read", label: "Reading content", status: "pending" },
  { key: "understand", label: "Understanding content", status: "pending" },
  { key: "hook", label: "Evaluating hook", status: "pending" },
  { key: "structure", label: "Analyzing structure", status: "pending" },
  { key: "engagement", label: "Evaluating engagement potential", status: "pending" },
  { key: "recommendations", label: "Generating recommendations", status: "pending" },
];

export default function AnalyzePage() {
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
  const [result, setResult] = React.useState<{ analysis: ContentAnalysisResult } | null>(null);

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
    setResult(null);

    try {
      updateStep("read", "active");
      await new Promise((r) => setTimeout(r, 200));
      updateStep("read", "done");

      updateStep("understand", "active");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentType,
          platform,
          goal: goal || null,
          topic: topic || null,
          rawText: sourceKind === "text" ? rawText : selectedFile?.kind === "text" ? rawText : null,
          durationSeconds: selectedFile?.durationSeconds ?? null,
          image:
            selectedFile?.kind === "image" && selectedFile.imageBase64
              ? {
                  mediaType: selectedFile.imageMediaType ?? selectedFile.file.type,
                  base64Data: selectedFile.imageBase64,
                }
              : null,
        }),
      });

      updateStep("understand", "done");
      updateStep("hook", "done");
      updateStep("structure", "done");
      updateStep("engagement", "done");
      updateStep("recommendations", "done");

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Analysis failed.");
      }

      const data = await res.json();
      setResult({ analysis: data.analysis });
      toast({ type: "success", title: "Analysis complete" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setSubmitError(message);
      setSteps((prev) => prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s)));
      toast({ type: "error", title: "Analysis failed", description: message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSelectedFile(null);
    setRawText("");
    setUrl("");
    setSourceKind("file");
    setTitle("");
    setContentType("");
    setPlatform("");
    setGoal("");
    setTopic("");
    setUploadError(null);
    setSubmitError(null);
  };

  if (isProcessing) {
    return <AnalysisProgress steps={steps} />;
  }

  if (result) {
    const { analysis } = result;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto max-w-3xl space-y-8 px-4 py-10 pb-20 sm:px-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{platform}</Badge>
              <Badge variant="outline">{contentType.replace(/_/g, " ")}</Badge>
            </div>
          </div>
          <button onClick={handleReset} className="text-sm text-primary hover:underline">
            Analyze another
          </button>
        </div>

        <Card className="p-6">
          <OverallScore score={analysis.overallScore} dataDisclaimer={analysis.dataDisclaimer} />
          <p className="mt-4 border-t border-white/[0.08] pt-4 text-sm text-muted-foreground">
            {analysis.summary}
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-score-excellent">What worked</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-score-excellent">✓</span> {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold text-score-fair">What can improve</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {analysis.weaknesses.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-score-fair">△</span> {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Score breakdown</h2>
          <ScoreBreakdown scores={analysis.scores} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Hook analysis</h2>
          <HookAnalysis data={analysis.hookAnalysis} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Retention analysis</h2>
          <RetentionAnalysis
            timeline={analysis.retentionAnalysis.timeline}
            summary={analysis.retentionAnalysis.summary}
            isPredicted={analysis.retentionAnalysis.isPredicted}
          />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Content structure</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {analysis.structureAnalysis.detectedStructure.map((step, i, arr) => (
              <span key={i} className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.06] px-3 py-1">{step}</span>
                {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{analysis.structureAnalysis.notes}</p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Visual analysis</h2>
          <VisualAnalysis data={analysis.visualAnalysis} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">CTA analysis</h2>
          {analysis.ctaAnalysis.present ? (
            <p className="mb-3 text-sm italic text-foreground">
              &ldquo;{analysis.ctaAnalysis.text}&rdquo;
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">No clear call to action was detected.</p>
          )}
          <p className="mb-3 text-sm text-muted-foreground">{analysis.ctaAnalysis.timingAssessment}</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {analysis.ctaAnalysis.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span> {rec}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Recommendations</h2>
          <RecommendationsList
            context={{
              title,
              contentType,
              summary: analysis.summary,
              strengths: analysis.strengths,
              weaknesses: analysis.weaknesses,
              scores: analysis.scores,
            }}
            recommendations={analysis.recommendations}
            onUpdate={(recommendations) =>
              setResult({ analysis: { ...analysis, recommendations } })
            }
          />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Next content</h2>
          <NextContentIdeas
            context={{ title, contentType, platform, topic: topic || null, summary: analysis.summary }}
            ideas={analysis.nextContentIdeas}
            onUpdate={(nextContentIdeas) => setResult({ analysis: { ...analysis, nextContentIdeas } })}
          />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-3xl space-y-8 px-4 py-10 pb-20 sm:px-6"
    >
      <div className="text-center sm:text-left">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 sm:mx-0">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">
          Upload your content
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Analyze videos, reels, images, carousels and long-form content with AI. Nothing is
          saved — this runs entirely in your session.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
          {[
            { icon: Video, label: "Video & Reels" },
            { icon: ImageIcon, label: "Images & Carousels" },
            { icon: MessageSquareText, label: "Captions & Copy" },
          ].map((chip) => (
            <span
              key={chip.label}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface-card px-3 py-1.5 text-xs text-muted-foreground"
            >
              <chip.icon className="h-3.5 w-3.5 text-primary" />
              {chip.label}
            </span>
          ))}
        </div>
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

      <AnimatePresence>
        {sourceKind !== "url" && (selectedFile || rawText.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
