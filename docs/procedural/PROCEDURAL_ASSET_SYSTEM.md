# Procedural Asset System

**Status:** Live in `apps/web` greybox  
**Goal:** Full readable combat (poses, VFX, SFX) with **zero external art/audio files**, while keeping a clean swap path for final glTF / Babylon / authored audio.

## Why this exists

CombatCore is data-driven and deterministic. Presentation must:

1. Show **startup / active / recovery** poses locked to JSON frame data  
2. Show **unique fighter silhouettes** without meshes on disk  
3. Emit **VFX + SFX** on combat events  
4. Allow artists to replace visuals **without rewriting combat**

## Package layout

```
apps/web/src/procedural/
  types.ts       # Bone IDs, poses, attach points, VFX/SFX contracts
  profiles.ts    # Per-fighter silhouette + colors + parts (JSON-adjacent)
  animation.ts   # Pose generation from phase + MoveData frames
  mesh.ts        # Bone hierarchy + primitive draw (Canvas today)
  vfx.ts         # Pooled procedural particles (no textures)
  audio.ts       # Web Audio synthesis (no sound files)
  system.ts      # Integrator: events → VFX/SFX, state → draw
  index.ts       # Public exports + replacement notes
```

## Deliverable map

| Deliverable | Module | Notes |
|-------------|--------|--------|
| 1. Procedural character mesh | `mesh.ts` + `profiles.ts` | Unique silhouettes: Nyra slim+cape+pistols, Bram stocky+gauntlet, Iria tall+staff+cards |
| 2. Animation without art | `animation.ts` | Idle/walk/jump/dash/guard/hit + attack windup/strike/recover from `MoveData` |
| 3. Procedural VFX | `vfx.ts` | Sparks, rings, diamonds, trails, afterimages, ult aura |
| 4. Procedural audio | `audio.ts` | Whoosh/thud/noise/tones via oscillators |
| 5. Integration | `system.ts` + `render.ts` + `main.ts` | Event bus from CombatCore → presentation |

## Bone contract (keep forever)

```
root → spine → neck → head
           ├─ l_arm → l_forearm → weapon_l
           ├─ r_arm → r_forearm → weapon
           └─ cape
     → l_leg, r_leg
```

**Attach points:** `r_hand`, `l_hand`, `weapon_tip`, `weapon_l_tip`, `chest`, `feet`

Final glTF skins should expose the same bone names (or a remap table).

## Animation ↔ frame data

For an attacking fighter with `move.localFrame = lf`:

| Window | Condition | Visual |
|--------|-----------|--------|
| Startup | `lf < active[0]` | Blend idle → windup |
| Active | `active[0] ≤ lf ≤ active[1]` | Strike pose + weapon glow + VFX flash on first active frame |
| Recovery | `lf > active[1]` | Blend strike → recover → idle |

Move archetypes:

- **LIGHT** — snappy arm extension  
- **HEAVY** — deep windup, torso rotation, big strike  
- **RANGED** — weapon raise + muzzle VFX on projectile spawn event  
- **SPELL** — dual-arm cast + diamond burst  
- **ULTIMATE** — hold / expand / detonate (extra hitstop already in core)

## Event wiring

| CombatCore event | Presentation |
|------------------|--------------|
| `attack_started` | Attack SFX |
| `projectile_spawned` | Muzzle VFX + ranged SFX |
| `hit` | Hit sparks (light/heavy/ult) + hit SFX + camera shake (main) |
| `blocked` | Blue ring + block thud |
| `whiff` | Soft whoosh |
| `ultimate_activated` | Ult aura + layered synth |
| `ultimate_ready` | Gold pulse + chime |
| `resource_denied` | Deny beep |

## Replacing with final art

1. **Mesh:** Implement `ProceduralFighterMesh.draw` equivalent that skins a glTF; keep `update(fighter, tick)` pose API or feed Babylon `AnimationGroup` from the same phase machine.  
2. **Animation:** Author clips named per `animations` map in fighter JSON; fire them on `attack_started` / phase change; use JSON frames only for hitbox timing (already in core).  
3. **VFX:** Map `VfxRequest.kind` to GPU particle presets / mesh FX.  
4. **Audio:** Map `SfxKind` to loaded buffers; keep the same `play(id)` calls.  
5. **Do not** put art paths inside `packages/combat-core`.

## Performance

- VFX pool cap 400 particles  
- No texture downloads  
- Pose solve is O(bones) per fighter per frame  
- Audio nodes are short-lived and GC’d by the browser  

## How to verify in-game

```bash
pnpm dev
```

1. Pick fighters → FIGHT  
2. Press light/heavy — see arm windup and strike flash on active frames  
3. Press gun — muzzle + projectile trail  
4. Fill Awakening with melee → `Q` ult — big aura + layered SFX  
5. Toggle `B` hitboxes — hurt/hit overlays still work  
