# SUBAR100

A private daily 100-sided dice guessing game for Town House 10. Sister app to Subar Sitta, fully separate: its own repository, Supabase project, sign-in and Vercel deployment.

Same setup as Subar Sitta: a static web app with no build step on Vercel, and Supabase for sign-in, data and all game logic.

## The rules, as the database enforces them
- The server rolls one hidden number from 1 to 100 using the operating system's secure random source (pgcrypto, no modulo bias).
- It is stored in `comp_secret`, a table no app user can read, admin included. The app is only ever told "won" or "not won".
- One guess per member per Kuwait calendar day (`unique (user_id, day)`), resetting at midnight Asia/Kuwait. This counts across competitions.
- A guess is final: members cannot edit or delete guesses, and nobody can edit winners or numbers.
- Every guess runs in one locked transaction (`submit_guess`): check the day, store the guess with the server clock, compare, close the competition on a match. Simultaneous exact guesses queue on the lock, so exactly one winner is possible.
- No higher or lower hints. Other members' numbers stay hidden until someone wins, then everything is revealed.
- Only the admin starts a new competition, and only when none is open.
- Guesses are throttled to one attempt per second per member. Sign-in attempts are rate-limited by Supabase.

## One-time setup (about 10 minutes)

### 1. Supabase (new project, not the Subar Sitta one)
1. supabase.com → **New project**, name it `subar100`.
2. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email". Friends join with an invite code.
3. **Authentication → URL Configuration**: set **Site URL** to your SUBAR100 address (for example `https://subar100.com`). Password-reset emails link there.
4. **SQL Editor → New query**: paste all of `supabase/setup.sql` and click **Run**.
5. Still in the SQL Editor, read the founder's invite code:
   ```sql
   select code from public.invites;
   ```
6. **Project Settings → API**: copy the **Project URL** and the **publishable key** into `config.js`.

### 2. GitHub and Vercel
1. Create a new private repository (for example `il3out/subar100`) and push this folder to it.
2. Vercel → **Add New → Project** → import the repository. Framework Preset **Other**, no build command, output directory = root. **Deploy**.
3. **Settings → Domains**: add your domain and copy the DNS records into your registrar.

`vercel.json` adds the security headers (Content-Security-Policy, no framing, HSTS).

### 3. Join first
Open the site, choose **Join with invite**, and use the founder's code. The first person to join becomes the admin.
Then: **Admin → Start competition**, and **Admin → Invites → Create** one code per friend. **Share** sends a link that fills in the code.

## Files
- `index.html`, `styles.css`, `app.js`: the whole app
- `theme.js`: dark is the main mode; the half-circle button in the header switches to light and is remembered per device
- `die.js`: the 3D 100-faced die on the guess screen (loads only there; falls back to a flat die without WebGL)
- `config.js`: Supabase URL and publishable key (public by design; the access rules protect the data)
- `supabase/setup.sql`: tables, access rules, game and admin functions, live updates, founder invite
- `brand/patch.webp`: the embroidered SUBAR100 logo, cut from the approved board
- `fonts/`: Anton and Inter (SIL Open Font License, licences included)
- `vendor/supabase.js`: the Supabase browser library (MIT)
- `vendor/three.module.min.js`: Three.js for the die (MIT)
- `test/`: database tests, browser tests and a local stand-in for Supabase

## Tests
Both suites run against real PostgreSQL 16 with `setup.sql` loaded and a minimal stand-in for Supabase's `auth` schema (`test/supabase-stub.sql`).
- `test/db_test.py`: 72 checks. Access rules, invites, hidden-number secrecy, Kuwait day boundary, one guess per day, 12 simultaneous winning guesses (exactly one winner), 8 simultaneous guesses by one member (one stored), random number uniformity (100,000 rolls).
- `test/e2e.cjs`: 73 checks in Chromium through real PostgREST and the real Supabase client. The full journey on phone, tablet and desktop, including the slider turning the die and a spun die moving the slider, axe WCAG 2.1 AA on every screen in dark and light, no sideways overflow, no console errors, and no API response ever containing the hidden number.

Not covered locally: Supabase's own email delivery (password reset) and Realtime. The app also refreshes every minute and whenever it's reopened, so it stays current without Realtime.

## Later
- **Pause someone:** Admin → Members → Remove. Their history stays and you can restore them.
- **Prize or announcement:** Admin → Competition, at any time.
