/**
 * CLI replay harness — cross-runtime determinism proof seed (SRS FR-010).
 *
 * Usage:
 *   pnpm replay -- --seed 42 --frames 10000
 *   tsx scripts/replay.ts --seed 42 --frames 10000
 *
 * Prints the final FNV-1a state hash (uint32) to stdout.
 * Does not open browsers (next milestone wires cross-runtime compare).
 */

import {
  createInitialState,
  emptyActions,
  getStateHash,
  serializeState,
  step,
  type ActionBits,
  type GameState,
} from '../src/index.js';

function parseArgs(argv: string[]): { seed: number; frames: number; dump: boolean } {
  let seed = 42;
  let frames = 10_000;
  let dump = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed' && argv[i + 1]) {
      seed = Number(argv[++i]);
    } else if (a === '--frames' && argv[i + 1]) {
      frames = Number(argv[++i]);
    } else if (a === '--dump') {
      dump = true;
    }
  }
  if (!Number.isFinite(seed) || !Number.isFinite(frames) || frames < 0) {
    console.error('Invalid --seed or --frames');
    process.exit(2);
  }
  return { seed: seed | 0, frames: frames | 0, dump };
}

/** Deterministic scripted input stream derived from frame index (no Math.random). */
export function scriptedInput(frame: number): { p1: ActionBits; p2: ActionBits } {
  const p1 = emptyActions();
  const p2 = emptyActions();
  const f = frame | 0;

  // P1 patterns
  p1.right = f % 37 < 18;
  p1.left = f % 41 > 30;
  p1.jump = f % 97 === 10;
  p1.light = f % 53 === 5;
  p1.heavy = f % 89 === 20;
  p1.ranged = f % 113 === 7;
  p1.guard = f % 61 > 50;
  p1.dash = f % 131 === 3;
  p1.ability1 = f % 151 === 11;

  // P2 patterns (offset)
  p2.left = f % 37 < 18;
  p2.right = f % 41 > 30;
  p2.jump = f % 97 === 40;
  p2.light = f % 53 === 25;
  p2.heavy = f % 89 === 50;
  p2.ranged = f % 113 === 60;
  p2.guard = f % 61 < 8;
  p2.dash = f % 131 === 70;
  p2.ability1 = f % 151 === 90;

  return { p1, p2 };
}

export function runReplay(seed: number, frames: number): { state: GameState; hash: number } {
  let state = createInitialState({ seed, mode: 'replay' });
  for (let i = 0; i < frames; i++) {
    state = step(state, scriptedInput(i));
  }
  return { state, hash: getStateHash(state) };
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('replay.ts') || process.argv[1].endsWith('replay.js'));

if (isMain) {
  const { seed, frames, dump } = parseArgs(process.argv.slice(2));
  const { state, hash } = runReplay(seed, frames);
  if (dump) {
    process.stdout.write(serializeState(state) + '\n');
  }
  process.stdout.write(String(hash) + '\n');
}
