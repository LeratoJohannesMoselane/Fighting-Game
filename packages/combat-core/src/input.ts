import { INPUT_BUFFER_FRAMES } from './constants.js';
import type { ActionBits } from './types.js';

/** Empty (all-false) action mask. */
export function emptyActions(): ActionBits {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    light: false,
    heavy: false,
    ranged: false,
    guard: false,
    dash: false,
    ability1: false,
    ability2: false,
    ultimate: false,
  };
}

/** Normalise partial input into a full ActionBits (unknown keys ignored). */
export function normalizeActions(partial: Partial<ActionBits> | null | undefined): ActionBits {
  const e = emptyActions();
  if (!partial) return e;
  e.left = !!partial.left;
  e.right = !!partial.right;
  e.up = !!partial.up;
  e.down = !!partial.down;
  e.jump = !!partial.jump;
  e.light = !!partial.light;
  e.heavy = !!partial.heavy;
  e.ranged = !!partial.ranged;
  e.guard = !!partial.guard;
  e.dash = !!partial.dash;
  e.ability1 = !!partial.ability1;
  e.ability2 = !!partial.ability2;
  e.ultimate = !!partial.ultimate;
  return resolveSOD(e);
}

/**
 * Simultaneous Opposite Direction resolution (SRS FR-011).
 * Left+Right → neutral horizontal. Up+Down → neutral vertical.
 */
export function resolveSOD(a: ActionBits): ActionBits {
  const out: ActionBits = { ...a };
  if (out.left && out.right) {
    out.left = false;
    out.right = false;
  }
  if (out.up && out.down) {
    out.up = false;
    out.down = false;
  }
  return out;
}

/** Push into a fixed-length ring buffer (oldest dropped). Mutates array in place on a clone. */
export function pushBuffer(buffer: ActionBits[], actions: ActionBits): ActionBits[] {
  const next = buffer.slice();
  next.push(actions);
  while (next.length > INPUT_BUFFER_FRAMES) {
    next.shift();
  }
  return next;
}

/** True if any buffered frame has the given action true (edge-friendly buffer consume). */
export function bufferHas(
  buffer: ActionBits[],
  key: keyof ActionBits,
): { hit: boolean; index: number } {
  for (let i = 0; i < buffer.length; i++) {
    const frame = buffer[i];
    if (frame && frame[key]) return { hit: true, index: i };
  }
  return { hit: false, index: -1 };
}

/** Clear a buffered action across the whole buffer after it is consumed. */
export function consumeBufferAction(buffer: ActionBits[], key: keyof ActionBits): ActionBits[] {
  return buffer.map((f) => {
    if (!f[key]) return f;
    const c: ActionBits = { ...f };
    c[key] = false;
    return c;
  });
}
