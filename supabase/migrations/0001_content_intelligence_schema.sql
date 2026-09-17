-- Content Intelligence — initial schema
-- All tables use Row Level Security so a user can only see their own data.

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  company text,
  role text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- campaigns
-- ============================================================
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text,
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;
create policy "campaigns_all_own" on public.campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- content_items
-- ============================================================
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  title text not null,
  content_type text not null check (content_type in (
    'reel', 'tiktok', 'youtube_short', 'long_form_video', 'carousel',
    'static_image', 'ad_creative', 'written_post', 'script', 'other'
  )),
  platform text not null check (platform in (
    'instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'facebook', 'other'
  )),
  goal text check (goal in (
    'awareness', 'engagement', 'followers', 'leads', 'sales', 'education', 'authority', 'community'
  )),
  topic text,
  status text not null default 'uploaded' check (status in (
    'uploaded', 'processing', 'analyzed', 'failed'
  )),
  source_kind text not null default 'file' check (source_kind in ('file', 'text', 'url')),
  raw_text text,
  source_url text,
  storage_url text,
  thumbnail_url text,
  duration_seconds numeric,
  file_size_bytes bigint,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_user_id_idx on public.content_items(user_id);
create index if not exists content_items_created_at_idx on public.content_items(created_at desc);

alter table public.content_items enable row level security;
create policy "content_items_all_own" on public.content_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- content_assets (extracted media: frames, audio, transcript files, etc.)
-- ============================================================
create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  asset_type text not null check (asset_type in (
    'original', 'thumbnail', 'frame', 'audio', 'transcript'
  )),
  storage_path text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_assets_content_id_idx on public.content_assets(content_id);

alter table public.content_assets enable row level security;
create policy "content_assets_all_own" on public.content_assets
  for all using (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_assets.content_id and ci.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_assets.content_id and ci.user_id = auth.uid()
    )
  );

-- ============================================================
-- content_analysis
-- ============================================================
create table if not exists public.content_analysis (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  scores_json jsonb not null default '{}'::jsonb,
  summary text,
  strengths_json jsonb not null default '[]'::jsonb,
  weaknesses_json jsonb not null default '[]'::jsonb,
  hook_analysis_json jsonb not null default '{}'::jsonb,
  retention_analysis_json jsonb not null default '{}'::jsonb,
  structure_json jsonb not null default '{}'::jsonb,
  visual_analysis_json jsonb not null default '{}'::jsonb,
  cta_analysis_json jsonb not null default '{}'::jsonb,
  audience_analysis_json jsonb not null default '{}'::jsonb,
  data_completeness text not null default 'content_only' check (data_completeness in (
    'content_only', 'with_metrics'
  )),
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists content_analysis_content_id_idx on public.content_analysis(content_id);

alter table public.content_analysis enable row level security;
create policy "content_analysis_all_own" on public.content_analysis
  for all using (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_analysis.content_id and ci.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_analysis.content_id and ci.user_id = auth.uid()
    )
  );

-- ============================================================
-- content_metrics (real performance data, optional)
-- ============================================================
create table if not exists public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  views bigint,
  reach bigint,
  impressions bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  watch_time_seconds numeric,
  average_watch_time_seconds numeric,
  completion_rate numeric,
  clicks bigint,
  ctr numeric,
  leads bigint,
  conversions bigint,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists content_metrics_content_id_idx on public.content_metrics(content_id);

alter table public.content_metrics enable row level security;
create policy "content_metrics_all_own" on public.content_metrics
  for all using (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_metrics.content_id and ci.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_metrics.content_id and ci.user_id = auth.uid()
    )
  );

-- ============================================================
-- recommendations
-- ============================================================
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  title text not null,
  why_it_matters text not null,
  evidence text not null,
  recommended_action text not null,
  expected_improvement_area text not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  suggested_rewrite text,
  created_at timestamptz not null default now()
);

create index if not exists recommendations_content_id_idx on public.recommendations(content_id);

alter table public.recommendations enable row level security;
create policy "recommendations_all_own" on public.recommendations
  for all using (
    exists (
      select 1 from public.content_items ci
      where ci.id = recommendations.content_id and ci.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.content_items ci
      where ci.id = recommendations.content_id and ci.user_id = auth.uid()
    )
  );

-- ============================================================
-- content_ideas (next content suggestions generated from an analysis)
-- ============================================================
create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  title text not null,
  hook text not null,
  angle text not null,
  format text not null,
  suggested_structure_json jsonb not null default '[]'::jsonb,
  cta text not null,
  created_at timestamptz not null default now()
);

create index if not exists content_ideas_content_id_idx on public.content_ideas(content_id);

alter table public.content_ideas enable row level security;
create policy "content_ideas_all_own" on public.content_ideas
  for all using (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_ideas.content_id and ci.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.content_items ci
      where ci.id = content_ideas.content_id and ci.user_id = auth.uid()
    )
  );

-- ============================================================
-- dashboard_layouts (per-user widget positions)
-- ============================================================
create table if not exists public.dashboard_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.dashboard_layouts enable row level security;
create policy "dashboard_layouts_all_own" on public.dashboard_layouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.content_items;
create trigger set_updated_at before update on public.content_items
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- Storage bucket for uploaded content
-- ============================================================
insert into storage.buckets (id, name, public)
values ('content', 'content', false)
on conflict (id) do nothing;

create policy "content_storage_select_own"
  on storage.objects for select
  using (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "content_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "content_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);
