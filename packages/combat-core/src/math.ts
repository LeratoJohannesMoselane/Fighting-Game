import { FP_SCALE, LCG_MOD, LCG_MUL } from './constants.js';

/** Clamp integer v into [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v | 0;
}

/** Absolute value for integers (no Math.abs — keeps intent explicit; Math.abs is fine but we avoid float habits). */
export function iabs(v: number): number {
  return v < 0 ? -v : v;
}

/** Convert a world float-ish number into fixed-point (only for content authoring helpers). */
export function toFp(world: number): number {
  return (world * FP_SCALE) | 0;
}

/** Convert fixed-point to world units (presentation only; not used in sim). */
export function fromFp(fp: number): number {
  return fp / FP_SCALE;
}

/**
 * Park–Miller minimal standard LCG: seed' = (16807 * seed) mod (2^31 − 1).
 * Returns [nextState, value in 0..MOD-1].
 * Never uses Math.random.
 */
export function lcgNext(state: number): [number, number] {
  let s = state | 0;
  if (s <= 0) s = 1;
  // Use 32-bit mul via Math.imul for deterministic overflow-free multiply on the modulus range.
  const next = imulMod(LCG_MUL, s, LCG_MOD);
  return [next, next];
}

/** (a * b) % m for m = 2^31-1 without BigInt (Schrage-style safe mul). */
function imulMod(a: number, b: number, m: number): number {
  // Schrage algorithm: avoids intermediate overflow for Park–Miller.
  const q = (m / a) | 0;
  const r = m % a;
  const t = a * (b % q) - r * ((b / q) | 0);
  return t < 0 ? t + m : t;
}

/** Deterministic integer in [0, maxExclusive) from LCG state; returns [nextState, value]. */
export function lcgInt(state: number, maxExclusive: number): [number, number] {
  const [next, v] = lcgNext(state);
  if (maxExclusive <= 0) return [next, 0];
  return [next, v % maxExclusive];
}

/** Axis-aligned rectangle overlap. Boxes are in world space. */
export function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Transform a fighter-local box (x positive along facing) into world AABB origin+size.
 * Local box x is the offset of the near edge along facing; w extends further along facing.
 */
export function localBoxToWorld(
  fighterX: number,
  fighterY: number,
  facing: 1 | -1,
  box: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  if (facing === 1) {
    return {
      x: fighterX + box.x,
      y: fighterY + box.y,
      w: box.w,
      h: box.h,
    };
  }
  // Facing left: mirror around fighter origin.
  return {
    x: fighterX - box.x - box.w,
    y: fighterY + box.y,
    w: box.w,
    h: box.h,
  };
}
