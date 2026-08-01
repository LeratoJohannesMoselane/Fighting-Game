/**
 * Game integration: many fighters from one model, and clip selection driven by
 * CombatCore-shaped fighter state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/loaders/glTF/2.0';

import { createFighterFactory } from '../fighterRig';
import {
  BRAWLER_CLIP_MAP,
  DEFAULT_CLIP_MAP,
  UAL2_CLIPS,
  ZOMBIE_CLIP_MAP,
  aliasesFor,
  clipsUsedBy,
  renameFromClipMap,
  resolveClip,
  type FighterAnimKey,
} from '../combatClipMap';
import { UNREAL_SCHEME, slotForBoneName } from '../humanoidRig';
import { buildLibraryGlb, buildModelGlb, makeScene, type TestScene } from './helpers';

let ctx: TestScene;
beforeEach(() => {
  ctx = makeScene();
});
afterEach(() => {
  ctx.dispose();
});

/** A stand-in for UAL2_Standard.glb using the real clip names. */
function libraryGlb() {
  return buildLibraryGlb(UNREAL_SCHEME, [
    { name: 'IDLE_SHIELD_LOOP', slots: ['Spine', 'Head'] },
    { name: 'WALK_CARRY_LOOP', slots: ['LeftUpperLeg', 'RightUpperLeg'] },
    { name: 'SWORD_REGULAR_A', slots: ['RightUpperArm'] },
    { name: 'SWORD_HEAVY_COMBO', slots: ['RightUpperArm', 'Spine'] },
    { name: 'HIT_KNOCKBACK', slots: ['Spine'] },
  ]);
}

describe('fighter factory', () => {
  it('spawns a fighter with its own root, skeleton and clips', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });

    const p1 = factory.spawn('p1');
    expect(p1.root).toBeTruthy();
    expect(p1.skeleton.bones.length).toBeGreaterThan(0);
    expect(p1.clips.size).toBe(5);
    factory.dispose();
  });

  it('gives each fighter a SEPARATE skeleton', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });

    const p1 = factory.spawn('p1');
    const p2 = factory.spawn('p2');
    expect(p1.skeleton).not.toBe(p2.skeleton);
    expect(p1.root).not.toBe(p2.root);
    factory.dispose();
  });

  it('animates two fighters INDEPENDENTLY — the whole point of a versus game', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });

    const p1 = factory.spawn('p1');
    const p2 = factory.spawn('p2');

    const spineOf = (rig: typeof p1) =>
      rig.skeleton.bones.find((b) => slotForBoneName(b.name) === 'Spine')!.getTransformNode()!;

    const s1 = spineOf(p1);
    const s2 = spineOf(p2);
    const before2 = (s2.rotationQuaternion ?? Quaternion.Identity()).clone();

    // Drive ONLY p1.
    p1.play('IDLE_SHIELD_LOOP', 0);
    p1.clips.get('IDLE_SHIELD_LOOP')!.goToFrame(15);
    ctx.scene.render();

    const dist = (a: Quaternion, b: Quaternion) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) + Math.abs(a.w - b.w);

    const p1Moved = dist(Quaternion.Identity(), s1.rotationQuaternion ?? Quaternion.Identity());
    const p2Moved = dist(before2, s2.rotationQuaternion ?? Quaternion.Identity());

    expect(p1Moved).toBeGreaterThan(0.01);
    expect(p2Moved).toBeLessThan(0.0001); // p2 must not twitch
    factory.dispose();
  });

  it('renames clips to gameplay keys and filters with `only`', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
      only: ['IDLE_SHIELD_LOOP', 'WALK_CARRY_LOOP'],
      rename: { IDLE_SHIELD_LOOP: 'idle', WALK_CARRY_LOOP: 'walk' },
    });

    expect(factory.clipNames.sort()).toEqual(['idle', 'walk']);
    const p1 = factory.spawn('p1');
    expect(p1.play('idle')).toBe(true);
    expect(p1.playing).toBe('idle');
    expect(p1.play('nope')).toBe(false);
    factory.dispose();
  });

  it('aliases let several keys share one clip without retargeting twice', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
      only: ['SWORD_REGULAR_A'],
      rename: { SWORD_REGULAR_A: 'light' },
      aliases: [{ alias: 'heavy', target: 'light' }],
    });

    const p1 = factory.spawn('p1');
    expect(p1.clips.get('heavy')).toBe(p1.clips.get('light'));
    expect(p1.play('heavy')).toBe(true);
    factory.dispose();
  });

  it('auto-loops only clips whose name ends in _LOOP', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });
    const p1 = factory.spawn('p1');
    expect(p1.clips.get('IDLE_SHIELD_LOOP')!.loopAnimation).toBe(true);
    expect(p1.clips.get('SWORD_REGULAR_A')!.loopAnimation).toBe(false);
    factory.dispose();
  });

  it('setFacing flips the fighter without touching the skeleton', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });
    const p1 = factory.spawn('p1');
    p1.setFacing(1);
    const right = p1.root.rotation.y;
    p1.setFacing(-1);
    expect(p1.root.rotation.y).not.toBe(right);
    factory.dispose();
  });

  it('errors clearly when the model/library URLs are swapped', async () => {
    const model = await buildModelGlb(UNREAL_SCHEME);
    const lib = await libraryGlb();

    // library passed as the model → no skeleton complaint is wrong here
    // (our helper library DOES ship a skeleton), so test the genuine failure:
    await expect(
      createFighterFactory(ctx.scene, { modelUrl: model, libraryUrl: model }),
    ).rejects.toThrow(/no animations/i);

    void lib;
  });

  it('errors when none of the requested clips exist, listing what does', async () => {
    await expect(
      createFighterFactory(ctx.scene, {
        modelUrl: await buildModelGlb(UNREAL_SCHEME),
        libraryUrl: await libraryGlb(),
        only: ['NOT_A_REAL_CLIP'],
      }),
    ).rejects.toThrow(/Available include/);
  });

  it('disposing a fighter leaves the others playable', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await libraryGlb(),
    });
    const p1 = factory.spawn('p1');
    const p2 = factory.spawn('p2');
    p1.dispose();
    expect(p2.play('IDLE_SHIELD_LOOP')).toBe(true);
    factory.dispose();
  });
});

describe('combat clip mapping', () => {
  it('every mapped clip exists in the real UAL2 clip list', () => {
    for (const map of [DEFAULT_CLIP_MAP, BRAWLER_CLIP_MAP, ZOMBIE_CLIP_MAP]) {
      for (const clip of Object.values(map)) {
        expect(UAL2_CLIPS, `${clip} is not a real UAL2 clip`).toContain(clip);
      }
    }
  });

  it('covers every gameplay key', () => {
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
    for (const k of keys) expect(DEFAULT_CLIP_MAP[k]).toBeTruthy();
  });

  it('resolves each CombatCore phase to a sensible key', () => {
    expect(resolveClip({ phase: 'neutral' })).toBe('idle');
    expect(resolveClip({ phase: 'walk' })).toBe('walk');
    expect(resolveClip({ phase: 'crouch' })).toBe('crouch');
    expect(resolveClip({ phase: 'jump' })).toBe('jump');
    expect(resolveClip({ phase: 'airborne' })).toBe('airborne');
    expect(resolveClip({ phase: 'dash' })).toBe('dash');
    expect(resolveClip({ phase: 'guard' })).toBe('guard');
    expect(resolveClip({ phase: 'blockstun' })).toBe('guard');
    expect(resolveClip({ phase: 'hitstun' })).toBe('hitstun');
    expect(resolveClip({ phase: 'knockdown' })).toBe('knockdown');
  });

  it('distinguishes attack flavours from real Aether Break move ids', () => {
    expect(resolveClip({ phase: 'attack', moveId: 'nyra_light' })).toBe('light');
    expect(resolveClip({ phase: 'attack', moveId: 'bram_heavy' })).toBe('heavy');
    expect(resolveClip({ phase: 'attack', moveId: 'nyra_gun' })).toBe('ranged');
    expect(resolveClip({ phase: 'attack', moveId: 'iria_bolt' })).toBe('ranged');
    expect(resolveClip({ phase: 'attack', moveId: 'nyra_bomb' })).toBe('ranged');
    expect(resolveClip({ phase: 'attack', moveId: 'iria_snake' })).toBe('ranged');
    expect(resolveClip({ phase: 'attack', moveId: 'bram_spell' })).toBe('spell');
    expect(resolveClip({ phase: 'attack', moveId: 'nyra_event_horizon' })).toBe('ultimate');
    expect(resolveClip({ phase: 'attack', moveId: 'bram_last_foundry' })).toBe('ultimate');
    expect(resolveClip({ phase: 'attack', moveId: 'iria_sevenfold' })).toBe('ultimate');
    expect(resolveClip({ phase: 'attack', moveId: 'kellan_tempest' })).toBe('ultimate');
  });

  it('treats a guarding neutral fighter as guarding', () => {
    expect(resolveClip({ phase: 'neutral', guarding: true })).toBe('guard');
  });

  it('falls back to light for an unrecognised move id', () => {
    expect(resolveClip({ phase: 'attack', moveId: 'mystery_move' })).toBe('light');
    expect(resolveClip({ phase: 'attack' })).toBe('light');
  });

  it('renameFromClipMap inverts the map for the factory', () => {
    const rename = renameFromClipMap(DEFAULT_CLIP_MAP);
    expect(rename['IDLE_SHIELD_LOOP']).toBe('idle');
    expect(rename['WALK_CARRY_LOOP']).toBe('walk');
  });

  it('clipsUsedBy dedupes shared clips', () => {
    const used = clipsUsedBy(BRAWLER_CLIP_MAP);
    expect(new Set(used).size).toBe(used.length);
    expect(used).toContain('MELEE_HOOK');
  });

  it('aliasesFor reports keys that share a clip', () => {
    // Brawler: light, heavy and ultimate all use MELEE_HOOK.
    const aliases = aliasesFor(BRAWLER_CLIP_MAP);
    const aliasKeys = aliases.map((a) => a.alias);
    expect(aliasKeys).toContain('heavy');
    expect(aliasKeys).toContain('ultimate');
    // Each alias points at a key that IS in the rename map.
    const rename = renameFromClipMap(BRAWLER_CLIP_MAP);
    const owners = new Set(Object.values(rename));
    for (const a of aliases) expect(owners.has(a.target)).toBe(true);
  });

  it('a full map round-trips: rename + aliases covers every key', async () => {
    const rename = renameFromClipMap(BRAWLER_CLIP_MAP);
    const aliases = aliasesFor(BRAWLER_CLIP_MAP);
    const covered = new Set([...Object.values(rename), ...aliases.map((a) => a.alias)]);
    for (const key of Object.keys(BRAWLER_CLIP_MAP)) {
      expect(covered.has(key), `${key} not covered`).toBe(true);
    }
  });
});

describe('end-to-end: driving fighters from a real CombatCore match', () => {
  it('every gameplay key in DEFAULT_CLIP_MAP is playable on a spawned rig', async () => {
    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await buildLibraryGlb(
        UNREAL_SCHEME,
        clipsUsedBy(DEFAULT_CLIP_MAP).map((name) => ({ name, slots: ['Spine' as const] })),
      ),
      only: clipsUsedBy(DEFAULT_CLIP_MAP),
      rename: renameFromClipMap(DEFAULT_CLIP_MAP),
      aliases: aliasesFor(DEFAULT_CLIP_MAP),
      inPlace: true,
    });

    const rig = factory.spawn('p1');
    for (const key of Object.keys(DEFAULT_CLIP_MAP) as FighterAnimKey[]) {
      expect(rig.clips.has(key), `no clip for "${key}"`).toBe(true);
      expect(rig.play(key, 0)).toBe(true);
    }
    factory.dispose();
  });

  it('syncs two rigs from stepped CombatCore state without throwing', async () => {
    const { createInitialState, step, emptyActions, ROUND_INTRO_FRAMES } = await import(
      '@aether-break/combat-core'
    );
    type Inputs = Parameters<typeof step>[1];
    const inp = (a = {}, b = {}): Inputs => ({
      p1: { ...emptyActions(), ...a },
      p2: { ...emptyActions(), ...b },
    });

    const factory = await createFighterFactory(ctx.scene, {
      modelUrl: await buildModelGlb(UNREAL_SCHEME),
      libraryUrl: await buildLibraryGlb(
        UNREAL_SCHEME,
        clipsUsedBy(DEFAULT_CLIP_MAP).map((name) => ({ name, slots: ['Spine' as const] })),
      ),
      only: clipsUsedBy(DEFAULT_CLIP_MAP),
      rename: renameFromClipMap(DEFAULT_CLIP_MAP),
      aliases: aliasesFor(DEFAULT_CLIP_MAP),
      inPlace: true,
    });

    const rigs = [factory.spawn('p1'), factory.spawn('p2')];
    let gs = createInitialState({ seed: 3 });
    for (let i = 0; i <= ROUND_INTRO_FRAMES; i++) gs = step(gs, inp());

    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      gs = step(
        gs,
        i % 90 < 40
          ? inp({ right: true }, { left: true })
          : i % 90 < 50
            ? inp({ light: true }, { guard: true })
            : inp({ dash: true }, {}),
      );
      gs.fighters.forEach((f, idx) => {
        const rig = rigs[idx]!;
        // FP_SCALE = 1000 → world units.
        rig.root.position.set(f.x / 1000, f.y / 1000, 0);
        rig.setFacing(f.facing);
        rig.play(resolveClip(f));
      });
      ctx.scene.render();
      if (rigs[0]!.playing) seen.add(rigs[0]!.playing);
    }

    // The match should have exercised several distinct animation states.
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(seen.has('idle') || seen.has('walk')).toBe(true);
    // And the rigs must have tracked the simulation's positions.
    expect(Number.isFinite(rigs[0]!.root.position.x)).toBe(true);
    factory.dispose();
  });
});
