-- Bounty Board attempt lock
-- Applied to Supabase project pblyedoyxcxuqdhgnljv on 2026-05-17.
-- Purpose: prevent brute-force retries on high-prize bounty contracts.

create table if not exists public.bounty_attempts (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounty_board(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('served', 'solved', 'failed', 'timed_out')),
  attempted_at timestamptz not null default now(),
  time_taken_ms integer,
  unique (bounty_id, user_id)
);

alter table public.bounty_attempts enable row level security;

create index if not exists bounty_attempts_user_idx
  on public.bounty_attempts(user_id, attempted_at desc);

create index if not exists bounty_attempts_bounty_idx
  on public.bounty_attempts(bounty_id, status);

comment on table public.bounty_attempts is
  '[GROUP: Gameplay] Locks each user to one attempt per bounty. Prevents high-prize Bounty Board brute force/retry exploits.';

comment on column public.bounty_attempts.status is
  'served -> solved | failed | timed_out. Unique(bounty_id,user_id) enforces one bounty attempt per user.';
