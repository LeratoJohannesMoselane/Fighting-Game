/**
 * One model, four fighters.
 *
 * Every Aether Break character uses the same `Mannequin_F.glb` puppet. They are
 * told apart by three cheap, per-instance levers:
 *
 *   1. **Tint**   — each roster colour applied to a CLONED material.
 *   2. **Build**  — height/bulk scaling, so Bram reads heavier than Nyra.
 *   3. **Motion** — a different clip map per character (sword / brawler / …),
 *                   which is what actually sells them as different fighters.
 *
 * The material clone matters: `instantiateModelsToScene(name, false)` shares one
 * material across every instance, so tinting one fighter would tint them all.
 * There's a test pinning that behaviour.
 */

import type { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { createFighterFactory, type FighterFactory, type FighterRig } from './fighterRig';
import {
  BRAWLER_CLIP_MAP,
  DEFAULT_CLIP_MAP,
  clipsUsedBy,
  renameFromClipMap,
  type FighterAnimKey,
  type Ual2Clip,
} from './combatClipMap';

/** Per-character presentation on the shared mannequin. */
export interface CharacterStyle {
  /** Roster id, e.g. 'nyra_vex'. */
  id: string;
  /** Main tint, usually the roster colour. */
  color: string;
  /** Secondary tint used for emissive rim/accents. */
  accent?: string;
  /** Overall size multiplier (1 = mannequin default). */
  scale?: number;
  /** Extra vertical stretch — >1 reads taller/lankier. */
  heightScale?: number;
  /** Extra width — >1 reads heavier. */
  widthScale?: number;
  /** Which clips this character uses. Defaults to the sword set. */
  clipMap?: Record<FighterAnimKey, Ual2Clip>;
}

/**
 * Default styling for the Aether Break roster, derived from each character's
 * archetype in `apps/web/src/roster.ts`.
 */
export const AETHER_STYLES: Record<string, CharacterStyle> = {
  // Rift Gunslinger — agile mid-range. Slim, cyan, throws things.
  nyra_vex: {
    id: 'nyra_vex',
    color: '#00BCD4',
    accent: '#E040FB',
    scale: 0.98,
    heightScale: 1.02,
    widthScale: 0.94,
    clipMap: { ...DEFAULT_CLIP_MAP, idle: 'IDLE_NO_LOOP', ranged: 'OVERHANDTHROW' },
  },
  // Forge Warden — armoured bruiser. Big, orange, punches.
  bram_kade: {
    id: 'bram_kade',
    color: '#E65100',
    accent: '#FFD600',
    scale: 1.1,
    heightScale: 1.0,
    widthScale: 1.18,
    clipMap: { ...BRAWLER_CLIP_MAP, heavy: 'SWORD_HEAVY_COMBO' },
  },
  // Prism Magus — zoner. Slight, violet, casts.
  iria_sol: {
    id: 'iria_sol',
    color: '#E040FB',
    accent: '#00BCD4',
    scale: 0.96,
    heightScale: 1.04,
    widthScale: 0.9,
    clipMap: {
      ...DEFAULT_CLIP_MAP,
      idle: 'IDLE_LANTERN_LOOP',
      spell: 'SHIELD_ONESHOT',
      ranged: 'OVERHANDTHROW',
    },
  },
  // Stormblade — rushdown. Lean, electric, sword-heavy.
  kellan_wisp: {
    id: 'kellan_wisp',
    color: '#00E5FF',
    accent: '#1A237E',
    scale: 1.0,
    heightScale: 1.0,
    widthScale: 0.98,
    clipMap: { ...DEFAULT_CLIP_MAP, idle: 'IDLE_FOLDARMS_LOOP', dash: 'SWORD_DASH' },
  },
};

/** Fallback for a roster id with no explicit style. */
export const NEUTRAL_STYLE: CharacterStyle = {
  id: 'default',
  color: '#9aa7bd',
  scale: 1,
  clipMap: DEFAULT_CLIP_MAP,
};

export function styleFor(id: string): CharacterStyle {
  return AETHER_STYLES[id] ?? { ...NEUTRAL_STYLE, id };
}

/**
 * The union of clips every style needs.
 * Pass this as `only` so one factory can serve the whole roster.
 */
export function rosterClips(styles: CharacterStyle[] = Object.values(AETHER_STYLES)): string[] {
  const set = new Set<string>();
  for (const s of styles) {
    for (const clip of clipsUsedBy(s.clipMap ?? DEFAULT_CLIP_MAP)) set.add(clip);
  }
  return [...set];
}

/**
 * A spawned, styled fighter. Same as a FighterRig plus the style applied and a
 * per-character clip resolver.
 */
export interface StyledFighter extends FighterRig {
  style: CharacterStyle;
  /** Play by gameplay key, mapped through this character's clip map. */
  playKey(key: FighterAnimKey, fadeMs?: number): boolean;
}

/**
 * Build a roster factory: ONE `Mannequin_F.glb` + ONE `UAL2_Standard.glb`
 * serving every character.
 */
export async function createRoster(
  scene: Scene,
  options: {
    modelUrl: string;
    libraryUrl: string;
    /** Styles to support. Defaults to the full Aether Break roster. */
    styles?: CharacterStyle[];
    inPlace?: boolean;
  },
): Promise<{
  /** Spawn a fighter for a roster id, styled accordingly. */
  spawn(rosterId: string, instanceName?: string): StyledFighter;
  factory: FighterFactory;
  dispose(): void;
}> {
  const styles = options.styles ?? Object.values(AETHER_STYLES);

  // Every clip any character might need, loaded once.
  const only = rosterClips(styles);

  // Rename/alias from the union of all maps so each key resolves.
  const rename: Record<string, string> = {};
  const aliases: Array<{ alias: string; target: string }> = [];
  for (const style of styles) {
    const map = style.clipMap ?? DEFAULT_CLIP_MAP;
    Object.assign(rename, renameFromClipMap(map));
  }
  // Aliases are computed against the merged rename so nothing is orphaned.
  for (const style of styles) {
    const map = style.clipMap ?? DEFAULT_CLIP_MAP;
    for (const [key, clip] of Object.entries(map) as [FighterAnimKey, Ual2Clip][]) {
      const owner = rename[clip];
      if (owner && owner !== key && !aliases.some((a) => a.alias === key)) {
        aliases.push({ alias: key, target: owner });
      }
    }
  }

  const factory = await createFighterFactory(scene, {
    modelUrl: options.modelUrl,
    libraryUrl: options.libraryUrl,
    only,
    rename,
    aliases,
    inPlace: options.inPlace ?? true,
    // Materials are cloned per instance so tinting one fighter cannot
    // recolour the others.
    cloneMaterials: true,
  });

  function spawn(rosterId: string, instanceName?: string): StyledFighter {
    const style = styleFor(rosterId);
    const rig = factory.spawn(instanceName ?? rosterId);

    applyStyle(rig, style);

    const map = style.clipMap ?? DEFAULT_CLIP_MAP;
    const styled: StyledFighter = Object.assign(rig, {
      style,
      playKey(key: FighterAnimKey, fadeMs?: number) {
        // Prefer the key itself (aliases make most resolve directly); fall
        // back to whatever this character's map points the key at.
        if (rig.clips.has(key)) return rig.play(key, fadeMs);
        const clip = map[key];
        const viaClip = clip ? rename[clip] : undefined;
        return viaClip ? rig.play(viaClip, fadeMs) : false;
      },
    });
    return styled;
  }

  return {
    spawn,
    factory,
    dispose: () => factory.dispose(),
  };
}

/** Apply tint + build to an already-spawned rig. */
export function applyStyle(rig: FighterRig, style: CharacterStyle): void {
  const s = style.scale ?? 1;
  rig.root.scaling = new Vector3(
    s * (style.widthScale ?? 1),
    s * (style.heightScale ?? 1),
    s * (style.widthScale ?? 1),
  );

  const tint = Color3.FromHexString(style.color);
  const accent = style.accent ? Color3.FromHexString(style.accent) : null;

  for (const mesh of rig.root.getChildMeshes()) {
    tintMesh(mesh, tint, accent);
  }
}

/** Recolour one mesh's material, handling both PBR and Standard. */
function tintMesh(mesh: AbstractMesh, tint: Color3, accent: Color3 | null): void {
  const material: Material | null = mesh.material;
  if (!material) return;

  if (material instanceof PBRMaterial) {
    material.albedoColor = tint;
    if (accent) {
      material.emissiveColor = accent.scale(0.14);
    }
  } else if (material instanceof StandardMaterial) {
    material.diffuseColor = tint;
    if (accent) material.emissiveColor = accent.scale(0.14);
  }
}
