/**
 * Critter renderer smoke tests — every archetype, every lifecycle state,
 * drawn against a mock canvas to catch NaN geometry and missing branches.
 */
import { describe, expect, it } from 'vitest';
import {
  CRITTER_ARCHETYPES,
  type CritterPhase,
  type CritterState,
} from '@aether-break/combat-core';
import { drawCritter } from '../animals/CritterRenderer';

function mockCtx(): { ctx: CanvasRenderingContext2D; bad: string[]; calls: () => number } {
  const bad: string[] = [];
  let calls = 0;
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      const name = String(prop);
      if (name === 'canvas') return { width: 1280, height: 720 };
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        return (...a: unknown[]) => {
          for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(name);
          return gradient;
        };
      }
      if (name === 'measureText') return () => ({ width: 8 });
      return (...a: unknown[]) => {
        calls++;
        for (const v of a) {
          if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${name}(${String(v)})`);
        }
      };
    },
    set(_t, prop, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) bad.push(`${String(prop)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, bad, calls: () => calls };
}

function critter(archetypeId: string, over: Partial<CritterState> = {}): CritterState {
  const arch = CRITTER_ARCHETYPES.find((a) => a.id === archetypeId)!;
  return {
    id: 1,
    archetypeId,
    hp: arch.hp,
    maxHp: arch.hp,
    x: 0,
    y: arch.hoverY,
    vx: 0,
    facing: 1,
    state: 'approaching',
    targetSlot: 0,
    attackCooldown: 0,
    windup: 0,
    fleeTimer: 0,
    hurtFlash: 0,
    age: 0,
    invuln: 0,
    seedOffset: 0,
    ...over,
  };
}

const STATES: CritterPhase[] = ['idle', 'approaching', 'attacking', 'fleeing'];
const AT = { x: 640, y: 560 };
const OPTS = { pxPerWu: 118, presentTick: 0 };

describe('critter renderer', () => {
  for (const arch of CRITTER_ARCHETYPES) {
    it(`draws ${arch.id} in every state without NaN`, () => {
      const m = mockCtx();
      for (const state of STATES) {
        for (const facing of [1, -1] as const) {
          for (let age = 0; age < 90; age += 7) {
            drawCritter(
              m.ctx,
              critter(arch.id, { state, facing, age, windup: state === 'attacking' ? 12 : 0 }),
              AT,
              { ...OPTS, presentTick: age },
            );
          }
        }
      }
      expect(m.calls()).toBeGreaterThan(0);
      expect(m.bad).toEqual([]);
    });
  }

  it('shows a health pip only once damaged', () => {
    const full = mockCtx();
    drawCritter(full.ctx, critter('shadow_wolf'), AT, OPTS);
    const hurt = mockCtx();
    drawCritter(hurt.ctx, critter('shadow_wolf', { hp: 100 }), AT, OPTS);
    // The damaged draw issues extra fillRect calls for the pip.
    expect(hurt.calls()).toBeGreaterThan(full.calls());
    expect(hurt.bad).toEqual([]);
  });

  it('renders the hurt flash and windup tell', () => {
    const m = mockCtx();
    drawCritter(m.ctx, critter('void_creep', { hurtFlash: 8, windup: 20 }), AT, OPTS);
    expect(m.bad).toEqual([]);
  });

  it('scales with the camera zoom', () => {
    for (const pxPerWu of [40, 118, 260]) {
      const m = mockCtx();
      drawCritter(m.ctx, critter('storm_spirit'), AT, { pxPerWu, presentTick: 5 });
      expect(m.bad).toEqual([]);
    }
  });

  it('handles extreme ages without drifting into NaN', () => {
    const m = mockCtx();
    for (const age of [0, 1, 1000, 100000]) {
      drawCritter(m.ctx, critter('crystal_scarab', { age }), AT, { ...OPTS, presentTick: age });
    }
    expect(m.bad).toEqual([]);
  });
});
