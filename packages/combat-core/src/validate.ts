import type { MoveData } from './types.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Hand-rolled MoveData schema validator (zero runtime deps — ADR-0002).
 * Returns a list of issues; empty means valid.
 */
export function validateMoveData(move: unknown, path = 'move'): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof move !== 'object' || move === null) {
    issues.push({ path, message: 'must be an object' });
    return issues;
  }
  const m = move as Record<string, unknown>;

  requireString(m, 'id', path, issues);
  requireString(m, 'input', path, issues);
  requireInt(m, 'startup', path, issues, 0);
  requireInt(m, 'recovery', path, issues, 0);

  if (!Array.isArray(m.active) || m.active.length !== 2) {
    issues.push({ path: `${path}.active`, message: 'must be [start, end]' });
  } else {
    if (!isInt(m.active[0]) || !isInt(m.active[1])) {
      issues.push({ path: `${path}.active`, message: 'bounds must be integers' });
    } else if ((m.active[0] as number) > (m.active[1] as number)) {
      issues.push({ path: `${path}.active`, message: 'start must be ≤ end' });
    }
  }

  if (!Array.isArray(m.hitboxes)) {
    issues.push({ path: `${path}.hitboxes`, message: 'must be an array' });
  } else {
    for (let i = 0; i < m.hitboxes.length; i++) {
      validateHitbox(m.hitboxes[i], `${path}.hitboxes[${i}]`, issues);
    }
  }

  validateBox(m.hurtbox, `${path}.hurtbox`, issues);
  validateOnHit(m.onHit, `${path}.onHit`, issues);
  validateOnBlock(m.onBlock, `${path}.onBlock`, issues);

  if (!Array.isArray(m.cancelTo)) {
    issues.push({ path: `${path}.cancelTo`, message: 'must be an array of strings' });
  } else {
    for (let i = 0; i < m.cancelTo.length; i++) {
      if (typeof m.cancelTo[i] !== 'string') {
        issues.push({ path: `${path}.cancelTo[${i}]`, message: 'must be string' });
      }
    }
  }

  return issues;
}

export function assertValidMove(move: MoveData): void {
  const issues = validateMoveData(move);
  if (issues.length > 0) {
    throw new Error(
      `Invalid MoveData (${move.id}): ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
    );
  }
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && (v | 0) === v;
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof obj[key] !== 'string' || (obj[key] as string).length === 0) {
    issues.push({ path: `${path}.${key}`, message: 'must be a non-empty string' });
  }
}

function requireInt(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  min?: number,
): void {
  const v = obj[key];
  if (!isInt(v)) {
    issues.push({ path: `${path}.${key}`, message: 'must be an integer' });
    return;
  }
  if (min !== undefined && v < min) {
    issues.push({ path: `${path}.${key}`, message: `must be ≥ ${min}` });
  }
}

function validateBox(box: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof box !== 'object' || box === null) {
    issues.push({ path, message: 'must be a box object' });
    return;
  }
  const b = box as Record<string, unknown>;
  for (const k of ['x', 'y', 'w', 'h']) {
    if (!isInt(b[k])) issues.push({ path: `${path}.${k}`, message: 'must be an integer' });
  }
}

function validateHitbox(h: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof h !== 'object' || h === null) {
    issues.push({ path, message: 'must be an object' });
    return;
  }
  const o = h as Record<string, unknown>;
  requireInt(o, 'frame', path, issues, 0);
  if (o.shape !== 'box') issues.push({ path: `${path}.shape`, message: 'must be "box"' });
  for (const k of ['x', 'y', 'w', 'h']) {
    if (!isInt(o[k])) issues.push({ path: `${path}.${k}`, message: 'must be an integer' });
  }
}

function validateOnHit(v: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof v !== 'object' || v === null) {
    issues.push({ path, message: 'must be an object' });
    return;
  }
  const o = v as Record<string, unknown>;
  requireInt(o, 'damage', path, issues, 0);
  requireInt(o, 'hitStun', path, issues, 0);
  requireInt(o, 'fluxGain', path, issues, 0);
}

function validateOnBlock(v: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof v !== 'object' || v === null) {
    issues.push({ path, message: 'must be an object' });
    return;
  }
  const o = v as Record<string, unknown>;
  requireInt(o, 'blockStun', path, issues, 0);
  requireInt(o, 'advantage', path, issues);
}
