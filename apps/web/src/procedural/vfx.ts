/**
 * Procedural VFX pool — no textures.
 * Shapes: sparks, rings, diamonds, trails, afterimages.
 */

import type { VfxRequest } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'spark' | 'ring' | 'diamond' | 'line' | 'orb' | 'flash' | 'slash' | 'star' | 'ember';
  rot: number;
  spin: number;
  secondary?: string;
}

interface Afterimage {
  life: number;
  maxLife: number;
  x: number;
  y: number;
  facing: 1 | -1;
  color: string;
  /** Simple stick silhouette snapshot points */
  points: { x: number; y: number }[];
}

const POOL_CAP = 400;

export class ProceduralVfx {
  /** 0..1 particle density scaler (graphics option). */
  private density = 1;

  setDensity(d: number): void {
    this.density = Math.max(0.1, Math.min(1, d));
  }
  private particles: Particle[] = [];
  private afterimages: Afterimage[] = [];
  private rings: {
    x: number;
    y: number;
    r: number;
    vr: number;
    life: number;
    maxLife: number;
    color: string;
  }[] = [];

  clear(): void {
    this.particles.length = 0;
    this.afterimages.length = 0;
    this.rings.length = 0;
  }

  spawn(req: VfxRequest): void {
    // Density budget: probabilistically drop spawn requests (never flashes/rings —
    // those carry gameplay readability like ult auras and block confirms).
    if (this.density < 1 && req.kind !== 'ult_aura' && Math.random() > this.density) return;
    const scale = req.scale ?? 1;
    const facing = req.facing ?? 1;
    switch (req.kind) {
      case 'hit_light':
        this.burst(req.x, req.y, req.color, 14 * scale, 3.2, 16);
        this.slash(req.x, req.y, req.color, facing, 0.7);
        this.flash(req.x, req.y, '#ffffff', 18);
        break;
      case 'hit_heavy':
        this.burst(req.x, req.y, req.color, 24 * scale, 5.5, 20);
        this.burst(req.x, req.y, req.secondary ?? '#fff', 10, 3, 14);
        this.ring(req.x, req.y, req.color, 4.2, 26);
        this.slash(req.x, req.y, req.secondary ?? req.color, facing, 1.2);
        this.flash(req.x, req.y, '#ffffff', 32);
        break;
      case 'hit_ult':
        this.burst(req.x, req.y, req.color, 36 * scale, 7, 28);
        this.burst(req.x, req.y, req.secondary ?? '#fbbf24', 22, 6, 24);
        this.ring(req.x, req.y, req.secondary ?? '#fbbf24', 6, 42);
        this.ring(req.x, req.y, req.color, 4, 34);
        this.ring(req.x, req.y, '#ffffff', 2.5, 28);
        this.slash(req.x, req.y, '#fff', facing, 1.6);
        this.flash(req.x, req.y, '#ffffff', 56);
        break;
      case 'block':
        this.burst(req.x, req.y, '#93c5fd', 12, 2.5, 14);
        this.ring(req.x, req.y, '#bfdbfe', 3.2, 18);
        this.flash(req.x, req.y, '#e0f2fe', 16);
        break;
      case 'ink_slash':
        this.slash(req.x, req.y, req.color, facing, scale);
        break;
      case 'impact_ring':
        this.ring(req.x, req.y, req.color, 5, 24);
        this.flash(req.x, req.y, req.secondary ?? '#fff', 20);
        break;
      case 'ember':
        for (let i = 0; i < 10; i++) {
          this.spawnOne({
            x: req.x + (Math.random() - 0.5) * 20,
            y: req.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1.5 - Math.random() * 2,
            life: 20 + Math.random() * 10,
            maxLife: 28,
            color: req.color,
            size: 2 + Math.random() * 3,
            kind: 'ember',
            rot: 0,
            spin: 0.1,
            secondary: req.secondary,
          });
        }
        break;
      case 'prism':
        this.burst(req.x, req.y, req.color, 12, 3, 18);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + ageNoise();
          this.spawnOne({
            x: req.x,
            y: req.y,
            vx: Math.cos(a) * 2.5,
            vy: Math.sin(a) * 2.5,
            life: 18,
            maxLife: 18,
            color: req.secondary ?? req.color,
            size: 9,
            kind: 'star',
            rot: a,
            spin: 0.3,
          });
        }
        break;
      case 'lightning':
        this.slash(req.x, req.y, req.color, facing, 1.1);
        this.burst(req.x, req.y, req.secondary ?? '#FFEB3B', 8, 4, 12);
        this.flash(req.x, req.y, '#fff', 22);
        break;
      case 'muzzle':
        this.burst(req.x, req.y, req.color, 6, 3.5 * facing, 10);
        this.spawnOne({
          x: req.x,
          y: req.y,
          vx: facing * 6,
          vy: -1,
          life: 8,
          maxLife: 8,
          color: req.color,
          size: 10,
          kind: 'flash',
          rot: 0,
          spin: 0,
        });
        break;
      case 'trail':
        this.spawnOne({
          x: req.x,
          y: req.y,
          vx: 0,
          vy: 0,
          life: 12,
          maxLife: 12,
          color: req.color,
          size: 6 * scale,
          kind: 'orb',
          rot: 0,
          spin: 0.2,
          secondary: req.secondary,
        });
        break;
      case 'spell_burst':
        this.burst(req.x, req.y, req.color, 14, 3, 16);
        this.ring(req.x, req.y, req.secondary ?? req.color, 4, 20);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.spawnOne({
            x: req.x,
            y: req.y,
            vx: Math.cos(a) * 3,
            vy: Math.sin(a) * 3,
            life: 16,
            maxLife: 16,
            color: req.secondary ?? req.color,
            size: 8,
            kind: 'diamond',
            rot: a,
            spin: 0.25,
          });
        }
        break;
      case 'ult_aura':
        this.ring(req.x, req.y, req.color, 2.2, 40);
        this.ring(req.x, req.y, req.secondary ?? '#fbbf24', 1.6, 48);
        this.burst(req.x, req.y - 20, req.color, 12, 2, 22);
        break;
      case 'dash_dust':
        for (let i = 0; i < 5; i++) {
          this.spawnOne({
            x: req.x - facing * (8 + i * 4),
            y: req.y,
            vx: -facing * (0.5 + Math.random()),
            vy: -0.5 - Math.random(),
            life: 10,
            maxLife: 10,
            color: req.color,
            size: 4 + Math.random() * 4,
            kind: 'spark',
            rot: 0,
            spin: 0,
          });
        }
        break;
      case 'afterimage':
        this.afterimages.push({
          life: 10,
          maxLife: 10,
          x: req.x,
          y: req.y,
          facing,
          color: req.color,
          points: [
            { x: 0, y: -40 },
            { x: 0, y: -10 },
            { x: -12, y: 0 },
            { x: 12, y: 0 },
            { x: -8, y: 30 },
            { x: 8, y: 30 },
          ],
        });
        break;
      case 'ward':
        this.ring(req.x, req.y - 30, '#93c5fd', 1.2, 26);
        break;
      case 'ready_pulse':
        this.ring(req.x, req.y - 40, '#fbbf24', 2.5, 30);
        this.burst(req.x, req.y - 40, '#e879f9', 8, 2, 14);
        break;
      default:
        break;
    }
    this.trim();
  }

  update(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.kind === 'spark' ? 0.18 : 0.05;
      p.vx *= 0.96;
      p.life -= 1;
      p.rot += p.spin;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const r of this.rings) {
      r.r += r.vr;
      r.life -= 1;
    }
    this.rings = this.rings.filter((r) => r.life > 0);

    for (const a of this.afterimages) {
      a.life -= 1;
    }
    this.afterimages = this.afterimages.filter((a) => a.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const a of this.afterimages) {
      const t = a.life / a.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.35;
      ctx.translate(a.x, a.y);
      ctx.scale(a.facing, 1);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.points[0]!.x, a.points[0]!.y);
      for (let i = 1; i < a.points.length; i++) {
        ctx.lineTo(a.points[i]!.x, a.points[i]!.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (const r of this.rings) {
      const t = r.life / r.maxLife;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = t * 0.85;
      ctx.lineWidth = 2 + t * 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;

      if (p.kind === 'spark' || p.kind === 'line') {
        ctx.fillRect(-p.size * t, -1.2, p.size * 2 * t, 2.4);
      } else if (p.kind === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.7, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.2 - t), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'flash') {
        ctx.globalAlpha = t * 0.75;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.4, p.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.5 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'slash') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + t * 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.2 - t * 0.3), -0.8, 0.8);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.color;
        starPath(ctx, 0, 0, p.size * t, 5);
        ctx.fill();
      } else if (p.kind === 'ember') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.secondary ?? '#fbbf24';
        ctx.globalAlpha = t * 0.5;
        ctx.beginPath();
        ctx.arc(0, -p.size, p.size * 0.5 * t, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, p.secondary ?? '#fff');
        g.addColorStop(1, p.color);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private slash(x: number, y: number, color: string, facing: 1 | -1, scale: number): void {
    this.spawnOne({
      x,
      y,
      vx: facing * 1.5,
      vy: -0.5,
      life: 10,
      maxLife: 10,
      color,
      size: 28 * scale,
      kind: 'slash',
      rot: facing * -0.4,
      spin: facing * 0.15,
    });
    this.spawnOne({
      x: x + facing * 6,
      y: y - 4,
      vx: facing * 2,
      vy: 0.2,
      life: 8,
      maxLife: 8,
      color: '#ffffff',
      size: 18 * scale,
      kind: 'slash',
      rot: facing * -0.2,
      spin: facing * 0.1,
    });
  }

  private burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    life: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const sp = speed * (0.5 + Math.random());
      this.spawnOne({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: life * (0.7 + Math.random() * 0.3),
        maxLife: life,
        color,
        size: 3 + Math.random() * 5,
        kind: Math.random() > 0.6 ? 'diamond' : 'spark',
        rot: a,
        spin: (Math.random() - 0.5) * 0.4,
      });
    }
  }

  private ring(x: number, y: number, color: string, vr: number, life: number): void {
    this.rings.push({ x, y, r: 4, vr, life, maxLife: life, color });
  }

  private flash(x: number, y: number, color: string, size: number): void {
    this.spawnOne({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 8,
      maxLife: 8,
      color,
      size,
      kind: 'flash',
      rot: 0,
      spin: 0,
    });
  }

  private spawnOne(p: Particle): void {
    if (this.particles.length >= POOL_CAP) this.particles.shift();
    this.particles.push(p);
  }

  private trim(): void {
    if (this.particles.length > POOL_CAP) {
      this.particles.splice(0, this.particles.length - POOL_CAP);
    }
  }
}

function ageNoise(): number {
  return Math.random() * 0.4;
}

function starPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(rad) * rr;
    const py = y + Math.sin(rad) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
