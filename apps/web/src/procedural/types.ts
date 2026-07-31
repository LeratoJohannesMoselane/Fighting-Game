/**
 * Renderer-agnostic procedural asset contracts.
 * SF6-inspired ink-and-paint presentation layer.
 */

export type BoneId =
  | 'root'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'l_arm'
  | 'r_arm'
  | 'l_forearm'
  | 'r_forearm'
  | 'l_hand'
  | 'r_hand'
  | 'l_leg'
  | 'r_leg'
  | 'l_shin'
  | 'r_shin'
  | 'l_foot'
  | 'r_foot'
  | 'weapon'
  | 'weapon_l'
  | 'cape'
  | 'hair'
  | 'pauldron';

/** Degrees, local space. */
export interface BonePose {
  rot: number;
  ox?: number;
  oy?: number;
  scaleX?: number;
  scaleY?: number;
}

export type PoseMap = Partial<Record<BoneId, BonePose>>;

export interface AttachPoint {
  id: string;
  bone: BoneId;
  along: number;
  perp: number;
}

export type PartShape = 'box' | 'capsule' | 'sphere' | 'ellipse' | 'poly' | 'taper' | 'blade';

export interface BodyPartDef {
  id: string;
  bone: BoneId;
  shape: PartShape;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Base fill (ink & paint body). */
  color: string;
  /** Highlight / cel band. */
  accent?: string;
  /** Deep shadow band. */
  shade?: string;
  /** Rim light color. */
  rim?: string;
  /** Outline thickness multiplier. */
  outline?: number;
  z: number;
  points?: { x: number; y: number }[];
  /** Soft glow under part (emission). */
  glow?: string;
  /** Face feature marker. */
  face?: 'none' | 'base' | 'eye' | 'brow' | 'mouth' | 'visor';
}

export interface FighterVisualProfile {
  id: string;
  displayName: string;
  title: string;
  height: number;
  width: number;
  /** SF6 palette */
  primary: string;
  secondary: string;
  accent: string;
  emission: string;
  skin: string;
  outline: string;
  silhouette: 'slim' | 'stocky' | 'tall_mage' | 'wiry' | 'balanced';
  parts: BodyPartDef[];
  attach: AttachPoint[];
  idleSway: number;
  walkBob: number;
  /** Exaggeration multiplier for attack poses. */
  exaggeration: number;
  /** Personality idle ticks. */
  personality: 'cocky' | 'stoic' | 'serene' | 'intense';
}

export type AnimPhase =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'jump'
  | 'land'
  | 'dash'
  | 'guard'
  | 'hit'
  | 'block'
  | 'knockdown'
  | 'attack';

export interface AttackAnimWindow {
  startup: number;
  activeStart: number;
  activeEnd: number;
  recovery: number;
  total: number;
  input: string;
  isUltimate: boolean;
  moveId: string;
}

export interface VfxRequest {
  kind:
    | 'hit_light'
    | 'hit_heavy'
    | 'hit_ult'
    | 'block'
    | 'muzzle'
    | 'trail'
    | 'spell_burst'
    | 'ult_aura'
    | 'dash_dust'
    | 'afterimage'
    | 'ward'
    | 'ready_pulse'
    | 'ink_slash'
    | 'impact_ring'
    | 'ember'
    | 'prism'
    | 'lightning';
  x: number;
  y: number;
  color: string;
  secondary?: string;
  facing?: 1 | -1;
  scale?: number;
}

export interface SfxKind {
  id:
    | 'light'
    | 'heavy'
    | 'ranged'
    | 'spell'
    | 'ult'
    | 'hit'
    | 'block'
    | 'whiff'
    | 'dash'
    | 'jump'
    | 'land'
    | 'deny'
    | 'ready'
    | 'ui_select'
    | 'ui_start';
  intensity?: number;
  pitch?: number;
}
