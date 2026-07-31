/**
 * Aether Break roster built from the Quaternius character pack.
 *
 * Asset layout this expects (copy from the extracted pack):
 *
 *   public/characters/
 *     bodies/
 *       Superhero_Female_FullBody.gltf   + .bin   ← Base Characters/Godot - UE/
 *       Superhero_Male_FullBody.gltf     + .bin
 *       T_Superhero_Female_Dark_BaseColor.png     ← textures, same folder
 *       T_Superhero_Male_Dark.png
 *       …
 *     hair/
 *       Hair_Long.gltf + .bin                     ← Hairstyles/Rigged to Head Bone/glTF/
 *       Hair_Buns.gltf + .bin
 *       …
 *     animations/
 *       UAL2_Standard.glb                          ← the animation library
 *
 * **Keep each `.gltf` next to its `.bin` and textures** — a `.gltf` references
 * them by relative filename, so splitting them up breaks the load.
 */

import type { Scene } from '@babylonjs/core/scene';
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
import { applyStyle, type CharacterStyle } from './roster3d';
import {
  attachToHead,
  resolveAssetUrl,
  type Eyebrows,
  type Hairstyle,
  type HeadAttachment,
} from './hairAttachment';

/** Which base body a character uses. */
export type BodyType = 'female' | 'male';

/** Full recipe for one Aether Break fighter. */
export interface AetherCharacter extends CharacterStyle {
  /** Display name, for HUD/debug. */
  name: string;
  body: BodyType;
  hair?: Hairstyle;
  /** Defaults to Eyebrows_Female / Eyebrows_Regular based on body. */
  eyebrows?: Eyebrows;
  /** Hair tint; falls back to the character's accent, then its main colour. */
  hairColor?: string;
}

/**
 * The four fighters, mapped onto the pack's two base bodies.
 *
 * Silhouette is doing most of the work here: body type, hair shape, build
 * scaling and — most importantly — a different clip map, so Bram punches while
 * Nyra slashes. Colour is the last and weakest signal.
 */
export const AETHER_CHARACTERS: Record<string, AetherCharacter> = {
  nyra_vex: {
    id: 'nyra_vex',
    name: 'Nyra Vex',
    body: 'female',
    hair: 'Hair_Long',
    eyebrows: 'Eyebrows_Female',
    color: '#00BCD4',
    accent: '#E040FB',
    hairColor: '#2A1A3E',
    scale: 0.98,
    heightScale: 1.02,
    widthScale: 0.94,
    clipMap: { ...DEFAULT_CLIP_MAP, idle: 'IDLE_NO_LOOP', ranged: 'OVERHANDTHROW' },
  },
  bram_kade: {
    id: 'bram_kade',
    name: 'Bram Kade',
    body: 'male',
    hair: 'Hair_Beard',
    eyebrows: 'Eyebrows_Regular',
    color: '#E65100',
    accent: '#FFD600',
    hairColor: '#3A2418',
    scale: 1.1,
    heightScale: 1.0,
    widthScale: 1.18,
    clipMap: { ...BRAWLER_CLIP_MAP, heavy: 'SWORD_HEAVY_COMBO' },
  },
  iria_sol: {
    id: 'iria_sol',
    name: 'Iria Sol',
    body: 'female',
    hair: 'Hair_Buns',
    eyebrows: 'Eyebrows_Female',
    color: '#E040FB',
    accent: '#00BCD4',
    hairColor: '#E8E0F0',
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
  kellan_wisp: {
    id: 'kellan_wisp',
    name: 'Kellan Wisp',
    body: 'male',
    hair: 'Hair_Buzzed',
    eyebrows: 'Eyebrows_Regular',
    color: '#00E5FF',
    accent: '#1A237E',
    hairColor: '#1B2A3A',
    scale: 1.0,
    heightScale: 1.0,
    widthScale: 0.98,
    clipMap: { ...DEFAULT_CLIP_MAP, idle: 'IDLE_FOLDARMS_LOOP', dash: 'SWORD_DASH' },
  },
};

export interface AetherRosterOptions {
  /** Folder holding the two body .gltf files (+ .bin + textures). */
  bodiesUrl?: string;
  /** Folder holding the hair/eyebrow .gltf files (+ .bin). */
  hairUrl?: string;
  /** The combined animation library. */
  libraryUrl: string;
  /** Override the default character table. */
  characters?: Record<string, AetherCharacter>;
  /** Skip hair/eyebrow loading (faster startup while prototyping). */
  skipHair?: boolean;
  /** File name for each body type. */
  bodyFiles?: Record<BodyType, string>;
}

/** A spawned Aether fighter: rig + attachments + per-character clip access. */
export interface AetherFighter extends FighterRig {
  character: AetherCharacter;
  attachments: HeadAttachment[];
  playKey(key: FighterAnimKey, fadeMs?: number): boolean;
}

const DEFAULT_BODY_FILES: Record<BodyType, string> = {
  female: 'Superhero_Female_FullBody.gltf',
  male: 'Superhero_Male_FullBody.gltf',
};

/**
 * Build the Aether Break roster.
 *
 * One factory per body type (female/male), sharing a single animation library.
 * Characters on the same body share geometry on the GPU; materials are cloned
 * per fighter so tinting one never recolours another.
 */
export async function createAetherRoster(
  scene: Scene,
  options: AetherRosterOptions,
): Promise<{
  spawn(rosterId: string, instanceName?: string): Promise<AetherFighter>;
  /** Body types that loaded successfully. */
  readonly bodies: BodyType[];
  dispose(): void;
}> {
  const characters = options.characters ?? AETHER_CHARACTERS;
  const bodiesUrl = options.bodiesUrl ?? '/characters/bodies/';
  const hairUrl = options.hairUrl ?? '/characters/hair/';
  const bodyFiles = options.bodyFiles ?? DEFAULT_BODY_FILES;

  // Only load the bodies the roster actually uses.
  const neededBodies = [...new Set(Object.values(characters).map((c) => c.body))];

  // Union of every character's clips, so one library serves them all.
  const clipSet = new Set<string>();
  for (const c of Object.values(characters)) {
    for (const clip of clipsUsedBy(c.clipMap ?? DEFAULT_CLIP_MAP)) clipSet.add(clip);
  }
  const rename: Record<string, string> = {};
  for (const c of Object.values(characters)) {
    Object.assign(rename, renameFromClipMap(c.clipMap ?? DEFAULT_CLIP_MAP));
  }
  const aliases: Array<{ alias: string; target: string }> = [];
  for (const c of Object.values(characters)) {
    const map = c.clipMap ?? DEFAULT_CLIP_MAP;
    for (const [key, clip] of Object.entries(map) as [FighterAnimKey, Ual2Clip][]) {
      const owner = rename[clip];
      if (owner && owner !== key && !aliases.some((a) => a.alias === key)) {
        aliases.push({ alias: key, target: owner });
      }
    }
  }

  const factories = new Map<BodyType, FighterFactory>();
  for (const body of neededBodies) {
    factories.set(
      body,
      await createFighterFactory(scene, {
        modelUrl: resolveAssetUrl(bodiesUrl, bodyFiles[body]),
        libraryUrl: options.libraryUrl,
        only: [...clipSet],
        rename,
        aliases,
        inPlace: true,
        cloneMaterials: true,
      }),
    );
  }

  async function spawn(rosterId: string, instanceName?: string): Promise<AetherFighter> {
    const character = characters[rosterId];
    if (!character) {
      throw new Error(
        `Unknown character "${rosterId}". Known: ${Object.keys(characters).join(', ')}`,
      );
    }
    const factory = factories.get(character.body);
    if (!factory) throw new Error(`Body "${character.body}" was not loaded.`);

    const rig = factory.spawn(instanceName ?? rosterId);
    applyStyle(rig, character);

    // Head accessories ride the head bone and follow every animation.
    const attachments: HeadAttachment[] = [];
    if (!options.skipHair) {
      const bodyMesh = findSkinnedMesh(rig);
      if (bodyMesh) {
        const hairTint = character.hairColor ?? character.accent ?? character.color;
        const wanted: Array<{ file: string; color: string }> = [];
        if (character.hair) wanted.push({ file: character.hair, color: hairTint });
        const brows =
          character.eyebrows ??
          (character.body === 'female' ? 'Eyebrows_Female' : 'Eyebrows_Regular');
        wanted.push({ file: brows, color: hairTint });

        for (const { file, color } of wanted) {
          try {
            attachments.push(
              await attachToHead(scene, rig.skeleton, bodyMesh, file, {
                baseUrl: hairUrl,
                color,
              }),
            );
          } catch (err) {
            // A missing hairstyle must not stop the fighter appearing.
            console.warn(`[${rosterId}] could not attach "${file}":`, err);
          }
        }
      }
    }

    const map = character.clipMap ?? DEFAULT_CLIP_MAP;
    const baseDispose = rig.dispose.bind(rig);

    return Object.assign(rig, {
      character,
      attachments,
      playKey(key: FighterAnimKey, fadeMs?: number) {
        if (rig.clips.has(key)) return rig.play(key, fadeMs);
        const clip = map[key];
        const viaClip = clip ? rename[clip] : undefined;
        return viaClip ? rig.play(viaClip, fadeMs) : false;
      },
      dispose() {
        for (const a of attachments) a.dispose();
        baseDispose();
      },
    });
  }

  return {
    spawn,
    bodies: [...factories.keys()],
    dispose() {
      for (const f of factories.values()) f.dispose();
      factories.clear();
    },
  };
}

/** First mesh bound to this rig's skeleton — needed for bone attachment. */
function findSkinnedMesh(rig: FighterRig): AbstractMesh | null {
  for (const mesh of rig.root.getChildMeshes()) {
    if (mesh.skeleton === rig.skeleton) return mesh;
  }
  return rig.root.getChildMeshes()[0] ?? null;
}

/** Position fighters at their round-start marks. */
export function placeFighters(p1: FighterRig, p2: FighterRig, gapWorldUnits = 6.8): void {
  const half = gapWorldUnits / 2;
  p1.root.position = new Vector3(-half, 0, 0);
  p2.root.position = new Vector3(half, 0, 0);
  p1.setFacing(1);
  p2.setFacing(-1);
}
