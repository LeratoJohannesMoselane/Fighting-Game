/**
 * Arena critter system: spawning, AI, combat both ways, and — most
 * importantly — that enabling wildlife keeps the determinism contract.
 */
import { describe, expect, it } from 'vitest';
import {
  ARENA_HALF_WIDTH,
  CRITTER_ARCHETYPES,
  CRITTER_MAX_ACTIVE,
  ROUND_INTRO_FRAMES,
  createInitialState,
  emptyActions,
  getCritterArchetype,
  getStateHash,
  serializeState,
  step,
  type CritterState,
  type GameState,
  type StepInputs,
} from '../index.js';

function blank(): StepInputs {
  return { p1: emptyActions(), p2: emptyActions() };
}

/** Fresh critter-enabled match, advanced past the intro. */
function critterState(seed = 4): GameState {
  let s = createInitialState({ seed, critters: true });
  for (let i = 0; i <= ROUND_INTRO_FRAMES; i++) s = step(s, blank());
  return s;
}

function run(s: GameState, frames: number, inp: StepInputs = blank()): GameState {
  let out = s;
  for (let i = 0; i < frames; i++) out = step(out, inp);
  return out;
}

/** Force a critter into the arena next to a fighter for combat tests. */
function plant(s: GameState, archetypeId: string, x: number): GameState {
  const arch = getCritterArchetype(archetypeId);
  const c: CritterState = {
    id: s.nextCritterId,
    archetypeId,
    hp: arch.hp,
    maxHp: arch.hp,
    x,
    y: arch.hoverY,
    vx: 0,
    facing: 1,
    state: 'approaching',
    targetSlot: null,
    attackCooldown: 0,
    windup: 0,
    fleeTimer: 0,
    hurtFlash: 0,
    age: 0,
    invuln: 0,
    seedOffset: 0,
  };
  return {
    ...s,
    critters: [...s.critters, c],
    nextCritterId: s.nextCritterId + 1,
    critterSpawnTimer: 100000, // suppress natural spawns during the test
  };
}

describe('critter opt-in', () => {
  it('stays empty when critters are disabled', () => {
    let s = createInitialState({ seed: 3 });
    expect(s.crittersEnabled).toBe(false);
    s = run(s, 1500);
    expect(s.critters).toHaveLength(0);
  });

  it('a critter-free match hashes identically with the feature compiled in', () => {
    // Guards against the critter layer perturbing the shared rng stream.
    const a = run(createInitialState({ seed: 77 }), 900);
    const b = run(createInitialState({ seed: 77 }), 900);
    expect(getStateHash(a)).toBe(getStateHash(b));
    expect(a.critters).toHaveLength(0);
  });
});

describe('critter spawning', () => {
  it('spawns wildlife once enabled', () => {
    const s = run(critterState(9), 700);
    expect(s.critters.length).toBeGreaterThan(0);
  });

  it('never exceeds the population cap', () => {
    let s = critterState(11);
    let peak = 0;
    for (let i = 0; i < 4000; i++) {
      s = step(s, blank());
      peak = Math.max(peak, s.critters.length);
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(CRITTER_MAX_ACTIVE);
  });

  it('enters from off-screen rather than on top of a fighter', () => {
    let s = critterState(13);
    const seen = new Set<number>();
    for (let i = 0; i < 2500; i++) {
      s = step(s, blank());
      for (const c of s.critters) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        // First frame we observe a critter it should still be near the wall.
        expect(Math.abs(c.x)).toBeGreaterThanOrEqual(ARENA_HALF_WIDTH - 600);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('only uses known archetypes', () => {
    let s = critterState(17);
    const ids = new Set(CRITTER_ARCHETYPES.map((a) => a.id));
    for (let i = 0; i < 3000; i++) {
      s = step(s, blank());
      for (const c of s.critters) expect(ids.has(c.archetypeId)).toBe(true);
    }
  });
});

describe('critter AI', () => {
  it('closes the distance on the nearest fighter', () => {
    let s = plant(critterState(21), 'void_creep', ARENA_HALF_WIDTH);
    const start = Math.abs(s.critters[0]!.x - s.fighters[1]!.x);
    s = run(s, 90);
    const live = s.critters[0];
    // Either it reached the fighter (and may be striking) or it's closer.
    if (live) {
      expect(Math.abs(live.x - s.fighters[1]!.x)).toBeLessThan(start);
    }
  });

  it('telegraphs a strike before it lands', () => {
    const base = critterState(23);
    let s = plant(base, 'void_creep', base.fighters[1]!.x + 700);
    let sawWindup = false;
    for (let i = 0; i < 240; i++) {
      s = step(s, blank());
      if (s.critters.some((c) => c.windup > 0)) sawWindup = true;
      if (s.events.some((e) => e.type === 'critter_hit')) break;
    }
    expect(sawWindup).toBe(true);
  });

  it('damages a fighter that stands in reach', () => {
    let s = critterState(27);
    s = plant(s, 'void_creep', s.fighters[1]!.x + 700);
    const hp0 = s.fighters[1]!.hp;
    s = run(s, 200);
    expect(s.fighters[1]!.hp).toBeLessThan(hp0);
  });

  it('guarding toward the critter reduces the bite', () => {
    const setup = (guard: boolean) => {
      let s = critterState(29);
      // P1 faces right (toward P2), so place the critter on that side for
      // the block check to apply.
      s = plant(s, 'void_creep', s.fighters[0]!.x + 700);
      const hp0 = s.fighters[0]!.hp;
      const inp: StepInputs = guard
        ? { p1: { ...emptyActions(), guard: true }, p2: emptyActions() }
        : blank();
      s = run(s, 200, inp);
      return hp0 - s.fighters[0]!.hp;
    };
    const openLoss = setup(false);
    const guardedLoss = setup(true);
    expect(openLoss).toBeGreaterThan(0);
    expect(guardedLoss).toBeLessThan(openLoss);
  });

  it('a critter caught from behind ignores the guard', () => {
    let s = critterState(30);
    s = plant(s, 'void_creep', s.fighters[0]!.x - 700); // behind P1
    const hp0 = s.fighters[0]!.hp;
    s = run(s, 200, { p1: { ...emptyActions(), guard: true }, p2: emptyActions() });
    const hit = s.events.length >= 0 && s.fighters[0]!.hp < hp0;
    expect(hit).toBe(true);
  });
});

describe('fighters vs critters', () => {
  it('a fighter attack damages and can kill a critter', () => {
    let s = critterState(31);
    s = plant(s, 'crystal_scarab', s.fighters[0]!.x + 500);
    const attack: StepInputs = { p1: { ...emptyActions(), heavy: true }, p2: emptyActions() };
    let killed = false;
    for (let i = 0; i < 600 && !killed; i++) {
      // Mash heavy; each swing chips the scarab down.
      s = step(s, i % 40 === 0 ? attack : blank());
      if (s.events.some((e) => e.type === 'critter_defeated')) killed = true;
    }
    expect(killed).toBe(true);
  });

  it('killing a critter pays a meter bounty', () => {
    let s = critterState(33);
    s = plant(s, 'crystal_scarab', s.fighters[0]!.x + 500);
    const attack: StepInputs = { p1: { ...emptyActions(), heavy: true }, p2: emptyActions() };
    let fluxAtKill: number | null = null;
    let fluxBefore = s.fighters[0]!.flux;
    for (let i = 0; i < 600 && fluxAtKill === null; i++) {
      fluxBefore = s.fighters[0]!.flux;
      s = step(s, i % 40 === 0 ? attack : blank());
      if (s.events.some((e) => e.type === 'critter_defeated')) {
        fluxAtKill = s.fighters[0]!.flux;
      }
    }
    expect(fluxAtKill).not.toBeNull();
    expect(fluxAtKill!).toBeGreaterThan(fluxBefore);
  });

  it('wounded critters with a flee threshold run away', () => {
    const wolf = getCritterArchetype('shadow_wolf');
    expect(wolf.fleeHpPct).toBeGreaterThan(0);
    let s = critterState(37);
    s = plant(s, 'shadow_wolf', s.fighters[0]!.x + 500);
    s.critters[0]!.hp = 10; // one hit from bolting
    const attack: StepInputs = { p1: { ...emptyActions(), light: true }, p2: emptyActions() };
    let fled = false;
    for (let i = 0; i < 400 && !fled; i++) {
      s = step(s, i % 30 === 0 ? attack : blank());
      if (s.critters.some((c) => c.state === 'fleeing')) fled = true;
      if (s.critters.length === 0) break;
    }
    // Either it fled or it died outright — both are valid resolutions.
    expect(fled || s.critters.length === 0).toBe(true);
  });
});

describe('critter determinism (ADR-0002)', () => {
  it('identical seeds produce identical critter runs', () => {
    const a = run(critterState(101), 2500);
    const b = run(critterState(101), 2500);
    expect(getStateHash(a)).toBe(getStateHash(b));
    expect(serializeState(a)).toBe(serializeState(b));
  });

  it('different seeds diverge', () => {
    const a = run(critterState(201), 1800);
    const b = run(critterState(202), 1800);
    expect(getStateHash(a)).not.toBe(getStateHash(b));
  });

  it('survives a serialize → deserialize round-trip mid-hunt', async () => {
    const { deserializeState } = await import('../index.js');
    const s = run(critterState(303), 1200);
    expect(s.critters.length).toBeGreaterThan(0);
    const json = serializeState(s);
    const back = deserializeState(json);
    expect(serializeState(back)).toBe(json);
    // And keeps stepping in lockstep from the restored snapshot.
    expect(getStateHash(run(back, 300))).toBe(getStateHash(run(s, 300)));
  });

  it('produces no NaN positions or negative hp over a long hunt', () => {
    let s = critterState(404);
    for (let i = 0; i < 5000; i++) {
      s = step(s, blank());
      for (const c of s.critters) {
        expect(Number.isFinite(c.x)).toBe(true);
        expect(Number.isFinite(c.y)).toBe(true);
        expect(c.hp).toBeGreaterThan(0);
      }
      for (const f of s.fighters) expect(f.hp).toBeGreaterThanOrEqual(0);
    }
  });
});
