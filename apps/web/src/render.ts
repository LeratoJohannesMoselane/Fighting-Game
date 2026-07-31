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
import { ArenaCamera, type CameraView } from './scenes/Camera';
import { AnimatedBackground, type WeatherKind } from './scenes/background/AnimatedBackground';
import { drawCritter } from './scenes/animals/CritterRenderer';

const W = 1280;
const H = 720;
const GROUND_SCREEN_Y = 560;

/**
 * Pixels per world unit at zoom 1.
 *
 * A fighter hurtbox is 1.6 wu tall, so 118 px/wu puts a body at ~189 px —
 * about 1/3.8 of the 720 px stage, matching the SF-style framing the design
 * calls for (previously 58 px/wu drew ~93 px dolls lost on the stage).
 */
const PX_PER_WU = 118;
const ORIGIN_X = W / 2;

export interface RenderOptions {
  showHitboxes: boolean;
  shake: number;
  p1Color?: string;
  p2Color?: string;
  presentTick?: number;
  /** Frame delta in 60 Hz units (1 = one frame) for camera + background. */
  dt?: number;
}

const DEFAULT_P1 = '#2ee6c5';
const DEFAULT_P2 = '#ff4d6d';

export class ArenaRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private presentTick = 0;

  /** Dynamic framing camera. */
  private readonly camera = new ArenaCamera(W, H);
  /** Living backdrop (parallax + weather + wildlife). */
  private readonly background = new AnimatedBackground(W, H, GROUND_SCREEN_Y);
  /** Latest camera view; world↔screen helpers read this. */
  private view: CameraView = { x: 0, y: 0, zoom: 1 };
  /** Set false to skip the animated backdrop entirely (low graphics). */
  private richBackground = true;

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
    this.camera.reset();
  }

  /** Graphics settings hook: particle density + motion reduction. */
  applyGraphics(opts: { density: number; reduceMotion: boolean; richBackground: boolean }): void {
    this.background.setDensity(opts.density);
    this.background.setReduceMotion(opts.reduceMotion);
    this.richBackground = opts.richBackground;
  }

  /** Choose the stage weather (varies per match seed). */
  setWeather(w: WeatherKind): void {
    this.background.setWeather(w);
  }

  randomizeWeather(seed: number): void {
    this.background.randomizeWeather(seed);
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
    const p = this.worldToBase(worldX, worldY);
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
    const dt = opts.dt ?? 1;

    // --- camera: frame both fighters ---
    const a = this.worldToBase(fromFp(state.fighters[0].x), fromFp(state.fighters[0].y));
    const b = this.worldToBase(fromFp(state.fighters[1].x), fromFp(state.fighters[1].y));
    const wall = fromFp(ARENA_HALF_WIDTH);
    this.view = this.camera.update(a.x, a.y, b.x, b.y, dt, {
      left: this.worldToBase(-wall, 0).x - 120,
      right: this.worldToBase(wall, 0).x + 120,
    });

    const shakeX = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 8 : 0;
    const shakeY = opts.shake > 0 ? (Math.random() - 0.5) * opts.shake * 5 : 0;

    // --- background: screen space, parallaxed against the camera ---
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, shakeX * 0.4, shakeY * 0.4);
    if (this.richBackground) {
      this.background.update(dt);
      this.background.draw(ctx, {
        x: this.view.x - ORIGIN_X,
        y: this.view.y - GROUND_SCREEN_Y,
        zoom: this.view.zoom,
      });
    } else {
      this.drawBackground(state);
    }
    ctx.restore();

    // --- world: camera transform ---
    const t = this.camera.transform(this.view);
    ctx.save();
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e + shakeX, t.f + shakeY);

    this.drawArenaFloor();

    const p1c = opts.p1Color ?? DEFAULT_P1;
    const p2c = opts.p2Color ?? DEFAULT_P2;

    // Critters render behind the fighters so the duel always reads first.
    this.drawCritters(state);

    for (const p of state.projectiles) {
      this.drawProjectile(p, p.ownerSlot === 0 ? p1c : p2c);
    }

    proceduralAssets.draw(state, {
      ctx,
      worldToScreen: (x, y) => this.worldToBase(x, y),
      showHitboxes: opts.showHitboxes,
      p1Color: p1c,
      p2Color: p2c,
      presentTick: opts.presentTick ?? this.presentTick,
    });

    ctx.restore();
    this.drawPhaseOverlay(state);
  }

  /** Draw every live critter in world space. */
  private drawCritters(state: GameState): void {
    if (!state.critters || state.critters.length === 0) return;
    for (const c of state.critters) {
      if (c.hp <= 0 || c.state === 'dead') continue;
      const p = this.worldToBase(fromFp(c.x), fromFp(c.y));
      drawCritter(this.ctx, c, p, {
        pxPerWu: PX_PER_WU,
        presentTick: this.presentTick,
      });
    }
  }

  private drawBackground(state: GameState): void {
    const ctx = this.ctx;
    // SF6-like arena wash — deep ink sky + warm rim
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.35, '#12102a');
    g.addColorStop(0.7, '#1a1230');
    g.addColorStop(1, '#2a1830');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Dramatic key light
    const spot = ctx.createRadialGradient(W * 0.5, 80, 40, W * 0.5, 200, 520);
    spot.addColorStop(0, 'rgba(255, 214, 170, 0.18)');
    spot.addColorStop(0.5, 'rgba(120, 80, 200, 0.08)');
    spot.addColorStop(1, 'transparent');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, GROUND_SCREEN_Y);

    // Ink speed lines (subtle)
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 1;
    const scroll = (state.tick % 90) * 0.55;
    for (let i = 0; i < 18; i++) {
      const y = 40 + i * 28;
      ctx.beginPath();
      ctx.moveTo(-20 + scroll + i * 12, y);
      ctx.lineTo(W * 0.35 + scroll, y + 8);
      ctx.stroke();
    }
    ctx.restore();

    // Silhouette city / forge towers
    ctx.fillStyle = 'rgba(8, 6, 20, 0.92)';
    const towers = [
      [30, 180, 90, 360],
      [140, 240, 70, 300],
      [230, 200, 50, 340],
      [W - 280, 210, 80, 330],
      [W - 170, 160, 100, 380],
      [W - 70, 250, 55, 290],
    ];
    for (const [x, y, w, h] of towers) {
      ctx.fillRect(x!, y!, w!, h!);
    }
    // Neon windows
    for (let i = 0; i < 24; i++) {
      const x = 50 + (i % 8) * 28 + (i > 11 ? W - 340 : 0);
      const y = 220 + ((i * 17) % 140);
      ctx.fillStyle = i % 3 === 0 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(224, 64, 251, 0.15)';
      ctx.fillRect(x, y, 8, 10);
    }

    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.5, H * 0.75);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  private drawArenaFloor(): void {
    const ctx = this.ctx;
    const left = this.worldToBase(-fromFp(ARENA_HALF_WIDTH), 0).x;
    const right = this.worldToBase(fromFp(ARENA_HALF_WIDTH), 0).x;
    // Overdraw: the camera can zoom out past the canvas edges, so the floor
    // has to be wider/taller than the viewport or gaps appear at the sides.
    const pad = W;

    const floorG = ctx.createLinearGradient(0, GROUND_SCREEN_Y - 10, 0, H + pad);
    floorG.addColorStop(0, '#1e293b');
    floorG.addColorStop(1, '#0f172a');
    ctx.fillStyle = floorG;
    ctx.fillRect(-pad, GROUND_SCREEN_Y, W + pad * 2, H - GROUND_SCREEN_Y + pad);

    ctx.fillStyle = 'rgba(46, 230, 197, 0.15)';
    ctx.fillRect(left, GROUND_SCREEN_Y, right - left, 8);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, GROUND_SCREEN_Y + 4);
    ctx.lineTo(right, GROUND_SCREEN_Y + 4);
    ctx.stroke();

    // Arena walls
    ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.fillRect(left - 8, GROUND_SCREEN_Y - 150, 8, 150);
    ctx.fillRect(right, GROUND_SCREEN_Y - 150, 8, 150);

    // Centre mark
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, GROUND_SCREEN_Y - 150);
    ctx.lineTo(ORIGIN_X, GROUND_SCREEN_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Floor grid for depth/parallax read
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      const gx = this.worldToBase(i, 0).x;
      ctx.moveTo(gx, GROUND_SCREEN_Y);
      ctx.lineTo(ORIGIN_X + (gx - ORIGIN_X) * 2.4, H + 300);
    }
    for (let r = 1; r <= 7; r++) {
      const gy = GROUND_SCREEN_Y + r * r * 5;
      ctx.moveTo(-pad, gy);
      ctx.lineTo(W + pad, gy);
    }
    ctx.stroke();
  }

  private drawProjectile(p: ProjectileState, color: string): void {
    const ctx = this.ctx;
    const c = this.worldToBase(fromFp(p.x), fromFp(p.y));
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
    // Overlays are HUD-space: reset any camera transform still in effect.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.paintPhaseOverlay(state, ctx);
    ctx.restore();
  }

  private paintPhaseOverlay(state: GameState, ctx: CanvasRenderingContext2D): void {
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

  /**
   * World units → base canvas space (before the camera transform).
   * Everything drawn inside the camera transform uses this.
   */
  worldToBase(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: ORIGIN_X + worldX * PX_PER_WU,
      y: GROUND_SCREEN_Y - worldY * PX_PER_WU,
    };
  }

  /**
   * World units → final screen pixels, camera included.
   * Use for DOM overlays that must line up with the canvas.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const b = this.worldToBase(worldX, worldY);
    const z = this.view.zoom;
    return {
      x: W / 2 + (b.x - this.view.x) * z,
      y: H / 2 + (b.y - this.view.y) * z,
    };
  }
}

void FP_SCALE;
