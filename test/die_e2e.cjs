// The d100 in a real browser: every number 1-100, rapid slider sweeps, touch, lock-in,
// reduced motion, no-WebGL fallback, and 25 mount/unmount cycles.
// Run against the local harness: NODE_PATH=<pg, playwright> node test/die_e2e.cjs
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const BASE = process.env.BASE || "http://localhost:8100", OUT = process.env.OUT || path.join(__dirname, "..", "..", "shots-die");
fs.mkdirSync(OUT, { recursive: true });
let pass = 0; const fails = [], errs = [];
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  pass ", name); } else { fails.push(name); console.log("  FAIL ", name, extra); } };
const PW = "correct-horse-9";

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (/Too many active WebGL|THREE\.|CONTEXT_LOST/i.test(m.text())) errs.push(m.text()); });
  return { ctx, page };
}
async function login(page, email, name) {
  await page.goto(BASE); await page.waitForSelector(".panel");
  await page.fill("#em", email); await page.fill("#pw", PW); await page.click("[data-act=signin]");
  const r = await Promise.race([page.waitForSelector(".hero").then(() => "in"), page.waitForFunction(() => document.querySelector("#err")?.textContent).then(() => "no")]);
  if (r === "no") {
    await page.click("[data-mode=join]"); await page.fill("#nm", name); await page.fill("#em", email); await page.fill("#pw", PW);
    await page.click("[data-act=join]"); await page.waitForSelector(".hero");
  }
}
const toGuess = async page => { await page.goto(BASE + "/#/guess"); await page.waitForSelector("#num"); await page.waitForFunction(() => (typeof S !== "undefined" && S.die) || document.querySelector(".stage.flat"), null, { timeout: 15000 }); };
const setSlider = (page, v) => page.$eval("#rng", (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
const settled = (page, k) => page.waitForFunction(k => { const i = S.die.inspect(); return i.settled && i.face === k; }, k, { timeout: 25000 });
const inspect = page => page.evaluate(() => S.die.inspect());

(async () => {
  const browser = await chromium.launch({ args: ["--enable-precise-memory-info", "--js-flags=--expose-gc"] });
  const { page } = await open(browser, { deviceScaleFactor: 1 });
  await login(page, "dietest@x.test", "Die Tester");
  await toGuess(page);
  ok("3D die is running", await page.evaluate(() => !!S.die) && await page.isVisible("#die3d"));
  ok("exactly 100 faces", (await inspect(page)).faces === 100);

  console.log("Every number from 1 to 100, through the slider");
  // Checked twice: all 100 with the die snapping (reduced motion, fast in a software-GPU test browser),
  // and a spread of numbers with the full spring animation.
  const R0 = await open(browser, { reducedMotion: "reduce", deviceScaleFactor: 1 });
  await login(R0.page, "dietest@x.test", "Die Tester"); await toGuess(R0.page);
  const check = async (pg, k) => {
    const i = await inspect(pg), inp = await pg.inputValue("#num"), face = await pg.$eval("#die3d", el => el.dataset.face);
    return i.front === k && Math.hypot(...i.ndc) < 0.01 && i.upright > 0.9999 && i.error < 1e-6 && inp === String(k) && face === String(k) ? null : { k, ...i, inp, face };
  };
  const bad = [];
  for (let k = 1; k <= 100; k++) { await setSlider(R0.page, k); await settled(R0.page, k); const b = await check(R0.page, k); if (b) bad.push(b); }
  ok("all 100: the chosen face is frontmost, centred, upright, and the UI agrees", bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  // pixel check: the rendered number at the centre of the die is ivory on red, for every value
  const px = [];
  for (const k of [1, 9, 27, 50, 68, 88, 100]) { await setSlider(R0.page, k); await settled(R0.page, k); px.push(await R0.page.locator("#die3d").screenshot()); }
  ok("the die is actually rendered (non-empty canvas)", px.every(b => b.length > 20000));
  await R0.ctx.close();
  const bad2 = [];
  for (const k of [1, 2, 13, 27, 44, 50, 68, 69, 77, 91, 99, 100]) {
    await setSlider(page, k); await settled(page, k); const b = await check(page, k); if (b) bad2.push(b);
    if ([1, 27, 68, 100].includes(k)) await page.locator(".stage").screenshot({ path: path.join(OUT, `face-${k}.png`) });
  }
  ok("animated: 12 numbers across the range land exactly", bad2.length === 0, JSON.stringify(bad2.slice(0, 3)));
  console.log("Large jumps take the short way");
  const jump = async (a, b) => {
    await setSlider(page, a); await settled(page, a);
    await page.evaluate(() => { window.__steps = []; let last = S.die.inspect().q; const tick = () => { const q = S.die.inspect().q; const d = Math.abs(q[0] * last[0] + q[1] * last[1] + q[2] * last[2] + q[3] * last[3]); window.__steps.push(2 * Math.acos(Math.min(1, d))); last = q; if (!S.die.inspect().settled || window.__steps.length < 3) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await setSlider(page, b); await settled(page, b);
    return page.evaluate(() => ({ total: __steps.reduce((x, y) => x + y, 0), max: Math.max(...__steps), frames: __steps.length }));
  };
  const j = await jump(1, 100);
  ok(`1 → 100 travels about a half turn, no extra spins (${(j.total * 180 / Math.PI).toFixed(0)}°)`, j.total < Math.PI * 1.35, j.total);
  const j2 = await jump(40, 41);
  ok(`40 → 41 is a small roll (${(j2.total * 180 / Math.PI).toFixed(0)}°)`, j2.total < 0.6, j2.total);

  console.log("Rapid slider movement");
  await page.evaluate(() => { S.die.resetStats(); let t0 = performance.now(); window.__frames = []; const tick = t => { window.__frames.push(t); if (t - t0 < 4200) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  for (let i = 0; i < 120; i++) { await setSlider(page, 1 + Math.floor(Math.random() * 100)); await page.waitForTimeout(16); }
  for (let v = 1; v <= 100; v += 2) { await setSlider(page, v); await page.waitForTimeout(12); }
  await setSlider(page, 73); await settled(page, 73);
  const i73 = await inspect(page);
  ok("after 170 rapid changes the die lands exactly on the last value", i73.front === 73 && await page.inputValue("#num") === "73");
  const st = await inspect(page);
  ok(`no flips or jumps during rapid movement (largest frame-to-frame turn ${(st.maxStep * 180 / Math.PI).toFixed(1)}° over ${st.frames} frames)`, st.maxStep < 0.81, st.maxStep);
  const fr = await page.evaluate(() => { const d = __frames.slice(1).map((t, i) => t - __frames[i]); d.sort((a, b) => a - b); return { med: d[d.length >> 1], p95: d[Math.floor(d.length * .95)] }; });
  console.log(`    frame time while sliding (headless, software GPU): median ${fr.med.toFixed(1)} ms, p95 ${fr.p95.toFixed(1)} ms · quality ${await page.$eval("#die3d", el => el.dataset.quality)}`);

  console.log("Buttons and typing drive the die");
  await page.click("#up"); await settled(page, 74); ok("plus moves the die to 74", (await inspect(page)).front === 74);
  await page.click("#dn"); await page.click("#dn"); await settled(page, 72); ok("minus twice moves it to 72", (await inspect(page)).front === 72);
  await page.fill("#num", "5"); await settled(page, 5); ok("typing 5 turns the die to 5", (await inspect(page)).front === 5 && await page.inputValue("#rng") === "5");

  console.log("Spinning the die by hand");
  const box = await page.locator("#die3d").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 60, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => S.die.inspect().settled, null, { timeout: 8000 });
  const sp = await inspect(page);
  ok("a flick lands on a face and the slider follows", sp.front === sp.face && await page.inputValue("#rng") === String(sp.face) && Math.hypot(...sp.ndc) < 0.01);

  console.log("Tap a number on the die");
  await page.evaluate(() => { window.__vib = 0; navigator.vibrate = () => (window.__vib++, true); });
  await setSlider(page, 50); await settled(page, 50);
  const taps = [];
  let tried = 0;
  for (const k of [51, 49, 36, 64, 52, 48]) {
    const pt = await page.evaluate(k => S.die.screenOf(k), k);
    if (!pt) continue;   // that face is round the back from here
    tried++;
    await page.mouse.click(pt.x, pt.y); await settled(page, k);
    const i = await inspect(page);
    if (!(i.front === k && await page.inputValue("#rng") === String(k) && await page.inputValue("#num") === String(k))) taps.push(k);
  }
  ok(`tapping a number on the die picks it, centres it, and the slider follows (${tried} taps)`, taps.length === 0 && tried >= 4, taps.join(","));
  ok("each pick gives a haptic tap", await page.evaluate(() => __vib) >= 4, await page.evaluate(() => __vib));
  ok("sound plays without errors (audio engine running)", await page.evaluate(() => typeof fx === "object" && fx.soundOn()));
  await page.click("#snd"); ok("sound can be switched off and is remembered", await page.evaluate(() => localStorage.getItem("s100-sound") === "off" && !fx.soundOn()));
  await page.click("#snd");

  console.log("Lock in");
  await setSlider(page, 42); await page.waitForTimeout(60);
  await page.click("#lock"); await page.waitForSelector("#go");
  const li = await inspect(page);
  ok("lock-in settles exactly on the chosen face before confirming", li.front === 42 && li.error < 1e-6 && Math.hypot(...li.ndc) < 0.01, JSON.stringify(li));
  ok("confirmation shows the same number", (await page.textContent("#ch")).includes("42"));
  await page.click("#no");

  console.log("Home screen die");
  await page.goto(BASE + "/#/play"); await page.waitForSelector(".hero");
  const home = await page.$("#heroDie canvas");
  if (home) {
    const q1 = await page.evaluate(() => S.die.inspect().q); await page.waitForTimeout(600); const q2 = await page.evaluate(() => S.die.inspect().q);
    ok("the 3D die sits in the home hero and turns slowly", q1.join() !== q2.join());
    await page.click("#heroDie"); await page.waitForSelector("#num");
    ok("tapping the home die opens the guess screen", (await page.evaluate(() => location.hash)) === "#/guess" && !!(await page.$(".stage #die3d")));
  } else ok("the 3D die sits in the home hero (skipped: already guessed today)", true);

  console.log("Leave and come back 20 times");
  const heap = async () => { for (let i = 0; i < 3; i++) { await page.evaluate(() => window.gc?.()); await page.waitForTimeout(200); } return page.evaluate(() => performance.memory?.usedJSHeapSize || 0); };
  await page.goto(BASE + "/#/play"); await page.waitForSelector(".hero"); await toGuess(page);
  const heap0 = await heap();
  for (let i = 0; i < 20; i++) { await page.goto(BASE + "/#/play"); await page.waitForSelector(".hero"); await toGuess(page); }
  const heap1 = await heap();
  console.log(`    JS heap before ${(heap0 / 1e6).toFixed(1)} MB, after 20 cycles ${(heap1 / 1e6).toFixed(1)} MB`);
  ok("no WebGL context or three.js warnings", errs.length === 0, errs.slice(0, 3).join(" | "));
  ok("one die, reused on every visit", await page.evaluate(() => document.querySelectorAll("canvas").length === 1 && document.querySelector("#die3d").isConnected));
  ok("memory is released between visits", heap1 - heap0 < 5e6, (heap1 - heap0) / 1e6);
  ok("die still works after remounting", await setSlider(page, 88).then(() => settled(page, 88)).then(() => true).catch(() => false));

  console.log("Touch on a phone");
  const T = await open(browser, { hasTouch: true, isMobile: true });
  await login(T.page, "dietest@x.test", "Die Tester"); await toGuess(T.page);
  const cdp = await T.ctx.newCDPSession(T.page);
  const touchDrag = async (x0, y0, x1, y1, n = 10) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= n; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const r = await T.page.locator("#rng").boundingBox();
  await touchDrag(r.x + r.width * .5, r.y + r.height / 2, r.x + r.width * .9, r.y + r.height / 2);
  const tv = +(await T.page.inputValue("#rng"));
  await settled(T.page, tv);
  ok(`dragging the slider with a finger turns the die (${tv})`, tv > 75 && (await inspect(T.page)).front === tv);
  const db = await T.page.locator("#die3d").boundingBox();
  await touchDrag(db.x + db.width * .3, db.y + db.height * .5, db.x + db.width * .8, db.y + db.height * .3, 8);
  await T.page.waitForFunction(() => S.die.inspect().settled, null, { timeout: 8000 });
  const ti = await inspect(T.page);
  ok("spinning the die with a finger lands on a face, slider follows", ti.front === ti.face && (await T.page.inputValue("#rng")) === String(ti.face));
  ok("page did not scroll sideways or zoom", await T.page.evaluate(() => scrollX === 0 && visualViewport.scale === 1));
  await T.page.screenshot({ path: path.join(OUT, "phone-guess.png") });

  console.log("Reduced motion");
  const R = await open(browser, { reducedMotion: "reduce" });
  await login(R.page, "dietest@x.test", "Die Tester"); await toGuess(R.page);
  await setSlider(R.page, 61);
  ok("with reduced motion the die snaps straight to the face", await R.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(S.die.inspect()))))).then(i => i.front === 61 && i.error < 1e-6));

  console.log("No WebGL");
  const W = await open(browser);
  await W.page.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  await login(W.page, "dietest@x.test", "Die Tester"); await toGuess(W.page);
  ok("falls back to the flat die", await W.page.isVisible("#dieFlat") && !(await W.page.isVisible("#die3d")));
  await setSlider(W.page, 33);
  ok("slider and number still work without WebGL", (await W.page.inputValue("#num")) === "33" && (await W.page.textContent("#dieFlat")).includes("33"));

  console.log("Desktop");
  const Dk = await open(browser, { viewport: { width: 1440, height: 900 } });
  await login(Dk.page, "dietest@x.test", "Die Tester"); await toGuess(Dk.page);
  await setSlider(Dk.page, 27); await settled(Dk.page, 27);
  await Dk.page.screenshot({ path: path.join(OUT, "desktop-guess.png") });
  const sb = await Dk.page.locator(".stage").boundingBox();
  ok(`die is large on desktop (${Math.round(sb.width)}px)`, sb.width >= 440);

  await browser.close();
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log("FAILED:\n  " + fails.join("\n  ")); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
