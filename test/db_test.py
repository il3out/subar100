#!/usr/bin/env python3
"""SUBAR100 database tests against a real Postgres with setup.sql + update-01-daily.sql loaded.
Usage: python3 test/db_test.py  (PGHOST/PGPORT/PGDATABASE env, default localhost:5433/s100)
Runs every call through the same roles and access rules the app uses."""
import json, os, subprocess, uuid, concurrent.futures as cf

ENV = dict(os.environ, PGHOST=os.environ.get("PGHOST", "localhost"), PGPORT=os.environ.get("PGPORT", "5433"),
           PGDATABASE=os.environ.get("PGDATABASE", "s100"), PGUSER="postgres")
passed, failed = 0, []

def psql(*sqls):
    args = ["psql", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"]
    for s in sqls: args += ["-c", s]
    p = subprocess.run(args, env=ENV, capture_output=True, text=True)
    return p.returncode == 0, (p.stdout.strip() if p.returncode == 0 else p.stderr.strip())

def as_user(uid, sql):
    """Run sql as the API would: role authenticated (or anon) with the user's JWT claims."""
    role = "anon" if uid is None else "authenticated"
    claims = json.dumps({"sub": str(uid), "role": role}) if uid else "{}"
    return psql("begin", f"set local role {role}", f"set local request.jwt.claims = '{claims}'", sql, "commit")

def val(uid, sql):
    ok, out = as_user(uid, sql)
    if not ok: raise RuntimeError(out)
    return out

def check(name, cond, detail=""):
    global passed
    if cond: passed += 1; print("  pass ", name)
    else: failed.append(name); print("  FAIL ", name, detail)

def raises(name, uid, sql, fragment):
    ok, out = as_user(uid, sql)
    check(name, (not ok) and fragment.lower() in out.lower(), out)

def new_user(email):
    uid = uuid.uuid4()
    psql(f"insert into auth.users (id, email) values ('{uid}', '{email}')")
    return uid

def guess(uid, n):
    return json.loads(val(uid, f"select public.submit_guess({n})"))

def su(sql):
    ok, out = psql(sql)
    if not ok: raise RuntimeError(out)
    return out

# ---------------------------------------------------------------------------
def today_target(): return int(su("select target from comp_secret s join comps c on c.id = s.comp_id where c.day = public.kw_today()"))
def new_day():
    """Pretend midnight passed: shift every dated row back one day."""
    su("update comps set day = day - 1, start_day = start_day - 1 where day is not null;"
       "update guesses set day = day - 1; update checkins set day = day - 1; update players set last_try = null")
def unthrottle(): su("update players set last_try = null")

print("Joining")
founder = su("select code from invites where note = 'Founder'")
admin, amy, ben, eve = (new_user(e) for e in ("admin@x.test", "amy@x.test", "ben@x.test", "eve@x.test"))
raises("signed-out visitor cannot read members", None, "select * from players", "permission denied")
raises("signed-out visitor cannot call the game", None, "select public.state()", "permission denied")
raises("signed-out visitor cannot join", None, "select public.join_club('x')", "permission denied")
check("signed-in non-member sees nothing", val(eve, "select count(*) from players") == "0" and json.loads(val(eve, "select public.state()"))["member"] == "none")
r = json.loads(val(amy, "select public.join_club('Amy')"))
check("anyone can join without a code", r == {"status": "joined", "admin": False}, r)
raises("wrong admin code is refused", ben, "select public.join_club('Ben', 'WRONG123')", "not right")
check("a refused code does not create the member", su(f"select count(*) from players where id = '{ben}'") == "0")
val(ben, "select public.join_club('Ben')")
r = json.loads(val(admin, f"select public.join_club('Abdal', '{founder[:4].lower()}-{founder[4:]}')"))
check("founder code makes you admin (any case, dashes ok)", r["admin"] is True, r)
raises("founder code works only once", eve, f"select public.join_club('Eve', '{founder}')", "not right")
raises("name must be 2-24 characters", eve, "select public.join_club('E')", "2 to 24")
raises("member cannot make themselves admin", amy, "update players set is_admin = true where id = auth.uid()", "permission denied")
val(amy, f"update players set name = 'hacked' where id = '{ben}'")
check("member cannot rename someone else", su(f"select name from players where id = '{ben}'") == "Ben")
raises("avatar must be a small image data URL", amy, "update players set avatar = 'javascript:alert(1)' where id = auth.uid()", "violates check")
raises("old invite flow is gone", admin, "select public.create_invite('x')", "does not exist")

print("Today's game opens on its own")
st = json.loads(val(amy, "select public.state()"))
check("state opens game 1 for today", st["comp"]["n"] == 1 and st["comp"]["status"] == "open" and st["comp"]["day"] == st["today"], st["comp"])
check("loading again does not open another", json.loads(val(ben, "select public.state()"))["comp"]["id"] == st["comp"]["id"] and su("select count(*) from comps") == "1")
check("state never carries the hidden number while open", st["comp"]["number"] is None and "target" not in json.dumps(st))
raises("nobody can read the hidden number (member)", amy, "select target from comp_secret", "permission denied")
raises("nobody can read the hidden number (admin)", admin, "select target from comp_secret", "permission denied")
raises("the clock cannot be called from the app", amy, "select public.tick()", "permission denied")
raises("generator not callable from the app", admin, "select public.secure_target()", "permission denied")
raises("audit log cannot be forged", admin, "select public.log('won','{}')", "permission denied")
t = today_target(); miss = 1 if t != 1 else 2; miss2 = 3 if t != 3 else 4

print("Guesses")
for bad in ("0", "101", "null", "-5"):
    raises(f"rejects guess {bad}", amy, f"select public.submit_guess({bad})", "1 to 100")
unthrottle(); r = guess(amy, miss)
check("wrong guess is locked, no hint", r["status"] == "locked" and set(r) == {"status", "n", "day", "at", "comp", "next"}, r)
unthrottle(); r = guess(amy, miss2)
check("second guess the same day is refused with the first number", r["status"] == "already" and r["n"] == miss, r)
check("throttle blocks rapid repeats", guess(amy, miss2)["status"] == "slow")
raises("member cannot edit their guess", amy, "update guesses set n = 50", "permission denied")
raises("admin cannot edit guesses", admin, "update guesses set n = 50", "permission denied")
raises("admin cannot edit games directly", admin, "update comps set winner = auth.uid()", "permission denied")
check("Ben cannot see Amy's number while today is open", val(ben, "select count(*) from guesses") == "0")
check("Ben sees Amy is in today", val(ben, "select count(*) from checkins") == "1")
check("admin log hides numbers while open", val(admin, "select coalesce(n::text,'hidden') from public.admin_guesses()") == "hidden")

print("Midnight: the day's game ends and a new one opens")
check("Kuwait midnight is 21:00 UTC", su("select ('2026-10-10 21:00:00+00'::timestamptz at time zone 'Asia/Kuwait')::date") == "2026-10-11"
      and su("select ('2026-10-10 20:59:59+00'::timestamptz at time zone 'Asia/Kuwait')::date") == "2026-10-10")
new_day()
st = json.loads(val(ben, "select public.state()"))
check("yesterday's game ended with no winner and its number revealed", st["last"]["status"] == "ended" and st["last"]["number"] == t and st["last"]["winner"] is None, st["last"])
check("a fresh game 2 is open today", st["comp"]["n"] == 2 and st["comp"]["status"] == "open")
check("everyone can now see yesterday's guesses", val(ben, f"select count(*) from guesses where user_id = '{amy}'") == "1")
check("admin log reveals yesterday's numbers", val(admin, "select count(*) from public.admin_guesses() where n is not null") == "1")
t2 = today_target()
check("each day rolls a new hidden number row", su("select count(*) from comp_secret") == "2")
unthrottle(); r = guess(amy, miss2 if miss2 != t2 else 5)
check("a new day allows a new guess", r["status"] == "locked", r)
b = {row.split("|")[0]: row.split("|") for row in val(ben, "select name, guesses, streak, in_today from public.board()").splitlines()}
check("leaderboard: Amy 2 guesses, 2-day streak, in today", b["Amy"][1:] == ["2", "2", "t"], b)

print("Winning ends the day")
unthrottle(); r = guess(ben, t2)
check("exact number wins straight away", r["status"] == "won", r)
st = json.loads(val(amy, "select public.state()"))
check("everyone sees today won, the number and the winner", st["comp"]["status"] == "won" and st["comp"]["number"] == t2 and st["comp"]["winner"] == str(ben))
check("today's guesses are revealed once won", val(amy, f"select count(*) from guesses where user_id = '{ben}'") == "1")
unthrottle(); check("nobody else can guess after the win", guess(admin, 50)["status"] == "closed")
check("the 'last game' is today's win", st["last"]["n"] == 2 and st["last"]["status"] == "won")
new_day()
st = json.loads(val(amy, "select public.state()"))
check("next day opens game 3 and leaves the win alone", st["comp"]["n"] == 3 and su("select status from comps where n = 2") == "won")

print("Admin")
raises("member cannot edit the prize", amy, "select public.set_club('x','y')", "admins only")
val(admin, "select public.set_club('Dinner on Abdal', 'Good luck')")
st = json.loads(val(amy, "select public.state()"))
check("prize and announcement reach members", st["prize"] == "Dinner on Abdal" and st["note"] == "Good luck")
raises("admin cannot remove themselves", admin, f"select public.set_member_access('{admin}', false)", "yourself")
val(admin, f"select public.set_member_access('{amy}', false)")
check("removed member is locked out", json.loads(val(amy, "select public.state()"))["member"] == "removed")
raises("removed member cannot guess", amy, "select public.submit_guess(1)", "members only")
raises("removed member cannot rejoin", amy, "select public.join_club('Amy')", "removed")
val(admin, f"select public.set_member_access('{amy}', true)")
check("restored member plays again", json.loads(val(amy, "select public.state()"))["member"] == "yes")

print("Concurrency: 12 members guess the right number at the same instant")
new_day(); val(admin, "select public.state()")
t3 = today_target(); racers = []
for i in range(12):
    u = new_user(f"racer{i}@x.test"); racers.append(u); val(u, f"select public.join_club('Racer {i}')")
unthrottle()
with cf.ThreadPoolExecutor(12) as ex: res = list(ex.map(lambda u: guess(u, t3), racers))
st_ = sorted(r["status"] for r in res)
check("exactly one winner", st_.count("won") == 1, st_)
check("the other 11 told the day is closed", st_.count("closed") == 11, st_)
check("exactly one guess stored for that game", su("select count(*) from guesses g join comps c on c.id = g.comp_id where c.day = public.kw_today()") == "1")

print("Concurrency: the first visitors of a new day open exactly one game")
new_day()
with cf.ThreadPoolExecutor(12) as ex: list(ex.map(lambda u: val(u, "select public.state()"), racers))
check("one game for today", su("select count(*) from comps where day = public.kw_today()") == "1")
check("one hidden number for it", su("select count(*) from comp_secret s join comps c on c.id = s.comp_id where c.day = public.kw_today()") == "1")
check("game numbers stay in sequence", su("select string_agg(n::text, ',' order by n) from comps") == "1,2,3,4,5")

print("Concurrency: one member fires 8 simultaneous guesses")
t5 = today_target(); nums = [n for n in range(1, 101) if n != t5][:8]; unthrottle()
with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(lambda n: guess(racers[0], n), nums))
check("only one stored", su(f"select count(*) from guesses where user_id = '{racers[0]}' and day = public.kw_today()") == "1", [r["status"] for r in res])

print("Hidden number generator")
counts = [int(x) for x in su("select string_agg(c::text, ',') from (select count(*) c from (select public.secure_target() t from generate_series(1,100000)) x group by t) y").split(",")]
chi = sum((c - 1000) ** 2 / 1000 for c in counts)
check("all 100 values occur", len(counts) == 100, len(counts))
check(f"uniform (chi-square {chi:.1f} < 150 at 99 df)", chi < 150)
check("range is exactly 1-100", su("select min(t)||'-'||max(t) from (select public.secure_target() t from generate_series(1,20000)) x") == "1-100")

print(f"\n{passed} passed, {len(failed)} failed")
if failed: print("FAILED:", *failed, sep="\n  "); raise SystemExit(1)
