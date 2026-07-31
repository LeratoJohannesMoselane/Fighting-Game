/**
 * Fighting-game camera: frames both fighters, zooms with their separation,
 * and never lets either one leave the screen.
 *
 * Pure presentation — it reads positions and produces a transform. Feeding it
 * the same positions always yields the same transform, so it cannot desync
 * the simulation.
 */

export interface CameraTuning {
  /** Zoom used when fighters are at kissing distance. */
  maxZoom: number;
  /**
   * Preferred zoom floor. The camera may go below this when it is the only
   * way to keep both fighters on screen — visibility always wins.
   */
  minZoom: number;
  /** Absolute floor so a bug can never zoom the stage into a speck. */
  hardMinZoom: number;
  /** Smoothing factor per 60 Hz frame (0..1); higher snaps faster. */
  followSpeed: number;
  /** Screen-space padding around each fighter when they are close, in px. */
  padding: number;
  /** Padding once they are far apart (tightens so they stay big). */
  paddingFar: number;
  /** Vertical headroom kept above the highest fighter, in px. */
  paddingY: number;
  /**
   * Fighter body height in screen px at zoom 1. Positions handed to the
   * camera are *feet*, so framing has to allow for the body above them.
   */
  bodyHeight: number;
}

export const DEFAULT_CAMERA_TUNING: CameraTuning = {
  maxZoom: 1.22,
  minZoom: 0.62,
  hardMinZoom: 0.42,
  followSpeed: 0.09,
  padding: 200,
  paddingFar: 80,
  paddingY: 110,
  // 1.6 wu hurtbox × 118 px/wu ≈ 189 px.
  bodyHeight: 190,
};

export interface CameraView {
  /** Screen-space translate applied before drawing the world. */
  x: number;
  y: number;
  zoom: number;
}

export class ArenaCamera {
  private readonly viewW: number;
  private readonly viewH: number;
  private readonly tuning: CameraTuning;

  /** Smoothed state. */
  private cx = 0;
  private cy = 0;
  private zoom = 1;
  private initialized = false;

  constructor(viewW: number, viewH: number, tuning: Partial<CameraTuning> = {}) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.tuning = { ...DEFAULT_CAMERA_TUNING, ...tuning };
  }

  reset(): void {
    this.initialized = false;
    this.cx = 0;
    this.cy = 0;
    this.zoom = 1;
  }

  /**
   * Track two screen-space points (the fighters' feet, already projected at
   * zoom 1). `dt` is in 60 Hz frames so smoothing is frame-rate independent.
   */
  update(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    dt: number,
    bounds: { left: number; right: number },
  ): CameraView {
    const t = this.tuning;
    const spanX = Math.abs(ax - bx);
    const midX = (ax + bx) / 2;
    // Centre on the middle of the bodies (feet minus half a body), not the
    // feet themselves — otherwise the frame sits too low.
    const midY = (ay + by) / 2 - t.bodyHeight / 2;

    // Padding eases from generous (close quarters) to tight (full-screen
    // spacing) so distant fighters don't shrink more than they must.
    const spread = Math.min(1, spanX / this.viewW);
    const padX = t.padding + (t.paddingFar - t.padding) * spread;

    // Zoom so both fighters plus padding fit the viewport.
    const neededX = spanX + padX * 2;
    const fitX = neededX > 0 ? this.viewW / neededX : t.maxZoom;

    // Also fit vertically (a jump must never leave the frame). Positions are
    // feet, so the top of the frame must clear the higher fighter's head.
    const topY = Math.min(ay, by) - t.bodyHeight;
    const botY = Math.max(ay, by);
    const spanY = botY - topY;
    const neededY = spanY + t.paddingY * 2;
    const fitY = neededY > 0 ? this.viewH / neededY : t.maxZoom;

    const fit = Math.min(fitX, fitY);
    let targetZoom = Math.max(t.minZoom, Math.min(t.maxZoom, fit));

    // Hard guarantee: if the preferred floor still can't fit both fighters,
    // keep zooming out (down to hardMinZoom). Visibility beats framing.
    if (fit < targetZoom) {
      targetZoom = Math.max(t.hardMinZoom, fit);
    }

    const arenaSpan = bounds.right - bounds.left;
    let targetX = midX;
    const targetY = midY;

    // Clamp the centre so the window stays inside the arena — but only while
    // the arena is actually wider than the view, otherwise just centre it.
    const viewSpan = this.viewW / targetZoom;
    if (arenaSpan > viewSpan) {
      const halfView = viewSpan / 2;
      targetX = Math.max(bounds.left + halfView, Math.min(bounds.right - halfView, targetX));
    } else {
      targetX = (bounds.left + bounds.right) / 2;
    }

    if (!this.initialized) {
      this.cx = targetX;
      this.cy = targetY;
      this.zoom = targetZoom;
      this.initialized = true;
    } else {
      // Exponential smoothing, normalised to the frame delta.
      const k = 1 - Math.pow(1 - t.followSpeed, Math.max(0.001, dt));
      this.cx += (targetX - this.cx) * k;
      this.cy += (targetY - this.cy) * k;
      this.zoom += (targetZoom - this.zoom) * k;
    }

    // --- hard visibility guarantee -------------------------------------
    // Smoothing lags behind fast separation, which would briefly push a
    // fighter past the edge. Clamp the *smoothed* result so that can never
    // happen: a fighter leaving frame is never acceptable in a fighter.
    this.enforceVisibility(ax, ay, bx, by);

    return { x: this.cx, y: this.cy, zoom: this.zoom };
  }

  /** Widen/recentre the live view until both fighters sit inside the frame. */
  private enforceVisibility(ax: number, ay: number, bx: number, by: number): void {
    const t = this.tuning;
    const edge = 56; // keep bodies clear of the very edge
    // Vertical extent runs from the highest head to the lowest feet.
    const headY = Math.min(ay, by) - t.bodyHeight;
    const feetY = Math.max(ay, by);
    const spanX = Math.abs(ax - bx) + edge * 2;
    const spanY = feetY - headY + edge * 2;

    const needZoom = Math.min(
      spanX > 0 ? this.viewW / spanX : t.maxZoom,
      spanY > 0 ? this.viewH / spanY : t.maxZoom,
    );
    if (this.zoom > needZoom) {
      this.zoom = Math.max(t.hardMinZoom, needZoom);
    }

    // Recentre if either fighter would still fall outside the window.
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);
    const loX = Math.min(ax, bx);
    const hiX = Math.max(ax, bx);
    if (this.cx - halfW > loX - edge) this.cx = loX - edge + halfW;
    if (this.cx + halfW < hiX + edge) this.cx = hiX + edge - halfW;

    if (this.cy - halfH > headY - edge) this.cy = headY - edge + halfH;
    if (this.cy + halfH < feetY + edge) this.cy = feetY + edge - halfH;
  }

  /** Current view without advancing smoothing (for background parallax). */
  view(): CameraView {
    return { x: this.cx, y: this.cy, zoom: this.zoom };
  }

  /**
   * Build the canvas transform for the current view.
   * Apply with `ctx.setTransform(...)` before drawing world-space content.
   */
  transform(view: CameraView): {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  } {
    const z = view.zoom;
    return {
      a: z,
      b: 0,
      c: 0,
      d: z,
      e: this.viewW / 2 - view.x * z,
      f: this.viewH / 2 - view.y * z,
    };
  }
}
