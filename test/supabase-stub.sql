-- Minimal stand-in for what a fresh Supabase project already has, so setup.sql
-- can be tested on plain Postgres. Not used in production.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role authenticator login noinherit password 'test';
    grant anon, authenticated, service_role to authenticator;
  end if;
end $$;
create schema extensions; create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
grant usage on schema auth, extensions, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants everything to the API roles by default and relies on RLS
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create publication supabase_realtime;
