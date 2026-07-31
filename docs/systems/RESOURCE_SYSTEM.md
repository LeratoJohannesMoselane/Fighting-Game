# Aether Break — Complete Resource System

**Status:** Implemented in CombatCore (`packages/combat-core/src/resources.ts`) + HUD  
**Constraint:** Pure tick-based (no `setTimeout` / `Date` / DOM in core)

## Resources

| Resource | Range | Spend | Gain |
|----------|-------|-------|------|
| **HP** | 0–maxHp | Damage | — |
| **Stamina** | 0–100 | Block (per frame), dash (15), move costs | Regen 2%/s after 1s idle; small melee restore |
| **Flux** | 0–100 | Ultimate 100, Awakening 50 | Hits dealt/received, block drip, combo milestones |
| **Special** | per fighter | Ammo/charges on gun/spell | Recharge timers / heat from hits |
| **Combo** | count + timer | Resets after gap | Landing hits |
| **Awakening** | flag + timer | Once/round | Manual when HP≤30% & Flux≥50% |

## Flux (Ultimate meter)

- Builds from **active play only** (hits, being hit, block drip, combo bonuses).
- **Ultimate** (`Q` / `O`): requires 100 flux, spends all.
- **Awakening** (`Q`+`T` / `O`+`I`): requires HP ≤ 30% and flux ≥ 50, spends 50, lasts 15s.
- Awakening multiplies flux gain ×1.5 while active.

## Stamina

| Band | Range | Effect |
|------|-------|--------|
| Full / Efficient | 60–100 | Normal costs (green) |
| Limited | 30–59 | Costs ×1.1 (yellow) |
| Critical | 1–29 | Costs ×1.25, blockstun +3 (red flash) |
| Empty | 0 | No dash; next block = **guard crush** |

Block drains ~4.8 stamina/sec. Dash base cost 15 (band-adjusted). Regen starts 60 ticks after last spend.

## Special resources (per fighter)

| Fighter | Kind | Max | Behavior |
|---------|------|-----|----------|
| Nyra | Ammo | 5 | Gun/bomb spend 1; recharge 1 / 2s after 1s delay; awaken = faster recharge |
| Bram | Heat | 100 | Builds on melee hits (+8); cools slowly; awaken = free block |
| Iria | Prism | 3 | Start 2; spell/snake spend 1; recharge 1 / 4s; awaken = faster recharge |

## Combo

- Timer: reset 30f, +10f per hit, max 90f.
- Scaling: 100% → 90 → 80 → 70 → 60 → 50% (min).
- +10% damage if last 5 moves unique.
- Flux bonus at 5 / 10 / 15 hits; callouts GOOD/GREAT/EXCELLENT/AMAZING.

## Awakening (manual only)

**Input:** Ultimate + Ability2 same frame (`Q`+`T` P1, `O`+`I` P2).

**Universal buffs (15s):**
- Damage dealt +20%, taken −15%
- Move speed +10%
- Flux gain +50%
- Aura VFX + stage vignette + HUD badge

**Once per round.** Flux carries between rounds; awakening does not.

## Files

| Path | Role |
|------|------|
| `packages/combat-core/src/resources.ts` | Pure logic |
| `packages/combat-core/src/step.ts` | Integration |
| `packages/combat-core/src/state.ts` | Init / round reset |
| `apps/web/src/hud.ts` | Bars, orbs, combo, awake badge |
| `apps/web/index.html` | HUD markup |

## JSON schema (content)

See fighter profiles in `RESOURCE_PROFILES` — data-driven special configs. Full external JSON can mirror:

```json
{
  "resources": {
    "flux": { "max": 100, "ultimateCost": 100, "awakeningCost": 50 },
    "stamina": { "max": 100, "regenPerSec": 2, "regenDelaySec": 1, "dashCost": 15 },
    "special": { "type": "ammo", "max": 5, "rechargeIntervalSec": 2 }
  },
  "awakening": { "requiredHpPct": 30, "durationSec": 15, "activation": "manual" },
  "combo": { "resetFrames": 30, "scaling": [1, 0.9, 0.8, 0.7, 0.6, 0.5] }
}
```
