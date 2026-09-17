import { Wand2 } from "lucide-react";
import { ReelIdeasGrid } from "@/components/content/reel-ideas-grid";

export const metadata = { title: "Reel Ideas" };

export default function IdeasPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 pb-20 sm:px-6">
      <div className="text-center sm:text-left">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 sm:mx-0">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Reel Ideas</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Fill in a creator profile and generate a grid of reel ideas from it — nothing is
          saved.
        </p>
      </div>
      <ReelIdeasGrid />
    </div>
  );
}
