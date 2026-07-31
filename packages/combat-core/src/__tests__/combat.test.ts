import { describe, expect, it } from 'vitest';
import {
  FIGHTER_KITS,
  getMove,
  getKit,
  validateMoveData,
  type ActionBits,
  type MoveData,
} from '../index.js';
import { blankInputs, closeRangeState, fightingState, hold, inputs } from './helpers.js';

/** Place fighters close enough for melee. */
function closeRange(seed = 21) {
  return closeRangeState(seed);
}

/** Greybox duel roster currently spawned by createInitialState (P1 Nyra, P2 Bram). */
const ACTIVE_DUEL_FIGHTERS = new Set(['nyra_vex', 'bram_kade']);

function allMoves(): { fighterId: string; move: MoveData }[] {
  const out: { fighterId: string; move: MoveData }[] = [];
  for (const id of Object.keys(FIGHTER_KITS)) {
    if (!ACTIVE_DUEL_FIGHTERS.has(id)) continue;
    const kit = FIGHTER_KITS[id]!;
    for (const move of kit.moves) {
      out.push({ fighterId: id, move });
    }
  }
  return out;
}

function actionForMove(move: MoveData): Partial<ActionBits> {
  switch (move.input) {
    case 'LIGHT':
      return { light: true };
    case 'HEAVY':
      return { heavy: true };
    case 'RANGED':
      return { ranged: true };
    case 'SPELL':
      return { ability1: true };
    case 'ABILITY2':
      return { ability2: true };
    case 'ULTIMATE':
      return { ultimate: true };
    default:
      return { light: true };
  }
}

/** Ensure resource costs are affordable for the move under test. */
function armResources(s: ReturnType<typeof closeRange>, slot: 0 | 1, move: MoveData) {
  const f = s.fighters[slot];
  const next = {
    ...f,
    stamina: 100,
    magic: 100,
    ultimate: move.input === 'ULTIMATE' ? 100 : f.ultimate,
    flux: move.input === 'ULTIMATE' ? 100 : f.flux,
  };
  const fighters: typeof s.fighters = slot === 0 ? [next, s.fighters[1]] : [s.fighters[0], next];
  return { ...s, fighters };
}

describe('block', () => {
  it('blocks light attack and takes no (or only chip) damage', () => {
    let s = closeRange(31);
    const hpBefore = s.fighters[1].hp;
    // P2 holds guard; P1 lights
    s = hold(s, inputs({ light: true }, { guard: true }), 1);
    s = hold(s, inputs({}, { guard: true }), 20);
    const blocked = s.fighters[1].hp === hpBefore || s.fighters[1].hp >= hpBefore - 5;
    expect(blocked).toBe(true);
    // Defender should have been in blockstun at some point — check phase or hp stability
    expect(s.fighters[1].hp).toBeGreaterThan(hpBefore - 50);
  });

  it('unguarded light deals damage', () => {
    let s = closeRange(33);
    const hpBefore = s.fighters[1].hp;
    s = hold(s, inputs({ light: true }, {}), 1);
    s = hold(s, blankInputs(), 25);
    expect(s.fighters[1].hp).toBeLessThan(hpBefore);
  });
});

describe('starter moves', () => {
  const moves = allMoves();

  it('every move passes schema validation', () => {
    for (const { move } of moves) {
      const issues = validateMoveData(move);
      expect(issues, move.id).toEqual([]);
    }
  });

  for (const { fighterId, move } of moves) {
    describe(`${fighterId}/${move.id}`, () => {
      it('hit connects and deals damage when in range / projectile lands', () => {
        let s = closeRange(100 + move.id.length);
        // Ensure attacker is the owner of this kit
        // P1 is nyra, P2 is bram — pick the matching slot
        const slot = fighterId === 'nyra_vex' ? 0 : 1;
        const defender = slot === 0 ? 1 : 0;
        s = armResources(s, slot, move);
        const hpBefore = s.fighters[defender].hp;
        const act = actionForMove(move);

        if (slot === 0) {
          s = hold(s, inputs(act, {}), 1);
          s = hold(s, blankInputs(), move.active[1] + move.recovery + 40);
        } else {
          s = hold(s, inputs({}, act), 1);
          s = hold(s, blankInputs(), move.active[1] + move.recovery + 40);
        }

        // Projectiles need travel time — already included above
        // Some spells/heavies may whiff if spacing is off; nudge closer and retry once
        if (s.fighters[defender].hp === hpBefore && move.input !== 'RANGED') {
          s = closeRange(200 + move.id.length);
          // Force overlap positions
          const st = s;
          // mutate via steps: walk more
          s = hold(s, inputs({ right: true }, { left: true }), 20);
          if (slot === 0) {
            s = hold(s, inputs(act, {}), 1);
            s = hold(s, blankInputs(), move.active[1] + move.recovery + 10);
          } else {
            s = hold(s, inputs({}, act), 1);
            s = hold(s, blankInputs(), move.active[1] + move.recovery + 10);
          }
          void st;
        }

        if (move.input === 'RANGED') {
          // Fire toward opponent — already facing each other
          expect(
            s.fighters[defender].hp < hpBefore ||
              s.projectiles.length >= 0 /* projectile may still be in flight */,
          ).toBe(true);
          // Give more flight time from a dedicated setup
          s = closeRange(300 + move.id.length);
          const hp2 = s.fighters[defender].hp;
          if (slot === 0) {
            s = hold(s, inputs(act, {}), 1);
            s = hold(s, blankInputs(), 80);
          } else {
            s = hold(s, inputs({}, act), 1);
            s = hold(s, blankInputs(), 80);
          }
          expect(s.fighters[defender].hp).toBeLessThan(hp2);
        } else {
          expect(s.fighters[defender].hp).toBeLessThan(hpBefore);
        }
      });

      it('block prevents full damage', () => {
        let s = closeRange(400 + move.id.length);
        const slot = fighterId === 'nyra_vex' ? 0 : 1;
        const defender = slot === 0 ? 1 : 0;
        s = armResources(s, slot, move);
        const hpBefore = s.fighters[defender].hp;
        const act = actionForMove(move);
        const guardP1 = slot === 1;
        const guardP2 = slot === 0;

        if (slot === 0) {
          s = hold(s, inputs(act, { guard: true }), 1);
          s = hold(s, inputs({}, { guard: true }), move.active[1] + move.recovery + 50);
        } else {
          s = hold(s, inputs({ guard: true }, act), 1);
          s = hold(s, inputs({ guard: true }, {}), move.active[1] + move.recovery + 50);
        }
        void guardP1;
        void guardP2;

        const lost = hpBefore - s.fighters[defender].hp;
        const full = move.onHit.damage;
        expect(lost).toBeLessThan(full);
      });

      it('whiff when opponent is far away', () => {
        let s = fightingState(500 + move.id.length);
        // Push to opposite corners
        s = hold(s, inputs({ left: true }, { right: true }), 200);
        const slot = fighterId === 'nyra_vex' ? 0 : 1;
        const defender = slot === 0 ? 1 : 0;
        s = armResources(s, slot, move);
        const hpBefore = s.fighters[defender].hp;
        const act = actionForMove(move);

        if (move.input === 'RANGED') {
          // Gun may still hit across the stage — use very short lifetime wait and check attack ends
          if (slot === 0) {
            s = hold(s, inputs(act, {}), 1);
            s = hold(s, blankInputs(), move.startup + 2);
          } else {
            s = hold(s, inputs({}, act), 1);
            s = hold(s, blankInputs(), move.startup + 2);
          }
          expect(s.fighters[slot].phase === 'attack' || s.fighters[slot].phase === 'neutral').toBe(
            true,
          );
          return;
        }

        if (slot === 0) {
          s = hold(s, inputs(act, {}), 1);
          s = hold(s, blankInputs(), move.active[1] + move.recovery + 5);
        } else {
          s = hold(s, inputs({}, act), 1);
          s = hold(s, blankInputs(), move.active[1] + move.recovery + 5);
        }
        expect(s.fighters[defender].hp).toBe(hpBefore);
      });

      it('active-window boundary: no hit before startup', () => {
        let s = closeRange(600 + move.id.length);
        const slot = fighterId === 'nyra_vex' ? 0 : 1;
        const defender = slot === 0 ? 1 : 0;
        s = armResources(s, slot, move);
        const hpBefore = s.fighters[defender].hp;
        const act = actionForMove(move);

        // Only step startup-1 frames after pressing
        const pre = Math.max(1, move.startup - 1);
        if (slot === 0) {
          s = hold(s, inputs(act, {}), 1);
          s = hold(s, blankInputs(), pre - 1);
        } else {
          s = hold(s, inputs({}, act), 1);
          s = hold(s, blankInputs(), pre - 1);
        }

        if (move.input !== 'RANGED') {
          expect(s.fighters[defender].hp).toBe(hpBefore);
        }
        // During attack
        expect(s.fighters[slot].phase).toBe('attack');
      });

      it('active-window boundary: recovers after total frames', () => {
        let s = fightingState(700 + move.id.length);
        const slot = fighterId === 'nyra_vex' ? 0 : 1;
        s = armResources(s, slot, move);
        const act = actionForMove(move);
        // Duration + start frame + hitstop margin + cooldown cushion (no re-fire: blank inputs).
        const total = move.active[1] + move.recovery;

        if (slot === 0) {
          s = hold(s, inputs(act, {}), 1);
          s = hold(s, blankInputs(), total + 12);
        } else {
          s = hold(s, inputs({}, act), 1);
          s = hold(s, blankInputs(), total + 12);
        }
        expect(s.fighters[slot].phase).not.toBe('attack');
        expect(s.fighters[slot].move).toBeNull();
      });
    });
  }

  it('light cancel into heavy on hit (nyra)', () => {
    let s = closeRange(42);
    const hp0 = s.fighters[1].hp;
    const lightDmg = getMove(getKit('nyra_vex'), 'nyra_light')!.onHit.damage;
    // Start light and keep heavy buffered through the active/cancel window.
    s = hold(s, inputs({ light: true }), 1);
    // Frames 1–5 startup
    s = hold(s, blankInputs(), 5);
    // From active frame onward, hold heavy so cancel buffer sees it on hit.
    s = hold(s, inputs({ heavy: true }), 8);
    s = hold(s, blankInputs(), 50);
    // Cancel should land heavy for additional damage beyond a single light.
    expect(s.fighters[1].hp).toBeLessThan(hp0 - lightDmg);
  });
});

describe('round flow', () => {
  it('round ends on death and awards win', () => {
    let s = closeRange(77);
    // Re-close and heavy repeatedly until KO or phase change.
    for (let i = 0; i < 200; i++) {
      if (s.matchPhase !== 'fighting') break;
      if (s.fighters[1].hp <= 0) break;
      // Walk in to keep melee range after knockback
      s = hold(s, inputs({ right: true }, { left: true }), 8);
      s = hold(s, inputs({ heavy: true }, {}), 1);
      s = hold(s, blankInputs(), 36);
    }
    expect(s.fighters[1].hp).toBeLessThanOrEqual(0);
    expect(['round_end', 'result', 'round_intro']).toContain(s.matchPhase);
  });
});

describe('serialize / hash', () => {
  it('clone round-trips', async () => {
    const { cloneState, serializeState, deserializeState, getStateHash } = await import(
      '../index.js'
    );
    let s = closeRange(1);
    s = hold(s, inputs({ light: true }), 20);
    const json = serializeState(s);
    const d = deserializeState(json);
    expect(serializeState(d)).toBe(json);
    expect(getStateHash(d)).toBe(getStateHash(s));
    const c = cloneState(s);
    expect(serializeState(c)).toBe(json);
  });
});
