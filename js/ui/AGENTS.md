# AGENTS.md — js/ui/

The UI directory contains all DOM interaction code. Game logic never lives here — this layer is write-only from the perspective of the game systems.

## Key Files

| File | Purpose |
|------|---------|
| `UI.js` | **Facade** — single public import path. `init()` delegates to submodule `cache*Elements()` / `wire*Listeners()`; spreads `HudMethods`, `GridMethods`, `CombatUiMethods`, `ModalsMethods` onto the default export. Never calls back into game logic. |
| `uiShared.js` | Shared `el` object, `logHistory`, `PORTRAIT_ANIM`, parry GIF cache (`loadHeroParryGif`), and cross-cutting render helpers (`fillBestiaryCreatureParts`, `fillTrinketCard`, `drawSettledDice`). Imported by all UI submodules. |
| `Hud.js` | HUD stats, portrait, resource counters, floor theme, message/log, retreat, ability button strip, status overlays, action panel, floor transition. |
| `Grid.js` | Tile grid rendering helpers, tile class toggles, grid targeting modes, float text, boss exit mark, slime split. |
| `CombatUi.js` | Enemy status/HP on tiles, shake, attack VFX, parry window (`showParryWindow`, tutorial, onboarding). |
| `Modals.js` | Overlays and modals: info card, trap/first-run, backpack, gear/equipment/compare/blacksmith, level-up, events, death screen, subfloor UI, bestiary/trinket codex, dice overlay. |
| `DiceRoller.js` | Physics-based dice animation using Matter.js (loaded via `<script>` tag globally). Creates two chamfered dice that bounce on a felt table and settle on pre-determined values. Returns a `{ roll, drawIdle, destroy }` factory. |

## Block & Parry UI

`showParryWindow(enemyData, onResolve, heroId, opts)` — Momentum Ring mechanic shown when fighting enemies with the `telegraphs` attribute (and `parryEnabled` is true in settings). A fire rune ring (`assets/ui/rune-ring2.png`) shrinks from full arena size toward a fixed inner gold rune ring (`assets/ui/rune-ring.png`). The selected hero's attack GIF plays at the centre, frame-locked to ring progress. Player taps to block or swipes in the indicated direction to counter.

- **Signature**: `heroId` (3rd param, string, e.g. `'ranger'`) passed by `GameController` via `_charKey()`. Defaults to `'warrior'`. `opts` (4th param, optional object): `{ practiceMode: bool, practiceHint: string }`.
- **Enemy display**: `#parry-enemy-display` above the ring arena shows the enemy's idle GIF (`<img>`, native browser animation) and name. Populated from `ENEMY_SPRITES[enemyData.enemyId].idle` + `MONSTER_ICONS_BASE`. Hidden when `opts.practiceMode` is true or when `enemyData.enemyId` is null.
- **Practice mode** (`opts.practiceMode: true`): overrides timing to fixed 2500 ms, widens sweet zone to 42%, hides enemy display, shows `#parry-practice-label` with `opts.practiceHint` text. Used by `showParryTutorial` for training rounds. Real game never passes `practiceMode`.
- **Timing**: difficulty-tiered base duration (1100–2200 ms) multiplied by a wide random factor (`0.40–1.60×`, min 550 ms) for a ~4× speed spread that prevents muscle memory. Easy enemies: 880–3520 ms; hard enemies: 550–1760 ms.
- **Hit zone**: `ringScale` between `zoneMin` and `zoneMax` (calculated from `TARGET_SCALE = 55/160`)
- **Canvas arc**: `<canvas id="parry-arc-canvas">` (360×360, offset -20 px to centre over the 320 px arena) draws a gold 80° arc on the outer ring edge indicating the required swipe direction; the canvas is scaled identically to the ring via `style.transform` each rAF tick.
- **Spin**: outer ring simultaneously rotates clockwise 360° per 14 s via `scale(…) rotate(…deg)` combined in the rAF loop
- **Hero sprite (seekable animation)**: `<canvas id="parry-hero-canvas">` (320×320, z-index 0) renders the hero's attack GIF frame-by-frame. Frame index = `floor((1 − ringScale) × (totalFrames − 1))`. Frames are pre-baked to `ImageBitmap[]` once per hero and cached in `heroGifCache` (`uiShared.js`).
- **Hero GIF map** (`HERO_ATTACK_GIFS` in `uiShared.js`): warrior → `warrior-strike.gif`, ranger → `__Attack.gif`, mage → `blue-mage-hero-attack-small-speed.gif`, engineer → `engineer-hero-strike.gif`, necromancer → `necromancer-hero-strike.gif`, vampire → `VampireAttack.gif`. Falls back to warrior if heroId is unknown.
- **Resolve**: `'block'` (tap in zone), `'counter'` (swipe correct direction in zone), `'miss-block'` / `'miss-parry'` (wrong timing/direction), `'ignore'` (ring expired, no input). Fires screen flash + screen shake on miss. Result feedback word rendered via `.parry-feedback-icon.parry-text-{result}`. Overlay closes after 350 ms.
- **Callback**: `onResolve(result)` — `GameController` acts on this; UI never mutates game state.

`showParryTutorial(heroId, onComplete)` — Interactive 3-step training tutorial shown once before the player's first real parry encounter (gated by `save.settings.parryTutorialSeen`). Step 1: outcome reference table. Steps 2–3: practice rounds using `showParryWindow` with `opts.practiceMode = true` and a mock enemy `{ dmg:[1,1], enemyId:null }`. Tutorial modal hides while each practice ring is active; returns after the result. Skip button exits immediately and calls `onComplete()`. `GameController` sets `parryTutorialSeen = true` before calling this so it only ever fires once.

`showParryOnboarding(onChoice)` — One-time modal shown on floor 1 asking new players whether they want Block & Parry or Classic Combat. Calls `onChoice(true|false)`.

**`el` cache entries for parry**:
`parryOverlay`, `parryEnemyDisplay`, `parryEnemyIcon`, `parryEnemyName`, `parryPracticeLabel`, `parryRingArena`, `parryHeroCanvas`, `parryRingOuter`, `parryCompassN/E/S/W`, `parryArcCanvas`, `parryFlashOverlay`, `parryTutorialOverlay`, `parryTutorialBody`, `parryTutorialPips`, `parryTutorialNext`, `parryTutorialSkip`

## Patterns

- **`el` cache is initialized once at `UI.init()`.** Submodule `cacheHudElements()`, `cacheGridElements()`, etc. populate the shared `el` from `uiShared.js`. Never call `document.getElementById` from inside an update function — add the reference to the appropriate submodule cache first.
- **UI is write-only.** `UI.*` methods receive data and render it. They emit events on `EventBus` for discovery notifications (bestiary, trinket) but never call `GameController` methods.
- **`UI.renderTileGridInto(container, tiles)`** is the shared tile renderer. Used for both the main grid and sub-floor grids — do not duplicate rendering logic.
- **`applyFloorTheme(floor)`** sets `--floor-bg-image` and other CSS variables on `:root`. All theming goes through this; don't patch CSS classes directly for biome changes.
- **DiceRoller is self-contained.** `createDiceRoller(canvas)` returns a controller object. The caller is responsible for `destroy()` when the dice overlay closes to clean up the Matter.js engine and cancel the animation frame.
- **Matter.js is a global.** `DiceRoller.js` destructures `{ Engine, Bodies, Body, World, Events }` from the global `Matter` object loaded via `<script>` tag in `index.html`. It is not imported.
- **omggif.js is a global.** `js/lib/omggif.js` exposes `window.GifReader`. `CombatUi.js` / `uiShared.js` checks `window.GifReader` before calling `loadHeroParryGif()` so the parry window degrades gracefully (sprite simply absent) if the script fails to load. Do not import omggif as an ES module.

## Data Models

**`el` cache** — flat object of element references keyed by logical name (e.g. `el.hpBar`, `el.goldCount`, `el.combatPanel`). Initialized in `UI.init()`, read-only thereafter.

**Tile DOM structure** — each tile is a `<div class="tile type-{type}">` rendered by `renderTileGridInto`. The tile object's `.element` property points back to this node for single-tile patching.

## External Dependencies

- **Called by:** `GameController` (all game state renders), `js/main.js` (init, menu renders)
- **Imports:** `CONFIG`, `TileEngine` (grid reads), `TILE_BLURBS`, `ENEMY_DEFS`, `ITEMS`, `tileIcons`, `Bestiary`, `TrinketCodex`, `EventBus`
- **Does NOT call:** `GameController`, `CombatResolver`, `MetaProgression`, or any system that mutates game state
