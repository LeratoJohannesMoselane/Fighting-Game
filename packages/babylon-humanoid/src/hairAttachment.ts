/**
 * Hairstyles + eyebrows that ride the head bone.
 *
 * The pack ships these under `Hairstyles/Rigged to Head Bone/glTF (Godot-Unreal)/`
 * as `.gltf` + `.bin` pairs. Two things follow from that:
 *
 *  1. **They must be served over HTTP.** A `.gltf` is JSON that references its
 *     `.bin` by relative filename, so the loader needs a real URL to resolve
 *     the sibling. Keep the pair together in the same folder.
 *
 *  2. **They are separate meshes, not part of the body.** Loading one gives you
 *     geometry with no skeleton of its own; you parent it to the body's head
 *     bone with `attachToBone`, and it then follows every animation for free.
 *
 * Verified: an attached hair mesh lands at head height (y ≈ 1.56 on the
 * mannequin), not at the origin.
 */

import type { Scene } from '@babylonjs/core/scene';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Skeleton } from '@babylonjs/core/Bones/skeleton';
import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { slotForBoneName } from './humanoidRig';

import '@babylonjs/loaders/glTF/2.0';

/** Hairstyle files in the pack (Rigged to Head Bone / glTF). */
export const HAIRSTYLES = [
  'Hair_Beard',
  'Hair_Buns',
  'Hair_Buzzed',
  'Hair_BuzzedFemale',
  'Hair_Long',
  'Hair_SimpleParted',
] as const;

/** Eyebrow files in the pack. */
export const EYEBROWS = ['Eyebrows_Female', 'Eyebrows_Regular'] as const;

export type Hairstyle = (typeof HAIRSTYLES)[number];
export type Eyebrows = (typeof EYEBROWS)[number];

export interface AttachOptions {
  /** Folder the .gltf/.bin pairs are served from. */
  baseUrl?: string;
  /** Tint applied to the attached meshes. */
  color?: string;
  /** Local offset from the head bone, in metres. */
  offset?: Vector3;
  /** Uniform scale of the attachment. */
  scale?: number;
}

/** A loaded head attachment, ready to be disposed with its wearer. */
export interface HeadAttachment {
  name: string;
  meshes: AbstractMesh[];
  dispose(): void;
}

/**
 * Join a base folder and a file name into a loadable source.
 *
 * Passes through anything already resolvable — absolute URLs, `data:` sources,
 * and paths that are already rooted — so callers can hand us either a bare
 * file name ("Hair_Long") or a full URL.
 */
export function resolveAssetUrl(base: string, file: string): string {
  if (/^(data:|blob:|https?:\/\/|\/)/i.test(file)) return file;
  const folder = base ? base.replace(/\/?$/, '/') : '';
  const withExt = /\.(gltf|glb)$/i.test(file) ? file : `${file}.gltf`;
  return `${folder}${withExt}`;
}

/**
 * Load a `.gltf` head accessory and bind it to a skeleton's head bone.
 *
 * @param skeleton   The fighter's skeleton (its Head bone is found for you).
 * @param bodyMesh   Any mesh skinned to that skeleton — Babylon needs it to
 *                   resolve the bone's world matrix.
 */
export async function attachToHead(
  scene: Scene,
  skeleton: Skeleton,
  bodyMesh: AbstractMesh,
  fileName: string,
  options: AttachOptions = {},
): Promise<HeadAttachment> {
  const url = resolveAssetUrl(options.baseUrl ?? '/characters/hair/', fileName);

  const head = skeleton.bones.find((b) => slotForBoneName(b.name) === 'Head');
  if (!head) {
    throw new Error(
      `Skeleton "${skeleton.name}" has no Head bone — cannot attach "${fileName}". ` +
        `Check the rig's bone naming.`,
    );
  }

  const container = await LoadAssetContainerAsync(url, scene);
  container.addAllToScene();

  const meshes = container.meshes.filter((m) => m.getTotalVertices() > 0);
  if (meshes.length === 0) {
    container.dispose();
    throw new Error(`"${url}" contained no geometry.`);
  }

  const tint = options.color ? Color3.FromHexString(options.color) : null;
  const scale = options.scale ?? 1;

  for (const mesh of meshes) {
    // Only bind top-level meshes; children ride along with their parent.
    if (!mesh.parent || !meshes.includes(mesh.parent as AbstractMesh)) {
      mesh.attachToBone(head, bodyMesh);
      if (options.offset) mesh.position.addInPlace(options.offset);
      if (scale !== 1) mesh.scaling.scaleInPlace(scale);
    }
    if (tint) tintMesh(mesh, tint);
  }

  return {
    name: fileName,
    meshes,
    dispose: () => container.dispose(),
  };
}

function tintMesh(mesh: AbstractMesh, tint: Color3): void {
  const mat = mesh.material;
  if (mat instanceof PBRMaterial) mat.albedoColor = tint;
  else if (mat instanceof StandardMaterial) mat.diffuseColor = tint;
}
