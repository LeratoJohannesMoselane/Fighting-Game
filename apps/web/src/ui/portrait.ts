/**
 * Live procedural portraits — renders a fighter mesh (idle pose) into a
 * canvas. No art assets; reuses the in-game mesh pipeline with real
 * fighter state, so portraits always match what you play.
 */

import { createInitialState } from '@aether-break/combat-core';
import { ProceduralFighterMesh } from '../procedural/mesh';

let cachedState: ReturnType<typeof createInitialState> | null = null;
let cachedPair = '';

function poseState(fighterId: string) {
  if (!cachedState || cachedPair !== fighterId) {
    cachedState = createInitialState({
      seed: 1,
      mode: 'versus',
      p1Id: fighterId,
      p2Id: fighterId,
    });
    cachedPair = fighterId;
  }
  return cachedState.fighters[0]!;
}

/**
 * Draw a fighter portrait. `size` is the CSS pixel size; the canvas is
 * internally scaled for crispness.
 */
export function renderPortrait(
  canvas: HTMLCanvasElement,
  fighterId: string,
  colorway = 'classic',
  opts: { size?: number; tick?: number } = {},
): void {
  const size = opts.size ?? (canvas.clientWidth || 180);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mesh = ProceduralFighterMesh.generate(fighterId, colorway);
  const f = poseState(fighterId);
  mesh.update(f, opts.tick ?? 36);

  const s = (size * dpr) / 190; // mesh is ~170px tall in bind pose
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(s, s);
  mesh.draw(ctx, 95, 178, { facing: 1 });
  ctx.restore();
}

/** Wire renderPortrait into every `.cc-canvas` inside a container. */
export function hydratePortraits(
  root: HTMLElement,
  pick: (node: HTMLElement) => { id: string; way?: string; tick?: number } | null,
): void {
  root.querySelectorAll<HTMLElement>('.cc-canvas').forEach((node) => {
    const info = pick(node);
    if (!info || !(node instanceof HTMLCanvasElement)) return;
    try {
      renderPortrait(node, info.id, info.way ?? 'classic', { tick: info.tick });
    } catch {
      /* portrait optional — never break the menu */
    }
  });
}
