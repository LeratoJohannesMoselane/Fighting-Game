/**
 * Arena presentation — background + procedural fighters/VFX.
 * Final art path: keep worldToScreen + draw contract; swap ProceduralAssetSystem internals.
 */

import {
  ARENA_HALF_WIDTH,
  FP_SCALE,
  fromFp,
  type GameEvent,
  type GameState,
  type ProjectileState,
} from '@aether-break/combat-core';
import { proceduralAssets } from './procedural';

const W = 1280;
const H = 720;
const GROUND_SCREEN_Y = 560;
const PX_PER_WU = 58;
const ORIGIN_X = W / 2;

export interface RenderOptions {
  showHitboxes: boolean;
  shake: number;
  p1Color?: string;
  p2Color?: string;
  presentTick?: number;
}

const DEFAULT_P1 = '#2ee6c5';
const DEFAULT_P2 = '#ff4d6d';

export class ArenaRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private presentTick = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    canvas.width = W;
    canvas.height = H;
  }

  resetMatch(): void {
    proceduralAssets.reset();
    this.presentTick = 0;
  }

  unlockAudio(): void {
    proceduralAssets.unlockAudio();
  }

  /** Forward combat events into procedural VFX/SFX. */
  handleEvents(events: GameEvent[], state: GameState): void {
    proceduralAssets.handleEvents(events, state);
  }

  /** Legacy helper used by main for extra juice — routes into procedural VFX. */
  pulseHit(worldX: number, worldY: number, color: string, blocked: boolean): void {
    const p = this.worldToScreen(worldX, worldY);
    proceduralAssets.vfx.spawn({
      kind: blocked ? 'block' : 'hit_heavy',
      x: p.x,
      y: p.y,
      color,
    });
  }

  draw(state: GameState, opts: RenderOptions): void {
    const ctx = this.ctx;
    this.presentTick += 1;

    const shakeX = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 6 : 0;
    const shakeY = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 4 : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

    this.drawBackground(state);
    this.drawArenaFloor();

    // Projectiles (simple procedural orbs — trails come from asset system)
    const p1c = opts.p1Color ?? DEFAULT_P1;
    const p2c = opts.p2Color ?? DEFAULT_P2;
    for (const p of state.projectiles) {
      this.drawProjectile(p, p.ownerSlot === 0 ? p1c : p2c);
    }

    proceduralAssets.draw(state, {
      ctx,
      worldToScreen: (x, y) => this.worldToScreen(x, y),
      showHitboxes: opts.showHitboxes,
      p1Color: p1c,
      p2Color: p2c,
      presentTick: opts.presentTick ?? this.presentTick,
    });

    ctx.restore();
    this.drawPhaseOverlay(state);
  }

  private drawBackground(state: GameState): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(0.55, '#121c30');
    g.addColorStop(1, '#1a1020');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    const scroll = (state.tick % 120) * 0.4;
    for (let x = -40; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + scroll, 0);
      ctx.lineTo(x + scroll * 0.3, H);
      ctx.stroke();
    }
    for (let y = 80; y < GROUND_SCREEN_Y; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(40, 220, 120, 320);
    ctx.fillRect(200, 280, 80, 260);
    ctx.fillRect(W - 200, 240, 100, 300);
    ctx.fillRect(W - 90, 300, 60, 240);
    ctx.fillStyle = 'rgba(46, 230, 197, 0.08)';
    ctx.fillRect(70, 250, 20, 40);
    ctx.fillStyle = 'rgba(255, 77, 109, 0.08)';
    ctx.fillRect(W - 160, 270, 20, 40);
  }

  private drawArenaFloor(): void {
    const ctx = this.ctx;
    const left = this.worldToScreen(-fromFp(ARENA_HALF_WIDTH), 0).x;
    const right = this.worldToScreen(fromFp(ARENA_HALF_WIDTH), 0).x;

    const floorG = ctx.createLinearGradient(0, GROUND_SCREEN_Y - 10, 0, H);
    floorG.addColorStop(0, '#1e293b');
    floorG.addColorStop(1, '#0f172a');
    ctx.fillStyle = floorG;
    ctx.fillRect(0, GROUND_SCREEN_Y, W, H - GROUND_SCREEN_Y);

    ctx.fillStyle = 'rgba(46, 230, 197, 0.15)';
    ctx.fillRect(left, GROUND_SCREEN_Y, right - left, 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, GROUND_SCREEN_Y + 4);
    ctx.lineTo(right, GROUND_SCREEN_Y + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.fillRect(left - 6, GROUND_SCREEN_Y - 80, 6, 80);
    ctx.fillRect(right, GROUND_SCREEN_Y - 80, 6, 80);

    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, GROUND_SCREEN_Y - 120);
    ctx.lineTo(ORIGIN_X, GROUND_SCREEN_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawProjectile(p: ProjectileState, color: string): void {
    const ctx = this.ctx;
    const c = this.worldToScreen(fromFp(p.x), fromFp(p.y));
    const kind = p.kind ?? 'bullet';
    const age = p.age ?? 0;
    const ang = Math.atan2(-p.vy, p.vx * p.facing);

    ctx.save();
    ctx.translate(c.x, c.y);

    if (kind === 'bomb') {
      // Arcing bomb with fuse spark
      const spin = age * 0.25;
      ctx.rotate(spin);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(-3, -3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // fuse
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.quadraticCurveTo(14, -16, 10 + Math.sin(age * 0.5) * 3, -20);
      ctx.stroke();
      // spark
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(10 + Math.sin(age * 0.5) * 3, -20, 3 + (age % 3), 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'snake') {
      // Slithering serpent body
      const dir = p.facing;
      ctx.scale(dir, 1);
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      // body segments
      for (let i = 5; i >= 0; i--) {
        const t = i / 5;
        const sx = -i * 9;
        const sy = Math.sin(age * 0.45 + i * 0.7) * 6;
        const r = 7 - t * 3;
        ctx.fillStyle = i % 2 === 0 ? color : '#a78bfa';
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 1.4, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // head
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(8, Math.sin(age * 0.45) * 6, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // eye
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(12, Math.sin(age * 0.45) * 6 - 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // tongue
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const tongue = 6 + Math.sin(age * 0.8) * 3;
      ctx.moveTo(16, Math.sin(age * 0.45) * 6);
      ctx.lineTo(16 + tongue, Math.sin(age * 0.45) * 6 - 3);
      ctx.moveTo(16 + tongue * 0.5, Math.sin(age * 0.45) * 6);
      ctx.lineTo(16 + tongue, Math.sin(age * 0.45) * 6 + 3);
      ctx.stroke();
    } else if (kind === 'orb') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 16);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      // orbiting diamond
      ctx.rotate(age * 0.2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Bullet / gun shot — elongated tracer
      ctx.rotate(p.facing < 0 ? Math.PI + ang * 0.15 : ang * 0.15);
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      const grad = ctx.createLinearGradient(-18, 0, 14, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.4, color);
      grad.addColorStop(1, '#fff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(8, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawPhaseOverlay(state: GameState): void {
    const ctx = this.ctx;
    if (state.matchPhase === 'round_intro') {
      const t = state.phaseTimer;
      const label = t > 40 ? 'ROUND ' + state.round : t > 10 ? 'FIGHT' : '';
      if (label) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, H * 0.35, W, 80);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 48px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, W / 2, H * 0.35 + 55);
      }
    } else if (state.matchPhase === 'round_end') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, H * 0.35, W, 90);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('K.O.', W / 2, H * 0.35 + 55);
    } else if (state.matchPhase === 'result') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      const winner =
        state.matchWinner === 0
          ? 'NYRA VEX WINS'
          : state.matchWinner === 1
            ? 'BRAM KADE WINS'
            : 'DRAW';
      // Prefer actual fighter names from state
      const n0 = state.fighters[0].id.replace('_', ' ').toUpperCase();
      const n1 = state.fighters[1].id.replace('_', ' ').toUpperCase();
      const label =
        state.matchWinner === 0 ? `${n0} WINS` : state.matchWinner === 1 ? `${n1} WINS` : 'DRAW';
      void winner;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 44px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, W / 2, H / 2 - 10);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '20px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Press Enter for rematch · Esc for menu', W / 2, H / 2 + 36);
    }
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: ORIGIN_X + worldX * PX_PER_WU,
      y: GROUND_SCREEN_Y - worldY * PX_PER_WU,
    };
  }
}

void FP_SCALE;
