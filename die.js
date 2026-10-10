// The SUBAR100 d100: a real 100-faced solid, racing red with ivory embroidered numbers.
//
//   Geometry / face map  buildD100()      pure maths, no DOM, validated by test/die_test.mjs
//   Materials            fabric red with a woven normal map and sheen, satin-stitch ivory numbers
//   Viewer               studio environment lighting, beveled mesh, contact shadow, render on demand
//   Controller           spring-driven quaternion rotation; the slider sets the target face
//
// The die is only a picker. It shows the member's chosen number; the winning number never
// leaves the server.
import * as THREE from "./vendor/three.module.min.js";

export const N = 100;
const V = THREE.Vector3;
const BEVEL = 0.045;   // edge radius, as a fraction of the inradius

/* ============================== geometry & face map ============================== */

// Face directions. Generated once from an even spiral running from the top (1) to the bottom (100),
// so neighbouring numbers are neighbouring faces and sliding 41 → 42 → 43 is a short, natural roll,
// then relaxed until every face is centred on its own normal (centroidal), which keeps the 100 faces
// near-identical in size. Fixed data: the same die on every device.
const FACE_NORMALS = [
  [0.088335,0.99387,-0.066481],[-0.021789,0.959874,0.279582],[-0.312228,0.949148,0.040389],[-0.184125,0.931195,-0.3146],
  [0.180844,0.884954,-0.42913],[0.447045,0.879681,-0.16221],[0.375679,0.90683,0.191113],[0.263892,0.827828,0.495038],
  [-0.076982,0.791959,0.605702],[-0.388649,0.829868,0.400339],[-0.648889,0.748499,0.136718],[-0.559846,0.800204,-0.21505],
  [-0.409693,0.745714,-0.525417],[-0.092403,0.74331,-0.662534],[0.248792,0.647029,-0.720733],[0.528629,0.693643,-0.489297],
  [0.734633,0.651622,-0.18895],[0.678348,0.719468,0.149027],[0.575991,0.632986,0.517265],[0.281337,0.590383,0.756503],
  [-0.058522,0.538014,0.840902],[-0.391943,0.584759,0.710238],[-0.673966,0.560327,0.481459],[-0.87418,0.450339,0.181673],
  [-0.826441,0.535568,-0.173672],[-0.678811,0.524342,-0.514082],[-0.394587,0.487524,-0.778859],[-0.069274,0.439733,-0.895453],
  [0.261508,0.34493,-0.901464],[0.564017,0.39489,-0.725222],[0.802248,0.393551,-0.448905],[0.924346,0.37264,-0.082001],
  [0.840875,0.458268,0.287959],[0.743503,0.301754,0.596781],[0.483056,0.296851,0.823733],[0.143704,0.266201,0.953145],
  [-0.256656,0.262348,0.930216],[-0.590379,0.267157,0.76163],[-0.836114,0.209917,0.506802],[-0.973186,0.109453,0.202307],
  [-0.974071,0.186005,-0.128795],[-0.862321,0.226785,-0.452737],[-0.620495,0.210472,-0.755438],[-0.310904,0.129472,-0.941582],
  [0.043567,0.070273,-0.996576],[0.433802,0.043967,-0.899935],[0.733492,0.060172,-0.67703],[0.92324,0.049147,-0.381068],
  [0.997452,0.003517,-0.071261],[0.960922,0.152579,0.230974],[0.8646,-0.017224,0.502166],[0.642777,-0.056913,0.763936],
  [0.33617,-0.067225,0.939399],[-0.035487,-0.045465,0.998335],[-0.424666,-0.060664,0.903316],[-0.715437,-0.107225,0.690401],
  [-0.907111,-0.180863,0.380051],[-0.981093,-0.193499,-0.00374],[-0.926909,-0.152045,-0.343106],[-0.768634,-0.079004,-0.634791],
  [-0.507753,-0.183848,-0.841657],[-0.171282,-0.251785,-0.952506],[0.205362,-0.255251,-0.944814],[0.575737,-0.270786,-0.771493],
  [0.816643,-0.30271,-0.491386],[0.930986,-0.332506,-0.150678],[0.949688,-0.229468,0.213158],[0.770786,-0.366346,0.521228],
  [0.49642,-0.411831,0.764175],[0.160144,-0.398364,0.903139],[-0.190942,-0.34361,0.919496],[-0.483879,-0.426299,0.764284],
  [-0.725234,-0.459403,0.51282],[-0.859255,-0.49219,0.139393],[-0.830995,-0.503581,-0.236333],[-0.701313,-0.42188,-0.57461],
  [-0.38611,-0.537674,-0.74955],[-0.023868,-0.575219,-0.817651],[0.332123,-0.533685,-0.777737],[0.586162,-0.601107,-0.543216],
  [0.747603,-0.629516,-0.21166],[0.814855,-0.553717,0.171487],[0.573611,-0.674568,0.46468],[0.246693,-0.700338,0.669827],
  [-0.114367,-0.645934,0.754778],[-0.407653,-0.727311,0.552121],[-0.638597,-0.714912,0.284771],[-0.632063,-0.77184,-0.068989],
  [-0.538173,-0.724337,-0.430936],[-0.18595,-0.812266,-0.552854],[0.205628,-0.791728,-0.575225],[0.448173,-0.843767,-0.295294],
  [0.581071,-0.808549,0.092762],[0.284114,-0.893856,0.346844],[-0.066402,-0.882149,0.466267],[-0.363427,-0.910003,0.199539],
  [-0.30926,-0.931804,-0.189999],[0.050367,-0.956881,-0.28608],[0.282446,-0.959247,-0.008324],[-0.040192,-0.994201,0.09974]
];
const spiral = () => FACE_NORMALS.map(([x, y, z]) => new V(x, y, z).normalize());

// Face k lies in the plane n_k · x = 1 (tangent to the unit sphere). The solid is the
// intersection of those 100 half-spaces; its corners are the duals of the convex hull's facets.
// ponytail: brute-force hull, O(n^4) but ~40ms once for 100 points
function hullCorners(P) {
  const raw = [], a = new V(), b = new V(), n = new V();
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) for (let k = j + 1; k < N; k++) {
    a.subVectors(P[j], P[i]); b.subVectors(P[k], P[i]); n.crossVectors(a, b);
    const d = n.dot(P[i]); let pos = 0, neg = 0;
    for (let m = 0; m < N && !(pos && neg); m++) {
      if (m === i || m === j || m === k) continue;
      const s = n.dot(P[m]) - d; if (s > 1e-9) pos++; else if (s < -1e-9) neg++;
    }
    if (pos && neg) continue;
    const det = P[i].dot(new V().crossVectors(P[j], P[k]));
    const c = new V().crossVectors(P[j], P[k]).add(new V().crossVectors(P[k], P[i])).add(new V().crossVectors(P[i], P[j])).divideScalar(det);
    raw.push({ c, f: [i, j, k] });
  }
  // four or more co-circular points give the same corner several times: merge them
  const corners = [], faces = P.map(() => new Set());
  for (const { c, f } of raw) {
    let id = corners.findIndex(q => q.p.distanceToSquared(c) < 1e-12);
    if (id < 0) id = corners.push({ p: c, faces: new Set() }) - 1;
    for (const x of f) { corners[id].faces.add(x); faces[x].add(id); }
  }
  return { corners, faces };
}

// Text "up" on each face points to the north pole, so numbers read like lines of latitude.
function faceFrame(n) {
  const up = Math.abs(n.y) > .97 ? new V(0, 0, -Math.sign(n.y)) : new V(0, 1, 0);
  const u = up.sub(n.clone().multiplyScalar(up.dot(n))).normalize(), r = new V().crossVectors(u, n);
  return { r, u, n };
}

export function buildD100() {
  const P = spiral(), { corners, faces } = hullCorners(P);
  const face = P.map((n, i) => {
    const { r, u } = faceFrame(n);
    const ring = [...faces[i]].sort((a, b) => {
      const A = corners[a].p, B = corners[b].p;
      return Math.atan2(A.dot(u), A.dot(r)) - Math.atan2(B.dot(u), B.dot(r));
    });
    // the orientation that brings this face to the front (+z), upright (+y)
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n).transpose());
    let inr = Infinity;
    ring.forEach((a, j) => {
      const A = corners[a].p, B = corners[ring[(j + 1) % ring.length]].p, e = B.clone().sub(A).normalize();
      inr = Math.min(inr, n.clone().sub(A).sub(e.multiplyScalar(n.clone().sub(A).dot(e))).length());
    });
    return { number: i + 1, n, r, u, ring, q, center: n.clone(), inradius: inr };
  });
  return { face, corners };
}

/* ============================== mesh ============================== */
// A rounded solid: every face shrinks inward by the bevel radius, and the gaps become
// cylindrical edges and spherical corners (a Minkowski sum with a small sphere).
function buildMesh({ face, corners }) {
  const s = 1 - BEVEL, pos = [], nor = [], uv = [], ws = 7;   // ws: weave density
  const C = corners.map(c => c.p.clone().multiplyScalar(s));
  const push = (p, n, f) => { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(p.dot(f.r) * ws, p.dot(f.u) * ws); };
  const off = (ci, n) => C[ci].clone().addScaledVector(n, BEVEL);
  const slerpN = (a, b, t) => a.clone().lerp(b, t).normalize();

  for (const f of face) {   // flat faces
    const ring = f.ring.map(ci => off(ci, f.n));
    for (let t = 1; t < ring.length - 1; t++) for (const p of [ring[0], ring[t], ring[t + 1]]) push(p, f.n, f);
  }
  const owner = (a, b, not) => face.find(g => g !== not && g.ring.includes(a) && g.ring.includes(b));
  const SEG = 4;
  for (const f of face) for (let t = 0; t < f.ring.length; t++) {   // edges, each built once
    const a = f.ring[t], b = f.ring[(t + 1) % f.ring.length], g = owner(a, b, f);
    if (!g || g.number < f.number) continue;
    for (let k = 0; k < SEG; k++) {
      const n0 = slerpN(f.n, g.n, k / SEG), n1 = slerpN(f.n, g.n, (k + 1) / SEG);
      const A0 = off(a, n0), B0 = off(b, n0), A1 = off(a, n1), B1 = off(b, n1);
      for (const [p, n] of [[A0, n0], [B1, n1], [B0, n0], [A0, n0], [A1, n1], [B1, n1]]) push(p, n, f);
    }
  }
  corners.forEach((c, ci) => {   // corners: a small fan over the faces that meet there
    const fs = [...c.faces].map(i => face[i]), m = fs.reduce((v, f) => v.add(f.n), new V()).normalize();
    const { r, u } = faceFrame(m);
    fs.sort((A, B) => Math.atan2(A.n.dot(u), A.n.dot(r)) - Math.atan2(B.n.dot(u), B.n.dot(r)));
    for (let t = 0; t < fs.length; t++) {
      const A = fs[t].n, B = fs[(t + 1) % fs.length].n;
      for (const n of [m, B, A]) push(off(ci, n), n, fs[0]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// number decals: one quad per face, its UVs pointing at that number's cell in the atlas
function buildLabels({ face }) {
  const pos = [], uv = [], nor = [];
  for (const f of face) {
    const i = f.number - 1, s = f.inradius * .74, c = f.n.clone().multiplyScalar(1.0015), col = (i % 10) / 10, row = Math.floor(i / 10) / 10;
    const q = [[-s, -s, col, 1 - row - .1], [s, -s, col + .1, 1 - row - .1], [s, s, col + .1, 1 - row], [-s, s, col, 1 - row]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const v = c.clone().addScaledVector(f.r, q[k][0]).addScaledVector(f.u, q[k][1]);
      pos.push(v.x, v.y, v.z); uv.push(q[k][2], q[k][3]); nor.push(f.n.x, f.n.y, f.n.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// dashed ivory stitching just inside a face's edge (the embroidered-patch border, in 3D)
function stitchRing(f, corners, inset, dash, width) {
  const s = 1 - BEVEL, c = f.n.clone(), out = [];
  const pts = f.ring.map(ci => c.clone().lerp(corners[ci].p.clone().multiplyScalar(s).addScaledVector(f.n, BEVEL), inset).addScaledVector(f.n, .0018));
  for (let t = 0; t < pts.length; t++) {
    const A = pts[t], B = pts[(t + 1) % pts.length], L = A.distanceTo(B), n = Math.max(1, Math.round(L / dash / 2));
    const dir = B.clone().sub(A).normalize(), side = new V().crossVectors(f.n, dir).multiplyScalar(width / 2);
    for (let k = 0; k < n; k++) {
      const a = A.clone().lerp(B, (k + .25) / n), b = A.clone().lerp(B, (k + .75) / n);
      const q = [a.clone().sub(side), b.clone().sub(side), b.clone().add(side), a.clone().add(side)];
      for (const i of [0, 1, 2, 0, 2, 3]) out.push(q[i].x, q[i].y, q[i].z);
    }
  }
  return out;
}

/* ============================== materials ============================== */
// ambiguous upside-down numbers get the dice-maker's underline (6 vs 9, 68 vs 89 …)
const ROT = { 0: "0", 1: "1", 6: "9", 8: "8", 9: "6" };
export const underline = k => {
  const s = String(k); if (![...s].every(c => c in ROT)) return false;
  const r = [...s].reverse().map(c => ROT[c]).join("");   // what it reads as upside down
  return r[0] !== "0" && +r !== k && +r <= 100;           // "01" isn't a number on the die, so 10 needs no mark
};

function labelAtlas() {   // ivory satin-stitch numbers with a soft embossed shadow
  const cell = 128, cv = document.createElement("canvas"); cv.width = cv.height = cell * 10;
  const x = cv.getContext("2d"); x.textAlign = "center"; x.textBaseline = "middle";
  const glyph = (k, cx, cy) => {
    const size = k === 100 ? 64 : 84; x.font = `400 ${size}px Anton, Impact, sans-serif`;
    const wd = x.measureText(String(k)).width, sx = Math.min(1, 104 / wd);   // squeeze anything wider than the cell
    x.save(); x.translate(cx, cy - 4); x.scale(sx, 1); x.fillText(String(k), 0, 0); x.restore();
    if (underline(k)) x.fillRect(cx - 18, cy + 41, 36, 7);
  };
  const stripes = x.createPattern((() => {   // diagonal satin thread
    const p = document.createElement("canvas"); p.width = p.height = 8; const y = p.getContext("2d");
    y.fillStyle = "#F7EEE4"; y.fillRect(0, 0, 8, 8); y.strokeStyle = "#D9CBBB"; y.lineWidth = 1.4;
    y.beginPath(); y.moveTo(-2, 10); y.lineTo(10, -2); y.stroke(); return p;
  })(), "repeat");
  for (let k = 1; k <= N; k++) {
    const cx = ((k - 1) % 10) * cell + cell / 2, cy = Math.floor((k - 1) / 10) * cell + cell / 2;
    x.save(); x.fillStyle = "rgba(60,0,4,.55)"; x.filter = "blur(2.5px)"; glyph(k, cx + 1.5, cy + 3); x.restore();
    x.fillStyle = stripes; glyph(k, cx, cy);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true;
  return t;
}

function weaveNormalMap() {   // fine embroidered weave, as a tangent-space normal map
  const S = 128, h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = Math.sin((x + y) * Math.PI / 4), b = Math.sin((x - y) * Math.PI / 4);
    const row = ((x >> 3) + (y >> 3)) & 1;   // alternating satin blocks
    h[y * S + x] = (row ? a : b) * .5 + .5;
  }
  const cv = document.createElement("canvas"); cv.width = cv.height = S;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const H = (i, j) => h[((j + S) % S) * S + ((i + S) % S)];
    const dx = (H(x + 1, y) - H(x - 1, y)) * 1.6, dy = (H(x, y + 1) - H(x, y - 1)) * 1.6, l = Math.hypot(dx, dy, 1), o = (y * S + x) * 4;
    img.data[o] = (-dx / l * .5 + .5) * 255; img.data[o + 1] = (-dy / l * .5 + .5) * 255; img.data[o + 2] = (1 / l * .5 + .5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function shadowTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const x = cv.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.85)"); g.addColorStop(.45, "rgba(0,0,0,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

// a soft studio: one big warm softbox above-left, a fill to the right, a rim behind
function studio(renderer) {
  const env = new THREE.Scene(), box = new THREE.BoxGeometry(1, 1, 1), mats = [];
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x1a0d0e, side: THREE.BackSide })); room.scale.setScalar(20); env.add(room); mats.push(room.material);
  const panel = (c, i, p, s) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) }); mats.push(m); const o = new THREE.Mesh(box, m); o.position.set(...p); o.scale.set(...s); o.lookAt(0, 0, 0); env.add(o); };
  panel(0xfff1e6, 6, [-4, 6, 5], [5, 4, .1]);
  panel(0xffe2d6, 2.2, [7, 1, 3], [.1, 5, 6]);
  panel(0xffd0c4, 3, [0, 3, -8], [8, 2, .1]);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(env, .035).texture;
  pm.dispose(); box.dispose(); mats.forEach(m => m.dispose());
  return tex;
}

/* ============================== viewer & controller ============================== */
// One die per page: the guess screen moves its canvas in and out (attach / detach), so revisits
// are instant and no WebGL context is ever recreated.
export async function createDie(canvas = document.createElement("canvas"), { value = 50, onPick = () => { }, reduced = false } = {}) {
  await document.fonts.load("400 80px Anton").catch(() => { });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, .1, 40);
  cam.position.set(0, .95, 5.6); cam.lookAt(0, 0, 0);   // a slightly raised product-shot view, fixed
  const envTex = studio(renderer); scene.environment = envTex;
  const key = new THREE.DirectionalLight(0xfff4ec, 1.2); key.position.set(-2.8, 4.5, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff9c8c, .9); rim.position.set(2.5, 1, -3); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0xfff1e8, 0x2a0306, .25); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xffe6dc, .35); fill.position.set(3, -1, 4); scene.add(fill);

  const D = buildD100(), F = D.face;
  const weave = weaveNormalMap(), atlas = labelAtlas(), shadowTex = shadowTexture();
  const red = new THREE.MeshPhysicalMaterial({   // embroidered fabric: soft sheen, no plastic gloss
    color: 0xb40c12, roughness: .66, metalness: 0, envMapIntensity: .55,
    sheen: 1, sheenColor: new THREE.Color(0xff6b5e), sheenRoughness: .45,
    normalMap: weave, normalScale: new THREE.Vector2(.32, .32)
  });
  const ivory = new THREE.MeshStandardMaterial({ map: atlas, transparent: true, roughness: .62, envMapIntensity: .5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const thread = new THREE.MeshStandardMaterial({ color: 0xf1e6da, roughness: .7, transparent: true, opacity: .32, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const chosenThread = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: .6, emissive: 0x3a1a14, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  const body = buildMesh(D), labels = buildLabels(D);
  const stitchAll = new THREE.BufferGeometry();
  stitchAll.setAttribute("position", new THREE.Float32BufferAttribute(F.flatMap(f => stitchRing(f, D.corners, .86, .022, .007)), 3));
  stitchAll.computeVertexNormals();
  const chosen = new THREE.Mesh(new THREE.BufferGeometry(), chosenThread);

  const die = new THREE.Group();
  die.add(new THREE.Mesh(body, red), new THREE.Mesh(stitchAll, thread), new THREE.Mesh(labels, ivory), chosen);
  const holder = new THREE.Group(); holder.add(die); scene.add(holder);

  const floorY = -1.2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .55 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY; scene.add(shadow);

  // camera-relative targets: face k toward the lens, its numbers upright on screen
  const camQ = cam.quaternion.clone(), view = new V(0, 0, 1).applyQuaternion(camQ);
  const want = k => camQ.clone().multiply(F[k - 1].q);
  const front = () => { let best = 0, z = -2; for (let i = 0; i < N; i++) { const d = F[i].n.clone().applyQuaternion(die.quaternion).dot(view); if (d > z) { z = d; best = i; } } return best + 1; };
  const mark = k => {
    chosen.geometry.dispose(); chosen.geometry = new THREE.BufferGeometry();
    chosen.geometry.setAttribute("position", new THREE.Float32BufferAttribute(stitchRing(F[k - 1], D.corners, .9, .022, .012), 3));
    chosen.geometry.computeVertexNormals();
  };

  // ---- the spring: angular velocity w chases the target orientation
  const K = 170, DAMP = 2 * Math.sqrt(K) * .84, WMAX = 16;
  let target = want(value), w = new V(), mode = "idle", raf = 0, last = 0, drag = null, cur = value, pending = null;
  let lift = 0, sc = 1, sv = 0, scT = 1, settleWaiters = [], lock = null;
  const stats = { maxStep: 0, frames: 0 }, prevQ = new THREE.Quaternion();
  // Weak GPUs: if moving frames average over ~40ms, render at 1x and drop the studio reflections.
  let slow = 0, timed = 0, lowQ = false;
  const degrade = () => { lowQ = true; renderer.setPixelRatio(1); scene.environment = null; hemi.intensity = 1.7; size(); canvas.dataset.quality = "low"; };
  die.quaternion.copy(target); mark(value);
  const qi = new THREE.Quaternion(), qe = new THREE.Quaternion(), dq = new THREE.Quaternion(), err = new V();

  function stepSpring(dt) {
    qe.copy(target).multiply(qi.copy(die.quaternion).invert());
    if (qe.w < 0) { qe.x = -qe.x; qe.y = -qe.y; qe.z = -qe.z; qe.w = -qe.w; }   // always the short way round
    const sh = Math.sqrt(qe.x * qe.x + qe.y * qe.y + qe.z * qe.z), ang = 2 * Math.atan2(sh, qe.w);
    if (sh > 1e-9) err.set(qe.x, qe.y, qe.z).multiplyScalar(ang / sh); else err.set(0, 0, 0);
    w.addScaledVector(err, K * dt).multiplyScalar(1 / (1 + DAMP * dt));   // semi-implicit, unconditionally stable damping
    if (w.length() > WMAX) w.setLength(WMAX);
    integrate(dt);
    return ang;
  }
  function integrate(dt) {
    const a = w.length() * dt;
    if (a > 1e-9) { dq.setFromAxisAngle(err.copy(w).normalize(), a); die.quaternion.premultiply(dq).normalize(); }
  }

  const loop = t => {
    const raw = (t - (last || t)) / 1000, dt = Math.min(.05, raw); last = t;
    if (!lowQ && raw > 0 && raw < .5 && mode !== "idle") { timed++; slow += raw; if (timed === 24) { if (slow / timed > .04) degrade(); } }
    if (mode === "show") {   // home screen: a slow, steady turn
      dq.setFromAxisAngle(SHOW_AXIS, dt * .45); die.quaternion.premultiply(dq).normalize();
    }
    if (mode === "coast") {   // after a finger flick: spin freely, then settle on whatever faces the lens
      integrate(dt); w.multiplyScalar(Math.exp(-dt * 3));
      if (w.length() < 2.5) { const k = front(); target = want(k); mode = "spring"; mark(k); if (k !== cur) { cur = k; pick(k); } }
    }
    prevQ.copy(die.quaternion);
    if (mode === "spring" && dt > 0) { const sub = Math.ceil(dt / (1 / 240)); for (let i = 0; i < sub; i++) stepSpring(dt / sub); }
    if (mode === "lock") {   // the final settle: a short, timed glide onto the exact face
      const p = Math.min(1, (t - lock.t0) / 260), e = 1 - Math.pow(1 - p, 3);
      die.quaternion.slerpQuaternions(lock.q0, target, e);
      if (p === 1) { die.quaternion.copy(target); w.set(0, 0, 0); mode = "spring"; lock.done(cur); lock = null; }
    }
    stats.maxStep = Math.max(stats.maxStep, prevQ.angleTo(die.quaternion)); stats.frames++;
    // lift and light respond to motion; a gentle press when locking in
    const speed = mode === "drag" ? Math.min(1, drag?.speed || 0) : Math.min(1, w.length() / 7);
    lift += ((reduced ? 0 : speed) - lift) * (1 - Math.exp(-dt * 9));
    sv += ((scT - sc) * 260 - sv * 22) * dt; sc += sv * dt;
    holder.position.y = .07 * lift; holder.scale.setScalar(sc);
    shadow.scale.setScalar(1 - .2 * lift); shadow.material.opacity = .55 - .25 * lift;
    key.intensity = 1.2 * (1 + .12 * lift);
    renderer.render(scene, cam);

    const ang = die.quaternion.angleTo(target);
    const still = mode === "spring" && ang < .0012 && w.length() < .02 && lift < .01 && Math.abs(sc - scT) < .001 && Math.abs(sv) < .01;
    if (still) {
      die.quaternion.copy(target); w.set(0, 0, 0); sc = scT; holder.scale.setScalar(sc); renderer.render(scene, cam);
      mode = "idle"; canvas.dataset.face = cur; canvas.dataset.settled = "1";
      if (pending != null) { const k = pending; pending = null; pick(k); }
      settleWaiters.splice(0).forEach(r => r(cur));
    }
    raf = mode === "idle" ? 0 : requestAnimationFrame(loop);
  };
  const SHOW_AXIS = new V(.25, 1, .12).normalize();
  let dead = false, pick = onPick;
  const wake = () => { if (dead) return; canvas.dataset.settled = "0"; if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const size = () => { const wd = canvas.clientWidth, ht = canvas.clientHeight; if (!wd || !ht) return; renderer.setSize(wd, ht, false); cam.aspect = wd / ht; cam.updateProjectionMatrix(); renderer.render(scene, cam); };
  const ro = new ResizeObserver(size); ro.observe(canvas); size();
  canvas.dataset.face = value; canvas.dataset.settled = "1"; canvas.dataset.quality = "high";

  // ---- finger / mouse spin
  const onDown = e => { if (mode === "show") return; canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), t: performance.now(), v: new V(), speed: 0, moved: 0 }; mode = "drag"; w.set(0, 0, 0); wake(); };
  const onMove = e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    const ax = new V(dy, dx, 0), ang = ax.length() * .011;
    if (ang) die.quaternion.premultiply(dq.setFromAxisAngle(ax.clone().normalize(), ang)).normalize();
    drag.v.lerp(ax.normalize().multiplyScalar(ang / dt), .5); drag.speed = drag.v.length() / 7;
    Object.assign(drag, { x: e.clientX, y: e.clientY, t: now });
  };
  // tap a number on the die to pick it: a ray from the finger to the solid finds the face
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4();
  const faceAt = (x, y) => {
    const r = canvas.getBoundingClientRect();
    ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObject(die.children[0], false)[0]; if (!hit) return 0;
    const p = hit.point.clone().applyMatrix4(inv.copy(die.matrixWorld).invert()).normalize();
    let best = 0, z = -2; for (let i = 0; i < N; i++) { const d = F[i].n.dot(p); if (d > z) { z = d; best = i; } }
    return best + 1;
  };
  const onUp = e => {
    if (!drag) return;
    if (drag.moved < 8 && performance.now() - drag.t0 < 450) {   // a tap, not a spin
      const k = faceAt(e.clientX, e.clientY); drag = null; mode = "spring";
      if (k) { api.set(k); pick(k, "tap"); } else wake();
      return;
    }
    w.copy(drag.v); drag = null; mode = reduced ? "spring" : "coast"; if (reduced) { const k = front(); target = want(k); die.quaternion.copy(target); mark(k); if (k !== cur) { cur = k; pick(k); } } wake(); };
  canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);

  const api = {
    canvas,
    /** move into a screen: start from value, report spins through onPick */
    attach({ value: v = cur, onPick: f = pick, reduced: r = reduced, showcase = false } = {}) {
      pick = f; reduced = r; drag = null; lock = null; settleWaiters.splice(0);
      cur = Math.min(N, Math.max(1, v | 0)); target = want(cur); w.set(0, 0, 0);
      if (!showcase) die.quaternion.copy(target);   // the home spin just carries on from where it was
      lift = 0; sc = scT = 1; sv = 0; holder.position.y = 0; holder.scale.setScalar(1); mark(cur);
      chosen.visible = !showcase;
      canvas.dataset.face = cur; canvas.dataset.settled = "1"; mode = "idle";
      requestAnimationFrame(() => { size(); if (showcase && !reduced) { mode = "show"; wake(); } });
    },
    /** leave the screen: stop drawing until attached again */
    detach() { cancelAnimationFrame(raf); raf = 0; mode = "idle"; drag = null; pick = () => { }; settleWaiters.splice(0).forEach(r => r(cur)); },
    /** turn to face k (the slider, buttons and typing all call this) */
    set(k, animate = !reduced) {
      k = Math.min(N, Math.max(1, k | 0)); cur = k; pending = null;
      target = want(k); mark(k);
      if (!animate) { die.quaternion.copy(target); w.set(0, 0, 0); }
      if (mode !== "drag") mode = "spring";
      wake();
    },
    /** spin and land on k; the number is announced when it lands */
    roll(k) {
      if (reduced) { pick(k); return api.set(k, false); }
      cur = k; pending = k; target = want(k); mark(k); mode = "spring";
      w.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).setLength(WMAX); wake();
    },
    /** the lock-in moment: settle exactly on the face with a soft press */
    lockIn() {
      return new Promise(res => {
        target = want(cur); drag = null;
        if (reduced) { die.quaternion.copy(target); w.set(0, 0, 0); mode = "spring"; wake(); return res(cur); }
        lock = { t0: performance.now(), q0: die.quaternion.clone(), done: res }; mode = "lock";
        scT = .93; setTimeout(() => { scT = 1; wake(); }, 140);
        wake();
      });
    },
    resetStats() { stats.maxStep = 0; stats.frames = 0; },
    /** where face k's centre is on screen (client px), or null if it faces away; used by the tests */
    screenOf(k) {
      const wp = F[k - 1].center.clone().applyMatrix4(die.matrixWorld), n = F[k - 1].n.clone().applyQuaternion(die.quaternion);
      if (n.dot(cam.position.clone().sub(wp).normalize()) < .5) return null;
      const p = wp.project(cam), r = canvas.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
    },
    /** read-only state, used by the tests */
    inspect() {
      const p = F[cur - 1].center.clone().applyQuaternion(die.quaternion).add(holder.position).project(cam);
      const up = F[cur - 1].u.clone().applyQuaternion(die.quaternion).applyQuaternion(camQ.clone().invert());
      return { face: cur, front: front(), settled: mode === "idle", maxStep: stats.maxStep, frames: stats.frames, error: die.quaternion.angleTo(target), ndc: [p.x, p.y], upright: up.y, faces: F.length, q: die.quaternion.toArray() };
    },
    destroy() {
      if (dead) return; dead = true;
      cancelAnimationFrame(raf); raf = 0; ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
      for (const o of [body, labels, stitchAll, chosen.geometry, shadow.geometry, red, ivory, thread, chosenThread, shadow.material, weave, atlas, shadowTex, envTex]) o.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      settleWaiters.splice(0).forEach(r => r(cur));
    }
  };
  return api;
}
