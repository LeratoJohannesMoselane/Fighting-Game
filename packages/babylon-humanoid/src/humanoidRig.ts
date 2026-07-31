/**
 * Universal humanoid rig definition.
 *
 * IMPORTANT — read this before trusting any bone name in this file.
 *
 * There is no single "universal" bone naming standard. The three schemes you
 * will actually meet in the wild are:
 *
 *   Mixamo   : "mixamorig:Hips",  "mixamorig:LeftArm",   "mixamorig:LeftUpLeg"
 *   Unity    : "Hips",            "LeftUpperArm",        "LeftUpperLeg"
 *   Unreal   : "pelvis",          "upperarm_l",          "thigh_l"
 *
 * Quaternius' "universal" rig is universal in the sense that it was authored
 * to retarget cleanly in Unity/Unreal/Godot — NOT in the sense that it uses
 * one fixed naming scheme. So instead of hardcoding a guess, this module:
 *
 *   1. defines the rig by SEMANTIC SLOT (Hips, Spine, LeftUpperArm, ...),
 *   2. ships several naming schemes,
 *   3. and lets you auto-detect the right one from the .glb at runtime.
 *
 * Run `printGlbBoneNames()` (see inspectGlb.ts) ONCE on your downloaded file
 * and you will know exactly which scheme the pack uses.
 */

/** Semantic bone slots of a minimal-but-complete humanoid rig. */
export type HumanoidSlot =
  | 'Hips'
  | 'Spine'
  | 'Chest'
  | 'UpperChest'
  | 'Neck'
  | 'Head'
  | 'LeftShoulder'
  | 'LeftUpperArm'
  | 'LeftLowerArm'
  | 'LeftHand'
  | 'RightShoulder'
  | 'RightUpperArm'
  | 'RightLowerArm'
  | 'RightHand'
  | 'LeftUpperLeg'
  | 'LeftLowerLeg'
  | 'LeftFoot'
  | 'LeftToes'
  | 'RightUpperLeg'
  | 'RightLowerLeg'
  | 'RightFoot'
  | 'RightToes';

/**
 * Parent of each slot. This hierarchy is the part that genuinely IS universal:
 * every humanoid retargeting system (Unity Humanoid, Godot SkeletonProfile,
 * Unreal IK Rig) expects these chains:
 *
 *   Hips → Spine → Chest → Neck → Head
 *   Chest → Shoulder → UpperArm → LowerArm → Hand
 *   Hips → UpperLeg → LowerLeg → Foot → Toes
 */
export const HUMANOID_PARENTS: Record<HumanoidSlot, HumanoidSlot | null> = {
  Hips: null,
  Spine: 'Hips',
  Chest: 'Spine',
  UpperChest: 'Chest',
  Neck: 'UpperChest',
  Head: 'Neck',

  LeftShoulder: 'UpperChest',
  LeftUpperArm: 'LeftShoulder',
  LeftLowerArm: 'LeftUpperArm',
  LeftHand: 'LeftLowerArm',

  RightShoulder: 'UpperChest',
  RightUpperArm: 'RightShoulder',
  RightLowerArm: 'RightUpperArm',
  RightHand: 'RightLowerArm',

  LeftUpperLeg: 'Hips',
  LeftLowerLeg: 'LeftUpperLeg',
  LeftFoot: 'LeftLowerLeg',
  LeftToes: 'LeftFoot',

  RightUpperLeg: 'Hips',
  RightLowerLeg: 'RightUpperLeg',
  RightFoot: 'RightLowerLeg',
  RightToes: 'RightFoot',
};

/** Slot order guarantees parents are always created before children. */
export const HUMANOID_ORDER: HumanoidSlot[] = [
  'Hips',
  'Spine',
  'Chest',
  'UpperChest',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightShoulder',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'LeftToes',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot',
  'RightToes',
];

/** A naming scheme maps each semantic slot to a concrete bone name. */
export type NamingScheme = Record<HumanoidSlot, string>;

/** Mixamo — the "mixamorig:" prefix is the giveaway. */
export const MIXAMO_SCHEME: NamingScheme = {
  Hips: 'mixamorig:Hips',
  Spine: 'mixamorig:Spine',
  Chest: 'mixamorig:Spine1',
  UpperChest: 'mixamorig:Spine2',
  Neck: 'mixamorig:Neck',
  Head: 'mixamorig:Head',
  LeftShoulder: 'mixamorig:LeftShoulder',
  LeftUpperArm: 'mixamorig:LeftArm',
  LeftLowerArm: 'mixamorig:LeftForeArm',
  LeftHand: 'mixamorig:LeftHand',
  RightShoulder: 'mixamorig:RightShoulder',
  RightUpperArm: 'mixamorig:RightArm',
  RightLowerArm: 'mixamorig:RightForeArm',
  RightHand: 'mixamorig:RightHand',
  LeftUpperLeg: 'mixamorig:LeftUpLeg',
  LeftLowerLeg: 'mixamorig:LeftLeg',
  LeftFoot: 'mixamorig:LeftFoot',
  LeftToes: 'mixamorig:LeftToeBase',
  RightUpperLeg: 'mixamorig:RightUpLeg',
  RightLowerLeg: 'mixamorig:RightLeg',
  RightFoot: 'mixamorig:RightFoot',
  RightToes: 'mixamorig:RightToeBase',
};

/** Unity Humanoid / Godot SkeletonProfileHumanoid style. */
export const UNITY_SCHEME: NamingScheme = {
  Hips: 'Hips',
  Spine: 'Spine',
  Chest: 'Chest',
  UpperChest: 'UpperChest',
  Neck: 'Neck',
  Head: 'Head',
  LeftShoulder: 'LeftShoulder',
  LeftUpperArm: 'LeftUpperArm',
  LeftLowerArm: 'LeftLowerArm',
  LeftHand: 'LeftHand',
  RightShoulder: 'RightShoulder',
  RightUpperArm: 'RightUpperArm',
  RightLowerArm: 'RightLowerArm',
  RightHand: 'RightHand',
  LeftUpperLeg: 'LeftUpperLeg',
  LeftLowerLeg: 'LeftLowerLeg',
  LeftFoot: 'LeftFoot',
  LeftToes: 'LeftToes',
  RightUpperLeg: 'RightUpperLeg',
  RightLowerLeg: 'RightLowerLeg',
  RightFoot: 'RightFoot',
  RightToes: 'RightToes',
};

/** Unreal Engine mannequin style (lowercase, _l/_r suffix). */
export const UNREAL_SCHEME: NamingScheme = {
  Hips: 'pelvis',
  Spine: 'spine_01',
  Chest: 'spine_02',
  UpperChest: 'spine_03',
  Neck: 'neck_01',
  Head: 'head',
  LeftShoulder: 'clavicle_l',
  LeftUpperArm: 'upperarm_l',
  LeftLowerArm: 'lowerarm_l',
  LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r',
  RightUpperArm: 'upperarm_r',
  RightLowerArm: 'lowerarm_r',
  RightHand: 'hand_r',
  LeftUpperLeg: 'thigh_l',
  LeftLowerLeg: 'calf_l',
  LeftFoot: 'foot_l',
  LeftToes: 'ball_l',
  RightUpperLeg: 'thigh_r',
  RightLowerLeg: 'calf_r',
  RightFoot: 'foot_r',
  RightToes: 'ball_r',
};

/** Blender/Rigify-ish `.L`/`.R` suffix style — common in .blend-derived GLBs. */
export const BLENDER_SCHEME: NamingScheme = {
  Hips: 'hips',
  Spine: 'spine',
  Chest: 'chest',
  UpperChest: 'upper_chest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'shoulder.L',
  LeftUpperArm: 'upper_arm.L',
  LeftLowerArm: 'forearm.L',
  LeftHand: 'hand.L',
  RightShoulder: 'shoulder.R',
  RightUpperArm: 'upper_arm.R',
  RightLowerArm: 'forearm.R',
  RightHand: 'hand.R',
  LeftUpperLeg: 'thigh.L',
  LeftLowerLeg: 'shin.L',
  LeftFoot: 'foot.L',
  LeftToes: 'toe.L',
  RightUpperLeg: 'thigh.R',
  RightLowerLeg: 'shin.R',
  RightFoot: 'foot.R',
  RightToes: 'toe.R',
};

export const KNOWN_SCHEMES: { name: string; scheme: NamingScheme }[] = [
  { name: 'mixamo', scheme: MIXAMO_SCHEME },
  { name: 'unity', scheme: UNITY_SCHEME },
  { name: 'unreal', scheme: UNREAL_SCHEME },
  { name: 'blender', scheme: BLENDER_SCHEME },
];

/** Normalise a bone name for fuzzy comparison: lowercase, strip punctuation. */
export function normalizeBoneName(raw: string): string {
  return raw
    .replace(/^.*:/, '') // strip "mixamorig:" style namespace
    .replace(/[\s._-]/g, '')
    .toLowerCase();
}

/**
 * Alternate spellings accepted for each semantic slot.
 *
 * This is what lets a Mixamo clip drive a Unity-named rig without a hand
 * written map: Mixamo calls the upper arm "LeftArm" while Unity calls it
 * "LeftUpperArm", so stripping the namespace alone is NOT enough.
 */
export const SLOT_ALIASES: Record<HumanoidSlot, string[]> = {
  Hips: ['hips', 'pelvis', 'bip01pelvis'],
  Spine: ['spine', 'spine01', 'spine1'],
  Chest: ['chest', 'spine02', 'spine2'],
  UpperChest: ['upperchest', 'spine03', 'spine3'],
  Neck: ['neck', 'neck01'],
  Head: ['head'],

  LeftShoulder: ['leftshoulder', 'shoulderl', 'claviclel', 'lshoulder'],
  LeftUpperArm: ['leftupperarm', 'leftarm', 'upperarml', 'arml'],
  LeftLowerArm: ['leftlowerarm', 'leftforearm', 'lowerarml', 'forearml'],
  LeftHand: ['lefthand', 'handl'],

  RightShoulder: ['rightshoulder', 'shoulderr', 'clavicler', 'rshoulder'],
  RightUpperArm: ['rightupperarm', 'rightarm', 'upperarmr', 'armr'],
  RightLowerArm: ['rightlowerarm', 'rightforearm', 'lowerarmr', 'forearmr'],
  RightHand: ['righthand', 'handr'],

  LeftUpperLeg: ['leftupperleg', 'leftupleg', 'thighl', 'upperlegl'],
  LeftLowerLeg: ['leftlowerleg', 'leftleg', 'calfl', 'shinl', 'lowerlegl'],
  LeftFoot: ['leftfoot', 'footl'],
  LeftToes: ['lefttoes', 'lefttoebase', 'balll', 'toel', 'toebasel'],

  RightUpperLeg: ['rightupperleg', 'rightupleg', 'thighr', 'upperlegr'],
  RightLowerLeg: ['rightlowerleg', 'rightleg', 'calfr', 'shinr', 'lowerlegr'],
  RightFoot: ['rightfoot', 'footr'],
  RightToes: ['righttoes', 'righttoebase', 'ballr', 'toer', 'toebaser'],
};

/** Reverse index: normalised alias → semantic slot. Built once. */
const ALIAS_TO_SLOT: Map<string, HumanoidSlot> = (() => {
  const m = new Map<string, HumanoidSlot>();
  for (const slot of HUMANOID_ORDER) {
    m.set(normalizeBoneName(slot), slot);
    for (const alias of SLOT_ALIASES[slot]) {
      const key = normalizeBoneName(alias);
      if (!m.has(key)) m.set(key, slot);
    }
  }
  return m;
})();

/**
 * Resolve an arbitrary bone name to a semantic slot.
 * Returns null when the bone isn't part of the core humanoid rig
 * (fingers, twist bones, IK helpers, props...).
 */
export function slotForBoneName(raw: string): HumanoidSlot | null {
  return ALIAS_TO_SLOT.get(normalizeBoneName(raw)) ?? null;
}

/**
 * Score how well a naming scheme matches a list of real bone names.
 * Returns the number of slots that were found.
 */
export function scoreScheme(scheme: NamingScheme, boneNames: string[]): number {
  const have = new Set(boneNames.map(normalizeBoneName));
  let score = 0;
  for (const slot of HUMANOID_ORDER) {
    if (have.has(normalizeBoneName(scheme[slot]))) score += 1;
  }
  return score;
}

/**
 * Pick the best-fitting known scheme for a real skeleton, then repair it:
 * any slot whose canonical name is missing is re-pointed at the actual bone
 * name found in the file (matched fuzzily). Slots with no match are dropped.
 *
 * This is what makes the pipeline robust to a pack that uses, say, Unity names
 * for the body but "Toe_L" instead of "LeftToes".
 */
export function detectScheme(boneNames: string[]): {
  schemeName: string;
  scheme: Partial<NamingScheme>;
  matched: HumanoidSlot[];
  missing: HumanoidSlot[];
} {
  let best = KNOWN_SCHEMES[0]!;
  let bestScore = -1;
  for (const candidate of KNOWN_SCHEMES) {
    const s = scoreScheme(candidate.scheme, boneNames);
    if (s > bestScore) {
      bestScore = s;
      best = candidate;
    }
  }

  // Index the real names by their normalised form for repair lookups.
  const byNormalized = new Map<string, string>();
  for (const raw of boneNames) {
    const key = normalizeBoneName(raw);
    if (!byNormalized.has(key)) byNormalized.set(key, raw);
  }

  const scheme: Partial<NamingScheme> = {};
  const matched: HumanoidSlot[] = [];
  const missing: HumanoidSlot[] = [];

  for (const slot of HUMANOID_ORDER) {
    const canonical = normalizeBoneName(best.scheme[slot]);
    let found = byNormalized.get(canonical);

    if (!found) {
      for (const alias of SLOT_ALIASES[slot]) {
        found = byNormalized.get(normalizeBoneName(alias));
        if (found) break;
      }
    }

    if (found) {
      scheme[slot] = found;
      matched.push(slot);
    } else {
      missing.push(slot);
    }
  }

  return { schemeName: best.name, scheme, matched, missing };
}
