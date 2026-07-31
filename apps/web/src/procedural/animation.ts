/**
 * Procedural pose generator driven by CombatCore frame data.
 * Replace later with glTF clip playback using the same bone IDs + event markers.
 */

import type { FighterState, MoveData } from '@aether-break/combat-core';
import { getKit, getMove } from '@aether-break/combat-core';
import type { AttackAnimWindow, BoneId, BonePose, FighterVisualProfile, PoseMap } from './types';

const DEG = Math.PI / 180;

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

/** Rest / neutral pose — silhouette-aware. */
export function idlePose(profile: FighterVisualProfile, tick: number): PoseMap {
  const sway = Math.sin(tick * 0.08) * profile.idleSway;
  const breath = Math.sin(tick * 0.05) * 0.8;
  const base: PoseMap = {
    root: bone(0, 0, breath * 0.3),
    spine: bone(sway * 0.4, 0, -2 + breath),
    neck: bone(-sway * 0.2),
    head: bone(sway * 0.3),
    l_arm: bone(-12 + sway, 0, 0),
    l_forearm: bone(-8),
    r_arm: bone(12 - sway, 0, 0),
    r_forearm: bone(10),
    l_leg: bone(-2),
    r_leg: bone(2),
    weapon: bone(-75),
    weapon_l: bone(75),
    cape: bone(-8 + sway * 2, -4, 4),
  };
  if (profile.silhouette === 'stocky') {
    base.l_arm = bone(-20, 0, 2);
    base.r_arm = bone(25, 0, 2);
    base.weapon = bone(-40, 4, 4);
  }
  if (profile.silhouette === 'tall_mage') {
    base.weapon = bone(-95, 2, -6);
    base.r_arm = bone(20);
    base.r_forearm = bone(30);
  }
  return base;
}

export function walkPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  const idle = idlePose(profile, tick);
  const phase = tick * 0.35;
  const swing = Math.sin(phase) * 28;
  const bob = Math.abs(Math.sin(phase)) * profile.walkBob;
  return {
    ...idle,
    root: bone(0, 0, -bob),
    spine: bone(facing * 4, 0, -2),
    l_leg: bone(-swing * 0.9),
    r_leg: bone(swing * 0.9),
    l_arm: bone(swing * 0.7 - 10),
    r_arm: bone(-swing * 0.7 + 10),
    l_forearm: bone(-15),
    r_forearm: bone(15),
    cape: bone(-14 - Math.sin(phase) * 6, -6, 6),
  };
}

export function crouchPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    root: bone(0, 0, 18),
    spine: bone(8, 0, 6),
    l_leg: bone(35, 0, 4),
    r_leg: bone(30, 0, 4),
    l_arm: bone(-30),
    r_arm: bone(40),
  };
}

export function jumpPose(profile: FighterVisualProfile, tick: number, vy: number): PoseMap {
  const idle = idlePose(profile, tick);
  const tucking = vy > 0 ? 1 : 0.4;
  return {
    ...idle,
    spine: bone(-6 * tucking),
    l_leg: bone(-25 * tucking),
    r_leg: bone(20 * tucking),
    l_arm: bone(-40),
    r_arm: bone(45),
    cape: bone(20, -2, 2),
  };
}

export function dashPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(facing * 18, facing * 6, 0),
    head: bone(-facing * 8),
    l_leg: bone(-30),
    r_leg: bone(40),
    l_arm: bone(-50),
    r_arm: bone(60),
    cape: bone(-40 * facing, -10, 0),
  };
}

export function guardPose(profile: FighterVisualProfile, tick: number): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(-4),
    l_arm: bone(50, 4, -4),
    l_forearm: bone(70),
    r_arm: bone(-45, -2, -4),
    r_forearm: bone(-60),
    weapon: bone(20),
    weapon_l: bone(-20),
  };
}

export function hitPose(profile: FighterVisualProfile, tick: number, facing: 1 | -1): PoseMap {
  const idle = idlePose(profile, tick);
  return {
    ...idle,
    spine: bone(-facing * 22, -facing * 8, 4),
    head: bone(-facing * 18),
    l_arm: bone(-50),
    r_arm: bone(55),
    l_leg: bone(15),
    r_leg: bone(-10),
  };
}

export function blockPose(profile: FighterVisualProfile, tick: number): PoseMap {
  return blendPose(guardPose(profile, tick), hitPose(profile, tick, 1), 0.35);
}

export function knockdownPose(
  _profile: FighterVisualProfile,
  tick: number,
  facing: 1 | -1,
): PoseMap {
  void _profile;
  void tick;
  return {
    root: bone(facing * 90, facing * 10, 40),
    spine: bone(0),
    neck: bone(0),
    head: bone(0),
    l_arm: bone(-20),
    r_arm: bone(30),
    l_forearm: bone(0),
    r_forearm: bone(0),
    l_leg: bone(20),
    r_leg: bone(-15),
    weapon: bone(0),
    weapon_l: bone(0),
    cape: bone(0),
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

/** Core move poses by archetype — windup / strike / recover. */
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
        root: bone(0, 0, -8),
        spine: bone(-12, 0, -6),
        head: bone(-10),
        l_arm: bone(-100),
        r_arm: bone(100),
        l_forearm: bone(-40),
        r_forearm: bone(40),
        weapon: bone(-120, 0, -10),
        cape: bone(30, 0, -4),
      },
      strike: {
        ...idle,
        root: bone(0, 0, -4),
        spine: bone(8, 0, 0, 1.08, 1.05),
        head: bone(6),
        l_arm: bone(-20),
        r_arm: bone(-10),
        l_forearm: bone(0),
        r_forearm: bone(0),
        weapon: bone(0, 8, -20, 1.3, 1.3),
        weapon_l: bone(180, -8, -16, 1.2, 1.2),
        cape: bone(-50, -12, 8),
      },
      recover: {
        ...idle,
        spine: bone(4),
        r_arm: bone(30),
        weapon: bone(-60),
      },
    };
  }

  if (input === 'LIGHT') {
    return {
      windup: {
        ...idle,
        spine: bone(-6),
        r_arm: bone(-50),
        r_forearm: bone(-30),
        weapon: bone(-20),
      },
      strike: {
        ...idle,
        spine: bone(6, 4, 0),
        r_arm: bone(95, 6, -4),
        r_forearm: bone(10),
        weapon: bone(90, 10, 0),
        l_arm: bone(-25),
        head: bone(8),
      },
      recover: {
        ...idle,
        r_arm: bone(40),
        r_forearm: bone(15),
      },
    };
  }

  if (input === 'HEAVY') {
    return {
      windup: {
        ...idle,
        root: bone(0, -4, 2),
        spine: bone(-18, -6, 0),
        head: bone(-12),
        r_arm: bone(-120, -4, -6),
        r_forearm: bone(-40),
        l_arm: bone(40),
        l_leg: bone(15),
        r_leg: bone(-20),
        weapon: bone(-160),
      },
      strike: {
        ...idle,
        root: bone(0, 8, 0),
        spine: bone(22, 10, 0),
        head: bone(10),
        r_arm: bone(110, 12, 4),
        r_forearm: bone(20),
        l_arm: bone(-60),
        l_leg: bone(-25),
        r_leg: bone(30),
        weapon: bone(100, 16, 4, 1.15, 1.1),
        cape: bone(-30, -8, 6),
      },
      recover: {
        ...idle,
        spine: bone(8),
        r_arm: bone(50),
      },
    };
  }

  if (input === 'RANGED') {
    return {
      windup: {
        ...idle,
        spine: bone(-4),
        r_arm: bone(-70),
        r_forearm: bone(-20),
        weapon: bone(-90, 0, -8),
        l_arm: bone(30),
        weapon_l: bone(70),
      },
      strike: {
        ...idle,
        spine: bone(2),
        r_arm: bone(0, 4, -8),
        r_forearm: bone(0),
        weapon: bone(0, 8, -12),
        l_arm: bone(-15),
        head: bone(4),
      },
      recover: {
        ...idle,
        r_arm: bone(-30),
        weapon: bone(-50),
      },
    };
  }

  // SPELL / default special
  return {
    windup: {
      ...idle,
      spine: bone(-10),
      l_arm: bone(-80),
      r_arm: bone(80),
      l_forearm: bone(-30),
      r_forearm: bone(30),
      weapon: bone(-140, 0, -12),
      head: bone(-8),
    },
    strike: {
      ...idle,
      spine: bone(5, 0, -2, 1.05, 1.05),
      l_arm: bone(40),
      r_arm: bone(-35),
      weapon: bone(-20, 6, -18, 1.2, 1.2),
      head: bone(10),
      cape: bone(15),
    },
    recover: {
      ...idle,
      r_arm: bone(25),
      weapon: bone(-70),
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
    const t = win.startup <= 1 ? 1 : lf / win.startup;
    return {
      pose: blendPose(idlePose(profile, 0), keys.windup, smooth(t)),
      window: win,
      phase: 'startup',
    };
  }
  if (lf <= win.activeEnd) {
    const span = Math.max(1, win.activeEnd - win.activeStart);
    const t = (lf - win.activeStart) / span;
    // Snap hard into strike, slight settle
    const pose = blendPose(keys.strike, keys.strike, t);
    // Flash stretch on first active frame
    if (lf === win.activeStart) {
      pose.spine = bone(pose.spine?.rot ?? 0, pose.spine?.ox ?? 0, pose.spine?.oy ?? 0, 1.12, 1.06);
    }
    return { pose, window: win, phase: 'active' };
  }
  const recStart = win.activeEnd;
  const recLen = Math.max(1, win.total - recStart);
  const t = (lf - recStart) / recLen;
  return {
    pose: blendPose(keys.strike, keys.recover, smooth(t)),
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

/**
 * Resolve full pose for a fighter from CombatCore state.
 * Presentation tick is used for loops; combat localFrame drives attacks.
 */
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
  if (fighter.phase === 'jump' || fighter.phase === 'airborne' || fighter.y > 0) {
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
  if (fighter.phase === 'walk' || Math.abs(fighter.vx) > 20) {
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

export { DEG };
