# Using the mannequin + UAL2 clips in your game

You've got `Mannequin_F.glb` loading with **65 bones, 22/22 humanoid slots
mapped**, rig naming **unreal**, and **43 clips** in `UAL2_Standard.glb`.
That's everything working. Here's how to drive actual fighters with it.

---

## All four fighters, one model file

Every Aether Break character uses `Mannequin_F.glb`. `createRoster()` wraps the
factory and applies per-character identity for you:

```ts
import { createRoster, resolveClip } from '@aether-break/babylon-humanoid';

const roster = await createRoster(scene, {
  modelUrl:   '/characters/bodies/Mannequin_F.glb',
  libraryUrl: '/characters/animations/UAL2_Standard.glb',
});

const p1 = roster.spawn('nyra_vex', 'p1');   // cyan, slim, throws
const p2 = roster.spawn('bram_kade', 'p2');  // orange, bulky, punches
p1.setFacing(1);
p2.setFacing(-1);

// each frame
scene.onBeforeRenderObservable.add(() => {
  for (const [rig, f] of [[p1, state.fighters[0]], [p2, state.fighters[1]]] as const) {
    rig.root.position.set(f.x / 1000, f.y / 1000, 0);
    rig.setFacing(f.facing);
    rig.playKey(resolveClip(f));   // note: playKey, not play
  }
});
```

Mirror matches work — `roster.spawn('nyra_vex')` twice gives two independent
fighters.

### How they're told apart

One puppet, three levers — measured from a real run:

| | Nyra | Bram | Iria | Kellan |
| --- | --- | --- | --- | --- |
| **Tint** | `#00BCD4` cyan | `#E65100` orange | `#E040FB` violet | `#00E5FF` electric |
| **Build** (x-scale) | 0.92 | 1.30 | 0.86 | 0.98 |
| **Idle** | `IDLE_NO_LOOP` | `IDLE_FOLDARMS_LOOP` | `IDLE_LANTERN_LOOP` | `IDLE_FOLDARMS_LOOP` |
| **Light** | `SWORD_REGULAR_A` | `MELEE_HOOK` | `SWORD_REGULAR_A` | `SWORD_REGULAR_A` |

**Motion is what really sells it.** Bram punching (`MELEE_HOOK`) while Nyra
slashes reads as two different fighters far more than colour does. Tune it:

```ts
import { AETHER_STYLES } from '@aether-break/babylon-humanoid';

AETHER_STYLES.bram_kade.widthScale = 1.3;
AETHER_STYLES.iria_sol.clipMap.idle = 'IDLE_TALKINGPHONE_LOOP';
```

### The trap this avoids

Babylon's `instantiateModelsToScene(name, false)` shares **one material** across
every instance — tint Nyra and Bram turns cyan too. `createRoster` clones
materials per fighter. There are three tests pinning this, including one that
documents the coupled behaviour so a future "optimisation" can't silently
reintroduce it.

### Cost

One `AssetContainer`, N instances: geometry and textures are shared on the GPU;
only materials and skeletons are per-fighter. Clips are the union of every
character's map (20 of the 43), retargeted once at spawn.

---

## The one-screen version (single character)

### Lower-level API

```ts
import {
  createFighterFactory,
  DEFAULT_CLIP_MAP,
  clipsUsedBy,
  renameFromClipMap,
  aliasesFor,
  resolveClip,
} from '@aether-break/babylon-humanoid';

// 1. Load the model + library ONCE.
const factory = await createFighterFactory(scene, {
  modelUrl:   '/characters/bodies/Mannequin_F.glb',
  libraryUrl: '/characters/animations/UAL2_Standard.glb',
  only:    clipsUsedBy(DEFAULT_CLIP_MAP),      // only the ~15 clips we need
  rename:  renameFromClipMap(DEFAULT_CLIP_MAP), // SWORD_REGULAR_A → 'light'
  aliases: aliasesFor(DEFAULT_CLIP_MAP),        // keys sharing one clip
  inPlace: true,                                // we position fighters ourselves
});

// 2. Spawn two INDEPENDENT fighters from that one model.
const p1 = factory.spawn('p1');
const p2 = factory.spawn('p2');
p1.setFacing(1);
p2.setFacing(-1);

// 3. Each frame, push CombatCore state at them.
scene.onBeforeRenderObservable.add(() => {
  for (const [rig, fighter] of [[p1, state.fighters[0]], [p2, state.fighters[1]]] as const) {
    rig.root.position.set(fighter.x / 1000, fighter.y / 1000, 0); // fp → world units
    rig.setFacing(fighter.facing);
    rig.play(resolveClip(fighter));    // 'idle' | 'walk' | 'light' | …
  }
});
```

That's the whole integration. The rest of this doc explains the pieces.

---

## Why a factory instead of loading twice

Two fighters need **two skeletons** — if they share one, both puppets perform
the same animation. `createFighterFactory` loads the `.glb` once into an
`AssetContainer` and calls `instantiateModelsToScene()` per fighter, which
clones the skeleton while sharing geometry and textures on the GPU.

There's a test for exactly this (`animates two fighters INDEPENDENTLY`): it
plays a clip on P1 and asserts P2's spine doesn't move by even 0.0001.

---

## Your 43 clips → gameplay states

`DEFAULT_CLIP_MAP` picks a sword-fighter set from the clips you actually have:

| Gameplay key | UAL2 clip | When it plays |
| --- | --- | --- |
| `idle` | `IDLE_SHIELD_LOOP` | neutral (combat stance, not a casual idle) |
| `walk` | `WALK_CARRY_LOOP` | phase `walk` |
| `crouch` | `SLIDE_LOOP` | phase `crouch` |
| `jump` | `NINJAJUMP_START` | phase `jump` |
| `airborne` | `NINJAJUMP_IDLE_LOOP` | falling |
| `land` | `NINJAJUMP_LAND` | on touchdown |
| `dash` | `SWORD_DASH` | phase `dash` |
| `guard` | `SWORD_BLOCK` | guarding / blockstun |
| `hitstun` | `HIT_KNOCKBACK` | taking a hit |
| `knockdown` | `LAYTOIDLE` | knocked down |
| `light` | `SWORD_REGULAR_A` | `*_light` moves |
| `heavy` | `SWORD_HEAVY_COMBO` | `*_heavy` moves |
| `ranged` | `OVERHANDTHROW` | guns, bombs, snakes |
| `spell` | `SHIELD_ONESHOT` | spells |
| `ultimate` | `SWORD_REGULAR_COMBO` | supers |

Two alternates ship with it, so your roster doesn't all move identically:

```ts
import { BRAWLER_CLIP_MAP, ZOMBIE_CLIP_MAP } from '@aether-break/babylon-humanoid';
```

- **`BRAWLER_CLIP_MAP`** — `IDLE_FOLDARMS_LOOP`, `MELEE_HOOK` punches. Good for Bram.
- **`ZOMBIE_CLIP_MAP`** — `ZOMBIE_IDLE_LOOP`, `ZOMBIE_WALK_FWD_LOOP`, `ZOMBIE_SCRATCH`.

Per-character maps are just object spreads:

```ts
const NYRA_MAP = { ...DEFAULT_CLIP_MAP, idle: 'IDLE_NO_LOOP', ranged: 'OVERHANDTHROW' };
const BRAM_MAP = { ...BRAWLER_CLIP_MAP, heavy: 'SWORD_HEAVY_COMBO' };
```

Every clip name in all three maps is asserted against the real `UAL2_CLIPS`
list in tests, so a typo fails CI rather than silently not playing.

---

## `resolveClip()` — state → animation

Takes anything shaped like a CombatCore `FighterState` and returns a key:

```ts
resolveClip({ phase: 'attack', moveId: 'nyra_light' })         // 'light'
resolveClip({ phase: 'attack', moveId: 'bram_last_foundry' })  // 'ultimate'
resolveClip({ phase: 'neutral', guarding: true })              // 'guard'
resolveClip({ phase: 'hitstun' })                              // 'hitstun'
```

Priority is reaction → attack → locomotion, because being hit mid-walk should
read as *hit*. Attack flavour is inferred from the move id (`light`, `heavy`,
`gun`/`bolt`/`bomb`/`snake` → ranged, `spell` → spell, and the bespoke super ids
`event_horizon` / `last_foundry` / `sevenfold` / `tempest` → ultimate).

Not what you want? It's a pure function — write your own and call
`rig.play(myResolver(fighter))`.

---

## Wiring it to Aether Break specifically

Your game currently renders 2D canvas. Two honest options:

### Option A — a parallel Babylon view (lower risk)

Keep `CombatCore` exactly as-is and add a Babylon canvas that reads the same
state. CombatCore is pure and already the single source of truth, so nothing
in `packages/combat-core` changes:

```ts
// apps/web/src/render3d.ts
export class BabylonArenaRenderer {
  private p1!: FighterRig;
  private p2!: FighterRig;

  async init(canvas: HTMLCanvasElement) {
    const engine = new Engine(canvas, true);
    this.scene = new Scene(engine);
    // …camera, lights…
    this.factory = await createFighterFactory(this.scene, { /* as above */ });
    this.p1 = this.factory.spawn('p1');
    this.p2 = this.factory.spawn('p2');
    engine.runRenderLoop(() => this.scene.render());
  }

  // Same contract the 2D renderer already exposes.
  draw(state: GameState) {
    this.sync(this.p1, state.fighters[0]);
    this.sync(this.p2, state.fighters[1]);
  }

  private sync(rig: FighterRig, f: FighterState) {
    rig.root.position.set(f.x / 1000, f.y / 1000, 0);   // FP_SCALE = 1000
    rig.setFacing(f.facing);
    rig.play(resolveClip(f));
  }
}
```

`main.ts` already calls `renderer.draw(state, opts)` once per frame, so you
swap which renderer it holds and the game loop is untouched.

### Option B — replace the 2D renderer outright

More work, and I'd do Option A first to confirm the look before committing.

**Coordinate conversion:** CombatCore positions are fixed-point with
`FP_SCALE = 1000`, so `x / 1000` gives world units, and the arena spans
`±9.5` units. That maps 1:1 onto Babylon world space with no extra scaling.

---

## Root motion

Your pack has both:

- **`UAL2_Standard.glb`** — in place. Your code owns position. **Use this**,
  since CombatCore already decides where fighters are.
- **`UAL2_Standard_RM.glb`** — the animation moves the character. It would
  fight your simulation.

If you load the RM file anyway, `inPlace: true` strips the hips position track.

---

## Performance

- **One `AssetContainer`, N instances** — geometry and textures are shared.
- **`only:` matters.** Retargeting all 43 clips × 2 fighters is 86 clip clones;
  `clipsUsedBy(DEFAULT_CLIP_MAP)` cuts that to ~15 × 2.
- **`aliases`** stops the same clip being retargeted twice when two keys share it.
- Clips are retargeted once at spawn, not per frame. Per-frame cost is just
  `rig.play()`, which early-outs when the key hasn't changed.

---

## Gotchas

| Symptom | Cause |
| --- | --- |
| Both fighters do the same thing | Sharing one skeleton — use `factory.spawn()` per fighter, don't reuse a rig |
| Fighter drifts away from its hitbox | Root-motion clip; use `UAL2_Standard.glb` or `inPlace: true` |
| Character faces the camera | Adjust `setFacing` — the mannequin's forward axis may differ from your stage's |
| Clip doesn't play, warning in console | Name mismatch; the warning lists the keys that do exist |
| Attack animation gets cut off | Attack clips aren't looped; a 30-frame clip under a 12-frame move will be interrupted — that's correct, but you may want shorter clips for fast moves |

---

## Timing: animations vs frame data

The clips were **not** authored to your move timings. `SWORD_REGULAR_A` might
run 40 frames while `nyra_light` is 26 total. Options, cheapest first:

1. **Accept it** — the clip gets cut off at the next state change. Fine for a greybox.
2. **Scale playback speed** — `group.speedRatio = clipFrames / moveFrames`.
3. **Retime the move data** to match the animation.

There's no automatic solution here; it's a design call about whether animation
serves frame data or the reverse. For a fighting game, frame data wins — so
option 2 or 3.
