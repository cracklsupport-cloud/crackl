-- Allow the backend's public-facing bounty endpoint to read only the safe view.
-- The underlying bounty_board table still keeps RLS in force via security_invoker.
revoke all on table public.bounty_board_safe from anon, authenticated;
grant select on table public.bounty_board_safe to anon, authenticated;
