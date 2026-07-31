/**
 * Runnable demo — procedural character driven by Quaternius .glb animations.
 *
 *   pnpm --filter @aether-break/babylon-humanoid demo
 *
 * Drop your .glb files into `demo/public/animations/` first. If none are
 * found the demo still runs: you get the character in its T-pose bind pose
 * plus a clear on-screen message telling you what to do.
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { GridMaterial } from '@babylonjs/materials/grid/gridMaterial';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/loaders/glTF/2.0';

import {
  CharacterController,
  createProceduralCharacter,
  loadRiggedCharacter,
  describeRig,
  inspectGlb,
  UNITY_SCHEME,
  detectScheme,
  type AnimatableCharacter,
  type NamingScheme,
} from '../src/index';
import { HUMANOID_ORDER } from '../src/humanoidRig';

/**
 * CONFIG — matches the real Universal Animation Library 2 [Standard] layout.
 *
 * Copy these two files out of the extracted pack into demo/public/animations/ :
 *
 *   Female Mannequin/Unreal-Godot/Mannequin_F.glb   → the CHARACTER model
 *   Unreal-Godot/UAL2_Standard.glb                  → ALL the animations
 *
 * (`UAL2_Standard_RM.glb` is the same clips WITH root motion — the character
 *  travels through space. Use the plain one for in-place locomotion.)
 */

/** The rigged character. Set to null to use the procedural box-man instead. */
const MODEL_URL: string | null = '/animations/Mannequin_F.glb';

/** The combined animation library — every clip lives in this one file. */
const LIBRARY_URL: string | null = '/animations/UAL2_Standard.glb';

/**
 * Only load these clips (the library holds 40+ in the free tier).
 * Leave empty to load everything, then read the real names off the buttons.
 */
const LIBRARY_ONLY: string[] = [];

/** Map the pack's clip names onto your own gameplay keys. */
const RENAME: Record<string, string> = {};

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, antialias: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.06, 0.1, 1);

const camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.15, 4.5, new Vector3(0, 0.95, 0), scene);
camera.attachControl(canvas, true);
camera.wheelDeltaPercentage = 0.02;
camera.lowerRadiusLimit = 1.5;
camera.upperRadiusLimit = 14;

const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
hemi.intensity = 0.75;
hemi.groundColor = new Color3(0.16, 0.17, 0.24);

const key = new DirectionalLight('key', new Vector3(-0.5, -1, 0.6), scene);
key.position = new Vector3(4, 8, -5);
key.intensity = 1.1;

const ground = CreateGround('ground', { width: 24, height: 24 }, scene);
const grid = new GridMaterial('grid', scene);
grid.majorUnitFrequency = 5;
grid.gridRatio = 0.5;
grid.mainColor = new Color3(0.07, 0.08, 0.12);
grid.lineColor = new Color3(0.22, 0.3, 0.45);
grid.opacity = 0.96;
ground.material = grid;

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

/**
 * The rig is created with UNITY_SCHEME by default. If your .glb turns out to
 * use different names, the loader still bridges it semantically — and the
 * on-screen report will tell you exactly what was detected.
 */
const scheme: NamingScheme = UNITY_SCHEME;
let character: AnimatableCharacter = createProceduralCharacter(scene, { scheme, name: 'hero' });
let controller = new CharacterController(scene, character);
let viewer: SkeletonViewer | null = null;

const hud = document.getElementById('hud')!;
const buttonBar = document.getElementById('buttons')!;
const log = document.getElementById('log')!;

function setLog(html: string): void {
  log.innerHTML = html;
}

function rebuildButtons(keys: string[]): void {
  buttonBar.replaceChildren();
  for (const k of keys) {
    const b = document.createElement('button');
    b.textContent = k.toUpperCase();
    b.onclick = () => {
      controller.play(k);
      highlight(k);
    };
    b.dataset.key = k;
    buttonBar.appendChild(b);
  }

  const toggle = document.createElement('button');
  toggle.textContent = 'SKELETON';
  toggle.className = 'ghost';
  toggle.onclick = () => {
    if (viewer) {
      viewer.dispose();
      viewer = null;
      return;
    }
    // Either character shape works; find any mesh bound to this skeleton.
    const skinned = scene.meshes.find((m) => m.skeleton === character.skeleton);
    if (!skinned) return;
    viewer = new SkeletonViewer(character.skeleton, skinned, scene, false, 3, {
      displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS,
    });
    viewer.isEnabled = true;
  };
  buttonBar.appendChild(toggle);
}

function highlight(active: string): void {
  for (const b of buttonBar.querySelectorAll('button')) {
    b.classList.toggle('active', (b as HTMLButtonElement).dataset.key === active);
  }
}

async function boot(): Promise<void> {
  setLog('Loading…');
  let note = '';

  // ---- 1. Character: real model if provided, else the procedural box-man ----
  if (MODEL_URL) {
    try {
      const model = await loadRiggedCharacter(scene, MODEL_URL, { name: 'mannequin' });
      const desc = describeRig(model);
      character.dispose();
      controller.dispose();
      character = model;
      controller = new CharacterController(scene, character);
      note +=
        `<b>Model:</b> <code>${MODEL_URL}</code> — ` +
        `${desc.boneCount} bones, ${desc.mappedSlots.length}/${HUMANOID_ORDER.length} humanoid slots mapped<br>`;
    } catch {
      note +=
        `<span class="warn">Could not load <code>${MODEL_URL}</code></span> — ` +
        `using the procedural character instead.<br>`;
    }
  }

  // ---- 2. Inspect the animation source so nothing is guesswork ----
  const probeUrl = LIBRARY_URL ?? MODEL_URL;
  if (probeUrl) {
    try {
      const info = await inspectGlb(scene, probeUrl);
      note +=
        `<b>Rig naming:</b> ${info.detected.schemeName} ` +
        `(${info.detected.matched.length}/${HUMANOID_ORDER.length} slots)<br>` +
        `<b>Clips in file:</b> ${info.animationGroupNames.length}<br>`;
    } catch {
      note +=
        `<span class="warn">Could not read <code>${probeUrl}</code>.</span> ` +
        `Put the pack's .glb files in <code>demo/public/animations/</code>.<br>`;
    }
  }

  // ---- 3. Animations ----
  let loaded: string[] = [];
  if (LIBRARY_URL) {
    try {
      loaded = await controller.loadLibrary(LIBRARY_URL, {
        ...(LIBRARY_ONLY.length ? { only: LIBRARY_ONLY } : {}),
        ...(Object.keys(RENAME).length ? { rename: RENAME } : {}),
      });
    } catch {
      /* reported below */
    }
  }

  if (loaded.length === 0) {
    setLog(
      note +
        `<span class="warn">No animations loaded.</span> Showing the bind pose.<br><br>` +
        `<b>To fix:</b> copy <code>Unreal-Godot/UAL2_Standard.glb</code> and ` +
        `<code>Female Mannequin/Unreal-Godot/Mannequin_F.glb</code> from the pack into ` +
        `<code>demo/public/animations/</code>, then reload.`,
    );
    rebuildButtons([]);
    return;
  }

  rebuildButtons(loaded);
  controller.play(loaded[0]!);
  highlight(loaded[0]!);
  setLog(note + `<b>Loaded ${loaded.length} clip(s).</b> Click a name to play it.`);
}

void boot();

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

// Expose for console poking.
(window as unknown as Record<string, unknown>).demo = {
  scene,
  character,
  controller,
  inspectGlb: (url: string) => inspectGlb(scene, url).then(console.log),
  detectScheme,
};

hud.classList.remove('hidden');
