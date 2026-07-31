/**
 * Aether Break — playable greybox client.
 * Presentation adapter only: samples input, steps CombatCore at 60 Hz, draws canvas.
 */

import {
  TICK_MS,
  createInitialState,
  fromFp,
  step,
  type GameEvent,
  type GameState,
} from '@aether-break/combat-core';
import { Hud } from './hud';
import { LocalInput } from './input';
import { ArenaRenderer } from './render';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game canvas required');
}

const input = new LocalInput();
const renderer = new ArenaRenderer(canvas);
const hud = new Hud();

let state: GameState = createInitialState({
  seed: (Date.now() % 2147483646) + 1,
  mode: 'versus',
});

let accumulatorMs = 0;
let lastTs = performance.now();
let shake = 0;

function rematch(): void {
  state = createInitialState({
    seed: (Date.now() % 2147483646) + 1,
    mode: 'versus',
  });
  shake = 0;
}

function handleEvents(events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'hit') {
      const attacker = state.fighters[e.attacker];
      const defender = state.fighters[e.defender];
      renderer.pulseHit(
        fromFp(defender.x),
        fromFp(defender.y + 800),
        attacker.slot === 0 ? '#2ee6c5' : '#ff4d6d',
        false,
      );
      shake = Math.min(1, shake + 0.7);
      hud.flashHit();
    } else if (e.type === 'blocked') {
      const defender = state.fighters[e.defender];
      renderer.pulseHit(fromFp(defender.x), fromFp(defender.y + 800), '#93c5fd', true);
      shake = Math.min(1, shake + 0.25);
    } else if (e.type === 'death' || e.type === 'round_end') {
      shake = 1;
    }
  }
}

function frame(ts: number): void {
  const dt = Math.min(100, ts - lastTs);
  lastTs = ts;

  if (input.consumeRematch()) {
    rematch();
  }

  if (!input.paused && state.matchPhase !== 'result') {
    accumulatorMs += dt;
    // Fixed 60 Hz sim — catch up at most 5 ticks/frame to avoid spiral of death.
    let steps = 0;
    while (accumulatorMs >= TICK_MS && steps < 5) {
      const inputs = input.sample();
      state = step(state, inputs);
      handleEvents(state.events);
      accumulatorMs -= TICK_MS;
      steps += 1;
    }
  } else if (state.matchPhase === 'result') {
    // Still allow rematch sampling path above.
    accumulatorMs = 0;
  }

  shake = Math.max(0, shake - dt / 180);

  renderer.draw(state, {
    showHitboxes: input.showHitboxes,
    shake,
  });
  hud.update(state, input.paused);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Focus the page so keys work immediately.
window.focus();
canvas.tabIndex = 0;
canvas.focus();
