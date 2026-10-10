// The SUBAR100 die: a real 100-faced solid in racing red with ivory numbers.
// Faces sit on a spiral, so neighbouring numbers are neighbouring faces and the slider rolls it smoothly.
import * as THREE from "./vendor/three.module.min.js";

const N = 100, V = THREE.Vector3;

// 100 face directions along an even spiral from top (1) to bottom (100)
function spiral() {
  const p = []; let phi = 0;
  for (let k = 0; k < N; k++) {
    const h = 1 - 2 * k / (N - 1), t = Math.acos(h);
    phi = k === 0 || k === N - 1 ? 0 : phi + 3.6 / Math.sqrt(N) / Math.sqrt(1 - h * h);
    p.push(new V(Math.sin(t) * Math.cos(phi), h, Math.sin(t) * Math.sin(phi)));
  }
  return p;
}

// The solid is bounded by the 100 planes tangent to the unit sphere at those points.
// Its corners come from the convex hull of the points (one corner per hull triangle).
// ponytail: brute-force hull, O(n^4) but ~30ms once for 100 points
function solid(P) {
  const corners = [], byFace = P.map(() => []), n = new V(), a = new V(), b = new V();
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
    const id = corners.push(c) - 1; byFace[i].push(id); byFace[j].push(id); byFace[k].push(id);
  }
  return { corners, byFace };
}

// text "up" for each face: towards the north pole, so the numbers read like lines of latitude
function frame(p) {
  const up = Math.abs(p.y) > .97 ? new V(0, 0, -Math.sign(p.y)) : new V(0, 1, 0);
  const u = up.sub(p.clone().multiplyScalar(up.dot(p))).normalize(), r = new V().crossVectors(u, p);
  return { r, u, n: p };
}

// ambiguous upside-down numbers get the dice-maker's underline (6 vs 9, 68 vs 89 …)
const ROT = { 0: "0", 1: "1", 6: "9", 8: "8", 9: "6" };
const underline = k => { const s = String(k); if (![...s].every(c => c in ROT)) return false; const r = +[...s].reverse().map(c => ROT[c]).join(""); return r !== k && r >= 1 && r <= 100; };

function atlas() {
  const cell = 128, cv = document.createElement("canvas"); cv.width = cv.height = cell * 10;
  const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  for (let k = 1; k <= N; k++) {
    const cx = ((k - 1) % 10) * cell + cell / 2, cy = Math.floor((k - 1) / 10) * cell + cell / 2;
    x.font = `400 ${k === 100 ? 70 : 82}px Anton, Impact, sans-serif`; x.fillText(String(k), cx, cy - 4);
    if (underline(k)) x.fillRect(cx - 18, cy + 40, 36, 7);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export async function createDie(canvas, { value = 50, onPick = () => { }, reduced = false } = {}) {
  await document.fonts.load("400 80px Anton").catch(() => { });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, .1, 30);
  cam.position.set(0, 0, 5.4);
  scene.add(new THREE.HemisphereLight(0xfff3ea, 0x3a0003, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-2.2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9cf, 1.2); rim.position.set(3, -1.5, -2); scene.add(rim);

  const P = spiral(), { corners, byFace } = solid(P), F = P.map(frame);
  const pos = [], nor = [], tpos = [], tuv = [];
  P.forEach((p, i) => {
    const { r, u } = F[i];
    const ring = byFace[i].map(id => corners[id]).sort((a, b) => Math.atan2(a.dot(u), a.dot(r)) - Math.atan2(b.dot(u), b.dot(r)));
    for (let t = 1; t < ring.length - 1; t++) for (const v of [ring[0], ring[t], ring[t + 1]]) { pos.push(v.x, v.y, v.z); nor.push(p.x, p.y, p.z); }
    // the number: a small quad on the face, lifted a hair off the surface
    const s = .13, c = p.clone().multiplyScalar(1.003), col = (i % 10) / 10, row = Math.floor(i / 10) / 10;
    const q = [[-s, -s, col, 1 - row - .1], [s, -s, col + .1, 1 - row - .1], [s, s, col + .1, 1 - row], [-s, s, col, 1 - row]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      const v = c.clone().addScaledVector(r, q[k][0]).addScaledVector(u, q[k][1]);
      tpos.push(v.x, v.y, v.z); tuv.push(q[k][2], q[k][3]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(tpos, 3)); tg.setAttribute("uv", new THREE.Float32BufferAttribute(tuv, 2));
  tg.computeVertexNormals();
  const die = new THREE.Group();
  die.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc81014, roughness: .42, metalness: .05 })));
  die.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 8), new THREE.LineBasicMaterial({ color: 0xf1e6da, transparent: true, opacity: .22 })));
  die.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: atlas(), color: 0xf1e6da, transparent: true, roughness: .7, polygonOffset: true, polygonOffsetFactor: -2 })));
  scene.add(die);

  // a stitched ivory ring marks the chosen face (the patch border, in 3D)
  const rings = P.map((p, i) => {
    const { r, u } = F[i];
    return byFace[i].map(id => corners[id]).sort((a, b) => Math.atan2(a.dot(u), a.dot(r)) - Math.atan2(b.dot(u), b.dot(r)));
  });
  const ringMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xfaf8f5, polygonOffset: true, polygonOffsetFactor: -3 }));
  die.add(ringMesh);
  const mark = k => {
    const ring = rings[k - 1], c = P[k - 1].clone().multiplyScalar(1.004), v = [];
    const at = (pt, f) => c.clone().lerp(pt.clone().multiplyScalar(1.004), f);
    for (let t = 0; t < ring.length; t++) {
      const A = ring[t], B = ring[(t + 1) % ring.length], o1 = at(A, .9), o2 = at(B, .9), i1 = at(A, .8), i2 = at(B, .8);
      for (const q of [o1, o2, i2, o1, i2, i1]) v.push(q.x, q.y, q.z);
    }
    ringMesh.geometry.dispose(); ringMesh.geometry = new THREE.BufferGeometry();
    ringMesh.geometry.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  };

  // the orientation that shows face k front and upright
  const Q = F.map(({ r, u, n }) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n).transpose()));
  const tilt = new THREE.Quaternion();   // chosen face dead centre
  const want = k => tilt.clone().multiply(Q[k - 1]);
  const view = new V(0, 0, 1).applyQuaternion(tilt);
  const front = () => { let best = 0, z = -2; for (let i = 0; i < N; i++) { const d = P[i].clone().applyQuaternion(die.quaternion).dot(view); if (d > z) { z = d; best = i; } } return best + 1; };

  let target = want(value), omega = new V(), mode = "settle", forced = null, raf = 0, last = 0, drag = null, cur = value;
  die.quaternion.copy(target);
  canvas.dataset.face = value; mark(value);

  const loop = t => {
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    if (mode === "coast") {
      const w = omega.length();
      if (w > .01) die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(omega.clone().normalize(), w * dt));
      omega.multiplyScalar(Math.exp(-dt * (forced ? 2.2 : 3.2)));
      if (w < 2.2) { const k = forced || front(); forced = null; mode = "settle"; target = want(k); if (reduced) die.quaternion.copy(target); mark(k); if (k !== cur) { cur = k; onPick(k); } }
    }
    if (mode === "settle") {
      die.quaternion.slerp(target, 1 - Math.exp(-dt * 9));
      if (die.quaternion.angleTo(target) < .002) { die.quaternion.copy(target); mode = "idle"; canvas.dataset.face = cur; mark(cur); }
    }
    renderer.render(scene, cam);
    raf = mode === "idle" && !drag ? 0 : requestAnimationFrame(loop);
  };
  const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const size = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); renderer.render(scene, cam); };
  const ro = new ResizeObserver(size); ro.observe(canvas); size();

  canvas.addEventListener("pointerdown", e => { canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, t: performance.now(), v: new V() }; mode = "drag"; wake(); });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    const ax = new V(dy, dx, 0), ang = ax.length() * .011;
    if (ang) die.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax.normalize(), ang));
    drag.v.lerp(ax.multiplyScalar(ang / dt), .5); Object.assign(drag, { x: e.clientX, y: e.clientY, t: now });
  });
  const release = () => { if (!drag) return; omega.copy(drag.v); drag = null; mode = "coast"; if (reduced) omega.set(0, 0, 0); wake(); };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);

  return {
    set(k, animate = !reduced) { cur = k; forced = null; target = want(k); mode = "settle"; mark(k); if (!animate) { die.quaternion.copy(target); canvas.dataset.face = k; } wake(); },
    roll(k) {
      if (reduced) { onPick(k); return this.set(k, false); }   // otherwise the number appears when the die lands
      forced = k; mode = "coast"; omega.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(26); wake();
    },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); }
  };
}
