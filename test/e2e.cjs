// End-to-end run in a real browser against the local harness (real database, real access rules).
// Walks the whole journey, saves screenshots, runs axe (WCAG 2.1 AA) and overflow checks.
// Run: NODE_PATH=<dir with pg, axe-core, playwright> node test/e2e.cjs
const { chromium } = require("playwright");
const { Pool } = require("pg");
const fs = require("fs"), path = require("path");
const BASE = process.env.BASE || "http://localhost:8100", OUT = process.env.OUT || path.join(__dirname, "..", "..", "shots");
const db = new Pool({ host: "localhost", port: 5433, user: "postgres", database: process.env.PGDATABASE || "s100e" });
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
fs.mkdirSync(OUT, { recursive: true });
let pass = 0; const fails = [], a11y = [], consoleErrs = [], leaks = [], bad = [];
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  pass ", name); } else { fails.push(name); console.log("  FAIL ", name, extra); } };
const q1 = async (sql, a = []) => (await db.query(sql, a)).rows[0];
const VIEWS = { phone: { width: 390, height: 844 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } };

async function person(browser, size = "phone") {
  const ctx = await browser.newContext({ viewport: VIEWS[size], deviceScaleFactor: 2, reducedMotion: process.env.MOTION ? "no-preference" : "reduce" });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error" && !/realtime|websocket|404/i.test(m.text())) consoleErrs.push(m.text()); });
  page.on("pageerror", e => consoleErrs.push(String(e)));
  page.on("response", async r => {
    if (r.status() >= 400 && !/realtime/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
    if (!r.url().includes("/rest/v1/")) return;
    try { const t = await r.text(); if (/"target"|comp_secret/.test(t)) leaks.push(r.url()); } catch { }
  });
  return { ctx, page };
}
async function shot(page, name, full = true) { await page.evaluate(() => { scrollTo(0, 0); document.querySelector(".toast")?.classList.remove("on"); }); await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full }); }
async function audit(page, label) {
  await page.evaluate(AXE + ";0");   // injected via devtools, so the page CSP still applies to everything else
  const r = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target}`));
  const over = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
  if (over > 0) console.log("    widest:", await page.evaluate(() => [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(-4).map(e => e.className || e.tagName).join(" | ")));
  if (r.length) a11y.push(`${label}: ${r.join(" | ")}`);
  ok(`${label}: no WCAG 2.1 AA violations`, r.length === 0, r.join("\n"));
  ok(`${label}: no sideways overflow`, over <= 0, over);
}
async function join(page, code, name, email) {
  await page.goto(BASE); await page.waitForSelector("[data-mode=join]"); await page.click("[data-mode=join]");
  if (code) { await page.click(".admin-code summary"); await page.fill("#code", code); }
  await page.fill("#nm", name); await page.fill("#em", email); await page.fill("#pw", "correct-horse-9");
  await page.click("[data-act=join]");
  await page.waitForSelector(".hero", { timeout: 10000 });
}

(async () => {
  const browser = await chromium.launch();
  console.log("Door and joining");
  const A = await person(browser);
  await A.page.goto(BASE);
  await A.page.waitForSelector(".panel");
  await shot(A.page, "01-door-phone", false); await audit(A.page, "door");
  await A.page.fill("#em", "nobody@x.test"); await A.page.fill("#pw", "wrong-password");
  await A.page.click("[data-act=signin]"); await A.page.waitForFunction(() => document.querySelector("#err").textContent.length > 0);
  ok("wrong password shows a clear error", /don't match/.test(await A.page.textContent("#err")));
  consoleErrs.length = 0; bad.length = 0;   // that 400 was the point of the test
  const founder = (await q1("select code from invites where note = 'Founder'")).code;
  await join(A.page, founder, "Abdal", "abdal@x.test");
  ok("founder code makes you admin", await A.page.isVisible(".tabbar a[href='#/admin']"));
  ok("today's game is already open, no setup needed", (await A.page.textContent(".hero")).includes("Game No. 01"));

  console.log("Admin");
  await A.page.click(".tabbar a[href='#/admin']");
  await A.page.waitForSelector("#clubF"); await A.page.waitForSelector("#main .rows");
  await A.page.fill("#pz", "Dinner at Freej Swaileh"); await A.page.fill("#nt", "A new number every day. Good luck.");
  await A.page.click("#clubF button"); await A.page.waitForTimeout(600);
  ok("admin sets the prize and note", (await q1("select prize from club")).prize === "Dinner at Freej Swaileh");
  ok("no invite tools remain", !(await A.page.$("#invF")));
  await shot(A.page, "03-admin-phone"); await audit(A.page, "admin");

  console.log("A friend signs up with no code and guesses");
  const F = await person(browser);
  await join(F.page, null, "Faisal", "faisal@x.test");
  ok("anyone can sign up and play, as a normal member", (await F.page.$$("a[href='#/admin']")).length === 0);
  ok("prize shows on home", (await F.page.textContent(".note")).includes("Freej Swaileh"));
  await shot(F.page, "04-home-open-phone"); await audit(F.page, "home (open)");
  const target = (await q1("select target from comp_secret s join comps c on c.id = s.comp_id where c.day = public.kw_today()")).target;
  const miss = target === 37 ? 38 : 37;
  await F.page.click("a[href='#/guess']"); await F.page.waitForSelector("#num");
  await shot(F.page, "05-guess-phone", false); await audit(F.page, "guess");
  await F.page.waitForSelector("#die3d[data-face]", { timeout: 15000 });
  ok("3D die renders with WebGL", await F.page.isVisible("#die3d") && !(await F.page.isVisible("#dieFlat")));
  await F.page.$eval("#rng", el => { el.value = 10; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await F.page.waitForFunction(() => document.querySelector("#die3d").dataset.face === "10");
  ok("the slider turns the die to the number", (await F.page.inputValue("#num")) === "10");
  const box = await F.page.locator("#die3d").boundingBox();
  await F.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await F.page.mouse.down();
  await F.page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 6 }); await F.page.mouse.up();
  await F.page.waitForFunction(() => document.querySelector("#die3d").dataset.face === document.querySelector("#rng").value, null, { timeout: 5000 }).catch(() => { });
  const face = await F.page.$eval("#die3d", el => el.dataset.face), sliderV = await F.page.inputValue("#rng");
  ok("spinning the die moves the slider to the face shown", face === sliderV && face !== "10", `${face} / ${sliderV}`);
  await F.page.fill("#num", "10"); await F.page.press("#num", "Tab");
  await F.page.click("#up"); await F.page.click("#up");
  ok("plus button steps the number", (await F.page.inputValue("#num")) === "12");
  await F.page.fill("#num", "150"); await F.page.press("#num", "Tab");
  ok("typing is limited to 1-100", +(await F.page.inputValue("#num")) <= 100);
  await F.page.fill("#num", String(miss));
  await F.page.click("#lock"); await F.page.waitForSelector("#go");
  ok("confirmation sheet asks before locking", (await F.page.textContent("#ch")).includes(String(miss)));
  await shot(F.page, "06-confirm-phone", false); await audit(F.page, "confirm sheet");
  await F.page.click("#go"); await F.page.waitForSelector("#lh");
  ok("server confirms the locked guess", (await q1("select n from guesses g join players p on p.id=g.user_id where p.name='Faisal'")).n === miss);
  ok("no higher or lower hint", !/higher|lower|close|warm|cold/i.test(await F.page.textContent("main")));
  await shot(F.page, "07-locked-phone", false); await audit(F.page, "locked");
  await F.page.goto(BASE + "/#/guess"); await F.page.waitForSelector("#lh");
  ok("the guess screen stays locked for the rest of the day", !(await F.page.isVisible("#num")));
  await F.page.goto(BASE + "/#/play"); await F.page.waitForSelector(".locked-num");
  ok("home shows the locked number and countdown", (await F.page.textContent(".locked-num .tok")).trim() === String(miss) && await F.page.isVisible("[data-clock]"));
  await shot(F.page, "08-home-locked-phone");
  const stored = await F.page.evaluate(() => JSON.stringify(localStorage));
  ok("browser storage holds no hidden number", !/target|secret/i.test(stored));

  console.log("Second friend wins");
  const M = await person(browser, "phone");
  await join(M.page, null, "Mubarak", "mubarak@x.test");
  await M.page.click("a[href='#/guess']"); await M.page.waitForSelector("#num");
  await M.page.fill("#num", String(target)); await M.page.click("#lock"); await M.page.waitForSelector("#go");
  await M.page.click("#go");
  await M.page.waitForSelector(".reveal #vc", { timeout: 8000 });
  await M.page.waitForTimeout(400);
  ok("exact guess triggers the winner reveal", (await M.page.textContent("#roll")).trim() === String(target));
  await shot(M.page, "09-winner-reveal-phone", false); await audit(M.page, "winner reveal");
  const [dl] = await Promise.all([M.page.waitForEvent("download", { timeout: 8000 }).catch(() => null), M.page.click("#vc")]);
  ok("victory card downloads as an image", !!dl && /winner-1\.png$/.test(dl.suggestedFilename()));
  if (dl) await dl.saveAs(path.join(OUT, "10-victory-card.png"));
  const [dl2] = await Promise.all([M.page.waitForEvent("download", { timeout: 8000 }).catch(() => null), M.page.click("#ct")]);
  ok("winner certificate downloads", !!dl2);
  if (dl2) await dl2.saveAs(path.join(OUT, "11-certificate.png"));
  await M.page.click("#rx");
  await shot(M.page, "12-home-won-phone");

  console.log("Everyone else sees it closed");
  await F.page.reload(); await F.page.waitForSelector(".reveal #rx", { timeout: 8000 });
  ok("other members get the reveal on their next load", (await F.page.textContent("#rv")).includes("We have a winner"));
  await F.page.click("#rx");
  ok("home shows today won, with the number", (await F.page.textContent(".hero")).includes(String(target)));
  await F.page.goto(BASE + "/#/guess"); await F.page.waitForSelector("#lh");
  ok("guessing is locked after a win", !(await F.page.isVisible("#num")));
  await F.page.reload(); await F.page.waitForSelector(".view");
  ok("reveal is not repeated once seen", !(await F.page.isVisible(".reveal")));

  console.log("Midnight: a day with no winner");
  const shift = async () => db.query("update comps set day = day - 1, start_day = start_day - 1 where day is not null; update guesses set day = day - 1; update checkins set day = day - 1; update players set last_try = null");
  await shift();
  await F.page.goto(BASE + "/#/play"); await F.page.reload(); await F.page.waitForSelector(".hero");
  ok("a new game opens by itself the next day", (await F.page.textContent(".hero")).includes("Game No. 02") && await F.page.isVisible("a[href='#/guess']"));
  ok("home shows yesterday's result", (await F.page.textContent(".last")).includes("found it"));
  const t2 = (await q1("select target from comp_secret s join comps c on c.id = s.comp_id where c.day = public.kw_today()")).target;
  const off = t2 > 50 ? -7 : 7;
  for (const [P, n] of [[F.page, t2 + off], [M.page, t2 + 2 * off]]) {
    await P.goto(BASE + "/#/guess"); await P.reload(); await P.waitForSelector("#num"); await P.fill("#num", String(n)); await P.click("#lock"); await P.waitForSelector("#go"); await P.click("#go"); await P.waitForSelector("#lh");
  }
  await shift();
  await F.page.goto(BASE + "/#/play"); await F.page.reload(); await F.page.waitForSelector(".last");
  ok("a no-winner day reveals the number at midnight", (await F.page.textContent(".last")).includes("No winner") && (await F.page.textContent(".last")).includes(String(t2)));
  ok("and names the closest guess", (await F.page.textContent(".last")).includes("Closest: You, 7 away"));
  await shot(F.page, "13-home-next-day-phone");

  console.log("Winners, board, recap, profile");
  await F.page.click(".tabbar a[href='#/winners']"); await F.page.waitForSelector(".strip");
  const wtext = await F.page.textContent("main");
  ok("Winners tab lists every finished game", wtext.includes("Game No. 01") && wtext.includes("Game No. 02") && wtext.includes("No winner") && wtext.includes("Mubarak"));
  ok("past numbers strip shows both numbers", (await F.page.$$(".strip .tok")).length === 2);
  await shot(F.page, "14-winners-phone"); await audit(F.page, "winners");
  await F.page.click(".strip a[href='#/comp/2']"); await F.page.waitForSelector("table");
  ok("recap of a no-winner day shows everyone's guesses, closest first", (await F.page.$$("tbody tr")).length === 2 && (await F.page.textContent("tbody tr:first-child")).includes("Faisal"));
  await F.page.goto(BASE + "/#/comp/1"); await F.page.waitForSelector("table");
  ok("recap of a won day shows every guess", (await F.page.$$("tbody tr")).length === 2 && await F.page.isVisible("#card"));
  await shot(F.page, "15-recap-phone"); await audit(F.page, "recap");
  await F.page.goto(BASE + "/#/board"); await F.page.waitForSelector(".rows");
  await shot(F.page, "16-board-phone"); await audit(F.page, "board");
  await F.page.goto(BASE + "/#/you"); await F.page.waitForSelector("#nameF");
  await F.page.setInputFiles("#avf", { name: "a.png", mimeType: "image/png", buffer: fs.readFileSync(path.join(__dirname, "..", "icon-192.png")) });
  await F.page.waitForSelector(".profile-head .av img", { timeout: 8000 });
  ok("profile photo uploads and shows", true);
  await shot(F.page, "16b-you-phone"); await audit(F.page, "profile");

  console.log("Theme");
  ok("dark is the default mode", (await F.page.getAttribute("html", "data-theme")) === "dark");
  await F.page.click("#themeBtn"); await F.page.waitForTimeout(300);
  ok("switch turns on light mode", (await F.page.getAttribute("html", "data-theme")) === "light");
  await F.page.goto(BASE + "/#/play"); await F.page.reload(); await F.page.waitForSelector(".hero");
  ok("light choice is remembered", (await F.page.getAttribute("html", "data-theme")) === "light");
  await shot(F.page, "17-home-light-phone"); await audit(F.page, "home (light)");
  await F.page.goto(BASE + "/#/board"); await F.page.waitForSelector(".rows"); await audit(F.page, "board (light)");
  await F.page.click("#themeBtn"); await F.page.waitForTimeout(300);

  console.log("Admin after the games");
  await A.page.goto(BASE + "/#/admin"); await A.page.reload(); await A.page.waitForSelector("#clubF"); await A.page.waitForSelector("#main table"); await A.page.waitForTimeout(300);
  ok("admin log reveals numbers once games end", (await A.page.textContent("table")).includes(String(miss)));
  const fid = (await q1("select id from players where name='Faisal'")).id;
  A.page.once("dialog", d => d.accept());
  await A.page.click(`[data-member="${fid}"]`); await A.page.waitForTimeout(800);
  await F.page.reload(); await F.page.waitForSelector(".panel");
  ok("removed member is locked out", (await F.page.textContent(".panel")).includes("paused"));
  await A.page.click(`[data-member="${fid}"]`); await A.page.waitForTimeout(800);
  ok("restored member plays again", (await q1("select removed_at from players where id = $1", [fid])).removed_at === null);

  console.log("Tablet and desktop");
  for (const size of ["tablet", "desktop"]) {
    const D = await person(browser, size);
    await D.page.goto(BASE); await D.page.waitForSelector(".panel");
    await D.page.fill("#em", "abdal@x.test"); await D.page.fill("#pw", "correct-horse-9"); await D.page.click("[data-act=signin]");
    await D.page.waitForSelector(".hero");
    await shot(D.page, `20-home-${size}`); await audit(D.page, `home ${size}`);
    await D.page.goto(BASE + "/#/guess"); await D.page.waitForSelector("#num");
    await shot(D.page, `21-guess-${size}`, false); await audit(D.page, `guess ${size}`);
    await D.page.goto(BASE + "/#/winners"); await D.page.waitForSelector(".strip"); await shot(D.page, `22-winners-${size}`); await audit(D.page, `winners ${size}`);
    await D.page.goto(BASE + "/#/admin"); await D.page.waitForSelector("table"); await D.page.waitForTimeout(400);
    await shot(D.page, `23-admin-${size}`); await audit(D.page, `admin ${size}`);
    await D.ctx.close();
  }

  ok("no API response ever contained the hidden number field", leaks.length === 0, leaks.join(", "));
  ok("no console errors", consoleErrs.length === 0, consoleErrs.slice(0, 5).join("\n"));
  ok("no failed requests", bad.length === 0, bad.slice(0, 5).join("\n"));
  await browser.close(); await db.end();
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
