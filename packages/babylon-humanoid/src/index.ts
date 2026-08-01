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
export { loadRiggedCharacter, describeRig } from './riggedCharacter';
export type { RiggedCharacter, LoadRiggedOptions } from './riggedCharacter';
export type { AnimatableCharacter } from './types';
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

export { createFighterFactory } from './fighterRig';
export { createAetherRoster, placeFighters, AETHER_CHARACTERS } from './aetherRoster';
export type { AetherCharacter, AetherFighter, AetherRosterOptions, BodyType } from './aetherRoster';
export { attachToHead, HAIRSTYLES, EYEBROWS } from './hairAttachment';
export type { Hairstyle, Eyebrows, HeadAttachment, AttachOptions } from './hairAttachment';
export {
  createRoster,
  applyStyle,
  styleFor,
  rosterClips,
  AETHER_STYLES,
  NEUTRAL_STYLE,
} from './roster3d';
export type { CharacterStyle, StyledFighter } from './roster3d';
export type { FighterRig, FighterFactory, CreateFighterFactoryOptions } from './fighterRig';

export {
  UAL2_CLIPS,
  DEFAULT_CLIP_MAP,
  BRAWLER_CLIP_MAP,
  ZOMBIE_CLIP_MAP,
  resolveClip,
  renameFromClipMap,
  clipsUsedBy,
  aliasesFor,
} from './combatClipMap';
export type { Ual2Clip, FighterAnimKey, FighterSnapshot } from './combatClipMap';

export { CharacterController } from './characterController';
export type { ClipSpec } from './characterController';
