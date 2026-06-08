"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { AvailabilityStatus } from "@/lib/types/database.types";

const freeloSchema = z.object({
  bio: z.string().min(20, "Bio must be at least 20 characters"),
  hourlyRate: z.coerce.number().min(1, "Hourly rate must be at least $1"),
  availability: z.enum(["available", "busy", "open_to_offers"] as const),
});

type FreeloData = z.infer<typeof freeloSchema>;

interface FreeloStepProps {
  onComplete: (data: {
    bio: string;
    hourly_rate: number;
    availability: AvailabilityStatus;
    skills: string[];
    portfolio_items: { title: string; url: string }[];
    stack: string[];
  }) => void;
  loading?: boolean;
}

export function FreeloStep({ onComplete, loading }: FreeloStepProps) {
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [stack, setStack] = useState<string[]>([]);
  const [stackInput, setStackInput] = useState("");
  const [portfolioItems, setPortfolioItems] = useState<{ title: string; url: string }[]>([]);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FreeloData>({
    resolver: zodResolver(freeloSchema),
    defaultValues: { availability: "available" },
  });

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const addStack = () => {
    const trimmed = stackInput.trim();
    if (trimmed && !stack.includes(trimmed)) {
      setStack((prev) => [...prev, trimmed]);
      setStackInput("");
    }
  };

  const removeStack = (item: string) => {
    setStack((prev) => prev.filter((s) => s !== item));
  };

  const addPortfolioItem = () => {
    if (portfolioTitle.trim() && portfolioUrl.trim()) {
      setPortfolioItems((prev) => [
        ...prev,
        { title: portfolioTitle.trim(), url: portfolioUrl.trim() },
      ]);
      setPortfolioTitle("");
      setPortfolioUrl("");
    }
  };

  const removePortfolioItem = (index: number) => {
    setPortfolioItems((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: FreeloData) => {
    onComplete({
      bio: data.bio,
      hourly_rate: data.hourlyRate,
      availability: data.availability,
      skills,
      portfolio_items: portfolioItems,
      stack,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Textarea
        label="Bio"
        placeholder="Tell clients about yourself, your experience, and what makes you unique..."
        className="min-h-[120px]"
        {...register("bio")}
        error={errors.bio?.message}
      />

      {/* Skills */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Skills
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., React, Python, Figma"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addSkill}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tech Stack */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Tech Stack
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Next.js, PostgreSQL, AWS"
            value={stackInput}
            onChange={(e) => setStackInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addStack();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" onClick={addStack}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {stack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stack.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary"
              >
                {item}
                <button type="button" onClick={() => removeStack(item)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Hourly Rate (USD)"
          type="number"
          placeholder="75"
          {...register("hourlyRate")}
          error={errors.hourlyRate?.message}
        />

        <Select
          label="Availability"
          value={watch("availability")}
          onChange={(v) => setValue("availability", v as AvailabilityStatus)}
          options={[
            { value: "available", label: "Available" },
            { value: "busy", label: "Busy" },
            { value: "open_to_offers", label: "Open to Offers" },
          ]}
        />
      </div>

      {/* Portfolio */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Portfolio Items (optional)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Project title"
            value={portfolioTitle}
            onChange={(e) => setPortfolioTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={addPortfolioItem}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {portfolioItems.length > 0 && (
          <ul className="space-y-2">
            {portfolioItems.map((item, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
              >
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{item.title}</span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400 truncate text-xs">{item.url}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePortfolioItem(i)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button type="submit" className="w-full" loading={loading}>
        Continue
      </Button>
    </form>
  );
}
