-- Multiplayer room config fields used by server.js and the React setup screens.
alter table public.multiplayer_rooms
  add column if not exists engagement text not null default 'versus'
    check (engagement in ('versus', 'coop')),
  add column if not exists wager_amount integer not null default 0
    check (wager_amount >= 0),
  add column if not exists panic_mode boolean not null default false;

alter table public.multiplayer_rooms
  drop constraint if exists chk_room_status;

alter table public.multiplayer_rooms
  drop constraint if exists multiplayer_rooms_status_check;

alter table public.multiplayer_rooms
  add constraint multiplayer_rooms_status_check
  check (status in ('waiting', 'active', 'playing', 'revealed', 'completed', 'abandoned'));

create index if not exists idx_multiplayer_rooms_engagement_mode
  on public.multiplayer_rooms (engagement, mode);

-- Shareable "Challenge a Genius" wager links.
create table if not exists public.challenges (
  id text primary key,
  challenger_id uuid references public.users(id) on delete cascade,
  challenger_name text not null default 'Unknown',
  defender_id uuid references public.users(id) on delete set null,
  riddle_id uuid not null references public.riddles(id) on delete restrict,
  target_time integer not null default 0 check (target_time >= 0),
  wager_amount integer not null default 0 check (wager_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.challenges enable row level security;

drop policy if exists backend_select_challenges on public.challenges;
drop policy if exists backend_insert_challenges on public.challenges;
drop policy if exists backend_update_challenges on public.challenges;
drop policy if exists backend_delete_challenges on public.challenges;

-- Temporary anon backend policies. Remove these after SUPABASE_SERVICE_ROLE_KEY is configured.
create policy backend_select_challenges on public.challenges for select to anon using (true);
create policy backend_insert_challenges on public.challenges for insert to anon with check (true);
create policy backend_update_challenges on public.challenges for update to anon using (true) with check (true);
create policy backend_delete_challenges on public.challenges for delete to anon using (true);

grant select, insert, update, delete on table public.challenges to anon, authenticated, service_role;

create index if not exists idx_challenges_active_created_at
  on public.challenges (active, created_at desc);
create index if not exists idx_challenges_challenger_id
  on public.challenges (challenger_id);
create index if not exists idx_challenges_defender_id
  on public.challenges (defender_id);
create index if not exists idx_challenges_riddle_id
  on public.challenges (riddle_id);
