"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { ContentCard } from "./content-card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import type { Database } from "@/lib/types/database.types";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/validations/content";

type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];

export interface ContentListEntry {
  item: ContentItem;
  score: number | null;
  thumbnailUrl: string | null;
}

type SortKey = "newest" | "oldest" | "highest_score" | "lowest_score";

export function ContentLibrary({ entries }: { entries: ContentListEntry[] }) {
  const [search, setSearch] = React.useState("");
  const [platform, setPlatform] = React.useState("");
  const [contentType, setContentType] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("newest");

  const filtered = entries
    .filter((e) => (search ? e.item.title.toLowerCase().includes(search.toLowerCase()) : true))
    .filter((e) => (platform ? e.item.platform === platform : true))
    .filter((e) => (contentType ? e.item.content_type === contentType : true))
    .sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime();
        case "highest_score":
          return (b.score ?? -1) - (a.score ?? -1);
        case "lowest_score":
          return (a.score ?? 101) - (b.score ?? 101);
        default:
          return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
      }
    });

  if (entries.length === 0) {
    return (
      <EmptyState
        title="Your content intelligence starts here."
        description="Upload your first Reel, video, image or post and discover what you can improve."
        ctaHref="/content/new"
        ctaLabel="Analyze your first content"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search content..."
            aria-label="Search content"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:w-auto sm:grid-cols-none sm:flex">
          <Select
            value={platform}
            onChange={setPlatform}
            placeholder="Platform"
            options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))}
          />
          <Select
            value={contentType}
            onChange={setContentType}
            placeholder="Type"
            options={CONTENT_TYPES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Select
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            placeholder="Sort"
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "highest_score", label: "Highest score" },
              { value: "lowest_score", label: "Lowest score" },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No content matches these filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <ContentCard
              key={entry.item.id}
              item={entry.item}
              score={entry.score}
              thumbnailUrl={entry.thumbnailUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
