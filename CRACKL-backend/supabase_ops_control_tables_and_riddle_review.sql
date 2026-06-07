-- CRACKL ops-control migration record.
-- This migration was applied to Supabase project pblyedoyxcxuqdhgnljv as
-- add_ops_control_tables_and_riddle_review_v2.
-- It adds production moderation, support, scoped admin-operator tokens, and
-- approved-only delivery controls. Do not re-run blindly on production.

alter table public.riddles
  add column if not exists review_status text not null default 'approved',
  add column if not exists version int not null default 1,
  add column if not exists parent_riddle_id uuid references public.riddles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'riddles_review_status_check'
      and conrelid = 'public.riddles'::regclass
  ) then
    alter table public.riddles
      add constraint riddles_review_status_check
      check (review_status in ('draft', 'review', 'approved', 'archived'));
  end if;
end $$;

update public.riddles
set review_status = case when is_active then 'approved' else 'archived' end
where review_status is null;

create index if not exists idx_riddles_review_delivery
  on public.riddles (game_mode, difficulty_tier, review_status, is_active, times_served);

create table if not exists public.riddle_versions (
  id uuid primary key default gen_random_uuid(),
  riddle_id uuid not null references public.riddles(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  changed_by text,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_riddle_versions_riddle_created
  on public.riddle_versions (riddle_id, created_at desc);

create table if not exists public.user_riddle_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  riddle_id uuid references public.riddles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists idx_user_riddle_reports_status_created
  on public.user_riddle_reports (status, created_at desc);
create index if not exists idx_user_riddle_reports_riddle
  on public.user_riddle_reports (riddle_id);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  category text not null default 'general',
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists idx_support_tickets_status_created
  on public.support_tickets (status, created_at desc);
create index if not exists idx_support_tickets_user
  on public.support_tickets (user_id);

create table if not exists public.admin_operators (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null check (role in ('owner', 'editor', 'support', 'viewer')),
  token_hash text not null unique,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_admin_operators_active_role
  on public.admin_operators (is_active, role);

alter table public.riddle_versions enable row level security;
alter table public.user_riddle_reports enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_operators enable row level security;

drop policy if exists deny_public_by_default on public.riddle_versions;
create policy deny_public_by_default on public.riddle_versions
as restrictive for all to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_public_by_default on public.user_riddle_reports;
create policy deny_public_by_default on public.user_riddle_reports
as restrictive for all to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_public_by_default on public.support_tickets;
create policy deny_public_by_default on public.support_tickets
as restrictive for all to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_public_by_default on public.admin_operators;
create policy deny_public_by_default on public.admin_operators
as restrictive for all to anon, authenticated
using (false)
with check (false);

drop view if exists public.riddles_safe;
create view public.riddles_safe
with (security_invoker = true) as
select
  id,
  question,
  options,
  hint,
  fun_fact,
  category,
  difficulty,
  difficulty_tier,
  game_mode,
  riddle_type,
  is_onboarding,
  is_active,
  times_served,
  last_served_at,
  family_id,
  panic_time,
  media_url,
  layout_config,
  region,
  created_at,
  review_status,
  version
from public.riddles;

create or replace function public.get_next_riddle(
  p_user_id uuid,
  p_tier int,
  p_mode text default 'arena',
  p_session_id text default null,
  p_category_exclude text[] default '{}'::text[]
)
returns setof public.riddles_safe
language sql
security definer
set search_path = public
as $$
  with seen as (
    select riddle_id from public.user_riddle_history where user_id = p_user_id
    union
    select riddle_id from public.session_riddle_queue where session_id = p_session_id
  ),
  tier_order(tier, ord) as (
    values
      (greatest(1, least(5, p_tier)), 1),
      (greatest(1, least(5, p_tier - 1)), 2),
      (greatest(1, least(5, p_tier + 1)), 3),
      (greatest(1, least(5, p_tier - 2)), 4),
      (greatest(1, least(5, p_tier + 2)), 5)
  )
  select rs.*
  from public.riddles_safe rs
  join tier_order t on t.tier = rs.difficulty_tier
  where rs.game_mode = p_mode
    and rs.is_active = true
    and rs.review_status = 'approved'
    and not exists (select 1 from seen where seen.riddle_id = rs.id)
  order by
    t.ord,
    case when rs.category = any(coalesce(p_category_exclude, '{}'::text[])) then 1 else 0 end,
    rs.times_served asc nulls first,
    random()
  limit 1;
$$;

create or replace function public.get_oldest_solved_riddle(
  p_user_id uuid,
  p_tier int,
  p_mode text default null
)
returns setof public.riddles_safe
language sql
security definer
set search_path = public
as $$
  select rs.*
  from public.user_riddle_history h
  join public.riddles_safe rs on rs.id = h.riddle_id
  where h.user_id = p_user_id
    and h.status in ('solved', 'hint_used')
    and h.solved_at < now() - interval '30 days'
    and rs.difficulty_tier = greatest(1, least(5, p_tier))
    and rs.is_active = true
    and rs.review_status = 'approved'
    and (p_mode is null or rs.game_mode = p_mode)
  order by h.solved_at asc
  limit 1;
$$;
