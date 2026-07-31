/**
 * Determinism gate used by `pnpm test:determinism`.
 * Runs the same 10,000-frame scripted stream twice and asserts identical hash + serialised state.
 */

import { getStateHash, serializeState } from '../src/index.js';
import { runReplay } from './replay.js';

const SEED = 42;
const FRAMES = 10_000;

const a = runReplay(SEED, FRAMES);
const b = runReplay(SEED, FRAMES);

const hashA = a.hash;
const hashB = b.hash;
const serA = serializeState(a.state);
const serB = serializeState(b.state);

const hashMatch = hashA === hashB;
const stateMatch = serA === serB;

console.log(`seed=${SEED} frames=${FRAMES}`);
console.log(`run1 hash=${hashA}`);
console.log(`run2 hash=${hashB}`);
console.log(`hash_identical=${hashMatch}`);
console.log(`state_identical=${stateMatch}`);

if (!hashMatch || !stateMatch) {
  console.error('DETERMINISM FAILURE');
  process.exit(1);
}

// Sanity: hash equals getStateHash of either state
if (getStateHash(a.state) !== hashA) {
  console.error('hash self-check failed');
  process.exit(1);
}

console.log('DETERMINISM OK');
