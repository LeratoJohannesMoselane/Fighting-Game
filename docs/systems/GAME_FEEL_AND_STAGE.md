# Game feel, framing & the living stage (v0.2)

Covers the v0.2 pass: movement pacing, on-screen character size, the dynamic
camera, the animated background, and the arena critter system.

---

## 1. Movement pacing — "characters move way too fast"

### Diagnosis

The problem was **not** a single speed value; it was that the whole movement
scale was set relative to nothing. Concretely:

| Quantity          | Before          | Real-world meaning                        |
| ----------------- | --------------- | ----------------------------------------- |
| Walk speed        | `320 fp/tick`   | **19.2 wu/s** → crossed the 19 wu arena in **~1 s** |
| Jump velocity     | `820 fp/tick`   | 8 wu apex — five body-heights straight up |
| Dash speed        | `820 fp/tick`   | ~10 wu in 12 frames — a teleport          |
| Knockback         | up to `420`     | Persisted with **no friction** → ice slide |
| `forwardImpulse`  | up to `500`     | Applied once, then **glided for the whole move** |

A fighter body is `1.2 wu` wide and `1.6 wu` tall, so the old walk speed moved
a character **16 body-widths per second**.

### The fix

Everything is now derived from the body, which is the only scale a player can
actually perceive:

| Quantity     | Value             | Result                              |
| ------------ | ----------------- | ----------------------------------- |
| Walk         | `70 fp/tick`      | **4.0 wu/s** ≈ 3.3 body-widths/s    |
| Arena cross  | —                 | **~4.7 s** wall to wall             |
| Jump         | `240 fp/tick`, gravity `11` | **2.7 wu apex, 43 frames airtime** |
| Dash         | `190 fp/tick`     | **2.3 wu** ≈ 2 body-widths          |
| Round start  | `ROUND_START_X = 3400` | 6.8 wu apart — just outside poke range |

Two new frictions stop the sliding:

- **`ATTACK_FRICTION`** — a lunge decays instead of gliding for the whole move.
- **Hitstun ground friction** — knockback pushes you back a step, then stops.

These are locked in by `movement.test.ts` → `describe('movement pacing')`, which
asserts *rates* (wu/second, body-widths, airtime in frames) rather than raw
constants. A future re-tune has to consciously agree the game still feels right.

---

## 2. Character size — "can barely see them"

Two independent causes, both fixed:

**a) The world scale was too small.** `PX_PER_WU` went `58 → 118`, so a
`1.6 wu` body is `189 px` instead of `93 px` on a 720 px stage.

**b) There was no camera at all.** The view was a fixed window, so any framing
was a compromise between "close enough to see" and "wide enough to contain".

### Measured result

| | Before | After |
| --- | --- | --- |
| Character height | 93 px (fixed) | **101–230 px** (median **156 px**) |
| Fraction of stage | 1/7.8 | **1/3.1 (close) → 1/7.2 (max separation)** |
| Fighter off-screen | possible | **0.00% of sampled frames** |

---

## 3. Dynamic camera (`apps/web/src/scenes/Camera.ts`)

Frames both fighters, zooms with their separation, eases with exponential
smoothing normalised to the frame delta (so it behaves the same at 30 or
144 fps).

**The one hard rule: a fighter must never leave the screen.** Smoothing lags
behind fast separation, so a target-space clamp is not enough — `enforceVisibility()`
clamps the *smoothed* result every frame, widening and recentring until both
bodies are inside the frame.

Two subtleties worth keeping:

- Positions passed in are **feet**, but framing must contain **bodies** —
  hence `bodyHeight` in the tuning. (A test caught a jumping fighter clipping
  the top of the frame because of exactly this.)
- Padding eases from `200 px` (close quarters) to `80 px` (far apart), so
  distant fighters don't shrink more than they have to.

Guaranteed by `camera.test.ts` (13 tests), including adversarial poses:
stacked fighters, both pinned to one wall, and separation outrunning the camera.

---

## 4. Living background (`scenes/background/AnimatedBackground.ts`)

Layered back-to-front, each parallaxing at its own depth against the camera:

| Layer | Depth | Contents |
| --- | --- | --- |
| Sky | — | Gradient with a slow day-cycle tint |
| Celestial | 0.02 | Sun/moon with a breathing glow |
| Clouds | 0.06 | Drifting, wrapping |
| Ridges | 0.12 | Mountains (snow-capped in snow) |
| Skyline | 0.26 | Towers with flickering windows |
| Birds | 0.34 | Flapping silhouettes |
| Fog | 0.40 | Drifting banks (fog weather) |
| Motes | 0.60 | Embers / dust / magic |
| Butterflies | 0.72 | Foreground fliers |
| Weather | 0.80 | Rain streaks or snow |

**Weather:** `clear · rain · snow · embers · fog`, rolled per match seed so a
long set never looks the same twice. Rain adds lightning flashes.

**Performance:** every particle budget scales with the graphics density
setting; `LIVING BACKGROUND` in Options turns the whole layer off and falls
back to the original static painting.

**Accessibility:** reduce-flashes slows drift to 35% and disables lightning.

---

## 5. Arena critters

### Where the system lives — and why

Critters run **inside CombatCore**, not the renderer. They damage fighters, so
they are gameplay; if they lived in the presentation layer they could desync
two clients and would break the replay/determinism contract (ADR-0002).

That means they obey the same rules as everything else in the core:

- Every random choice draws from the state's **Park–Miller LCG** — never
  `Math.random` (the purity test would reject it).
- All positions are **fixed-point integers**.
- Full state is **canonically serialised**, so replays and state hashes work.

The system is **opt-in** (`createInitialState({ critters: true })`). With it
off, `state.critters` stays empty and a match hashes exactly as before — the
10,000-frame determinism gate is untouched.

### Archetypes

| Critter | Behaviour | HP | Dmg | Reach | Notes |
| --- | --- | --- | --- | --- | --- |
| **Shadow Wolf** | `stalk` | 300 | 25 | 1100 | Holds at the edge of range, then dives; flees at 25% |
| **Crystal Scarab** | `skitter` | 150 | 15 | 700 | Fast, erratic bursts |
| **Storm Spirit** | `drift` | 400 | 35 | 1900 | Hovers and strikes from a distance |
| **Void Creep** | `chase` | 200 | 20 | 900 | Beelines; flees at 35% |

### Combat rules

- **Telegraph:** every strike has a 22-frame windup with a `!` marker — a
  critter can always be reacted to and punished.
- **Guarding** toward a critter cuts damage to a quarter and avoids the stun;
  getting caught from behind does not.
- **Fighters damage critters** at 70% of move damage; critters get 14 i-frames
  after a hit, so one active window lands once rather than shredding them.
- **Bounty:** the killing blow grants flux + stamina, making a detour worthwhile.
- Wildlife **scatters** during intros, KOs and results, and never spawns on
  top of a fighter (it always enters from the far wall).

Covered by `critters.test.ts` (18 tests) including seed-identical runs,
seed divergence, and a mid-hunt serialise → deserialise → lockstep round-trip.

---

## 6. Test coverage added

| Suite | Tests | Defends |
| --- | --- | --- |
| `movement.test.ts` (pacing) | 9 | Walk/jump/dash rates, no ice-sliding |
| `critters.test.ts` | 18 | Spawning, AI, both-way combat, determinism |
| `camera.test.ts` | 13 | Character size + the never-off-screen rule |
| `background.test.ts` | 12 | All weather modes, NaN-free, density/motion switches |
| `critterRenderer.test.ts` | 8 | Every archetype × state × facing |

**160 tests total** (127 core + 33 web), plus the determinism gate.
