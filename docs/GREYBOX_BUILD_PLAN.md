# Aether Break — Greybox Vertical Slice Build Plan & Prompt Series

**Milestone 1 (SRS §9.1):** *Two greybox fighters, one lane, local 1v1 duel, 60 Hz CombatCore, 60 FPS target, hit feel review. No online promise until fun is proven.*

This document is the project manager's playbook. It contains:

1. An SRS reading of what Milestone 1 actually requires (what is core, what is explicitly deferred).
2. The full prompt series (Prompts 1–9) to build the greybox slice step-by-step.
3. The complete copy-paste text of **Prompt 1** (foundation + CombatCore).
4. A high-level roadmap of prompt packs for Milestones 2–5.

---

## 0. Working rules (apply to every prompt)

- **CombatCore hard boundary (§5.3, §6.1):** `packages/combat-core` imports only deterministic utilities and content data. No Babylon, React, Web Audio, `Date`, `Math.random`, `fetch`, `WebSocket`, `performance`, or browser globals — ever. Enforced by lint config *and* a unit test.
- **Effects are cosmetic (§2.3):** hit-stop, sparks, shake, audio never alter the authoritative 60 Hz timeline.
- **Scope gate (§1 "Scope rule"):** every new character/arena/projectile/mode needs a performance budget, balance test plan, and owner before it enters a sprint.
- **Pin exact versions (§5.1):** lockfile at kickoff; no untested "latest" in production.
- **ADR for irreversible choices (NFR-011):** any structural decision gets a one-page ADR.
- **No online promise until fun is proven (§9.1, §9.4 GO/NO-GO):** rollback, match server, protocol — not in this milestone.
- The user's vertical-slice definition takes precedence over §9.1's "local/AI" wording: **local 1v1 is the requirement**; a minimal bot is an optional stretch, never a dependency.

---

## 1. SRS reading: what the greybox slice must prove

The slice exists to answer one question: **"Is the 1v1 loop fun, readable, and smooth?"** Everything in it is in service of that.

| SRS source | What it mandates for M1 |
|---|---|
| §9.1 M1 deliverable | Two greybox fighters, one lane, local duel, 60 Hz CombatCore, 60 FPS, hit-feel review |
| §9.2 "NOW" backlog | Movement, attack/block/dash, **one gun + one spell**, hit feedback; local versus; deterministic test harness; one target-browser performance profile |
| FR-010 (§3.2) | 60 Hz fixed-tick, serialisable state, seeded RNG, integer/fixed-point, authored move data; no clock/DOM/renderer/network reads; identical hash for same 10,000 input frames in Node + ≥2 browsers |
| FR-011 | Keyboard input, 6-frame input buffer, simultaneous-opposite-direction handling, focus-loss safety |
| FR-012 | Startup/active/recovery frames, hit/guard, combo scaling, projectiles, knockdown, round timer, win state — all from data-driven move definitions |
| FR-014 | Best-of-3 rounds, timeout rules, rematch, clean state reset (no stale HP/meter/input) |
| §2.1 | 90 s/round, 1,000 HP, Flux 0–100, 60 fixed ticks/s, integer/fixed-point core |
| §2.3 | Authored hitboxes/hurtboxes in core (never renderer raycasts/physics); hit-stop 4–10 f; directional hit sparks; camera shake; distinct impact audio |
| NFR-001/002, §4.1 | WebGL2 baseline; 60 FPS @1080p on a defined mid-range desktop; ≤8 ms render CPU / ≤8 ms GPU; quality fallback preserves sim rate |
| §8.1 | Vitest unit fixtures for every move (hit/block/whiff/cancel/boundary); cross-runtime hash suite; seeded property tests (no NaN, OOB, stuck round, negative resources) |
| §5.3 / §6.1 / §7.2 / App. A & B | Monorepo layout; CombatCore responsibilities; move-data schema (sample: `arc_light_1`, startup 6, active 6–8, recovery 12, dmg 42, hitStun 15, blockStun 9); input map; combat state machine |

**Scope decisions (deferred beyond M1, with citations):**

| Deferred | Why | When |
|---|---|---|
| Online / rollback / match server (§9.1) | Explicitly "no online promise until fun is proven" | Milestone 2 |
| Abilities & ultimates (§2.4 roster, FR-013) | Not in §9.2 NOW list; keep MoveData fields reserved | Milestone 2 content kits |
| Bots (FR-020) | Not required by the user's slice definition; optional stretch only | Milestone 2 |
| Throws, parry, sidestep/evade, guard crush (§2.1/§2.3) | Richness adds tuning surface; blockstun/chip alone prove counterplay | Milestone 2 (per-feature ADR) |
| Gamepad (FR-011), input remapping (FR-003), 3-difficulty bots | MUST for MVP, not for the slice | Milestone 2 |
| Final art, glTF pipeline, arena variants (§7.1) | Greybox only | Milestone 3 |

---

## 2. Core non-negotiable components (M1)

| # | Component | Why it is non-negotiable | SRS trace | Prompt |
|---|---|---|---|---|
| 1 | Monorepo scaffold + dev env (strict TS, pnpm workspaces, Vitest, lint/format gates, pinned versions) | Deterministic tests + shared CombatCore need package boundaries and reproducible tooling | §5.1, §5.3, NFR-011 | 1 |
| 2 | `packages/combat-core` — pure deterministic 60 Hz engine | The single most important decision in the project; everything (online, replays, balance) hangs off it | §5.3 hard boundary, §6.1, FR-010 | 1–3 |
| 3 | Determinism proof harness (Node + ≥2 browsers, identical hashes over 10,000 frames) | Gate for all future features; without it, rollback is impossible and balance tests are meaningless | FR-010 acceptance, §8.1, §9.4 | 2 |
| 4 | Data-driven move set for 2 greybox fighters (walk/jump/dash, light/heavy, block, 1 gun, 1 spell) + full combat state machine | The "fun" itself; moves are content, not code | §2.1, §2.2, §7.2, §9.2, App. B | 3 |
| 5 | Match flow: best-of-3, 90 s timer, timeout rules, round/match end, rematch with clean state | Core loop completeness; stale state is a release blocker | FR-014, §2.1 | 4 |
| 6 | Local 2P keyboard input adapter (6-frame buffer, SoD, focus-loss safety) | The duel is the product | FR-011, App. A | 5 |
| 7 | Greybox presentation: one lane, 2 primitive fighters, locked side-on camera, HUD (HP/flux/timer/round), 60 FPS loop with fixed-tick accumulator | Readability + 60 FPS are acceptance criteria, not polish | §2.1 camera, NFR-002, §4.1 | 6 |
| 8 | Presentation adapter + hit feel (hit-stop 4–10 f, directional sparks, hit flash, shake, impact audio; strictly non-authoritative) | "Hit feel review" is an M1 exit criterion | §2.3, §6.1 presentation adapter | 7 |
| 9 | Hit-feel review tooling + target performance profile (frame data overlay, hitbox toggle, FPS meter, replay of recorded inputs, review protocol) | M1 exits only after structured review and a verified 60 FPS profile | §1.4 success measures, §9.1, §4.1 | 8 |
| 10 | Exit-gate acceptance pass against the M1 deliverable + documented known limits | Prevents "one more character" creep before fun is proven | §9.1, §9.2, §9.4 | 9 |

---

## 3. Prompt series — Milestone 1 (greybox slice)

Each prompt is self-contained, has a clear deliverable, and passes a review checkpoint before the next starts. Prompts are ordered to keep CombatCore pure and testable before anything renders.

| # | Prompt | Focus | Exit check |
|---|---|---|---|
| 1 | **Foundation + CombatCore v0** (full text in §4) | Monorepo scaffold, dev env, pure deterministic combat-core package, starter move data, unit + determinism tests | `pnpm test`/`typecheck`/`lint` green; determinism script prints identical hash twice; zero forbidden APIs |
| 2 | **Determinism proof harness** | Cross-runtime hash equality: same seed + 10,000-frame scripted input → identical state hash in Node, Chrome, Firefox (CI job + browser test page); document any remaining float usage | FR-010 acceptance met; hashes equal across all three runtimes |
| 3 | **Full move set & state machine** | Complete App. B states (Walk/Jump/Dash/Guard/Attack/Hitstun/Blockstun/Knockdown/Airborne…), cancel routes, two-stage combo scaling + juggle budget + knockdown protection (no infinites), projectile movement/clash, blockstun/chip; every move has hit/block/whiff/cancel/boundary fixtures (§8.1) | Move fixture suite green; seeded fuzz run: no NaN, OOB, stuck round, negative resource |
| 4 | **Match flow & round logic** | Best-of-3, 90 s timer, timeout rules, RoundEnd → Result → Rematch/Menu transitions, clean-state reset; rematch test proves no stale HP/flux/input | FR-014 acceptance; full simulated match completes correctly in unit tests |
| 5 | **Input adapters (local 2P)** | Keyboard mapping per App. A + P2 mirror set (provisional, remapping later); 6-frame buffer + SoD resolution wired to core; focus-loss → auto-neutral; scripted input integration tests | FR-011 (keyboard subset) verified by automated input tests |
| 6 | **Web shell + greybox presentation** | Vite + React + Zustand shell (minimal menus: Title → Versus → Rematch), Babylon.js scene (WebGL2 baseline), locked side-on camera (never rotates), one-lane arena greybox, two primitive fighters with distinct silhouettes/colors, HUD, fixed-tick accumulator loop at 60 Hz with render interpolation, FPS meter, quality-fallback stub | Game renders; sim stays at 60 Hz independent of render frame rate; HUD live |
| 7 | **Presentation adapter + hit feel** | Event-driven adapter (never decides outcomes), hit-stop 4–10 f (render-side only, zero extra sim ticks), directional hit sparks, hit flash, camera shake, Web Audio impact/block SFX (synthesized, royalty-free), reduced-flash/reduced-motion stubs, §4.1 budget checks | Effects provably cosmetic (test: identical sim hash with effects on/off); 60 FPS on target machine |
| 8 | **Hit-feel review tooling + performance profile** | Dev overlay (frame data, event log, hitbox/hurtbox toggle), in-app replay of recorded input scripts, structured review protocol (≥12 testers, 15 min, rematch-rate ≥70% target per §1.4), target-machine profile + tuning pass | Review session run; top-3 feel issues fixed; median 60 FPS captured |
| 9 | **Slice exit gate** | Full acceptance pass vs §9.1 M1 + §9.2 NOW; determinism suite re-run (Node + browsers); rematch/restart verified by human testers; known-limits ADRs; go/no-go note per §9.4 | M1 exit checklist complete; decision recorded: proceed to online/content or fix core loop |

### Prompt 2 — Determinism proof harness (summary)
*"Extend the determinism harness from Prompt 1: create `packages/combat-core/scripts/replay.ts` that seeds a state, applies a deterministic 10,000-frame scripted input stream, and prints the final `getStateHash`. Create `apps/web/determinism/` test page that runs the identical scenario in-browser and displays the hash. Add a GitHub Actions job (or local script) that runs the scenario in Node and headless Chrome + Firefox and asserts all hashes equal. Document any remaining floating-point usage and its determinism rationale in ADR-0002. Acceptance: hashes match across all three runtimes for 3 different seeds; CI is green."*

### Prompt 3 — Full move set & state machine (summary)
*"Complete the CombatCore state machine per Appendix B and the §9.2 NOW move list: walk, jump, dash, light, heavy, block, one gun, one spell for Nyra Vex and Bram Kade (data-driven, §7.2 schema; use the SRS sample values as tuning baselines). Implement startup/active/recovery, cancel routes, hitbox×hurtbox overlap, two-stage combo scaling, juggle budget with protected knockdown (no infinites, §2.3), projectile travel + clash, blockstun/chip. Leave ability/ultimate fields reserved. Acceptance: Vitest fixtures for every move's hit/block/whiff/cancel/boundary; seeded fuzz over 5 seeds finds no NaN, OOB, stuck round, or negative resources (§8.1)."*

### Prompt 4 — Match flow & round logic (summary)
*"Implement best-of-3 round flow, 90 s round timer with timeout rules, RoundIntro → … → RoundEnd → Result → Rematch | Menu transitions, and clean-state reset (HP, flux, timer, input buffers, event log) on rematch. Acceptance: unit test plays two full matches with scripted inputs and verifies winner logic, timeout behavior, and that rematch starts with zero stale state (FR-014)."*

### Prompt 5 — Input adapters, local 2P (summary)
*"Build the browser input adapter (apps/web) that samples keyboard per Appendix A and converts to the core `InputFrame` mask. Define a provisional P2 mirror map (e.g., P1: A/D/W/S, J/K/L, Shift, E, U/I; P2: arrows, , / . / , Right Shift, Enter, Numpad cluster) — remapping is a later MUST (FR-003). Wire the core's 6-frame buffer and SoD resolution; clear inputs on window blur. Acceptance: automated input tests verify mapped actions, buffer behavior, SoD → neutral, and focus-loss safety (FR-011)."*

### Prompt 6 — Web shell + greybox presentation (summary)
*"Create the playable browser shell: minimal React/Zustand menus (Title → Versus → Rematch), a Babylon.js scene on the WebGL2 baseline (NFR-001) with a locked side-on camera that never rotates and keeps both fighters framed, a one-lane 'Skyrail Foundry' greybox arena (floor, bounds, backdrop; no hazards), and two primitive greybox fighters (capsules/boxes, distinct colors/silhouettes). Run CombatCore at a fixed 60 Hz via an accumulator loop (NFR-004 cadence), render at display rate with interpolation, never step the sim inside the render callback. Add HUD (HP bars, flux, timer, round pips, controls hint) and an FPS meter. Acceptance: the game boots and plays locally; a 'sim ticks vs render frames' counter proves decoupling; 60 FPS on the target machine."*

### Prompt 7 — Presentation adapter + hit feel (summary)
*"Add an event-driven presentation adapter that subscribes to CombatCore events and drives Babylon transforms, animation, VFX, camera, audio, and HUD — it must never decide damage/collision/results (§6.1). Implement hit-stop (4–10 f, render/effect clocks only, never an extra sim tick), directional hit sparks, hit flash, camera shake, and synthesized Web Audio impact/block SFX (royalty-free). Add reduced-flash and reduced-motion toggles. Acceptance: a test runs the same input script with effects enabled/disabled and confirms identical state hashes (§2.3); render CPU stays ≤8 ms on the target machine (§4.1)."*

### Prompt 8 — Hit-feel review tooling + performance profile (summary)
*"Build the review tooling: dev overlay with per-frame data (frame advantage, hitbox/hurtbox toggle, event log), in-app replay of recorded input scripts, and a scripted review protocol for ≥12 testers (15 min each; measure voluntary rematch rate, target ≥70% per §1.4). Run a performance profile on the defined mid-range test machine (median frame time, p95, GPU capture) and fix the top issues; tune move feel (startup/recovery/hit-stop) based on review notes. Acceptance: review session completed, top-3 issues fixed, median 60 FPS captured and saved to docs."*

### Prompt 9 — Slice exit gate (summary)
*"Run the complete acceptance pass: full best-of-3 local matches with rematch and restart by human testers; determinism suite re-run in Node + both browsers; performance profile re-check; confirm every §9.1 M1 deliverable and §9.2 NOW item; write ADRs for known limits; record the go/no-go decision per §9.4. Acceptance: M1 exit checklist is fully ticked and the decision (proceed vs fix core loop) is documented in the repo."*

---

## 4. Prompt 1 — FULL TEXT (copy-paste ready)

Use this prompt to begin the project. It covers **only** the foundation: repository structure, development environment, and the `CombatCore` package as a pure, deterministic TypeScript module (SRS §5.3, §6.1). Nothing visual yet.

```text
ROLE: You are a senior TypeScript game engineer and architect working on "Aether Break", a browser-based 2.5D arena fighter, per the SRS in this repository ("SRS ether arena.pdf" / "SRS_Ether_Arena.md" — read the PDF; the .md copy is truncated). We are executing Milestone 1, the Greybox Vertical Slice (SRS §9.1): "Two greybox fighters, one lane, local 1v1 duel, 60 Hz CombatCore, 60 FPS target, hit feel review. No online promise until fun is proven."

CONTEXT: Work in the repository root on the current git branch (do not create or switch branches). The existing files `game.js`, `index.html`, and `src/*.js` are a DIVERGED legacy prototype (2D canvas + a Babylon.js experiment that skipped ahead of the SRS). Do not extend them. Using `git mv` (or plain `mkdir` + `mv`), archive them under `legacy/` untouched for reference, and add a `legacy/README.md` explaining they are out of scope.

THIS PROMPT COVERS ONLY: (A) repository scaffold, (B) development environment, (C) the `packages/combat-core` package v0 with its test suite. No rendering, no game visuals, no online.

## A. Repository scaffold (SRS §5.3)
Create a pnpm workspaces monorepo with this layout:
- packages/combat-core/   # THIS PROMPT'S FOCUS — pure deterministic combat engine
- packages/config/        # shared tsconfig.base.json, eslint.config.js, vitest preset
- apps/web/               # Vite + TypeScript placeholder ONLY: an index.html + main.ts that renders "Aether Break — boot OK". Do NOT add React/Babylon yet.
- docs/                   # ADR-0001 (legacy archive decision), ADR-0002 (determinism contract)
Enable pnpm via corepack (corepack enable; corepack prepare pnpm@latest --activate). If pnpm cannot be enabled, fall back to npm workspaces and note the deviation in an ADR. Turborepo is optional: include it only if setup is friction-free, otherwise defer with a note. Pin exact versions in the lockfile at kickoff (SRS §5.1). Toolchain: Node 22+, TypeScript ~5.5 in strict mode, Vitest, ESLint 9 flat config, Prettier, and a minimal pre-commit gate (typecheck + lint + format + test) per NFR-011. Root scripts: dev, build, test, typecheck, lint, format, test:determinism.

## B. packages/combat-core (SRS §5.3 HARD BOUNDARY, §6.1, FR-010)
The core is a PURE, DETERMINISTIC, 60 Hz simulation. Rules:
1. Zero runtime dependencies. No imports from outside the package except shared config. ESM TypeScript.
2. MUST NOT use or import: Date, Math.random, performance, fetch, WebSocket, window/document/browser globals, Node fs/process (except inside *.test.ts), Babylon, React, Web Audio, or any clock/network/render API. Enforce with ESLint restricted globals/imports AND a unit test that scans the source directory for forbidden identifiers.
3. Determinism contract: fixed 60 Hz tick (TICK_RATE = 60); integer/fixed-point math (adopt a documented convention, e.g., all positions/velocities stored as integers scaled by 1000); seeded PRNG (e.g., Park–Miller LCG 16807 mod 2^31-1); stable iteration order (no dependence on object key order, no set/hash iteration); fully serialisable plain-JSON state; `step(state, inputs)` is a pure function returning a new state (document your clone strategy).

Public API to implement:
- Constants: TICK_RATE, TICK_MS, MAX_HP = 1000, MAX_FLUX = 100, ROUND_TICKS = 90 s × 60 (SRS §2.1).
- Types: InputFrame (frame number + action booleans: left, right, up, down, jump, light, heavy, ranged, guard, dash, ability1, ability2, ultimate — ultimate/abilities reserved for later), FighterState, ProjectileState, GameState, GameEvent (tagged union: e.g., attack_started, hit, blocked, whiff, projectile_spawned, damage_dealt, death, round_end, match_end), MoveData.
- MoveData schema mirroring the SRS §7.2 sample: { id, input, startup, active: [start, end], recovery, hitboxes: [{frame, shape, x, y, w, h}], hurtbox, onHit: {damage, hitStun, fluxGain}, onBlock: {blockStun, advantage}, cancelTo: [] } plus reserved fields for abilities/ultimates. Hand-rolled schema validator (zero deps) or Zod if you accept one runtime dependency — prefer zero, and document.
- createInitialState({ seed, mode }): P1 = Nyra Vex on the left, P2 = Bram Kade on the right, 1000 HP, 0 flux, round 1 of 3, full timer, empty event log, empty input buffers.
- step(state, inputs) → new GameState: advances exactly ONE tick — input buffering (6-frame buffer per SRS §2.1 with simultaneous-opposite-direction resolution), movement, gravity, jump/dash, block, the attack state machine (startup/active/recovery), hitbox×hurtbox overlap resolution, projectiles, flux gain, timer decrement, and round/match end transitions. Implement a skeleton of the Appendix B state machine: RoundIntro → Neutral ⇄ {Walk, Jump, Dash, Guard, Attack, Hitstun, Blockstun, Knockdown, Airborne} → RoundEnd → Result → Rematch|Menu (full behavior is the next prompt; leave clean extension points).
- getStateHash(state) → uint32: FNV-1a over a canonical, deterministic serialisation (fixed key order).
- serializeState / deserializeState / cloneState (snapshot support per §6.1, used by rollback later).
- Starter content in src/content/fighters.ts (data, not code): greybox kits for nyra_vex and bram_kade covering walk speed, jump, dash, light, heavy, block, ONE gun (projectile) and ONE spell each — matching the §9.2 NOW list. Use the SRS §7.2 sample numbers as baselines (e.g., light: startup 6, active 6–8, recovery 12, damage 42, hitStun 15, blockStun 9).

Tests (SRS §8.1):
- Unit: movement bounds, jump arcs, block, and for EVERY starter move: hit, block, whiff, cancel, and active-window boundary cases.
- Determinism: run a scripted 10,000-frame input stream twice → identical getStateHash AND identical full serialised state; seeded smoke across a few seeds with no NaN, negative HP/flux, or stuck states.
- Purity scan test: source files contain none of the forbidden identifiers.
- Replay script (scripts/replay.ts): CLI that takes a seed + frame count, steps the sim, prints the final hash — this becomes the cross-runtime proof in the next prompt (do not wire browsers yet).

## C. Documentation
Write one-page ADRs: ADR-0001 (archive legacy prototype; why the SRS structure replaces it) and ADR-0002 (the determinism contract: fixed-point convention, PRNG, pure-step strategy, known limitations). Update the root README with the new layout, scripts, and pointers.

## EXIT CRITERIA (all must pass before you finish)
1. `pnpm install && pnpm typecheck && pnpm lint && pnpm test` are green; format check passes.
2. `pnpm test:determinism` prints the SAME hash for two runs of the 10,000-frame script, and the full states are identical.
3. The purity scan test proves zero forbidden API usage in packages/combat-core.
4. `pnpm dev` serves the apps/web placeholder page ("boot OK") with no errors.
5. README + ADRs exist and are accurate.
6. All work is committed to the current branch with conventional, descriptive commit messages.

REPORT BACK: the final structure tree, the key design decisions you made (fixed-point convention, clone strategy, move data baseline), test output summaries, and anything you deferred with a reason. Do NOT start any visual work, online work, or the full move set — those are later prompts.
```

---

## 5. Roadmap — prompt packs for Milestones 2–5

Each pack becomes a detailed series (like §3) when M1 exits and fun is proven (§9.4 go/no-go).

| Milestone (SRS §9.1) | Prompt pack scope |
|---|---|
| **2 — Online + content foundation (5–7 wks)** | Authoritative match server running the same CombatCore; `packages/protocol` (versioned binary messages per Appendix C); rollback/reconnect using the snapshot support from P1/P2; four greybox fighter kits; training tools (FR-015); 3-difficulty bots (FR-020); asset pipeline (glTF/KTX2 manifest); telemetry + guest profile |
| **3 — Alpha (4–5 wks)** | Final art/animation for four fighters; arena variants (day/night, weather); casual queue + room code; bot pass; performance/content/schema lock; structured external playtest (§1.4 launch targets) |
| **4 — Beta / release candidate (3–4 wks)** | Bug/compat/accessibility/security fixes (§8.1–8.3); load/soak tests; legal/support pages; runbooks; release rehearsal; no new core mechanics |
| **5 — Soft launch & observe (2+ wks)** | Region-limited launch; dashboards watched; queue/latency/crash review before expansion; §9.4 release-readiness checklist |

---

## 6. Milestone 1 exit checklist (copy into the final prompt's acceptance)

- [ ] Two greybox fighters playable in one lane, local 1v1 (keyboard)
- [ ] Move set per §9.2 NOW: movement, attack, block, dash, one gun, one spell, hit feedback
- [ ] CombatCore runs at a fixed 60 Hz, pure and deterministic (§5.3 hard boundary enforced)
- [ ] FR-010 acceptance: identical hashes in Node + ≥2 browsers over 10,000 frames
- [ ] FR-012 acceptance: every launch move has a deterministic test fixture (hit/block/whiff/cancel/boundary)
- [ ] FR-014 acceptance: best-of-3, rematch, clean-state reset verified
- [ ] 60 FPS median on the defined target machine; quality fallback stub works
- [ ] Hit-feel review executed (≥12 testers, 15 min, rematch-rate target ≥70%) with fixes applied
- [ ] Go/no-go recorded: fun proven → proceed to online/content; else fix core loop first (§9.4)
