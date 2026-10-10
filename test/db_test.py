#!/usr/bin/env python3
"""SUBAR100 database tests against a real Postgres with setup.sql loaded.
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
print("Joining and access")
founder_code = su("select code from invites where note = 'Founder'")
admin, amy, ben, stranger = (new_user(e) for e in ("admin@x.test", "amy@x.test", "ben@x.test", "stranger@x.test"))

raises("signed-out visitor cannot read members", None, "select * from players", "permission denied")
raises("signed-out visitor cannot call the game", None, "select public.state()", "permission denied")
raises("signed-out visitor cannot join", None, "select public.redeem_invite('x','y')", "permission denied")
raises("bad invite code is refused", admin, "select public.redeem_invite('NOPE1234','Abdal')", "not valid")
r = json.loads(val(admin, f"select public.redeem_invite('{founder_code.lower()}','Abdal')"))
check("first member becomes admin (code is case-insensitive)", r == {"status": "joined", "admin": True}, r)
raises("founder code works only once", amy, f"select public.redeem_invite('{founder_code}','Amy')", "not valid")
raises("non-admin cannot create invites", stranger, "select public.create_invite('x')", "admins only")
c1 = val(admin, "select public.create_invite('Amy')")
c2 = val(admin, "select public.create_invite('Ben')")
check("invite codes are 8 unambiguous characters", len(c1) == 8 and not set(c1) & set("01OI"), c1)
r = json.loads(val(amy, f"select public.redeem_invite('{c1[:4]}-{c1[4:]}','Amy')"))
check("second member joins as a non-admin (dashes ignored)", r["admin"] is False, r)
val(ben, f"select public.redeem_invite('{c2}','Ben')")
check("signed-in stranger without an invite sees no members", val(stranger, "select count(*) from players") == "0")
check("signed-in stranger sees no competitions", val(stranger, "select count(*) from comps") == "0")
check("stranger's state says not a member", json.loads(val(stranger, "select public.state()"))["member"] == "none")
raises("stranger cannot guess", stranger, "select public.submit_guess(5)", "members only")
raises("member cannot make themselves admin", amy, "update players set is_admin = true where id = auth.uid()", "permission denied")
val(amy, "update players set name = 'Amy R' where id = auth.uid()")
check("member can rename themselves", su(f"select name from players where id = '{amy}'") == "Amy R")
val(amy, f"update players set name = 'hacked' where id = '{ben}'")
check("member cannot rename someone else", su(f"select name from players where id = '{ben}'") == "Ben")
raises("avatar must be a small image data URL", amy, "update players set avatar = 'javascript:alert(1)' where id = auth.uid()", "violates check")
raises("member cannot read invites table directly... (sees none)", amy, "select 1/count(*) from invites", "division by zero")

print("Competition lifecycle")
check("guess with no competition says closed", guess(amy, 10)["status"] == "closed")
raises("member cannot start a competition", amy, "select public.start_competition('x','y')", "admins only")
val(admin, "select public.start_competition('Dinner on Abdal', 'Round one is live')")
raises("only one open competition", admin, "select public.start_competition(null,null)", "already running")
raises("nobody can read the hidden number (member)", amy, "select target from comp_secret", "permission denied")
raises("nobody can read the hidden number (admin)", admin, "select target from comp_secret", "permission denied")
raises("generator not callable from the app", admin, "select public.secure_target()", "permission denied")
raises("audit log cannot be forged", admin, "select public.log('won','{}')", "permission denied")
st = json.loads(val(amy, "select public.state()"))
check("state has no hidden number while open", st["comp"]["number"] is None and "target" not in json.dumps(st), st)
check("competition reports day 1", st["comp"]["days"] == 1, st["comp"])
target = int(su("select target from comp_secret"))
miss = 1 if target != 1 else 2
miss2 = 3 if target != 3 else 4

print("Guesses")
for bad in ("0", "101", "null", "-5"):
    raises(f"rejects guess {bad}", amy, f"select public.submit_guess({bad})", "1 to 100")
raises("rejects decimals", amy, "select public.submit_guess(4.5::numeric)", "does not exist")
su("update players set last_try = null")
r = guess(amy, miss)
check("wrong guess is locked, no hint", r["status"] == "locked" and set(r) == {"status", "n", "day", "at", "comp", "next"}, r)
su(f"update players set last_try = null where id = '{amy}'")
r = guess(amy, miss2)
check("second guess the same Kuwait day is refused with the first number", r["status"] == "already" and r["n"] == miss, r)
check("only one row stored", su(f"select count(*) from guesses where user_id = '{amy}'") == "1")
check("throttle blocks rapid repeats", guess(amy, miss2)["status"] == "slow")
raises("member cannot edit their guess", amy, "update guesses set n = 50", "permission denied")
raises("member cannot delete their guess", amy, "delete from guesses", "permission denied")
raises("admin cannot edit guesses", admin, "update guesses set n = 50", "permission denied")
raises("admin cannot edit comps directly", admin, "update comps set winner = auth.uid()", "permission denied")
raises("member cannot insert guesses directly", amy, f"insert into guesses (comp_id,user_id,day,n,at) values (1,'{amy}',current_date+5,1,now())", "permission denied")
check("Ben cannot see Amy's number while open", val(ben, "select count(*) from guesses") == "0")
check("Amy sees her own", val(amy, "select n from guesses") == str(miss))
check("Ben sees Amy is in today (no number)", val(ben, "select count(*) from checkins") == "1")
lg = val(admin, "select coalesce(n::text,'hidden') from public.admin_guesses()")
check("admin log hides numbers while open", lg == "hidden", lg)
aud = json.loads(val(admin, "select detail from audit where action='guessed'"))
check("audit records the guess without the number", set(aud) == {"comp", "day"}, aud)

print("Kuwait day boundary")
check("20:59:59 UTC is still the same Kuwait day", su("select ('2026-10-10 20:59:59+00'::timestamptz at time zone 'Asia/Kuwait')::date") == "2026-10-10")
check("21:00:00 UTC is the next Kuwait day", su("select ('2026-10-10 21:00:00+00'::timestamptz at time zone 'Asia/Kuwait')::date") == "2026-10-11")
nr = su("select to_char(public.kw_next_reset() at time zone 'Asia/Kuwait', 'HH24:MI:SS')")
check("next reset is Kuwait midnight", nr == "00:00:00", nr)
su(f"update guesses set day = day - 1 where user_id = '{amy}'; update checkins set day = day - 1 where user_id = '{amy}'; update players set last_try = null")
r = guess(amy, miss2)
check("a new Kuwait day allows a new guess", r["status"] == "locked", r)
b = {row.split("|")[0]: row.split("|") for row in val(ben, "select name, guesses, streak, in_today from public.board()").splitlines()}
check("leaderboard: Amy 2 guesses, 2-day streak, in today", b["Amy R"][1:] == ["2", "2", "t"], b)
check("leaderboard has no distance columns", "diff" not in val(ben, "select string_agg(column_name::text, ',') from (select (jsonb_each(to_jsonb(b))).key as column_name from public.board() b limit 1) x"))

print("Winning")
su("update players set last_try = null")
r = guess(ben, target)
check("exact number wins immediately", r["status"] == "won" and r["n"] == target, r)
st = json.loads(val(amy, "select public.state()"))
check("everyone sees the competition closed and the number", st["comp"]["status"] == "won" and st["comp"]["number"] == target and st["comp"]["winner"] == str(ben))
check("after the win, other numbers are revealed", val(ben, f"select count(*) from guesses where user_id = '{amy}'") == "2")
su("update players set last_try = null")
check("guessing after a win is closed", guess(admin, 50)["status"] == "closed")
check("admin log shows numbers once won", val(admin, "select count(*) from public.admin_guesses() where n is not null") == "3")

print("Members")
raises("admin cannot remove themselves", admin, f"select public.set_member_access('{admin}', false)", "yourself")
val(admin, f"select public.set_member_access('{amy}', false)")
check("removed member reads nothing", val(amy, "select count(*) from comps") == "0")
check("removed member's state says removed", json.loads(val(amy, "select public.state()"))["member"] == "removed")
raises("removed member cannot guess", amy, "select public.submit_guess(1)", "members only")
val(admin, f"select public.set_member_access('{amy}', true)")
check("restored member reads again", val(amy, "select count(*) from comps") == "1")
c3 = val(admin, "select public.create_invite('spare')")
val(admin, f"select public.revoke_invite('{c3}')")
raises("revoked invite is refused", stranger, f"select public.redeem_invite('{c3}','Zed')", "not valid")

print("Concurrency: 12 members guess the right number at the same instant")
val(admin, "select public.start_competition(null, null)")
t2 = int(su("select target from comp_secret s join comps c on c.id = s.comp_id where c.status = 'open'"))
racers = []
for i in range(12):
    u = new_user(f"racer{i}@x.test"); racers.append(u)
    val(u, f"select public.redeem_invite('{val(admin, 'select public.create_invite(null)')}', 'Racer {i}')")
su("update players set last_try = null")
with cf.ThreadPoolExecutor(12) as ex:
    res = list(ex.map(lambda u: guess(u, t2), racers))
statuses = sorted(r["status"] for r in res)
check("exactly one winner", statuses.count("won") == 1, statuses)
check("everyone else told it is closed", statuses.count("closed") == 11, statuses)
check("exactly one guess stored for that competition", su("select count(*) from guesses g join comps c on c.id=g.comp_id where c.n = 2") == "1")
w = [u for u, r in zip(racers, res) if r["status"] == "won"][0]
check("winner recorded matches the earliest stored timestamp", su("select winner from comps where n = 2") == str(w))

print("Concurrency: one member fires 8 simultaneous guesses")
val(admin, "select public.start_competition(null, null)")
t3 = int(su("select target from comp_secret s join comps c on c.id = s.comp_id where c.status = 'open'"))
fresh = [u for u in racers if u != w][0]
nums = [n for n in range(1, 101) if n != t3][:8]
su("update players set last_try = null")
with cf.ThreadPoolExecutor(8) as ex:
    res = list(ex.map(lambda n: guess(fresh, n), nums))
check("only one stored", su(f"select count(*) from guesses g join comps c on c.id=g.comp_id where c.n=3 and user_id='{fresh}'") == "1",
      [r["status"] for r in res])
check("one locked, the rest slowed or refused", sorted(r["status"] for r in res).count("locked") == 1, [r["status"] for r in res])

print("Hidden number generator")
dist = su("select string_agg(c::text, ',') from (select count(*) c from (select public.secure_target() t from generate_series(1,100000)) x group by t) y")
counts = [int(x) for x in dist.split(",")]
chi = sum((c - 1000) ** 2 / 1000 for c in counts)
check("all 100 values occur", len(counts) == 100, len(counts))
check(f"uniform (chi-square {chi:.1f} < 150 at 99 df)", chi < 150)
lo_hi = su("select min(t)||'-'||max(t) from (select public.secure_target() t from generate_series(1,20000)) x")
check("range is exactly 1-100", lo_hi == "1-100", lo_hi)

print(f"\n{passed} passed, {len(failed)} failed")
if failed: print("FAILED:", *failed, sep="\n  "); raise SystemExit(1)
