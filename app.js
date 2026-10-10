/* SUBAR100 · a private daily d100 for Town House 10.
   The hidden number never reaches this file: the database only answers "won" or "not won". */
"use strict";

/* ===================== helpers ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TZ = "Asia/Kuwait";
const fmt = (d, o) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o }).format(new Date(d));
const fDay = d => fmt(d.length === 10 ? d + "T12:00:00+03:00" : d, { weekday: "short", day: "numeric", month: "short" });
const fDate = d => fmt(d, { day: "numeric", month: "long", year: "numeric" });
const fTime = d => fmt(d, { hour: "2-digit", minute: "2-digit" });
const plural = (n, w, p = w + "s") => `${n} ${n === 1 ? w : p}`;
const pad = n => String(n).padStart(2, "0");
const no = n => `No. ${pad(n)}`;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const buzz = () => navigator.userActivation?.hasBeenActive && navigator.vibrate?.(8);

const I = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
const ic = {
  play: I('<path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9z"/><path d="M12 2.5v6M3.5 7.5 8 10.5M20.5 7.5 16 10.5M8 10.5h8L12 17zM12 17v4.5M8 10.5 3.5 16.5M16 10.5l4.5 6"/>'),
  board: I('<path d="M4 20V13h5v7M9 20V8h6v12M15 20v-9h5v9M3 20h18"/>'),
  you: I('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"/>'),
  admin: I('<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>'),
  users: I('<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c1-3 3.5-4.6 6.5-4.6s5.5 1.6 6.5 4.6M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.9c1.8.6 3 2.2 3.5 4.6"/>'),
  clock: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>'),
  flame: I('<path d="M12 21.5c-4 0-7-2.8-7-6.7 0-3.3 2.2-5.3 3.6-7.6.3 2 1.2 3 2.3 3.6C11 7 12.3 4.4 14.8 2.5c-.3 3.4 4.2 6.1 4.2 11.3 0 4.6-3 7.7-7 7.7z"/>'),
  cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 2.5v5M16 2.5v5"/>'),
  lock: I('<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.6"'),
  minus: I('<path d="M5 12h14"/>', 'stroke-width="2.6"'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>', 'class="arr"'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  share: I('<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  camera: I('<path d="M3.5 8.5a2 2 0 0 1 2-2h2.3l1.5-2.5h5.4l1.5 2.5h2.3a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>'),
  dice: I('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>'),
  pennant: I('<path d="M5 3v18M5 4.5l14 4.5-14 4.5"/>'),
  copy: I('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>'),
  theme: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>'),
  doc: I('<path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v4h4M9 12h6M9 16h6"/>'),
  x: I('<path d="M6 6l12 12M18 6 6 18"/>')
};

/* the d100: a red twenty-sided die with 100 on the face */
function dieSVG(face = "100") {
  const V = [[100, 6], [181, 53], [181, 147], [100, 194], [19, 147], [19, 53]], A = [100, 46], B = [149, 131], C = [51, 131];
  const faces = [
    [V[5], V[0], A, "#E8343A"], [V[0], V[1], A, "#D21A20"], [V[1], B, A, "#B5121A"], [V[1], V[2], B, "#951018"],
    [V[2], V[3], B, "#7E0A10"], [V[3], C, B, "#A00E15"], [V[3], V[4], C, "#8A0A10"], [V[4], V[5], C, "#B8141B"], [V[5], A, C, "#DD2329"]];
  const P = pts => pts.map(p => p.join(",")).join(" ");
  const ctr = f => [(f[0][0] + f[1][0] + f[2][0]) / 3, (f[0][1] + f[1][1] + f[2][1]) / 3];
  const small = { 0: ["38", -32], 1: ["77", 32], 3: ["15", 62], 6: ["92", -60], 7: ["64", -68] };
  return `<svg viewBox="0 0 200 200" role="img" aria-label="A one hundred sided die">
  <defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0423F"/><stop offset=".55" stop-color="#C81014"/><stop offset="1" stop-color="#8E070C"/></linearGradient>
  <radialGradient id="dh" cx=".35" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <g class="spin">${faces.map(f => `<polygon points="${P(f.slice(0, 3))}" fill="${f[3]}" stroke="#F1E6DA" stroke-opacity=".28" stroke-width="1.2" stroke-linejoin="round"/>`).join("")}
  <polygon points="${P([A, B, C])}" fill="url(#dg)" stroke="#F1E6DA" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round"/>
  ${Object.entries(small).map(([i, [t, r]]) => { const [x, y] = ctr(faces[i]); return `<text x="${x}" y="${y}" transform="rotate(${r} ${x} ${y})" text-anchor="middle" dominant-baseline="central" font-family="Anton" font-size="15" fill="#F1E6DA" fill-opacity=".85">${t}</text>`; }).join("")}
  <text x="100" y="${face.length > 2 ? 104 : 106}" text-anchor="middle" dominant-baseline="central" font-family="Anton" font-size="${face.length > 2 ? 30 : 40}" fill="#FAF8F5">${esc(face)}</text>
  <polygon points="${P(V)}" fill="url(#dh)" stroke="#7A0006" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round"/></g></svg>`;
}

/* flat everyday logo: the badge shape drawn cleanly, the embroidered patch is kept for hero moments */
const flatLogo = (cls = "logo") => `<svg class="${cls}" viewBox="0 0 260 78" role="img" aria-label="SUBAR100">
  <rect x="1.5" y="1.5" width="257" height="75" rx="18" fill="#C81014" stroke="#7A0006" stroke-width="3"/>
  <rect x="8" y="8" width="244" height="62" rx="12.5" fill="none" stroke="#F1E6DA" stroke-width="3.2"/>
  <text x="130" y="41" text-anchor="middle" dominant-baseline="central" font-family="Anton" font-size="47" letter-spacing="1" fill="#F1E6DA">SUBAR100</text></svg>`;

/* ===================== data ===================== */
const sb = supabase.createClient(window.S100.url, window.S100.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const S = { uid: null, email: "", st: null, board: [], mine: [], comps: [], people: {}, recovery: false, ready: false, offset: 0, err: null, adm: null, tab: { board: "friends" }, val: 50 };

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}
async function sel(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
const errText = e => {
  const m = (e && (e.message || e.error_description)) || "";
  if (/fetch|network|Failed to/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
  return m || "Something went wrong. Try again.";
};

async function loadAll() {
  try {
    S.st = await rpc("state");
    S.offset = Date.parse(S.st.now) - Date.now();
    if (S.st.member === "yes") {
      const [board, mine, comps, people] = await Promise.all([
        rpc("board"),
        sel(sb.from("guesses").select("id,comp_id,day,n,at,is_win").eq("user_id", S.uid).order("at", { ascending: false })),
        sel(sb.from("comps").select("*").order("n", { ascending: false })),
        sel(sb.from("players").select("id,name,avatar,joined_at,removed_at"))]);
      Object.assign(S, { board, mine, comps, people: Object.fromEntries(people.map(p => [p.id, p])) });
    }
    S.err = null;
  } catch (e) { S.err = errText(e); }
  S.ready = true;
  const key = `${S.st?.member}|${comp()?.id}|${comp()?.status}|${!!S.st?.mine}`;
  if (!(route()[0] === "guess" && S.die && key === S.lastKey)) render();
  S.lastKey = key;
  maybeReveal();
}
let reloadT;
const reload = () => { clearTimeout(reloadT); reloadT = setTimeout(loadAll, 250); };

/* live: competitions and today's check-ins; plus a slow poll and a refresh on return */
let chan;
function live() {
  if (chan) return;
  chan = sb.channel("s100")
    .on("postgres_changes", { event: "*", schema: "public", table: "comps" }, reload)
    .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, reload)
    .subscribe();
}
setInterval(() => { if (S.uid && document.visibilityState === "visible") reload(); }, 60000);
document.addEventListener("visibilitychange", () => { if (S.uid && document.visibilityState === "visible") reload(); });

/* ===================== clock ===================== */
const now = () => Date.now() + S.offset;
function left(t) {
  const ms = Math.max(0, Date.parse(t) - now()), s = Math.floor(ms / 1000);
  return { h: Math.floor(s / 3600), m: Math.floor(s / 60) % 60, s: s % 60, done: ms <= 0 };
}
const clockHTML = (t, cls = "") => { const l = left(t); return `<div class="clock ${cls}" data-clock="${esc(t)}" role="timer" aria-label="Time until your next guess">
  <div class="u"><b>${pad(l.h)}</b><i>HRS</i></div><div class="u"><b>${pad(l.m)}</b><i>MIN</i></div><div class="u"><b>${pad(l.s)}</b><i>SEC</i></div></div>`; };
setInterval(() => {
  for (const el of $$("[data-clock]")) {
    const l = left(el.dataset.clock), b = $$("b", el);
    [l.h, l.m, l.s].forEach((v, i) => { if (b[i] && b[i].textContent !== pad(v)) b[i].textContent = pad(v); });
    if (l.done && !el.dataset.fired) { el.dataset.fired = 1; setTimeout(loadAll, 1500); }
  }
}, 1000);

/* ===================== small UI ===================== */
let toastT;
function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("bad", bad); t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3400);
}
const person = id => S.people[id] || S.board.find(b => b.id === id) || { name: "Former member" };
const initials = n => String(n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const av = (id, cls = "") => { const p = person(id); return `<span class="av ${cls}" aria-hidden="true">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(initials(p.name))}</span>`; };
const me = () => person(S.uid);
const comp = () => S.st?.comp;
const route = () => (location.hash.replace(/^#\/?/, "") || "play").split("/");
const go = h => { if (location.hash !== "#/" + h) location.hash = "#/" + h; else render(); };

function transition(fn) {
  if (document.startViewTransition && !reduced.matches) document.startViewTransition(fn); else fn();
}

/* ===================== shell ===================== */
const NAV = [["play", "Play", ic.play], ["board", "Board", ic.board], ["you", "You", ic.you]];
const isDark = () => document.documentElement.dataset.theme !== "light";
function shell(active) {
  const nav = S.st?.admin ? [...NAV, ["admin", "Admin", ic.admin]] : NAV;
  const mast = $("#mast"), bar = $("#tabbar");
  mast.hidden = bar.hidden = false; document.body.classList.remove("out");
  mast.innerHTML = `<div class="mast-in"><a class="logo-link" href="#/play" aria-label="SUBAR100 home">${flatLogo()}</a>
    <nav class="topnav" aria-label="Sections">${nav.map(([k, l]) => `<a href="#/${k}" ${k === active ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <button class="theme" id="themeBtn" type="button" aria-label="${isDark() ? "Switch to light mode" : "Switch to dark mode"}">${ic.theme}</button>
    <a class="me" href="#/you"><span class="me-name">${esc(me().name)}</span><span class="sr">Your profile</span>${av(S.uid, "sm")}</a></div>`;
  $("#themeBtn").onclick = () => {
    const v = isDark() ? "light" : "dark";
    try { localStorage.setItem("s100-theme", v); } catch { }
    transition(() => { document.documentElement.dataset.theme = v; $('meta[name="theme-color"]').setAttribute("content", v === "dark" ? "#110509" : "#FAF8F5"); shell(active); });
  };
  bar.innerHTML = nav.map(([k, l, i]) => `<a href="#/${k}" ${k === active ? 'aria-current="page"' : ""}>${i}<span>${l}</span></a>`).join("");
}
function bare() { $("#mast").hidden = $("#tabbar").hidden = true; document.body.classList.add("out"); }
addEventListener("scroll", () => $("#mast").classList.toggle("scrolled", scrollY > 4), { passive: true });

/* ===================== render ===================== */
function render() {
  const main = $("#main");
  S.die?.destroy(); S.die = null;
  if (!S.ready) return;
  if (S.recovery) { bare(); main.innerHTML = doorHTML("reset"); return bindDoor(); }
  if (!S.uid) { bare(); main.innerHTML = doorHTML(new URLSearchParams(location.search).get("invite") ? "join" : "signin"); return bindDoor(); }
  if (S.err && !S.st) { bare(); main.innerHTML = `<div class="door"><div class="door-in"><img class="patch" src="brand/patch.webp" alt="SUBAR100"><div class="panel"><p class="h3">Couldn't load SUBAR100</p><p class="muted">${esc(S.err)}</p><button class="btn btn-primary btn-block" id="retry">Try again</button></div></div></div>`; $("#retry").onclick = loadAll; return; }
  if (S.st.member === "none") { bare(); main.innerHTML = doorHTML("redeem"); return bindDoor(); }
  if (S.st.member === "removed") { bare(); main.innerHTML = removedHTML(); $("#out").onclick = signOut; return; }

  const [r, arg] = route();
  const views = { play: playView, guess: guessView, board: boardView, you: youView, comp: () => compView(+arg), admin: adminView };
  const v = views[r] || playView;
  if (r === "admin" && !S.st.admin) return go("play");
  shell(r === "guess" ? "play" : r === "comp" ? "board" : (views[r] ? r : "play"));
  main.innerHTML = v();
  bind[r]?.(arg);
  document.title = { guess: "Make your guess", board: "Board", you: "You", admin: "Admin", comp: "Competition recap" }[r] ? `${{ guess: "Make your guess", board: "Board", you: "You", admin: "Admin", comp: "Competition recap" }[r]} · SUBAR100` : "SUBAR100";
}
addEventListener("hashchange", () => { transition(render); scrollTo({ top: 0 }); $("#main").focus({ preventScroll: true }); });
const bind = {};

/* ---------- door ---------- */
function doorHTML(mode) {
  const inv = new URLSearchParams(location.search).get("invite") || "";
  const tabs = mode === "signin" || mode === "join" ? `<div class="seg" role="tablist">
      <button role="tab" aria-selected="${mode === "signin"}" data-mode="signin">Sign in</button>
      <button role="tab" aria-selected="${mode === "join"}" data-mode="join">Join with invite</button></div>` : "";
  const f = {
    signin: `<div class="fields"><div class="field"><label for="em">Email</label><input class="inp" id="em" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="pw">Password</label><input class="inp" id="pw" type="password" autocomplete="current-password" required></div></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="signin">Sign in</button>
      <button class="btn btn-quiet btn-block" data-act="forgot">Forgot password</button>`,
    join: `<div class="fields"><div class="field"><label for="code">Invite code</label><input class="inp code-inp" id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" value="${esc(inv)}" required><small>From the member who invited you.</small></div>
      <div class="field"><label for="nm">Your name</label><input class="inp" id="nm" autocomplete="nickname" maxlength="24" placeholder="For example Bu Salem" required></div>
      <div class="field"><label for="em">Email</label><input class="inp" id="em" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="pw">Password</label><input class="inp" id="pw" type="password" autocomplete="new-password" minlength="8" required><small>At least 8 characters.</small></div></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="join">Create account and join</button>`,
    redeem: `<p class="h3" style="margin:0 0 4px">One step left</p><p class="muted" style="margin:0 0 16px">Enter your invite code to join the club.</p>
      <div class="fields"><div class="field"><label for="code">Invite code</label><input class="inp code-inp" id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" value="${esc(inv)}"></div>
      <div class="field"><label for="nm">Your name</label><input class="inp" id="nm" maxlength="24" placeholder="For example Bu Salem"></div></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="redeem">Join the club</button>
      <button class="btn btn-quiet btn-block" data-act="out">Sign out</button>`,
    reset: `<p class="h3" style="margin:0 0 14px">Choose a new password</p><div class="fields"><div class="field"><label for="npw">New password</label><input class="inp" id="npw" type="password" autocomplete="new-password" minlength="8"><small>At least 8 characters.</small></div></div>
      <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="setpw">Save new password</button>`
  };
  return `<div class="door"><div class="door-in">
    <p class="eyebrow">A private daily d100 game for friends</p>
    <img class="patch" src="brand/patch.webp" alt="SUBAR100" width="330" height="113">
    <p class="tag">Same friends. A new challenge every day.</p>
    <form class="panel" novalidate data-mode="${mode}">${tabs}${f[mode]}<p class="err" id="err" role="alert"></p></form>
    <p class="door-foot">Town House 10. Members only.</p></div></div>`;
}
function bindDoor() {
  const form = $(".panel");
  $$("[data-mode]", form).forEach(b => b.onclick = e => { e.preventDefault(); $("#main").innerHTML = doorHTML(b.dataset.mode); bindDoor(); $("input", $("#main"))?.focus(); });
  const err = (m, ok) => { const e = $("#err"); e.textContent = m; e.classList.toggle("ok", !!ok); };
  form.onsubmit = e => { e.preventDefault(); $("[data-act]", form)?.click(); };
  $$("[data-act]", form).forEach(b => b.onclick = async e => {
    e.preventDefault();
    const a = b.dataset.act, v = id => ($("#" + id)?.value || "").trim();
    const email = v("em"), pw = $("#pw")?.value || "";
    const busy = on => { b.disabled = on; if (on) b.dataset.label = b.textContent, b.textContent = "One moment…"; else if (b.dataset.label) b.textContent = b.dataset.label; };
    try {
      if (a === "signin") {
        if (!/^\S+@\S+\.\S+$/.test(email) || !pw) return err("Enter your email and password.");
        busy(true);
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw new Error(/invalid/i.test(error.message) ? "That email and password don't match." : error.message);
      }
      if (a === "forgot") {
        if (!/^\S+@\S+\.\S+$/.test(email)) return err("Enter your email first, then tap Forgot password.");
        busy(true);
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (error) throw error;
        busy(false); return err("If that email is a member, a reset link is on its way.", true);
      }
      if (a === "join") {
        const code = v("code"), nm = v("nm");
        if (code.replace(/\W/g, "").length < 8) return err("Enter the 8-character invite code.");
        if (nm.length < 2) return err("Your name needs at least 2 characters.");
        if (!/^\S+@\S+\.\S+$/.test(email)) return err("Enter a valid email.");
        if (pw.length < 8) return err("Use at least 8 characters for your password.");
        busy(true);
        S.pending = { code, nm };
        const { data, error } = await sb.auth.signUp({ email, password: pw });
        if (error) { S.pending = null; throw new Error(/registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead, then enter your code." : error.message); }
        if (!data.session) { S.pending = null; busy(false); return err("Check your email to confirm, then sign in and enter your code.", true); }
      }
      if (a === "redeem") {
        const code = v("code"), nm = v("nm");
        if (code.replace(/\W/g, "").length < 8) return err("Enter the 8-character invite code.");
        if (nm.length < 2) return err("Your name needs at least 2 characters.");
        busy(true); await redeem(code, nm);
      }
      if (a === "setpw") {
        const np = $("#npw").value;
        if (np.length < 8) return err("Use at least 8 characters.");
        busy(true);
        const { error } = await sb.auth.updateUser({ password: np });
        if (error) throw error;
        S.recovery = false; history.replaceState(null, "", location.pathname + "#/play"); toast("Password saved"); loadAll();
      }
      if (a === "out") signOut();
    } catch (x) { busy(false); err(errText(x)); }
  });
}
async function redeem(code, nm) {
  const r = await rpc("redeem_invite", { p_code: code, p_name: nm });
  history.replaceState(null, "", location.pathname + "#/play");
  await loadAll();
  toast(r.admin ? "Welcome. You're the club admin." : "Welcome to SUBAR100");
}
const removedHTML = () => `<div class="door"><div class="door-in"><img class="patch" src="brand/patch.webp" alt="SUBAR100" width="330" height="113">
  <div class="panel"><p class="h3" style="margin:0 0 6px">Your membership is paused</p><p class="muted" style="margin:0 0 16px">The club admin has removed your access. Your history is kept. Ask the admin if you think this is a mistake.</p>
  <button class="btn btn-ghost btn-block" id="out">Sign out</button></div></div></div>`;
async function signOut() { await sb.auth.signOut(); S.st = null; S.uid = null; location.hash = ""; render(); }

/* ---------- play (home) ---------- */
function heroHTML() {
  const c = comp(), mine = S.st.mine;
  const top = c ? `<div class="hero-top"><span class="eyebrow">Competition ${no(c.n)} · Day ${c.days}</span>${c.status === "open" ? `<span class="pill pill-ivory">Live</span>` : `<span class="pill pill-line">Closed</span>`}</div>` : `<div class="hero-top"><span class="eyebrow">Town House 10</span></div>`;
  if (!c) return `<section class="card hero red stitch" aria-labelledby="ht">${top}<div class="die" aria-hidden="true">${dieSVG()}</div>
    <div class="hero-body"><div><h1 class="hero-title" id="ht">The die is resting.</h1><p class="hero-sub">No competition is running yet. ${S.st.admin ? "Start the first one and the hidden number is rolled on the server." : "The admin starts the next one. You'll see it here."}</p></div>
    ${S.st.admin ? `<a class="btn btn-ivory btn-big" href="#/admin">Start a competition ${ic.arrow}</a>` : ""}</div></section>`;
  if (c.status === "won") return `<section class="card hero red stitch" aria-labelledby="ht">${top}
    <div class="hero-body"><div><p class="eyebrow" style="color:var(--warm)">The number was</p><p class="disp" style="font-size:clamp(110px,30vw,170px);margin:6px 0 0;color:var(--warm)" id="ht">${c.number}</p></div>
    <div style="display:flex;align-items:center;gap:12px">${av(c.winner, "lg")}<div><p class="h2" style="color:var(--warm)">${esc(person(c.winner).name)}</p><p class="hero-sub" style="margin:2px 0 0">Won on ${fDay(c.won_at)} after ${plural(c.days, "day")} and ${plural(c.guesses, "guess", "guesses")}.</p></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-ivory" href="#/comp/${c.n}">See the recap ${ic.arrow}</a>${S.st.admin ? `<a class="btn btn-quiet" style="color:var(--ivory)" href="#/admin">Start the next one</a>` : ""}</div></div></section>`;
  if (mine) return `<section class="card hero red stitch" aria-labelledby="ht">${top}
    <div class="hero-body"><div><h1 class="hero-title" id="ht">Locked in.</h1><p class="hero-sub">Not the number. It's still out there. Your next guess opens at midnight, Kuwait time.</p></div>
    <div class="locked-num"><span class="tok" aria-label="Your guess today: ${mine.n}">${mine.n}</span><div><p class="eyebrow" style="color:var(--ivory);margin:0 0 8px">Next guess in</p>${clockHTML(S.st.next)}</div></div></div></section>`;
  return `<section class="card hero red stitch" aria-labelledby="ht">${top}<div class="die" aria-hidden="true">${dieSVG()}</div>
    <div class="hero-body"><div><h1 class="hero-title" id="ht">Today's guess is open.</h1><p class="hero-sub">One hidden number from 1 to 100. It stays the same until someone finds it.</p></div>
    <a class="btn btn-ivory btn-big" href="#/guess">Make your guess ${ic.arrow}</a></div></section>`;
}
function playView() {
  const c = comp(), st = S.st, mineB = S.board.find(b => b.id === S.uid) || {};
  const inToday = new Set(st.in_today || []);
  const crew = [...S.board].sort((a, b) => (inToday.has(b.id) - inToday.has(a.id)) || a.name.localeCompare(b.name));
  const tile = (icon, k, v, unit = "") => `<div class="stat"><span class="k">${icon}${k}</span><span class="v num">${v}${unit ? `<small>${unit}</small>` : ""}</span></div>`;
  return `<div class="view split"><div class="col">${heroHTML()}
    <div class="stats" aria-label="Today at a glance">
      ${tile(ic.users, "Players", st.players)}
      ${tile(ic.check, "In today", inToday.size, `/ ${st.players}`)}
      ${tile(ic.flame, "Your streak", mineB.streak || 0, (mineB.streak || 0) === 1 ? "day" : "days")}
      ${tile(ic.cal, "Days running", c && c.status === "open" ? c.days : "–")}
    </div></div>
    <div class="col">
    ${c?.prize || c?.note ? `<div class="note">${ic.pennant}<div>${c.prize ? `<b>The prize</b>${esc(c.prize)}` : ""}${c.note ? `<p style="margin:${c.prize ? "6px" : 0} 0 0;color:var(--ink)">${esc(c.note)}</p>` : ""}</div></div>` : ""}
    <section class="card" aria-labelledby="wh"><div class="card-h"><h2 class="h3" id="wh">Who's in today</h2>${c?.status === "open" ? `<span class="live">Live</span>` : ""}</div>
      <div class="bar" style="margin-bottom:16px" aria-hidden="true"><i style="width:${st.players ? (inToday.size / st.players * 100) : 0}%"></i></div>
      ${crew.length ? `<div class="crew">${crew.map(p => `<div class="mate ${inToday.has(p.id) ? "in" : "out"}"><span class="chk">${av(p.id)}</span><span>${esc(p.id === S.uid ? "You" : p.name.split(" ")[0])}</span><span class="sr">${inToday.has(p.id) ? "has guessed today" : "not in yet"}</span></div>`).join("")}</div>` : ""}
      <p class="quiet" style="font-size:13px;margin:14px 0 0">Numbers stay private until someone wins.</p></section>
    <section class="card" aria-labelledby="hw"><h2 class="h3" id="hw" style="margin-bottom:14px">How it works</h2><ol class="howto">
      <li>The server rolls one hidden number from 1 to 100.</li><li>You get one guess a day. It resets at midnight, Kuwait time.</li>
      <li>The number never changes until someone guesses it exactly.</li><li>First exact guess wins. No hints, no higher or lower.</li></ol></section>
    </div></div>`;
}

/* ---------- guess ---------- */
function guessView() {
  const c = comp(), st = S.st;
  if (!c || c.status !== "open") return `<div class="view"><section class="card empty">${ic.lock}<p class="h3">No competition is open</p><p>${c ? "This one has a winner." : "The admin will start one soon."}</p><a class="btn btn-ghost" href="#/play">Back to today</a></section></div>`;
  if (st.mine) return lockedHTML(st.mine.n, false);
  return `<div class="view guess-wrap">
    <section class="card pick" aria-labelledby="gh">
      <header class="pick-head"><p class="eyebrow">Competition ${no(c.n)} · ${fDay(st.today)}</p><h1 class="h2" id="gh">Choose your number</h1></header>
      <div class="stage"><canvas id="die3d" aria-hidden="true"></canvas><div class="die-flat" id="dieFlat" hidden aria-hidden="true">${dieSVG(String(S.val))}</div>
        <button class="roll" id="rnd">${ic.dice.replace('aria-hidden="true"', 'aria-hidden="true" width="16" height="16"')} Roll it</button>
        <p class="drag-hint" aria-hidden="true">Drag the die to spin it</p></div>
      <div class="controls">
      <div class="bignum" id="big"><label class="sr" for="num">Your number from 1 to 100</label>
        <input id="num" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${S.val}" aria-describedby="gh-hint"></div>
      <div class="dialrow"><button class="step" id="dn" aria-label="One lower">${ic.minus}</button>
        <div class="range"><label class="sr" for="rng">Slide to choose a number</label><input type="range" id="rng" min="1" max="100" step="1" value="${S.val}" style="--p:${(S.val - 1) / 99 * 100}%">
        <div class="ticks" aria-hidden="true"><span>1</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>
        <button class="step" id="up" aria-label="One higher">${ic.plus}</button></div>
      <button class="btn btn-primary btn-big btn-block" id="lock">Lock in my guess</button>
      <p class="rules-line" id="gh-hint">${ic.lock} One guess a day. Once locked, it's final.</p>
      </div>
    </section></div>`;
}
bind.guess = () => {
  const inp = $("#num"), rng = $("#rng"), big = $("#big");
  if (!inp) return;
  let lastV = S.val, die = null;
  const show = (v, src) => {
    v = Math.min(100, Math.max(1, v | 0)); S.val = v;
    if (inp.value !== String(v) && src !== "type") inp.value = v;
    rng.value = v; rng.style.setProperty("--p", `${(v - 1) / 99 * 100}%`);
    if (v !== lastV) { lastV = v; buzz(); big.classList.remove("bump"); void big.offsetWidth; big.classList.add("bump"); }
    if (src !== "die") { if (die) die.set(v); else $("#dieFlat").innerHTML = dieSVG(String(v)); }
  };
  // the 3D die loads only on this screen; without WebGL the flat die stands in
  import("./die.js").then(m => m.createDie($("#die3d"), { value: S.val, reduced: reduced.matches, onPick: k => show(k, "die") }))
    .then(d => { if ($("#die3d")?.isConnected) { die = S.die = d; } else d.destroy(); })
    .catch(() => { $("#die3d").hidden = true; $("#dieFlat").hidden = false; $(".drag-hint").hidden = true; });
  rng.oninput = () => show(+rng.value, "range");
  inp.oninput = () => { const d = inp.value.replace(/\D/g, "").slice(0, 3); inp.value = d; if (d && +d >= 1 && +d <= 100) show(+d, "type"); };
  inp.onblur = () => show(+inp.value || S.val);
  inp.onkeydown = e => { if (e.key === "ArrowUp") { e.preventDefault(); show(S.val + 1); } if (e.key === "ArrowDown") { e.preventDefault(); show(S.val - 1); } if (e.key === "Enter") { e.preventDefault(); show(+inp.value || S.val); confirmSheet(); } };
  let hold;
  const rep = (d) => { show(S.val + d); hold = setTimeout(() => { hold = setInterval(() => show(S.val + d), 90); }, 380); };
  const stop = () => { clearTimeout(hold); clearInterval(hold); };
  for (const [id, d] of [["dn", -1], ["up", 1]]) {
    const b = $("#" + id);
    b.onpointerdown = e => { e.preventDefault(); rep(d); };
    b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
    b.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(S.val + d); } };
  }
  $("#rnd").onclick = () => { const a = new Uint8Array(1); crypto.getRandomValues(a); const k = a[0] % 100 + 1; if (die) die.roll(k); else show(k); };
  $("#lock").onclick = () => { show(+inp.value || S.val); confirmSheet(); };
};

function confirmSheet() {
  const v = S.val, layer = $("#layer"), prev = document.activeElement;
  layer.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ch" aria-describedby="cd">
    <p class="eyebrow">Final answer</p><h2 class="h2" id="ch">Lock in ${v}?</h2>
    <span class="tok solid stamp" aria-hidden="true">${v}</span>
    <p class="muted" id="cd" style="margin:0">Once it's locked, you can't change it today.</p>
    <div class="acts"><button class="btn btn-primary btn-big btn-block" id="go">Lock it in</button><button class="btn btn-quiet btn-block" id="no">Not yet</button></div></div></div>`;
  const close = () => { layer.innerHTML = ""; prev?.focus?.(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); if (e.key === "Tab") { const f = $$("button", layer); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); } } };
  document.addEventListener("keydown", onKey);
  $("#scrim").onclick = e => { if (e.target.id === "scrim") close(); };
  $("#no").onclick = close;
  const btn = $("#go"); btn.focus();
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Locking in…"; $("#no").disabled = true;
    let r;
    try { r = await rpc("submit_guess", { p_n: v }); }
    catch (e) { btn.disabled = false; $("#no").disabled = false; btn.textContent = "Try again"; toast(errText(e) + " Your guess was not saved.", true); return; }
    close();
    if (r.status === "won") { S.wonNow = true; history.replaceState(null, "", "#/play"); await loadAll(); return; }
    if (r.status === "locked") { await loadAll(); $("#main").innerHTML = lockedHTML(r.n, true); return; }
    if (r.status === "already") { toast(r.n ? `You already guessed ${r.n} today.` : "You already guessed today."); await loadAll(); return go("play"); }
    if (r.status === "closed") { toast("This competition just ended."); await loadAll(); return go("play"); }
    if (r.status === "slow") { toast("One moment, then try again."); }
  };
}
function lockedHTML(n, fresh) {
  return `<div class="view" style="max-width:640px;margin:0 auto;width:100%"><section class="card pick" aria-labelledby="lh">
    <p class="eyebrow">${fresh ? "Saved on the server" : "Today's guess"}</p>
    <span class="tok solid ${fresh ? "stamp" : ""}" style="--s:150px" aria-hidden="true">${n}</span>
    <h1 class="h2" id="lh">${fresh ? `Locked in. ${n} it is.` : `You picked ${n} today.`}</h1>
    <p class="muted" style="margin:0;max-width:34ch">Not the number. It's still out there. Come back after midnight, Kuwait time, for your next guess.</p>
    ${clockHTML(S.st.next, "ink")}
    <a class="btn btn-ghost" href="#/play">Back to today</a></section></div>`;
}

/* ---------- board ---------- */
function boardView() {
  const t = S.tab.board, inToday = new Set(S.st.in_today || []);
  const ranked = [...S.board].sort((a, b) => b.wins - a.wins || b.guesses - a.guesses || b.streak - a.streak || a.name.localeCompare(b.name));
  const won = S.comps.filter(c => c.status === "won");
  const friends = ranked.length ? `<div class="rows">${ranked.map((p, i) => `<div class="row"><span class="rank ${i === 0 && p.wins ? "top" : ""}">${i + 1}</span>${av(p.id)}
      <div class="grow"><div class="t">${esc(p.name)}${p.id === S.uid ? ' <span class="quiet" style="font-weight:500">(you)</span>' : ""}</div><div class="s">${plural(p.guesses, "guess", "guesses")}${comp()?.status === "open" ? ` · ${inToday.has(p.id) ? "In today" : "Not in yet"}` : ""}</div></div>
      <div class="metrics"><div class="metric"><b>${p.wins}</b><i>Wins</i></div><div class="metric"><b>${p.streak}</b><i>Streak</i></div></div></div>`).join("")}</div>`
    : `<div class="empty">${ic.users}<p>No members yet.</p></div>`;
  const winners = won.length ? `<div class="rows">${won.map(c => `<a class="row" href="#/comp/${c.n}" style="text-decoration:none;color:inherit">
      <span class="tok" style="--s:48px">${c.winning_number}</span><div class="grow"><div class="t">${esc(person(c.winner).name)}</div>
      <div class="s">Competition ${no(c.n)} · ${fDay(c.won_at)} · ${plural(dayCount(c), "day")}</div></div>${ic.arrow.replace('class="arr"', 'width="20" height="20" style="color:var(--ink-3)"')}</a>`).join("")}</div>`
    : `<div class="empty">${ic.pennant}<p class="h3">No winners yet</p><p>The first exact guess takes the pennant.</p></div>`;
  return `<div class="view"><div><p class="eyebrow">The club</p><h1 class="h1" style="margin-top:6px">Leaderboard</h1></div>
    <section class="card"><div class="tabs" role="tablist"><button role="tab" aria-selected="${t === "friends"}" data-t="friends">Friends</button><button role="tab" aria-selected="${t === "winners"}" data-t="winners">Winners</button></div>
    ${t === "friends" ? friends : winners}
    ${t === "friends" ? `<p class="quiet" style="font-size:13px;margin:14px 0 0">Ranked by competitions won, then guesses made. Nobody is ranked by how close they are.</p>` : ""}</section></div>`;
}
bind.board = () => $$("[data-t]").forEach(b => b.onclick = () => { S.tab.board = b.dataset.t; transition(render); });
const dayCount = c => Math.round((Date.parse((c.won_at ? fmt(c.won_at, { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").reverse().join("-") : S.st.today) + "T00:00:00Z") - Date.parse(c.start_day + "T00:00:00Z")) / 864e5) + 1;

/* ---------- competition recap ---------- */
function compView(n) {
  const c = S.comps.find(x => x.n === n);
  if (!c) return `<div class="view"><section class="card empty">${ic.info}<p class="h3">Competition not found</p><a class="btn btn-ghost" href="#/board">Back to the board</a></section></div>`;
  if (c.status !== "won") return `<div class="view"><section class="card empty">${ic.lock}<p class="h3">Competition ${no(c.n)} is still live</p><p>Guesses are revealed once someone wins.</p><a class="btn btn-ghost" href="#/play">Back to today</a></section></div>`;
  const all = S.recap?.[n];
  const rows = all ? all.map(g => `<tr ${g.is_win ? 'style="background:var(--tint)"' : ""}><td>${fDay(g.day)}</td><td><span style="display:flex;align-items:center;gap:10px">${av(g.user_id, "sm")}${esc(person(g.user_id).name)}</span></td>
      <td class="r"><span class="disp" style="font-size:20px;${g.is_win ? "color:var(--brand)" : ""}">${g.n}</span></td><td class="r quiet">${fTime(g.at)}</td></tr>`).join("") : "";
  return `<div class="view"><a class="btn btn-quiet" href="#/board" style="justify-self:start;padding-left:4px">${ic.back} Board</a>
    <section class="card hero red stitch" style="min-height:0"><div class="hero-top"><span class="eyebrow">Competition ${no(c.n)} · Recap</span><span class="pill pill-line">${fDay(c.won_at)}</span></div>
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;position:relative;z-index:1"><span class="tok" style="--s:120px">${c.winning_number}</span>
      <div><p class="eyebrow" style="color:var(--warm)">Winner</p><p class="h1" style="color:var(--warm);margin-top:4px">${esc(person(c.winner).name)}</p>
      <p class="hero-sub" style="margin-top:6px">Found it on day ${dayCount(c)}${c.prize ? `. Prize: ${esc(c.prize)}` : ""}.</p></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:1"><button class="btn btn-ivory" id="card">${ic.share} Victory card</button><button class="btn btn-quiet" style="color:var(--ivory)" id="cert">${ic.doc} Certificate</button></div></section>
    <section class="card"><div class="card-h"><h2 class="h3">Every guess</h2><span class="quiet num" style="font-size:13px">${all ? plural(all.length, "guess", "guesses") : ""}</span></div>
      ${all ? `<div class="scroll-x"><table class="table"><thead><tr><th>Day</th><th>Member</th><th class="r">Guess</th><th class="r">Time</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="sk" style="height:180px"></div>`}</section></div>`;
}
bind.comp = async n => {
  n = +n; const c = S.comps.find(x => x.n === n);
  if (!c || c.status !== "won") return;
  $("#card").onclick = () => shareImage(victoryCard(c), `subar100-winner-${c.n}.png`);
  $("#cert").onclick = () => shareImage(certificate(c), `subar100-certificate-${c.n}.png`);
  if (!S.recap?.[n]) {
    try {
      const all = await sel(sb.from("guesses").select("user_id,day,n,at,is_win").eq("comp_id", c.id).order("at", { ascending: false }));
      S.recap = { ...S.recap, [n]: all };
      if (route()[0] === "comp" && +route()[1] === n) render();
    } catch (e) { toast(errText(e), true); }
  }
};

/* ---------- you ---------- */
function youView() {
  const m = me(), b = S.board.find(x => x.id === S.uid) || { guesses: 0, streak: 0, wins: 0, entered: 0 };
  const days = [...new Set(S.mine.map(g => g.day))].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) { const t = Date.parse(d + "T00:00:00Z"); run = prev !== null && t - prev === 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  const byComp = S.comps.map(c => ({ c, g: S.mine.filter(g => g.comp_id === c.id) })).filter(x => x.g.length);
  const tile = (k, v) => `<div class="stat"><span class="k">${k}</span><span class="v num">${v}</span></div>`;
  return `<div class="view grid2"><div style="display:grid;gap:16px">
    <section class="card"><div class="profile-head">
      <label class="avatar-edit" for="avf" title="Change photo">${av(S.uid, "xl")}<span class="badge">${ic.camera}</span><span class="sr">Change your photo</span></label>
      <input type="file" id="avf" accept="image/*" class="sr">
      <div class="grow" style="min-width:0"><p class="eyebrow">Member since ${fDate(m.joined_at || S.board.find(x => x.id === S.uid)?.joined_at || Date.now())}</p>
      <form id="nameF" style="display:flex;gap:8px;margin-top:8px"><label class="sr" for="nmE">Display name</label><input class="inp" id="nmE" value="${esc(m.name)}" maxlength="24" style="min-height:44px"><button class="btn btn-ghost" style="min-height:44px;padding:0 16px">Save</button></form></div></div></section>
    <div class="stats">${tile("Guesses", b.guesses)}${tile("Streak", b.streak)}${tile("Best streak", best)}${tile("Wins", b.wins)}</div>
    <section class="card"><h2 class="h3" style="margin-bottom:10px">Account</h2><dl class="kv"><dt>Email</dt><dd style="word-break:break-all">${esc(S.email)}</dd><dt>Competitions entered</dt><dd>${b.entered}</dd></dl>
      <hr class="hr" style="margin:16px 0"><form id="pwF" class="fields"><div class="field"><label for="pwN">New password</label><input class="inp" id="pwN" type="password" autocomplete="new-password" minlength="8"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost">Change password</button><button type="button" class="btn btn-quiet" id="out">Sign out</button></div></form></section></div>
    <section class="card"><h2 class="h3" style="margin-bottom:6px">Your guesses</h2>
      ${byComp.length ? byComp.map(({ c, g }) => `<div style="margin-top:14px"><div class="card-h" style="margin-bottom:4px"><span class="eyebrow">Competition ${no(c.n)}</span>
        ${c.status === "won" ? `<span class="pill ${c.winner === S.uid ? "pill-red" : "pill-ink"}">${c.winner === S.uid ? "You won" : `Number was ${c.winning_number}`}</span>` : `<span class="pill pill-red">${ic.lock.replace("<svg", '<svg width="12" height="12"')} Live</span>`}</div>
        <div class="rows">${g.map(x => `<div class="row"><span class="tok ${x.is_win ? "solid" : ""}" style="--s:40px">${x.n}</span><div class="grow"><div class="t">${fDay(x.day)}</div><div class="s">${x.is_win ? "Winning guess" : `Locked at ${fTime(x.at)}`}</div></div></div>`).join("")}</div></div>`).join("")
      : `<div class="empty">${ic.dice}<p class="h3">No guesses yet</p><p>Your daily guesses will collect here.</p>${comp()?.status === "open" && !S.st.mine ? `<a class="btn btn-primary" href="#/guess">Make your first guess</a>` : ""}</div>`}</section></div>`;
}
bind.you = () => {
  $("#out").onclick = signOut;
  $("#nameF").onsubmit = async e => {
    e.preventDefault(); const v = $("#nmE").value.trim();
    if (v.length < 2) return toast("Your name needs at least 2 characters.", true);
    try { await sel(sb.from("players").update({ name: v }).eq("id", S.uid)); toast("Name saved"); loadAll(); } catch (x) { toast(errText(x), true); }
  };
  $("#pwF").onsubmit = async e => {
    e.preventDefault(); const v = $("#pwN").value;
    if (v.length < 8) return toast("Use at least 8 characters.", true);
    const { error } = await sb.auth.updateUser({ password: v });
    if (error) return toast(errText(error), true);
    $("#pwN").value = ""; toast("Password changed");
  };
  $("#avf").onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const bmp = await createImageBitmap(f), s = Math.min(bmp.width, bmp.height), cv = document.createElement("canvas");
      cv.width = cv.height = 256;
      cv.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
      const url = cv.toDataURL("image/jpeg", .82);
      await sel(sb.from("players").update({ avatar: url }).eq("id", S.uid));
      toast("Photo updated"); loadAll();
    } catch (x) { toast("Couldn't use that photo. Try another one.", true); }
  };
};

/* ---------- admin ---------- */
function adminView() {
  const c = comp(), A = S.adm;
  const open = c?.status === "open";
  const inv = A ? A.invites.filter(i => !i.used_by && !i.revoked_at) : [];
  const actLabel = { joined: "joined", guessed: "guessed", won: "won", started: "started a competition", edited: "edited prize or note", invited: "created an invite", invite_revoked: "cancelled an invite", removed: "removed a member", restored: "restored a member" };
  return `<div class="view"><div><p class="eyebrow">Club admin</p><h1 class="h1" style="margin-top:6px">Admin</h1></div>
  <div class="grid2"><div style="display:grid;gap:16px">
    <section class="card"><div class="card-h"><h2 class="h3">Competition</h2>${c ? `<span class="pill ${open ? "pill-red" : "pill-ink"}">${open ? `${no(c.n)} live` : `${no(c.n)} closed`}</span>` : ""}</div>
      ${open ? `<dl class="kv"><dt>Started</dt><dd>${fDate(c.started_at)}</dd><dt>Days running</dt><dd>${c.days}</dd><dt>Guesses so far</dt><dd>${c.guesses}</dd><dt>Members entered</dt><dd>${c.entrants} of ${S.st.players}</dd><dt>Hidden number</dt><dd>${ic.lock.replace("<svg", '<svg width="14" height="14" style="vertical-align:-2px"')} Sealed</dd></dl>
        <hr class="hr" style="margin:16px 0"><form id="infoF" class="fields"><div class="field"><label for="pz">Prize (optional)</label><input class="inp" id="pz" maxlength="80" value="${esc(c.prize || "")}"></div>
        <div class="field"><label for="nt">Announcement (optional)</label><textarea class="inp" id="nt" maxlength="280">${esc(c.note || "")}</textarea></div><button class="btn btn-ghost">Save prize and note</button></form>`
      : `<p class="muted" style="margin-top:0">${c ? `${no(c.n)} was won by ${esc(person(c.winner).name)}. ` : ""}Start a new competition and the server rolls a fresh hidden number. Nobody can see it, including you.</p>
        <form id="startF" class="fields"><div class="field"><label for="pz">Prize (optional)</label><input class="inp" id="pz" maxlength="80" placeholder="For example Dinner at Freej Swaileh"></div>
        <div class="field"><label for="nt">Announcement (optional)</label><textarea class="inp" id="nt" maxlength="280" placeholder="A note everyone sees on the home screen"></textarea></div>
        <button class="btn btn-primary btn-block">Start competition ${no((S.comps[0]?.n || 0) + 1)}</button></form>`}</section>
    <section class="card"><div class="card-h"><h2 class="h3">Invites</h2></div><p class="muted" style="margin-top:0">Each code works once. Share the link and your friend joins straight in.</p>
      <form id="invF" style="display:flex;gap:8px"><label class="sr" for="invN">Who is it for</label><input class="inp" id="invN" maxlength="40" placeholder="Who is it for? (optional)" style="min-height:48px"><button class="btn btn-primary" style="min-height:48px;padding:0 18px">Create</button></form>
      <div id="newInv"></div>
      ${A ? (inv.length ? `<div class="rows" style="margin-top:10px">${inv.map(i => `<div class="row"><div class="grow"><div class="code">${esc(i.code)}</div><div class="s">${esc(i.note || "No name")} · ${fDay(i.created_at)}</div></div>
          <button class="btn btn-quiet" data-copy="${esc(i.code)}" aria-label="Copy invite link for ${esc(i.note || i.code)}">${ic.copy}</button><button class="btn btn-quiet" data-revoke="${esc(i.code)}">Cancel</button></div>`).join("")}</div>` : `<p class="quiet" style="font-size:13.5px;margin:14px 0 0">No open invites.</p>`) : `<div class="sk" style="height:60px;margin-top:12px"></div>`}</section>
  </div><div style="display:grid;gap:16px">
    <section class="card"><div class="card-h"><h2 class="h3">Members</h2><span class="quiet" style="font-size:13px">${A ? A.members.filter(m => !m.removed_at).length : ""} active</span></div>
      ${A ? `<div class="rows">${A.members.map(m => `<div class="row">${av(m.id, "sm")}<div class="grow"><div class="t">${esc(m.name)}${m.is_admin ? ' <span class="pill pill-red" style="min-height:20px;font-size:9.5px">Admin</span>' : ""}</div><div class="s" style="word-break:break-all">${esc(m.email)}${m.removed_at ? " · Removed" : ""}</div></div>
        ${m.id === S.uid ? "" : `<button class="btn btn-quiet" data-member="${m.id}" data-on="${m.removed_at ? 1 : 0}">${m.removed_at ? "Restore" : "Remove"}</button>`}</div>`).join("")}</div>` : `<div class="sk" style="height:120px"></div>`}</section>
    <section class="card"><div class="card-h"><h2 class="h3">Submissions</h2><span class="quiet" style="font-size:12.5px">Numbers show once a competition is won</span></div>
      ${A ? (A.guesses.length ? `<div class="scroll-x"><table class="table"><thead><tr><th>When (Kuwait)</th><th>Member</th><th class="r">No.</th><th class="r">Guess</th></tr></thead><tbody>
        ${A.guesses.slice(0, 60).map(g => `<tr><td class="num">${fDay(g.at)}, ${fmt(g.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td><td>${esc(g.name)}</td><td class="r">${pad(g.comp)}</td><td class="r">${g.n == null ? ic.lock.replace("<svg", '<svg width="14" height="14" style="color:var(--ink-3)" aria-label="Sealed"') : `<b${g.is_win ? ' style="color:var(--brand)"' : ""}>${g.n}</b>`}</td></tr>`).join("")}</tbody></table></div>` : `<p class="quiet" style="margin:0">No guesses yet.</p>`) : `<div class="sk" style="height:120px"></div>`}</section>
    <section class="card"><h2 class="h3" style="margin-bottom:8px">Activity log</h2>
      ${A ? `<div class="rows">${A.audit.slice(0, 40).map(a => `<div class="row" style="padding:9px 0"><div class="grow"><div class="t" style="font-weight:500;font-size:14px">${esc(a.actor ? person(a.actor).name : "System")} ${esc(actLabel[a.action] || a.action)}${a.detail?.comp ? ` · ${no(a.detail.comp)}` : ""}</div></div><span class="s num">${fDay(a.at)} ${fTime(a.at)}</span></div>`).join("")}</div>` : `<div class="sk" style="height:120px"></div>`}</section>
  </div></div></div>`;
}
async function loadAdmin() {
  try {
    const [members, invites, guesses, audit] = await Promise.all([rpc("admin_members"),
      sel(sb.from("invites").select("*").order("created_at", { ascending: false })), rpc("admin_guesses", { p_limit: 200 }),
      sel(sb.from("audit").select("*").order("at", { ascending: false }).limit(100))]);
    S.adm = { members, invites, guesses, audit };
    if (route()[0] === "admin") { render(); }
  } catch (e) { toast(errText(e), true); }
}
const inviteLink = code => `${location.origin}${location.pathname}?invite=${code}`;
async function shareInvite(code, note) {
  const url = inviteLink(code), text = `You're invited to SUBAR100${note ? `, ${note}` : ""}. One guess a day, one hidden number. Join with code ${code}: ${url}`;
  if (navigator.share) { try { await navigator.share({ title: "SUBAR100 invite", text }); return; } catch (e) { if (e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(text); toast("Invite link copied"); } catch { toast(`Code ${code}`); }
}
bind.admin = () => {
  if (!S.adm) loadAdmin();
  const f = (id, fn) => { const el = $("#" + id); if (el) el.onsubmit = async e => { e.preventDefault(); const b = $("button", el); b.disabled = true; try { await fn(); } catch (x) { toast(errText(x), true); } b.disabled = false; }; };
  f("startF", async () => { const r = await rpc("start_competition", { p_prize: $("#pz").value, p_note: $("#nt").value }); toast(`Competition ${no(r.n)} is live`); S.adm = null; await loadAll(); });
  f("infoF", async () => { await rpc("set_comp_info", { p_id: comp().id, p_prize: $("#pz").value, p_note: $("#nt").value }); toast("Saved"); loadAll(); });
  f("invF", async () => {
    const note = $("#invN").value.trim(), code = await rpc("create_invite", { p_note: note });
    $("#invN").value = "";
    $("#newInv").innerHTML = `<div class="note" style="margin-top:12px;align-items:center">${ic.check}<div class="grow"><b>New invite${note ? ` for ${esc(note)}` : ""}</b><span class="code" style="color:var(--ink)">${esc(code)}</span></div><button class="btn btn-primary" style="min-height:42px" id="shareNew">${ic.share} Share</button></div>`;
    $("#shareNew").onclick = () => shareInvite(code, note);
    const keep = $("#newInv").innerHTML; await loadAdmin(); const n = $("#newInv"); if (n) { n.innerHTML = keep; $("#shareNew").onclick = () => shareInvite(code, note); }
  });
  $$("[data-copy]").forEach(b => b.onclick = () => shareInvite(b.dataset.copy, S.adm.invites.find(i => i.code === b.dataset.copy)?.note));
  $$("[data-revoke]").forEach(b => b.onclick = async () => { try { await rpc("revoke_invite", { p_code: b.dataset.revoke }); toast("Invite cancelled"); loadAdmin(); } catch (x) { toast(errText(x), true); } });
  $$("[data-member]").forEach(b => b.onclick = async () => {
    const on = b.dataset.on === "1", m = S.adm.members.find(x => x.id === b.dataset.member);
    if (!on && !confirm(`Remove ${m.name}? They lose access straight away. Their history is kept and you can restore them.`)) return;
    try { await rpc("set_member_access", { p_id: m.id, p_active: on }); toast(on ? `${m.name} restored` : `${m.name} removed`); loadAdmin(); loadAll(); } catch (x) { toast(errText(x), true); }
  });
};

/* ===================== the winner moment ===================== */
function maybeReveal() {
  const c = comp();
  if (!c || c.status !== "won" || S.st?.member !== "yes") return;
  let seen; try { seen = localStorage.getItem("s100-seen-" + c.id); } catch { }
  if (seen && !S.wonNow) return;
  S.wonNow = false;
  try { localStorage.setItem("s100-seen-" + c.id, "1"); } catch { }
  reveal({ ...S.comps.find(x => x.id === c.id), guesses: c.guesses, entrants: c.entrants });
}
function reveal(c) {
  const layer = $("#layer"), mine = c.winner === S.uid, w = person(c.winner), prev = document.activeElement;
  layer.innerHTML = `<div class="reveal" role="dialog" aria-modal="true" aria-labelledby="rv"><div class="ribbons" aria-hidden="true"></div><div class="reveal-in">
    <img class="pennant" src="brand/patch.webp" alt="" width="300" height="103">
    <p class="eyebrow" id="rv">${mine ? "You found it" : "We have a winner"} · Competition ${no(c.n)}</p>
    <p class="rollnum" id="roll" aria-live="off">00</p><p class="sr">The winning number is ${c.winning_number}.</p>
    <div class="who fade-up" style="animation-delay:1.6s">${av(c.winner, "lg")}<div><b>${esc(mine ? "You" : w.name)}</b><small>${mine ? "Brilliance looks good on you." : `guessed ${c.winning_number} on ${fDay(c.won_at)}`}</small></div></div>
    <div class="facts fade-up" style="animation-delay:1.8s"><div><b>${dayCount(c)}</b><i>Days</i></div><div><b>${c.guesses ?? comp()?.guesses ?? "–"}</b><i>Guesses</i></div><div><b>${c.entrants ?? comp()?.entrants ?? "–"}</b><i>Players</i></div></div>
    <div class="acts fade-up" style="animation-delay:2s"><button class="btn btn-ivory btn-big" id="vc">${ic.share} Share victory card</button>
      ${mine ? `<button class="btn btn-ghost" id="ct">${ic.doc} Winner certificate</button>` : ""}<button class="btn btn-quiet" id="rx">Close</button></div></div></div>`;
  const roll = $("#roll"), target = c.winning_number, t0 = performance.now(), dur = reduced.matches ? 0 : 1500;
  const step = t => {
    const p = dur ? Math.min(1, (t - t0) / dur) : 1;
    if (p < 1) { roll.textContent = pad(1 + Math.floor(Math.random() * 100) % 100); requestAnimationFrame(step); }
    else { roll.textContent = target; roll.classList.add("land"); buzz(); ribbons(); }
  };
  requestAnimationFrame(step);
  const full = { ...c, guesses: c.guesses ?? comp()?.guesses, entrants: c.entrants ?? comp()?.entrants };
  $("#vc").onclick = () => shareImage(victoryCard(full), `subar100-winner-${c.n}.png`);
  if ($("#ct")) $("#ct").onclick = () => shareImage(certificate(full), `subar100-certificate-${c.n}.png`);
  const close = () => { layer.innerHTML = ""; document.removeEventListener("keydown", k); prev?.focus?.(); };
  const k = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", k);
  $("#rx").onclick = close; $("#vc").focus({ preventScroll: true });
}
function ribbons() {
  if (reduced.matches) return;
  const box = $(".ribbons"); if (!box) return;
  box.innerHTML = Array.from({ length: 36 }, (_, i) => `<i style="left:${Math.random() * 100}%;animation-duration:${2.6 + Math.random() * 2.4}s;animation-delay:${Math.random() * .6}s;opacity:${.5 + Math.random() * .5};${i % 3 ? "" : "background:#fff;"}transform:rotate(${Math.random() * 180}deg)"></i>`).join("");
}

/* ===================== share images (drawn on the device) ===================== */
const patchImg = new Image(); patchImg.src = "brand/patch.webp";
async function ready() { await Promise.all([document.fonts.load("400 100px Anton"), document.fonts.load("700 20px Inter"), patchImg.decode().catch(() => { })]); }
function mesh(x, w, h) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#D2161B"); g.addColorStop(.5, "#C81014"); g.addColorStop(1, "#8E070C");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(60,0,3,.22)";
  for (let yy = 0; yy < h; yy += 9) for (let xx = (yy / 9 % 2) * 4.5; xx < w; xx += 9) { x.beginPath(); x.arc(xx, yy, 1.8, 0, 7); x.fill(); }
}
function rr(x, X, Y, W, H, R) { x.beginPath(); x.roundRect(X, Y, W, H, R); }
function victoryCard(c) {
  return async () => {
    await ready();
    const W = 1080, H = 1350, cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), x = cv.getContext("2d");
    mesh(x, W, H);
    x.strokeStyle = "rgba(241,230,218,.55)"; x.setLineDash([14, 10]); x.lineWidth = 3; rr(x, 34, 34, W - 68, H - 68, 44); x.stroke(); x.setLineDash([]);
    const pw = 560, ph = pw * patchImg.naturalHeight / patchImg.naturalWidth || 192;
    x.shadowColor = "rgba(40,0,2,.45)"; x.shadowBlur = 40; x.shadowOffsetY = 16; x.drawImage(patchImg, (W - pw) / 2, 110, pw, ph); x.shadowColor = "transparent";
    x.textAlign = "center"; x.fillStyle = "#F1E6DA"; x.font = "700 30px Inter"; x.letterSpacing = "8px";
    x.fillText(`COMPETITION ${no(c.n).toUpperCase()} · WINNING NUMBER`, W / 2, 420); x.letterSpacing = "0px";
    x.fillStyle = "#FAF8F5"; x.font = "400 420px Anton"; x.shadowColor = "rgba(40,0,2,.5)"; x.shadowBlur = 40; x.fillText(String(c.winning_number), W / 2, 820); x.shadowColor = "transparent";
    x.font = "400 92px Anton"; x.fillText(person(c.winner).name.toUpperCase(), W / 2, 960);
    x.font = "600 34px Inter"; x.fillStyle = "rgba(250,248,245,.9)";
    x.fillText(`${plural(dayCount(c), "day")} · ${plural(c.guesses || 0, "guess", "guesses")} · ${fDate(c.won_at)}`, W / 2, 1030);
    x.fillStyle = "#F1E6DA"; rr(x, W / 2 - 330, 1120, 660, 92, 46); x.fill();
    x.fillStyle = "#7A0006"; x.font = "700 28px Inter"; x.letterSpacing = "6px"; x.fillText("SAME FRIENDS. HIGHER STAKES.", W / 2, 1177); x.letterSpacing = "0px";
    return cv;
  };
}
function certificate(c) {
  return async () => {
    await ready();
    const W = 1600, H = 1131, cv = Object.assign(document.createElement("canvas"), { width: W, height: H }), x = cv.getContext("2d");
    x.fillStyle = "#FAF8F5"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#C81014"; x.lineWidth = 6; x.strokeRect(40, 40, W - 80, H - 80);
    x.lineWidth = 2; x.strokeStyle = "rgba(200,16,20,.45)"; x.strokeRect(62, 62, W - 124, H - 124);
    const pw = 460, ph = pw * patchImg.naturalHeight / patchImg.naturalWidth || 158; x.drawImage(patchImg, (W - pw) / 2, 110, pw, ph);
    x.textAlign = "center"; x.fillStyle = "#C81014"; x.font = "700 30px Inter"; x.letterSpacing = "10px"; x.fillText("OFFICIAL WINNER", W / 2, 360); x.letterSpacing = "0px";
    x.fillStyle = "#1F1314"; x.font = "400 128px Anton"; x.fillText(person(c.winner).name.toUpperCase(), W / 2, 520);
    x.font = "500 34px Inter"; x.fillStyle = "#5A4546";
    x.fillText(`guessed the hidden number ${c.winning_number} exactly`, W / 2, 600);
    x.fillText(`to win SUBAR100 Competition ${no(c.n)} on day ${dayCount(c)}.`, W / 2, 650);
    if (c.prize) { x.fillStyle = "#7A0006"; x.font = "600 32px Inter"; x.fillText(`Prize: ${c.prize}`, W / 2, 720); }
    x.strokeStyle = "#D9C9BB"; x.lineWidth = 2; x.beginPath(); x.moveTo(260, 900); x.lineTo(700, 900); x.moveTo(900, 900); x.lineTo(1340, 900); x.stroke();
    x.fillStyle = "#1F1314"; x.font = "600 30px Inter"; x.fillText(fDate(c.won_at), 480, 880); x.fillText("Town House 10", 1120, 880);
    x.fillStyle = "#6E5859"; x.font = "700 18px Inter"; x.letterSpacing = "6px"; x.fillText("DATE", 480, 940); x.fillText("CLUB", 1120, 940); x.letterSpacing = "0px";
    x.fillStyle = "#C81014"; x.beginPath(); x.arc(W / 2, 900, 74, 0, 7); x.fill();
    x.strokeStyle = "rgba(241,230,218,.7)"; x.setLineDash([6, 5]); x.lineWidth = 2.5; x.beginPath(); x.arc(W / 2, 900, 62, 0, 7); x.stroke(); x.setLineDash([]);
    x.fillStyle = "#F1E6DA"; x.font = "400 64px Anton"; x.fillText(String(c.winning_number), W / 2, 923);
    return cv;
  };
}
async function shareImage(make, name) {
  try {
    const cv = await make(), blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "SUBAR100" }); return; } catch (e) { if (e.name === "AbortError") return; } }
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Image saved");
  } catch (e) { toast("Couldn't make the image. Try again.", true); }
}

/* ===================== boot ===================== */
(async () => {
  if (location.hash.includes("type=recovery")) S.recovery = true;
  sb.auth.onAuthStateChange(async (ev, session) => {
    if (ev === "PASSWORD_RECOVERY") { S.recovery = true; S.uid = session?.user?.id || null; S.ready = true; render(); return; }
    const uid = session?.user?.id || null;
    S.email = session?.user?.email || "";
    if (uid === S.uid && ev !== "SIGNED_IN") return;
    S.uid = uid;
    if (!uid) { S.ready = true; S.st = null; render(); return; }
    setTimeout(async () => {   // outside the auth callback, as the library recommends
      if (S.pending) { const p = S.pending; S.pending = null; try { await redeem(p.code, p.nm); } catch (e) { await loadAll(); toast(errText(e), true); } }
      else await loadAll();
      live();
    });
  });
  const { data } = await sb.auth.getSession();
  if (!data.session) { S.ready = true; render(); }
})();
