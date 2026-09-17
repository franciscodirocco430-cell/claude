# Content Intelligence

AI-powered content analysis for social and marketing content — no accounts,
no database, nothing persisted. Two stateless tools:

- **`/`** — upload a file, paste text, or paste a caption, and get an honest,
  structured AI analysis: scores, strengths/weaknesses, hook analysis,
  retention risk, structure, visual analysis (real vision analysis for
  images), CTA effectiveness, concrete recommendations, and next-content
  ideas.
- **`/ideas`** — fill in a lightweight creator profile (niche, audience,
  tone, goals) and generate a grid of reel ideas from it.

Every request is processed and returned in the same round trip. Nothing is
written to a database or file storage — refresh the page and it's gone. This
was a deliberate simplification: no login, no Supabase, no dashboard, no
history.

## Architecture

- **Framework**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS.
- **AI layer**: fully decoupled behind `/lib/ai/provider.ts`. The app calls
  `getAIProvider().generateJSON(...)`; today that resolves to an Anthropic
  Claude adapter, controlled by `AI_PROVIDER` / `ANTHROPIC_MODEL` env vars.
  Swapping to OpenAI or Gemini means implementing `AIProvider` for that
  vendor and adding one branch to the factory — nothing else in the app
  changes. Prompts live in `/lib/ai/prompts.ts` and are versioned
  (`CONTENT_ANALYSIS_PROMPT_VERSION`, etc.).
- **Analysis schema**: `/lib/ai/schemas.ts` defines a Zod schema the model's
  JSON response must satisfy. `analyzeContent()` validates the response and
  retries once with a corrective prompt if it doesn't match.
- **Real vision analysis for images**: when the uploaded file is an image,
  its bytes are base64-encoded in the browser and sent straight to Claude's
  multimodal API (`ImageInput` in `provider.ts`) — the model genuinely looks
  at the picture. Video is analyzed from metadata and any pasted
  caption/transcript only; the app does not fabricate visual analysis of a
  video it hasn't been shown, and says so explicitly in the response.
- **Nothing is stored server-side.** File bytes and text live only in the
  request body of the API call that analyzes them; the response goes
  straight back to the browser and is kept in React state for that page
  session only.
- **Honesty by design**: every analysis response includes `dataDisclaimer`.
  Scores are always framed as "AI content potential" — the app never claims
  a specific real-world outcome (views, virality, etc.).

## Pages

- `/` — the content analyzer (upload/paste → metadata form → results).
- `/ideas` — the reel-ideas generator from a creator profile.

## API routes

- `POST /api/analyze` — runs a full content analysis. Body: title,
  contentType, platform, goal, topic, rawText, durationSeconds, and
  optionally `image: { mediaType, base64Data }`. Returns the full analysis.
- `POST /api/recommendations` — regenerates recommendations from an existing
  analysis result (used by the "Generate Recommendations" button).
- `POST /api/ideas` — regenerates next-content ideas from an existing
  analysis result (used by the "Create Next Content" button).
- `POST /api/reel-ideas` — generates reel ideas from a creator profile.

None of these read or write a database — they're pure functions over their
request body.

## Installation

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY, see below
npm run dev
```

## Environment variables

See `.env.example`.

| Variable | Notes |
| --- | --- |
| `AI_PROVIDER` | `anthropic` (default; only implemented provider today). |
| `ANTHROPIC_API_KEY` | Server-only. Never sent to the browser. Required for `/api/analyze`, `/api/recommendations`, `/api/ideas`, `/api/reel-ideas` to work. |
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-5`. |

No API key is ever imported into a client component — all AI calls happen
inside API routes / server code (`src/app/api/**`, `src/lib/ai/**`).

## Running locally

```bash
npm run dev
```

Visit `http://localhost:3000`, upload or paste a piece of content, and hit
**Analyze Content**.

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
3. Set `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` in the Vercel
   project's environment variables.
4. Deploy.

No secrets are hardcoded anywhere in the codebase. The app works without
`ANTHROPIC_API_KEY` set too — every page loads, only the AI calls return a
clear error until the key is added.

## Future integrations

- **URL analysis** (Instagram/TikTok/YouTube): intentionally not built —
  scraping these platforms without an official API is fragile and against
  most platforms' terms. The tool accepts file uploads and pasted text
  instead.
- **Persistence / accounts**: this version is deliberately stateless. A
  previous iteration of this project used Supabase for auth, a Postgres
  database with Row Level Security, and private file storage, with a
  dashboard, content library, compare and insights pages. That code is not
  in this version; if you want history/accounts back, that's a separate,
  larger project.
- **Additional AI providers**: OpenAI/Gemini adapters are stubbed in
  `/lib/ai/provider.ts` and throw `not implemented` until wired up.
