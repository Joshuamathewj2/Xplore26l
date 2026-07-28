const ROOT = require("path").resolve(__dirname, "../..");
/* End-to-end check: mirrors resolveArms() + the Spider3D blend math, applies
   the authored quats to the real skeleton, and FKs the hands out. Confirms the
   sequencing produces the intended stances and never doubles back. */
const fs = require("fs");
const R = require("./rig.js");
const { byName, N, chainOf, qmul, qrot, sub, len } = R;

const SCENE = JSON.parse(
  fs.readFileSync(
    ROOT + "/public/models/miguel2099/scene.gltf",
    "utf8"
  )
);
const sIdx = {};
SCENE.nodes.forEach((n, i) => (sIdx[n.name] = i));
const sceneRest = (nm) => SCENE.nodes[sIdx[nm]].rotation || [0, 0, 0, 1];

/* pull the authored table straight out of the shipped TS so this can't drift */
const src = fs.readFileSync(
  ROOT + "/src/lib/armPoses.ts",
  "utf8"
);
const POSES = {}; const CURL = {};
for (const m of src.matchAll(/^  (rest|fold|guard|chamber|punch): \{([\s\S]*?)^  \},/gm)) {
  const bones = {};
  for (const b of m[2].matchAll(/(\w+): \[([-\d.,\s]+)\]/g)) {
    bones[b[1]] = b[2].split(",").map(Number);
  }
  POSES[m[1]] = bones;
}
console.log("parsed poses:", Object.keys(POSES), "bones each:", Object.values(POSES).map(p => Object.keys(p).length));

const sanitize = (s) => s.replace(/[[\]./:]/g, "");
const REST_BONES = ["arm_twistl_8","forearm_twistl_9","arm_twistr_39","forearm_twistr_40"];
// sanitized -> real node name
const real = {};
for (const n of N) real[sanitize(n.name)] = n.name;

function worldWith(nodeName, ov) {
  let q = [0, 0, 0, 1], p = [0, 0, 0], s = 1;
  for (const j of chainOf(byName[nodeName])) {
    const n = N[j];
    const lq = (ov && ov[n.name]) || sceneRest(n.name);
    const lt = n.translation || [0, 0, 0];
    const rp = qrot(q, [lt[0] * s, lt[1] * s, lt[2] * s]);
    p = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
    q = qmul(q, lq);
    s *= n.scale ? n.scale[0] : 1;
  }
  return p;
}
function slerp(a, b, t) {
  let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  let bb = b.slice();
  if (d < 0) { bb = b.map(v => -v); d = -d; }
  if (d > 0.9995) return a.map((v, i) => v + (bb[i] - v) * t);
  const th = Math.acos(d), s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s, w2 = Math.sin(t * th) / s;
  return a.map((v, i) => v * w1 + bb[i] * w2);
}

/* â”€â”€ mirror of beats.ts â”€â”€ */
/* Mirrors the `arms` field of BEATS in src/lib/beats.ts. Hero and interlude
   are "rest" (not null) — see the note on the hero beat there: a null beat
   stops driving the arm bones entirely and lets the last pose latch. */
const BEAT_ARMS = ["rest", "fold", "rest", "punch"];
const PUNCH = {
  raiseFrac: 0.8, chamberFrac: 0.9, releaseFrac: 0.945, impactStartFrac: 0.958,
};
const RECOIL_DEPTH = 0.12;
const expo = (v) => { const t = cl(v); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (v) => { const t = cl(v); return t * t * (3 - 2 * t); };

function resolveArms(pos) {
  const maxIdx = BEAT_ARMS.length - 1;
  if (pos > maxIdx - 1) {
    const seqStart = maxIdx - 1;
    const raiseEnd = Math.max(maxIdx * PUNCH.raiseFrac, seqStart + 1e-3);
    const drawEnd = Math.max(maxIdx * PUNCH.chamberFrac, raiseEnd + 1e-3);
    const fireStart = Math.max(maxIdx * PUNCH.releaseFrac, drawEnd + 1e-3);
    const fireEnd = Math.max(maxIdx * PUNCH.impactStartFrac, fireStart + 1e-3);
    if (pos <= raiseEnd)
      return { from: BEAT_ARMS[maxIdx - 1], to: "guard", blend: sm((pos - seqStart) / (raiseEnd - seqStart)), ph: "raise" };
    if (pos <= drawEnd)
      return { from: "guard", to: "chamber", blend: sm((pos - raiseEnd) / (drawEnd - raiseEnd)), ph: "draw" };
    if (pos < fireStart) return { from: "chamber", to: "chamber", blend: 1, ph: "hold" };
    if (pos < fireEnd) {
      const t = cl((pos - fireStart) / (fireEnd - fireStart));
      return { from: "chamber", to: "punch", blend: expo(t), ph: "FIRE" };
    }
    const t = cl((pos - fireEnd) / Math.max(maxIdx - fireEnd, 1e-3));
    const b = 1 - RECOIL_DEPTH * Math.sin(Math.PI * Math.pow(t, 0.55)) * (1 - t);
    return { from: "chamber", to: "punch", blend: b, ph: "recoil" };
  }
  const i = Math.max(Math.min(Math.floor(pos), maxIdx - 1), 0);
  return { from: BEAT_ARMS[i], to: BEAT_ARMS[i + 1], blend: sm(pos - i), ph: "beat" };
}

/* â”€â”€ mirror of the Spider3D consumer (no damping: steady-state check) â”€â”€ */
function poseAt(pos) {
  const a = resolveArms(pos);
  const from = a.from ? POSES[a.from] : null;
  const to = a.to ? POSES[a.to] : null;
  let w;
  if (from && to) w = 1; else if (from) w = 1 - a.blend; else if (to) w = a.blend; else w = 0;
  const ov = {};
  if (w > 0.001) {
    const keys = Object.keys(POSES.fold);
    for (const k of keys) {
      const qa = from && from[k], qb = to && to[k];
      let t;
      if (qa && qb) t = slerp(qa, qb, a.blend);
      else if (qa || qb) t = qa || qb;
      else continue;
      ov[real[k]] = slerp(sceneRest(real[k]), t, w);
    }
    for (const k of REST_BONES) ov[real[k]] = sceneRest(real[k]);
  }
  return { a, w, hr: worldWith("hand.r_65", ov), hl: worldWith("hand.l_34", ov), ar: worldWith("arm_stretch.r_68", ov) };
}

/* â”€â”€ mirror of punchDrive() â”€â”€ */
function drive(pos) {
  const maxIdx = BEAT_ARMS.length - 1;
  if (pos <= maxIdx - 1) return 0;
  const seqStart = maxIdx - 1;
  const raiseEnd = Math.max(maxIdx * PUNCH.raiseFrac, seqStart + 1e-3);
  const drawEnd = Math.max(maxIdx * PUNCH.chamberFrac, raiseEnd + 1e-3);
  const fireStart = Math.max(maxIdx * PUNCH.releaseFrac, drawEnd + 1e-3);
  const fireEnd = Math.max(maxIdx * PUNCH.impactStartFrac, fireStart + 1e-3);
  if (pos <= raiseEnd) return -0.35 * sm((pos - seqStart) / (raiseEnd - seqStart));
  if (pos <= drawEnd) return -0.35 - 0.65 * sm((pos - raiseEnd) / (drawEnd - raiseEnd));
  if (pos < fireStart) return -1;
  if (pos < fireEnd) {
    return -1 + 2 * expo(cl((pos - fireStart) / (fireEnd - fireStart)) * 1.35);
  }
  return 1 - 0.10 * sm(cl((pos - fireEnd) / Math.max(maxIdx - fireEnd, 1e-3)));
}

console.log("\npos    phase  from->to      blend  wt  torso  right hand (x,y,z)        ext%  left hand");
let prevExt = null, regressions = 0, prevTorso = null, torsoJumps = 0, peak = 0;
for (let pos = 1.0; pos <= 3.0001; pos += 0.05) {
  const p = poseAt(pos);
  const ext = len(sub(p.hr, p.ar)) / 0.526;
  const d = drive(pos);
  if (pos > 2.0 && prevExt !== null && ext < prevExt - 0.02 && p.a.ph === "FIRE") regressions++;
  // The torso signal must be CONTINUOUS across every stage boundary, or the
  // chest visibly snaps as the punch changes phase.
  prevTorso = d;
  peak = Math.max(peak, ext);
  prevExt = pos > 2.0 ? ext : prevExt;
  console.log(
    pos.toFixed(2).padStart(5),
    p.a.ph.padEnd(6),
    `${String(p.a.from).padEnd(7)}->${String(p.a.to).padEnd(8)}`,
    p.a.blend.toFixed(2), p.w.toFixed(2),
    d.toFixed(2).padStart(6),
    " [" + p.hr.map(v => v.toFixed(3).padStart(6)).join(",") + "]",
    (ext * 100).toFixed(0).padStart(4) + "%",
    "[" + p.hl.map(v => v.toFixed(3).padStart(6)).join(",") + "]"
  );
}
console.log(regressions ? `\n!! ${regressions} extension regressions during FIRE` : "\nOK: extension is monotone through the release");
/* Continuity of the torso drive AT THE STAGE BOUNDARIES, which is the only
   place it can actually jump. Scanning for a large delta does not work here:
   the strike is legitimately steep (~45 per beatPos over its ~0.1-wide
   window), so any threshold low enough to catch a real step also flags the
   throw itself. Comparing the one-sided limits either side of each boundary
   tests the thing that matters and nothing else. */
{
  const maxIdx = BEAT_ARMS.length - 1;
  const bounds = {
    raiseEnd: maxIdx * PUNCH.raiseFrac,
    drawEnd: maxIdx * PUNCH.chamberFrac,
    fireStart: maxIdx * PUNCH.releaseFrac,
    fireEnd: maxIdx * PUNCH.impactStartFrac,
  };
  /* eps has to be small enough that a steep-but-continuous function looks
     continuous. easeOutExpo leaves the chamber at ~480 per beatPos, so at
     1e-5 the strike's own slope shows up as a 0.005 "jump". A true step stays
     the same size however far you shrink eps; a slope shrinks with it. */
  const eps = 1e-9;
  torsoJumps = 0;
  for (const [name, b] of Object.entries(bounds)) {
    const gap = Math.abs(drive(b + eps) - drive(b - eps));
    if (gap > 1e-3) {
      torsoJumps++;
      console.log(`!! torso drive jumps ${gap.toFixed(4)} across ${name} (pos ${b.toFixed(3)})`);
    }
  }
  if (!torsoJumps) console.log("OK: torso drive continuous across every stage boundary");
}
console.log(`peak extension ${(peak * 100).toFixed(0)}%`);


