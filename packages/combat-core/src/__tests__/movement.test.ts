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
    expect(s.fighters[0].magic).toBe(100);
  });

  it('reaches fighting after intro frames', () => {
    let s = createInitialState({ seed: 1 });
    s = stepN(s, blankInputs(), 61);
    expect(s.matchPhase).toBe('fighting');
  });
});
