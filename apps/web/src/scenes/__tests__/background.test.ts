/**
 * Living-background smoke tests.
 *
 * The backdrop is pure canvas painting, so the contract worth defending is:
 * it never throws, never emits NaN coordinates (which silently blank a
 * canvas), and respects the graphics/accessibility switches.
 */
import { describe, expect, it } from 'vitest';
import { AnimatedBackground, type WeatherKind } from '../background/AnimatedBackground';

const W = 1280;
const H = 720;
const GROUND = 560;
const ALL_WEATHER: WeatherKind[] = ['clear', 'rain', 'snow', 'embers', 'fog'];

interface MockCtx {
  ctx: CanvasRenderingContext2D;
  bad: string[];
  calls: () => number;
}

/**
 * A Proxy standing in for CanvasRenderingContext2D that records every numeric
 * argument and flags any non-finite value.
 */
function mockCtx(): MockCtx {
  const bad: string[] = [];
  let calls = 0;
  const check = (name: string, args: unknown[]) => {
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${String(a)})`);
    }
  };
  const gradient = {
    addColorStop: (offset: number, color: string) => {
      if (!Number.isFinite(offset)) bad.push(`addColorStop(${offset})`);
      if (typeof color !== 'string' || color.length === 0) bad.push('addColorStop(bad color)');
    },
  };
  const target = {} as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(_t, prop) {
      const name = String(prop);
      if (name === 'canvas') return { width: W, height: H };
      if (name === 'createLinearGradient' || name === 'createRadialGradient') {
        return (...a: unknown[]) => {
          calls++;
          check(name, a);
          return gradient;
        };
      }
      if (name === 'measureText') return () => ({ width: 8 });
      return (...a: unknown[]) => {
        calls++;
        check(name, a);
      };
    },
    set(_t, prop, value) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        bad.push(`${String(prop)} = ${value}`);
      }
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ctx, bad, calls: () => calls };
}

const CAM = { x: 0, y: 0, zoom: 1 };

describe('animated background', () => {
  it('paints something on the very first frame', () => {
    const m = mockCtx();
    const bg = new AnimatedBackground(W, H, GROUND);
    bg.draw(m.ctx, CAM);
    expect(m.calls()).toBeGreaterThan(20);
    expect(m.bad).toEqual([]);
  });

  for (const weather of ALL_WEATHER) {
    it(`runs "${weather}" for 600 frames without NaN`, () => {
      const m = mockCtx();
      const bg = new AnimatedBackground(W, H, GROUND);
      bg.setWeather(weather);
      for (let i = 0; i < 600; i++) {
        bg.update(1);
        bg.draw(m.ctx, { x: Math.sin(i / 25) * 400, y: Math.cos(i / 40) * 90, zoom: 1 });
      }
      expect(bg.getWeather()).toBe(weather);
      expect(m.bad).toEqual([]);
    });
  }

  it('survives switching weather mid-flight', () => {
    const m = mockCtx();
    const bg = new AnimatedBackground(W, H, GROUND);
    for (let i = 0; i < 400; i++) {
      if (i % 50 === 0) bg.setWeather(ALL_WEATHER[(i / 50) % ALL_WEATHER.length]!);
      bg.update(1);
      bg.draw(m.ctx, CAM);
    }
    expect(m.bad).toEqual([]);
  });

  it('handles irregular frame deltas (stutter, tab restore)', () => {
    const m = mockCtx();
    const bg = new AnimatedBackground(W, H, GROUND);
    for (const dt of [0.016, 1, 4, 0.5, 12, 1, 0.001]) {
      for (let i = 0; i < 40; i++) {
        bg.update(dt);
        bg.draw(m.ctx, CAM);
      }
    }
    expect(m.bad).toEqual([]);
  });

  it('does less work on low density', () => {
    const count = (density: number) => {
      const m = mockCtx();
      const bg = new AnimatedBackground(W, H, GROUND);
      bg.setWeather('rain');
      bg.setDensity(density);
      for (let i = 0; i < 60; i++) {
        bg.update(1);
        bg.draw(m.ctx, CAM);
      }
      return m.calls();
    };
    expect(count(0.2)).toBeLessThan(count(1));
  });

  it('reduce-motion slows the scene instead of freezing it', () => {
    const m = mockCtx();
    const bg = new AnimatedBackground(W, H, GROUND);
    bg.setReduceMotion(true);
    for (let i = 0; i < 200; i++) {
      bg.update(1);
      bg.draw(m.ctx, CAM);
    }
    expect(m.bad).toEqual([]);
    expect(m.calls()).toBeGreaterThan(0);
  });

  it('parallaxes with the camera rather than ignoring it', () => {
    // Two different camera positions must produce different draw arguments.
    const sample = (camX: number) => {
      const seen: number[] = [];
      const bg = new AnimatedBackground(W, H, GROUND);
      bg.setWeather('clear');
      const ctx = new Proxy({} as Record<string, unknown>, {
        get(_t, prop) {
          const name = String(prop);
          if (name === 'canvas') return { width: W, height: H };
          if (name === 'createLinearGradient' || name === 'createRadialGradient') {
            return () => ({ addColorStop: () => {} });
          }
          if (name === 'measureText') return () => ({ width: 8 });
          return (...a: unknown[]) => {
            if (name === 'fillRect' && typeof a[0] === 'number') seen.push(a[0]);
          };
        },
        set: () => true,
      }) as unknown as CanvasRenderingContext2D;
      bg.draw(ctx, { x: camX, y: 0, zoom: 1 });
      return seen;
    };
    const a = sample(0);
    const b = sample(600);
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toEqual(b);
  });

  it('randomizeWeather picks a valid mode for any seed', () => {
    const bg = new AnimatedBackground(W, H, GROUND);
    for (const seed of [0, 1, -7, 999983, 2147483647]) {
      bg.randomizeWeather(seed);
      expect(ALL_WEATHER).toContain(bg.getWeather());
    }
  });
});
