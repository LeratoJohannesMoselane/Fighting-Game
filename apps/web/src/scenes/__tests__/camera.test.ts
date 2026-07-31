/**
 * Camera framing guarantees.
 *
 * The headline rule this file defends: **a fighter must never leave the
 * screen.** Everything else (zoom range, character size, smoothing) is
 * secondary to that.
 */
import { describe, expect, it } from 'vitest';
import { ArenaCamera, DEFAULT_CAMERA_TUNING, type CameraView } from '../Camera';

const W = 1280;
const H = 720;
const GROUND = 560;
const PX_PER_WU = 118;
/** Fighter hurtbox height in world units. */
const BODY_H_WU = 1.6;
const WALL_WU = 9.5;

const baseX = (wu: number) => W / 2 + wu * PX_PER_WU;
const baseY = (wu: number) => GROUND - wu * PX_PER_WU;
const BOUNDS = { left: baseX(-WALL_WU) - 120, right: baseX(WALL_WU) + 120 };

/** Project a base-space x into final screen space for a given view. */
function screenX(x: number, v: CameraView): number {
  return W / 2 + (x - v.x) * v.zoom;
}
function screenY(y: number, v: CameraView): number {
  return H / 2 + (y - v.y) * v.zoom;
}

function track(cam: ArenaCamera, aWu: number, bWu: number, aY = 0, bY = 0, dt = 1): CameraView {
  return cam.update(baseX(aWu), baseY(aY), baseX(bWu), baseY(bY), dt, BOUNDS);
}

/** Settle the camera on a pose so smoothing is out of the picture. */
function settle(cam: ArenaCamera, aWu: number, bWu: number, aY = 0, bY = 0): CameraView {
  let v = track(cam, aWu, bWu, aY, bY);
  for (let i = 0; i < 200; i++) v = track(cam, aWu, bWu, aY, bY);
  return v;
}

describe('character size on screen', () => {
  it('renders a fighter at a readable size in close quarters', () => {
    const cam = new ArenaCamera(W, H);
    const v = settle(cam, -0.6, 0.6);
    const px = BODY_H_WU * PX_PER_WU * v.zoom;
    // Design target: ~1/3–1/5 of a 720px stage.
    expect(px).toBeGreaterThan(180);
    expect(px).toBeLessThan(H / 2.5);
  });

  it('keeps fighters bigger than the old fixed 58 px/wu framing', () => {
    const legacyPx = BODY_H_WU * 58; // ≈ 93 px
    const cam = new ArenaCamera(W, H);
    // Even at full wall-to-wall separation we should not be worse off.
    const v = settle(cam, -WALL_WU, WALL_WU);
    const px = BODY_H_WU * PX_PER_WU * v.zoom;
    expect(px).toBeGreaterThan(legacyPx);
  });

  it('zooms in as fighters close the gap', () => {
    const cam = new ArenaCamera(W, H);
    const far = settle(cam, -7, 7).zoom;
    const near = settle(cam, -0.6, 0.6).zoom;
    expect(near).toBeGreaterThan(far);
  });
});

describe('visibility guarantee', () => {
  it('keeps both fighters on screen at every separation', () => {
    const cam = new ArenaCamera(W, H);
    for (let gap = 0; gap <= WALL_WU; gap += 0.25) {
      const v = settle(cam, -gap, gap);
      expect(screenX(baseX(-gap), v)).toBeGreaterThanOrEqual(0);
      expect(screenX(baseX(gap), v)).toBeLessThanOrEqual(W);
    }
  });

  it('keeps fighters on screen while they separate faster than the camera', () => {
    // Smoothing lags; the hard clamp has to cover it.
    const cam = new ArenaCamera(W, H);
    settle(cam, -0.6, 0.6); // start tight
    let a = -0.6;
    let b = 0.6;
    for (let i = 0; i < 240; i++) {
      a = Math.max(-WALL_WU, a - 0.35);
      b = Math.min(WALL_WU, b + 0.35);
      const v = track(cam, a, b);
      expect(screenX(baseX(a), v)).toBeGreaterThanOrEqual(0);
      expect(screenX(baseX(b), v)).toBeLessThanOrEqual(W);
    }
  });

  it('keeps a jumping fighter inside the frame', () => {
    const cam = new ArenaCamera(W, H);
    settle(cam, -3, 3);
    // Sweep an exaggerated jump arc well past the real 2.7 wu apex.
    for (let h = 0; h <= 6; h += 0.2) {
      const v = track(cam, -3, 3, h, 0);
      const top = screenY(baseY(h + BODY_H_WU), v);
      expect(top).toBeGreaterThanOrEqual(-1);
      expect(top).toBeLessThanOrEqual(H);
    }
  });

  it('handles both fighters stacked on the same spot', () => {
    const cam = new ArenaCamera(W, H);
    const v = settle(cam, 0, 0);
    expect(Number.isFinite(v.zoom)).toBe(true);
    expect(v.zoom).toBeLessThanOrEqual(DEFAULT_CAMERA_TUNING.maxZoom + 1e-6);
    expect(screenX(baseX(0), v)).toBeGreaterThan(0);
    expect(screenX(baseX(0), v)).toBeLessThan(W);
  });

  it('handles the corner case of both fighters pinned to one wall', () => {
    const cam = new ArenaCamera(W, H);
    const v = settle(cam, WALL_WU, WALL_WU);
    expect(screenX(baseX(WALL_WU), v)).toBeGreaterThan(0);
    expect(screenX(baseX(WALL_WU), v)).toBeLessThan(W);
  });
});

describe('camera stability', () => {
  it('never produces NaN for any pose', () => {
    const cam = new ArenaCamera(W, H);
    for (let i = 0; i < 500; i++) {
      const a = Math.sin(i / 7) * WALL_WU;
      const b = Math.cos(i / 11) * WALL_WU;
      const v = track(cam, a, b, Math.abs(Math.sin(i / 5)) * 3, 0, 0.5 + (i % 3));
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
      expect(Number.isFinite(v.zoom)).toBe(true);
      expect(v.zoom).toBeGreaterThan(0);
    }
  });

  it('stays within the hard zoom floor and ceiling', () => {
    const cam = new ArenaCamera(W, H);
    for (let i = 0; i < 300; i++) {
      const a = Math.sin(i / 3) * WALL_WU;
      const b = -Math.sin(i / 3) * WALL_WU;
      const v = track(cam, a, b, (i % 40) / 10, 0);
      expect(v.zoom).toBeGreaterThanOrEqual(DEFAULT_CAMERA_TUNING.hardMinZoom - 1e-6);
      expect(v.zoom).toBeLessThanOrEqual(DEFAULT_CAMERA_TUNING.maxZoom + 1e-6);
    }
  });

  it('eases toward the target instead of snapping', () => {
    const cam = new ArenaCamera(W, H);
    settle(cam, -0.6, 0.6);
    const before = cam.view().zoom;
    const after = track(cam, -WALL_WU, WALL_WU).zoom;
    const settled = settle(cam, -WALL_WU, WALL_WU).zoom;
    // One frame should move only part of the way to the final zoom.
    expect(Math.abs(after - before)).toBeLessThan(Math.abs(settled - before));
  });

  it('is deterministic: identical inputs give an identical view', () => {
    const run = () => {
      const cam = new ArenaCamera(W, H);
      let v = track(cam, -1, 1);
      for (let i = 0; i < 120; i++) v = track(cam, -1 - i * 0.05, 1 + i * 0.05, (i % 20) / 10, 0);
      return v;
    };
    expect(run()).toEqual(run());
  });

  it('reset() re-frames instantly on the next update', () => {
    const cam = new ArenaCamera(W, H);
    settle(cam, -WALL_WU, WALL_WU);
    cam.reset();
    const v = track(cam, -0.6, 0.6);
    // First frame after a reset snaps rather than easing from the old view.
    const px = BODY_H_WU * PX_PER_WU * v.zoom;
    expect(px).toBeGreaterThan(180);
  });
});
