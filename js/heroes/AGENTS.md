# AGENTS.md — js/heroes/

Per-hero active ability modules extracted from `GameController.js` (Phase 4). Handlers take a `ctx` dependency object from the orchestrator and **never import `GameController`**.

## Modules

| File | Scope |
|------|-------|
| `warrior.js` | Slam, Blinding Light, Divine Light, Paladin Kill Echo, damage breakdown helpers |
| `ranger.js` | Ricochet, Triple Volley, Poison Arrow, ranger HUD refresh |
| `mage.js` | Spell, Chain Lightning, Telekinetic Throw, Mana Shield, Life Tap |
| `engineer.js` | Turret construct/move/upgrade, Tesla, Mana Generator, seismic ping |
| `necromancer.js` | Minions, Strengthen Minion, Corpse Explosion |
| `vampire.js` | Blood Tithe, Mist Form, Blood Pact, Corrupted Blood / Dark Eyes |
| `HeroAbilityRegistry.js` | Hero id → HUD slot → `GameController` export name (reference only) |

## Context chains

```
_heroAbilityBaseCtx()  — shared mana/cancel/combat deps + _revealCtx()
  ├─ _warriorCtx()
  ├─ _rangerCtx()      — adds isRangerActiveUnlocked, rangerActiveDamageMult
  ├─ _mageCtx()        — adds mage mastery helpers, patchActiveTileDom, die
  ├─ _engineerCtx()    — turret sync, seismic ping, construct tile tap
  ├─ _necroCtx()       — minion sync, corpse explosion, echo hints
  └─ _vampireCtx()     — drain presentation chain, telemetry, blood tithe costs
```

Defined in `GameController.js` immediately before `_combatCtx()`.

## Patterns

- **Thin facades on GameController:** `slamAction() → Warrior.slamAction(_warriorCtx())` — all 92 default-export keys unchanged.
- **Session:** use `session` from `RunContext.js` for run/tap/save reads; do not import GameController.
- **Combat math:** stays in `CombatResolver.js` — hero modules orchestrate UI/tiles/mana only.
- **Cross-hero deps:** e.g. `avgMeleeDamage` lives in `warrior.js`, exposed on `_heroAbilityBaseCtx()` for ranger/mage formulas.
- **Cancel-mode helpers** remain in `GameController.js` and are passed via ctx (`cancelRicochetMode`, etc.).
- **Scaled mana costs:** All ability modules use `ctx.scaledManaCost(baseCost, abilityId)` for the current mana cost of an ability rather than reading the static value from the data file. The static data value is the base (tier-0) cost; the ctx helper adds `+2 per upgrade tier` at runtime. Do not pass hardcoded `manaCost` constants from data files to UI ability buttons.

## External dependencies

- **Called by:** `GameController.js` facades only (plus `TileTapRouter` / `TileRevealController` via ctx callbacks).
- **Imports:** `session` / `charKey` from `RunContext.js`, `UI`, `EventBus`, `TileEngine`, hero `data/*.js` upgrades.
