/**
 * Living stage backdrop — parallax layers, weather, ambient particles and
 * wildlife silhouettes, all drawn procedurally on the 2D canvas.
 *
 * Presentation only: nothing here touches CombatCore state, so it can run at
 * display rate and be skipped entirely on a low graphics setting. Randomness
 * is local (`Math.random` is fine outside the sim boundary).
 *
 * Replace path for final art: keep `draw(ctx, cam, dt)` and swap each layer's
 * paint routine for a sprite/texture blit.
 */

export type WeatherKind = 'clear' | 'rain' | 'snow' | 'embers' | 'fog';

/** Camera view the background parallaxes against. */
export interface BackgroundCamera {
  /** World-space centre of the view, in pixels at zoom 1. */
  x: number;
  y: number;
  zoom: number;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  hue: string;
}

interface Flyer {
  x: number;
  y: number;
  vx: number;
  /** Wing-flap phase. */
  phase: number;
  scale: number;
  kind: 'bird' | 'butterfly';
  tint: string;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
}

const TAU = Math.PI * 2;

/** Deterministic-enough helper for spread-out layout without a seeded rng. */
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class AnimatedBackground {
  private readonly width: number;
  private readonly height: number;
  private readonly groundY: number;

  private time = 0;
  private weather: WeatherKind = 'embers';
  /** 0..1 detail scaler wired to the graphics/particles setting. */
  private density = 1;
  private reduceMotion = false;

  private clouds: Cloud[] = [];
  private motes: Mote[] = [];
  private flyers: Flyer[] = [];
  private drops: Drop[] = [];
  /** Far-tower skyline, generated once so it doesn't shimmer frame to frame. */
  private skyline: Array<{ x: number; w: number; h: number; lit: boolean[] }> = [];
  private ridges: Array<{ x: number; y: number; w: number; h: number }> = [];
  /** Lightning flash intensity (rain storms). */
  private flash = 0;
  private nextFlashIn = 400;

  constructor(width: number, height: number, groundY: number) {
    this.width = width;
    this.height = height;
    this.groundY = groundY;
    this.rebuild();
  }

  /** Graphics option: 'low' halves particle budgets. */
  setDensity(d: number): void {
    this.density = Math.max(0.15, Math.min(1, d));
    this.rebuild();
  }

  /** Accessibility: reduce-flashes disables lightning + slows drift. */
  setReduceMotion(v: boolean): void {
    this.reduceMotion = v;
  }

  setWeather(w: WeatherKind): void {
    if (this.weather === w) return;
    this.weather = w;
    this.drops.length = 0;
    this.rebuild();
  }

  getWeather(): WeatherKind {
    return this.weather;
  }

  /** Pick a stage mood from a match seed so rematches vary. */
  randomizeWeather(seed: number): void {
    const options: WeatherKind[] = ['clear', 'rain', 'snow', 'embers', 'fog'];
    const pick = options[Math.abs(seed) % options.length] ?? 'embers';
    this.setWeather(pick);
  }

  private rebuild(): void {
    const d = this.density;
    const W = this.width;

    // --- far skyline (rebuilt only on density change) ---
    if (this.skyline.length === 0) {
      let x = -200;
      while (x < W + 200) {
        const w = rand(50, 130);
        const h = rand(120, 380);
        const lit: boolean[] = [];
        const rows = Math.floor(h / 26);
        for (let i = 0; i < rows * 3; i++) lit.push(Math.random() < 0.28);
        this.skyline.push({ x, w, h, lit });
        x += w + rand(12, 46);
      }
    }
    if (this.ridges.length === 0) {
      for (let i = 0; i < 7; i++) {
        this.ridges.push({
          x: rand(-200, W + 200),
          y: rand(180, 300),
          w: rand(260, 520),
          h: rand(140, 260),
        });
      }
    }

    // --- clouds ---
    const cloudCount = Math.round(7 * d);
    this.clouds = [];
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push({
        x: rand(-300, W + 300),
        y: rand(30, 240),
        w: rand(180, 420),
        h: rand(40, 90),
        speed: rand(0.05, 0.22),
        alpha: rand(0.04, 0.13),
      });
    }

    // --- ambient motes ---
    const moteCount = Math.round(46 * d);
    this.motes = [];
    for (let i = 0; i < moteCount; i++) this.motes.push(this.makeMote(true));

    // --- flyers ---
    const flyerCount = Math.max(2, Math.round(7 * d));
    this.flyers = [];
    for (let i = 0; i < flyerCount; i++) this.flyers.push(this.makeFlyer());
  }

  private makeMote(scatter = false): Mote {
    const warm = this.weather === 'embers';
    const life = rand(160, 460);
    return {
      x: rand(-40, this.width + 40),
      y: scatter ? rand(0, this.groundY) : this.groundY + rand(0, 60),
      vx: rand(-0.16, 0.28),
      vy: warm ? rand(-0.55, -0.16) : rand(-0.14, 0.14),
      size: rand(1, 3.1),
      life: scatter ? rand(0, life) : 0,
      maxLife: life,
      hue: warm
        ? Math.random() < 0.5
          ? '#ffb648'
          : '#ff7043'
        : Math.random() < 0.5
          ? '#7dd3fc'
          : '#c4b5fd',
    };
  }

  private makeFlyer(): Flyer {
    const butterfly = Math.random() < 0.45;
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x: dir === 1 ? rand(-220, -40) : rand(this.width + 40, this.width + 220),
      y: butterfly ? rand(this.groundY - 190, this.groundY - 40) : rand(70, 260),
      vx: dir * (butterfly ? rand(0.25, 0.6) : rand(0.7, 1.5)),
      phase: rand(0, TAU),
      scale: butterfly ? rand(0.5, 0.9) : rand(0.6, 1.15),
      kind: butterfly ? 'butterfly' : 'bird',
      tint: butterfly
        ? ['#f472b6', '#38bdf8', '#fbbf24'][Math.floor(Math.random() * 3)]!
        : '#0b1020',
    };
  }

  /** Advance the simulation. `dt` is in frames (1 = one 60 Hz frame). */
  update(dt: number): void {
    const step = this.reduceMotion ? dt * 0.35 : dt;
    this.time += step;

    for (const c of this.clouds) {
      c.x += c.speed * step;
      if (c.x - c.w > this.width + 200) {
        c.x = -c.w - rand(40, 260);
        c.y = rand(30, 240);
      }
    }

    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i]!;
      m.x += m.vx * step;
      m.y += m.vy * step;
      m.life += step;
      // gentle sway
      m.x += Math.sin((this.time + i * 12) * 0.012) * 0.12 * step;
      if (m.life >= m.maxLife || m.y < -20 || m.y > this.groundY + 80) {
        this.motes[i] = this.makeMote(false);
      }
    }

    for (let i = 0; i < this.flyers.length; i++) {
      const f = this.flyers[i]!;
      f.x += f.vx * step;
      f.phase += (f.kind === 'butterfly' ? 0.28 : 0.19) * step;
      f.y += Math.sin(f.phase * 0.5) * (f.kind === 'butterfly' ? 0.55 : 0.22) * step;
      const off = f.vx > 0 ? f.x > this.width + 260 : f.x < -260;
      if (off) this.flyers[i] = this.makeFlyer();
    }

    this.updateWeather(step);
  }

  private updateWeather(step: number): void {
    const W = this.width;
    const wantDrops =
      this.weather === 'rain'
        ? Math.round(150 * this.density)
        : this.weather === 'snow'
          ? Math.round(90 * this.density)
          : 0;

    while (this.drops.length < wantDrops) {
      const snow = this.weather === 'snow';
      this.drops.push({
        x: rand(-60, W + 60),
        y: rand(-this.height, this.groundY),
        vx: snow ? rand(-0.5, 0.5) : rand(-2.2, -1.1),
        vy: snow ? rand(0.7, 1.7) : rand(13, 19),
        len: snow ? rand(1.6, 3.4) : rand(9, 20),
        alpha: snow ? rand(0.35, 0.9) : rand(0.18, 0.45),
      });
    }
    while (this.drops.length > wantDrops) this.drops.pop();

    for (const d of this.drops) {
      d.x += d.vx * step;
      d.y += d.vy * step;
      if (this.weather === 'snow') d.x += Math.sin((this.time + d.y) * 0.02) * 0.4 * step;
      if (d.y > this.groundY) {
        d.y = rand(-120, -10);
        d.x = rand(-60, W + 60);
      }
    }

    // Storm lightning
    if (this.weather === 'rain' && !this.reduceMotion) {
      this.nextFlashIn -= step;
      if (this.nextFlashIn <= 0) {
        this.flash = 1;
        this.nextFlashIn = rand(280, 900);
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.06 * step);
  }

  /**
   * Paint every layer. Each layer offsets by `cam` scaled by its depth, so
   * near layers slide further than far ones.
   */
  draw(ctx: CanvasRenderingContext2D, cam: BackgroundCamera): void {
    const W = this.width;
    const H = this.height;
    const px = (depth: number) => -cam.x * depth;
    const py = (depth: number) => -cam.y * depth * 0.35;

    this.drawSky(ctx);
    this.drawCelestial(ctx, px(0.02), py(0.02));
    this.drawClouds(ctx, px(0.06), py(0.06));
    this.drawRidges(ctx, px(0.12), py(0.12));
    this.drawSkyline(ctx, px(0.26), py(0.26));
    this.drawFlyers(ctx, px(0.34), py(0.34), 'bird');
    this.drawFog(ctx, px(0.4));
    this.drawMotes(ctx, px(0.6), py(0.6));
    this.drawFlyers(ctx, px(0.72), py(0.72), 'butterfly');
    this.drawWeather(ctx, px(0.8), py(0.8));

    // Storm flash sits above everything but the vignette.
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(200,220,255,${(this.flash * 0.22).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawVignette(ctx);
  }

  /* ------------------------------------------------------------ */
  /* Layers                                                        */
  /* ------------------------------------------------------------ */

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const H = this.height;
    // Slow day-cycle tint so a long set never looks static.
    const cycle = (Math.sin(this.time * 0.0012) + 1) / 2;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (this.weather === 'rain') {
      g.addColorStop(0, '#080b18');
      g.addColorStop(0.4, '#101830');
      g.addColorStop(1, '#1b2340');
    } else if (this.weather === 'snow') {
      g.addColorStop(0, '#0b1220');
      g.addColorStop(0.45, '#1c2942');
      g.addColorStop(1, '#334155');
    } else {
      g.addColorStop(0, '#0a0618');
      g.addColorStop(0.35, cycle > 0.5 ? '#161232' : '#12102a');
      g.addColorStop(0.7, '#1a1230');
      g.addColorStop(1, cycle > 0.5 ? '#33203a' : '#2a1830');
    }
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.width + 80, H + 80);
  }

  private drawCelestial(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    if (this.weather === 'rain' || this.weather === 'fog') return;
    const x = this.width * 0.74 + ox;
    const y = 96 + oy;
    const pulse = 1 + Math.sin(this.time * 0.01) * 0.05;
    const g = ctx.createRadialGradient(x, y, 6, x, y, 120 * pulse);
    g.addColorStop(0, 'rgba(255,236,190,0.5)');
    g.addColorStop(0.35, 'rgba(255,190,120,0.14)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 120 * pulse, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,244,214,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, TAU);
    ctx.fill();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    ctx.save();
    for (const c of this.clouds) {
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = this.weather === 'rain' ? '#8ea3c8' : '#c9b6ff';
      const x = c.x + ox;
      const y = c.y + oy;
      // Three overlapping ellipses read as a soft cloud at this scale.
      ctx.beginPath();
      ctx.ellipse(x, y, c.w * 0.5, c.h * 0.5, 0, 0, TAU);
      ctx.ellipse(x + c.w * 0.26, y + c.h * 0.12, c.w * 0.32, c.h * 0.38, 0, 0, TAU);
      ctx.ellipse(x - c.w * 0.28, y + c.h * 0.16, c.w * 0.3, c.h * 0.34, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRidges(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 14, 40, 0.85)';
    for (const r of this.ridges) {
      const x = r.x + ox;
      const y = r.y + oy;
      ctx.beginPath();
      ctx.moveTo(x - r.w / 2, y + r.h);
      ctx.lineTo(x, y);
      ctx.lineTo(x + r.w / 2, y + r.h);
      ctx.closePath();
      ctx.fill();
    }
    // Snow caps
    if (this.weather === 'snow') {
      ctx.fillStyle = 'rgba(226,232,240,0.5)';
      for (const r of this.ridges) {
        const x = r.x + ox;
        const y = r.y + oy;
        ctx.beginPath();
        ctx.moveTo(x - r.w * 0.14, y + r.h * 0.3);
        ctx.lineTo(x, y);
        ctx.lineTo(x + r.w * 0.14, y + r.h * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawSkyline(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const base = this.groundY + 10;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 6, 20, 0.94)';
    for (const t of this.skyline) {
      ctx.fillRect(t.x + ox, base - t.h + oy, t.w, t.h);
    }
    // Window lights flicker on a slow cycle.
    for (const t of this.skyline) {
      const cols = 3;
      const rows = Math.floor(t.h / 26);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (!t.lit[idx]) continue;
          const flicker = Math.sin(this.time * 0.02 + idx * 2.3 + t.x) > -0.75;
          if (!flicker) continue;
          ctx.fillStyle = idx % 3 === 0 ? 'rgba(0,229,255,0.26)' : 'rgba(224,64,251,0.2)';
          const wx = t.x + ox + 8 + c * (t.w / cols);
          const wy = base - t.h + oy + 14 + r * 26;
          ctx.fillRect(wx, wy, 7, 10);
        }
      }
    }
    ctx.restore();
  }

  private drawFlyers(
    ctx: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    only: Flyer['kind'],
  ): void {
    ctx.save();
    for (const f of this.flyers) {
      if (f.kind !== only) continue;
      const x = f.x + ox;
      const y = f.y + oy;
      const flap = Math.sin(f.phase);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(f.scale * (f.vx < 0 ? -1 : 1), f.scale);
      if (f.kind === 'bird') {
        // Classic "m" gull silhouette; wing angle follows the flap.
        ctx.strokeStyle = f.tint;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.quadraticCurveTo(-4, -5 * flap - 1, 0, 0);
        ctx.quadraticCurveTo(4, -5 * flap - 1, 9, 0);
        ctx.stroke();
      } else {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = f.tint;
        const spread = 1.6 + flap * 1.5;
        ctx.beginPath();
        ctx.ellipse(-2.4, 0, 3.4, spread, -0.45, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(2.4, 0, 3.4, spread, 0.45, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(20,16,36,0.85)';
        ctx.fillRect(-0.7, -2.4, 1.4, 5);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawMotes(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    ctx.save();
    for (const m of this.motes) {
      const t = m.life / m.maxLife;
      // Fade in and out so nothing pops.
      const a = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, a)) * 0.75;
      ctx.fillStyle = m.hue;
      ctx.shadowColor = m.hue;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(m.x + ox, m.y + oy, m.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFog(ctx: CanvasRenderingContext2D, ox: number): void {
    if (this.weather !== 'fog') return;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const y = this.groundY - 140 + i * 46;
      const drift = ((this.time * (0.25 + i * 0.12) + i * 400) % (this.width + 700)) - 350;
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.5, `rgba(190,205,235,${0.1 - i * 0.015})`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(drift + ox * 0.4 - 200, y - 44, this.width + 500, 88);
    }
    ctx.restore();
  }

  private drawWeather(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    if (this.drops.length === 0) return;
    ctx.save();
    if (this.weather === 'rain') {
      ctx.strokeStyle = 'rgba(190,215,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of this.drops) {
        const x = d.x + ox;
        const y = d.y + oy;
        ctx.moveTo(x, y);
        ctx.lineTo(x - d.vx * 1.6, y - d.len);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#eef4ff';
      for (const d of this.drops) {
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.arc(d.x + ox, d.y + oy, d.len * 0.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D): void {
    const W = this.width;
    const H = this.height;
    const vig = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.22, W / 2, H * 0.5, H * 0.78);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, 'rgba(0,0,0,0.48)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
}
