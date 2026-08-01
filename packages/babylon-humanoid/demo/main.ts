/**
 * Aether Break — 3D character demo.
 *
 * Put your files in `demo/public/characters/` (see the README in that folder),
 * then run:
 *
 *     pnpm --filter @aether-break/babylon-humanoid demo
 *
 * The demo checks which files are present at startup and tells you on screen
 * exactly what's missing, so you never have to guess from a blank canvas.
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
import '@babylonjs/core/Rendering/depthRendererSceneComponent';
import '@babylonjs/loaders/glTF/2.0';

import {
  AETHER_CHARACTERS,
  createAetherRoster,
  createProceduralCharacter,
  inspectGlb,
  placeFighters,
  UNITY_SCHEME,
  type AetherFighter,
} from '../src/index';
import { HUMANOID_ORDER } from '../src/humanoidRig';

/* ------------------------------------------------------------------ */
/* Paths — everything lives under demo/public/characters/              */
/* ------------------------------------------------------------------ */

const BODIES_URL = '/characters/bodies/';
const HAIR_URL = '/characters/hair/';
const LIBRARY_URL = '/characters/animations/UAL2_Standard.glb';

/**
 * Files the demo needs. The pack ships .gltf, but .glb works identically, so
 * each entry is probed with both extensions and whichever exists is used.
 */
async function discoverGltfNames(base: string): Promise<string[]> {
  try {
    const res = await fetch(base, { method: 'GET' });
    if (!res.ok) return [];
    const html = await res.text();
    const names = [...html.matchAll(/href="([^"]+\.gltf)"/g)].map(m => m[1].replace(/\?.*$/, ''));
    return [...new Set(names)];
  } catch { return []; }
}

const BODY_FILES = {
  female: 'Superhero_Female_FullBody',
  male: 'Superhero_Male_FullBody',
} as const;

const HAIR_FILES = [
  'Hair_Long',
  'Hair_Beard',
  'Hair_Buns',
  'Hair_Buzzed',
  'Eyebrows_Female',
  'Eyebrows_Regular',
];

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { stencil: true, antialias: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.06, 0.1, 1);

const camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.15, 6, new Vector3(0, 1, 0), scene);
camera.attachControl(canvas, true);
camera.wheelDeltaPercentage = 0.02;
camera.lowerRadiusLimit = 1.5;
camera.upperRadiusLimit = 20;

const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
hemi.intensity = 0.8;
hemi.groundColor = new Color3(0.16, 0.17, 0.24);

const key = new DirectionalLight('key', new Vector3(-0.5, -1, 0.6), scene);
key.position = new Vector3(4, 8, -5);
key.intensity = 1.1;

const ground = CreateGround('ground', { width: 30, height: 30 }, scene);
const grid = new GridMaterial('grid', scene);
grid.majorUnitFrequency = 5;
grid.gridRatio = 0.5;
grid.mainColor = new Color3(0.07, 0.08, 0.12);
grid.lineColor = new Color3(0.22, 0.3, 0.45);
grid.opacity = 0.96;
ground.material = grid;

const hud = document.getElementById('hud')!;
const buttonBar = document.getElementById('buttons')!;
const log = document.getElementById('log')!;
const setLog = (html: string) => {
  log.innerHTML = html;
};

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */

/**
 * Check an asset really exists.
 *
 * A plain `res.ok` is not enough: Vite's dev server answers `200 text/html`
 * (the SPA index) for any path it can't find, so a missing .gltf would look
 * present and then blow up later with an opaque parse error. Rejecting HTML
 * responses is what makes the "missing files" message trustworthy.
 */
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    return !type.includes('text/html');
  } catch {
    return false;
  }
}

function missingFilesHelp(missing: string[]): string {
  return (
    `<span class="warn">Missing ${missing.length} required file(s):</span><br>` +
    missing.map((m) => `&nbsp;&nbsp;• <code>${m}</code>`).join('<br>') +
    `<br><br><b>Copy them from the extracted pack into</b><br>` +
    `<code>demo/public/characters/</code> — see the README in that folder.<br><br>` +
    `<b>Remember:</b> every <code>.gltf</code> needs its <code>.bin</code> ` +
    `and textures in the same folder.`
  );
}

let fighters: AetherFighter[] = [];

/** Return the first extension that actually exists, or null. */
async function findAsset(base: string, name: string): Promise<string | null> {
  for (const ext of ['.gltf', '.glb']) {
    if (await exists(`${base}${name}${ext}`)) return `${name}${ext}`;
  }
  return null;
}

async function boot(): Promise<void> {
  setLog('Checking assets…');

  let discovered = await discoverGltfNames(BODIES_URL);
  let femaleName = BODY_FILES.female;
  let maleName = BODY_FILES.male;
  if (discovered.length > 0) {
    femaleName = discovered[0].replace('.gltf','');
    maleName = discovered.length > 1 ? discovered[1].replace('.gltf','') : femaleName;
  } else {
    // Fallback: try common custom character names + original Quaternius names
    const candidates = ['Cleric', 'Monk', 'Ranger', 'Rogue', 'Warrior', 'Wizard', 'Superhero_Female_FullBody', 'Superhero_Male_FullBody'];
    for (const c of candidates) {
      if (await exists(`${BODIES_URL}${c}.gltf`) || await exists(`${BODIES_URL}${c}.glb`)) {
        femaleName = c;
        maleName = c;
        break;
      }
    }
  }
  const female = await findAsset(BODIES_URL, femaleName);
  const male = await findAsset(BODIES_URL, maleName);
  const libraryOk = await exists(LIBRARY_URL);

  const missing: string[] = [];
  if (!female) missing.push(`${BODIES_URL}${femaleName}.gltf`);
  if (!male) missing.push(`${BODIES_URL}${maleName}.gltf`);
  if (!libraryOk) missing.push(LIBRARY_URL);

  if (missing.length > 0 || !female || !male) {
    // Nothing to load — show the procedural stand-in so the scene isn't empty.
    createProceduralCharacter(scene, { scheme: UNITY_SCHEME, name: 'placeholder' });
    setLog(missingFilesHelp(missing));
    return;
  }

  let hairAvailable = true;
  for (const h of HAIR_FILES) {
    if (!(await findAsset(HAIR_URL, h))) {
      hairAvailable = false;
      break;
    }
  }

  setLog('Loading characters…');

  // Report the rig so bone-naming surprises surface immediately.
  let rigNote = '';
  try {
    const info = await inspectGlb(scene, `${BODIES_URL}${female}`);
    rigNote =
      `<b>Rig:</b> ${info.detected.schemeName} — ` +
      `${info.detected.matched.length}/${HUMANOID_ORDER.length} slots, ` +
      `${info.boneNames.length} bones<br>`;
    if (info.detected.missing.length) {
      rigNote += `<span class="warn">Unmapped: ${info.detected.missing.join(', ')}</span><br>`;
    }
  } catch {
    /* non-fatal */
  }

  const roster = await createAetherRoster(scene, {
    bodiesUrl: BODIES_URL,
    hairUrl: HAIR_URL,
    libraryUrl: LIBRARY_URL,
    bodyFiles: { female, male },
    skipHair: !hairAvailable,
  });

  const ids = Object.keys(AETHER_CHARACTERS);
  fighters = [];
  for (let i = 0; i < ids.length; i++) {
    const fighter = await roster.spawn(ids[i]!);
    fighter.root.position.x = (i - (ids.length - 1) / 2) * 1.6;
    fighter.setFacing(1);
    fighter.playKey('idle');
    fighters.push(fighter);
  }

  buildControls();
  setLog(
    rigNote +
      `<b>${fighters.length} fighters</b> from 2 base bodies.` +
      (hairAvailable ? '' : `<br><span class="warn">Hair files not found — bodies only.</span>`) +
      `<br>Click an animation to play it on everyone.`,
  );
}

/** Animation buttons + a versus-stance toggle. */
function buildControls(): void {
  buttonBar.replaceChildren();

  const keys = ['idle', 'walk', 'light', 'heavy', 'dash', 'guard', 'hitstun', 'ultimate'] as const;
  for (const k of keys) {
    const b = document.createElement('button');
    b.textContent = k.toUpperCase();
    b.onclick = () => {
      for (const f of fighters) f.playKey(k);
      for (const other of buttonBar.querySelectorAll('button')) {
        other.classList.toggle('active', other === b);
      }
    };
    buttonBar.appendChild(b);
  }

  const vs = document.createElement('button');
  vs.textContent = 'VS STANCE';
  vs.className = 'ghost';
  vs.onclick = () => {
    if (fighters.length < 2) return;
    // Show the first two as an actual matchup, hide the rest.
    placeFighters(fighters[0]!, fighters[1]!, 6.8);
    fighters.slice(2).forEach((f, i) => {
      f.root.position.set((i - 0.5) * 1.6, 0, 4);
    });
    camera.setTarget(new Vector3(0, 1, 0));
    camera.radius = 9;
  };
  buttonBar.appendChild(vs);

  const lineUp = document.createElement('button');
  lineUp.textContent = 'LINE-UP';
  lineUp.className = 'ghost';
  lineUp.onclick = () => {
    fighters.forEach((f, i) => {
      f.root.position.set((i - (fighters.length - 1) / 2) * 1.6, 0, 0);
      f.setFacing(1);
    });
    camera.setTarget(new Vector3(0, 1, 0));
    camera.radius = 6;
  };
  buttonBar.appendChild(lineUp);
}

void boot().catch((err) => {
  console.error(err);
  setLog(
    `<span class="warn">Startup failed.</span><br><code>${String(err)}</code><br><br>` +
      `Check the browser console, and confirm each <code>.gltf</code> sits ` +
      `next to its <code>.bin</code>.`,
  );
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

// Console helpers.
(window as unknown as Record<string, unknown>).demo = {
  scene,
  get fighters() {
    return fighters;
  },
  inspect: (url: string) => inspectGlb(scene, url).then(console.log),
  AETHER_CHARACTERS,
};

hud.classList.remove('hidden');
