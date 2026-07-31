/**
 * @aether-break/babylon-humanoid
 *
 * Procedural humanoid characters + Quaternius .glb animation retargeting for
 * Babylon.js. No Blender, no custom model files — the character is built from
 * primitives in code and driven by downloaded .glb animation clips.
 */

export {
  HUMANOID_ORDER,
  HUMANOID_PARENTS,
  SLOT_ALIASES,
  MIXAMO_SCHEME,
  UNITY_SCHEME,
  UNREAL_SCHEME,
  BLENDER_SCHEME,
  KNOWN_SCHEMES,
  normalizeBoneName,
  slotForBoneName,
  scoreScheme,
  detectScheme,
} from './humanoidRig';
export type { HumanoidSlot, NamingScheme } from './humanoidRig';

export { createProceduralCharacter, REST_OFFSETS } from './proceduralCharacter';
export type { ProceduralCharacter, BuildOptions } from './proceduralCharacter';

export { retargetAnimationGroup, stripRootMotion, crossFade } from './retarget';
export type { RetargetReport, RetargetResult } from './retarget';

export {
  loadAndRetargetClip,
  loadAnimationLibrary,
  inspectGlb,
  printGlbBoneNames,
} from './animationLibrary';
export type { LoadedClip, LoadClipOptions } from './animationLibrary';

export { CharacterController } from './characterController';
export type { ClipSpec } from './characterController';
