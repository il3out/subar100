# SUBAR100

A private daily 100-sided dice guessing game for Town House 10. Sister app to Subar Sitta, fully separate: its own repository, Supabase project, sign-in and Vercel deployment.

Same setup as Subar Sitta: a static web app with no build step on Vercel, and Supabase for sign-in, data and all game logic.

## The rules, as the database enforces them
- Anyone who creates an account can play. The founder code (in `invites`) only makes its user the admin.
- Every Kuwait calendar day is its own game, opened automatically on the first visit of the day. No scheduler needed.
- Each game's hidden number comes from the operating system's secure random source (pgcrypto, no modulo bias) and sits in `comp_secret`, which no app user can read, admin included.
- One guess per member per day (`unique (user_id, day)`), final, no edits. No higher or lower hints.
- The first exact guess wins and ends that day's game straight away. Simultaneous exact guesses queue on a row lock, so there is exactly one winner.
- At midnight Asia/Kuwait the day's game ends: its number and everyone's guesses become visible, winner or not, and the next game opens.
- Guesses are throttled to one attempt per second per member. Sign-in attempts are rate-limited by Supabase.

## One-time setup (about 10 minutes)

### 1. Supabase (new project, not the Subar Sitta one)
1. supabase.com → **New project**, name it `subar100`.
2. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" so friends can play straight after signing up.
3. **Authentication → URL Configuration**: set **Site URL** to your SUBAR100 address (for example `https://subar100.com`). Password-reset emails link there.
4. **SQL Editor → New query**: paste all of `supabase/setup.sql` and click **Run**. Then do the same with `supabase/update-01-daily.sql`.
5. Still in the SQL Editor, read the founder (admin) code:
   ```sql
   select code from public.invites;
   ```
6. **Project Settings → API**: copy the **Project URL** and the **publishable key** into `config.js`.

### 2. GitHub and Vercel
1. Create a new private repository (for example `il3out/subar100`) and push this folder to it.
2. Vercel → **Add New → Project** → import the repository. Framework Preset **Other**, no build command, output directory = root. **Deploy**.
3. **Settings → Domains**: add your domain and copy the DNS records into your registrar.

`vercel.json` adds the security headers (Content-Security-Policy, no framing, HSTS).

### 3. Join as admin
Open the site, choose **Create account**, tap **I have an admin code** and enter the founder's code. Then share the link: friends just create an account and play.

## Files
- `index.html`, `styles.css`, `app.js`: the whole app
- `theme.js`: dark is the main mode; the half-circle button in the header switches to light and is remembered per device
- `die.js`: the 3D d100 on the guess screen. A real 100-faced solid (fixed, validated face normals; beveled edges; one numbered face per value), embroidered-fabric materials and studio lighting, spring-driven quaternion rotation controlled by the slider, a timed lock-in settle, tap a number on the die to pick it, a slow turn on the home screen (tap it to guess), haptic taps (Android vibration; iPhone iOS 18+ via the system switch) and soft synthesised sounds with an on/off switch, automatic lower quality on weak GPUs, and a flat-die fallback without WebGL. Created once per visit to the site and reused, so it never leaks or recreates its WebGL context. It only shows the member's pick; the winning number never leaves the server.
- `config.js`: Supabase URL and publishable key (public by design; the access rules protect the data)
- `supabase/setup.sql`: tables, access rules, live updates, founder code
- `supabase/update-01-daily.sql`: open sign-up, a new game every day, Winners data (run after setup.sql; safe on a live project)
- `brand/patch.webp`: the embroidered SUBAR100 logo, cut from the approved board
- `fonts/`: Anton and Inter (SIL Open Font License, licences included)
- `vendor/supabase.js`: the Supabase browser library (MIT)
- `vendor/three.module.min.js`: Three.js for the die (MIT)
- `test/`: database tests, browser tests and a local stand-in for Supabase

## Tests
Both suites run against real PostgreSQL 16 with `setup.sql` loaded and a minimal stand-in for Supabase's `auth` schema (`test/supabase-stub.sql`).
- `test/db_test.py`: 66 checks. Open sign-up and the admin code, hidden-number secrecy, daily games opening and ending at Kuwait midnight, reveal rules, one guess per day, 12 simultaneous winning guesses (exactly one winner), 12 simultaneous first visits (exactly one game), random number uniformity (100,000 rolls).
- `test/die_test.mjs` (plain Node): 911 checks on the die geometry. Exactly 100 planar, convex, outward faces forming a closed solid; every number maps to its own face; for all 100, the target rotation brings that face exactly to the front, upright and frontmost; even face sizes; every number fits its face.
- `test/die_e2e.cjs`: 32 checks in Chromium. All 100 numbers through the slider (face frontmost, centred to within 1% of the canvas, upright, and slider, number box and die agree), animated landings across the range, 1 → 100 as a single half turn, 170 rapid slider changes with no flips, plus/minus/typing, spinning by mouse and by touch, lock-in, reduced motion, the no-WebGL fallback, and 20 leave-and-return visits with flat memory.
- `test/e2e.cjs`: 87 checks in Chromium through real PostgREST and the real Supabase client. The full journey on phone, tablet and desktop, including the slider turning the die and a spun die moving the slider, axe WCAG 2.1 AA on every screen in dark and light, no sideways overflow, no console errors, and no API response ever containing the hidden number.

Not covered locally: Supabase's own email delivery (password reset) and Realtime. The app also refreshes every minute and whenever it's reopened, so it stays current without Realtime.

## Later
- **Reset today's game:** Admin → Today's game → **Reset today's game** (or run `supabase/reset-today.sql` in the SQL Editor). It deletes today's game, its number and today's guesses, and rolls a new number. Past days and accounts stay.
- **Pause someone:** Admin → Members → Remove. Their history stays and you can restore them.
- **Prize or announcement:** Admin → Prize and announcement, at any time.
