"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Zap, Crown, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { TIER_LABELS, SUBSCRIPTION_LIMITS } from "@/lib/constants";
import type { Profile, SubscriptionTier } from "@/lib/types/database.types";

const settingsSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  bio: z.string().optional(),
});

type SettingsData = z.infer<typeof settingsSchema>;

const tiers: { tier: SubscriptionTier; price: string; icon: React.ReactNode; features: string[] }[] = [
  {
    tier: "free",
    price: "$0/mo",
    icon: <Shield className="h-5 w-5" />,
    features: ["3 applications/month", "1 active project", "Basic chat"],
  },
  {
    tier: "pro",
    price: "$29/mo",
    icon: <Zap className="h-5 w-5" />,
    features: ["20 applications/month", "10 active projects", "Priority matching", "Advanced analytics"],
  },
  {
    tier: "elite",
    price: "$99/mo",
    icon: <Crown className="h-5 w-5" />,
    features: ["Unlimited applications", "Unlimited projects", "Priority support", "Custom profile badge"],
  },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SettingsData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single() as unknown as { data: Profile | null; error: unknown };
      if (data) {
        setProfile(data);
        reset({ displayName: data.display_name ?? "", bio: "" });
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (data: SettingsData) => {
    if (!profile) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("profiles") as any)
        .update({ display_name: data.displayName })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, display_name: data.displayName } : prev);
      toast({ type: "success", title: "Profile updated!" });
    } catch (err) {
      toast({ type: "error", title: "Failed to update", description: err instanceof Error ? err.message : "Try again" });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("profiles") as any).update({ avatar_url: avatarUrl }).eq("id", profile.id);
      setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
      toast({ type: "success", title: "Avatar updated!" });
    } catch (err) {
      toast({ type: "error", title: "Upload failed", description: err instanceof Error ? err.message : "Try again" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>

      {/* Profile section */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 font-display text-lg font-semibold text-gray-900 dark:text-white">
          Profile
        </h2>

        {/* Avatar */}
        <div className="mb-6 flex items-center gap-4">
          <Avatar size="xl">
            <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} size="xl" />
            <AvatarFallback name={profile.display_name} />
          </Avatar>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
              <Upload className="h-4 w-4" />
              {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
            </div>
          </label>
        </div>

        <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
          <Input
            label="Display Name"
            {...register("displayName")}
            error={errors.displayName?.message}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {profile.email}
            </p>
          </div>
          <Button type="submit" loading={loading}>
            Save Changes
          </Button>
        </form>
      </div>

      {/* Subscription section */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
            Subscription
          </h2>
          <Badge variant={profile.subscription_tier as "free" | "pro" | "elite"}>
            Current: {TIER_LABELS[profile.subscription_tier]}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {tiers.map(({ tier, price, icon, features }) => {
            const isCurrent = profile.subscription_tier === tier;
            return (
              <div
                key={tier}
                className={`rounded-xl border-2 p-4 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-primary/50 dark:border-gray-700"
                }`}
              >
                <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                  isCurrent ? "bg-primary text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                }`}>
                  {icon}
                </div>
                <p className="font-display text-base font-bold text-gray-900 dark:text-white capitalize">
                  {tier}
                </p>
                <p className="text-sm font-semibold text-primary">{price}</p>
                <ul className="mt-3 space-y-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button size="sm" variant="outline" className="mt-4 w-full">
                    Upgrade
                  </Button>
                )}
                {isCurrent && (
                  <p className="mt-4 text-center text-xs font-medium text-primary">
                    ✓ Current Plan
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
