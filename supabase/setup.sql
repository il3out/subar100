-- ============================================================================
-- SUBAR100 · database setup
-- Paste this whole file into Supabase → SQL Editor → New query, then Run.
-- Run it once on a new, empty project (not the Subar Sitta one).
--
-- The hidden number lives in public.comp_secret. No app user can read it,
-- not even the admin: there are no read rules on that table and every
-- function that touches it only ever answers "won" or "not won".
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table public.players (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null check (char_length(btrim(name)) between 2 and 24),
  avatar     text check (avatar is null or (char_length(avatar) < 150000
                         and avatar ~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$')),
  is_admin   boolean not null default false,
  joined_at  timestamptz not null default now(),
  removed_at timestamptz,                               -- set by the admin; keeps their history
  last_try   timestamptz                                -- guess throttle
);

create table public.invites (
  code       text primary key,
  note       text check (char_length(note) <= 40),
  created_by uuid references public.players on delete set null,
  created_at timestamptz not null default now(),
  used_by    uuid references public.players on delete set null,
  used_at    timestamptz,
  revoked_at timestamptz
);

create table public.comps (
  id             int generated always as identity primary key,
  n              int not null unique,                   -- competition number shown to members
  status         text not null default 'open' check (status in ('open', 'won')),
  started_at     timestamptz not null default now(),
  start_day      date not null,
  started_by     uuid references public.players on delete set null,
  prize          text check (char_length(prize) <= 80),
  note           text check (char_length(note) <= 280),  -- announcement
  won_at         timestamptz,
  winner         uuid references public.players on delete set null,
  winning_number int check (winning_number between 1 and 100),   -- only filled once won
  winning_guess  bigint
);
-- at most one open competition, enforced by the database
create unique index comps_one_open on public.comps ((true)) where status = 'open';

create table public.comp_secret (
  comp_id int primary key references public.comps on delete cascade,
  target  int not null check (target between 1 and 100)
);

create table public.guesses (
  id      bigint generated always as identity primary key,
  comp_id int  not null references public.comps on delete cascade,
  user_id uuid not null references public.players on delete cascade,
  day     date not null,                                -- Kuwait calendar day
  n       int  not null check (n between 1 and 100),
  at      timestamptz not null,                         -- server clock, authoritative
  is_win  boolean not null default false,
  unique (user_id, day)                                 -- one guess per member per Kuwait day
);
create index guesses_comp on public.guesses (comp_id);

-- "who's in today" without the numbers (drives the live dots)
create table public.checkins (
  user_id uuid not null references public.players on delete cascade,
  day     date not null,
  comp_id int  not null references public.comps on delete cascade,
  at      timestamptz not null,
  primary key (user_id, day)
);

create table public.audit (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default clock_timestamp(),
  actor  uuid,
  action text not null,
  detail jsonb not null default '{}'
);

-- ---------------------------------------------------------------- helpers
create function public.kw_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kuwait')::date $$;

create function public.kw_next_reset() returns timestamptz
language sql stable as $$ select ((public.kw_today() + 1)::timestamp at time zone 'Asia/Kuwait') $$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where id = auth.uid() and removed_at is null) $$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where id = auth.uid() and removed_at is null and is_admin) $$;

-- uniform 1..100 from the OS random source (pgcrypto); rejection sampling avoids modulo bias
create function public.secure_target() returns int
language plpgsql volatile set search_path = public, extensions as $$
declare b int;
begin
  loop
    b := get_byte(extensions.gen_random_bytes(1), 0);
    exit when b < 200;
  end loop;
  return b % 100 + 1;
end $$;

create function public.new_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- no 0/O/1/I
  r bytea := extensions.gen_random_bytes(8);
  s text := '';
begin
  for i in 0..7 loop s := s || substr(abc, (get_byte(r, i) % 32) + 1, 1); end loop;
  return s;
end $$;

create function public.log(act text, det jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into audit (actor, action, detail) values (auth.uid(), act, det) $$;

-- ---------------------------------------------------------------- access rules
alter table public.players     enable row level security;
alter table public.invites     enable row level security;
alter table public.comps       enable row level security;
alter table public.comp_secret enable row level security;   -- no policies: unreadable
alter table public.guesses     enable row level security;
alter table public.checkins    enable row level security;
alter table public.audit       enable row level security;

create policy players_read   on public.players  for select using (public.is_member() or id = auth.uid());
create policy players_self   on public.players  for update using (id = auth.uid() and removed_at is null)
                                                 with check (id = auth.uid());
create policy invites_admin  on public.invites  for select using (public.is_admin());
create policy comps_read     on public.comps    for select using (public.is_member());
create policy checkins_read  on public.checkins for select using (public.is_member());
create policy audit_admin    on public.audit    for select using (public.is_admin());
-- your own guesses always; everyone else's only once that competition is won
create policy guesses_read   on public.guesses  for select using (
  user_id = auth.uid()
  or (public.is_member() and exists (select 1 from comps c where c.id = comp_id and c.status = 'won')));

-- the app may only read; every write goes through the functions below
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
revoke all on public.comp_secret from anon, authenticated;
grant update (name, avatar) on public.players to authenticated;   -- nobody can make themselves admin

-- ---------------------------------------------------------------- joining
create function public.redeem_invite(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv invites; me players; first boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 24 then
    raise exception 'Your name needs 2 to 24 characters';
  end if;
  select * into me from players where id = uid;
  if found and me.removed_at is not null then raise exception 'Your membership was removed. Ask the admin.'; end if;
  if found then return jsonb_build_object('status', 'member'); end if;

  select * into inv from invites
   where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
     and used_by is null and revoked_at is null
   for update;
  if not found then raise exception 'That invite code is not valid or has been used'; end if;

  perform pg_advisory_xact_lock(100100);          -- the first member becomes admin, exactly once
  first := not exists (select 1 from players);
  insert into players (id, name, is_admin) values (uid, btrim(p_name), first);
  update invites set used_by = uid, used_at = now() where code = inv.code;
  perform log('joined', jsonb_build_object('invite', inv.code, 'admin', first));
  return jsonb_build_object('status', 'joined', 'admin', first);
end $$;

-- ---------------------------------------------------------------- the game
-- One call does everything, atomically: checks the day, records the guess with
-- the server clock, compares it with the hidden number and, if it matches,
-- closes the competition. The FOR UPDATE lock on the open competition makes
-- concurrent guesses queue, so exactly one winner is possible.
create function public.submit_guess(p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c comps; d date; t int; gid bigint; ts timestamptz; prev int; won boolean;
begin
  if not public.is_member() then raise exception 'Members only'; end if;
  if p_n is null or p_n < 1 or p_n > 100 then raise exception 'Pick a whole number from 1 to 100'; end if;

  -- throttle: one attempt per second per member (cheap protection against scripted spam)
  update players set last_try = clock_timestamp()
   where id = uid and (last_try is null or last_try < clock_timestamp() - interval '1 second');
  if not found then return jsonb_build_object('status', 'slow'); end if;

  -- ponytail: one lock for the whole competition; fine for a friends' league
  select * into c from comps where status = 'open' for update;
  if not found then return jsonb_build_object('status', 'closed'); end if;

  ts := clock_timestamp();
  d  := (ts at time zone 'Asia/Kuwait')::date;

  select n into prev from guesses where user_id = uid and day = d;
  if found then
    return jsonb_build_object('status', 'already', 'n', prev, 'day', d, 'next', public.kw_next_reset());
  end if;

  insert into guesses (comp_id, user_id, day, n, at) values (c.id, uid, d, p_n, ts)
  on conflict (user_id, day) do nothing
  returning id into gid;
  if gid is null then
    return jsonb_build_object('status', 'already', 'day', d, 'next', public.kw_next_reset());
  end if;
  insert into checkins (user_id, day, comp_id, at) values (uid, d, c.id, ts);

  select target into t from comp_secret where comp_id = c.id;
  won := (p_n = t);
  if won then
    update guesses set is_win = true where id = gid;
    update comps set status = 'won', won_at = ts, winner = uid, winning_number = t, winning_guess = gid
     where id = c.id;
    perform log('won', jsonb_build_object('comp', c.n, 'number', t, 'guess', gid));
  else
    perform log('guessed', jsonb_build_object('comp', c.n, 'day', d));   -- never the number while live
  end if;

  return jsonb_build_object('status', case when won then 'won' else 'locked' end,
    'n', p_n, 'day', d, 'at', ts, 'comp', c.n, 'next', public.kw_next_reset());
end $$;

-- everything the home screen needs in one round trip
create function public.state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); me players; c comps; d date := public.kw_today(); r jsonb;
begin
  select * into me from players where id = uid;
  if not found then return jsonb_build_object('member', 'none', 'now', clock_timestamp()); end if;
  if me.removed_at is not null then return jsonb_build_object('member', 'removed', 'now', clock_timestamp()); end if;

  select * into c from comps order by (status = 'open') desc, id desc limit 1;

  select jsonb_build_object(
    'member', 'yes', 'admin', me.is_admin, 'now', clock_timestamp(), 'today', d, 'next', public.kw_next_reset(),
    'players', (select count(*) from players where removed_at is null),
    'in_today', coalesce((select jsonb_agg(user_id) from checkins where day = d), '[]'),
    'mine', (select jsonb_build_object('n', n, 'at', at, 'comp', comp_id) from guesses where user_id = uid and day = d),
    'comp', case when c.id is null then null else jsonb_build_object(
        'id', c.id, 'n', c.n, 'status', c.status, 'started_at', c.started_at, 'start_day', c.start_day,
        'days', coalesce(c.won_at at time zone 'Asia/Kuwait', clock_timestamp() at time zone 'Asia/Kuwait')::date - c.start_day + 1,
        'prize', c.prize, 'note', c.note, 'won_at', c.won_at, 'winner', c.winner,
        'number', c.winning_number,
        'guesses', (select count(*) from guesses where comp_id = c.id),
        'entrants', (select count(distinct user_id) from guesses where comp_id = c.id)) end)
  into r;
  return r;
end $$;

-- leaderboard: participation and wins only; nothing about distance to the number
create function public.board() returns table (
  id uuid, name text, avatar text, is_admin boolean, guesses int, streak int, wins int,
  entered int, in_today boolean, last_day date)
language sql stable security definer set search_path = public as $$
  with g as (select * from guesses where public.is_member()),
  isl as (   -- runs of consecutive days per member
    select user_id, max(day) as last, count(*)::int as len
      from (select user_id, day, day - (row_number() over (partition by user_id order by day))::int as k from g) x
     group by user_id, k),
  st as (   -- ponytail: days with no open competition also break a streak
    select user_id, max(len) filter (where last >= public.kw_today() - 1) as streak from isl group by user_id)
  select p.id, p.name, p.avatar, p.is_admin,
         (select count(*)::int from g where g.user_id = p.id),
         coalesce(st.streak, 0),
         (select count(*)::int from comps where winner = p.id),
         (select count(distinct comp_id)::int from g where g.user_id = p.id),
         exists (select 1 from g where g.user_id = p.id and g.day = public.kw_today()),
         (select max(day) from g where g.user_id = p.id)
    from players p left join st on st.user_id = p.id
   where public.is_member() and p.removed_at is null
$$;

-- ---------------------------------------------------------------- admin
create function public.start_competition(p_prize text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid int; num int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from comps where status = 'open') then raise exception 'A competition is already running'; end if;
  select coalesce(max(n), 0) + 1 into num from comps;
  insert into comps (n, start_day, started_by, prize, note)
  values (num, public.kw_today(), auth.uid(), nullif(btrim(p_prize), ''), nullif(btrim(p_note), ''))
  returning id into cid;
  insert into comp_secret values (cid, public.secure_target());
  perform log('started', jsonb_build_object('comp', num));
  return jsonb_build_object('id', cid, 'n', num);
exception when unique_violation then
  raise exception 'A competition is already running';
end $$;

-- prize and announcement only; guesses, winners and numbers cannot be edited
create function public.set_comp_info(p_id int, p_prize text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update comps set prize = nullif(btrim(p_prize), ''), note = nullif(btrim(p_note), '') where id = p_id;
  if not found then raise exception 'No such competition'; end if;
  perform log('edited', jsonb_build_object('comp', p_id));
end $$;

create function public.create_invite(p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  loop
    c := public.new_code();
    exit when not exists (select 1 from invites where code = c);
  end loop;
  insert into invites (code, note, created_by) values (c, nullif(btrim(p_note), ''), auth.uid());
  perform log('invited', jsonb_build_object('code', c, 'note', p_note));
  return c;
end $$;

create function public.revoke_invite(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update invites set revoked_at = now() where code = p_code and used_by is null and revoked_at is null;
  perform log('invite_revoked', jsonb_build_object('code', p_code));
end $$;

create function public.set_member_access(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  update players set removed_at = case when p_active then null else now() end where id = p_id;
  if not found then raise exception 'No such member'; end if;
  perform log(case when p_active then 'restored' else 'removed' end, jsonb_build_object('member', p_id));
end $$;

-- submission log for the admin: who and when; the number only after the competition is won
create function public.admin_guesses(p_limit int default 200) returns table (
  at timestamptz, day date, comp int, name text, n int, is_win boolean)
language sql stable security definer set search_path = public as $$
  select g.at, g.day, c.n, p.name, case when c.status = 'won' then g.n end, g.is_win
    from guesses g join comps c on c.id = g.comp_id join players p on p.id = g.user_id
   where public.is_admin()
   order by g.at desc limit least(greatest(p_limit, 1), 1000)
$$;

create function public.admin_members() returns table (
  id uuid, name text, email text, is_admin boolean, joined_at timestamptz, removed_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.name, u.email::text, p.is_admin, p.joined_at, p.removed_at
    from players p join auth.users u on u.id = p.id
   where public.is_admin() order by p.joined_at
$$;

-- functions are callable only by signed-in users, and only the ones listed here
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.redeem_invite(text, text), public.submit_guess(int), public.state(), public.board(),
  public.start_competition(text, text), public.set_comp_info(int, text, text),
  public.create_invite(text), public.revoke_invite(text), public.set_member_access(uuid, boolean),
  public.admin_guesses(int), public.admin_members(), public.is_member(), public.is_admin(),
  public.kw_today(), public.kw_next_reset()
to authenticated;

-- ---------------------------------------------------------------- live updates
alter publication supabase_realtime add table public.comps, public.checkins;

-- ---------------------------------------------------------------- the founder's code
-- The first person to join with this code becomes the admin. Read it with:
--   select code from public.invites;
insert into public.invites (code, note) values (public.new_code(), 'Founder');
