-- ============================================================================
-- SUBAR100 · reset today's game
-- Paste into Supabase → SQL Editor → New query, then Run.
-- Deletes today's game (Kuwait date), its hidden number and every guess made
-- today, so everyone can guess again. A brand-new hidden number is rolled the
-- next time anyone opens the site. Past days, winners and accounts are untouched.
-- ============================================================================
with gone as (
  delete from public.comps where day = public.kw_today() returning n, day
)
insert into public.audit (action, detail)
select 'reset_today', jsonb_build_object('comp', n, 'day', day) from gone;

-- open the new game now (rolls the new hidden number) and show today's state
select n as game_no, day, status, (select count(*) from public.guesses g where g.comp_id = c.id) as guesses
from public.tick() c;
