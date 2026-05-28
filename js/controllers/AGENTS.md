# AGENTS.md — js/controllers/

Extracted controller modules that receive a `ctx` dependency object from `GameController`. **Never import `GameController`** — the orchestrator wires callbacks and re-exports public API keys unchanged.

## Modules

| File | Role |
|------|------|
| `TileTapRouter.js` | Active grid helpers (`getActiveTiles`, `getActiveTileRows`, …), combat engagement focus, `onTileTap(ctx, row, col)`. Tap/targeting flags live on `RunContext.session.tap` (see `tapState.js`). |
| `TargetingController.js` | Ability targeting cancel modes + `tryConsumeTargetingTap(ctx, tile)` (spell, ricochet, volley, chain lightning, telekinetic throw). |
| `SpecialSpawnController.js` | Treasure goblin spawn/timer/reward, archer goblin, mouse floor spawns. |
| `TileRevealController.js` | `revealTile`, `resolveEffect`, chest open, hold-to-inspect, global turn tick (`tickPoisonArrowDotOnGlobalTurn`), mouse unflip, deadlock escape offer. |
| `CombatController.js` | `fightAction`, `endCombatVictory`, parry window, shield block, taunt redirect, stormcaller lightning proc. Combat engagement stays in `TileTapRouter`. |
| `FloorController.js` | `startFloor`, `handleExit`, `confirmRope`, `nextFloor`, `checkFloorModifierOnReveal`. |
| `GearController.js` | Equip/unequip, stat apply/remove, gear drops, blacksmith upgrade/disassemble/detriment reduction. `BACKPACK_MAX_SLOTS` from `LootTables.js`. |
| `InventoryController.js` | `addToBackpack`, `canAddToBackpack`, `useItem`, `dropItem`, `forceReplaceItem`. Trinket on-equip effects on pickup/drop. |
| `ForgeController.js` | Sanctuary forge overlay — `openForge(ctx, tile)`, `doForge(ctx, tile, recipeId)`. |
| `EventTileController.js` | NPC event tiles — merchant, gambler, triple chest, trinket trader, story events. |
| `SubFloorController.js` | Sub-floor entry/load/combat, war banner spawn/destroy, shrine, `patchActiveTileDom`. |
| `CheatController.js` | Dev cheat surface — wired via deps from `GameController`. |
| `BalanceBotBridge.js` | Balance-bot tap candidates, diagnostics, ability policy — 11 public methods re-exported on `GameController`. |

## Context chains

```
_tapCtx() → _revealCtx() → _combatCtx() → _floorCtx()
_gearCtx()     — rand, playerDamageRange
_inventoryCtx() — extends _revealCtx() + die, hourglass, lantern/dowsing/spyglass actions
_forgeCtx()    — dropItem, canAddToBackpack, addToBackpack
_eventCtx()    — merchant/gambler/story deps (pickRandom, gainGold, takeDamage, …)
_subFloorCtx() — sub-floor combat/reveal + tryConsumeTargetingTap, onTileTap/Hold
```

## Patterns

- Handlers take `(ctx, …)` where `ctx` bundles GameController callbacks the module needs.
- Session flags for tap routing: `session.tap.*` from `RunContext.js` / `tapState.js`; reset via `initSession()` and `_resetCombatOnDeath()`.
- Active grid: always use `getActiveTiles()` / `getActiveTileRows()` when operating on tiles during sub-floors.
- `GameController` keeps thin wrappers (e.g. `fightAction(tile) → CombatController.fightAction(_combatCtx(), tile)`) and const aliases for internal helpers.

## Post–Phase 5 extractions

- `TargetingController.js`, `SpecialSpawnController.js` (facade shrink pass).

## Phase 6 UI split (done)

`js/ui/UI.js` is a facade over `uiShared.js`, `Hud.js`, `Grid.js`, `CombatUi.js`, `Modals.js`. GameController still imports only `UI.js`; the 92-key API is unchanged. See `js/ui/AGENTS.md` and `docs/refactor/README.md`.
