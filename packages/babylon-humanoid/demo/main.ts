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
  inspectGlb,
  UNITY_SCHEME,
  detectScheme,
  type ClipSpec,
  type NamingScheme,
} from '../src/index';
import { HUMANOID_ORDER, KNOWN_SCHEMES } from '../src/humanoidRig';

/**
 * EDIT ME
 *
 * The pack ships in two possible layouts, and the demo supports both:
 *
 *  A) ONE COMBINED LIBRARY (what the Godot export gives you)
 *     demo/public/animations/AnimationLibrary_Godot_Standard.glb
 *     → every clip lives inside that single file, already named.
 *     Set LIBRARY_URL and leave CLIPS empty.
 *
 *  B) ONE FILE PER CLIP (if you exported them individually)
 *     demo/public/animations/IDLE_NO.glb, WALK_CARRY.glb, ...
 *     → list them in CLIPS and leave LIBRARY_URL null.
 *
 * The demo tries the library first, then falls back to the individual files.
 */
const LIBRARY_URL: string | null = '/animations/AnimationLibrary_Godot_Standard.glb';

/** Only load these from the library (it may hold 130+). Empty = load all. */
const LIBRARY_ONLY: string[] = [];

const CLIPS: ClipSpec[] = [
  { key: 'idle', url: '/animations/IDLE_NO.glb', loop: true },
  { key: 'walk', url: '/animations/WALK_CARRY.glb', loop: true, inPlace: true },
  { key: 'sword', url: '/animations/SWORD_REGULAR_A.glb', loop: false },
];

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
let scheme: NamingScheme = UNITY_SCHEME;
let character = createProceduralCharacter(scene, { scheme, name: 'hero' });
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
    viewer = new SkeletonViewer(character.skeleton, character.mesh, scene, false, 3, {
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
  setLog('Loading animations…');

  // Inspect the first clip so we can report the real bone names. This is the
  // step that removes all guesswork about which naming scheme the pack uses.
  let detectedNote = '';
  const probeUrl = LIBRARY_URL ?? CLIPS[0]?.url;
  if (probeUrl) {
    try {
      const info = await inspectGlb(scene, probeUrl);
      const det = info.detected;
      detectedNote =
        `<b>Detected rig:</b> ${det.schemeName} — matched ${det.matched.length}/${HUMANOID_ORDER.length} slots<br>` +
        `<b>Bones in file (${info.boneNames.length}):</b> <code>${info.boneNames.slice(0, 10).join(', ')}${info.boneNames.length > 10 ? ', …' : ''}</code><br>`;
      if (det.missing.length) {
        detectedNote += `<span class="warn">Unmapped slots: ${det.missing.join(', ')}</span><br>`;
      }

      // If the file matches a known scheme better than our default, rebuild
      // the character with those exact names for a 1:1 match.
      const better = KNOWN_SCHEMES.find((s) => s.name === det.schemeName);
      if (better && det.schemeName !== 'unity' && det.matched.length >= 15) {
        controller.dispose();
        character.dispose();
        scheme = better.scheme;
        character = createProceduralCharacter(scene, { scheme, name: 'hero' });
        controller = new CharacterController(scene, character);
        detectedNote += `<b>Rebuilt rig using the <code>${det.schemeName}</code> naming scheme.</b><br>`;
      }
    } catch {
      detectedNote =
        `<span class="warn">Could not read <code>${probeUrl}</code>.</span><br>` +
        `Put the pack's .glb files in <code>demo/public/animations/</code>.<br>`;
    }
  }

  // Layout A: one combined library file.
  let loaded: string[] = [];
  let failed: string[] = [];

  if (LIBRARY_URL) {
    try {
      loaded = await controller.loadLibrary(LIBRARY_URL, {
        ...(LIBRARY_ONLY.length ? { only: LIBRARY_ONLY } : {}),
      });
      if (loaded.length) {
        detectedNote += `<b>Loaded ${loaded.length} clip(s) from the combined library.</b><br>`;
      }
    } catch {
      /* fall through to per-file loading */
    }
  }

  // Layout B: individual per-clip files.
  if (loaded.length === 0) {
    const r = await controller.loadAll(CLIPS);
    loaded = r.loaded;
    failed = r.failed;
  }

  if (loaded.length === 0) {
    setLog(
      detectedNote +
        `<span class="warn">No animations loaded.</span> The character is shown in its ` +
        `T-pose bind pose.<br><br>` +
        `<b>To fix:</b> download <i>Universal Animation Library 2 [Standard]</i>, ` +
        `copy the <code>/GLB/</code> files into <code>demo/public/animations/</code>, ` +
        `then reload.`,
    );
    rebuildButtons([]);
    return;
  }

  rebuildButtons(loaded);
  controller.play(loaded[0]!);
  highlight(loaded[0]!);

  setLog(
    detectedNote +
      `<b>Loaded:</b> ${loaded.join(', ')}` +
      (failed.length ? `<br><span class="warn">Failed: ${failed.join(', ')}</span>` : ''),
  );
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
