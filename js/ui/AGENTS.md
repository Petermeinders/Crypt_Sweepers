# AGENTS.md — js/ui/

The UI directory contains all DOM interaction code. Game logic never lives here — this layer is write-only from the perspective of the game systems.

## Key Files

| File | Purpose |
|------|---------|
| `UI.js` | All DOM updates for the entire game. Caches element references in the `el` object on `init()`. Exposes named update functions called by `GameController`. Never calls back into game logic. |
| `DiceRoller.js` | Physics-based dice animation using Matter.js (loaded via `<script>` tag globally). Creates two chamfered dice that bounce on a felt table and settle on pre-determined values. Returns a `{ roll, drawIdle, destroy }` factory. |

## Block & Parry UI

`showParryWindow(enemyData, onResolve)` — Momentum Ring mechanic shown when fighting enemies with the `telegraphs` attribute (and `parryEnabled` is true in settings). A fire rune ring (`assets/ui/rune-ring2.png`) shrinks from full arena size toward a fixed inner gold rune ring (`assets/ui/rune-ring.png`). Player taps to block or swipes in the indicated direction to counter.

- **Timing**: difficulty-tiered `windowDur` (1100–2200ms) with ±25% randomisation to prevent muscle memory
- **Hit zone**: `ringScale` between `zoneMin` and `zoneMax` (calculated from `TARGET_SCALE = 45/130`)
- **Canvas arc**: `<canvas id="parry-arc-canvas">` draws a gold 80° arc on the outer ring edge indicating the required swipe direction; the canvas is scaled identically to the ring via `style.transform` each rAF tick
- **Spin**: outer ring simultaneously rotates clockwise 360° per 14 s via `scale(…) rotate(…deg)` combined in the rAF loop
- **Resolve**: `'block'` (tap in zone), `'counter'` (swipe correct direction in zone), `'miss'` (wrong timing or direction). Fires screen flash (`#parry-flash-overlay`) and screen shake on miss.
- **Callback**: `onResolve(result)` — `GameController` acts on this; UI never mutates game state

`showParryOnboarding(onChoice)` — One-time modal shown on floor 1 asking new players whether they want Block & Parry or Classic Combat. Calls `onChoice(true|false)`.

**New `el` cache entries** (added alongside parry feature):
`parryRingArena`, `parryRingOuter`, `parryCompassN/E/S/W`, `parryArcCanvas`, `parryFlashOverlay`

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
