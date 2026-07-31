/**
 * SF6-inspired procedural fighter mesh.
 * Ink outline + cel bands + rim light. Feet planted on ground.
 * Bone +Y = screen-down (toward feet/hands along limbs).
 */

import type { FighterState } from '@aether-break/combat-core';
import { fromFp } from '@aether-break/combat-core';
import { resolveFighterAnimation, type ResolvedAnim } from './animation';
import { getVisualProfile } from './profiles';
import type { BodyPartDef, BoneId, BonePose, FighterVisualProfile, PoseMap } from './types';

export interface BoneWorld {
  x: number;
  y: number;
  rot: number;
  scaleX: number;
  scaleY: number;
}

/** Bind pose: origin = feet midpoint on floor. Negative Y = up. */
const BIND: Record<BoneId, { parent: BoneId | null; x: number; y: number }> = {
  root: { parent: null, x: 0, y: 0 },
  spine: { parent: 'root', x: 0, y: -54 },
  chest: { parent: 'spine', x: 0, y: -8 },
  neck: { parent: 'chest', x: 0, y: -34 },
  head: { parent: 'neck', x: 0, y: -8 },
  hair: { parent: 'head', x: -4, y: -6 },
  pauldron: { parent: 'chest', x: -16, y: -28 },
  // Legs
  l_leg: { parent: 'root', x: -10, y: -54 },
  r_leg: { parent: 'root', x: 10, y: -54 },
  l_shin: { parent: 'l_leg', x: 0, y: 26 },
  r_shin: { parent: 'r_leg', x: 0, y: 26 },
  l_foot: { parent: 'l_shin', x: 0, y: 22 },
  r_foot: { parent: 'r_shin', x: 0, y: 22 },
  // Arms
  l_arm: { parent: 'chest', x: -16, y: -28 },
  r_arm: { parent: 'chest', x: 16, y: -28 },
  l_forearm: { parent: 'l_arm', x: 0, y: 20 },
  r_forearm: { parent: 'r_arm', x: 0, y: 20 },
  l_hand: { parent: 'l_forearm', x: 0, y: 18 },
  r_hand: { parent: 'r_forearm', x: 0, y: 18 },
  weapon: { parent: 'r_hand', x: 0, y: 8 },
  weapon_l: { parent: 'l_hand', x: 0, y: 8 },
  cape: { parent: 'chest', x: -4, y: -20 },
};

const BONE_ORDER: BoneId[] = [
  'root',
  'spine',
  'chest',
  'neck',
  'head',
  'hair',
  'pauldron',
  'l_arm',
  'l_forearm',
  'l_hand',
  'r_arm',
  'r_forearm',
  'r_hand',
  'l_leg',
  'l_shin',
  'l_foot',
  'r_leg',
  'r_shin',
  'r_foot',
  'weapon',
  'weapon_l',
  'cape',
];

export class ProceduralFighterMesh {
  readonly profile: FighterVisualProfile;
  readonly fighterId: string;
  anim: ResolvedAnim | null = null;
  bones: Partial<Record<BoneId, BoneWorld>> = {};
  screenX = 0;
  screenY = 0;
  facing: 1 | -1 = 1;
  impactSquash = 0;
  /** 0–1 flash white on hitstop */
  hitFlash = 0;

  constructor(fighterId: string) {
    this.fighterId = fighterId;
    this.profile = getVisualProfile(fighterId);
  }

  static generate(fighterId: string): ProceduralFighterMesh {
    return new ProceduralFighterMesh(fighterId);
  }

  update(fighter: FighterState, presentTick: number, frozen = false): ResolvedAnim {
    this.facing = fighter.facing;
    if (!frozen || !this.anim) {
      this.anim = resolveFighterAnimation(this.profile, fighter, presentTick);
      this.solveBones(this.anim.pose);
    }
    if (!frozen) {
      if (this.impactSquash > 0) this.impactSquash = Math.max(0, this.impactSquash - 0.07);
      if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - 0.12);
    }
    return this.anim!;
  }

  pulseImpact(amount = 0.35): void {
    this.impactSquash = Math.min(0.6, this.impactSquash + amount);
    this.hitFlash = Math.min(1, this.hitFlash + amount * 1.4);
  }

  private solveBones(pose: PoseMap): void {
    const scale = this.profile.height;
    const widthScale = this.profile.width;
    this.bones = {};

    for (const id of BONE_ORDER) {
      const bind = BIND[id];
      const p = pose[id] ?? ({ rot: 0 } as BonePose);
      const parent = bind.parent ? this.bones[bind.parent] : null;

      const lx = (bind.x + (p.ox ?? 0)) * widthScale * scale;
      const ly = (bind.y + (p.oy ?? 0)) * scale;
      const rot = ((p.rot ?? 0) * Math.PI) / 180;

      if (!parent) {
        this.bones[id] = {
          x: lx,
          y: ly,
          rot,
          scaleX: p.scaleX ?? 1,
          scaleY: p.scaleY ?? 1,
        };
        continue;
      }

      const cos = Math.cos(parent.rot);
      const sin = Math.sin(parent.rot);
      this.bones[id] = {
        x: parent.x + lx * cos - ly * sin,
        y: parent.y + lx * sin + ly * cos,
        rot: parent.rot + rot,
        scaleX: (p.scaleX ?? 1) * parent.scaleX,
        scaleY: (p.scaleY ?? 1) * parent.scaleY,
      };
    }
  }

  getAttachLocal(attachId: string): { x: number; y: number } | null {
    const ap = this.profile.attach.find((a) => a.id === attachId);
    if (!ap) return null;
    const b = this.bones[ap.bone];
    if (!b) return null;
    const cos = Math.cos(b.rot);
    const sin = Math.sin(b.rot);
    const along = ap.along * this.profile.height;
    const perp = ap.perp * this.profile.height;
    return {
      x: b.x + along * sin + perp * cos,
      y: b.y + along * cos - perp * sin,
    };
  }

  draw(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    opts: { facing: 1 | -1; flash?: string; activeGlow?: boolean },
  ): void {
    this.screenX = originX;
    this.screenY = originY;
    const facing = opts.facing;
    const parts = [...this.profile.parts].sort((a, b) => a.z - b.z);
    const squash = 1 - this.impactSquash * 0.4;
    const stretch = 1 + this.impactSquash * 0.25;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(facing * stretch, squash);

    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 32 * this.profile.width, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ground ink ring (SF stage readability)
    ctx.strokeStyle = `${this.profile.emission}44`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 3, 36 * this.profile.width, 9, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (opts.activeGlow) {
      ctx.shadowColor = this.profile.emission;
      ctx.shadowBlur = 22;
    }

    for (const part of parts) {
      const b = this.bones[part.bone];
      if (!b) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(b.scaleX, b.scaleY);
      this.drawCelPart(ctx, part, opts.flash);
      ctx.restore();
    }

    ctx.restore();
  }

  /** Ink-and-paint cel part: outline → shade → base → highlight → rim. */
  private drawCelPart(ctx: CanvasRenderingContext2D, part: BodyPartDef, flash?: string): void {
    const outline = this.profile.outline;
    const ow = (part.outline ?? 1) * 2.4;
    const base = flash ? mixHex(part.color, '#ffffff', 0.55 + this.hitFlash * 0.35) : part.color;
    const shade = part.shade ?? darken(base, 0.35);
    const hi = part.accent ?? lighten(base, 0.35);
    const rim = part.rim ?? this.profile.emission;

    // Glow underlay
    if (part.glow) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.shadowColor = part.glow;
      ctx.shadowBlur = 14;
      this.fillShape(ctx, part, part.glow);
      ctx.restore();
    }

    // Thick ink outline
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline;
    ctx.lineWidth = ow;
    this.strokeShape(ctx, part);
    ctx.restore();

    // Shade band (lower half)
    ctx.save();
    this.clipShape(ctx, part);
    const g = ctx.createLinearGradient(0, part.y, 0, part.y + part.h);
    g.addColorStop(0, base);
    g.addColorStop(0.45, base);
    g.addColorStop(0.55, shade);
    g.addColorStop(1, darken(shade, 0.15));
    ctx.fillStyle = flash ? base : g;
    ctx.fillRect(part.x - 2, part.y - 2, part.w + 4, part.h + 4);
    ctx.restore();

    // Soft highlight band
    ctx.save();
    this.clipShape(ctx, part);
    const hg = ctx.createLinearGradient(
      part.x,
      part.y,
      part.x + part.w * 0.6,
      part.y + part.h * 0.4,
    );
    hg.addColorStop(0, `${hi}CC`);
    hg.addColorStop(0.5, `${hi}00`);
    ctx.fillStyle = hg;
    ctx.fillRect(part.x, part.y, part.w * 0.7, part.h * 0.5);
    ctx.restore();

    // Rim light (facing edge)
    ctx.save();
    this.clipShape(ctx, part);
    ctx.globalAlpha = 0.55;
    const rg = ctx.createLinearGradient(
      part.x + part.w * 0.7,
      part.y,
      part.x + part.w,
      part.y + part.h,
    );
    rg.addColorStop(0, `${rim}00`);
    rg.addColorStop(1, `${rim}AA`);
    ctx.fillStyle = rg;
    ctx.fillRect(part.x + part.w * 0.55, part.y, part.w * 0.5, part.h);
    ctx.restore();

    // Specular tick
    ctx.save();
    this.clipShape(ctx, part);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(
      part.x + part.w * 0.32,
      part.y + part.h * 0.22,
      Math.max(2, part.w * 0.12),
      Math.max(1.5, part.h * 0.08),
      -0.3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();

    // Face extras
    if (part.face === 'eye') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(part.x + part.w * 0.65, part.y + part.h * 0.35, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private fillShape(ctx: CanvasRenderingContext2D, part: BodyPartDef, color: string): void {
    ctx.fillStyle = color;
    this.pathShape(ctx, part);
    ctx.fill();
  }

  private strokeShape(ctx: CanvasRenderingContext2D, part: BodyPartDef): void {
    this.pathShape(ctx, part);
    ctx.stroke();
  }

  private clipShape(ctx: CanvasRenderingContext2D, part: BodyPartDef): void {
    this.pathShape(ctx, part);
    ctx.clip();
  }

  private pathShape(ctx: CanvasRenderingContext2D, part: BodyPartDef): void {
    if (part.shape === 'poly' && part.points && part.points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(part.points[0]!.x, part.points[0]!.y);
      for (let i = 1; i < part.points.length; i++) {
        ctx.lineTo(part.points[i]!.x, part.points[i]!.y);
      }
      ctx.closePath();
      return;
    }
    if (part.shape === 'sphere' || part.shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(
        part.x + part.w / 2,
        part.y + part.h / 2,
        part.w / 2,
        part.h / 2,
        0,
        0,
        Math.PI * 2,
      );
      return;
    }
    if (part.shape === 'blade') {
      ctx.beginPath();
      ctx.moveTo(part.x + part.w * 0.5, part.y);
      ctx.lineTo(part.x + part.w, part.y + part.h * 0.35);
      ctx.lineTo(part.x + part.w * 0.7, part.y + part.h);
      ctx.lineTo(part.x + part.w * 0.3, part.y + part.h);
      ctx.lineTo(part.x, part.y + part.h * 0.35);
      ctx.closePath();
      return;
    }
    if (part.shape === 'taper') {
      ctx.beginPath();
      ctx.moveTo(part.x + part.w * 0.15, part.y);
      ctx.lineTo(part.x + part.w * 0.85, part.y);
      ctx.lineTo(part.x + part.w, part.y + part.h);
      ctx.lineTo(part.x, part.y + part.h);
      ctx.closePath();
      return;
    }
    const r = part.shape === 'capsule' ? Math.min(part.w, part.h) / 2 : 4;
    roundRectPath(ctx, part.x, part.y, part.w, part.h, r);
  }
}

function roundRectPath(
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

function darken(hex: string, amt: number): string {
  const c = parseHex(hex);
  return rgb((c.r * (1 - amt)) | 0, (c.g * (1 - amt)) | 0, (c.b * (1 - amt)) | 0);
}

function lighten(hex: string, amt: number): string {
  const c = parseHex(hex);
  return rgb(
    (c.r + (255 - c.r) * amt) | 0,
    (c.g + (255 - c.g) * amt) | 0,
    (c.b + (255 - c.b) * amt) | 0,
  );
}

function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return rgb(
    (ca.r + (cb.r - ca.r) * t) | 0,
    (ca.g + (cb.g - ca.g) * t) | 0,
    (ca.b + (cb.b - ca.b) * t) | 0,
  );
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]! + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length < 6) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})`;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n | 0));
}

export function fighterScreenPos(
  f: FighterState,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number } {
  return worldToScreen(fromFp(f.x), fromFp(f.y));
}
