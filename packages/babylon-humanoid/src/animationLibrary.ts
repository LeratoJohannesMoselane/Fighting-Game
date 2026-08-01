/**
 * Loads Quaternius .glb animation files and retargets them onto a
 * procedural character.
 *
 * Uses `LoadAssetContainerAsync` rather than `ImportAnimationsAsync` because a
 * container keeps the imported junk (the source skeleton, its mesh, its nodes)
 * out of your scene. We lift the AnimationGroups out, retarget them, then throw
 * the container away — leaving a clean scene with only your character.
 */

import type { Scene } from '@babylonjs/core/scene';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { detectScheme } from './humanoidRig';
import { retargetAnimationGroup, stripRootMotion, type RetargetReport } from './retarget';

// Registering the glTF loader side-effect is required for .glb support.
import '@babylonjs/loaders/glTF/2.0';

export interface LoadedClip {
  name: string;
  group: AnimationGroup;
  report: RetargetReport;
}

export interface LoadClipOptions {
  /** Play looping once loaded. */
  loop?: boolean;
  /** Remove hips position tracks (turn a root-motion clip into in-place). */
  inPlace?: boolean;
  /** Explicit source→target bone name mapping if schemes differ. */
  nameMap?: Record<string, string>;
  /** Name for the resulting group; defaults to the file stem. */
  clipName?: string;
}

function fileStem(url: string): string {
  const last = url.split('/').pop() ?? url;
  return last.replace(/\.(glb|gltf)$/i, '');
}

/**
 * Load one .glb and retarget every animation inside it onto `skeleton`.
 * The source rig is disposed before returning.
 */
export async function loadAndRetargetClip(
  scene: Scene,
  url: string,
  skeleton: Skeleton,
  options: LoadClipOptions = {},
): Promise<LoadedClip[]> {
  const container = await LoadAssetContainerAsync(url, scene);

  try {
    if (container.animationGroups.length === 0) {
      throw new Error(
        `No animation groups found in "${url}". ` +
          `Confirm the file is an animation export and not a static mesh.`,
      );
    }

    const clips: LoadedClip[] = [];
    const stem = fileStem(url);
    const single = container.animationGroups.length === 1;

    container.animationGroups.forEach((sourceGroup, i) => {
      // Source groups must be stopped or they will fight the retargeted copy.
      sourceGroup.stop();

      // Naming priority:
      //  1. explicit clipName (only meaningful for single-clip files)
      //  2. the animation's OWN name from inside the .glb — a combined
      //     library like AnimationLibrary_Godot_Standard.glb carries real
      //     names ("Idle", "Walk", "Sword_Slash"), which are far more useful
      //     than positional "file_0", "file_1" keys.
      //  3. the file stem, for a single unnamed clip.
      const ownName = sourceGroup.name?.trim();
      const clipName =
        (single ? options.clipName : undefined) ??
        (ownName && ownName.length > 0 ? ownName : `${stem}_${i}`);

      const { group, report } = retargetAnimationGroup(
        sourceGroup,
        skeleton,
        clipName,
        options.nameMap,
      );

      if (options.inPlace) {
        const hips = skeleton.bones[0]?.name ?? 'Hips';
        stripRootMotion(group, hips);
      }

      group.loopAnimation = options.loop ?? true;
      clips.push({ name: clipName, group, report });
    });

    return clips;
  } finally {
    // Drop the source rig/mesh/nodes; our retargeted groups no longer need it.
    container.dispose();
  }
}

/**
 * Load a COMBINED animation library — one .glb holding many named clips.
 *
 * This is what the Quaternius Godot export actually ships:
 * `AnimationLibrary_Godot_Standard.glb` contains every animation as a
 * separately-named group, rather than one file per clip.
 *
 * @param only  Optional whitelist of clip names to keep (case-insensitive).
 *              Handy when a 130-animation library only needs six of them.
 */
export async function loadAnimationLibrary(
  scene: Scene,
  url: string,
  skeleton: Skeleton,
  options: Omit<LoadClipOptions, 'clipName'> & { only?: string[] } = {},
): Promise<Record<string, LoadedClip>> {
  const wanted = options.only?.map((n) => n.toLowerCase());
  const clips = await loadAndRetargetClip(scene, url, skeleton, options);

  const byName: Record<string, LoadedClip> = {};
  for (const clip of clips) {
    if (wanted && !wanted.includes(clip.name.toLowerCase())) {
      clip.group.dispose();
      continue;
    }
    byName[clip.name] = clip;
  }
  return byName;
}

/**
 * DIAGNOSTIC — run this ONCE against a downloaded .glb.
 *
 * It prints the real bone names in the file and tells you which naming scheme
 * they match, so you can configure your procedural rig correctly instead of
 * guessing. This is the single most useful thing to run first.
 */
export async function inspectGlb(
  scene: Scene,
  url: string,
): Promise<{
  boneNames: string[];
  animatedTargets: string[];
  animationGroupNames: string[];
  detected: ReturnType<typeof detectScheme>;
}> {
  const container = await LoadAssetContainerAsync(url, scene);

  try {
    const boneNames = container.skeletons.flatMap((s) => s.bones.map((b) => b.name));

    // What the animation tracks actually drive (TransformNodes in glTF).
    const animatedTargets = [
      ...new Set(
        container.animationGroups.flatMap((g) =>
          g.targetedAnimations.map((ta) => {
            const t = ta.target as { name?: unknown } | null;
            return t && typeof t.name === 'string' ? t.name : '<unnamed>';
          }),
        ),
      ),
    ];

    // Prefer real bones; fall back to animated node names for bone-less files.
    const namesForDetection = boneNames.length > 0 ? boneNames : animatedTargets;

    return {
      boneNames,
      animatedTargets,
      animationGroupNames: container.animationGroups.map((g) => g.name),
      detected: detectScheme(namesForDetection),
    };
  } finally {
    container.dispose();
  }
}

/** Console-friendly wrapper around {@link inspectGlb}. */
export async function printGlbBoneNames(scene: Scene, url: string): Promise<void> {
  const info = await inspectGlb(scene, url);
  console.group(`GLB inspection: ${url}`);
  console.log('Animation groups :', info.animationGroupNames);
  console.log('Bone count       :', info.boneNames.length);
  console.log('Bones            :', info.boneNames);
  console.log('Animated targets :', info.animatedTargets);
  console.log('Detected scheme  :', info.detected.schemeName);
  console.log('Matched slots    :', info.detected.matched.length, '/ 22');
  if (info.detected.missing.length) {
    console.warn('Missing slots    :', info.detected.missing);
  }
  console.groupEnd();
}
