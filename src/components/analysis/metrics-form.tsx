"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Database } from "@/lib/types/database.types";

type ContentMetrics = Database["public"]["Tables"]["content_metrics"]["Row"];

const FIELDS: { key: keyof typeof EMPTY; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "reach", label: "Reach" },
  { key: "impressions", label: "Impressions" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
  { key: "watchTimeSeconds", label: "Watch time (s)" },
  { key: "averageWatchTimeSeconds", label: "Avg. watch time (s)" },
  { key: "completionRate", label: "Completion rate (%)" },
  { key: "clicks", label: "Clicks" },
  { key: "leads", label: "Leads" },
  { key: "conversions", label: "Conversions" },
];

const EMPTY = {
  views: "",
  reach: "",
  impressions: "",
  likes: "",
  comments: "",
  shares: "",
  saves: "",
  watchTimeSeconds: "",
  averageWatchTimeSeconds: "",
  completionRate: "",
  clicks: "",
  leads: "",
  conversions: "",
};

export function MetricsForm({ contentId, existing }: { contentId: string; existing: ContentMetrics | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [values, setValues] = React.useState(EMPTY);

  const handleSubmit = async () => {
    setLoading(true);
    const payload: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== "") payload[key] = Number(value);
    }

    try {
      const res = await fetch(`/api/content/${contentId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Could not save metrics.");
      toast({ type: "success", title: "Real metrics saved" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({ type: "error", title: "Failed to save metrics", description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BarChart3 className="h-4 w-4" />
        {existing ? "Update real metrics" : "Add real metrics"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClose={() => setOpen(false)} className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add real performance data</DialogTitle>
            <p className="text-sm text-muted-foreground">
              These numbers come from your platform&apos;s analytics — they&apos;re shown
              separately from AI-estimated potential.
            </p>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                type="number"
                min={0}
                value={values[field.key]}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={loading} onClick={handleSubmit}>
              Save metrics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
