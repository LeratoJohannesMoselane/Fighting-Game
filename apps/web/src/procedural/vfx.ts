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
  kind: 'spark' | 'ring' | 'diamond' | 'line' | 'orb' | 'flash';
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
    const scale = req.scale ?? 1;
    const facing = req.facing ?? 1;
    switch (req.kind) {
      case 'hit_light':
        this.burst(req.x, req.y, req.color, 10 * scale, 2.5, 14);
        break;
      case 'hit_heavy':
        this.burst(req.x, req.y, req.color, 18 * scale, 4.5, 18);
        this.ring(req.x, req.y, req.color, 3, 22);
        break;
      case 'hit_ult':
        this.burst(req.x, req.y, req.color, 28 * scale, 6, 24);
        this.burst(req.x, req.y, req.secondary ?? '#fbbf24', 16, 5, 20);
        this.ring(req.x, req.y, req.secondary ?? '#fbbf24', 5, 36);
        this.ring(req.x, req.y, req.color, 3, 28);
        this.flash(req.x, req.y, '#ffffff', 40);
        break;
      case 'block':
        this.burst(req.x, req.y, '#93c5fd', 8, 2, 12);
        this.ring(req.x, req.y, '#bfdbfe', 2.5, 16);
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
        ctx.globalAlpha = t * 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.4 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // orb
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
