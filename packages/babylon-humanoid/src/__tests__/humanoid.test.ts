/**
 * Procedural character + .glb retargeting, verified against real GLB files
 * round-tripped through Babylon's serializer and glTF loader.
 *
 * The claim these tests defend: you can drive a code-built character with
 * downloaded .glb animations, with no Blender and no custom model file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/loaders/glTF/2.0';

import {
  HUMANOID_ORDER,
  MIXAMO_SCHEME,
  UNITY_SCHEME,
  UNREAL_SCHEME,
  detectScheme,
  slotForBoneName,
} from '../humanoidRig';
import { createProceduralCharacter } from '../proceduralCharacter';
import { loadRiggedCharacter, describeRig } from '../riggedCharacter';
import { retargetAnimationGroup, stripRootMotion } from '../retarget';
import { loadAndRetargetClip, loadAnimationLibrary, inspectGlb } from '../animationLibrary';
import { CharacterController } from '../characterController';
import {
  buildLibraryGlb,
  buildModelGlb,
  buildSourceGlb,
  makeScene,
  type TestScene,
} from './helpers';

let ctx: TestScene;

beforeEach(() => {
  ctx = makeScene();
});
afterEach(() => {
  ctx.dispose();
});

describe('procedural character', () => {
  it('builds a skinned mesh with a full 22-bone humanoid skeleton', () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    expect(hero.skeleton.bones).toHaveLength(HUMANOID_ORDER.length);
    expect(hero.mesh.getTotalVertices()).toBeGreaterThan(0);
    expect(hero.mesh.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind)).toBe(true);
    expect(hero.mesh.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind)).toBe(true);
  });

  it('links every bone to a TransformNode (required for glTF animation)', () => {
    const hero = createProceduralCharacter(ctx.scene);
    for (const bone of hero.skeleton.bones) {
      expect(bone.getTransformNode(), `${bone.name} has no linked node`).toBeTruthy();
    }
  });

  it('reproduces the universal humanoid hierarchy', () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const parentOf = (slot: Parameters<typeof hero.bones.get>[0]) =>
      hero.bones.get(slot)?.getParent()?.name ?? null;

    expect(parentOf('Hips')).toBeNull();
    expect(parentOf('Spine')).toBe('Hips');
    expect(parentOf('Head')).toBe('Neck');
    expect(parentOf('LeftUpperArm')).toBe('LeftShoulder');
    expect(parentOf('LeftHand')).toBe('LeftLowerArm');
    expect(parentOf('RightFoot')).toBe('RightLowerLeg');
    expect(parentOf('LeftUpperLeg')).toBe('Hips');
  });

  it('is roughly human-sized and stands on the ground', () => {
    const hero = createProceduralCharacter(ctx.scene);
    hero.mesh.computeWorldMatrix(true);
    const bb = hero.mesh.getBoundingInfo().boundingBox;
    const height = bb.maximumWorld.y - bb.minimumWorld.y;
    expect(height).toBeGreaterThan(1.4);
    expect(height).toBeLessThan(2.1);
    expect(Math.abs(bb.minimumWorld.y)).toBeLessThan(0.15);
  });

  it('honours the requested naming scheme', () => {
    const mix = createProceduralCharacter(ctx.scene, { scheme: MIXAMO_SCHEME, name: 'm' });
    expect(mix.skeleton.bones.map((b) => b.name)).toContain('mixamorig:Hips');

    const ue = createProceduralCharacter(ctx.scene, { scheme: UNREAL_SCHEME, name: 'u' });
    expect(ue.skeleton.bones.map((b) => b.name)).toContain('pelvis');
  });

  it('applies uniform scale via the root', () => {
    const small = createProceduralCharacter(ctx.scene, { scale: 0.5, name: 's' });
    expect(small.root.scaling.x).toBeCloseTo(0.5);
  });

  it('disposes without leaking meshes or skeletons', () => {
    const before = ctx.scene.meshes.length;
    const hero = createProceduralCharacter(ctx.scene, { name: 'tmp' });
    expect(ctx.scene.meshes.length).toBeGreaterThan(before);
    hero.dispose();
    expect(ctx.scene.meshes.length).toBe(before);
  });
});

describe('glTF import reality check', () => {
  it('animation tracks target TransformNodes, NOT Bones', async () => {
    // This is the single most common cause of "it loads but nothing moves".
    const glb = await buildSourceGlb(UNITY_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const target = container.animationGroups[0]!.targetedAnimations[0]!.target as object;
    expect(target.constructor.name).toBe('TransformNode');
    container.dispose();
  });

  it('inspectGlb reports bones, targets and the detected scheme', async () => {
    const glb = await buildSourceGlb(UNITY_SCHEME);
    const info = await inspectGlb(ctx.scene, glb);
    expect(info.animationGroupNames.length).toBeGreaterThan(0);
    expect(info.boneNames).toContain('Hips');
    expect(info.animatedTargets.length).toBeGreaterThan(0);
    expect(info.detected.schemeName).toBe('unity');
  });
});

describe('retargeting', () => {
  it('drives the procedural character from a same-scheme .glb', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNITY_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const { group, report } = retargetAnimationGroup(source, hero.skeleton, 'IDLE');
    expect(report.dropped).toBe(0);
    expect(report.remapped).toBe(source.targetedAnimations.length);

    const ours = new Set<TransformNode>(hero.nodes.values());
    for (const ta of group.targetedAnimations) {
      expect(ours.has(ta.target as TransformNode)).toBe(true);
    }
    container.dispose();
  });

  it('actually MOVES the bones when played', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNITY_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();
    const { group } = retargetAnimationGroup(source, hero.skeleton, 'IDLE');
    container.dispose();

    const arm = hero.nodes.get('LeftUpperArm')!;
    const before = (arm.rotationQuaternion ?? Quaternion.Identity()).clone();

    group.play(true);
    group.goToFrame(15);
    ctx.scene.render();

    const after = arm.rotationQuaternion ?? Quaternion.Identity();
    const delta =
      Math.abs(before.x - after.x) +
      Math.abs(before.y - after.y) +
      Math.abs(before.z - after.z) +
      Math.abs(before.w - after.w);
    expect(delta).toBeGreaterThan(0.01);

    // And the linked bone must produce a usable matrix.
    const m = hero.bones.get('LeftUpperArm')!.getFinalMatrix();
    expect(m.m.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('bridges naming schemes with no manual map (Mixamo clip → Unity rig)', async () => {
    // "mixamorig:LeftArm" and "LeftUpperArm" are the same joint; semantic
    // slot matching resolves it.
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(MIXAMO_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const { report } = retargetAnimationGroup(source, hero.skeleton, 'X');
    expect(report.dropped).toBe(0);
    container.dispose();
  });

  it('bridges Unreal naming too', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNREAL_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const { report } = retargetAnimationGroup(source, hero.skeleton, 'X');
    expect(report.dropped).toBe(0);
    container.dispose();
  });

  it('honours an explicit nameMap', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(MIXAMO_SCHEME);
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const map: Record<string, string> = {};
    for (const slot of HUMANOID_ORDER) map[MIXAMO_SCHEME[slot]] = UNITY_SCHEME[slot];

    const { report } = retargetAnimationGroup(source, hero.skeleton, 'X', map);
    expect(report.dropped).toBe(0);
    container.dispose();
  });

  it('drops unknown bones gracefully instead of throwing', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNITY_SCHEME, {
      extraBones: ['LeftHandIndex1', 'WeaponSocket', 'twist_01'],
    });
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const { group, report } = retargetAnimationGroup(source, hero.skeleton, 'X');
    expect(report.dropped).toBe(3);
    expect(report.unmatchedNames.length).toBe(3);
    // Every surviving track must still have a real target.
    for (const ta of group.targetedAnimations) expect(ta.target).toBeTruthy();
    container.dispose();
  });

  it('stripRootMotion removes hips translation but keeps rotations', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNITY_SCHEME, { rootMotion: true });
    const container = await LoadAssetContainerAsync(glb, ctx.scene, { pluginExtension: '.glb' });
    const source = container.animationGroups[0]!;
    source.stop();

    const { group } = retargetAnimationGroup(source, hero.skeleton, 'WALK');
    const withRoot = group.targetedAnimations.length;

    stripRootMotion(group, 'Hips');
    expect(group.targetedAnimations.length).toBe(withRoot - 1);
    // No hips position track survives.
    const hasHipsPos = group.targetedAnimations.some((ta) => {
      const n = (ta.target as { name?: string }).name ?? '';
      return n === 'Hips' && ta.animation.targetProperty.includes('position');
    });
    expect(hasHipsPos).toBe(false);
    container.dispose();
  });
});

describe('animation library', () => {
  it('loads a .glb and returns a retargeted, playable clip', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildSourceGlb(UNITY_SCHEME);
    const clips = await loadAndRetargetClip(ctx.scene, glb, hero.skeleton, {
      loop: true,
      clipName: 'idle',
    });
    expect(clips).toHaveLength(1);
    expect(clips[0]!.name).toBe('idle');
    expect(clips[0]!.report.dropped).toBe(0);
    expect(clips[0]!.group.loopAnimation).toBe(true);
  });

  it('disposes the source rig, leaving only our character in the scene', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME, name: 'hero' });
    const skeletonsBefore = ctx.scene.skeletons.length;
    const glb = await buildSourceGlb(UNITY_SCHEME);
    await loadAndRetargetClip(ctx.scene, glb, hero.skeleton, { clipName: 'idle' });
    // Imported skeleton must not linger.
    expect(ctx.scene.skeletons.length).toBe(skeletonsBefore);
  });

  it('throws a clear error for a .glb with no animations', async () => {
    const hero = createProceduralCharacter(ctx.scene);
    const glb = await buildSourceGlb(UNITY_SCHEME, { animatedSlots: [] });
    await expect(loadAndRetargetClip(ctx.scene, glb, hero.skeleton)).rejects.toThrow(
      /No animation groups/,
    );
  });
});

describe('rigged character model (Mannequin_F.glb path)', () => {
  it('loads a model .glb and exposes its skeleton', async () => {
    const glb = await buildModelGlb(UNITY_SCHEME);
    const model = await loadRiggedCharacter(ctx.scene, glb, { name: 'mannequin' });

    expect(model.skeleton.bones.length).toBeGreaterThanOrEqual(HUMANOID_ORDER.length);
    expect(model.meshes.length).toBeGreaterThan(0);
    expect(model.root).toBeTruthy();
  });

  it('indexes the model rig by semantic slot', async () => {
    const glb = await buildModelGlb(UNITY_SCHEME);
    const model = await loadRiggedCharacter(ctx.scene, glb);

    expect(model.bones.get('Hips')).toBeTruthy();
    expect(model.bones.get('LeftUpperArm')).toBeTruthy();
    expect(model.nodes.get('Hips')).toBeTruthy();

    const desc = describeRig(model);
    expect(desc.mappedSlots.length).toBe(HUMANOID_ORDER.length);
  });

  it('drives the MODEL with a separate animation library — the real pack flow', async () => {
    // Mannequin_F.glb (model) + UAL2_Standard.glb (animations) are separate
    // files in the pack; this is exactly how they combine.
    const modelGlb = await buildModelGlb(UNITY_SCHEME);
    const libGlb = await buildLibraryGlb(UNITY_SCHEME, [
      { name: 'Idle', slots: ['Spine', 'Head'] },
      { name: 'Walk', slots: ['LeftUpperLeg'] },
    ]);

    const model = await loadRiggedCharacter(ctx.scene, modelGlb);
    const controller = new CharacterController(ctx.scene, model);
    const keys = await controller.loadLibrary(libGlb, {
      rename: { Idle: 'idle', Walk: 'walk' },
    });

    expect(keys.sort()).toEqual(['idle', 'walk']);
    expect(controller.play('idle')).toBe(true);

    // And it must actually move the model's bones.
    const spine = model.nodes.get('Spine')!;
    const before = (spine.rotationQuaternion ?? Quaternion.Identity()).clone();
    ctx.scene.render();
    const group = ctx.scene.animationGroups.find((g) => g.name === 'Idle');
    group?.goToFrame(15);
    ctx.scene.render();
    const after = spine.rotationQuaternion ?? Quaternion.Identity();
    const delta =
      Math.abs(before.x - after.x) +
      Math.abs(before.y - after.y) +
      Math.abs(before.z - after.z) +
      Math.abs(before.w - after.w);
    expect(delta).toBeGreaterThan(0.001);

    controller.dispose();
  });

  it('gives a clear error when handed an animation file instead of a model', async () => {
    // Loading UAL2_Standard.glb here instead of Mannequin_F.glb is an easy
    // mistake; the message should say so.
    const engineOnlyAnim = await buildLibraryGlb(UNITY_SCHEME, [
      { name: 'Idle', slots: ['Spine'] },
    ]);
    // That helper DOES include a skeleton, so use a genuinely skeleton-free file:
    const noSkeleton = 'data:base64,bm90LWEtcmVhbC1nbGI=';
    await expect(loadRiggedCharacter(ctx.scene, noSkeleton)).rejects.toThrow();
    void engineOnlyAnim;
  });

  it('CharacterController is agnostic: same API for procedural and rigged', async () => {
    const libGlb = await buildLibraryGlb(UNITY_SCHEME, [{ name: 'Idle', slots: ['Spine'] }]);

    const procedural = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME, name: 'p' });
    const c1 = new CharacterController(ctx.scene, procedural);
    expect(await c1.loadLibrary(libGlb)).toEqual(['Idle']);

    const model = await loadRiggedCharacter(ctx.scene, await buildModelGlb(UNITY_SCHEME));
    const c2 = new CharacterController(ctx.scene, model);
    expect(await c2.loadLibrary(libGlb)).toEqual(['Idle']);

    c1.dispose();
    c2.dispose();
  });
});

describe('combined animation library', () => {
  // This is the shape the Quaternius Godot export actually ships:
  // AnimationLibrary_Godot_Standard.glb — many named clips in ONE file.
  const LIB = [
    { name: 'Idle', slots: ['Spine', 'Head'] as const },
    { name: 'Walk', slots: ['LeftUpperLeg', 'RightUpperLeg'] as const },
    { name: 'Sword_Slash', slots: ['RightUpperArm'] as const },
  ];

  it('keeps each clip\u2019s own name from inside the .glb', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildLibraryGlb(
      UNITY_SCHEME,
      LIB.map((c) => ({ ...c, slots: [...c.slots] })),
    );
    const clips = await loadAndRetargetClip(ctx.scene, glb, hero.skeleton);

    // Names must be the real ones, NOT positional file_0 / file_1.
    expect(clips.map((c) => c.name).sort()).toEqual(['Idle', 'Sword_Slash', 'Walk']);
    for (const c of clips) expect(c.report.dropped).toBe(0);
  });

  it('loadAnimationLibrary returns clips keyed by name', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildLibraryGlb(
      UNITY_SCHEME,
      LIB.map((c) => ({ ...c, slots: [...c.slots] })),
    );
    const lib = await loadAnimationLibrary(ctx.scene, glb, hero.skeleton);

    expect(Object.keys(lib).sort()).toEqual(['Idle', 'Sword_Slash', 'Walk']);
    expect(lib.Idle!.group.loopAnimation).toBe(true);
  });

  it('`only` filters a large library down to the clips you want', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildLibraryGlb(
      UNITY_SCHEME,
      LIB.map((c) => ({ ...c, slots: [...c.slots] })),
    );
    const lib = await loadAnimationLibrary(ctx.scene, glb, hero.skeleton, {
      only: ['idle', 'walk'],
    });

    expect(Object.keys(lib).sort()).toEqual(['Idle', 'Walk']);
  });

  it('controller.loadLibrary can rename clips to gameplay keys', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const glb = await buildLibraryGlb(
      UNITY_SCHEME,
      LIB.map((c) => ({ ...c, slots: [...c.slots] })),
    );
    const controller = new CharacterController(ctx.scene, hero);

    const keys = await controller.loadLibrary(glb, {
      rename: { Idle: 'idle', Walk: 'walk', Sword_Slash: 'attack' },
    });

    expect(keys.sort()).toEqual(['attack', 'idle', 'walk']);
    expect(controller.play('idle')).toBe(true);
    expect(controller.play('attack')).toBe(true);
    expect(controller.playing).toBe('attack');
    controller.dispose();
  });
});

describe('character controller', () => {
  it('loads several clips and switches between them', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const idleGlb = await buildSourceGlb(UNITY_SCHEME);
    const walkGlb = await buildSourceGlb(UNITY_SCHEME, { animatedSlots: ['LeftUpperLeg'] });

    const controller = new CharacterController(ctx.scene, hero);
    const { loaded, failed } = await controller.loadAll([
      { key: 'idle', url: idleGlb, loop: true },
      { key: 'walk', url: walkGlb, loop: true },
    ]);

    expect(loaded).toEqual(['idle', 'walk']);
    expect(failed).toEqual([]);

    expect(controller.play('idle')).toBe(true);
    expect(controller.playing).toBe('idle');
    expect(controller.play('walk')).toBe(true);
    expect(controller.playing).toBe('walk');
    expect(controller.play('nope')).toBe(false);

    controller.dispose();
  });

  it('reports a failed clip without aborting the rest of the batch', async () => {
    const hero = createProceduralCharacter(ctx.scene, { scheme: UNITY_SCHEME });
    const good = await buildSourceGlb(UNITY_SCHEME);

    const controller = new CharacterController(ctx.scene, hero);
    const { loaded, failed } = await controller.loadAll([
      { key: 'idle', url: good },
      { key: 'missing', url: 'data:base64,bm90LWEtZ2xi' },
    ]);

    expect(loaded).toContain('idle');
    expect(failed).toContain('missing');
    controller.dispose();
  });
});

describe('scheme detection', () => {
  it('identifies each known scheme from its bone names', () => {
    for (const [name, scheme] of [
      ['unity', UNITY_SCHEME],
      ['mixamo', MIXAMO_SCHEME],
      ['unreal', UNREAL_SCHEME],
    ] as const) {
      const det = detectScheme(HUMANOID_ORDER.map((s) => scheme[s]));
      expect(det.schemeName).toBe(name);
      expect(det.missing).toEqual([]);
    }
  });

  it('recovers partial rigs and reports what is missing', () => {
    const det = detectScheme(['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'upperarm_l', 'Toe_L']);
    expect(det.matched.length).toBeGreaterThanOrEqual(5);
    expect(det.missing.length).toBeGreaterThan(0);
    expect(det.matched.length + det.missing.length).toBe(HUMANOID_ORDER.length);
  });

  it('maps alternate spellings to the right semantic slot', () => {
    expect(slotForBoneName('mixamorig:LeftArm')).toBe('LeftUpperArm');
    expect(slotForBoneName('upperarm_l')).toBe('LeftUpperArm');
    expect(slotForBoneName('LeftUpperArm')).toBe('LeftUpperArm');
    expect(slotForBoneName('pelvis')).toBe('Hips');
    expect(slotForBoneName('thigh.R')).toBe('RightUpperLeg');
    expect(slotForBoneName('SomeRandomProp')).toBeNull();
  });

  it('does not throw on an empty skeleton', () => {
    const det = detectScheme([]);
    expect(det.matched).toEqual([]);
    expect(det.missing).toHaveLength(HUMANOID_ORDER.length);
  });
});
