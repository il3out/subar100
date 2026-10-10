-- ============================================================================
-- SUBAR100 · update 01: open sign-up and a new game every day
-- Run once, after setup.sql. Safe on a project that already has members:
-- nobody is removed and the founder (admin) code keeps working.
--
-- What changes
--   • Anyone who creates an account can play. The founder code only makes you admin.
--   • Every Kuwait day is its own game with its own hidden number.
--   • The first exact guess wins and ends that day's game.
--   • At midnight the day's number and everyone's guesses are revealed, winner or not.
-- ============================================================================

-- one game per Kuwait day (older competitions keep day = null)
alter table public.comps add column if not exists day date unique;
alter table public.comps drop constraint if exists comps_status_check;
alter table public.comps add constraint comps_status_check check (status in ('open', 'won', 'ended'));

-- the club-wide prize and announcement (replaces per-competition fields)
create table if not exists public.club (
  id    int primary key default 1 check (id = 1),
  prize text check (char_length(prize) <= 80),
  note  text check (char_length(note) <= 280)
);
insert into public.club (id) values (1) on conflict do nothing;
alter table public.club enable row level security;
drop policy if exists club_read on public.club;
create policy club_read on public.club for select using (public.is_member());
revoke all on public.club from anon;
revoke insert, update, delete, truncate on public.club from authenticated;

-- only the founder code remains; it now means "make me admin"
delete from public.invites where note is distinct from 'Founder' and used_by is null;

-- guesses (and everyone's numbers) become visible once that day's game is over
drop policy if exists guesses_read on public.guesses;
create policy guesses_read on public.guesses for select using (
  user_id = auth.uid()
  or (public.is_member() and exists (select 1 from public.comps c where c.id = comp_id and c.status <> 'open')));

-- retire the old flow
drop function if exists public.redeem_invite(text, text);
drop function if exists public.start_competition(text, text);
drop function if exists public.set_comp_info(int, text, text);
drop function if exists public.create_invite(text);
drop function if exists public.revoke_invite(text);
drop function if exists public.submit_guess(int);
drop function if exists public.state();
drop function if exists public.admin_guesses(int);

-- ---------------------------------------------------------------- the daily clock
-- Ends any game from an earlier day (revealing its number) and opens today's.
-- Called by the app on every load and every guess, so no scheduler is needed.
create function public.tick() returns public.comps
language plpgsql security definer set search_path = public as $$
declare d date := public.kw_today(); c comps;
begin
  update comps set status = 'ended',
         winning_number = (select target from comp_secret s where s.comp_id = comps.id)
   where status = 'open' and (day is null or day < d);

  select * into c from comps where day = d;
  if found then return c; end if;

  insert into comps (n, day, start_day)
  values ((select coalesce(max(n), 0) + 1 from comps), d, d)
  on conflict do nothing
  returning * into c;
  if c.id is null then                                  -- someone else opened it a moment ago
    select * into c from comps where day = d;
  else
    insert into comp_secret values (c.id, public.secure_target());
    perform public.log('opened', jsonb_build_object('comp', c.n, 'day', d));
  end if;
  return c;
end $$;

-- ---------------------------------------------------------------- joining
-- Anyone signed in can join. The founder code, if given, makes you admin.
create function public.join_club(p_name text, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me players; known boolean; v_code text; inv invites; admin boolean := false;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 24 then
    raise exception 'Your name needs 2 to 24 characters';
  end if;
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  select * into me from players where id = uid;
  known := found;
  if known and me.removed_at is not null then raise exception 'Your membership was removed. Ask the admin.'; end if;

  if v_code <> '' then
    select * into inv from invites where invites.code = v_code and used_by is null for update;
    if not found then raise exception 'That admin code is not right'; end if;
    admin := true;
  end if;

  if known then
    if admin then
      update players set is_admin = true where id = uid;
      update invites set used_by = uid, used_at = now() where invites.code = inv.code;
      perform public.log('made_admin', '{}');
    end if;
    return jsonb_build_object('status', 'member', 'admin', admin or me.is_admin);
  end if;

  insert into players (id, name, is_admin) values (uid, btrim(p_name), admin);
  if admin then update invites set used_by = uid, used_at = now() where invites.code = inv.code; end if;
  perform public.log('joined', jsonb_build_object('admin', admin));
  return jsonb_build_object('status', 'joined', 'admin', admin);
end $$;

-- ---------------------------------------------------------------- the game
-- One locked transaction: today's game, one guess per member per day, server clock,
-- compare with the hidden number, and close the day on an exact match.
create function public.submit_guess(p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c comps; ts timestamptz; t int; gid bigint; prev int; won boolean;
begin
  if not public.is_member() then raise exception 'Members only'; end if;
  if p_n is null or p_n < 1 or p_n > 100 then raise exception 'Pick a whole number from 1 to 100'; end if;

  update players set last_try = clock_timestamp()
   where id = uid and (last_try is null or last_try < clock_timestamp() - interval '1 second');
  if not found then return jsonb_build_object('status', 'slow'); end if;

  perform public.tick();
  select * into c from comps where day = public.kw_today() for update;   -- concurrent guesses queue here
  ts := clock_timestamp();
  if c.id is null or (ts at time zone 'Asia/Kuwait')::date <> c.day then
    return jsonb_build_object('status', 'closed');                       -- midnight passed mid-request
  end if;

  select n into prev from guesses where user_id = uid and day = c.day;
  if found then return jsonb_build_object('status', 'already', 'n', prev, 'next', public.kw_next_reset()); end if;
  if c.status <> 'open' then return jsonb_build_object('status', 'closed', 'next', public.kw_next_reset()); end if;

  insert into guesses (comp_id, user_id, day, n, at) values (c.id, uid, c.day, p_n, ts)
  on conflict (user_id, day) do nothing returning id into gid;
  if gid is null then return jsonb_build_object('status', 'already', 'next', public.kw_next_reset()); end if;
  insert into checkins (user_id, day, comp_id, at) values (uid, c.day, c.id, ts);

  select target into t from comp_secret where comp_id = c.id;
  won := (p_n = t);
  if won then
    update guesses set is_win = true where id = gid;
    update comps set status = 'won', won_at = ts, winner = uid, winning_number = t, winning_guess = gid where id = c.id;
    perform public.log('won', jsonb_build_object('comp', c.n, 'number', t));
  else
    perform public.log('guessed', jsonb_build_object('comp', c.n));     -- never the number while live
  end if;

  return jsonb_build_object('status', case when won then 'won' else 'locked' end,
    'n', p_n, 'day', c.day, 'at', ts, 'comp', c.n, 'next', public.kw_next_reset());
end $$;

-- everything the home screen needs in one round trip
create function public.state() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me players; c comps; l comps; d date;
begin
  select * into me from players where id = uid;
  if not found then return jsonb_build_object('member', 'none', 'now', clock_timestamp()); end if;
  if me.removed_at is not null then return jsonb_build_object('member', 'removed', 'now', clock_timestamp()); end if;

  c := public.tick(); d := c.day;
  select * into l from comps where status <> 'open' order by id desc limit 1;

  return jsonb_build_object(
    'member', 'yes', 'admin', me.is_admin, 'now', clock_timestamp(), 'today', d, 'next', public.kw_next_reset(),
    'players', (select count(*) from players where removed_at is null),
    'in_today', coalesce((select jsonb_agg(user_id) from checkins where day = d), '[]'),
    'mine', (select jsonb_build_object('n', n, 'at', at, 'comp', comp_id) from guesses where user_id = uid and day = d),
    'prize', (select prize from club), 'note', (select note from club),
    'games', (select count(*) from comps where status <> 'open'),
    'comp', jsonb_build_object('id', c.id, 'n', c.n, 'day', c.day, 'status', c.status, 'won_at', c.won_at,
        'winner', c.winner, 'number', c.winning_number,
        'guesses', (select count(*) from guesses where comp_id = c.id)),
    'last', case when l.id is null then null else jsonb_build_object('id', l.id, 'n', l.n, 'day', coalesce(l.day, l.start_day),
        'status', l.status, 'winner', l.winner, 'number', l.winning_number, 'won_at', l.won_at,
        'guesses', (select count(*) from guesses where comp_id = l.id),
        'entrants', (select count(distinct user_id) from guesses where comp_id = l.id)) end);
end $$;

-- ---------------------------------------------------------------- admin
create function public.set_club(p_prize text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update club set prize = nullif(btrim(p_prize), ''), note = nullif(btrim(p_note), '') where id = 1;
  perform public.log('edited', '{}');
end $$;

create function public.admin_guesses(p_limit int default 200) returns table (
  at timestamptz, day date, comp int, name text, n int, is_win boolean)
language sql stable security definer set search_path = public as $$
  select g.at, g.day, c.n, p.name, case when c.status <> 'open' then g.n end, g.is_win
    from guesses g join comps c on c.id = g.comp_id join players p on p.id = g.user_id
   where public.is_admin()
   order by g.at desc limit least(greatest(p_limit, 1), 1000)
$$;

-- ---------------------------------------------------------------- permissions
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.join_club(text, text), public.submit_guess(int), public.state(), public.board(),
  public.set_club(text, text), public.set_member_access(uuid, boolean),
  public.admin_guesses(int), public.admin_members(), public.is_member(), public.is_admin(),
  public.kw_today(), public.kw_next_reset()
to authenticated;

-- open today's game now
select public.tick();
