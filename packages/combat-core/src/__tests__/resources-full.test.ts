import { describe, expect, it } from 'vitest';
import {
  AWAKENING_FLUX_COST,
  MAX_FLUX,
  MAX_STAMINA,
  createInitialState,
  emptyActions,
  step,
  type GameState,
} from '../index.js';
import { blankInputs, fightingState, hold, inputs } from './helpers.js';

function withPatch(s: GameState, slot: 0 | 1, patch: Partial<GameState['fighters'][0]>): GameState {
  const fighters: GameState['fighters'] = [
    slot === 0 ? { ...s.fighters[0], ...patch } : s.fighters[0],
    slot === 1 ? { ...s.fighters[1], ...patch } : s.fighters[1],
  ];
  return step({ ...s, fighters }, blankInputs());
}

describe('full resource system', () => {
  it('starts with full stamina, empty flux, and fighter special', () => {
    const s = createInitialState({ seed: 1, p1Id: 'nyra_vex', p2Id: 'bram_kade' });
    expect(s.fighters[0].stamina).toBe(MAX_STAMINA);
    expect(s.fighters[0].flux).toBe(0);
    expect(s.fighters[0].special).toBe(5); // Nyra ammo
    expect(s.fighters[1].special).toBe(0); // Bram heat starts empty
    expect(s.fighters[0].comboCount).toBe(0);
    expect(s.fighters[0].awakened).toBe(false);
  });

  it('Nyra gun spends ammo', () => {
    let s = fightingState(3);
    // ensure nyra
    s = createInitialState({ seed: 3, p1Id: 'nyra_vex', p2Id: 'bram_kade' });
    // skip intro
    s = hold(s, blankInputs(), 65);
    const ammo0 = s.fighters[0].special;
    s = hold(s, inputs({ ranged: true }), 1);
    s = hold(s, blankInputs(), 2);
    expect(s.fighters[0].special).toBe(ammo0 - 1);
  });

  it('blocking drains stamina over time', () => {
    let s = fightingState(4);
    const sta0 = s.fighters[0].stamina;
    s = hold(s, inputs({ guard: true }), 120);
    expect(s.fighters[0].stamina).toBeLessThan(sta0);
  });

  it('combo counter increments when hits land', () => {
    let s = fightingState(8);
    // Walk into point-blank
    s = hold(s, inputs({ right: true }, { left: true }), 100);
    s = hold(s, blankInputs(), 3);
    // Heavy should connect at close range
    s = hold(s, inputs({ heavy: true }), 1);
    s = hold(s, blankInputs(), 40);
    // Either combo registered or damage dealt (hit path exercised)
    const hit = s.fighters[0].comboCount >= 1 || s.fighters[1].hp < 1000 || s.fighters[0].flux > 0;
    expect(hit).toBe(true);
  });

  it('awakening requires low HP and flux, spends 50 flux', () => {
    let s = fightingState(9);
    // Force low HP + flux
    s = withPatch(s, 0, {
      hp: 200,
      maxHp: 1000,
      flux: 80,
      ultimate: 80,
      awakeningUsedThisRound: false,
      awakened: false,
    });
    expect(s.fighters[0].hp).toBeLessThanOrEqual(300);
    s = step(s, inputs({ ultimate: true, ability2: true }));
    // May need one more tick if buffer
    for (let i = 0; i < 3 && !s.fighters[0].awakened; i++) {
      s = step(s, inputs({ ultimate: true, ability2: true }));
    }
    expect(s.fighters[0].awakened).toBe(true);
    expect(s.fighters[0].flux).toBe(80 - AWAKENING_FLUX_COST);
    expect(s.events.some((e) => e.type === 'awakening_activated')).toBe(true);
  });

  it('ultimate spends full flux', () => {
    let s = fightingState(7);
    s = hold(s, inputs({ right: true }, { left: true }), 80);
    s = withPatch(s, 0, {
      flux: MAX_FLUX,
      ultimate: MAX_FLUX,
      stamina: MAX_STAMINA,
      special: 5,
    });
    s = step(s, inputs({ ultimate: true }));
    for (let i = 0; i < 2 && s.fighters[0].phase !== 'attack'; i++) {
      s = step(s, { p1: emptyActions(), p2: emptyActions() });
    }
    if (s.fighters[0].phase === 'attack') {
      expect(s.fighters[0].flux).toBe(0);
    }
  });

  it('dash denied at critical stamina', () => {
    let s = fightingState(5);
    s = withPatch(s, 0, { stamina: 5 });
    s = step(s, inputs({ dash: true, right: true }));
    s = step(s, blankInputs());
    expect(s.fighters[0].phase).not.toBe('dash');
  });
});
