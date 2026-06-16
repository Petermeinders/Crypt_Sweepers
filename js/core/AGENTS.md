# AGENTS.md — js/core/

The core directory contains the game's runtime backbone: the master orchestrator, the state machine, the event bus, and the logging wrapper. Every other module ultimately reports to or is called by code here.

## Key Files

| File | Purpose |
|------|---------|
| `GameController.js` | Master game loop facade. Routes player actions; delegates init/persistence/death to `GameStateHandlers.js`. |
| `RunContext.js` | Session accessor: `session.save`, `session.run`, `session.tap`, `session.lastRunTelemetrySnapshot`, `charKey()`. |
| `tapState.js` | Factory for `session.tap` — combat-busy, targeting modes, combat engagement tile ref. |
| `GameStateHandlers.js` | Init, newGame, persistence, menu, retreat, death — receives `ctx` deps, never imports GameController. |
| `GameState.js` | Finite state machine. Exports `States` enum and `GameState` singleton. `transition(newState)` validates against a `TRANSITIONS` map and rejects invalid moves. |
| `EventBus.js` | Synchronous string-keyed pub/sub. Narrowly scoped — only `AudioManager` and `UI` subscribe. All other cross-module calls go through `GameController` directly. |
| `Logger.js` | Thin console wrapper. All modules use `Logger.*`; no raw `console.*` calls. `Logger.debug` is gated on `CONFIG.debug`. |

## Extracted controllers (refactor)

| Module | Role |
|--------|------|
| `../controllers/CheatController.js` | Dev cheat surface (`cheatSkipFloor`, `applyCheat`, `cheatHudStatBoost`) — wired via deps from `GameController` |
| `../controllers/BalanceBotBridge.js` | Balance-bot / test-bot tap candidates, diagnostics, ability policy — 11 public methods re-exported on `GameController` |
| `../controllers/TileTapRouter.js` | Active grid + combat engagement + `onTileTap` — flags on `session.tap` |

## Patterns

- **`GameController` is the only orchestrator.** No other module initiates state transitions or calls `UI` directly. If a system needs something done, it returns a value and `GameController` acts on it.
- **State transitions must be declared.** Adding a new state requires an entry in both `States` and `TRANSITIONS` in `GameState.js` before any other code references it.
- **`GameState.set()` is boot-only.** Force-sets without validation. Use `transition()` everywhere else.
- **EventBus is narrow by design.** Don't wire new game-logic dependencies through it. If you need `SystemA` to talk to `SystemB`, route through `GameController`.
- **Log format:** `[ModuleName] message` — prefix every Logger call with the module name in brackets.

## Data Models

**`run` object** (owned via `RunContext.session.run`, passed to systems as needed):
- `player` — live stat object (hp, mana, gold, inventory, abilities, damageBonus, …)
- `floor` — current floor number
- `floorModifier` — active `FloorModifiers` entry or `null`
- `telemetry` — `createInitialTelemetry()` record, accumulated during the run
- `turret` (Engineer only) — `{ hp, level, row, col }`

**State lifecycle:** `boot → menu → char-select → floor-explore ↔ combat → level-up → death / between-runs → menu`

## External Dependencies

- **Calls:** `TileEngine`, `CombatResolver`, `ProgressionSystem`, `MetaProgression`, `SaveManager`, `UI`, `FloorModifiers`, `Bestiary`, `TrinketCodex`, `EventBus`, all `js/data/*`
- **Called by:** `js/main.js` (wires events and boots the game); `js/dev/balanceBotAutopilot.js` (calls public GameController methods to simulate play)
- **EventBus subscribers:** `AudioManager` (audio events), `UI` (some discovery/notification events)

## Scaled mana costs

`_scaledManaCost(baseCost, abilityId)` — returns `baseCost + 2 * upgradeCount` for the given ability. Upgrade count is read from the active run's player upgrade list. Exposed on both `_floorCtx()` and `_heroAbilityBaseCtx()` as `ctx.scaledManaCost` so hero modules and `FloorController` can display the correct mana cost at every upgrade tier. This is used for every active ability across all heroes; the static `manaCost` values in hero data files are the **base** (tier-0) costs only.

`useOrbPotion` is re-exported on `GameController.default` and delegates to `InventoryController.useOrbPotion`. It is the action fired when the player taps the HP or mana orb in the HUD.

## Block & Parry integration

`_shouldShowParryWindow(tile)` — returns `true` when the enemy has the `telegraphs` attribute AND does not have `fast` behaviour AND `save.settings.parryEnabled` is `true` (defaults `true`) AND god-mode cheat is off. Called in the combat handler before `UI.showParryWindow`.

**Parry window call**: `UI.showParryWindow(tile.enemyData, callback, _charKey())` — third argument passes hero ID for the attack animation; `_charKey()` returns `_save?.selectedCharacter ?? 'warrior'`.

**Tutorial intercept** (first parry only): Before opening the real parry window, `GameController` checks `!_save.settings?.parryTutorialSeen`. If unset (and not a bot run), it sets the flag, saves, then calls `UI.showParryTutorial(_charKey(), _doParryWindow)` where `_doParryWindow` is the real `UI.showParryWindow(...)` call wrapped in a closure. This ensures the tutorial runs exactly once; the real parry fires after `onComplete` resolves.

**Parry onboarding chain** (floor 1 only): After the first-run intro is dismissed, `GameController` checks `save.settings.parryChoiceDismissed`. If not set, it calls `UI.showParryOnboarding(enabled => { save.settings.parryEnabled = enabled; … })`. Returning players who skipped the intro still see it via an `else if` branch. Both paths save immediately via `SaveManager`.

**Save flags for parry**: `settings.parryEnabled` (bool, default true), `settings.parryChoiceDismissed` (bool), `settings.parryTutorialSeen` (bool). All three defined in `MetaProgression.defaultSave()`.

## Notes

`GameController.js` is a facade (~2.8k lines) that wires `js/controllers/*` and `js/heroes/*` via `ctx` objects. Domain logic lives in those modules — search there first. See `docs/refactor/README.md` for the full map. Loot pools: `js/systems/LootTables.js`; haptics: `js/systems/Haptics.js`.
