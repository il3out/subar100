// Local test harness: serves the app and stands in for Supabase.
//   /rest/v1/*  -> a real PostgREST in front of the real database (setup.sql + access rules)
//   /auth/v1/*  -> a tiny email/password auth that issues the same JWTs Supabase does
// Only for testing. Production uses the real Supabase project.
// Run: NODE_PATH=<dir with pg> node test/dev-server.cjs  (needs PostgREST on :3001, Postgres on :5433)
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const { Pool } = require("pg");
const ROOT = path.join(__dirname, ".."), PORT = +process.env.PORT || 8100, SECRET = process.env.JWT_SECRET || "s100-local-test-secret-at-least-32-chars";
const db = new Pool({ host: "localhost", port: 5433, user: "postgres", database: process.env.PGDATABASE || "s100" });
const b64 = b => Buffer.from(b).toString("base64url");
const sign = p => { const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT" })), b = b64(JSON.stringify(p)); return `${h}.${b}.${crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url")}`; };
const verify = t => { try { const [h, b, s] = t.split("."); if (crypto.createHmac("sha256", SECRET).update(`${h}.${b}`).digest("base64url") !== s) return null; const p = JSON.parse(Buffer.from(b, "base64url")); return p.exp * 1000 > Date.now() ? p : null; } catch { return null; } };
const hash = pw => crypto.createHash("sha256").update("s100:" + pw).digest("hex");
const refresh = new Map();
const userObj = u => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, app_metadata: { provider: "email" }, user_metadata: {}, created_at: u.created_at });
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600, rt = crypto.randomBytes(16).toString("hex");
  refresh.set(rt, u);
  return { access_token: sign({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, exp }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: rt, user: userObj(u) };
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let d = ""; req.on("data", c => d += c); req.on("end", () => { try { r(JSON.parse(d || "{}")); } catch { r({}); } }); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }); return res.end(); }
  if (u.pathname.startsWith("/rest/v1/")) {
    const auth = req.headers.authorization || "";
    const tok = auth.replace(/^Bearer /, ""), claims = verify(tok);
    const headers = { ...req.headers, host: "localhost:3001" };
    if (!claims) delete headers.authorization;   // the publishable key is not a JWT: request runs as anon
    const p = http.request({ host: "localhost", port: 3001, path: u.pathname.slice(8) + u.search, method: req.method, headers }, pr => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
    p.on("error", e => json(res, 502, { message: e.message }));
    return req.pipe(p);
  }
  if (u.pathname.startsWith("/auth/v1/")) {
    const ep = u.pathname.slice(9), b = await body(req);
    try {
      if (ep === "signup") {
        if (!b.email || (b.password || "").length < 6) return json(res, 422, { code: 422, msg: "Password should be at least 6 characters" });
        const ex = await db.query("select 1 from auth.users where lower(email) = lower($1)", [b.email]);
        if (ex.rowCount) return json(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
        const r = await db.query("insert into auth.users (email, encrypted_password) values ($1, $2) returning *", [b.email.toLowerCase(), hash(b.password)]);
        return json(res, 200, session(r.rows[0]));
      }
      if (ep === "token") {
        if (u.searchParams.get("grant_type") === "password") {
          const r = await db.query("select * from auth.users where lower(email) = lower($1) and encrypted_password = $2", [b.email, hash(b.password)]);
          if (!r.rowCount) return json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
          return json(res, 200, session(r.rows[0]));
        }
        const usr = refresh.get(b.refresh_token);
        if (!usr) return json(res, 400, { error: "invalid_grant", error_description: "Invalid Refresh Token" });
        refresh.delete(b.refresh_token); return json(res, 200, session(usr));
      }
      const claims = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (ep === "user") {
        if (!claims) return json(res, 401, { msg: "invalid JWT" });
        const r = await db.query("select * from auth.users where id = $1", [claims.sub]);
        if (req.method === "PUT" && b.password) await db.query("update auth.users set encrypted_password = $2 where id = $1", [claims.sub, hash(b.password)]);
        return json(res, 200, userObj(r.rows[0]));
      }
      if (ep === "logout") { res.writeHead(204, { "access-control-allow-origin": "*" }); return res.end(); }
      if (ep === "recover") return json(res, 200, {});
      return json(res, 404, { msg: "not in the test harness: " + ep });
    } catch (e) { return json(res, 500, { msg: e.message }); }
  }
  if (u.pathname.startsWith("/realtime/")) { res.writeHead(404); return res.end(); }
  let f = path.join(ROOT, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  if (u.pathname === "/config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(`window.S100={url:"http://localhost:${PORT}",key:"sb_publishable_local"};`); }
  // same Content-Security-Policy as vercel.json, with this harness as the API origin
  const csp = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"))).headers[0].headers[0].value;
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "cache-control": "no-store", "content-security-policy": csp });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log("SUBAR100 test harness on http://localhost:" + PORT));
