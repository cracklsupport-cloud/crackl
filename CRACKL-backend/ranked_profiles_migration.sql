create table if not exists public.ranked_profiles (
  user_id text primary key,
  username text,
  city text,
  rating integer not null default 1000,
  tier text not null default 'Bronze',
  wins integer not null default 0,
  losses integer not null default 0,
  matches_played integer not null default 0,
  best_rating integer not null default 1000,
  last_delta integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists ranked_profiles_rating_idx
  on public.ranked_profiles (rating desc);
