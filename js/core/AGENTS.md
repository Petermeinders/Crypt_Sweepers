# AGENTS.md — js/core/

The core directory contains the game's runtime backbone: the master orchestrator, the state machine, the event bus, and the logging wrapper. Every other module ultimately reports to or is called by code here.

## Key Files

| File | Purpose |
|------|---------|
| `GameController.js` | Master game loop. Owns the live `run` object. Routes all player actions (tile reveal, combat, abilities, shop, floor transitions). The only caller of `UI.*`, `SaveManager`, and most `*System` modules. |
| `GameState.js` | Finite state machine. Exports `States` enum and `GameState` singleton. `transition(newState)` validates against a `TRANSITIONS` map and rejects invalid moves. |
| `EventBus.js` | Synchronous string-keyed pub/sub. Narrowly scoped — only `AudioManager` and `UI` subscribe. All other cross-module calls go through `GameController` directly. |
| `Logger.js` | Thin console wrapper. All modules use `Logger.*`; no raw `console.*` calls. `Logger.debug` is gated on `CONFIG.debug`. |

## Patterns

- **`GameController` is the only orchestrator.** No other module initiates state transitions or calls `UI` directly. If a system needs something done, it returns a value and `GameController` acts on it.
- **State transitions must be declared.** Adding a new state requires an entry in both `States` and `TRANSITIONS` in `GameState.js` before any other code references it.
- **`GameState.set()` is boot-only.** Force-sets without validation. Use `transition()` everywhere else.
- **EventBus is narrow by design.** Don't wire new game-logic dependencies through it. If you need `SystemA` to talk to `SystemB`, route through `GameController`.
- **Log format:** `[ModuleName] message` — prefix every Logger call with the module name in brackets.

## Data Models

**`run` object** (owned by `GameController`, passed to systems as needed):
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

## Block & Parry integration

`_shouldShowParryWindow(tile)` — returns `true` when the enemy has the `telegraphs` attribute AND does not have `fast` behaviour AND `save.settings.parryEnabled` is `true` (defaults `true`) AND god-mode cheat is off. Called in the combat handler before `UI.showParryWindow`.

`UI.showParryWindow` call signature: `UI.showParryWindow(tile.enemyData, callback, _charKey())` — the third argument passes the currently selected hero ID so the UI can display the matching attack animation. `_charKey()` returns `_save?.selectedCharacter ?? 'warrior'`.

**Parry onboarding chain** (floor 1 only): After the first-run intro is dismissed, `GameController` checks `save.settings.parryChoiceDismissed`. If not set, it calls `UI.showParryOnboarding(enabled => { save.settings.parryEnabled = enabled; … })`. Returning players who skipped the intro still see it via an `else if` branch. Both paths save immediately via `SaveManager`.

## Notes

`GameController.js` is the largest file in the codebase (~10k+ lines). When editing it, search for the specific handler method rather than reading top-to-bottom. Loot pools (`COMMON_LOOT_IDS`, `RARE_TRINKET_IDS`, etc.) are defined at the top of the file, not in `js/data/`.
