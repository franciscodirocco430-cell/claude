-- Adds a lightweight creator profile (niche, audience, tone, goals) used to
-- generate reel ideas independent of any single analyzed piece of content.

alter table public.profiles
  add column if not exists niche text,
  add column if not exists target_audience text,
  add column if not exists content_tone text,
  add column if not exists content_goals text;

create table if not exists public.profile_reel_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  hook text not null,
  angle text not null,
  format text not null,
  suggested_structure_json jsonb not null default '[]'::jsonb,
  cta text not null,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists profile_reel_ideas_user_id_idx on public.profile_reel_ideas(user_id);

alter table public.profile_reel_ideas enable row level security;
create policy "profile_reel_ideas_all_own" on public.profile_reel_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
