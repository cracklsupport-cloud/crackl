-- CRACKL admin audit trail.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv.
--
-- This table records privileged admin actions without exposing secrets.
-- Keep it backend/service-role only. Do not grant browser roles access.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_label text not null default 'shared-admin-key',
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'deny_public_by_default'
  ) then
    create policy deny_public_by_default
      on public.admin_audit_logs
      as restrictive
      for all
      to anon, authenticated
      using (false)
      with check (false);
  end if;
end $$;

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_action_created_at_idx
  on public.admin_audit_logs (action, created_at desc);

comment on table public.admin_audit_logs is
  '[GROUP: System] Immutable-style admin action trail for riddle changes, uploads, maintenance, panic timer updates, storage cleanup, and production operations.';

comment on column public.admin_audit_logs.metadata is
  'Structured action details. Never store secrets, tokens, passwords, OTPs, or full answers here.';
