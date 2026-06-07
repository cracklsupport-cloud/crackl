-- CRACKL public-schema RLS hardening.
-- Applied to Supabase project pblyedoyxcxuqdhgnljv.
--
-- The app currently uses an Express backend with the Supabase service-role key.
-- Browser roles should not read or mutate public tables directly. These
-- restrictive policies keep anon/authenticated denied even if table grants are
-- accidentally reintroduced later.

do $$
declare
  t record;
  policy_name text;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);

    policy_name := 'deny_public_by_default';
    if not exists (
      select 1
      from pg_policies
      where schemaname = t.schemaname
        and tablename = t.tablename
        and policyname = policy_name
    ) then
      execute format(
        'create policy %I on %I.%I as restrictive for all to anon, authenticated using (false) with check (false)',
        policy_name,
        t.schemaname,
        t.tablename
      );
    end if;
  end loop;
end $$;

comment on policy deny_public_by_default on public.users is
  'Defense-in-depth: browser roles are denied by default. CRACKL accesses tables through the backend service role.';
