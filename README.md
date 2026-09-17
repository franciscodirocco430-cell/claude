# Content Intelligence

AI-powered content analysis for social and marketing content. Upload reels,
long-form video, images, carousels, ads or written copy and get an honest,
structured breakdown: scores, strengths/weaknesses, hook analysis, retention
risk, structure, visual signals, CTA effectiveness, concrete recommendations,
and next-content ideas.

This is a working application, not a mockup: real Supabase auth/storage/DB
with RLS, a real Anthropic Claude analysis pipeline behind a swappable
provider abstraction, and a persisted, drag-and-drop dashboard.

## Architecture

- **Framework**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS.
- **Data**: Supabase (Postgres + Auth + Storage), all tables behind Row Level
  Security — a user can only ever see their own rows. See
  `supabase/migrations/`.
- **AI layer**: fully decoupled behind `/lib/ai/provider.ts`. The app calls
  `getAIProvider().generateJSON(...)`; today that resolves to an Anthropic
  Claude adapter, controlled by `AI_PROVIDER` / `ANTHROPIC_MODEL` env vars.
  Swapping to OpenAI or Gemini means implementing `AIProvider` for that
  vendor and adding one branch to the factory — nothing else in the app
  changes. Prompts live in `/lib/ai/prompts.ts` and are versioned
  (`CONTENT_ANALYSIS_PROMPT_VERSION`, etc.); every analysis row stores the
  `model` and `prompt_version` that produced it.
- **Analysis schema**: `/lib/ai/schemas.ts` defines a Zod schema the model's
  JSON response must satisfy. `analyzeContent()` validates the response and
  retries once with a corrective prompt if it doesn't match.
- **Video processing**: `/lib/media/process-video.ts` documents why heavy
  video processing (thumbnailing, frame extraction, transcription) does not
  belong inside a Vercel serverless function, and defines a
  `VideoProcessingAdapter` interface for a future external worker. Today it
  honestly reports which steps were skipped rather than fabricating data.
  Video duration and a poster thumbnail *are* generated for real, client-side
  in the browser at upload time (via `<video>` + `<canvas>`), which needs no
  server compute.
- **Honesty by design**: every analysis record has `data_completeness`
  (`content_only` vs `with_metrics`). Scores are always framed as "AI content
  potential" unless real performance metrics were provided. The app never
  claims a specific real-world outcome (views, virality, etc.).

### Key architectural decisions

- **Storage is private, not public.** The `content` bucket has RLS scoped to
  `{user_id}/...` folders and files are served via short-lived signed URLs
  (`getSignedContentUrl`), not public URLs.
- **Uploads go client → Supabase Storage directly**, then the server only
  persists metadata. This avoids routing large video files through a
  serverless function body-size limit.
- **Recommendations and next-content ideas are stored as their own tables**
  (not just JSON inside the analysis row) so they can be regenerated
  independently ("Generate Recommendations" / "Create Next Content") without
  re-running the full analysis.
- **Reel Ideas (profile-based)**: in addition to per-content "next content
  ideas", `/ideas` generates a grid of reel ideas from a lightweight creator
  profile (niche, audience, tone, goals) stored on `profiles` — independent
  of any single analyzed piece. See `profile_reel_ideas` table and
  `/lib/ai/generate-profile-reel-ideas.ts`.

## Installation

```bash
npm install
cp .env.example .env.local
# fill in .env.local, see below
npm run dev
```

## Environment variables

See `.env.example`. Required:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Public. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. Public. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by the demo seed script. |
| `AI_PROVIDER` | `anthropic` (default; only implemented provider today). |
| `ANTHROPIC_API_KEY` | Server-only. Never sent to the browser. |
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-5`. |

No API key is ever imported into a client component — all AI calls happen
inside API routes / server code (`src/app/api/**`, `src/lib/ai/**`).

## Supabase setup

1. Create a Supabase project.
2. Run the migrations in `supabase/migrations/` in order (via the SQL editor,
   or `supabase db push` with the CLI). They create every table, RLS policy,
   and the private `content` storage bucket.
3. Copy the project URL / anon key / service role key into `.env.local`.

## Database migrations

- `0001_content_intelligence_schema.sql` — profiles, campaigns, content_items,
  content_assets, content_analysis, content_metrics, recommendations,
  content_ideas, dashboard_layouts, storage bucket + policies.
- `0002_profile_reel_ideas.sql` — creator profile fields on `profiles` +
  `profile_reel_ideas` table for the `/ideas` page.

## Running locally

```bash
npm run dev
```

Visit `http://localhost:3000`, register an account, and upload your first
piece of content from `/content/new`.

## Demo / seed data

```bash
npm run seed:demo
```

Creates (or reuses) a dedicated demo user and inserts several fully-analyzed
demo content items flagged `is_demo = true`. Demo data is never mixed into a
real user's account and is safe to re-run or delete. Requires
`SUPABASE_SERVICE_ROLE_KEY`.

## AI configuration

All AI calls route through `getAIProvider()` in `/lib/ai/provider.ts`. To add
a new provider:

1. Implement the `AIProvider` interface (`generateJSON`) for that vendor.
2. Add a branch for it in `getAIProvider()`'s switch statement.
3. Set `AI_PROVIDER` to the new value.

No other file needs to change — every caller (`analyze-content.ts`,
`recommend-content.ts`, `generate-content-ideas.ts`,
`generate-profile-reel-ideas.ts`) only depends on the interface.

## Vercel deployment

```bash
npm run build
```

builds clean with no TypeScript errors. To deploy:

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Set the environment variables from `.env.example` in the Vercel project
   settings.
4. Deploy.

No secrets are hardcoded anywhere in the codebase.

## Future integrations

- **URL analysis** (Instagram/TikTok/YouTube): the upload flow has a "URL"
  tab already in place; it intentionally does not scrape these platforms.
  Once official APIs are wired up, `source_kind: 'url'` content items are
  ready to be processed the same way file/text content is today.
- **Video worker**: `/lib/media/process-video.ts` defines
  `VideoProcessingAdapter` for thumbnailing, frame extraction and
  transcription. Wire up a real implementation (a queue-triggered worker, or
  a managed API like Mux/AssemblyAI) and swap it into
  `getVideoProcessingAdapter()` — nothing upstream changes.
- **Additional AI providers**: OpenAI/Gemini adapters are stubbed in
  `/lib/ai/provider.ts` and throw `not implemented` until wired up.
