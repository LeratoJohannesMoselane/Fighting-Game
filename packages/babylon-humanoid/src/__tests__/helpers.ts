/**
 * Test helpers: build a stand-in "Quaternius" rig, animate it, and export it
 * to a real .glb so tests exercise the genuine glTF import path rather than
 * an in-memory shortcut.
 */

import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Animation } from '@babylonjs/core/Animations/animation';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { GLTF2Export } from '@babylonjs/serializers/glTF/2.0';

import {
  HUMANOID_ORDER,
  HUMANOID_PARENTS,
  type HumanoidSlot,
  type NamingScheme,
} from '../humanoidRig';
import { REST_OFFSETS } from '../proceduralCharacter';

export interface TestScene {
  engine: NullEngine;
  scene: Scene;
  dispose(): void;
}

/** Headless scene with the camera `scene.render()` requires. */
export function makeScene(): TestScene {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  new FreeCamera('cam', new Vector3(0, 1.6, -4), scene);
  return {
    engine,
    scene,
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}

export interface SourceGlbOptions {
  /** Which slots get rotation tracks. */
  animatedSlots?: HumanoidSlot[];
  /** Add a hips translation track (i.e. root motion). */
  rootMotion?: boolean;
  /** Extra non-humanoid bones (fingers, props) to test graceful dropping. */
  extraBones?: string[];
}

/**
 * Build a source rig in the given naming scheme, animate it, and export a real
 * .glb as a base64 data URL that Babylon's loader accepts.
 */
export async function buildSourceGlb(
  scheme: NamingScheme,
  options: SourceGlbOptions = {},
): Promise<string> {
  const animatedSlots = options.animatedSlots ?? ['LeftUpperArm', 'RightUpperArm', 'Spine', 'Head'];

  const engine = new NullEngine();
  const scene = new Scene(engine);

  const root = new TransformNode('SourceArmature', scene);
  const skeleton = new Skeleton('src', 'src', scene);
  const bones = new Map<HumanoidSlot, Bone>();
  const nodes = new Map<HumanoidSlot, TransformNode>();

  HUMANOID_ORDER.forEach((slot, i) => {
    const parentSlot = HUMANOID_PARENTS[slot];
    const off = REST_OFFSETS[slot];
    const bone = new Bone(
      scheme[slot],
      skeleton,
      parentSlot ? bones.get(parentSlot)! : null,
      Matrix.Translation(off.x, off.y, off.z),
      null,
      null,
      i,
    );
    bones.set(slot, bone);

    const node = new TransformNode(scheme[slot], scene);
    node.position.copyFrom(off);
    node.rotationQuaternion = Quaternion.Identity();
    node.parent = parentSlot ? nodes.get(parentSlot)! : root;
    nodes.set(slot, node);
    bone.linkTransformNode(node);
  });

  // Optional junk bones — real packs carry fingers/twists we don't rig.
  const extraNodes: TransformNode[] = [];
  for (const extra of options.extraBones ?? []) {
    const n = new TransformNode(extra, scene);
    n.rotationQuaternion = Quaternion.Identity();
    n.parent = nodes.get('LeftHand') ?? root;
    extraNodes.push(n);
  }

  // Minimal skinned mesh so the exporter emits a skin.
  const mesh = new Mesh('srcMesh', scene);
  const box = CreateBoxVertexData({ size: 0.2 });
  const vd = new VertexData();
  vd.positions = box.positions as number[];
  vd.normals = box.normals as number[];
  vd.indices = box.indices as number[];
  vd.applyToMesh(mesh, true);
  const count = (vd.positions as number[]).length / 3;
  mesh.setVerticesData(VertexBuffer.MatricesIndicesKind, new Array(count * 4).fill(0), false, 4);
  mesh.setVerticesData(
    VertexBuffer.MatricesWeightsKind,
    Array.from({ length: count * 4 }, (_, k) => (k % 4 === 0 ? 1 : 0)),
    false,
    4,
  );
  mesh.skeleton = skeleton;
  mesh.parent = root;

  const group = new AnimationGroup('TEST_CLIP', scene);
  for (const slot of animatedSlots) {
    const anim = new Animation(
      `rot_${slot}`,
      'rotationQuaternion',
      30,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    anim.setKeys([
      { frame: 0, value: Quaternion.Identity() },
      { frame: 15, value: Quaternion.RotationAxis(Vector3.Forward(), 0.6) },
      { frame: 30, value: Quaternion.Identity() },
    ]);
    group.addTargetedAnimation(anim, nodes.get(slot)!);
  }

  for (const extra of extraNodes) {
    const anim = new Animation(
      `rot_${extra.name}`,
      'rotationQuaternion',
      30,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    anim.setKeys([
      { frame: 0, value: Quaternion.Identity() },
      { frame: 30, value: Quaternion.RotationAxis(Vector3.Up(), 0.4) },
    ]);
    group.addTargetedAnimation(anim, extra);
  }

  if (options.rootMotion) {
    const hipsPos = new Animation(
      'pos_Hips',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE,
    );
    const h = REST_OFFSETS.Hips;
    hipsPos.setKeys([
      { frame: 0, value: h.clone() },
      { frame: 30, value: new Vector3(h.x, h.y, h.z + 1) },
    ]);
    group.addTargetedAnimation(hipsPos, nodes.get('Hips')!);
  }

  group.normalize(0, 30);

  const exported = await GLTF2Export.GLBAsync(scene, 'source');
  const blob = exported.glTFFiles['source.glb'] as Blob;
  const buf = Buffer.from(await blob.arrayBuffer());

  scene.dispose();
  engine.dispose();
  return 'data:base64,' + buf.toString('base64');
}
