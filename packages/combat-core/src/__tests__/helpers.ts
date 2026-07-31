import {
  createInitialState,
  emptyActions,
  ROUND_INTRO_FRAMES,
  step,
  type ActionBits,
  type GameState,
  type StepInputs,
} from '../index.js';

export function blankInputs(): StepInputs {
  return { p1: emptyActions(), p2: emptyActions() };
}

export function inputs(p1: Partial<ActionBits> = {}, p2: Partial<ActionBits> = {}): StepInputs {
  return {
    p1: { ...emptyActions(), ...p1 },
    p2: { ...emptyActions(), ...p2 },
  };
}

/** Fresh state advanced past round intro so fighters can act. */
export function fightingState(seed = 1): GameState {
  let s = createInitialState({ seed, mode: 'versus' });
  const idle = blankInputs();
  for (let i = 0; i < ROUND_INTRO_FRAMES + 1; i++) {
    s = step(s, idle);
  }
  if (s.matchPhase !== 'fighting') {
    throw new Error(`expected fighting phase, got ${s.matchPhase}`);
  }
  return s;
}

/**
 * Place fighters at a known close spacing for melee tests.
 * Uses only public step API + a short walk, then nudges via repeated micro-steps
 * against body separation (centres end ~BODY_HALF_WIDTH*2 apart).
 */
export function closeRangeState(seed = 21): GameState {
  let s = fightingState(seed);
  // Walk toward each other until separation stops them (~25–30 frames).
  for (let i = 0; i < 80; i++) {
    s = step(s, inputs({ right: true }, { left: true }));
  }
  // Settle velocities
  s = stepN(s, blankInputs(), 5);
  return s;
}

export function stepN(state: GameState, inp: StepInputs, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = step(s, inp);
  }
  return s;
}

/** Hold an action for `n` frames then idle. */
export function hold(state: GameState, inp: StepInputs, n: number): GameState {
  return stepN(state, inp, n);
}
