/**
 * Procedural critter bodies. No textures — each archetype is drawn from
 * primitives, animated off the simulation's own fields (age, windup, state)
 * so the visuals always agree with the deterministic core.
 *
 * Replace path for final art: keep `draw(ctx, critter, screen, opts)` and swap
 * the per-sprite routine for a sprite-sheet blit.
 */

import { getCritterArchetype, type CritterState } from '@aether-break/combat-core';

const TAU = Math.PI * 2;

export interface CritterDrawOpts {
  /** Pixels per world unit at the current zoom (bodies scale with the camera). */
  pxPerWu: number;
  /** Presentation tick for idle animation. */
  presentTick: number;
}

/** Health pip + name shown above a critter that has been damaged. */
function drawHealthPip(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  pct: number,
  tint: string,
): void {
  const w = 42;
  const h = 4;
  ctx.fillStyle = 'rgba(6,10,20,0.8)';
  ctx.fillRect(x - w / 2 - 1, topY - 1, w + 2, h + 2);
  ctx.fillStyle = tint;
  ctx.fillRect(x - w / 2, topY, w * Math.max(0, Math.min(1, pct)), h);
}

export function drawCritter(
  ctx: CanvasRenderingContext2D,
  c: CritterState,
  screen: { x: number; y: number },
  opts: CritterDrawOpts,
): void {
  const arch = getCritterArchetype(c.archetypeId);
  // Bodies are authored at ~1 world unit and scaled by the live zoom.
  const s = (opts.pxPerWu / 58) * 1.0;
  const hurt = c.hurtFlash > 0;
  const winding = c.windup > 0;
  const fleeing = c.state === 'fleeing';

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(c.facing * s, s);

  // Contact shadow keeps critters grounded in the scene.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 26, 7, 0, 0, TAU);
  ctx.fill();

  // Windup tell: the creature coils and flashes its tint.
  if (winding) {
    const pulse = 0.5 + 0.5 * Math.sin(c.windup * 0.6);
    ctx.shadowColor = arch.tint;
    ctx.shadowBlur = 14 + pulse * 16;
  }

  const body = hurt ? '#ffffff' : arch.tint;

  switch (arch.sprite) {
    case 'wolf':
      drawWolf(ctx, body, arch.tint, c, winding);
      break;
    case 'scarab':
      drawScarab(ctx, body, arch.tint, c, opts.presentTick);
      break;
    case 'spirit':
      drawSpirit(ctx, body, arch.tint, c, opts.presentTick);
      break;
    case 'creep':
    default:
      drawCreep(ctx, body, arch.tint, c, opts.presentTick);
      break;
  }

  ctx.restore();

  // UI overlay is drawn unscaled/unflipped so text never mirrors.
  const topY = screen.y - 66 * s;
  if (c.hp < c.maxHp) {
    drawHealthPip(ctx, screen.x, topY, c.hp / c.maxHp, arch.tint);
  }
  if (winding) {
    // "!" warning so the player can react to the incoming strike.
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', screen.x, topY - 8);
  }
  if (fleeing) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('fleeing', screen.x, topY - 6);
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ */
/* Archetype bodies                                                     */
/* ------------------------------------------------------------------ */

function drawWolf(
  ctx: CanvasRenderingContext2D,
  body: string,
  tint: string,
  c: CritterState,
  winding: boolean,
): void {
  const gait = Math.sin(c.age * 0.28) * (c.vx !== 0 ? 1 : 0.15);
  const crouch = winding ? 5 : 0;

  // Legs
  ctx.strokeStyle = '#1e1b3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -22 + crouch);
  ctx.lineTo(-16 + gait * 4, 0);
  ctx.moveTo(-6, -22 + crouch);
  ctx.lineTo(-4 - gait * 4, 0);
  ctx.moveTo(10, -22 + crouch);
  ctx.lineTo(12 - gait * 4, 0);
  ctx.moveTo(18, -22 + crouch);
  ctx.lineTo(20 + gait * 4, 0);
  ctx.stroke();

  // Torso
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(2, -30 + crouch, 22, 11, -0.06, 0, TAU);
  ctx.fill();

  // Haunch
  ctx.fillStyle = shade(tint, -0.2);
  ctx.beginPath();
  ctx.ellipse(-14, -30 + crouch, 10, 10, 0, 0, TAU);
  ctx.fill();

  // Head + snout
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(22, -36 + crouch, 10, 8, -0.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(29, -37 + crouch);
  ctx.lineTo(38, -33 + crouch);
  ctx.lineTo(29, -30 + crouch);
  ctx.closePath();
  ctx.fill();

  // Ears
  ctx.beginPath();
  ctx.moveTo(18, -43 + crouch);
  ctx.lineTo(21, -52 + crouch);
  ctx.lineTo(24, -43 + crouch);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-20, -32 + crouch);
  ctx.quadraticCurveTo(-32, -38 + gait * 5, -34, -26 + gait * 4);
  ctx.stroke();

  // Eye
  ctx.fillStyle = winding ? '#fff1a8' : '#fde68a';
  ctx.beginPath();
  ctx.arc(26, -38 + crouch, 2.1, 0, TAU);
  ctx.fill();
}

function drawScarab(
  ctx: CanvasRenderingContext2D,
  body: string,
  tint: string,
  c: CritterState,
  tick: number,
): void {
  const skitter = Math.sin(c.age * 0.7) * 1.6;

  // Legs
  ctx.strokeStyle = '#0e3a45';
  ctx.lineWidth = 2.4;
  for (let i = -1; i <= 1; i++) {
    const lx = i * 8;
    const swing = Math.sin(c.age * 0.7 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(lx, -12);
    ctx.lineTo(lx - 5 + swing, 0);
    ctx.moveTo(lx, -12);
    ctx.lineTo(lx + 5 - swing, 0);
    ctx.stroke();
  }

  // Carapace with a crystalline facet highlight
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -18 + skitter * 0.4, 15, 11, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shade(tint, 0.4);
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(-4, -26 + skitter * 0.4);
  ctx.lineTo(6, -22 + skitter * 0.4);
  ctx.lineTo(-2, -14 + skitter * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Shell seam
  ctx.strokeStyle = shade(tint, -0.35);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-12, -18 + skitter * 0.4);
  ctx.lineTo(13, -18 + skitter * 0.4);
  ctx.stroke();

  // Head + mandibles
  ctx.fillStyle = shade(tint, -0.25);
  ctx.beginPath();
  ctx.ellipse(15, -17 + skitter * 0.4, 5, 5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = shade(tint, -0.4);
  ctx.lineWidth = 1.8;
  const bite = Math.sin(tick * 0.3) * 1.4;
  ctx.beginPath();
  ctx.moveTo(19, -19);
  ctx.lineTo(24, -21 - bite);
  ctx.moveTo(19, -15);
  ctx.lineTo(24, -13 + bite);
  ctx.stroke();

  // Glow core
  ctx.fillStyle = '#e0fbff';
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tick * 0.12);
  ctx.beginPath();
  ctx.arc(0, -18, 3.4, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSpirit(
  ctx: CanvasRenderingContext2D,
  body: string,
  tint: string,
  c: CritterState,
  tick: number,
): void {
  const wob = Math.sin(tick * 0.06 + c.seedOffset) * 3;

  // Outer aura
  const g = ctx.createRadialGradient(0, -28 + wob, 4, 0, -28 + wob, 34);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, body);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -28 + wob, 34, 0, TAU);
  ctx.fill();

  // Trailing wisps
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 3; i++) {
    const p = tick * 0.05 + i * 2.1;
    ctx.beginPath();
    ctx.moveTo(-6 - i * 5, -22 + wob);
    ctx.quadraticCurveTo(
      -18 - i * 6,
      -16 + Math.sin(p) * 6 + wob,
      -26 - i * 6,
      -24 + Math.cos(p) * 6 + wob,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Core
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath();
  ctx.arc(0, -28 + wob, 7, 0, TAU);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1f1400';
  ctx.beginPath();
  ctx.arc(4, -30 + wob, 1.8, 0, TAU);
  ctx.arc(-3, -30 + wob, 1.8, 0, TAU);
  ctx.fill();

  // Charge arcs while winding up
  if (c.windup > 0) {
    ctx.strokeStyle = '#fff7cc';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const a = (tick * 0.2 + i * 1.57) % TAU;
      ctx.beginPath();
      ctx.arc(0, -28 + wob, 18 + i * 2, a, a + 0.7);
      ctx.stroke();
    }
  }
}

function drawCreep(
  ctx: CanvasRenderingContext2D,
  body: string,
  tint: string,
  c: CritterState,
  tick: number,
): void {
  const pulse = Math.sin(c.age * 0.18) * 2;

  // Tendrils
  ctx.strokeStyle = shade(tint, -0.3);
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(tick * 0.12 + i * 1.3) * 4;
    ctx.beginPath();
    ctx.moveTo(i * 6, -14);
    ctx.quadraticCurveTo(i * 8 + sway, -6, i * 9 + sway, 0);
    ctx.stroke();
  }

  // Blob body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -22 - pulse * 0.3, 16 + pulse * 0.4, 14 - pulse * 0.3, 0, 0, TAU);
  ctx.fill();

  // Void rim
  ctx.strokeStyle = shade(tint, 0.45);
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -22 - pulse * 0.3, 16 + pulse * 0.4, 14 - pulse * 0.3, 0, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Eyes — a cluster, because it's a void thing
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    const ex = 2 + i * 5 - 5;
    const ey = -26 + (i % 2) * 6;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#1a0b16';
  for (let i = 0; i < 3; i++) {
    const ex = 2 + i * 5 - 5;
    const ey = -26 + (i % 2) * 6;
    ctx.beginPath();
    ctx.arc(ex + 0.6, ey, 1.2, 0, TAU);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Colour helpers                                                       */
/* ------------------------------------------------------------------ */

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const r = Math.round(((n >> 16) & 0xff) * (1 - p) + t * p);
  const g = Math.round(((n >> 8) & 0xff) * (1 - p) + t * p);
  const b = Math.round((n & 0xff) * (1 - p) + t * p);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
