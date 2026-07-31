# Implementation Summary — Iria Sol

## 1. Two-sentence gameplay summary

Iria Sol is a **setup zoner** who spends prism charges to plant delayed **Prism Gates**, shapes neutral with **Split Bolt** (and one-time Gate bends), and survives rushdown attempts with a tight **Mirror Ward** reflect window. She closes rounds with **Sevenfold Star**, a confirm-oriented ultimate that scales with leftover charges and **fizzles hard** if used raw.

## 2. Skill floor vs. ceiling

- **Floor:** Walk backward, press ranged and light; win against players who walk into cooked Gates. Still loses badly if they never learn Ward or spacing.
- **Ceiling:** Double-Gate geometries, bolt-bend routes, tick-perfect Ward against guns, Light-2 confirm into Sevenfold, okizeme Gate meaties, charge economy across rounds.

## 3. What makes her unique

No other launch fighter **owns delayed space** as a primary resource. Nyra harasses with heat guns; Bram forces entry; Kellan (planned) chases. Iria’s identity is **timers + reflect + confirm super**, not speed or armor.

## 4. Fun factor

Players who like tower-defense brain in a fighter get to “cook” the opponent. Landing a Ward reflect feels genius; a max-charge Sevenfold after a patient Gate setup feels like a heist payoff. The fizzle rule keeps her honest and fun to fight.

## 5. Development priority (build order)

1. **Data load** — parse `iria_sol.json` into CombatCore `FighterKit` / extended resources  
2. **Normals + Split Bolt** — parity with Nyra/Bram greybox tests  
3. **Prism Gate** place / delay / bolt / destroy / max 2  
4. **Mirror Ward** reflect + melee break  
5. **Sevenfold** confirm flag + fizzle + charge scaling  
6. **Bot profiles** wired to intent weights  
7. **VFX/anim** presentation hooks (non-blocking for greybox capsules)  
8. **Balance** 100-match seed sweeps vs Nyra/Bram  

## 6. File map

| Path | Role |
|------|------|
| `docs/characters/iria_sol/KIT_CARD.md` | Design bible |
| `docs/characters/iria_sol/ANIMATION_SPEC.md` | Art/anim contract |
| `docs/characters/iria_sol/VFX_SPEC.md` | VFX contract |
| `docs/characters/iria_sol/BALANCE_TEST_PLAN.md` | QA / balance |
| `docs/characters/iria_sol/IMPLEMENTATION_SUMMARY.md` | This file |
| `packages/content/fighters/iria_sol.json` | Authoritative content JSON |
| `packages/content/bots/iria_sol_bots.json` | Easy/Normal/Hard bots |

## 7. Engine notes

- Spatial numbers in JSON are **fixed-point ×1000** (ADR-0002).  
- Greybox CombatCore v0 maps `SPELL` ← ability-like tools; full Gate/Ward state machines are **Milestone 2 content hooks** — JSON is complete so implementation can be data-first.  
- `moves[]` array included for drop-in compatibility with current `FighterKit` shape.
