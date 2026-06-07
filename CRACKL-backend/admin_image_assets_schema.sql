-- Admin-only image editor metadata.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv as migration: add_admin_image_assets.

create table if not exists public.admin_image_assets (
  id uuid primary key default gen_random_uuid(),
  original_image_url text not null,
  final_image_url text not null,
  width integer not null check (width > 0 and width <= 8192),
  height integer not null check (height > 0 and height <= 8192),
  rotation numeric not null default 0,
  crop jsonb not null default '{}'::jsonb,
  orientation text not null check (orientation in ('portrait', 'landscape', 'square')),
  file_size bigint not null default 0 check (file_size >= 0),
  uploaded_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_image_assets enable row level security;

create policy "admin image assets deny public select"
  on public.admin_image_assets
  for select
  to anon, authenticated
  using (false);

create policy "admin image assets deny public insert"
  on public.admin_image_assets
  for insert
  to anon, authenticated
  with check (false);

create policy "admin image assets deny public update"
  on public.admin_image_assets
  for update
  to anon, authenticated
  using (false)
  with check (false);

create policy "admin image assets deny public delete"
  on public.admin_image_assets
  for delete
  to anon, authenticated
  using (false);

comment on table public.admin_image_assets is
  'Admin-only image editor metadata for original and finalized riddle media assets.';
