const ROOT = require("path").resolve(__dirname, "../..");
/* Shared rig-inspection helpers for arm_poses.glb. */
const fs = require("fs");
const PATH = ROOT + "/public/models/miguel2099/arm_poses.glb";

const b = fs.readFileSync(PATH);
const jl = b.readUInt32LE(12);
const J = JSON.parse(b.slice(20, 20 + jl).toString("utf8"));
const bin = b.slice(20 + jl + 8);

function acc(i) {
  const a = J.accessors[i];
  const bv = J.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const off = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = new Float32Array(a.count * comps);
  for (let k = 0; k < out.length; k++) out[k] = bin.readFloatLE(off + k * 4);
  return { d: out, c: comps, n: a.count };
}

const N = J.nodes;
const parent = new Array(N.length).fill(-1);
N.forEach((n, i) => (n.children || []).forEach((c) => (parent[c] = i)));
const byName = {};
N.forEach((n, i) => (byName[n.name] = i));

// node index -> Float32Array of quaternions (one per frame)
const rot = {};
for (const ch of J.animations[0].channels) {
  if (ch.target.path !== "rotation") continue;
  rot[ch.target.node] = acc(J.animations[0].samplers[ch.sampler].output).d;
}

/* ── quaternion / vector math (xyzw) ── */
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
function qrot(q, v) {
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy;
  const iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx;
  const iw = -x * vx - y * vy - z * vz;
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}
const qaxis = (ax, ang) => {
  const h = ang / 2, s = Math.sin(h);
  const l = Math.hypot(...ax) || 1;
  return [(ax[0] / l) * s, (ax[1] / l) * s, (ax[2] / l) * s, Math.cos(h)];
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Chain of node indices root->idx. */
function chainOf(idx) {
  const c = [];
  let i = idx;
  while (i >= 0) { c.unshift(i); i = parent[i]; }
  return c;
}

/**
 * World transform of `idx`.
 * `override`: { nodeIndex: quat } local rotations replacing rest/anim.
 * `frame`: baked frame to sample (null = rest pose from node.rotation).
 */
function world(idx, frame, override) {
  let q = [0, 0, 0, 1], p = [0, 0, 0], s = 1;
  for (const j of chainOf(idx)) {
    const n = N[j];
    let lq = n.rotation || [0, 0, 0, 1];
    if (frame !== null && rot[j]) {
      const o = rot[j];
      lq = [o[frame * 4], o[frame * 4 + 1], o[frame * 4 + 2], o[frame * 4 + 3]];
    }
    if (override && override[j]) lq = override[j];
    const lt = n.translation || [0, 0, 0];
    const rp = qrot(q, [lt[0] * s, lt[1] * s, lt[2] * s]);
    p = [p[0] + rp[0], p[1] + rp[1], p[2] + rp[2]];
    q = qmul(q, lq);
    s *= n.scale ? n.scale[0] : 1;
  }
  return { p, q, s };
}

module.exports = { J, N, parent, byName, rot, chainOf, world, qmul, qconj, qrot, qaxis, sub, len, norm, dot, cross };
