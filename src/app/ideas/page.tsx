import { ReelIdeasGrid } from "@/components/content/reel-ideas-grid";

export const metadata = { title: "Reel Ideas" };

export default function IdeasPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 pb-20 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reel Ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fresh reel ideas generated from a creator profile — nothing is saved.
        </p>
      </div>
      <ReelIdeasGrid />
    </div>
  );
}
