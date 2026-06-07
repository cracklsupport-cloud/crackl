-- CRACKL semantic answer checking default.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv as default_semantic_answer_check_off.
-- AI answer judging should be opt-in per riddle from the admin page.

alter table public.riddles
  alter column semantic_check_enabled set default false;

update public.riddles
set semantic_check_enabled = false
where semantic_check_enabled is true;
