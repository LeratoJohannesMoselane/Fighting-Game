/**
 * Renderer-agnostic procedural asset contracts.
 * Canvas implements these now; Babylon can implement the same interfaces later
 * without changing CombatCore or move JSON.
 */

export type BoneId =
  | 'root'
  | 'spine'
  | 'neck'
  | 'head'
  | 'l_arm'
  | 'r_arm'
  | 'l_forearm'
  | 'r_forearm'
  | 'l_leg'
  | 'r_leg'
  | 'weapon'
  | 'weapon_l'
  | 'cape';

/** Degrees, local space. */
export interface BonePose {
  rot: number;
  /** Optional local offset (presentation units). */
  ox?: number;
  oy?: number;
  scaleX?: number;
  scaleY?: number;
}

export type PoseMap = Partial<Record<BoneId, BonePose>>;

export interface AttachPoint {
  id: string;
  bone: BoneId;
  /** Offset along bone local +X (toward hand/weapon tip). */
  along: number;
  /** Perpendicular offset. */
  perp: number;
}

export interface BodyPartDef {
  id: string;
  bone: BoneId;
  shape: 'box' | 'capsule' | 'sphere' | 'ellipse' | 'poly';
  /** Local rect relative to bone origin (presentation units). */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  accent?: string;
  z: number;
  /** Optional polygon points local to bone (for unique silhouettes). */
  points?: { x: number; y: number }[];
}

export interface FighterVisualProfile {
  id: string;
  displayName: string;
  /** Overall scale of the figure. */
  height: number;
  width: number;
  primary: string;
  secondary: string;
  accent: string;
  silhouette: 'slim' | 'stocky' | 'tall_mage' | 'balanced';
  parts: BodyPartDef[];
  attach: AttachPoint[];
  idleSway: number;
  walkBob: number;
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
    | 'ready_pulse';
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
  /** 0–1 */
  intensity?: number;
  pitch?: number;
}
