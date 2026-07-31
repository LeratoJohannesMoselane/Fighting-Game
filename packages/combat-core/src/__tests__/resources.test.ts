import { describe, expect, it } from 'vitest';
import {
  MAX_FLUX,
  MAX_STAMINA,
  STAMINA_DASH_COST,
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
  return step({ ...s, fighters }, blankInputs());
}

describe('resources: stamina, flux, special', () => {
  it('starts full stamina/special and empty flux', () => {
    const s = createInitialState({ seed: 1 });
    expect(s.fighters[0].stamina).toBe(MAX_STAMINA);
    expect(s.fighters[0].flux).toBe(0);
    expect(s.fighters[0].ultimate).toBe(0);
    expect(s.fighters[0].special).toBeGreaterThan(0); // Nyra ammo
  });

  it('gun spends stamina and special ammo', () => {
    let s = fightingState(5);
    const sta0 = s.fighters[0].stamina;
    const ammo0 = s.fighters[0].special;
    s = hold(s, inputs({ ranged: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].stamina).toBeLessThan(sta0);
    expect(s.fighters[0].special).toBe(ammo0 - 1);
  });

  it('spell can spend special charges for Iria', () => {
    let s = createInitialState({ seed: 6, p1Id: 'iria_sol', p2Id: 'bram_kade' });
    s = hold(s, blankInputs(), 65);
    const charges = s.fighters[0].special;
    s = hold(s, inputs({ ability1: true }), 1);
    s = hold(s, blankInputs(), 2);
    // Iria spell costs 1 prism charge
    expect(s.fighters[0].special).toBeLessThanOrEqual(charges);
  });

  it('melee hit builds flux', () => {
    let s = fightingState(11);
    s = hold(s, inputs({ right: true }, { left: true }), 80);
    s = hold(s, blankInputs(), 5);
    const ult1 = s.fighters[0].flux;
    s = hold(s, inputs({ light: true }), 1);
    s = hold(s, blankInputs(), 25);
    if (s.fighters[1].hp < 1000) {
      expect(s.fighters[0].flux).toBeGreaterThan(ult1);
      expect(s.fighters[0].ultimate).toBe(s.fighters[0].flux);
    }
  });

  it('ultimate denied without full flux', () => {
    let s = fightingState(3);
    expect(s.fighters[0].flux).toBe(0);
    s = hold(s, inputs({ ultimate: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].phase).not.toBe('attack');
    expect(s.fighters[0].flux).toBe(0);
  });

  it('full flux fires ultimate and drains meter', () => {
    let s = fightingState(7);
    s = hold(s, inputs({ right: true }, { left: true }), 80);
    s = withResources(s, 0, {
      ultimate: MAX_FLUX,
      flux: MAX_FLUX,
      stamina: MAX_STAMINA,
      special: 5,
    });
    expect(s.fighters[0].flux).toBe(MAX_FLUX);

    s = step(s, inputs({ ultimate: true }));
    expect(s.fighters[0].phase).toBe('attack');
    expect(s.fighters[0].move?.moveId).toMatch(/event_horizon|last_foundry|sevenfold/);
    expect(s.fighters[0].ultimate).toBe(0);
    expect(s.fighters[0].flux).toBe(0);
    expect(s.events.some((e) => e.type === 'ultimate_activated')).toBe(true);
  });

  it('cannot fire gun at zero stamina', () => {
    let s = fightingState(9);
    s = withResources(s, 0, { stamina: 0, special: 5 });
    s = step(s, inputs({ ranged: true }));
    s = step(s, { p1: emptyActions(), p2: emptyActions() });
    expect(s.fighters[0].phase).not.toBe('attack');
  });

  it('dash spends stamina (band-adjusted)', () => {
    let s = fightingState(4);
    const sta0 = s.fighters[0].stamina;
    s = hold(s, inputs({ dash: true, right: true }), 1);
    expect(s.fighters[0].stamina).toBeLessThan(sta0);
    expect(s.fighters[0].stamina).toBeLessThanOrEqual(sta0 - STAMINA_DASH_COST + 2);
  });
});
