import { describe, expect, it } from 'vitest';
import {
  MAX_MAGIC,
  MAX_STAMINA,
  MAX_ULTIMATE,
  createInitialState,
  emptyActions,
  step,
  type GameState,
} from '../index.js';
import { blankInputs, fightingState, hold, inputs } from './helpers.js';

/** Inject resources through a no-op step path (clone-safe). */
function withResources(
  s: GameState,
  slot: 0 | 1,
  patch: Partial<GameState['fighters'][0]>,
): GameState {
  const fighters: GameState['fighters'] = [
    slot === 0 ? { ...s.fighters[0], ...patch } : s.fighters[0],
    slot === 1 ? { ...s.fighters[1], ...patch } : s.fighters[1],
  ];
  // One blank step after patch via direct object — step will re-serialize.
  return step({ ...s, fighters }, blankInputs());
}

describe('resources: stamina, magic, ultimate', () => {
  it('starts full stamina/magic and empty ultimate', () => {
    const s = createInitialState({ seed: 1 });
    expect(s.fighters[0].stamina).toBe(MAX_STAMINA);
    expect(s.fighters[0].magic).toBe(MAX_MAGIC);
    expect(s.fighters[0].ultimate).toBe(0);
    expect(s.fighters[0].flux).toBe(0);
  });

  it('gun spends stamina and magic', () => {
    let s = fightingState(5);
    const sta0 = s.fighters[0].stamina;
    const mag0 = s.fighters[0].magic;
    s = hold(s, inputs({ ranged: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].stamina).toBeLessThan(sta0);
    expect(s.fighters[0].magic).toBeLessThan(mag0);
    expect(s.fighters[0].stamina).toBe(sta0 - 18);
    expect(s.fighters[0].magic).toBe(mag0 - 12);
  });

  it('spell spends magic', () => {
    let s = fightingState(6);
    const mag0 = s.fighters[0].magic;
    s = hold(s, inputs({ ability1: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].magic).toBeLessThan(mag0);
  });

  it('melee hit restores stamina/magic and builds ultimate', () => {
    let s = fightingState(11);
    s = hold(s, inputs({ right: true }, { left: true }), 80);
    s = hold(s, blankInputs(), 5);
    // Drain with guns
    s = hold(s, inputs({ ranged: true }), 1);
    s = hold(s, blankInputs(), 25);
    s = hold(s, inputs({ ranged: true }), 1);
    s = hold(s, blankInputs(), 25);

    const sta1 = s.fighters[0].stamina;
    const mag1 = s.fighters[0].magic;
    const ult1 = s.fighters[0].ultimate;
    expect(sta1).toBeLessThan(MAX_STAMINA);

    // Close and light
    s = hold(s, inputs({ right: true }, { left: true }), 20);
    s = hold(s, inputs({ light: true }), 1);
    s = hold(s, blankInputs(), 25);

    expect(s.fighters[1].hp).toBeLessThan(1000);
    expect(s.fighters[0].stamina).toBeGreaterThan(sta1);
    expect(s.fighters[0].magic).toBeGreaterThan(mag1);
    expect(s.fighters[0].ultimate).toBeGreaterThan(ult1);
    expect(s.fighters[0].flux).toBe(s.fighters[0].ultimate);
  });

  it('ultimate denied without full meter', () => {
    let s = fightingState(3);
    expect(s.fighters[0].ultimate).toBe(0);
    s = hold(s, inputs({ ultimate: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].phase).not.toBe('attack');
    expect(s.fighters[0].ultimate).toBe(0);
  });

  it('full ultimate fires Awakening and drains meter + magic', () => {
    let s = fightingState(7);
    s = hold(s, inputs({ right: true }, { left: true }), 80);
    s = withResources(s, 0, {
      ultimate: MAX_ULTIMATE,
      flux: MAX_ULTIMATE,
      magic: MAX_MAGIC,
      stamina: MAX_STAMINA,
    });
    expect(s.fighters[0].ultimate).toBe(MAX_ULTIMATE);

    s = step(s, inputs({ ultimate: true }));
    // Attack starts same tick as press
    expect(s.fighters[0].phase).toBe('attack');
    expect(s.fighters[0].move?.moveId).toMatch(/event_horizon|last_foundry|sevenfold/);
    expect(s.fighters[0].ultimate).toBe(0);
    expect(s.fighters[0].flux).toBe(0);
    expect(s.fighters[0].magic).toBe(MAX_MAGIC - 35);
    expect(s.events.some((e) => e.type === 'ultimate_activated')).toBe(true);
  });

  it('cannot fire gun at zero stamina', () => {
    let s = fightingState(9);
    s = withResources(s, 0, { stamina: 0, magic: 100 });
    s = step(s, inputs({ ranged: true }));
    s = step(s, { p1: emptyActions(), p2: emptyActions() });
    expect(s.fighters[0].phase).not.toBe('attack');
  });

  it('dash spends stamina', () => {
    let s = fightingState(4);
    const sta0 = s.fighters[0].stamina;
    s = hold(s, inputs({ dash: true, right: true }), 1);
    expect(s.fighters[0].stamina).toBe(sta0 - 12);
  });
});
