create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  policy_version text not null,
  terms_version text not null,
  privacy_version text not null,
  fair_play_version text not null,
  rewards_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'signup',
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_acceptances_source_check check (source in ('signup', 'policy_update', 'admin_migration'))
);

alter table public.legal_acceptances enable row level security;

revoke all on table public.legal_acceptances from anon, authenticated;

create index if not exists legal_acceptances_user_id_accepted_at_idx
  on public.legal_acceptances (user_id, accepted_at desc);

comment on table public.legal_acceptances is '[GROUP: Compliance] Immutable acceptance log for Terms, Privacy, Fair Play, and Rewards policies. Written by backend service role during signup or policy updates.';
comment on column public.legal_acceptances.ip_hash is 'Salted one-way hash of request IP for dispute/fraud audit without storing raw IP.';
