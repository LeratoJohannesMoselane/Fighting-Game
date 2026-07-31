/**
 * Procedural humanoid: a skinned mesh + skeleton built entirely in code.
 *
 * Two things make this work with imported .glb animations:
 *
 *  1. BONE NAMES match the animation's rig (see humanoidRig.ts).
 *  2. Every bone is backed by a TransformNode via `bone.linkTransformNode()`.
 *     This is essential: in glTF, animation tracks target NODES, not bones.
 *     Babylon's glTF loader animates the TransformNode, and the linked bone
 *     follows. Without the link there is nothing for the animation to drive.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';

import {
  HUMANOID_ORDER,
  HUMANOID_PARENTS,
  UNITY_SCHEME,
  type HumanoidSlot,
  type NamingScheme,
} from './humanoidRig';

/**
 * Rest-pose offsets, in metres, each RELATIVE TO ITS PARENT bone.
 * Y is up. Character is ~1.75 m tall and stands in a T-pose, which is what
 * humanoid animation libraries expect as the bind pose.
 */
export const REST_OFFSETS: Record<HumanoidSlot, Vector3> = {
  Hips: new Vector3(0, 0.95, 0),
  Spine: new Vector3(0, 0.12, 0),
  Chest: new Vector3(0, 0.13, 0),
  UpperChest: new Vector3(0, 0.13, 0),
  Neck: new Vector3(0, 0.14, 0),
  Head: new Vector3(0, 0.09, 0),

  // Arms extend along +/-X for a T-pose.
  LeftShoulder: new Vector3(0.05, 0.1, 0),
  LeftUpperArm: new Vector3(0.13, 0, 0),
  LeftLowerArm: new Vector3(0.27, 0, 0),
  LeftHand: new Vector3(0.25, 0, 0),

  RightShoulder: new Vector3(-0.05, 0.1, 0),
  RightUpperArm: new Vector3(-0.13, 0, 0),
  RightLowerArm: new Vector3(-0.27, 0, 0),
  RightHand: new Vector3(-0.25, 0, 0),

  LeftUpperLeg: new Vector3(0.09, -0.06, 0),
  LeftLowerLeg: new Vector3(0, -0.42, 0),
  LeftFoot: new Vector3(0, -0.4, 0),
  LeftToes: new Vector3(0, -0.07, 0.12),

  RightUpperLeg: new Vector3(-0.09, -0.06, 0),
  RightLowerLeg: new Vector3(0, -0.42, 0),
  RightFoot: new Vector3(0, -0.4, 0),
  RightToes: new Vector3(0, -0.07, 0.12),
};

export interface ProceduralCharacter {
  root: TransformNode;
  mesh: Mesh;
  skeleton: Skeleton;
  /** Semantic slot → the Bone that implements it. */
  bones: Map<HumanoidSlot, Bone>;
  /** Semantic slot → the TransformNode that drives that bone. */
  nodes: Map<HumanoidSlot, TransformNode>;
  /** Concrete bone name actually used, per slot. */
  boneNames: Map<HumanoidSlot, string>;
  dispose(): void;
}

export interface BuildOptions {
  /** Bone naming scheme. MUST match your .glb — detect it, don't guess. */
  scheme?: NamingScheme;
  /** Uniform scale applied to the root (1 = ~1.75 m tall). */
  scale?: number;
  name?: string;
}

/** One limb/body segment of the procedural body. */
interface SegmentSpec {
  /** Bone that owns 100% of this segment's vertices (rigid binding). */
  slot: HumanoidSlot;
  shape: 'box' | 'sphere' | 'cylinder';
  size: Vector3;
  /** Offset from the bone's origin, in bone-local space. */
  offset: Vector3;
}

/**
 * Body plan. Each piece is bound rigidly to a single bone, which is exactly
 * what you want for a blocky prototype character: crisp, readable joints and
 * no weight painting.
 */
function bodyPlan(): SegmentSpec[] {
  return [
    {
      slot: 'Hips',
      shape: 'box',
      size: new Vector3(0.28, 0.16, 0.19),
      offset: new Vector3(0, 0.02, 0),
    },
    {
      slot: 'Spine',
      shape: 'box',
      size: new Vector3(0.3, 0.14, 0.2),
      offset: new Vector3(0, 0.06, 0),
    },
    {
      slot: 'Chest',
      shape: 'box',
      size: new Vector3(0.34, 0.16, 0.22),
      offset: new Vector3(0, 0.07, 0),
    },
    {
      slot: 'UpperChest',
      shape: 'box',
      size: new Vector3(0.36, 0.14, 0.22),
      offset: new Vector3(0, 0.06, 0),
    },
    {
      slot: 'Neck',
      shape: 'cylinder',
      size: new Vector3(0.07, 0.09, 0.07),
      offset: new Vector3(0, 0.04, 0),
    },
    {
      slot: 'Head',
      shape: 'sphere',
      size: new Vector3(0.21, 0.24, 0.22),
      offset: new Vector3(0, 0.11, 0.01),
    },

    {
      slot: 'LeftUpperArm',
      shape: 'box',
      size: new Vector3(0.26, 0.1, 0.1),
      offset: new Vector3(0.13, 0, 0),
    },
    {
      slot: 'LeftLowerArm',
      shape: 'box',
      size: new Vector3(0.24, 0.085, 0.085),
      offset: new Vector3(0.12, 0, 0),
    },
    {
      slot: 'LeftHand',
      shape: 'box',
      size: new Vector3(0.11, 0.09, 0.05),
      offset: new Vector3(0.06, 0, 0),
    },

    {
      slot: 'RightUpperArm',
      shape: 'box',
      size: new Vector3(0.26, 0.1, 0.1),
      offset: new Vector3(-0.13, 0, 0),
    },
    {
      slot: 'RightLowerArm',
      shape: 'box',
      size: new Vector3(0.24, 0.085, 0.085),
      offset: new Vector3(-0.12, 0, 0),
    },
    {
      slot: 'RightHand',
      shape: 'box',
      size: new Vector3(0.11, 0.09, 0.05),
      offset: new Vector3(-0.06, 0, 0),
    },

    {
      slot: 'LeftUpperLeg',
      shape: 'box',
      size: new Vector3(0.13, 0.4, 0.13),
      offset: new Vector3(0, -0.2, 0),
    },
    {
      slot: 'LeftLowerLeg',
      shape: 'box',
      size: new Vector3(0.11, 0.38, 0.11),
      offset: new Vector3(0, -0.19, 0),
    },
    {
      slot: 'LeftFoot',
      shape: 'box',
      size: new Vector3(0.11, 0.07, 0.24),
      offset: new Vector3(0, -0.03, 0.06),
    },

    {
      slot: 'RightUpperLeg',
      shape: 'box',
      size: new Vector3(0.13, 0.4, 0.13),
      offset: new Vector3(0, -0.2, 0),
    },
    {
      slot: 'RightLowerLeg',
      shape: 'box',
      size: new Vector3(0.11, 0.38, 0.11),
      offset: new Vector3(0, -0.19, 0),
    },
    {
      slot: 'RightFoot',
      shape: 'box',
      size: new Vector3(0.11, 0.07, 0.24),
      offset: new Vector3(0, -0.03, 0.06),
    },
  ];
}

function segmentVertexData(spec: SegmentSpec): VertexData {
  switch (spec.shape) {
    case 'sphere':
      return CreateSphereVertexData({
        diameterX: spec.size.x,
        diameterY: spec.size.y,
        diameterZ: spec.size.z,
        segments: 8,
      });
    case 'cylinder':
      return CreateCylinderVertexData({
        height: spec.size.y,
        diameterTop: spec.size.x,
        diameterBottom: spec.size.z,
        tessellation: 10,
      });
    case 'box':
    default:
      return CreateBoxVertexData({
        width: spec.size.x,
        height: spec.size.y,
        depth: spec.size.z,
      });
  }
}

/**
 * Build the character. Returns a fully skinned mesh whose skeleton is ready to
 * receive imported humanoid animations.
 */
export function createProceduralCharacter(
  scene: Scene,
  options: BuildOptions = {},
): ProceduralCharacter {
  const scheme = options.scheme ?? UNITY_SCHEME;
  const name = options.name ?? 'hero';
  const scale = options.scale ?? 1;

  const root = new TransformNode(`${name}_root`, scene);
  root.scaling = new Vector3(scale, scale, scale);

  const skeleton = new Skeleton(`${name}_skeleton`, `${name}_skeleton`, scene);

  const bones = new Map<HumanoidSlot, Bone>();
  const nodes = new Map<HumanoidSlot, TransformNode>();
  const boneNames = new Map<HumanoidSlot, string>();
  /** Bone index per slot, needed when writing skinning indices. */
  const boneIndex = new Map<HumanoidSlot, number>();

  // --- 1. Bones + their driving TransformNodes -------------------------
  HUMANOID_ORDER.forEach((slot, i) => {
    const parentSlot = HUMANOID_PARENTS[slot];
    const parentBone = parentSlot ? (bones.get(parentSlot) ?? null) : null;
    const offset = REST_OFFSETS[slot];

    // Local matrix = translation from the parent bone. No rotation: the rest
    // pose is a clean T-pose, which keeps retargeting predictable.
    const local = Matrix.Translation(offset.x, offset.y, offset.z);

    const boneName = scheme[slot];
    const bone = new Bone(boneName, skeleton, parentBone, local, null, null, i);
    bones.set(slot, bone);
    boneNames.set(slot, boneName);
    boneIndex.set(slot, i);

    // The TransformNode is what glTF animations actually target.
    const node = new TransformNode(boneName, scene);
    node.rotationQuaternion = Quaternion.Identity();
    node.position.copyFrom(offset);
    node.parent = parentSlot ? (nodes.get(parentSlot) ?? root) : root;
    nodes.set(slot, node);

    bone.linkTransformNode(node);
  });

  // --- 2. Skinned mesh --------------------------------------------------
  // Each segment is baked into one merged VertexData, with every vertex
  // weighted 100% to its owning bone.
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const matricesIndices: number[] = [];
  const matricesWeights: number[] = [];

  /** Absolute (model-space) rest transform of a bone. */
  const restWorld = (slot: HumanoidSlot): Matrix => {
    let m = Matrix.Identity();
    let cur: HumanoidSlot | null = slot;
    while (cur) {
      const o = REST_OFFSETS[cur];
      m = m.multiply(Matrix.Translation(o.x, o.y, o.z));
      cur = HUMANOID_PARENTS[cur];
    }
    return m;
  };

  for (const spec of bodyPlan()) {
    const idx = boneIndex.get(spec.slot);
    if (idx === undefined) continue;

    const data = segmentVertexData(spec);
    const segPos = data.positions as number[] | null;
    const segNorm = data.normals as number[] | null;
    const segIdx = data.indices as number[] | null;
    const segUv = data.uvs as number[] | null;
    if (!segPos || !segIdx) continue;

    // Place the segment at its bone's rest position, in model space.
    const place = Matrix.Translation(spec.offset.x, spec.offset.y, spec.offset.z).multiply(
      restWorld(spec.slot),
    );

    const vertexStart = positions.length / 3;
    const tmp = new Vector3();

    for (let v = 0; v < segPos.length; v += 3) {
      tmp.copyFromFloats(segPos[v]!, segPos[v + 1]!, segPos[v + 2]!);
      const world = Vector3.TransformCoordinates(tmp, place);
      positions.push(world.x, world.y, world.z);

      if (segNorm) {
        tmp.copyFromFloats(segNorm[v]!, segNorm[v + 1]!, segNorm[v + 2]!);
        const n = Vector3.TransformNormal(tmp, place);
        normals.push(n.x, n.y, n.z);
      }

      // Rigid bind: full weight on the owning bone.
      matricesIndices.push(idx, 0, 0, 0);
      matricesWeights.push(1, 0, 0, 0);
    }

    if (segUv) uvs.push(...segUv);
    for (const i of segIdx) indices.push(i + vertexStart);
  }

  const mesh = new Mesh(`${name}_mesh`, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.indices = indices;
  if (uvs.length) vertexData.uvs = uvs;
  vertexData.applyToMesh(mesh, true);

  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, matricesIndices, false, 4);
  mesh.setVerticesData(VertexBuffer.MatricesWeightsKind, matricesWeights, false, 4);

  mesh.skeleton = skeleton;
  mesh.parent = root;

  // numBoneInfluencers=1 matches the rigid binding and is the cheapest path.
  mesh.numBoneInfluencers = 1;

  const material = new StandardMaterial(`${name}_mat`, scene);
  material.diffuseColor = new Color3(0.55, 0.62, 0.78);
  material.specularColor = new Color3(0.12, 0.12, 0.14);
  mesh.material = material;

  // Skeleton must know its rest pose so animations blend from a sane base.
  for (const bone of skeleton.bones) {
    bone.setBindMatrix(bone.getLocalMatrix().clone());
  }
  skeleton.returnToRest();

  return {
    root,
    mesh,
    skeleton,
    bones,
    nodes,
    boneNames,
    dispose() {
      mesh.dispose(false, true);
      skeleton.dispose();
      root.dispose();
    },
  };
}
