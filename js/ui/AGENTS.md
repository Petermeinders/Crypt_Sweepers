# AGENTS.md — js/ui/

The UI directory contains all DOM interaction code. Game logic never lives here — this layer is write-only from the perspective of the game systems.

## Key Files

| File | Purpose |
|------|---------|
| `UI.js` | All DOM updates for the entire game. Caches element references in the `el` object on `init()`. Exposes named update functions called by `GameController`. Never calls back into game logic. |
| `DiceRoller.js` | Physics-based dice animation using Matter.js (loaded via `<script>` tag globally). Creates two chamfered dice that bounce on a felt table and settle on pre-determined values. Returns a `{ roll, drawIdle, destroy }` factory. |

## Patterns

- **`el` cache is initialized once at `UI.init()`.** All DOM queries happen at boot. Never call `document.getElementById` from inside an update function — add the reference to `el` in `init()` first.
- **UI is write-only.** `UI.*` methods receive data and render it. They emit events on `EventBus` for discovery notifications (bestiary, trinket) but never call `GameController` methods.
- **`UI.renderTileGridInto(container, tiles)`** is the shared tile renderer. Used for both the main grid and sub-floor grids — do not duplicate rendering logic.
- **`applyFloorTheme(floor)`** sets `--floor-bg-image` and other CSS variables on `:root`. All theming goes through this; don't patch CSS classes directly for biome changes.
- **DiceRoller is self-contained.** `createDiceRoller(canvas)` returns a controller object. The caller is responsible for `destroy()` when the dice overlay closes to clean up the Matter.js engine and cancel the animation frame.
- **Matter.js is a global.** `DiceRoller.js` destructures `{ Engine, Bodies, Body, World, Events }` from the global `Matter` object loaded via `<script>` tag in `index.html`. It is not imported.

## Data Models

**`el` cache** — flat object of element references keyed by logical name (e.g. `el.hpBar`, `el.goldCount`, `el.combatPanel`). Initialized in `UI.init()`, read-only thereafter.

**Tile DOM structure** — each tile is a `<div class="tile type-{type}">` rendered by `renderTileGridInto`. The tile object's `.element` property points back to this node for single-tile patching.

## External Dependencies

- **Called by:** `GameController` (all game state renders), `js/main.js` (init, menu renders)
- **Imports:** `CONFIG`, `TileEngine` (grid reads), `TILE_BLURBS`, `ENEMY_DEFS`, `ITEMS`, `tileIcons`, `Bestiary`, `TrinketCodex`, `EventBus`
- **Does NOT call:** `GameController`, `CombatResolver`, `MetaProgression`, or any system that mutates game state
