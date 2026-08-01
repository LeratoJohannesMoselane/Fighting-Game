/**
 * The minimum a character must provide to be driven by retargeted animations.
 *
 * Both `createProceduralCharacter()` (box-man built in code) and
 * `loadRiggedCharacter()` (a real .glb model such as the pack's
 * `Mannequin_F.glb`) satisfy this, so `CharacterController` works with either.
 */

import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export interface AnimatableCharacter {
  /** Single handle for positioning/scaling the whole character. */
  root: TransformNode;
  /** The rig that retargeted animation groups will drive. */
  skeleton: Skeleton;
  dispose(): void;
}
