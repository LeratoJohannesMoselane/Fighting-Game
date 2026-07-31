/**
 * Aether Break roster built from the Quaternius character pack:
 * two base bodies + head-bone hair + one animation library.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import '@babylonjs/loaders/glTF/2.0';

import { AETHER_CHARACTERS, createAetherRoster, placeFighters } from '../aetherRoster';
import { attachToHead, EYEBROWS, HAIRSTYLES } from '../hairAttachment';
import { UAL2_CLIPS, clipsUsedBy, type FighterAnimKey } from '../combatClipMap';
import { UNREAL_SCHEME, slotForBoneName } from '../humanoidRig';
import {
  buildGltfModel,
  buildHairGltf,
  buildLibraryGlb,
  buildModelGlb,
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

const IDS = ['nyra_vex', 'bram_kade', 'iria_sol', 'kellan_wisp'];

function rosterLibrary() {
  const clips = new Set<string>();
  for (const c of Object.values(AETHER_CHARACTERS)) {
    for (const clip of clipsUsedBy(c.clipMap!)) clips.add(clip);
  }
  return buildLibraryGlb(
    UNREAL_SCHEME,
    [...clips].map((name) => ({ name, slots: ['Spine' as const] })),
  );
}

/** Roster wired to in-memory stand-ins for the pack's files. */
async function makeRoster(opts: { skipHair?: boolean } = {}) {
  const body = await buildModelGlb(UNREAL_SCHEME);
  const library = await rosterLibrary();
  return createAetherRoster(ctx.scene, {
    libraryUrl: library,
    bodiesUrl: '',
    bodyFiles: { female: body, male: body },
    skipHair: opts.skipHair ?? true,
  });
}

describe('character definitions', () => {
  it('defines all four Aether Break fighters', () => {
    for (const id of IDS) {
      const c = AETHER_CHARACTERS[id];
      expect(c, `${id} missing`).toBeTruthy();
      expect(c!.name).toBeTruthy();
      expect(['female', 'male']).toContain(c!.body);
    }
  });

  it('only references hairstyles that exist in the pack', () => {
    for (const c of Object.values(AETHER_CHARACTERS)) {
      if (c.hair) expect(HAIRSTYLES, `${c.id} → ${c.hair}`).toContain(c.hair);
      if (c.eyebrows) expect(EYEBROWS, `${c.id} → ${c.eyebrows}`).toContain(c.eyebrows);
    }
  });

  it('only references clips that exist in UAL2', () => {
    for (const c of Object.values(AETHER_CHARACTERS)) {
      for (const clip of Object.values(c.clipMap ?? {})) {
        expect(UAL2_CLIPS, `${c.id} → ${clip}`).toContain(clip);
      }
    }
  });

  it('uses both base bodies, so the roster is not all one silhouette', () => {
    const bodies = new Set(Object.values(AETHER_CHARACTERS).map((c) => c.body));
    expect(bodies.has('female')).toBe(true);
    expect(bodies.has('male')).toBe(true);
  });

  it('gives each fighter a distinct hairstyle', () => {
    const hair = Object.values(AETHER_CHARACTERS).map((c) => c.hair);
    expect(new Set(hair).size).toBe(hair.length);
  });

  it('gives each fighter a distinct colour', () => {
    const colors = Object.values(AETHER_CHARACTERS).map((c) => c.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('spawning', () => {
  it('spawns every roster character', async () => {
    const roster = await makeRoster();
    for (const id of IDS) {
      const f = await roster.spawn(id);
      expect(f.character.id).toBe(id);
      expect(f.skeleton.bones.length).toBeGreaterThan(0);
    }
    roster.dispose();
  });

  it('loads one factory per body type, not per character', async () => {
    const roster = await makeRoster();
    // Four characters, two bodies.
    expect(roster.bodies.length).toBe(2);
    roster.dispose();
  });

  it('rejects an unknown character with a helpful message', async () => {
    const roster = await makeRoster();
    await expect(roster.spawn('ryu')).rejects.toThrow(/Unknown character "ryu"/);
    roster.dispose();
  });

  it('keeps fighters independent (separate skeletons and materials)', async () => {
    const roster = await makeRoster();
    const nyra = await roster.spawn('nyra_vex');
    const bram = await roster.spawn('bram_kade');

    expect(nyra.skeleton).not.toBe(bram.skeleton);

    const matOf = (f: typeof nyra) =>
      f.root.getChildMeshes().find((m) => m.material)?.material ?? null;
    expect(matOf(nyra)).not.toBe(matOf(bram));
    roster.dispose();
  });

  it('applies each character\u2019s tint', async () => {
    const roster = await makeRoster();
    const nyra = await roster.spawn('nyra_vex');
    const bram = await roster.spawn('bram_kade');

    const colorOf = (f: typeof nyra) => {
      const m = f.root.getChildMeshes().find((x) => x.material)?.material;
      if (m instanceof PBRMaterial) return m.albedoColor.toHexString();
      if (m instanceof StandardMaterial) return m.diffuseColor.toHexString();
      return null;
    };
    expect(colorOf(nyra)).not.toBe(colorOf(bram));
    roster.dispose();
  });

  it('applies each character\u2019s build', async () => {
    const roster = await makeRoster();
    const nyra = await roster.spawn('nyra_vex');
    const bram = await roster.spawn('bram_kade');
    // Bram is the heavy.
    expect(bram.root.scaling.x).toBeGreaterThan(nyra.root.scaling.x);
    roster.dispose();
  });

  it('supports mirror matches', async () => {
    const roster = await makeRoster();
    const a = await roster.spawn('iria_sol', 'p1');
    const b = await roster.spawn('iria_sol', 'p2');
    expect(a.skeleton).not.toBe(b.skeleton);
    roster.dispose();
  });

  it('plays every gameplay key for every character', async () => {
    const roster = await makeRoster();
    const keys: FighterAnimKey[] = [
      'idle',
      'walk',
      'crouch',
      'jump',
      'airborne',
      'land',
      'dash',
      'guard',
      'hitstun',
      'knockdown',
      'light',
      'heavy',
      'ranged',
      'spell',
      'ultimate',
    ];
    for (const id of IDS) {
      const f = await roster.spawn(id, `${id}_x`);
      for (const key of keys) {
        expect(f.playKey(key, 0), `${id} cannot play ${key}`).toBe(true);
      }
    }
    roster.dispose();
  });
});

describe('head attachments (hair rigged to the head bone)', () => {
  it('attaches hair at head height, not at the origin', async () => {
    const container = await LoadAssetContainerAsync(await buildModelGlb(UNREAL_SCHEME), ctx.scene, {
      pluginExtension: '.glb',
    });
    container.addAllToScene();
    const skeleton = container.skeletons[0]!;
    const bodyMesh = container.meshes.find((m) => m.skeleton)!;

    const attachment = await attachToHead(
      ctx.scene,
      skeleton,
      bodyMesh,
      await buildHairGltf('Hair_Long'),
      { color: '#2A1A3E' },
    );

    ctx.scene.render();
    const mesh = attachment.meshes[0]!;
    mesh.computeWorldMatrix(true);
    // Mannequin head sits ~1.5m up; origin would be 0.
    expect(mesh.getAbsolutePosition().y).toBeGreaterThan(0.5);
    attachment.dispose();
  });

  it('errors clearly when the skeleton has no head bone', async () => {
    const container = await LoadAssetContainerAsync(await buildModelGlb(UNREAL_SCHEME), ctx.scene, {
      pluginExtension: '.glb',
    });
    const skeleton = container.skeletons[0]!;
    // Rename the head so it can't be found.
    const head = skeleton.bones.find((b) => slotForBoneName(b.name) === 'Head')!;
    head.name = 'not_a_head';
    const bodyMesh = container.meshes[0]!;

    await expect(
      attachToHead(ctx.scene, skeleton, bodyMesh, await buildHairGltf(), {}),
    ).rejects.toThrow(/no Head bone/);
  });

  it('errors when the accessory file has no geometry', async () => {
    const container = await LoadAssetContainerAsync(await buildModelGlb(UNREAL_SCHEME), ctx.scene, {
      pluginExtension: '.glb',
    });
    container.addAllToScene();
    const skeleton = container.skeletons[0]!;
    const bodyMesh = container.meshes.find((m) => m.skeleton)!;

    // An "empty" file: valid glTF, no meshes.
    const empty = 'data:' + JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }] });
    await expect(attachToHead(ctx.scene, skeleton, bodyMesh, empty, {})).rejects.toThrow();
  });

  it('a missing hairstyle does not stop the fighter spawning', async () => {
    const body = await buildModelGlb(UNREAL_SCHEME);
    const roster = await createAetherRoster(ctx.scene, {
      libraryUrl: await rosterLibrary(),
      bodiesUrl: '',
      bodyFiles: { female: body, male: body },
      hairUrl: '/definitely/missing/',
      skipHair: false, // force the hair path, with broken URLs
    });
    const f = await roster.spawn('nyra_vex');
    expect(f.skeleton.bones.length).toBeGreaterThan(0);
    expect(f.playKey('idle', 0)).toBe(true);
    roster.dispose();
  });
});

describe('.gltf (JSON + .bin) support', () => {
  it('loads a .gltf body, not just .glb', async () => {
    // The pack ships .gltf + .bin pairs; this is that code path.
    const gltf = await buildGltfModel(UNREAL_SCHEME);
    const container = await LoadAssetContainerAsync(gltf, ctx.scene, { pluginExtension: '.gltf' });
    expect(container.skeletons.length).toBe(1);
    expect(container.meshes.length).toBeGreaterThan(0);
    container.dispose();
  });

  it('a .gltf body has a findable head bone for hair', async () => {
    const gltf = await buildGltfModel(UNREAL_SCHEME);
    const container = await LoadAssetContainerAsync(gltf, ctx.scene, { pluginExtension: '.gltf' });
    const head = container.skeletons[0]!.bones.find((b) => slotForBoneName(b.name) === 'Head');
    expect(head).toBeTruthy();
    container.dispose();
  });
});

describe('placement', () => {
  it('places fighters apart and facing each other', async () => {
    const roster = await makeRoster();
    const p1 = await roster.spawn('nyra_vex', 'p1');
    const p2 = await roster.spawn('bram_kade', 'p2');
    placeFighters(p1, p2, 6.8);

    expect(p1.root.position.x).toBeCloseTo(-3.4);
    expect(p2.root.position.x).toBeCloseTo(3.4);
    expect(p1.root.rotation.y).not.toBe(p2.root.rotation.y);
    roster.dispose();
  });
});

describe('lifecycle', () => {
  it('disposing a fighter also disposes its attachments', async () => {
    const container = await LoadAssetContainerAsync(await buildModelGlb(UNREAL_SCHEME), ctx.scene, {
      pluginExtension: '.glb',
    });
    container.addAllToScene();
    const before = ctx.scene.meshes.length;

    const attachment = await attachToHead(
      ctx.scene,
      container.skeletons[0]!,
      container.meshes.find((m) => m.skeleton)!,
      await buildHairGltf(),
      {},
    );
    expect(ctx.scene.meshes.length).toBeGreaterThan(before);
    attachment.dispose();
    expect(ctx.scene.meshes.length).toBe(before);
  });

  it('roster.dispose() tears down every body factory', async () => {
    const roster = await makeRoster();
    await roster.spawn('nyra_vex');
    await roster.spawn('bram_kade');
    expect(() => roster.dispose()).not.toThrow();
  });
});

/** Silence unused-import lint for helpers used only in some branches. */
void Mesh;
void VertexData;
void CreateSphereVertexData;
void Vector3;
