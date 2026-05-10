# AGENTS.md — js/systems/

The systems directory contains all stateful and stateless game systems that are not the orchestrator. These modules are called by `GameController`; they do not call each other except where explicitly noted below.

## Key Files

| File | Purpose |
|------|---------|
| `TileEngine.js` | Owns the grid model (`_grid`). Generates floors, creates tile/enemy objects, manages sub-floor state, provides `getGrid()` / `getActiveTiles()` / `patchMainGridTileAt()` accessors. |
| `CombatResolver.js` | Pure combat math — no DOM, no state transitions. Returns result objects. `GameController` acts on the results. |
| `EnemyScaling.js` | Single exported function `scaleEnemyDef(def, floor)`. Applies piecewise linear HP/DMG scaling. Used by `TileEngine.createEnemy()` and `js/balance/snapshot.js`. |
| `MetaProgression.js` | Manages the persistent save structure (hero XP trees, global passives, gold shop, hero unlocks). `defaultSave()` defines the canonical save schema. `applyToPlayer()` applies save state to a fresh player object at run start. |
| `ProgressionSystem.js` | In-run level-up system. `getChoices()` builds a weighted pool of ability/stat/mastery options. `applyAbility()` mutates the player object. |
| `FloorModifiers.js` | Pool of 14 floor modifiers (boons/curses). `pickModifier(floor, isRest, isBoss)` returns one modifier or null. Static modifiers call `apply()` immediately; dynamic ones are checked inline in `GameController` via `run.floorModifier.id`. |
| `AudioManager.js` | Web Audio API wrapper. Subscribes to `EventBus` events (`audio:play`, `audio:music`, `audio:crossfade`, `audio:stop`). Loads SFX on first user interaction (iOS requirement). |
| `Bestiary.js` | Persistent discovery log for enemy types. Reads/writes `save.bestiarySeen[]`. Stateless utility — all functions take `save` as a parameter. |
| `TrinketCodex.js` | Persistent discovery log for item/trinket IDs. Reads/writes `save.trinketsSeen[]`. Same stateless utility pattern as `Bestiary`. |

## Patterns

- **Systems are called by GameController; they don't call each other** (except `TileEngine` → `EnemyScaling`, and `ProgressionSystem` → data files).
- **`CombatResolver` is pure.** It receives plain objects and returns plain objects. Never add DOM access or state transitions here.
- **TileEngine owns grid state** — `_grid` and `_currentFloor` are module-level private. Access via the exported API only.
- **Active grid abstraction.** `_getActiveTiles()` / `_getActiveTileRows()` return either the main grid or the active sub-floor — combat and abilities always use these, never the raw `_grid`.
- **Single tile patching.** Each tile object carries an `.element` back-reference. `patchMainGridTileAt(row, col)` updates that single DOM node without a full re-render.
- **`MetaProgression.defaultSave()` is the schema.** When adding a new persistent field, add it here with a default value. Old saves without the field are handled by optional chaining at point of use.
- **`Bestiary` / `TrinketCodex` follow the same shape.** `ensure(save)` guards the array, `registerIfNew(save, id)` returns true on first registration, `hasSeen(save, id)` is a read-only check.
- **FloorModifier `apply()`/`clear()` pattern.** If a modifier needs cleanup at floor exit, implement `clear(run, grid)`. Dynamic modifiers (inline checks) leave `apply()` as a no-op and document the inline location in a comment.
- **AudioManager fails silently.** Missing SFX files log a warning and are skipped. The `zap` SFX is synthesized via Web Audio nodes — no asset file.

## Data Models

**Tile object** `{ row, col, type, revealed, locked, enemyData, itemData, element }`
- `enemyData` — scaled enemy definition + `hitDamage` (rolled once on reveal), `currentHP`, `threatLevel`
- `itemData` — item id and stack count (loot dropped in chest/sub-floor)
- `element` — live DOM reference for single-tile patching

**Enemy object** (from `createEnemy`) — a spread of the scaled `ENEMY_DEF` plus `{ enemyId, threatLevel, hitDamage, currentHP }`

**Save schema** (from `MetaProgression.defaultSave()`):
- `version`, `lastSaved`, `persistentGold`
- `warrior` / `ranger` / `engineer` / `mage` / `vampire` / `necromancer` — each `{ totalXP, upgrades[] }`
- `unlockedHeroes[]`, `selectedCharacter`, `globalPassives[]`
- `settings` — difficulty, tileColors, subLevelsEnabled, autoPotions, etc.
  - `parryEnabled` *(bool, default `true`)* — gates the Block & Parry reflex mechanic; when `false` combat resolves without player interaction
  - `parryChoiceDismissed` *(bool, default `false`)* — tracks whether the floor-1 onboarding modal has been shown
- `bestiarySeen[]`, `trinketsSeen[]`

## External Dependencies

- **`TileEngine`** — called by `GameController`; imports `TILE_DEFS`, `ENEMY_DEFS`, `BOSS_POOL`, `tileIcons`, `EnemyScaling`
- **`CombatResolver`** — called by `GameController`; imports `CONFIG`, hero base stats from `js/data/`
- **`MetaProgression`** — called by `GameController` and `js/main.js`; imports all upgrade maps from `js/data/`
- **`ProgressionSystem`** — called by `GameController`; imports all ability maps from `js/data/`
- **`FloorModifiers`** — called by `GameController` at floor start
- **`AudioManager`** — subscribes to `EventBus`; called by `js/main.js` for `init()`
- **`Bestiary` / `TrinketCodex`** — called by `GameController` and `UI`
