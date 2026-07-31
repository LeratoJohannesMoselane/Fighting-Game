/**
 * Street Fighter–inspired procedural animation.
 * Principles: anticipation, follow-through, squash/stretch, secondary action,
 * exaggeration, staging, ease-in/out timing.
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

function easeOutCubic(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

function easeOutBack(t: number): number {
  const x = clamp01(t);
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
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

/** Secondary motion for hair / cape / coat. */
function secondary(
  pose: PoseMap,
  tick: number,
  intensity: number,
  profile: FighterVisualProfile,
): void {
  const delay = Math.sin(tick * 0.09 + 0.8) * intensity;
  const spineRot = pose.spine?.rot ?? 0;
  pose.cape = bone(
    (pose.cape?.rot ?? 6) + spineRot * 0.45 + delay * 3,
    -2 + delay,
    2 + Math.abs(delay),
  );
  pose.hair = bone(
    (pose.hair?.rot ?? 0) - spineRot * 0.35 + delay * 4,
    delay * 0.5,
    -2 + Math.sin(tick * 0.11) * intensity,
  );
  // Floating Iria orbs simulated via chest ox micro-motion already in idle
  if (profile.personality === 'serene') {
    pose.chest = bone(
      pose.chest?.rot ?? 0,
      (pose.chest?.ox ?? 0) + Math.sin(tick * 0.06) * 0.8,
      (pose.chest?.oy ?? 0) + Math.sin(tick * 0.05) * 1.2,
    );
  }
}

/** Neutral fighting stance — SF6 readable silhouette. */
export function idlePose(profile: FighterVisualProfile, tick: number): PoseMap {
  const sway = Math.sin(tick * 0.065) * profile.idleSway;
  const breath = Math.sin(tick * 0.04) * 1.4;
  const bounce = Math.abs(Math.sin(tick * 0.03)) * 0.4;

  const base: PoseMap = {
    root: bone(0, 0, 0),
    spine: bone(4 + sway * 0.4, sway * 0.6, breath * 0.35, 1, 1 + breath * 0.01),
    chest: bone(2 + sway * 0.2, 0, breath * 0.2),
    neck: bone(-sway * 0.3 - 2),
    head: bone(sway * 0.5 + 3, 0, -1),
    hair: bone(-8 + sway * 2),
    pauldron: bone(-6 + sway),
    // Guard hands — classic fighter
    l_arm: bone(28 + sway * 0.6, -2, 0),
    l_forearm: bone(62),
    l_hand: bone(10),
    r_arm: bone(-18 - sway * 0.6, 2, 0),
    r_forearm: bone(78),
    r_hand: bone(-8),
    // Stance legs
    l_leg: bone(8, -2, 0),
    l_shin: bone(6),
    l_foot: bone(-4),
    r_leg: bone(-6, 2, 0),
    r_shin: bone(4),
    r_foot: bone(-2),
    weapon: bone(-25),
    weapon_l: bone(18),
    cape: bone(8 + sway * 2.5, -3, 3 + bounce),
  };

  // Personality flavors
  if (profile.personality === 'cocky') {
    // Nyra: side-on swagger, pistols ready, weight on back foot
    base.spine = bone(8 + sway * 0.5, sway, breath * 0.3);
    base.head = bone(sway * 0.8 + 6); // slight chin up / smile energy
    base.r_arm = bone(-30 - sway, 3, -2);
    base.r_forearm = bone(40);
    base.weapon = bone(-15, 2, -2);
    base.l_leg = bone(12, -3, 1);
    base.r_leg = bone(-10, 3, 0);
    // Fidget every ~2s
    if (Math.floor(tick / 90) % 2 === 0 && tick % 90 < 12) {
      base.r_hand = bone(-20 + (tick % 12) * 2);
      base.weapon = bone(-40);
    }
  } else if (profile.personality === 'stoic') {
    // Bram: wide, grounded, fists up
    base.spine = bone(2, 0, breath * 0.15, 1.04, 0.98);
    base.chest = bone(0, 0, 0, 1.06, 1);
    base.l_arm = bone(40, -3, 1);
    base.r_arm = bone(-35, 3, 1);
    base.l_forearm = bone(55);
    base.r_forearm = bone(50);
    base.weapon = bone(15, 2, 2);
    base.l_leg = bone(14, -4, 0);
    base.r_leg = bone(-12, 4, 0);
    base.head = bone(0);
    // Embers: tiny chest pulse
    base.chest = bone(0, 0, Math.sin(tick * 0.2) * 0.5);
  } else if (profile.personality === 'serene') {
    // Iria: floaty, open arms, staff upright
    base.root = bone(0, 0, -2 + Math.sin(tick * 0.05) * 2.5); // hover
    base.spine = bone(-2 + sway * 0.3, 0, breath);
    base.l_arm = bone(15 + sway, -1, -2);
    base.r_arm = bone(-8, 1, -4);
    base.r_forearm = bone(15);
    base.weapon = bone(5, 0, -6);
    base.l_leg = bone(4, -1, 0);
    base.r_leg = bone(-3, 1, 0);
    base.head = bone(sway * 0.4);
  } else if (profile.personality === 'intense') {
    // Kellan: low crouch-ready, blade crackle
    base.spine = bone(10, sway * 0.3, 4);
    base.l_arm = bone(35);
    base.r_arm = bone(-40, 2, -2);
    base.r_forearm = bone(30);
    base.weapon = bone(-10, 4, -4);
    base.l_leg = bone(18, -3, 2);
    base.r_leg = bone(-14, 3, 2);
    base.l_shin = bone(12);
    base.r_shin = bone(10);
    base.head = bone(-4 + sway);
  }

  secondary(base, tick, profile.idleSway, profile);
  return base;
}

/** Athletic walk — SF weight + bounce. */
export function walkPose(profile: FighterVisualProfile, tick: number, _facing: 1 | -1): PoseMap {
  void _facing;
  const idle = idlePose(profile, tick);
  const heavy = profile.silhouette === 'stocky';
  const phase = tick * (heavy ? 0.32 : 0.48);
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const bob = (1 - Math.abs(s)) * profile.walkBob * (heavy ? 0.4 : 0.65);
  const legSwing = s * (heavy ? 26 : 36);
  const armSwing = s * (heavy ? 18 : 30);

  const pose: PoseMap = {
    ...idle,
    root: bone(0, 0, bob * 0.4),
    spine: bone(6 + c * 3, s * 2, -bob * 0.25),
    chest: bone(c * 2, s * 1.2, 0),
    head: bone(-c * 3 + 2),
    l_leg: bone(-legSwing + 6, -2 + s * 0.8, Math.max(0, -s) * 3),
    r_leg: bone(legSwing - 6, 2 - s * 0.8, Math.max(0, s) * 3),
    l_shin: bone(8 + Math.max(0, s) * 18),
    r_shin: bone(8 + Math.max(0, -s) * 18),
    l_foot: bone(-6 - Math.max(0, s) * 8),
    r_foot: bone(-6 - Math.max(0, -s) * 8),
    l_arm: bone(20 + armSwing, 0, 0),
    r_arm: bone(-14 - armSwing, 0, 0),
    l_forearm: bone(45 + Math.abs(s) * 12),
    r_forearm: bone(60 + Math.abs(c) * 10),
    cape: bone(12 + s * 14, -4, 4),
    hair: bone(-10 - s * 8),
    weapon: bone(-18 + armSwing * 0.35),
  };
  secondary(pose, tick, profile.idleSway * 1.4, profile);
  return pose;
}

export function crouchPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(14, 0, 16, 1.05, 0.92),
    chest: bone(6, 0, 4),
    neck: bone(4),
    head: bone(8),
    l_leg: bone(52, -3, 5),
    r_leg: bone(46, 3, 5),
    l_shin: bone(40),
    r_shin: bone(36),
    l_foot: bone(-8),
    r_foot: bone(-6),
    l_arm: bone(48),
    r_arm: bone(-42),
    l_forearm: bone(80),
    r_forearm: bone(88),
  };
}

export function jumpPose(profile: FighterVisualProfile, tick: number, vy: number): PoseMap {
  const idle = idlePose(profile, tick);
  const rising = vy > 80 ? 1 : vy > 0 ? 0.65 : 0.3;
  const pose: PoseMap = {
    ...idle,
    spine: bone(-10 * rising, 0, -6, 0.95, 1.08),
    chest: bone(-4 * rising),
    head: bone(-8 * rising),
    l_leg: bone(-32 * rising - 10, -3, -3),
    r_leg: bone(26 * rising + 8, 3, -3),
    l_shin: bone(20 * rising),
    r_shin: bone(16 * rising),
    l_arm: bone(-55 * rising - 12),
    r_arm: bone(60 * rising + 12),
    cape: bone(30 * rising, 0, -6),
    hair: bone(20 * rising),
  };
  secondary(pose, tick, 2.5, profile);
  return pose;
}

export function dashPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  void facing;
  const idle = idlePose(profile, tick);
  const pose: PoseMap = {
    ...idle,
    spine: bone(22, 8, -4, 1.12, 0.9),
    chest: bone(10, 4, 0),
    head: bone(-14),
    l_leg: bone(-48, -3, 0),
    r_leg: bone(58, 4, 0),
    l_shin: bone(10),
    r_shin: bone(25),
    l_arm: bone(-62),
    r_arm: bone(78),
    cape: bone(-42, -10, 2),
    hair: bone(-30),
    weapon: bone(45),
  };
  secondary(pose, tick, 3, profile);
  return pose;
}

export function guardPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(8, 0, 3, 1.04, 0.96),
    chest: bone(4),
    head: bone(-6),
    l_arm: bone(62, -3, -3),
    l_forearm: bone(105),
    l_hand: bone(20),
    r_arm: bone(-58, 3, -3),
    r_forearm: bone(110),
    r_hand: bone(-15),
    l_leg: bone(16, -3, 3),
    r_leg: bone(12, 3, 3),
    weapon: bone(70),
    weapon_l: bone(-45),
  };
}

export function hitPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  void facing;
  const idle = idlePose(profile, tick);
  const shudder = Math.sin(tick * 2.2) * 4;
  const pose: PoseMap = {
    ...idle,
    spine: bone(-24 + shudder, -12, 3, 1.08, 0.9),
    chest: bone(-10 + shudder * 0.5, -4, 0),
    neck: bone(-16),
    head: bone(-22 + shudder),
    l_arm: bone(-55),
    r_arm: bone(62),
    l_forearm: bone(25),
    r_forearm: bone(30),
    l_leg: bone(22, -4, 0),
    r_leg: bone(-16, 4, 0),
    cape: bone(28, 6, 0),
    hair: bone(25 + shudder),
  };
  return pose;
}

export function blockPose(profile: FighterVisualProfile, tick: number): PoseMap {
  return blendPose(guardPose(profile, tick), hitPose(profile, tick, 1), 0.45);
}

export function knockdownPose(
  _profile: FighterVisualProfile,
  tick: number,
  facing: 1 | -1,
): PoseMap {
  void _profile;
  void tick;
  return {
    root: bone(0, facing * 10, 10),
    spine: bone(facing * 78, facing * 24, 12),
    chest: bone(10),
    neck: bone(24),
    head: bone(18),
    l_arm: bone(-40),
    r_arm: bone(50),
    l_forearm: bone(15),
    r_forearm: bone(20),
    l_hand: bone(0),
    r_hand: bone(0),
    l_leg: bone(28),
    r_leg: bone(-20),
    l_shin: bone(10),
    r_shin: bone(8),
    l_foot: bone(0),
    r_foot: bone(0),
    weapon: bone(0),
    weapon_l: bone(0),
    cape: bone(50),
    hair: bone(40),
    pauldron: bone(0),
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

function ex(profile: FighterVisualProfile, v: number): number {
  return v * profile.exaggeration;
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
        root: bone(0, 0, -10),
        spine: bone(ex(profile, -22), 0, -10, 0.9, 1.12),
        chest: bone(-12, 0, -4),
        head: bone(-18),
        l_arm: bone(ex(profile, -110), -6, -8),
        r_arm: bone(ex(profile, 120), 6, -8),
        l_forearm: bone(50),
        r_forearm: bone(45),
        l_leg: bone(18),
        r_leg: bone(-14),
        weapon: bone(-100, 0, -12),
        cape: bone(40, 0, -8),
        hair: bone(30),
      },
      strike: {
        ...idle,
        root: bone(0, 0, -6),
        spine: bone(ex(profile, 14), 6, 0, 1.15, 0.88),
        chest: bone(10, 4, 0, 1.1, 0.95),
        head: bone(12),
        l_arm: bone(25),
        r_arm: bone(-20),
        weapon: bone(0, 10, -16, 1.35, 1.25),
        weapon_l: bone(180, -8, -12, 1.2, 1.2),
        l_leg: bone(-12),
        r_leg: bone(16),
        cape: bone(-55, -14, 6),
        hair: bone(-40),
      },
      recover: {
        ...idle,
        spine: bone(10),
        r_arm: bone(30),
        head: bone(8),
        weapon: bone(-35),
        cape: bone(-15),
      },
    };
  }

  if (input === 'LIGHT') {
    // Chun-Li snap jab energy
    return {
      windup: {
        ...idle,
        spine: bone(-8, -4, 0, 0.96, 1.04),
        chest: bone(-4, -2, 0),
        head: bone(-4),
        r_arm: bone(ex(profile, -70), -2, -4),
        r_forearm: bone(110),
        r_hand: bone(20),
        l_arm: bone(38),
        l_forearm: bone(70),
        r_leg: bone(12, 2, 1),
        l_leg: bone(-6, -2, 0),
        weapon: bone(50),
      },
      strike: {
        ...idle,
        spine: bone(ex(profile, 12), 10, 0, 1.08, 0.94),
        chest: bone(8, 6, 0),
        head: bone(10),
        r_arm: bone(ex(profile, -8), 16, -6, 1.25, 0.85),
        r_forearm: bone(5, 4, 0, 1.2, 0.9),
        r_hand: bone(0, 6, 0, 1.15, 0.9),
        l_arm: bone(48, -3, 0),
        l_forearm: bone(80),
        r_leg: bone(-10, 3, 0),
        l_leg: bone(14, -3, 0),
        weapon: bone(5, 14, 0),
        hair: bone(-15),
        cape: bone(-12),
      },
      recover: {
        ...idle,
        r_arm: bone(-32),
        r_forearm: bone(75),
        spine: bone(4),
        head: bone(4),
      },
    };
  }

  if (input === 'HEAVY') {
    // Zangief-scale windup hammer
    return {
      windup: {
        ...idle,
        spine: bone(ex(profile, -28), -12, 4, 0.88, 1.1),
        chest: bone(-16, -6, 2),
        head: bone(-20),
        r_arm: bone(ex(profile, -145), -10, -10),
        r_forearm: bone(55),
        r_hand: bone(15),
        l_arm: bone(55),
        l_forearm: bone(55),
        l_leg: bone(24, -5, 4),
        r_leg: bone(-28, 5, 2),
        l_shin: bone(15),
        r_shin: bone(8),
        weapon: bone(-120),
        cape: bone(28),
        hair: bone(22),
      },
      strike: {
        ...idle,
        spine: bone(ex(profile, 32), 18, 0, 1.18, 0.82),
        chest: bone(18, 10, 0, 1.12, 0.9),
        head: bone(16),
        r_arm: bone(ex(profile, 35), 22, 4, 1.35, 0.8),
        r_forearm: bone(20, 8, 0, 1.2, 0.85),
        r_hand: bone(10, 10, 0, 1.25, 0.85),
        l_arm: bone(-65),
        l_forearm: bone(35),
        l_leg: bone(-28, -4, 0),
        r_leg: bone(36, 6, 0),
        weapon: bone(40, 20, 6, 1.2, 1.1),
        cape: bone(-40, -12, 6),
        hair: bone(-35),
      },
      recover: {
        ...idle,
        spine: bone(14, 4, 2),
        r_arm: bone(40),
        r_forearm: bone(45),
        head: bone(6),
        l_leg: bone(8),
        r_leg: bone(-6),
      },
    };
  }

  if (input === 'RANGED') {
    return {
      windup: {
        ...idle,
        spine: bone(-10),
        chest: bone(-4),
        head: bone(-6),
        r_arm: bone(ex(profile, -85), 4, -8),
        r_forearm: bone(25),
        r_hand: bone(-10),
        l_arm: bone(30),
        weapon: bone(-95, 0, -8),
        weapon_l: bone(45),
      },
      strike: {
        ...idle,
        spine: bone(4, 4, 0),
        chest: bone(2, 2, 0),
        head: bone(6),
        r_arm: bone(ex(profile, -12), 10, -12, 1.1, 0.95),
        r_forearm: bone(0),
        r_hand: bone(0, 4, 0),
        l_arm: bone(22),
        weapon: bone(0, 12, -12),
        weapon_l: bone(55),
        hair: bone(-8),
      },
      recover: {
        ...idle,
        r_arm: bone(-35),
        weapon: bone(-45),
      },
    };
  }

  // SPELL / ABILITY2
  return {
    windup: {
      ...idle,
      spine: bone(ex(profile, -16), 0, -4),
      chest: bone(-8),
      head: bone(-12),
      l_arm: bone(ex(profile, -85)),
      r_arm: bone(ex(profile, 95)),
      l_forearm: bone(55),
      r_forearm: bone(45),
      weapon: bone(-110, 0, -12),
      cape: bone(28),
      hair: bone(18),
    },
    strike: {
      ...idle,
      spine: bone(ex(profile, 10), 0, 0, 1.08, 0.94),
      chest: bone(6, 0, 0, 1.05, 0.98),
      head: bone(14),
      l_arm: bone(42),
      r_arm: bone(-48),
      l_forearm: bone(22),
      r_forearm: bone(18),
      weapon: bone(-18, 6, -16, 1.2, 1.15),
      cape: bone(-14),
      hair: bone(-12),
    },
    recover: {
      ...idle,
      r_arm: bone(24),
      weapon: bone(-55),
      head: bone(4),
    },
  };
}

function applyHitSquash(pose: PoseMap, amount: number): PoseMap {
  const s = { ...pose };
  if (s.spine) {
    s.spine = bone(
      s.spine.rot,
      s.spine.ox ?? 0,
      s.spine.oy ?? 0,
      (s.spine.scaleX ?? 1) * (1 + amount * 0.25),
      (s.spine.scaleY ?? 1) * (1 - amount * 0.2),
    );
  }
  if (s.chest) {
    s.chest = bone(
      s.chest.rot,
      s.chest.ox ?? 0,
      s.chest.oy ?? 0,
      (s.chest.scaleX ?? 1) * (1 + amount * 0.15),
      (s.chest.scaleY ?? 1) * (1 - amount * 0.12),
    );
  }
  return s;
}

export function attackPose(
  profile: FighterVisualProfile,
  move: MoveData,
  localFrame: number,
): { pose: PoseMap; window: AttackAnimWindow; phase: 'startup' | 'active' | 'recovery' } {
  const win = attackWindow(move);
  const keys = moveKeyPoses(profile, win);
  const lf = Math.max(0, localFrame);
  const idle = idlePose(profile, 0);

  if (lf < win.activeStart) {
    // Anticipation: ease into windup, peak near end of startup
    const t = win.startup <= 1 ? 1 : lf / Math.max(1, win.startup);
    const e =
      win.input === 'HEAVY' || win.isUltimate
        ? easeInCubic(t)
        : win.input === 'LIGHT'
          ? easeOutBack(Math.min(1, t * 1.1))
          : smooth(t);
    let pose = blendPose(idle, keys.windup, e);
    // Pre-impact squash in late startup
    if (t > 0.7) pose = applyHitSquash(pose, (t - 0.7) * 0.8);
    secondary(pose, lf * 3, 2, profile);
    return { pose, window: win, phase: 'startup' };
  }

  if (lf <= win.activeEnd) {
    const span = Math.max(1, win.activeEnd - win.activeStart);
    const t = (lf - win.activeStart) / span;
    let pose: PoseMap;
    if (lf === win.activeStart) {
      // Snap strike + extreme stretch
      pose = blendPose(keys.windup, keys.strike, 1);
      pose = applyHitSquash(pose, win.isUltimate ? 0.9 : win.input === 'HEAVY' ? 0.75 : 0.45);
      if (pose.r_arm) {
        pose.r_arm = bone(
          pose.r_arm.rot,
          (pose.r_arm.ox ?? 0) + 4,
          pose.r_arm.oy ?? 0,
          (pose.r_arm.scaleX ?? 1) * 1.3,
          (pose.r_arm.scaleY ?? 1) * 0.75,
        );
      }
    } else {
      pose = blendPose(keys.strike, keys.strike, easeOutCubic(t));
    }
    secondary(pose, lf * 4, 3, profile);
    return { pose, window: win, phase: 'active' };
  }

  // Follow-through + settle with elastic overshoot
  const recStart = win.activeEnd;
  const recLen = Math.max(1, win.total - recStart);
  const t = (lf - recStart) / recLen;
  const overshoot =
    t < 0.35 ? easeOutElastic(t / 0.35) * 0.35 * (win.input === 'HEAVY' ? 1.2 : 0.7) : 0;
  const pose = blendPose(keys.strike, blendPose(keys.recover, idle, 0.55), smooth(t));
  if (overshoot > 0 && pose.spine) {
    pose.spine = bone(
      pose.spine.rot + overshoot * 8,
      (pose.spine.ox ?? 0) + overshoot * 3,
      pose.spine.oy ?? 0,
    );
  }
  secondary(pose, lf * 2, 1.5, profile);
  return { pose, window: win, phase: 'recovery' };
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

export { easeOutBack, easeOutCubic, easeOutElastic };
