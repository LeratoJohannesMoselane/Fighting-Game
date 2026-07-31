# Iria Sol — Complete Character Package

**Roster slot:** Launch fighter #3 (SRS §2.4 Prism Magus)  
**Status:** Design + content data complete · Greybox kit registered in CombatCore · Full Gate/Ward/Ult FSM pending engine spike

## Package contents

| Deliverable | Path |
|-------------|------|
| **1. Kit card** | [KIT_CARD.md](./KIT_CARD.md) |
| **2. Full JSON** | [`packages/content/fighters/iria_sol.json`](../../../packages/content/fighters/iria_sol.json) |
| **3. Animation spec** | [ANIMATION_SPEC.md](./ANIMATION_SPEC.md) |
| **4. VFX spec** | [VFX_SPEC.md](./VFX_SPEC.md) |
| **5. Balance plan** | [BALANCE_TEST_PLAN.md](./BALANCE_TEST_PLAN.md) |
| **6. Bot profiles** | [`packages/content/bots/iria_sol_bots.json`](../../../packages/content/bots/iria_sol_bots.json) |
| **7. Implementation summary** | [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) |

## Validate

```bash
node scripts/validate-iria.mjs
pnpm --filter @aether-break/content typecheck
```

## Greybox note

CombatCore `IRIA_SOL` exposes light/heavy/bolt/spell stand-ins for lab play. Authoritative production numbers and Gate/Ward/Sevenfold rules live in the JSON above—implement against that file, not hard-coded magic numbers.
