import * as THREE from "three";

/* ════════════════════════════════════════════════════════════
   PROCEDURAL ARM POSES — hand-authored stances the baked clip doesn't have.

   WHY THIS EXISTS
   arm_poses.glb ships six poses and its header comment claims pose 1 is
   "arms crossed". It isn't. Solving forward kinematics on the actual baked
   keyframes puts both hands ~15 cm BELOW the shoulders and slightly forward,
   wider apart than the shoulders themselves — hands hanging low in front,
   nowhere near folded. There is no arms-crossed pose in the file, and
   re-exporting the GLB needs Blender + the original scene.

   HOW THESE WERE PRODUCED (not by eye — the numbers are solved)
   tools/miguel-rig/solve.js runs a 12-DOF IK fit per arm (shoulder, upper
   arm, forearm, hand) against the real rig geometry, targeting a hand
   position, an elbow derived from a pole vector, and the hand's finger and
   palm directions. Residuals are ~0.1 mm on position and 0–7° on orientation.
   It then checks the SOLVED bones against the skin: body.js reconstructs the
   skinned body mesh in the same chest space, and solve.js reports how far
   each forearm clears it. A pose that hits the target and still swings the
   arm through the ribs prints "BURIED" — that check is what caught the fold.

   The palm target is only a ROLL about the finger axis, so solve.js
   orthogonalises it against the finger target before solving. Authoring the
   two independently describes a hand that cannot exist and the solver splits
   the difference; that was the source of the old 2–7° orientation residuals.
   Every pose here now hits its authored finger AND palm direction at 0°.

   ── FOUR THINGS THAT WILL BITE IF YOU EDIT THIS ───────────────────────
   1. TARGETS ARE AUTHORED IN CHEST SPACE. scene.gltf's bind pose has the
      torso YAWED 30.2° about Y — the shoulder balls are at (0.2905, ., 0.0652)
      and (−0.2004, ., −0.2203), which are NOT mirror images. The first
      version of this file authored targets in raw root space and the fold
      came out with both hands on the same side of the sternum, fingers
      splayed at each other. Edit poses in solve.js, never by nudging the
      quaternions below.
   2. ABSOLUTE, NOT RELATIVE. scene.gltf and arm_poses.glb share bone OFFSETS
      but NOT arm bind rotations (they differ by up to 0.15 per component), and
      are uniformly scaled 81.35× apart. These are absolute local rotations,
      exactly like the clip's own tracks.
   3. THE SOLVE ASSUMES THE TWIST BONES SIT AT BIND REST — hence REST_BONES.
      Leave them to the mixer and they fight the authored pose.
   4. FINGERS ARE PART OF THE POSE NOW. They used to be left to the baked
      clip, which is why the fold showed splayed fingers: no baked pose has a
      relaxed closed hand (poses 0/2/4 are ~100% open, 1/3 are 87%, only 5 is
      a fist). See FIST_FINGERS below.
   ════════════════════════════════════════════════════════════ */

export type ArmPoseName = "rest" | "fold" | "guard" | "chamber" | "punch";

/* three's GLTFLoader strips "." (and ":", "/", "[", "]") from node names, so
   the rig's `arm_stretch.l_37` arrives as `arm_stretchl_37`. Keys below are
   already in that sanitized form — see sanitizeBoneName(). */
type PoseSpec = {
  /** 0 = bind-rest open hand, 1 = the baked fist. */
  curl: number;
  bones: Record<string, [number, number, number, number]>;
};

const POSE_DATA: Record<ArmPoseName, PoseSpec> = {
  // Order matters only for readability; resolveArms() names them explicitly.
  /* ── REST — the opening stance, arms hanging at his sides ──
     Not solved: these ARE scene.gltf's own bind rotations, emitted so the
     default stance is a pose the rig actively DRIVES rather than one it
     falls back to.

     WHY IT EXISTS. The hero beat used to say `arms: null`, meaning "let the
     baked clip own the arms" — so the procedural layer faded its weight to
     zero and simply STOPPED WRITING those bones. That is only safe if
     something else is guaranteed to write them every frame. When it isn't,
     the last pose written stays on the skeleton: scroll down to the folded-
     arms section and back up to the hero, and he is still standing there
     with his arms crossed, because after the fade-out nothing ever said
     otherwise. Driving `rest` at weight 1 makes the opening pose an
     assertion instead of an absence, so it cannot be left behind.

     curl 0 = hands open, which is what the bind pose has. */
  rest: {
    curl: 0,
    bones: {
      shoulderr_69: [-0.601125, 0.344639, 0.473359, 0.543878],
      arm_stretchr_68: [-0.534302, -0.087567, 0.131768, 0.830356],
      forearm_stretchr_67: [0, 0, 0.202977, 0.979184],
      handr_65: [-0.085144, -0.111118, 0.033092, 0.9896],
      shoulderl_38: [-0.601125, -0.344639, -0.473359, 0.543878],
      arm_stretchl_37: [-0.534302, 0.087567, -0.131768, 0.830356],
      forearm_stretchl_36: [0, 0, -0.202977, 0.979184],
      handl_34: [-0.147648, 0.128832, -0.074856, 0.977752],
    },
  },
  /* ARMS CROSSED — two forearms stacked in an X across the torso, right on
     top, left tucked under.

     WHY THE ARMS SIT WHERE THEY DO
     forearm 0.2768 vs shoulder half-span 0.2840. The forearm is SHORTER than
     the distance from the shoulder ball to the centreline, so with the elbows
     parked at the sides the fingertips do not even reach the sternum — the
     elbows have to swing forward and inboard, exactly as a person's do when
     they fold their arms.

     ── THE THREE THINGS THIS POSE GETS WRONG IF YOU LET IT ──────────────
     Everything here is measured against the skinned mesh (body.js) with the
     limb radii read off it: forearm r ≈ 0.051, upper arm 0.078, hand
     half-thickness 0.055. Two limbs whose AXES are (r1+r2) apart are exactly
     touching; closer than that is interpenetration, which is the single most
     obvious way for a pose to look broken.

     1. THE ARMS EATING EACH OTHER. The previous fold put the two forearm
        axes 0.0695 apart — 3.5 cm of solid overlap — because the search only
        compared their DEPTH (c) components and called that the gap. Two
        limbs crossing at an angle can be 0.06 apart in c and still occupy
        the same space. The gap is now a true 3D segment-to-segment distance
        held at 2× the p75 radius, and this pose sits at 0.116 — clear at
        every percentile up to p90, where the arms would touch.
     2. THE SHRUG. Nothing here rotates the clavicle — the solver pins it to
        within 0.03 mm of bind, and the bind clavicle already slopes 9.1°
        DOWN, so the shoulders were never the problem. What reads as hunched
        is the UPPER ARM: the old elbows sat at y 0.419, only 20° below
        horizontal, i.e. winged out to the side. Folding your arms drops the
        elbows and brings the forearms up to meet each other. They now hang
        at 31° (right) and 38° (left). The clavicles are also relaxed ~11 mm
        down and ~5 mm forward on top of that — real, but the small part.
     3. THE ARM SUNK IN THE CHEST. The bottom forearm's axis used to sit
        0.015 proud of the skin against its own radius of 0.051: 70% of the
        limb inside the torso. It is now +0.035, so the arm compresses the
        body by about a third of its radius — which is what a folded arm
        does to a chest — instead of disappearing into it.

     ── THE COMPROMISE THIS RIG FORCES ──────────────────────────────────
     You cannot have elbows down AND the forearm fully clear of the chest AND
     the hands crossing the centreline. The elbow is pinned exactly 0.2492
     from the shoulder ball, so dropping it to y 0.33 leaves only 0.1775 of
     horizontal radius — the elbow ends up behind the chest surface (c ≈ 0.22)
     and a forearm crossing the body from there starts buried; lifting it
     clear needs 0.538 of reach against the 0.526 the arm has. So the hands
     cross only ~0.02 past the sternum and tuck into the opposite elbow
     crooks, rather than reaching the far bicep. They cannot reach the far
     bicep: at full stretch a hand still ends up 0.23 from it.

       • RIGHT (top) hand at chest [0.020, 0.460, 0.300], 82% reach, elbow 109°
       • LEFT (bottom) hand at [-0.020, 0.320, 0.280], 86% reach, elbow 119°
       • the two forearms are 0.116 apart — touching, not overlapping

     FOREARM ROLL — the thing that makes or breaks this pose.
     A first pass had both palms facing the camera, which put the forearms in
     SUPINATION: the soft inner side of the arm and the open palms turned
     out. That reads as someone offering their hands, not folding them. The
     top palm now faces DOWN onto the forearm it rests on and the bottom palm
     faces UP into the arm above it, both rolled in toward the body.

     The wrists are tucked ~19° off the forearm line. Left straight, the hand
     continues the forearm out past the body into empty space, which is what
     reads as fingers sticking out; tucked, it folds over the arm underneath.
     Curl 0.72 (was 0.5 — a half-open hand) so the fingers wrap the opposite
     forearm. The only closed hand in the source asset is a clenched fist, so
     every value is a compromise between open and gripping; past ~0.85 he
     looks like he is squeezing his own arm. */
  fold: {
    curl: 0.72,
    bones: {
      shoulderr_69: [-0.620721, 0.35585, 0.473163, 0.513997],
      arm_stretchr_68: [-0.604895, 0.10406, 0.566363, 0.550006],
      forearm_stretchr_67: [-0.323025, -0.231925, 0.492918, 0.773885],
      handr_65: [-0.183059, -0.290088, -0.134797, 0.929607],
      shoulderl_38: [-0.601773, -0.336014, -0.495946, 0.528207],
      arm_stretchl_37: [-0.701648, -0.267413, -0.380248, 0.539992],
      forearm_stretchl_36: [-0.448529, -0.28354, 0.281138, 0.799618],
      handl_34: [-0.056804, 0.198817, 0.002333, 0.978386],
    },
  },
  /* THE PUNCH SEQUENCE — guard → chamber → punch.
     The LEFT ARM SITS ALL THREE OUT, at an identical relaxed hang (92% of
     reach, 133° elbow, fingers down, palm turned in against the thigh). It is
     byte-identical across the three on purpose: any drift would make the left
     arm twitch as the blend crosses a phase boundary, which is exactly the
     kind of motion that reads as a broken animation. Only the right arm
     works. */

  /* GUARD — the arm comes UP. Upper arm horizontal out to his right, forearm
     straight up, elbow at a true 90°. That geometry is forced: the elbow has
     to sit the full upper-arm length from the shoulder ball with ZERO
     vertical offset, because dropping it below the shoulder and raising the
     forearm to vertical folds the joint shut instead of opening it to a right
     angle. The fist finishes at chest y 0.78 — head height, and well clear of
     the head itself at a 0.01. */
  guard: {
    curl: 1,
    bones: {
      shoulderr_69: [-0.60147, 0.344896, 0.472197, 0.544344],
      arm_stretchr_68: [0.129413, 0.239052, 0.34946, 0.896652],
      forearm_stretchr_67: [-0.07402, 0.468172, 0.703501, 0.52955],
      handr_65: [0.251902, 0.107735, 0.166489, 0.947217],
      shoulderl_38: [-0.600578, -0.34463, -0.473056, 0.544752],
      arm_stretchl_37: [-0.464605, 0.122794, -0.079384, 0.873363],
      forearm_stretchl_36: [-0.141525, 0.138442, -0.358782, 0.912184],
      handl_34: [0.000274, -0.11058, 0.193481, 0.974852],
    },
  },
  /* CHAMBER — the wind-up. Drawn straight BACK from the guard: same side of
     the body, same rough height, just behind the chest plane (chest c −0.05).
     47% of reach at a 56° elbow.

     THE POINT OF THESE NUMBERS IS THE PATH, NOT THE POSE. The arm gets from
     here to `punch` by slerping between the two, so the straight-line delta
     between the two hands IS the trajectory the fist flies. An earlier pair
     sat at chest a −0.40 and a +0.05, making that delta 64% sideways: the
     fist swung out and around, which is what read as a looping arm-wave
     rather than a punch. Both hands now stay on his own right, turning the
     same delta into 85% pure forward — straight down the barrel at the lens. */
  chamber: {
    curl: 1,
    bones: {
      shoulderr_69: [-0.60123, 0.343954, 0.473898, 0.543727],
      arm_stretchr_68: [-0.20014, -0.4855, -0.249131, 0.813737],
      forearm_stretchr_67: [0.264958, -0.176729, -0.841563, 0.436276],
      handr_65: [0.126578, -0.121218, -0.478481, 0.86043],
      shoulderl_38: [-0.600578, -0.34463, -0.473056, 0.544752],
      arm_stretchl_37: [-0.464605, 0.122794, -0.079384, 0.873363],
      forearm_stretchl_36: [-0.141525, 0.138442, -0.358782, 0.912184],
      handl_34: [0.000274, -0.11058, 0.193481, 0.974852],
    },
  },
  /* PUNCH — the release. 99% extension (elbow 163°) driving STRAIGHT out in
     front of his own right shoulder (chest a −0.14, barely inboard) to c 0.50,
     with the elbow dropped under the line of the arm — that drop is what makes
     it read as a thrown punch instead of an arm held up. Palm DOWN, which is
     how a cross actually lands. */
  punch: {
    curl: 1,
    bones: {
      shoulderr_69: [-0.601198, 0.345131, 0.472969, 0.543825],
      arm_stretchr_68: [-0.284004, 0.084717, 0.828097, 0.475836],
      forearm_stretchr_67: [0.108195, -0.153108, 0.101058, 0.977056],
      handr_65: [-0.000322, -0.221401, -0.000486, 0.975183],
      shoulderl_38: [-0.600578, -0.34463, -0.473056, 0.544752],
      arm_stretchl_37: [-0.464605, 0.122794, -0.079384, 0.873363],
      forearm_stretchl_36: [-0.141525, 0.138442, -0.358782, 0.912184],
      handl_34: [0.000274, -0.11058, 0.193481, 0.974852],
    },
  },
};

/* FINGERS. Stored once as the full fist — lifted from baked pose 5, the only
   artist-authored closed hand in the clip — and reached by slerping from each
   bone's own bind rest by the pose's `curl`. One scalar per pose instead of 38
   more quaternions, and it means "relaxed closed" is a tunable rather than a
   pose that doesn't exist in the source asset. */
const FIST_DATA: Record<string, [number, number, number, number]> = {
  index1_basel_14: [-0.007701, -0.000452, -0.008728, 0.999932],
  index1l_13: [-0.579942, -0.057673, 0.11792, 0.804013],
  index2l_12: [-0.427524, -0.063685, 0.019948, 0.901537],
  index3l_11: [-0.405467, -0.010485, 0.023648, 0.913743],
  middle1_basel_19: [-0.000822, -0.000057, 0.050366, 0.99873],
  middle1l_18: [-0.608621, -0.050982, 0.086193, 0.787116],
  middle2l_17: [-0.537196, -0.05139, 0.003396, 0.841884],
  middle3l_16: [-0.522601, 0.019554, 0.014463, 0.85223],
  pinky1_basel_24: [-0.019668, -0.002093, 0.167443, 0.985683],
  pinky1l_23: [-0.641337, 0.03447, -0.069988, 0.763283],
  pinky2l_22: [-0.727638, 0.037826, -0.00932, 0.684855],
  pinky3l_21: [-0.608115, 0.000359, 0.009541, 0.793792],
  ring1_basel_29: [-0.01099, -0.001188, 0.098642, 0.995062],
  ring1l_28: [-0.625778, -0.029171, 0.044633, 0.778176],
  ring2l_27: [-0.59969, 0.021518, -0.037797, 0.79905],
  ring3l_26: [-0.535641, -0.087896, 0.035039, 0.839128],
  thumb1l_33: [-0.212414, 0.704286, 0.0272, 0.676847],
  thumb2l_32: [-0.595948, 0.142904, -0.101128, 0.783707],
  thumb3l_31: [-0.229762, -0.027218, 0.015287, 0.972746],
  index1_baser_45: [-0.007701, 0.000452, 0.008727, 0.999932],
  index1r_44: [-0.619402, 0.063495, -0.114887, 0.774022],
  index2r_43: [-0.465442, 0.064476, -0.017226, 0.882559],
  index3r_42: [-0.437192, 0.011302, -0.023268, 0.898996],
  middle1_baser_50: [-0.000824, 0.000058, -0.050366, 0.99873],
  middle1r_49: [-0.647199, 0.055224, -0.083539, 0.755715],
  middle2r_48: [-0.572484, 0.051494, -0.001208, 0.818297],
  middle3r_47: [-0.552098, -0.019043, -0.01514, 0.833424],
  pinky1_baser_55: [-0.019669, 0.002093, -0.167444, 0.985683],
  pinky1r_54: [-0.678691, -0.037915, 0.068184, 0.730268],
  pinky2r_53: [-0.756066, -0.038206, 0.007691, 0.653334],
  pinky3r_52: [-0.635526, -0.000016, -0.00954, 0.77202],
  ring1_baser_60: [-0.010991, 0.001188, -0.098642, 0.995062],
  ring1r_59: [-0.663887, 0.031363, -0.043122, 0.745929],
  ring2r_58: [-0.633102, -0.023099, 0.036853, 0.772845],
  ring3r_57: [-0.564673, 0.089065, -0.031944, 0.819873],
  thumb1r_64: [-0.229268, -0.703386, -0.044795, 0.671325],
  thumb2r_63: [-0.612466, -0.145017, 0.098069, 0.770868],
  thumb3r_62: [-0.24675, 0.027479, -0.014813, 0.968576],
};

/** Bones the solve DROVE — these get an authored rotation. */
export const POSED_BONES = Object.keys(POSE_DATA.fold.bones);

/** Finger bones — driven by interpolating bind rest -> FIST by `curl`. */
export const FINGER_BONES = Object.keys(FIST_DATA);

/** Bones the solve assumed were at bind rest. Without forcing these, the
    mixer's twist tracks fight the authored pose and the wrist skews. */
export const REST_BONES = [
  "arm_twistl_8",
  "forearm_twistl_9",
  "arm_twistr_39",
  "forearm_twistr_40",
];

/** Match GLTFLoader's node-name mangling so lookups work either way. */
export function sanitizeBoneName(name: string) {
  return name.replace(/[[\]./:]/g, "");
}

/** Pre-built quaternions — module level so the frame loop allocates nothing. */
export const ARM_POSES: Record<
  ArmPoseName,
  { curl: number; bones: Map<string, THREE.Quaternion> }
> = {
  rest: { curl: POSE_DATA.rest.curl, bones: new Map() },
  fold: { curl: POSE_DATA.fold.curl, bones: new Map() },
  guard: { curl: POSE_DATA.guard.curl, bones: new Map() },
  chamber: { curl: POSE_DATA.chamber.curl, bones: new Map() },
  punch: { curl: POSE_DATA.punch.curl, bones: new Map() },
};
for (const [pose, spec] of Object.entries(POSE_DATA)) {
  for (const [bone, q] of Object.entries(spec.bones)) {
    ARM_POSES[pose as ArmPoseName].bones.set(
      bone,
      new THREE.Quaternion(q[0], q[1], q[2], q[3])
    );
  }
}

export const FIST_FINGERS = new Map<string, THREE.Quaternion>();
for (const [bone, q] of Object.entries(FIST_DATA)) {
  FIST_FINGERS.set(bone, new THREE.Quaternion(q[0], q[1], q[2], q[3]));
}
