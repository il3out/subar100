-- ============================================================================
-- SUBAR100 · reset today's game
-- Paste into Supabase → SQL Editor → New query, then Run.
-- (Needs update-01-daily.sql to have been run once.)
-- Deletes today's game (Kuwait date), its hidden number and every guess made
-- today, so everyone can guess again, then rolls a brand-new hidden number.
-- Past days, winners and accounts are untouched.
-- ============================================================================
delete from public.guesses  where day = public.kw_today();   -- includes any made under an older game
delete from public.checkins where day = public.kw_today();
with gone as (delete from public.comps where day = public.kw_today() returning n, day)
insert into public.audit (action, detail)
select 'reset_today', jsonb_build_object('comp', n, 'day', day) from gone;

-- open the new game now (rolls the new hidden number) and show today's state
select n as game_no, day, status, (select count(*) from public.guesses g where g.day = c.day) as guesses_today
from public.tick() c;
