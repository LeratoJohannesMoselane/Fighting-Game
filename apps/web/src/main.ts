/**
 * Aether Break — playable greybox client.
 * Menu → character select → local human or CPU match.
 * Presentation adapter only: samples input, steps CombatCore at 60 Hz, draws canvas.
 */

import {
  TICK_MS,
  createInitialState,
  getKit,
  step,
  type ActionBits,
  type GameEvent,
  type GameState,
} from '@aether-break/combat-core';
import { CpuController } from './ai';
import { Hud } from './hud';
import { LocalInput } from './input';
import { mountCharacterMenu } from './menu';
import { ArenaRenderer } from './render';
import { getMeta, type MatchConfig } from './roster';

const canvasEl = document.getElementById('game');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('#game canvas required');
}
const canvas: HTMLCanvasElement = canvasEl;

const appRoot = document.getElementById('app');
if (!appRoot) throw new Error('#app missing');

const input = new LocalInput();
const renderer = new ArenaRenderer(canvas);
const hud = new Hud();
const menu = mountCharacterMenu(appRoot);

type Screen = 'menu' | 'fight';

let screen: Screen = 'menu';
let matchConfig: MatchConfig | null = null;
let state: GameState | null = null;
let cpu: CpuController | null = null;
let accumulatorMs = 0;
let lastTs = performance.now();
let shake = 0;

function freshSeed(): number {
  return (Date.now() % 2147483646) + 1;
}

function applyRosterLabels(cfg: MatchConfig): void {
  const p1 = getMeta(cfg.p1Id);
  const p2 = getMeta(cfg.p2Id);
  const p1Name = document.getElementById('p1-name');
  const p2Name = document.getElementById('p2-name');
  const p1Controls = document.getElementById('p1-controls-title');
  const p2Controls = document.getElementById('p2-controls-title');
  const p2Hint = document.getElementById('p2-controls-hint');
  if (p1Name) p1Name.textContent = p1.name.toUpperCase();
  if (p2Name) p2Name.textContent = p2.name.toUpperCase();
  if (p1Controls) p1Controls.textContent = `Player 1 — ${p1.name}`;
  if (p2Controls) {
    p2Controls.textContent =
      cfg.opponentMode === 'cpu'
        ? `CPU — ${p2.name} (${cfg.cpuDifficulty})`
        : `Player 2 — ${p2.name}`;
  }
  if (p2Hint) {
    p2Hint.textContent =
      cfg.opponentMode === 'cpu'
        ? 'AI controlled — no keyboard needed for P2'
        : '← → move · ↑ jump · J/K · L gun · U spell · I bomb/snake · O ult · / guard · . dash';
  }

  // Tint name colors from roster
  if (p1Name) (p1Name as HTMLElement).style.color = p1.color;
  if (p2Name) (p2Name as HTMLElement).style.color = p2.color;
}

function startMatch(cfg: MatchConfig): void {
  matchConfig = cfg;
  const seed = freshSeed();
  state = createInitialState({
    seed,
    mode: 'versus',
    p1Id: cfg.p1Id,
    p2Id: cfg.p2Id,
  });
  // Validate kits resolve (also warms content)
  getKit(cfg.p1Id);
  getKit(cfg.p2Id);

  cpu =
    cfg.opponentMode === 'cpu' ? new CpuController(1, cfg.cpuDifficulty, seed ^ 0x5f3759df) : null;

  applyRosterLabels(cfg);
  accumulatorMs = 0;
  shake = 0;
  screen = 'fight';
  menu.hide();
  input.fighting = true;
  renderer.resetMatch();
  renderer.unlockAudio();
  canvas.focus();
}

function returnToMenu(): void {
  screen = 'menu';
  state = null;
  cpu = null;
  matchConfig = null;
  input.fighting = false;
  input.paused = false;
  menu.show();
  void menu.waitForStart().then(startMatch);
}

function rematch(): void {
  if (!matchConfig) {
    returnToMenu();
    return;
  }
  startMatch(matchConfig);
}

function handleEvents(events: GameEvent[], s: GameState): void {
  // Procedural VFX + SFX (meshes/anim driven in renderer.draw)
  renderer.handleEvents(events, s);

  for (const e of events) {
    if (e.type === 'hit') {
      shake = Math.min(1, shake + 0.7);
      hud.flashHit();
    } else if (e.type === 'blocked') {
      shake = Math.min(1, shake + 0.25);
    } else if (e.type === 'ultimate_activated') {
      shake = 1;
      hud.flashUltimate();
    } else if (e.type === 'ultimate_ready') {
      shake = Math.min(1, shake + 0.4);
    } else if (e.type === 'death' || e.type === 'round_end') {
      shake = 1;
    }
  }
}

function sampleInputs(s: GameState): { p1: ActionBits; p2: ActionBits } {
  const human = input.sample();
  if (matchConfig?.opponentMode === 'cpu' && cpu) {
    return { p1: human.p1, p2: cpu.think(s) };
  }
  return human;
}

function frame(ts: number): void {
  const dt = Math.min(100, ts - lastTs);
  lastTs = ts;

  if (screen === 'menu' || !state || !matchConfig) {
    requestAnimationFrame(frame);
    return;
  }

  // Menu key from fight
  if (input.consumeMenu()) {
    returnToMenu();
    requestAnimationFrame(frame);
    return;
  }

  if (input.consumeRematch()) {
    if (state.matchPhase === 'result') rematch();
    else rematch();
  }

  if (!input.paused && state.matchPhase !== 'result') {
    accumulatorMs += dt;
    let steps = 0;
    while (accumulatorMs >= TICK_MS && steps < 5) {
      const inputs = sampleInputs(state);
      state = step(state, inputs);
      handleEvents(state.events, state);
      accumulatorMs -= TICK_MS;
      steps += 1;
    }
  } else if (state.matchPhase === 'result') {
    accumulatorMs = 0;
  }

  shake = Math.max(0, shake - dt / 180);

  const p1Color = getMeta(matchConfig.p1Id).color;
  const p2Color = getMeta(matchConfig.p2Id).color;

  renderer.draw(state, {
    showHitboxes: input.showHitboxes,
    shake,
    p1Color,
    p2Color,
  });
  hud.update(state, input.paused, {
    p1Name: getMeta(matchConfig.p1Id).name,
    p2Name: getMeta(matchConfig.p2Id).name,
    opponentMode: matchConfig.opponentMode,
    cpuDifficulty: matchConfig.cpuDifficulty,
  });

  requestAnimationFrame(frame);
}

// Boot into menu
input.fighting = false;
void menu.waitForStart().then(startMatch);
requestAnimationFrame(frame);

window.focus();
canvas.tabIndex = 0;
