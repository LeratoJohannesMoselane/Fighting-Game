/**
 * Procedural fighter "mesh" — bone hierarchy + part draw list.
 * Canvas draws primitives; a Babylon adapter can map bones → TransformNodes.
 */

import type { FighterState } from '@aether-break/combat-core';
import { fromFp } from '@aether-break/combat-core';
import { resolveFighterAnimation, type ResolvedAnim } from './animation';
import { getVisualProfile } from './profiles';
import type { BoneId, BonePose, FighterVisualProfile, PoseMap } from './types';

export interface BoneWorld {
  x: number;
  y: number;
  rot: number;
  scaleX: number;
  scaleY: number;
}

/** Local bind offsets (parent → child) in presentation units. */
const BIND: Record<BoneId, { parent: BoneId | null; x: number; y: number }> = {
  root: { parent: null, x: 0, y: 0 },
  spine: { parent: 'root', x: 0, y: -8 },
  neck: { parent: 'spine', x: 0, y: -40 },
  head: { parent: 'neck', x: 0, y: -6 },
  l_arm: { parent: 'spine', x: -14, y: -32 },
  l_forearm: { parent: 'l_arm', x: 0, y: 20 },
  r_arm: { parent: 'spine', x: 14, y: -32 },
  r_forearm: { parent: 'r_arm', x: 0, y: 20 },
  l_leg: { parent: 'root', x: -8, y: 2 },
  r_leg: { parent: 'root', x: 8, y: 2 },
  weapon: { parent: 'r_forearm', x: 0, y: 18 },
  weapon_l: { parent: 'l_forearm', x: 0, y: 18 },
  cape: { parent: 'spine', x: -6, y: -28 },
};

const BONE_ORDER: BoneId[] = [
  'root',
  'spine',
  'neck',
  'head',
  'l_arm',
  'l_forearm',
  'r_arm',
  'r_forearm',
  'l_leg',
  'r_leg',
  'weapon',
  'weapon_l',
  'cape',
];

export class ProceduralFighterMesh {
  readonly profile: FighterVisualProfile;
  readonly fighterId: string;
  anim: ResolvedAnim | null = null;
  bones: Partial<Record<BoneId, BoneWorld>> = {};
  /** Screen-space feet position last draw. */
  screenX = 0;
  screenY = 0;
  facing: 1 | -1 = 1;

  constructor(fighterId: string) {
    this.fighterId = fighterId;
    this.profile = getVisualProfile(fighterId);
  }

  /** Rebuild profile colors/silhouette (hot-reload friendly). */
  static generate(fighterId: string): ProceduralFighterMesh {
    return new ProceduralFighterMesh(fighterId);
  }

  update(fighter: FighterState, presentTick: number): ResolvedAnim {
    this.facing = fighter.facing;
    this.anim = resolveFighterAnimation(this.profile, fighter, presentTick);
    this.solveBones(this.anim.pose);
    return this.anim;
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
      const rotDeg = p.rot;
      const rot = (rotDeg * Math.PI) / 180;

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
      const wx = parent.x + lx * cos - ly * sin;
      const wy = parent.y + lx * sin + ly * cos;
      this.bones[id] = {
        x: wx,
        y: wy,
        rot: parent.rot + rot,
        scaleX: (p.scaleX ?? 1) * parent.scaleX,
        scaleY: (p.scaleY ?? 1) * parent.scaleY,
      };
    }
  }

  /** World attach point in presentation units relative to feet. */
  getAttachLocal(attachId: string): { x: number; y: number } | null {
    const ap = this.profile.attach.find((a) => a.id === attachId);
    if (!ap) return null;
    const b = this.bones[ap.bone];
    if (!b) return null;
    const cos = Math.cos(b.rot);
    const sin = Math.sin(b.rot);
    const along = ap.along * this.profile.height;
    const perp = ap.perp * this.profile.height;
    // along is down the limb (+Y in bind for arms); use bone +Y direction
    return {
      x: b.x + along * sin + perp * cos,
      y: b.y + along * cos - perp * sin,
    };
  }

  /**
   * Draw the procedural mesh.
   * `originX/Y` = screen feet position.
   * `facing` flips horizontally.
   */
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

    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(facing, 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 26 * this.profile.width, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (opts.activeGlow) {
      ctx.shadowColor = this.profile.primary;
      ctx.shadowBlur = 18;
    }

    for (const part of parts) {
      const b = this.bones[part.bone];
      if (!b) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(b.scaleX, b.scaleY);
      const col = opts.flash ?? part.color;
      this.drawPart(ctx, part, col);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPart(
    ctx: CanvasRenderingContext2D,
    part: (typeof this.profile.parts)[0],
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.5;

    if (part.shape === 'poly' && part.points && part.points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(part.points[0]!.x, part.points[0]!.y);
      for (let i = 1; i < part.points.length; i++) {
        ctx.lineTo(part.points[i]!.x, part.points[i]!.y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
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
      ctx.fill();
      ctx.stroke();
      if (part.accent) {
        ctx.fillStyle = part.accent;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(
          part.x + part.w * 0.45,
          part.y + part.h * 0.35,
          part.w * 0.2,
          part.h * 0.15,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }

    // box / capsule
    const r = part.shape === 'capsule' ? Math.min(part.w, part.h) / 2 : 4;
    roundRect(ctx, part.x, part.y, part.w, part.h, r);
    ctx.fill();
    ctx.stroke();
    if (part.accent) {
      ctx.fillStyle = part.accent;
      ctx.globalAlpha = 0.4;
      roundRect(ctx, part.x + 2, part.y + 2, part.w * 0.35, part.h * 0.25, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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

/** Combat fp → presentation local Y (up negative in bone space is up on screen when subtracted). */
export function fighterScreenPos(
  f: FighterState,
  worldToScreen: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number } {
  return worldToScreen(fromFp(f.x), fromFp(f.y));
}
