/**
 * Load a REAL rigged character from a .glb — e.g. the `Mannequin_F.glb` that
 * ships inside Universal Animation Library 2 under `Female Mannequin/Unreal-Godot/`.
 *
 * Prefer this over the procedural box-man when the pack gives you a model:
 * the mannequin is rigged with the exact same skeleton the animations were
 * authored against, so retargeting is a perfect 1:1 name match with no
 * proportion or rest-pose mismatch at all.
 *
 * The returned object is shaped like `ProceduralCharacter`, so `CharacterController`
 * and every retargeting helper work with it unchanged.
 */

import type { Scene } from '@babylonjs/core/scene';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { Bone } from '@babylonjs/core/Bones/bone';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { slotForBoneName, type HumanoidSlot } from './humanoidRig';
import type { AnimatableCharacter } from './types';

import '@babylonjs/loaders/glTF/2.0';

export interface RiggedCharacter extends AnimatableCharacter {
  root: TransformNode;
  skeleton: Skeleton;
  /** Every mesh that came with the model. */
  meshes: AbstractMesh[];
  /** Semantic slot → bone, for the bones we could identify. */
  bones: Map<HumanoidSlot, Bone>;
  /** Semantic slot → the TransformNode that drives it. */
  nodes: Map<HumanoidSlot, TransformNode>;
  dispose(): void;
}

export interface LoadRiggedOptions {
  /** Uniform scale applied to the root. */
  scale?: number;
  name?: string;
}

/**
 * Load a rigged character model and index its skeleton by semantic slot.
 *
 * @throws if the file contains no skeleton (i.e. it's a static prop, not a
 *         rigged character).
 */
export async function loadRiggedCharacter(
  scene: Scene,
  url: string,
  options: LoadRiggedOptions = {},
): Promise<RiggedCharacter> {
  const name = options.name ?? 'character';
  const container = await LoadAssetContainerAsync(url, scene);

  const skeleton = container.skeletons[0];
  if (!skeleton) {
    container.dispose();
    throw new Error(
      `"${url}" contains no skeleton — it is a static mesh, not a rigged character. ` +
        `Check you loaded the model file (e.g. Mannequin_F.glb) and not an animation file.`,
    );
  }

  // Keep the model in the scene. Its own animation groups (if any) are
  // discarded: this model is a puppet, clips come from the library.
  container.addAllToScene();
  for (const group of container.animationGroups) group.dispose();

  const root = new TransformNode(`${name}_root`, scene);
  const scale = options.scale ?? 1;
  root.scaling = new Vector3(scale, scale, scale);

  // Re-parent the model's top-level nodes under our own root so callers get a
  // single handle for positioning the character.
  for (const node of container.rootNodes) {
    if (node === root) continue;
    if (!node.parent) node.parent = root;
  }

  const bones = new Map<HumanoidSlot, Bone>();
  const nodes = new Map<HumanoidSlot, TransformNode>();
  for (const bone of skeleton.bones) {
    const slot = slotForBoneName(bone.name);
    if (!slot || bones.has(slot)) continue;
    bones.set(slot, bone);
    const node = bone.getTransformNode();
    if (node) nodes.set(slot, node);
  }

  return {
    root,
    skeleton,
    meshes: container.meshes,
    bones,
    nodes,
    dispose() {
      container.dispose();
      root.dispose();
    },
  };
}

/**
 * How completely a loaded rig maps onto the humanoid slots.
 * Useful as a sanity check before you rely on retargeting.
 */
export function describeRig(character: AnimatableCharacter): {
  boneCount: number;
  mappedSlots: HumanoidSlot[];
  unmappedBones: string[];
} {
  const mapped = new Set<HumanoidSlot>();
  const unmapped: string[] = [];
  for (const bone of character.skeleton.bones) {
    const slot = slotForBoneName(bone.name);
    if (slot) mapped.add(slot);
    else unmapped.push(bone.name);
  }
  return {
    boneCount: character.skeleton.bones.length,
    mappedSlots: [...mapped],
    unmappedBones: unmapped,
  };
}
