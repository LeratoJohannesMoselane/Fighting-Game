/**
 * Aether Break — playable client.
 * Menu system (router screens) → character select→ local/CPU/arcade/training match.
 * Presentation adapter only: samples input, steps CombatCore at 60 Hz, draws canvas.
 */

import {
  emptyActions,
  MAX_FLUX,
  ROUND_TICKS,
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
import { ArenaRenderer } from './render';
import { ARCADE_LADDER, arcadeStage, getMeta, type MatchConfig } from './roster';
import { recordMatch } from './services/records';
import { getSettings, subscribeSettings, type Settings } from './services/settings';
import { proceduralAssets } from './procedural';
import { initMenus } from './ui/screens';
import './ui/theme.css';

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

type Screen = 'menu' | 'fight';

let screen: Screen = 'menu';
let matchConfig: MatchConfig | null = null;
let state: GameState | null = null;
let cpu: CpuController | null = null;
let accumulatorMs = 0;
let lastTs = performance.now();
let shake = 0;
let resultRecorded = false;
let resultHandled = false;

function freshSeed(): number {
  return (Date.now() % 2147483646) + 1;
}

/* ------------------------------------------------------------------ */
/* Settings application (live)                                         */
/* ------------------------------------------------------------------ */

const fpsEl = document.getElementById('fps');

function applySettings(s: Settings, toRuntime: boolean): void {
  // audio
  proceduralAssets.audio.setEnabled(s.audio.enabled);
  proceduralAssets.audio.setMasterVolume(s.audio.master / 100);
  // particles
  proceduralAssets.vfx.setDensity(s.graphics.particles === 'high' ? 1 : 0.45);
  // body classes
  document.body.classList.toggle('ae-contrast', s.accessibility.highContrast);
  document.body.classList.toggle('ae-large', s.accessibility.largeText);
  document.body.classList.toggle('ae-flash-off', s.accessibility.reduceFlashes);
  // fps counter
  if (fpsEl) fpsEl.style.display = s.graphics.fpsCounter ? '' : 'none';
  // runtime defaults applied on next match start
  if (toRuntime) {
    input.showHitboxes = s.graphics.hitboxes;
  }
}

subscribeSettings((s) => applySettings(s, false));
applySettings(getSettings(), true);

/* ------------------------------------------------------------------ */
/* Menu system                                                         */
/* ------------------------------------------------------------------ */

const menus = initMenus(appRoot, {
  launch: (cfg) => {
    menus.close();
    startMatch(cfg);
  },
  launchArcadeStage: (p1Id, stageIndex) => {
    menus.close();
    startArcadeStage(p1Id, stageIndex);
  },
  idle: () => {
    /* title idles; future home of attract mode */
  },
});

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
  if (p1Name) p1Name.style.color = p1.color;
  if (p2Name) p2Name.style.color = p2.color;
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
  getKit(cfg.p1Id);
  getKit(cfg.p2Id);

  cpu =
    cfg.opponentMode === 'cpu' ? new CpuController(1, cfg.cpuDifficulty, seed ^ 0x5f3759df) : null;

  // Presentation: colorways + settings-driven defaults
  const s = getSettings();
  proceduralAssets.setColorways(s.colorways.p1, s.colorways.p2);
  input.showHitboxes = s.graphics.hitboxes;

  // Drain stale menu/rematch requests queued while menus were open
  input.consumeMenu();
  input.consumeRematch();

  applyRosterLabels(cfg);
  accumulatorMs = 0;
  shake = 0;
  resultRecorded = false;
  resultHandled = false;
  screen = 'fight';
  input.fighting = true;
  input.paused = false;
  renderer.resetMatch();
  renderer.unlockAudio();
  canvas.focus();
}

function startArcadeStage(p1Id: string, stageIndex: number): void {
  const stage = arcadeStage(stageIndex);
  const cfg: MatchConfig = {
    p1Id,
    p2Id: stage.p2Id,
    opponentMode: 'cpu',
    cpuDifficulty: stage.difficulty,
    mode: 'arcade',
    arcadeStage: stageIndex,
  };
  startMatch(cfg);
}

function returnToMenu(): void {
  screen = 'menu';
  state = null;
  cpu = null;
  matchConfig = null;
  input.fighting = false;
  input.paused = false;
  menus.openMain();
}

function rematch(): void {
  if (!matchConfig) {
    returnToMenu();
    return;
  }
  startMatch(matchConfig);
}

function handleEvents(events: GameEvent[], s: GameState): void {
  renderer.handleEvents(events, s);
  const set_ = getSettings();
  const flashesOn = set_.graphics.flashes && !set_.accessibility.reduceFlashes;

  for (const e of events) {
    if (e.type === 'hit') {
      shake = Math.min(1, shake + 0.7);
      if (flashesOn) hud.flashHit();
    } else if (e.type === 'blocked') {
      shake = Math.min(1, shake + 0.25);
    } else if (e.type === 'ultimate_activated' || e.type === 'awakening_activated') {
      shake = 1;
      if (flashesOn) hud.flashUltimate();
    } else if (e.type === 'ultimate_ready') {
      shake = Math.min(1, shake + 0.4);
    } else if (e.type === 'guard_crush') {
      shake = Math.min(1, shake + 0.55);
    } else if (e.type === 'death' || e.type === 'round_end') {
      shake = 1;
    }
  }
}

function sampleInputs(s: GameState): { p1: ActionBits; p2: ActionBits } {
  const human = input.sample();
  if (!matchConfig) return human;

  if (matchConfig.mode === 'training') {
    const dummy = matchConfig.training?.dummy ?? 'stand';
    if (dummy === 'stand') return { p1: human.p1, p2: emptyActions() };
    if (dummy === 'guard') return { p1: human.p1, p2: { ...emptyActions(), guard: true } };
    // dummy === 'cpu'
    return { p1: human.p1, p2: cpu ? cpu.think(s) : emptyActions() };
  }

  if ((matchConfig.opponentMode === 'cpu' || matchConfig.mode === 'arcade') && cpu) {
    return { p1: human.p1, p2: cpu.think(s) };
  }
  return human;
}

/** Training-session adjustments: infinite time, immortal fighters. */
function normalizeTraining(s: GameState): GameState {
  if (matchConfig?.mode !== 'training') return s;
  for (const f of s.fighters) {
    f.hp = f.maxHp;
    f.flux = MAX_FLUX;
    f.ultimate = MAX_FLUX;
  }
  s.timer = ROUND_TICKS; // ∞ display handled by HUD
  if (s.matchPhase !== 'fighting') {
    s.matchPhase = 'fighting';
    s.phaseTimer = 0;
  }
  if (s.matchWinner !== null) s.matchWinner = null;
  return s;
}

/** Route a finished match to records + arcade flow. */
function handleMatchResult(cfg: MatchConfig, s: GameState): void {
  if (!resultRecorded) {
    resultRecorded = true;
    recordMatch(cfg, {
      matchWinner: s.matchWinner,
      rounds: [s.fighters[0].wins, s.fighters[1].wins],
      tick: s.tick,
    });
  }
  if (cfg.mode !== 'arcade' || resultHandled) return;
  resultHandled = true;

  const stageIndex = cfg.arcadeStage ?? 0;
  input.fighting = false;
  screen = 'menu';
  if (s.matchWinner === 0) {
    if (stageIndex + 1 >= ARCADE_TOTAL) {
      menus.router.navigate('arcade-status', { result: 'victory', stageIndex, p1Id: cfg.p1Id });
    } else {
      menus.router.navigate('arcade-status', { result: 'win', stageIndex, p1Id: cfg.p1Id });
    }
  } else {
    menus.router.navigate('arcade-status', { result: 'lose', stageIndex, p1Id: cfg.p1Id });
  }
}

const ARCADE_TOTAL = ARCADE_LADDER.length;

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */

function frame(ts: number): void {
  const dt = Math.min(100, ts - lastTs);
  lastTs = ts;

  if (screen === 'menu' || !state || !matchConfig) {
    requestAnimationFrame(frame);
    return;
  }

  if (input.consumeMenu()) {
    returnToMenu();
    requestAnimationFrame(frame);
    return;
  }

  if (input.consumeRematch() && matchConfig.mode !== 'arcade') {
    rematch();
  }

  if (!input.paused && state.matchPhase !== 'result') {
    accumulatorMs += dt;
    let steps = 0;
    while (accumulatorMs >= TICK_MS && steps < 5) {
      const inputs = sampleInputs(state);
      state = normalizeTraining(step(state, inputs));
      handleEvents(state.events, state);
      accumulatorMs -= TICK_MS;
      steps += 1;
    }
  } else if (state.matchPhase === 'result') {
    accumulatorMs = 0;
    handleMatchResult(matchConfig, state);
  }

  const gfx = getSettings().graphics;
  const effectiveShake = gfx.shake ? shake : 0;
  shake = Math.max(0, shake - dt / 180);

  const p1Color = getMeta(matchConfig.p1Id).color;
  const p2Color = getMeta(matchConfig.p2Id).color;

  try {
    renderer.draw(state, {
      showHitboxes: input.showHitboxes,
      shake: effectiveShake,
      p1Color,
      p2Color,
    });
  } catch (err) {
    reportRenderError(err);
  }
  hud.update(state, input.paused, {
    p1Name: getMeta(matchConfig.p1Id).name,
    p2Name: getMeta(matchConfig.p2Id).name,
    opponentMode: matchConfig.opponentMode,
    cpuDifficulty: matchConfig.cpuDifficulty,
    mode: matchConfig.mode,
  });

  requestAnimationFrame(frame);
}

/**
 * Presentation guard: a drawing error must never kill the rAF loop.
 * Log unique render errors (capped) and keep simulating.
 */
const seenRenderErrors = new Set<string>();

function reportRenderError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (seenRenderErrors.has(msg) || seenRenderErrors.size >= 8) return;
  seenRenderErrors.add(msg);
  console.error('[render] draw failed (simulation continues):', err);
}

// Debug/testing handle (dev builds; harmless in production)
declare global {
  interface Window {
    __aether?: unknown;
  }
}
window.__aether = {
  menus,
  input,
  getSettings,
  get state() {
    return state;
  },
  set state(v: GameState | null) {
    state = v;
  },
  get screen() {
    return screen;
  },
};

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

input.fighting = false;
menus.openMain();
requestAnimationFrame(frame);

window.focus();
canvas.tabIndex = 0;
