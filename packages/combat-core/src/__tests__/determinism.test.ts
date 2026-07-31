import { describe, expect, it } from 'vitest';
import { createInitialState, getStateHash, serializeState, step } from '../index.js';
import { runReplay, scriptedInput } from '../../scripts/replay.js';
import { blankInputs, fightingState, hold, inputs } from './helpers.js';

describe('determinism', () => {
  it('10_000-frame scripted stream: identical hash and full state twice', () => {
    const a = runReplay(42, 10_000);
    const b = runReplay(42, 10_000);
    expect(a.hash).toBe(b.hash);
    expect(serializeState(a.state)).toBe(serializeState(b.state));
    expect(getStateHash(a.state)).toBe(a.hash);
  });

  it('seeded smoke across seeds: no NaN, negative HP/flux, or stuck intro', () => {
    const seeds = [1, 2, 7, 42, 99, 12345, 99991];
    for (const seed of seeds) {
      const { state } = runReplay(seed, 2_000);
      for (const f of state.fighters) {
        expect(Number.isFinite(f.x)).toBe(true);
        expect(Number.isFinite(f.y)).toBe(true);
        expect(Number.isFinite(f.vx)).toBe(true);
        expect(Number.isFinite(f.vy)).toBe(true);
        expect(f.hp).toBeGreaterThanOrEqual(0);
        expect(f.flux).toBeGreaterThanOrEqual(0);
        expect(Number.isNaN(f.hp)).toBe(false);
        expect(Number.isNaN(f.flux)).toBe(false);
      }
      // Should have left intro long ago
      expect(state.tick).toBe(2000);
      expect(state.matchPhase).not.toBe('menu');
    }
  });

  it('same inputs from same seed produce same hash after N steps', () => {
    const run = () => {
      let s = createInitialState({ seed: 55 });
      for (let i = 0; i < 500; i++) {
        s = step(s, scriptedInput(i));
      }
      return getStateHash(s);
    };
    expect(run()).toBe(run());
  });

  it('step does not mutate the previous state reference fields', () => {
    const s0 = fightingState(3);
    const x0 = s0.fighters[0].x;
    const s1 = step(s0, inputs({ right: true }));
    expect(s0.fighters[0].x).toBe(x0);
    expect(s1.fighters[0].x).not.toBe(x0);
    expect(s1.tick).toBe(s0.tick + 1);
  });

  it('idle lockstep stays stable', () => {
    let s = fightingState(8);
    const h = getStateHash(s);
    s = hold(s, blankInputs(), 10);
    // hash should change (timer ticks) but be finite
    expect(getStateHash(s)).not.toBe(h);
    expect(s.timer).toBeLessThan(90 * 60);
  });
});
