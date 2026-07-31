/**
 * Procedural Asset System public API.
 *
 * Replace path for final art:
 * 1. Keep bone IDs + attach point IDs from `types.ts` / `mesh.ts`
 * 2. Swap `ProceduralFighterMesh.draw` for Babylon glTF skinning
 * 3. Swap `animation.ts` poses for clip playback driven by same frame events
 * 4. Swap `vfx.ts` for textured GPU particles
 * 5. Swap `audio.ts` for decoded audio buffers
 *
 * CombatCore JSON + events stay the authority.
 */

export { ProceduralAssetSystem, proceduralAssets } from './system';
export { ProceduralFighterMesh } from './mesh';
export { ProceduralVfx } from './vfx';
export { ProceduralAudio, proceduralAudio } from './audio';
export {
  getVisualProfile,
  ALL_PROFILES,
  NYRA_PROFILE,
  BRAM_PROFILE,
  IRIA_PROFILE,
} from './profiles';
export { resolveFighterAnimation, attackPose, idlePose } from './animation';
export type {
  FighterVisualProfile,
  BoneId,
  PoseMap,
  VfxRequest,
  SfxKind,
  AttachPoint,
} from './types';
