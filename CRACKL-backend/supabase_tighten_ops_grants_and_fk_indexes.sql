-- CRACKL ops grant and FK-index hardening.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv as
-- tighten_ops_grants_and_fk_indexes.

create index if not exists idx_riddles_parent_riddle_id
  on public.riddles (parent_riddle_id);

create index if not exists idx_support_tickets_user_id
  on public.support_tickets (user_id);

create index if not exists idx_user_riddle_reports_user_id
  on public.user_riddle_reports (user_id);

create index if not exists idx_user_riddle_reports_riddle_id
  on public.user_riddle_reports (riddle_id);

revoke all privileges on table public.admin_operators from anon, authenticated;
revoke all privileges on table public.riddle_versions from anon, authenticated;
revoke all privileges on table public.support_tickets from anon, authenticated;
revoke all privileges on table public.user_riddle_reports from anon, authenticated;
