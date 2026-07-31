/**
 * Game integration: spawn N independent fighters from ONE model file and one
 * animation library, then drive their clips from CombatCore's fighter state.
 *
 * Why this exists: `loadRiggedCharacter()` is fine for a single character, but
 * a versus game needs two (or more) fighters that animate independently while
 * sharing GPU resources. `AssetContainer.instantiateModelsToScene()` clones the
 * skeleton per instance, which is exactly what that requires — verified by the
 * 'two fighters animate independently' test.
 */

import type { Scene } from '@babylonjs/core/scene';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { retargetAnimationGroup, stripRootMotion } from './retarget';
import { slotForBoneName } from './humanoidRig';

import '@babylonjs/loaders/glTF/2.0';

/** One spawned fighter: its own root, its own skeleton, its own clips. */
export interface FighterRig {
  /** Move/rotate this to position the fighter in the world. */
  root: TransformNode;
  skeleton: Skeleton;
  /** Retargeted clips, keyed by the name you asked for. */
  clips: Map<string, AnimationGroup>;
  /** Currently playing clip key, or null. */
  playing: string | null;
  /**
   * Play a clip, cross-fading from the current one.
   * Returns false if the key is unknown (and logs once).
   */
  play(key: string, fadeMs?: number): boolean;
  /** Face +X (1) or -X (-1) — matches CombatCore's `facing`. */
  setFacing(dir: 1 | -1): void;
  dispose(): void;
}

export interface FighterFactory {
  /** Spawn another independent fighter from the same loaded assets. */
  spawn(name: string): FighterRig;
  /** Clip names available (post-rename). */
  readonly clipNames: string[];
  /** Free the shared model + library. Call after disposing all fighters. */
  dispose(): void;
}

export interface CreateFighterFactoryOptions {
  /** URL of the rigged model, e.g. '/animations/Mannequin_F.glb'. */
  modelUrl: string;
  /** URL of the combined animation library, e.g. '/animations/UAL2_Standard.glb'. */
  libraryUrl: string;
  /** Only retarget these clips (by their in-file name). Empty = all. */
  only?: string[];
  /** Map in-file clip name → your gameplay key. */
  rename?: Record<string, string>;
  /** Clip keys that should loop. Default: anything ending in `_LOOP`. */
  loop?: (clipKey: string) => boolean;
  /** Strip root motion from every clip (keeps fighters where you put them). */
  inPlace?: boolean;
  /** Uniform scale for each spawned fighter. */
  scale?: number;
  /**
   * Extra keys that reuse an already-loaded clip, e.g.
   * `[{ alias: 'heavy', target: 'light' }]` when both use MELEE_HOOK.
   * Avoids retargeting the same animation twice.
   */
  aliases?: Array<{ alias: string; target: string }>;
}

/**
 * Load the model + library ONCE, then hand back a factory that can spawn any
 * number of independently-animated fighters.
 */
export async function createFighterFactory(
  scene: Scene,
  options: CreateFighterFactoryOptions,
): Promise<FighterFactory> {
  const modelContainer = await LoadAssetContainerAsync(options.modelUrl, scene);
  if (modelContainer.skeletons.length === 0) {
    modelContainer.dispose();
    throw new Error(
      `"${options.modelUrl}" has no skeleton — that's an animation file, not a rigged model. ` +
        `Point modelUrl at Mannequin_F.glb.`,
    );
  }

  const libraryContainer = await LoadAssetContainerAsync(options.libraryUrl, scene);
  if (libraryContainer.animationGroups.length === 0) {
    modelContainer.dispose();
    libraryContainer.dispose();
    throw new Error(
      `"${options.libraryUrl}" contains no animations. ` + `Point libraryUrl at UAL2_Standard.glb.`,
    );
  }

  // Source clips must never play — they'd fight the retargeted copies.
  for (const group of libraryContainer.animationGroups) group.stop();

  const wanted = options.only?.map((n) => n.toLowerCase());
  const shouldLoop = options.loop ?? ((key: string) => /_LOOP$/i.test(key));

  const sources: { key: string; group: AnimationGroup }[] = [];
  for (const group of libraryContainer.animationGroups) {
    const original = group.name;
    if (wanted && !wanted.includes(original.toLowerCase())) continue;
    sources.push({ key: options.rename?.[original] ?? original, group });
  }

  if (sources.length === 0) {
    const available = libraryContainer.animationGroups
      .map((g) => g.name)
      .slice(0, 12)
      .join(', ');
    modelContainer.dispose();
    libraryContainer.dispose();
    throw new Error(`None of the requested clips were found. Available include: ${available}…`);
  }

  let spawnCount = 0;
  const rigs = new Set<FighterRig>();

  function spawn(name: string): FighterRig {
    const id = `${name}_${spawnCount++}`;
    // Cloning gives this fighter its own skeleton, so it animates alone.
    const instance = modelContainer.instantiateModelsToScene((n) => `${id}_${n}`, false);
    const skeleton = instance.skeletons[0];
    if (!skeleton) throw new Error('Instantiated model has no skeleton.');

    // Model's own baked clips (if any) are noise here.
    for (const g of instance.animationGroups) g.dispose();

    const root = new TransformNode(`${id}_root`, scene);
    const scale = options.scale ?? 1;
    root.scaling = new Vector3(scale, scale, scale);
    for (const node of instance.rootNodes) {
      if (!node.parent) node.parent = root;
    }

    // Retarget every wanted clip onto THIS fighter's skeleton.
    const clips = new Map<string, AnimationGroup>();
    const hipsBone = skeleton.bones.find((b) => slotForBoneName(b.name) === 'Hips');
    for (const { key, group } of sources) {
      const { group: retargeted } = retargetAnimationGroup(group, skeleton, `${id}_${key}`);
      if (options.inPlace && hipsBone) stripRootMotion(retargeted, hipsBone.name);
      retargeted.loopAnimation = shouldLoop(key);
      retargeted.stop();
      clips.set(key, retargeted);
    }

    // Aliases point at an existing group rather than retargeting again.
    for (const { alias, target } of options.aliases ?? []) {
      const existing = clips.get(target);
      if (existing && !clips.has(alias)) clips.set(alias, existing);
    }

    let current: AnimationGroup | null = null;
    let currentKey: string | null = null;
    const warned = new Set<string>();

    const rig: FighterRig = {
      root,
      skeleton,
      clips,
      get playing() {
        return currentKey;
      },
      play(key, fadeMs = 160) {
        const next = clips.get(key);
        if (!next) {
          if (!warned.has(key)) {
            warned.add(key);
            console.warn(`[${id}] unknown clip "${key}". Have: ${[...clips.keys()].join(', ')}`);
          }
          return false;
        }
        if (currentKey === key) return true;

        // Manual weight blend: Babylon has no built-in cross-fade for groups.
        next.setWeightForAllAnimatables(current ? 0 : 1);
        if (!next.isPlaying) next.play(next.loopAnimation);

        const from = current;
        if (from && fadeMs > 0) {
          const started = performance.now();
          const obs = scene.onBeforeRenderObservable.add(() => {
            const t = Math.min(1, (performance.now() - started) / fadeMs);
            next.setWeightForAllAnimatables(t);
            from.setWeightForAllAnimatables(1 - t);
            if (t >= 1) {
              from.stop();
              scene.onBeforeRenderObservable.remove(obs);
            }
          });
        } else if (from) {
          from.stop();
        }

        current = next;
        currentKey = key;
        return true;
      },
      setFacing(dir) {
        // Model faces +Z by default; yaw 90° either way to face along X.
        root.rotation.y = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      },
      dispose() {
        for (const g of clips.values()) g.dispose();
        clips.clear();
        instance.dispose();
        root.dispose();
        rigs.delete(rig);
      },
    };

    rigs.add(rig);
    return rig;
  }

  return {
    spawn,
    clipNames: sources.map((s) => s.key),
    dispose() {
      for (const rig of [...rigs]) rig.dispose();
      modelContainer.dispose();
      libraryContainer.dispose();
    },
  };
}

/** Re-exported for callers that want the raw containers. */
export type { AssetContainer };
