import { describe, expect, it } from 'vitest';
import { ARENA_HALF_WIDTH, GROUND_Y, createInitialState, getKit } from '../index.js';
import { blankInputs, fightingState, hold, inputs, stepN } from './helpers.js';

describe('movement', () => {
  it('walks right within arena bounds', () => {
    let s = fightingState(7);
    const startX = s.fighters[0].x;
    s = hold(s, inputs({ right: true }), 30);
    expect(s.fighters[0].x).toBeGreaterThan(startX);
    expect(s.fighters[0].x).toBeLessThanOrEqual(ARENA_HALF_WIDTH);
    expect(s.fighters[0].phase).toBe('walk');
  });

  it('walks left within arena bounds', () => {
    let s = fightingState(7);
    const startX = s.fighters[0].x;
    s = hold(s, inputs({ left: true }), 30);
    expect(s.fighters[0].x).toBeLessThan(startX);
    expect(s.fighters[0].x).toBeGreaterThanOrEqual(-ARENA_HALF_WIDTH);
  });

  it('clamps at arena edge', () => {
    let s = fightingState(7);
    // Drive p1 hard left for a long time
    s = hold(s, inputs({ left: true }), 600);
    expect(s.fighters[0].x).toBe(-ARENA_HALF_WIDTH);
  });

  it('resolves simultaneous opposite directions to neutral', () => {
    let s = fightingState(3);
    const x0 = s.fighters[0].x;
    s = hold(s, inputs({ left: true, right: true }), 20);
    expect(s.fighters[0].x).toBe(x0);
    expect(s.fighters[0].phase).toBe('neutral');
  });

  it('Nyra walks faster than Bram', () => {
    let s = fightingState(9);
    // Move them apart first so facing doesn't flip mid-test oddly
    s = hold(s, inputs({ left: true }, { right: true }), 10);
    const nyraStart = s.fighters[0].x;
    const bramStart = s.fighters[1].x;
    s = hold(s, inputs({ right: true }, { left: true }), 40);
    const nyraDist = Math.abs(s.fighters[0].x - nyraStart);
    const bramDist = Math.abs(s.fighters[1].x - bramStart);
    expect(nyraDist).toBeGreaterThan(bramDist);
    expect(getKit('nyra_vex').base.walk).toBeGreaterThan(getKit('bram_kade').base.walk);
  });

  it('dash moves fighter quickly then recovers', () => {
    let s = fightingState(11);
    const x0 = s.fighters[0].x;
    s = hold(s, inputs({ dash: true, right: true }), 1);
    s = hold(s, blankInputs(), 5);
    expect(s.fighters[0].x).toBeGreaterThan(x0);
    // finish dash
    s = hold(s, blankInputs(), 30);
    expect(['neutral', 'walk', 'crouch']).toContain(s.fighters[0].phase);
  });
});

/**
 * Pacing guardrails (v0.2 tuning). These are deliberately expressed as
 * human-readable rates rather than raw constants so a future re-tune has to
 * consciously agree that the game still feels like a fighting game.
 */
describe('movement pacing', () => {
  const WU = (fp: number) => fp / 1000;

  it('walks 3–6 world units per second (not skating)', () => {
    let s = fightingState(51);
    const x0 = s.fighters[0].x;
    s = hold(s, inputs({ right: true }), 60); // exactly one second
    const perSecond = WU(s.fighters[0].x - x0);
    expect(perSecond).toBeGreaterThan(3);
    expect(perSecond).toBeLessThan(6);
  });

  it('takes at least 3 seconds to cross the full arena', () => {
    let s = fightingState(53);
    s = hold(s, inputs({ right: true }), 600); // pin to the right wall
    let frames = 0;
    while (s.fighters[0].x > -ARENA_HALF_WIDTH && frames < 2000) {
      s = hold(s, inputs({ left: true }), 1);
      frames += 1;
    }
    expect(frames / 60).toBeGreaterThan(3);
  });

  it('jump apex clears roughly one to two body heights', () => {
    let s = fightingState(55);
    s = hold(s, inputs({ jump: true }), 1);
    let apex = 0;
    for (let i = 0; i < 120; i++) {
      s = hold(s, blankInputs(), 1);
      if (s.fighters[0].y > apex) apex = s.fighters[0].y;
      if (s.fighters[0].y === GROUND_Y && i > 4) break;
    }
    // Hurtbox is 1.6 wu tall.
    expect(WU(apex)).toBeGreaterThan(1.6);
    expect(WU(apex)).toBeLessThan(4);
  });

  it('airtime is a readable arc, not a moon jump', () => {
    let s = fightingState(57);
    s = hold(s, inputs({ jump: true }), 1);
    let air = 0;
    for (let i = 0; i < 300; i++) {
      s = hold(s, blankInputs(), 1);
      if (s.fighters[0].y > GROUND_Y) air += 1;
      else if (air > 0) break;
    }
    expect(air).toBeGreaterThan(24);
    expect(air).toBeLessThan(70);
  });

  it('a dash covers roughly two body widths', () => {
    let s = fightingState(59);
    const x0 = s.fighters[0].x;
    s = hold(s, inputs({ dash: true, right: true }), 1);
    s = hold(s, blankInputs(), 25);
    const dist = WU(s.fighters[0].x - x0);
    // Body is 1.2 wu wide.
    expect(dist).toBeGreaterThan(1.2);
    expect(dist).toBeLessThan(4);
  });

  it('a dash outruns a walk over the same window', () => {
    const walked = (() => {
      let s = fightingState(61);
      const x0 = s.fighters[0].x;
      s = hold(s, inputs({ right: true }), 12);
      return s.fighters[0].x - x0;
    })();
    const dashed = (() => {
      let s = fightingState(61);
      const x0 = s.fighters[0].x;
      s = hold(s, inputs({ dash: true, right: true }), 1);
      s = hold(s, blankInputs(), 11);
      return s.fighters[0].x - x0;
    })();
    expect(dashed).toBeGreaterThan(walked);
  });

  it('fighters come to rest instead of sliding on ice', () => {
    let s = fightingState(63);
    s = hold(s, inputs({ right: true }), 30);
    s = hold(s, blankInputs(), 12);
    expect(s.fighters[0].vx).toBe(0);
  });

  it('a lunging attack does not glide across the stage', () => {
    let s = fightingState(65);
    const x0 = s.fighters[0].x;
    // Spell carries a forwardImpulse; it should step in, not skate.
    s = hold(s, inputs({ ability1: true }), 1);
    s = hold(s, blankInputs(), 60);
    expect(WU(Math.abs(s.fighters[0].x - x0))).toBeLessThan(2.5);
  });

  it('the round opens inside a walkable distance', () => {
    const s = fightingState(67);
    const gap = WU(s.fighters[1].x - s.fighters[0].x);
    expect(gap).toBeGreaterThan(3);
    expect(gap).toBeLessThan(10);
  });
});

describe('jump arcs', () => {
  it('leaves the ground and returns', () => {
    let s = fightingState(13);
    s = hold(s, inputs({ jump: true }), 1);
    s = hold(s, blankInputs(), 3);
    expect(s.fighters[0].y).toBeGreaterThan(GROUND_Y);
    // land
    s = hold(s, blankInputs(), 120);
    expect(s.fighters[0].y).toBe(GROUND_Y);
    expect(s.fighters[0].jumpUsed).toBe(false);
  });

  it('jump arc is deterministic across two runs', () => {
    const run = () => {
      let s = fightingState(99);
      s = hold(s, inputs({ jump: true }), 1);
      const ys: number[] = [];
      for (let i = 0; i < 80; i++) {
        s = hold(s, blankInputs(), 1);
        ys.push(s.fighters[0].y);
      }
      return ys;
    };
    expect(run()).toEqual(run());
  });

  it('cannot double-jump before landing', () => {
    let s = fightingState(15);
    s = hold(s, inputs({ jump: true }), 1);
    s = hold(s, blankInputs(), 5);
    const peakAttempt = s.fighters[0].y;
    s = hold(s, inputs({ jump: true }), 3);
    // y should be falling or not boosted beyond a fresh jump from ground
    expect(s.fighters[0].jumpUsed).toBe(true);
    // After more air time without landing, still not grounded
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].y).toBeGreaterThan(GROUND_Y);
    void peakAttempt;
  });
});

describe('initial state', () => {
  it('places Nyra left and Bram right with full HP', () => {
    const s = createInitialState({ seed: 1 });
    expect(s.fighters[0].id).toBe('nyra_vex');
    expect(s.fighters[1].id).toBe('bram_kade');
    expect(s.fighters[0].x).toBeLessThan(s.fighters[1].x);
    expect(s.fighters[0].hp).toBe(1000);
    expect(s.fighters[1].hp).toBe(1000);
    expect(s.fighters[0].flux).toBe(0);
    expect(s.fighters[0].ultimate).toBe(0);
    expect(s.fighters[0].stamina).toBe(100);
    expect(s.fighters[0].magic).toBe(100);
    expect(s.round).toBe(1);
    expect(s.matchPhase).toBe('round_intro');
  });

  it('accepts custom p1Id / p2Id roster picks', () => {
    const s = createInitialState({ seed: 2, p1Id: 'iria_sol', p2Id: 'nyra_vex' });
    expect(s.fighters[0].id).toBe('iria_sol');
    expect(s.fighters[1].id).toBe('nyra_vex');
    expect(s.fighters[0].hp).toBe(920);
    expect(s.fighters[1].hp).toBe(1000);
    expect(s.fighters[0].stamina).toBe(100);
    // Iria starts with 2/3 prism charges → magic alias ~66
    expect(s.fighters[0].special).toBe(2);
    expect(s.fighters[0].flux).toBe(0);
  });

  it('reaches fighting after intro frames', () => {
    let s = createInitialState({ seed: 1 });
    s = stepN(s, blankInputs(), 61);
    expect(s.matchPhase).toBe('fighting');
  });
});
