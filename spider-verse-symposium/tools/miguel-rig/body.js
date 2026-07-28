const ROOT = require("path").resolve(__dirname, "../..");
/* ════════════════════════════════════════════════════════════
   The BODY as a point cloud, in solve.js's chest space.

   solve.js authors hand targets in chest space but has no idea where the
   skin surface is, so a target can sit happily inside the abdomen — which
   is exactly how the first fold ended up with the hands buried in the
   torso. This module exposes the torso as points so a pose can be CHECKED
   rather than eyeballed.

   ── TWO TRAPS ON THE WAY HERE ────────────────────────────────
   1. The mesh is skinned, so POSITION is in SKIN space, and you cannot map
      it with any single joint's `jointWorld · inverseBind`: this asset's
      node rest pose is NOT its bind pose (root's IBM implies y 0.8977, the
      node says 0.8889), so that shortcut collapses everything to the
      origin. The full weighted skin sum is required.
   2. That sum lands in scene.gltf's node space, 81.3435× larger than the
      arm_poses space solve.js works in and differently centred. Rather
      than fit a transform, the chest frame is rebuilt from the shoulder
      balls directly in scene.gltf space; a and c are then pure length
      ratios and y is anchored to the known shoulder height. The
      cross-check in probe-torso.js agrees to 4 decimals on every joint.
   ════════════════════════════════════════════════════════════ */
const fs = require("fs");
const R = require("./rig.js");
const { byName, N, chainOf, qmul, qrot, sub, len, norm, dot, cross } = R;

const DIR = ROOT + "/public/models/miguel2099";
const S = JSON.parse(fs.readFileSync(DIR + "/scene.gltf", "utf8"));
const BIN = fs.readFileSync(DIR + "/scene.bin");
const sIdx = {};
S.nodes.forEach((n, i) => (sIdx[n.name] = i));
const sceneRest = (name) => S.nodes[sIdx[name]].rotation || [0, 0, 0, 1];

/* ── 4×4 column-major (gltf's layout) ── */
const mIdent = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function mFromTRS(t, q, s) {
  const [x, y, z, w] = q;
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
    t[0], t[1], t[2], 1,
  ];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= s[c];
  return m;
}
const mApply = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

const sParent = new Array(S.nodes.length).fill(-1);
S.nodes.forEach((n, i) => (n.children || []).forEach((c) => (sParent[c] = i)));
function sChain(i) { const c = []; while (i >= 0) { c.unshift(i); i = sParent[i]; } return c; }
const bigCache = new Map();
function worldBigM(idx) {
  if (bigCache.has(idx)) return bigCache.get(idx);
  let m = mIdent();
  for (const j of sChain(idx)) {
    const n = S.nodes[j];
    m = mMul(m, mFromTRS(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]));
  }
  bigCache.set(idx, m);
  return m;
}
const bigPos = (name) => mApply(worldBigM(sIdx[name]), [0, 0, 0]);

function smallPos(name) {
  let q = [0, 0, 0, 1], p = [0, 0, 0], s = 1;
  for (const j of chainOf(byName[name])) {
    const n = N[j];
    const lt = n.translation || [0, 0, 0];
    const rp = qrot(q, [lt[0] * s, lt[1] * s, lt[2] * s]);
    p = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
    q = qmul(q, sceneRest(n.name));
    s *= n.scale ? n.scale[0] : 1;
  }
  return p;
}

function chestFrame(P) {
  const AL = P("arm_stretch.l_37"), AR = P("arm_stretch.r_68");
  const U = norm(sub(AL, AR));
  const F = norm(cross(U, [0, 1, 0]));
  const lean = sub(P("head.x_5"), P("neck.x_6"));
  const FWD = dot(lean, F) >= 0 ? F : [-F[0], -F[1], -F[2]];
  const O = [(AL[0] + AR[0]) / 2, (AL[1] + AR[1]) / 2, (AL[2] + AR[2]) / 2];
  return { AL, AR, U, FWD, O };
}
const SM = chestFrame(smallPos);
const BG = chestFrame(bigPos);
const SCALE = len(sub(BG.AL, BG.AR)) / len(sub(SM.AL, SM.AR));

/** small-space root xyz -> chest (a, y, c) */
const toChest = (p) => { const d = sub(p, SM.O); return [dot(d, SM.U), p[1], dot(d, SM.FWD)]; };
/** chest (a, y, c) -> small-space root xyz */
const fromChest = ([a, y, c]) => [
  SM.O[0] + SM.U[0] * a + SM.FWD[0] * c,
  y,
  SM.O[2] + SM.U[2] * a + SM.FWD[2] * c,
];
/** chest direction -> small-space direction */
const dirFromChest = ([a, y, c]) =>
  norm([SM.U[0] * a + SM.FWD[0] * c, y, SM.U[2] * a + SM.FWD[2] * c]);
/** big-space xyz -> the SAME chest space, in small units */
const chestBig = (p) => {
  const d = sub(p, BG.O);
  return [dot(d, BG.U) / SCALE, SM.O[1] + (p[1] - BG.O[1]) / SCALE, dot(d, BG.FWD) / SCALE];
};

function readAcc(i) {
  const a = S.accessors[i];
  const bv = S.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const CT = { 5126: [4, "readFloatLE"], 5123: [2, "readUInt16LE"], 5121: [1, "readUInt8"] }[a.componentType];
  const stride = bv.byteStride || comps * CT[0];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let k = 0; k < a.count; k++) {
    const v = [];
    for (let c = 0; c < comps; c++) v.push(BIN[CT[1]](off + k * stride + c * CT[0]));
    out.push(v);
  }
  return out;
}

/* ── skin the body into chest space, tagged by dominant joint ──
   The arm verts have to come out separately: the fold moves them, so
   measuring a forearm against them would compare the arm to itself. */
const skin = S.skins[0];
const IBM = readAcc(skin.inverseBindMatrices);
const skinM = skin.joints.map((j, k) => mMul(worldBigM(j), IBM[k]));
const jointName = skin.joints.map((j) => S.nodes[j].name);
const isArm = (nm) => /^(shoulder|arm_stretch|forearm_stretch|arm_twist|forearm_twist|hand|index|middle|ring|pinky|thumb)/.test(nm);

const TORSO = []; // points on the trunk + head + legs — everything the arms can hit
const ARM = [];
for (const node of S.nodes) {
  if (node.mesh === undefined || node.skin === undefined) continue;
  for (const prim of S.meshes[node.mesh].primitives) {
    const P = readAcc(prim.attributes.POSITION);
    const JJ = readAcc(prim.attributes.JOINTS_0);
    const WW = readAcc(prim.attributes.WEIGHTS_0);
    for (let i = 0; i < P.length; i++) {
      const v = P[i];
      const acc = [0, 0, 0];
      let bw = -1, bj = 0;
      for (let k = 0; k < 4; k++) {
        const w = WW[i][k];
        if (!w) continue;
        if (w > bw) { bw = w; bj = JJ[i][k]; }
        const t = mApply(skinM[JJ[i][k]], v);
        acc[0] += w * t[0]; acc[1] += w * t[1]; acc[2] += w * t[2];
      }
      (isArm(jointName[bj]) ? ARM : TORSO).push(chestBig(acc));
    }
  }
}

/* ── clearance ──
   The camera looks at the chest from roughly +c, so "the arm is visible"
   and "the arm is not inside the torso" are the same test: is the point
   further forward than the skin at that (a, y)? Bucketed on a 2 cm grid so
   the solver can call it thousands of times without noticing. */
const CELL = 0.02;
const front = new Map(); // (a, y) cell -> greatest c on the trunk
const halfW = new Map(); // y cell -> trunk half-width
for (const [a, y, c] of TORSO) {
  const k = `${Math.round(a / CELL)}|${Math.round(y / CELL)}`;
  if (!(front.get(k) > c)) front.set(k, c);
  const ky = Math.round(y / CELL);
  if (!(halfW.get(ky) > Math.abs(a))) halfW.set(ky, Math.abs(a));
}

/** How far in front of the skin is this chest-space point? Beside the trunk
    (or above/below it) counts as fully clear. Negative = buried. */
function clearFront([a, y, c]) {
  const w = halfW.get(Math.round(y / CELL));
  if (w === undefined) return 1;
  if (Math.abs(a) > w + 0.02) return 1;
  let f = -Infinity;
  for (let da = -1; da <= 1; da++)
    for (let dy = -1; dy <= 1; dy++) {
      const v = front.get(`${Math.round(a / CELL) + da}|${Math.round(y / CELL) + dy}`);
      if (v !== undefined && v > f) f = v;
    }
  return f === -Infinity ? 1 : c - f;
}

/** Worst clearance along a limb segment plus a ~4 cm ball around its tip. */
function segmentClearance(from, to, ballR = 0.04) {
  let worst = Infinity;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const cl = clearFront([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ]);
    if (cl < worst) worst = cl;
  }
  for (const d of [[0, -ballR, 0], [0, ballR, 0], [ballR, 0, 0], [-ballR, 0, 0]]) {
    const cl = clearFront([to[0] + d[0], to[1] + d[1], to[2] + d[2]]);
    if (cl < worst) worst = cl;
  }
  return worst;
}

/** Front surface c of the torso at (a, y), or null if the torso isn't there. */
function frontAt(a, y, tol = 0.03) {
  let maxC = -Infinity;
  for (const q of TORSO) {
    if (Math.abs(q[0] - a) > tol || Math.abs(q[1] - y) > tol) continue;
    if (q[2] > maxC) maxC = q[2];
  }
  return Number.isFinite(maxC) ? maxC : null;
}

module.exports = {
  TORSO, ARM, toChest, fromChest, dirFromChest, chestBig, smallPos, sceneRest,
  clearFront, segmentClearance, frontAt,
  SHOULDER_L: SM.AL, SHOULDER_R: SM.AR, SCALE,
};
