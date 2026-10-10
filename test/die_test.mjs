// Geometry and face-map checks for the d100, all 100 numbers. Runs in plain Node:
//   node test/die_test.mjs
import * as THREE from "../vendor/three.module.min.js";
import { buildD100, N, underline } from "../die.js";

let pass = 0; const fails = [];
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fails.push(`${name} ${extra}`); } };
const t0 = Date.now(), { face, corners } = buildD100(), ms = Date.now() - t0;

ok("exactly 100 faces", face.length === N, face.length);
ok("numbers are 1..100, each once", new Set(face.map(f => f.number)).size === N && face.every((f, i) => f.number === i + 1));

for (const f of face) {
  const k = f.number, pts = f.ring.map(ci => corners[ci].p);
  ok(`face ${k}: is a polygon`, pts.length >= 3, pts.length);
  ok(`face ${k}: unit outward normal`, Math.abs(f.n.length() - 1) < 1e-9);
  ok(`face ${k}: planar (every corner on n·x = 1)`, pts.every(p => Math.abs(p.dot(f.n) - 1) < 1e-7), Math.max(...pts.map(p => Math.abs(p.dot(f.n) - 1))));
  // convex polygon, wound counter-clockwise seen from outside
  let convex = true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    if (new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(b)).dot(f.n) <= 0) convex = false;
  }
  ok(`face ${k}: convex and outward-wound`, convex);
  // every other face's plane keeps this face's corners inside the solid
  ok(`face ${k}: corners inside every other plane`, pts.every(p => face.every(g => p.dot(g.n) <= 1 + 1e-7)));
  // the face centre (tangent point) lies inside its own polygon
  ok(`face ${k}: centre inside its polygon`, pts.every((a, i) => { const b = pts[(i + 1) % pts.length]; return new THREE.Vector3().crossVectors(b.clone().sub(a), f.n.clone().sub(a)).dot(f.n) > 0; }));

  // the orientation for k brings face k exactly to the front, upright
  const n = f.n.clone().applyQuaternion(f.q), u = f.u.clone().applyQuaternion(f.q);
  ok(`face ${k}: rotates to face the viewer`, n.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-9, n.toArray());
  ok(`face ${k}: number reads upright`, u.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, u.toArray());
  // and at that orientation no other face is closer to the viewer
  const best = face.reduce((m, g) => { const z = g.n.clone().applyQuaternion(f.q).z; return z > m.z ? { z, k: g.number } : m; }, { z: -2, k: 0 });
  ok(`face ${k}: is the frontmost face when selected`, best.k === k, best.k);
}

// even faces: every number gets the same room
const inr = face.map(f => f.inradius);
ok("faces are near-identical in size (smallest ≥ 80% of largest; pentagons vs hexagons)", Math.min(...inr) / Math.max(...inr) >= .8, (Math.min(...inr) / Math.max(...inr)).toFixed(3));
// each label fits inside its face
ok("every number fits inside its face", face.every(f => f.inradius * .74 * Math.SQRT2 < f.ring.reduce((m, ci) => Math.min(m, corners[ci].p.distanceTo(f.n)), 9)));

// distinct faces: no two normals the same
let minAngle = Infinity;
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) minAngle = Math.min(minAngle, face[i].n.angleTo(face[j].n));
ok("all 100 faces distinct", minAngle > 0.1, minAngle);

// Euler's formula V - E + F = 2 for a closed convex solid
const edges = new Set();
for (const f of face) f.ring.forEach((a, i) => { const b = f.ring[(i + 1) % f.ring.length]; edges.add(a < b ? `${a}-${b}` : `${b}-${a}`); });
ok("closed solid (V - E + F = 2)", corners.length - edges.size + N === 2, `${corners.length} - ${edges.size} + ${N}`);
// every edge is shared by exactly two faces
const count = {};
for (const f of face) f.ring.forEach((a, i) => { const b = f.ring[(i + 1) % f.ring.length], key = a < b ? `${a}-${b}` : `${b}-${a}`; count[key] = (count[key] || 0) + 1; });
ok("every edge joins exactly two faces", Object.values(count).every(c => c === 2));

// neighbouring numbers are neighbouring faces (short, natural rolls on the slider)
const adjacent = (a, b) => face[a - 1].ring.filter(c => face[b - 1].ring.includes(c)).length >= 2;
const steps = Array.from({ length: N - 1 }, (_, i) => face[i].n.angleTo(face[i + 1].n) * 180 / Math.PI);
ok("each step k → k+1 turns less than 45 degrees", Math.max(...steps) < 45, Math.max(...steps).toFixed(1));
ok("most consecutive numbers share an edge", Array.from({ length: N - 1 }, (_, i) => adjacent(i + 1, i + 2)).filter(Boolean).length >= 90);

// worst case jump 1 → 100 is a single half-turn, not a tumble
ok("1 → 100 is at most a half turn", face[0].q.angleTo(face[99].q) <= Math.PI + 1e-9);
ok("6/9-style numbers are underlined", [6, 9, 66, 99, 68, 89, 86, 98, 16, 91, 19, 61].every(underline) && ![1, 10, 11, 100, 88, 69, 96, 8, 0].some(underline));

console.log(`geometry built in ${ms} ms · ${face.length} faces · ${corners.length} corners · ${edges.size} edges · smallest face spacing ${(minAngle * 180 / Math.PI).toFixed(1)}° · largest k→k+1 turn ${Math.max(...steps).toFixed(1)}°`);
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.slice(0, 20).join("\n")); process.exit(1); }
