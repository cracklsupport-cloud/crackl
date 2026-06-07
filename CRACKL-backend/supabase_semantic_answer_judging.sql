-- CRACKL semantic answer judging migration record.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv as add_semantic_answer_judging.
-- Adds per-riddle semantic controls plus private LLM verdict cache/audit tables.

alter table public.riddles
  add column if not exists semantic_check_enabled boolean not null default true,
  add column if not exists answer_strictness text not null default 'normal',
  add column if not exists accepted_aliases text[] not null default '{}'::text[],
  add column if not exists required_keywords text[] not null default '{}'::text[],
  add column if not exists forbidden_meanings text[] not null default '{}'::text[],
  add column if not exists answer_rubric text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'riddles_answer_strictness_check'
      and conrelid = 'public.riddles'::regclass
  ) then
    alter table public.riddles
      add constraint riddles_answer_strictness_check
      check (answer_strictness in ('lenient', 'normal', 'strict'));
  end if;
end $$;

create table if not exists public.semantic_answer_cache (
  id uuid primary key default gen_random_uuid(),
  riddle_id uuid not null references public.riddles(id) on delete cascade,
  answer_hash text not null,
  strictness text not null default 'normal' check (strictness in ('lenient', 'normal', 'strict')),
  model text not null,
  is_correct boolean not null,
  confidence numeric(4,3) not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  unique (riddle_id, answer_hash, strictness, model)
);

create index if not exists idx_semantic_answer_cache_riddle_created
  on public.semantic_answer_cache (riddle_id, created_at desc);

create table if not exists public.answer_judgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  riddle_id uuid references public.riddles(id) on delete set null,
  mode text,
  answer_hash text not null,
  answer_preview text,
  source text not null check (source in ('exact', 'alias', 'heuristic', 'llm', 'cache', 'fallback', 'timeout')),
  is_correct boolean not null,
  confidence numeric(4,3) not null default 0,
  model text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_answer_judgments_riddle_created
  on public.answer_judgments (riddle_id, created_at desc);
create index if not exists idx_answer_judgments_user_created
  on public.answer_judgments (user_id, created_at desc);
create index if not exists idx_answer_judgments_source_created
  on public.answer_judgments (source, created_at desc);

alter table public.semantic_answer_cache enable row level security;
alter table public.answer_judgments enable row level security;

drop policy if exists deny_public_by_default on public.semantic_answer_cache;
create policy deny_public_by_default on public.semantic_answer_cache
as restrictive for all to anon, authenticated
using (false)
with check (false);

drop policy if exists deny_public_by_default on public.answer_judgments;
create policy deny_public_by_default on public.answer_judgments
as restrictive for all to anon, authenticated
using (false)
with check (false);
