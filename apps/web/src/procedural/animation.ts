/**
 * Human-like procedural poses. Feet stay planted on the floor.
 * Limb bones: +Y is down the limb (toward hand/foot).
 * Hip at root; legs hang down; arms hang from shoulders.
 */

import type { FighterState, MoveData } from '@aether-break/combat-core';
import { getKit, getMove } from '@aether-break/combat-core';
import type { AttackAnimWindow, BoneId, BonePose, FighterVisualProfile, PoseMap } from './types';

function bone(rot: number, ox = 0, oy = 0, scaleX = 1, scaleY = 1): BonePose {
  return { rot, ox, oy, scaleX, scaleY };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

function smooth(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c = 1.70158;
  const c3 = c + 1;
  return 1 + c3 * (x - 1) ** 3 + c * (x - 1) ** 2;
}

function blendPose(a: PoseMap, b: PoseMap, t: number): PoseMap {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<BoneId>;
  const out: PoseMap = {};
  const tt = smooth(t);
  for (const k of keys) {
    const pa = a[k] ?? bone(0);
    const pb = b[k] ?? bone(0);
    out[k] = bone(
      lerp(pa.rot, pb.rot, tt),
      lerp(pa.ox ?? 0, pb.ox ?? 0, tt),
      lerp(pa.oy ?? 0, pb.oy ?? 0, tt),
      lerp(pa.scaleX ?? 1, pb.scaleX ?? 1, tt),
      lerp(pa.scaleY ?? 1, pb.scaleY ?? 1, tt),
    );
  }
  return out;
}

/** Neutral fighting stance — weight on rear foot, guard hands. */
export function idlePose(profile: FighterVisualProfile, tick: number): PoseMap {
  const sway = Math.sin(tick * 0.07) * profile.idleSway;
  const breath = Math.sin(tick * 0.045) * 1.1;
  const base: PoseMap = {
    root: bone(0, 0, 0),
    // Slight crouch-ready
    spine: bone(sway * 0.35 + 3, sway * 0.4, breath * 0.4),
    neck: bone(-sway * 0.25 - 2),
    head: bone(sway * 0.4 + 2),
    // Guard hands up-ish (arms hang +Y down; negative rot swings forward when facing right after flip)
    l_arm: bone(25 + sway * 0.5, -1, 0),
    l_forearm: bone(55),
    r_arm: bone(-15 - sway * 0.5, 1, 0),
    r_forearm: bone(70),
    // Legs almost straight down, tiny stance width via ox
    l_leg: bone(6, -1, 0),
    r_leg: bone(-4, 1, 0),
    weapon: bone(-20),
    weapon_l: bone(15),
    cape: bone(4 + sway * 1.5, -2, 2),
  };

  if (profile.silhouette === 'stocky') {
    base.spine = bone(4 + sway * 0.2, 0, breath * 0.3);
    base.l_arm = bone(30, -2, 1);
    base.r_arm = bone(-25, 2, 1);
    base.r_forearm = bone(50);
    base.weapon = bone(10, 2, 2);
    base.l_leg = bone(8, -2, 0);
    base.r_leg = bone(-6, 2, 0);
  }
  if (profile.silhouette === 'tall_mage') {
    base.r_arm = bone(-5);
    base.r_forearm = bone(20);
    base.weapon = bone(5, 0, -4); // staff upright-ish
    base.l_arm = bone(15);
    base.l_forearm = bone(40);
  }
  return base;
}

/**
 * Walk cycle — contact / down / passing / up.
 * Feet never leave a realistic arc; hips bob; opposite arm swing.
 */
export function walkPose(profile: FighterVisualProfile, tick: number, _facing: 1 | -1): PoseMap {
  void _facing;
  const idle = idlePose(profile, tick);
  // ~steps per second feel
  const phase = tick * 0.42;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bob = (1 - Math.abs(s)) * profile.walkBob * 0.55;
  // Leg swing in degrees — forward/back
  const legSwing = s * 32;
  const armSwing = s * 26;

  return {
    ...idle,
    root: bone(0, 0, bob * 0.35),
    spine: bone(4 + c * 2, s * 1.5, -bob * 0.2),
    head: bone(-c * 2),
    // Opposite arm/leg
    l_leg: bone(-legSwing + 4, -1 + s * 0.5, Math.max(0, -s) * 2),
    r_leg: bone(legSwing - 4, 1 - s * 0.5, Math.max(0, s) * 2),
    l_arm: bone(18 + armSwing, 0, 0),
    r_arm: bone(-12 - armSwing, 0, 0),
    l_forearm: bone(40 + Math.abs(s) * 10),
    r_forearm: bone(55 + Math.abs(c) * 8),
    cape: bone(8 + s * 10, -3, 3),
    weapon: bone(-15 + armSwing * 0.3),
  };
}

export function crouchPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    // Drop hips by shifting root... but root is feet. Bend knees instead.
    spine: bone(12, 0, 14),
    neck: bone(4),
    head: bone(6),
    l_leg: bone(48, -2, 4),
    r_leg: bone(42, 2, 4),
    l_arm: bone(40),
    r_arm: bone(-35),
    l_forearm: bone(70),
    r_forearm: bone(80),
  };
}

export function jumpPose(profile: FighterVisualProfile, tick: number, vy: number): PoseMap {
  const idle = idlePose(profile, tick);
  const rising = vy > 80 ? 1 : vy > 0 ? 0.6 : 0.25;
  return {
    ...idle,
    spine: bone(-8 * rising, 0, -4),
    head: bone(-6 * rising),
    l_leg: bone(-28 * rising - 8, -2, -2),
    r_leg: bone(22 * rising + 6, 2, -2),
    l_arm: bone(-50 * rising - 10),
    r_arm: bone(55 * rising + 10),
    l_forearm: bone(20),
    r_forearm: bone(25),
    cape: bone(25 * rising, 0, -4),
  };
}

export function dashPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  void facing;
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(18, 6, -2),
    head: bone(-10),
    l_leg: bone(-40, -2, 0),
    r_leg: bone(50, 2, 0),
    l_arm: bone(-55),
    r_arm: bone(70),
    l_forearm: bone(30),
    r_forearm: bone(20),
    cape: bone(-35, -8, 2),
    weapon: bone(40),
  };
}

export function guardPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(6, 0, 2),
    head: bone(-4),
    // Both arms up covering
    l_arm: bone(55, -2, -2),
    l_forearm: bone(95),
    r_arm: bone(-50, 2, -2),
    r_forearm: bone(100),
    l_leg: bone(12, -2, 2),
    r_leg: bone(8, 2, 2),
    weapon: bone(60),
    weapon_l: bone(-40),
  };
}

export function hitPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  void facing;
  const idle = idlePose(profile, tick);
  const shudder = Math.sin(tick * 1.8) * 3;
  return {
    ...idle,
    spine: bone(-18 + shudder, -10, 2),
    neck: bone(-12),
    head: bone(-16 + shudder),
    l_arm: bone(-40),
    r_arm: bone(50),
    l_forearm: bone(20),
    r_forearm: bone(25),
    l_leg: bone(18, -3, 0),
    r_leg: bone(-12, 3, 0),
    cape: bone(20, 4, 0),
  };
}

export function blockPose(profile: FighterVisualProfile, tick: number): PoseMap {
  return blendPose(guardPose(profile, tick), hitPose(profile, tick, 1), 0.4);
}

export function knockdownPose(
  _profile: FighterVisualProfile,
  tick: number,
  facing: 1 | -1,
): PoseMap {
  void _profile;
  void tick;
  // Lay back — rotate whole body via spine, keep feet near origin
  return {
    root: bone(0, facing * 8, 8),
    spine: bone(facing * 70, facing * 20, 10),
    neck: bone(20),
    head: bone(15),
    l_arm: bone(-30),
    r_arm: bone(40),
    l_forearm: bone(10),
    r_forearm: bone(15),
    l_leg: bone(20),
    r_leg: bone(-15),
    weapon: bone(0),
    weapon_l: bone(0),
    cape: bone(40),
  };
}

function attackWindow(move: MoveData): AttackAnimWindow {
  return {
    startup: move.startup,
    activeStart: move.active[0],
    activeEnd: move.active[1],
    recovery: move.recovery,
    total: move.active[1] + move.recovery,
    input: move.input,
    isUltimate: !!move.isUltimate || move.input === 'ULTIMATE',
    moveId: move.id,
  };
}

function moveKeyPoses(
  profile: FighterVisualProfile,
  win: AttackAnimWindow,
): { windup: PoseMap; strike: PoseMap; recover: PoseMap } {
  const idle = idlePose(profile, 0);
  const input = win.input;

  if (win.isUltimate) {
    return {
      windup: {
        ...idle,
        spine: bone(-16, 0, -6),
        head: bone(-12),
        l_arm: bone(-100, -4, -4),
        r_arm: bone(110, 4, -4),
        l_forearm: bone(40),
        r_forearm: bone(35),
        l_leg: bone(15),
        r_leg: bone(-10),
        weapon: bone(-90, 0, -8),
        cape: bone(30, 0, -6),
      },
      strike: {
        ...idle,
        spine: bone(10, 4, 0, 1.1, 1.06),
        head: bone(8),
        l_arm: bone(20),
        r_arm: bone(-15),
        l_forearm: bone(10),
        r_forearm: bone(5),
        weapon: bone(0, 6, -12, 1.25, 1.2),
        weapon_l: bone(180, -6, -10, 1.15, 1.15),
        l_leg: bone(-8),
        r_leg: bone(12),
        cape: bone(-40, -10, 4),
      },
      recover: {
        ...idle,
        spine: bone(6),
        r_arm: bone(25),
        weapon: bone(-30),
      },
    };
  }

  if (input === 'LIGHT') {
    // Jab: chamber → snap punch → pull back
    return {
      windup: {
        ...idle,
        spine: bone(-4, -2, 0),
        head: bone(-2),
        r_arm: bone(-55, 0, -2),
        r_forearm: bone(95),
        l_arm: bone(30),
        l_forearm: bone(60),
        r_leg: bone(8),
        l_leg: bone(-4),
        weapon: bone(40),
      },
      strike: {
        ...idle,
        spine: bone(8, 6, 0),
        head: bone(6),
        // Full extension forward
        r_arm: bone(-5, 10, -4),
        r_forearm: bone(5),
        l_arm: bone(40, -2, 0),
        l_forearm: bone(70),
        r_leg: bone(-6, 2, 0),
        l_leg: bone(10, -2, 0),
        weapon: bone(0, 12, 0),
      },
      recover: {
        ...idle,
        r_arm: bone(-25),
        r_forearm: bone(70),
        spine: bone(2),
      },
    };
  }

  if (input === 'HEAVY') {
    return {
      windup: {
        ...idle,
        spine: bone(-22, -8, 2),
        head: bone(-14),
        r_arm: bone(-130, -6, -6),
        r_forearm: bone(40),
        l_arm: bone(45),
        l_forearm: bone(50),
        l_leg: bone(18, -3, 2),
        r_leg: bone(-22, 3, 0),
        weapon: bone(-100),
        cape: bone(18),
      },
      strike: {
        ...idle,
        spine: bone(24, 12, 0),
        head: bone(12),
        r_arm: bone(25, 14, 2),
        r_forearm: bone(15),
        l_arm: bone(-50),
        l_forearm: bone(30),
        l_leg: bone(-20, -2, 0),
        r_leg: bone(28, 4, 0),
        weapon: bone(30, 16, 4, 1.12, 1.08),
        cape: bone(-28, -8, 4),
      },
      recover: {
        ...idle,
        spine: bone(10),
        r_arm: bone(30),
        r_forearm: bone(40),
      },
    };
  }

  if (input === 'RANGED') {
    // Gun: raise → fire → lower
    return {
      windup: {
        ...idle,
        spine: bone(-6),
        head: bone(-4),
        r_arm: bone(-70, 2, -6),
        r_forearm: bone(20),
        l_arm: bone(25),
        weapon: bone(-80, 0, -6),
        weapon_l: bone(40),
      },
      strike: {
        ...idle,
        spine: bone(2, 2, 0),
        head: bone(4),
        r_arm: bone(-10, 6, -10),
        r_forearm: bone(0),
        l_arm: bone(20),
        weapon: bone(0, 8, -10),
        weapon_l: bone(50),
      },
      recover: {
        ...idle,
        r_arm: bone(-30),
        weapon: bone(-40),
      },
    };
  }

  // SPELL / bomb / snake cast
  return {
    windup: {
      ...idle,
      spine: bone(-12, 0, -2),
      head: bone(-8),
      l_arm: bone(-70),
      r_arm: bone(80),
      l_forearm: bone(50),
      r_forearm: bone(40),
      weapon: bone(-100, 0, -10),
      cape: bone(20),
    },
    strike: {
      ...idle,
      spine: bone(6, 0, 0, 1.05, 1.04),
      head: bone(10),
      l_arm: bone(35),
      r_arm: bone(-40),
      l_forearm: bone(20),
      r_forearm: bone(15),
      weapon: bone(-15, 4, -14, 1.15, 1.1),
      cape: bone(-10),
    },
    recover: {
      ...idle,
      r_arm: bone(20),
      weapon: bone(-50),
    },
  };
}

export function attackPose(
  profile: FighterVisualProfile,
  move: MoveData,
  localFrame: number,
): { pose: PoseMap; window: AttackAnimWindow; phase: 'startup' | 'active' | 'recovery' } {
  const win = attackWindow(move);
  const keys = moveKeyPoses(profile, win);
  const lf = Math.max(0, localFrame);

  if (lf < win.activeStart) {
    const t = win.startup <= 1 ? 1 : lf / Math.max(1, win.startup);
    const e = win.input === 'HEAVY' || win.isUltimate ? smooth(t) : easeOutBack(t * 0.85);
    return {
      pose: blendPose(idlePose(profile, 0), keys.windup, e),
      window: win,
      phase: 'startup',
    };
  }
  if (lf <= win.activeEnd) {
    const span = Math.max(1, win.activeEnd - win.activeStart);
    const t = (lf - win.activeStart) / span;
    // Snap into strike on first active frame
    const pose =
      lf === win.activeStart
        ? blendPose(keys.windup, keys.strike, 1)
        : blendPose(keys.strike, keys.strike, t);
    if (lf === win.activeStart && pose.spine) {
      pose.spine = bone(pose.spine.rot, pose.spine.ox ?? 0, pose.spine.oy ?? 0, 1.1, 1.05);
    }
    return { pose, window: win, phase: 'active' };
  }
  const recStart = win.activeEnd;
  const recLen = Math.max(1, win.total - recStart);
  const t = (lf - recStart) / recLen;
  return {
    pose: blendPose(keys.strike, blendPose(keys.recover, idlePose(profile, 0), 0.5), smooth(t)),
    window: win,
    phase: 'recovery',
  };
}

export interface ResolvedAnim {
  pose: PoseMap;
  attackPhase: 'startup' | 'active' | 'recovery' | null;
  move: MoveData | null;
  window: AttackAnimWindow | null;
  label: string;
}

export function resolveFighterAnimation(
  profile: FighterVisualProfile,
  fighter: FighterState,
  presentTick: number,
): ResolvedAnim {
  const facing = fighter.facing;

  if (fighter.phase === 'knockdown') {
    return {
      pose: knockdownPose(profile, presentTick, facing),
      attackPhase: null,
      move: null,
      window: null,
      label: 'knockdown',
    };
  }
  if (fighter.phase === 'hitstun') {
    return {
      pose: hitPose(profile, presentTick, facing),
      attackPhase: null,
      move: null,
      window: null,
      label: 'hit',
    };
  }
  if (fighter.phase === 'blockstun') {
    return {
      pose: blockPose(profile, presentTick),
      attackPhase: null,
      move: null,
      window: null,
      label: 'blockstun',
    };
  }
  if (fighter.phase === 'attack' && fighter.move) {
    const kit = getKit(fighter.id);
    const move = getMove(kit, fighter.move.moveId);
    if (move) {
      const { pose, window, phase } = attackPose(profile, move, fighter.move.localFrame);
      return { pose, attackPhase: phase, move, window, label: move.id };
    }
  }
  if (fighter.phase === 'dash') {
    return {
      pose: dashPose(profile, presentTick, facing),
      attackPhase: null,
      move: null,
      window: null,
      label: 'dash',
    };
  }
  if (fighter.phase === 'guard' || fighter.guarding) {
    return {
      pose: guardPose(profile, presentTick),
      attackPhase: null,
      move: null,
      window: null,
      label: 'guard',
    };
  }
  if (fighter.phase === 'jump' || fighter.phase === 'airborne' || fighter.y > 40) {
    return {
      pose: jumpPose(profile, presentTick, fighter.vy),
      attackPhase: null,
      move: null,
      window: null,
      label: 'jump',
    };
  }
  if (fighter.phase === 'crouch') {
    return {
      pose: crouchPose(profile, presentTick),
      attackPhase: null,
      move: null,
      window: null,
      label: 'crouch',
    };
  }
  if (fighter.phase === 'walk' || Math.abs(fighter.vx) > 30) {
    return {
      pose: walkPose(profile, presentTick, facing),
      attackPhase: null,
      move: null,
      window: null,
      label: 'walk',
    };
  }
  return {
    pose: idlePose(profile, presentTick),
    attackPhase: null,
    move: null,
    window: null,
    label: 'idle',
  };
}

export { easeOutBack };
