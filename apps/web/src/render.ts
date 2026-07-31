import {
  ARENA_HALF_WIDTH,
  DEFAULT_HURTBOX,
  FP_SCALE,
  fromFp,
  getKit,
  getMove,
  localBoxToWorld,
  type FighterState,
  type GameState,
  type ProjectileState,
} from '@aether-break/combat-core';

const W = 1280;
const H = 720;
const GROUND_SCREEN_Y = 560;
/** Pixels per world unit (fp/FP_SCALE). Arena ±9.5 wu → fit with margin. */
const PX_PER_WU = 58;
const ORIGIN_X = W / 2;

export interface RenderOptions {
  showHitboxes: boolean;
  shake: number;
  p1Color?: string;
  p2Color?: string;
}

const DEFAULT_P1 = '#2ee6c5';
const DEFAULT_P2 = '#ff4d6d';

export class ArenaRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private trail: { x: number; y: number; life: number; color: string }[] = [];
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] =
    [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    canvas.width = W;
    canvas.height = H;
  }

  /** Call when CombatCore emits hit/block for juice (presentation only). */
  pulseHit(worldX: number, worldY: number, color: string, blocked: boolean): void {
    const p = this.worldToScreen(worldX, worldY);
    const n = blocked ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = blocked ? 2 + Math.random() * 3 : 3 + Math.random() * 6;
      this.sparks.push({
        x: p.x,
        y: p.y - 40,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 2,
        life: blocked ? 12 : 18,
        color,
      });
    }
  }

  draw(state: GameState, opts: RenderOptions): void {
    const ctx = this.ctx;
    const shakeX = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 6 : 0;
    const shakeY = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 4 : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

    this.drawBackground(state);
    this.drawArenaFloor();
    this.updateFx();
    this.drawFx();

    const p1c = opts.p1Color ?? DEFAULT_P1;
    const p2c = opts.p2Color ?? DEFAULT_P2;

    for (const p of state.projectiles) {
      this.drawProjectile(p, p.ownerSlot === 0 ? p1c : p2c);
    }

    this.drawFighter(state.fighters[0], p1c, opts.showHitboxes, state);
    this.drawFighter(state.fighters[1], p2c, opts.showHitboxes, state);

    if (opts.showHitboxes) {
      this.drawActiveHitboxes(state.fighters[0], '#ffe566');
      this.drawActiveHitboxes(state.fighters[1], '#ffe566');
    }

    ctx.restore();

    // Overlay text in screen space (no shake).
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

    // Parallax grid (cosmetic).
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

    // Far industrial silhouettes
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

    // Floor plate
    const floorG = ctx.createLinearGradient(0, GROUND_SCREEN_Y - 10, 0, H);
    floorG.addColorStop(0, '#1e293b');
    floorG.addColorStop(1, '#0f172a');
    ctx.fillStyle = floorG;
    ctx.fillRect(0, GROUND_SCREEN_Y, W, H - GROUND_SCREEN_Y);

    // Lane strip
    ctx.fillStyle = 'rgba(46, 230, 197, 0.15)';
    ctx.fillRect(left, GROUND_SCREEN_Y, right - left, 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, GROUND_SCREEN_Y + 4);
    ctx.lineTo(right, GROUND_SCREEN_Y + 4);
    ctx.stroke();

    // Wall markers
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.fillRect(left - 6, GROUND_SCREEN_Y - 80, 6, 80);
    ctx.fillRect(right, GROUND_SCREEN_Y - 80, 6, 80);

    // Center line
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, GROUND_SCREEN_Y - 120);
    ctx.lineTo(ORIGIN_X, GROUND_SCREEN_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawFighter(
    f: FighterState,
    color: string,
    showHurtbox: boolean,
    _state: GameState,
  ): void {
    const ctx = this.ctx;
    const p = this.worldToScreen(fromFp(f.x), fromFp(f.y));
    const facing = f.facing;
    const crouch = f.phase === 'crouch' || f.phase === 'guard';
    const bodyH = crouch ? 70 : 110;
    const bodyW = 48;
    const x = p.x - bodyW / 2;
    const y = p.y - bodyH;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const flash =
      f.phase === 'hitstun'
        ? 'rgba(255,255,255,0.85)'
        : f.phase === 'blockstun'
          ? '#93c5fd'
          : color;
    ctx.fillStyle = flash;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, bodyW, bodyH, 8);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.fillStyle = flash;
    ctx.arc(p.x + facing * 2, y - 14, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Face direction mark
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(p.x + facing * 6 - 3, y - 18, 6, 6);

    // Attack limb
    if (f.phase === 'attack' && f.move) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + facing * 10, y + 40);
      ctx.lineTo(p.x + facing * 70, y + 30);
      ctx.stroke();
    }

    // Guard shield
    if (f.guarding || f.phase === 'guard' || f.phase === 'blockstun') {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x + facing * 28, y + bodyH * 0.45, 26, -0.8, 0.8);
      ctx.stroke();
    }

    // Name plate
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(p.x - 36, y - 48, 72, 16);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.slot === 0 ? 'P1' : 'P2', p.x, y - 36);

    if (showHurtbox) {
      const hb = f.hurtbox ?? DEFAULT_HURTBOX;
      const box = localBoxToWorld(f.x, f.y, f.facing, hb);
      this.drawWorldBox(box, 'rgba(46, 230, 197, 0.25)', 'rgba(46, 230, 197, 0.9)');
    }

    // Motion trail sample
    if (f.phase === 'dash' || (f.vx !== 0 && f.phase === 'walk')) {
      this.trail.push({ x: p.x, y: p.y - bodyH / 2, life: 8, color });
    }
  }

  private drawActiveHitboxes(f: FighterState, color: string): void {
    if (f.phase !== 'attack' || !f.move) return;
    const kit = getKit(f.id);
    const move = getMove(kit, f.move.moveId);
    if (!move) return;
    const lf = f.move.localFrame;
    if (lf < move.active[0] || lf > move.active[1]) return;
    for (const hb of move.hitboxes) {
      this.drawWorldBox(localBoxToWorld(f.x, f.y, f.facing, hb), 'rgba(251, 191, 36, 0.25)', color);
    }
  }

  private drawProjectile(p: ProjectileState, color: string): void {
    const ctx = this.ctx;
    const c = this.worldToScreen(fromFp(p.x), fromFp(p.y));
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawWorldBox(
    box: { x: number; y: number; w: number; h: number },
    fill: string,
    stroke: string,
  ): void {
    const ctx = this.ctx;
    const a = this.worldToScreen(fromFp(box.x), fromFp(box.y + box.h));
    const b = this.worldToScreen(fromFp(box.x + box.w), fromFp(box.y));
    const x = a.x;
    const y = a.y;
    const w = b.x - a.x;
    const h = b.y - a.y;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
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
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 44px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(winner, W / 2, H / 2 - 10);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '20px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('Press Enter for rematch', W / 2, H / 2 + 36);
    }
  }

  private updateFx(): void {
    this.trail = this.trail.map((t) => ({ ...t, life: t.life - 1 })).filter((t) => t.life > 0);
    this.sparks = this.sparks
      .map((s) => ({
        ...s,
        x: s.x + s.vx,
        y: s.y + s.vy,
        vy: s.vy + 0.25,
        life: s.life - 1,
      }))
      .filter((s) => s.life > 0);
  }

  private drawFx(): void {
    const ctx = this.ctx;
    for (const t of this.trail) {
      ctx.globalAlpha = t.life / 10;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of this.sparks) {
      ctx.globalAlpha = Math.max(0, s.life / 18);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: ORIGIN_X + worldX * PX_PER_WU,
      y: GROUND_SCREEN_Y - worldY * PX_PER_WU,
    };
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Silence unused import if tree-shaken oddly
void FP_SCALE;
