/**
 * One Mannequin_F.glb serving the whole Aether Break roster.
 *
 * The headline risk this file defends against: shared materials. Babylon's
 * `instantiateModelsToScene(name, false)` reuses ONE material across every
 * instance, so tinting Nyra would also tint Bram. These tests pin the fix.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/loaders/glTF/2.0';

import { AETHER_STYLES, createRoster, rosterClips, styleFor, applyStyle } from '../roster3d';
import { createFighterFactory } from '../fighterRig';
import { UAL2_CLIPS, type FighterAnimKey } from '../combatClipMap';
import { UNREAL_SCHEME } from '../humanoidRig';
import { buildLibraryGlb, buildModelGlb, makeScene, type TestScene } from './helpers';

let ctx: TestScene;
beforeEach(() => {
  ctx = makeScene();
});
afterEach(() => {
  ctx.dispose();
});

const ROSTER_IDS = ['nyra_vex', 'bram_kade', 'iria_sol', 'kellan_wisp'];

/** A stand-in UAL2_Standard.glb carrying every clip the roster needs. */
function libraryGlb() {
  return buildLibraryGlb(
    UNREAL_SCHEME,
    rosterClips().map((name) => ({ name, slots: ['Spine' as const] })),
  );
}

async function makeRoster() {
  return createRoster(ctx.scene, {
    modelUrl: await buildModelGlb(UNREAL_SCHEME),
    libraryUrl: await libraryGlb(),
  });
}

function firstMaterialOf(rig: { root: { getChildMeshes(): AbstractMesh[] } }) {
  return rig.root.getChildMeshes().find((m) => m.material)?.material ?? null;
}

describe('roster styles', () => {
  it('covers every Aether Break character', () => {
    for (const id of ROSTER_IDS) {
      expect(AETHER_STYLES[id], `${id} has no style`).toBeTruthy();
    }
  });

  it('only references clips that exist in the real UAL2 library', () => {
    for (const style of Object.values(AETHER_STYLES)) {
      for (const clip of Object.values(style.clipMap ?? {})) {
        expect(UAL2_CLIPS, `${style.id} → ${clip}`).toContain(clip);
      }
    }
  });

  it('gives each character a distinct colour', () => {
    const colors = ROSTER_IDS.map((id) => AETHER_STYLES[id]!.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('falls back to a neutral style for an unknown id', () => {
    const s = styleFor('totally_new_fighter');
    expect(s.id).toBe('totally_new_fighter');
    expect(s.clipMap).toBeTruthy();
  });

  it('rosterClips dedupes the union of every character map', () => {
    const clips = rosterClips();
    expect(new Set(clips).size).toBe(clips.length);
    expect(clips.length).toBeGreaterThan(10);
    for (const c of clips) expect(UAL2_CLIPS).toContain(c);
  });
});

describe('spawning the roster from ONE model', () => {
  it('spawns every character from the same file', async () => {
    const roster = await makeRoster();
    const fighters = ROSTER_IDS.map((id) => roster.spawn(id));
    expect(fighters).toHaveLength(4);
    for (const f of fighters) {
      expect(f.skeleton.bones.length).toBeGreaterThan(0);
      expect(f.clips.size).toBeGreaterThan(0);
    }
    roster.dispose();
  });

  it('gives each fighter its own skeleton', async () => {
    const roster = await makeRoster();
    const skeletons = ROSTER_IDS.map((id) => roster.spawn(id).skeleton);
    expect(new Set(skeletons).size).toBe(skeletons.length);
    roster.dispose();
  });

  it('supports a MIRROR MATCH — same character twice, independently', async () => {
    const roster = await makeRoster();
    const a = roster.spawn('nyra_vex', 'p1');
    const b = roster.spawn('nyra_vex', 'p2');
    expect(a.skeleton).not.toBe(b.skeleton);
    expect(a.root).not.toBe(b.root);
    // Same styling, separate objects.
    expect(a.style.color).toBe(b.style.color);
    roster.dispose();
  });
});

describe('per-fighter materials (the shared-material trap)', () => {
  it('tinting one fighter does NOT recolour the others', async () => {
    const roster = await makeRoster();
    const nyra = roster.spawn('nyra_vex');
    const bram = roster.spawn('bram_kade');

    const mNyra = firstMaterialOf(nyra);
    const mBram = firstMaterialOf(bram);

    // Different material instances is the precondition for independent tinting.
    expect(mNyra).toBeTruthy();
    expect(mBram).toBeTruthy();
    expect(mNyra).not.toBe(mBram);

    const colorOf = (m: typeof mNyra) =>
      m instanceof PBRMaterial
        ? m.albedoColor
        : m instanceof StandardMaterial
          ? m.diffuseColor
          : null;

    const cN = colorOf(mNyra);
    const cB = colorOf(mBram);
    expect(cN).toBeTruthy();
    expect(cB).toBeTruthy();
    // Nyra is cyan, Bram is orange — they must not be equal.
    expect(cN!.equals(cB!)).toBe(false);
    roster.dispose();
  });

  it('cloneMaterials:false is the coupled behaviour (documents the trap)', async () => {
    // Guard against a future "optimisation" flipping the default back.
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
      cloneMaterials: false,
    });
    const a = factory.spawn('a');
    const b = factory.spawn('b');
    expect(firstMaterialOf(a)).toBe(firstMaterialOf(b)); // shared!
    factory.dispose();
  });

  it('defaults to cloned materials', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
      // cloneMaterials omitted
    });
    const a = factory.spawn('a');
    const b = factory.spawn('b');
    expect(firstMaterialOf(a)).not.toBe(firstMaterialOf(b));
    factory.dispose();
  });
});

describe('per-fighter silhouette', () => {
  it('scales fighters differently so builds read apart', async () => {
    const roster = await makeRoster();
    const nyra = roster.spawn('nyra_vex');
    const bram = roster.spawn('bram_kade');

    // Bram is the heavy; he should be visibly wider than Nyra.
    expect(bram.root.scaling.x).toBeGreaterThan(nyra.root.scaling.x);
    roster.dispose();
  });

  it('applyStyle can restyle an existing rig at runtime', async () => {
    const roster = await makeRoster();
    const rig = roster.spawn('nyra_vex');
    const before = rig.root.scaling.x;
    applyStyle(rig, { ...styleFor('bram_kade') });
    expect(rig.root.scaling.x).not.toBe(before);
    roster.dispose();
  });
});

describe('per-character motion', () => {
  it('playKey works for every gameplay key on every character', async () => {
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

    for (const id of ROSTER_IDS) {
      const rig = roster.spawn(id, `${id}_test`);
      for (const key of keys) {
        expect(rig.playKey(key, 0), `${id} cannot play "${key}"`).toBe(true);
      }
    }
    roster.dispose();
  });

  it('different characters can resolve the same key to different clips', async () => {
    // Bram is a brawler (MELEE_HOOK), Kellan a swordsman (SWORD_REGULAR_A).
    const bram = AETHER_STYLES.bram_kade!.clipMap!;
    const kellan = AETHER_STYLES.kellan_wisp!.clipMap!;
    expect(bram.light).not.toBe(kellan.light);
  });

  it('every character has a distinct idle so they read apart at rest', () => {
    const idles = ROSTER_IDS.map((id) => AETHER_STYLES[id]!.clipMap!.idle);
    // At least three distinct idles across four characters.
    expect(new Set(idles).size).toBeGreaterThanOrEqual(3);
  });
});

describe('roster lifecycle', () => {
  it('disposing one fighter leaves the rest usable', async () => {
    const roster = await makeRoster();
    const a = roster.spawn('nyra_vex');
    const b = roster.spawn('bram_kade');
    a.dispose();
    expect(b.playKey('idle', 0)).toBe(true);
    roster.dispose();
  });

  it('roster.dispose() tears everything down', async () => {
    const roster = await makeRoster();
    roster.spawn('nyra_vex');
    roster.spawn('bram_kade');
    expect(() => roster.dispose()).not.toThrow();
  });
});
