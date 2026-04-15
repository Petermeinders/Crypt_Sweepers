# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
npm start        # serves at http://localhost:3456
npm test         # unit tests via Node's built-in test runner
```

No build step — pure ES6 modules served directly. The service worker (`sw.js`) caches assets; **bump `CACHE_NAME`** (e.g. `v209` → `v210`) on every deploy so clients pick up changes.

## Architecture Overview

**Crypt Sweepers** is a minesweeper-style dungeon-crawler PWA. No bundler, no framework — vanilla JS ES6 modules + IndexedDB + a service worker.

### Data Flow

```
main.js (boot, menus, hero select)
  └─ GameController.js  ← master orchestrator
       ├─ GameState.js  (state machine: floor-explore → combat → level-up → death …)
       ├─ TileEngine.js (grid generation, tile/enemy spawn, loot pools)
       ├─ CombatResolver.js (pure math — no DOM, no side effects)
       ├─ UI.js         (all DOM writes; zero game logic)
       ├─ SaveManager.js (IndexedDB: load/save/export/import)
       ├─ AudioManager.js (subscribes to EventBus for sfx/music)
       └─ EventBus.js   (narrow pub/sub — used mainly by Audio & UI)
```

### Key Patterns

- **UI is write-only from game logic.** GameController calls `UI.*` methods; UI never calls back into GameController directly.
- **EventBus for cross-cutting concerns.** Audio is always triggered via `EventBus.emit('audio:play', { sfx: 'hit' })`, never called directly.
- **Data files are plain objects.** Enemy stats (`enemies.js`), items (`items.js`), tile defs (`tiles.js`), abilities, and upgrades are static JS exports — no class instances.
- **TileEngine owns the grid model.** Tiles are plain objects `{ row, col, type, revealed, locked, reachable, enemyData, element }`. The `.element` back-reference lets GameController patch single tiles without full re-renders via `patchMainGridTileAt()`.
- **Active grid abstraction.** `_getActiveTiles()` / `_getActiveTileRows()` return either the main grid or the active sub-floor grid, so abilities and combat work identically in both contexts.

### State Machine

States live in `GameState.js`. Valid transitions are declared in a `TRANSITIONS` map — invalid transitions are rejected and logged. Primary states: `boot → menu → floor-explore ↔ combat → level-up → death → between-runs → menu`.

### Sub-floors

Triggered by a `sub_floor_entry` tile. Types: `mob_den`, `boss_vault`, `treasure_vault`, `shrine`, `ambush`, `collapsed_tunnel`, `cartographers_cache`, `toxic_gas`. Generated in `TileEngine.generateSubFloor()`, rendered by `UI.showSubFloor()` using the shared `TileEngine.renderTileGridInto()` renderer. Sub-floor tiles use the same tile object shape as main grid tiles.

### Floor Theming

Every 5 floors is a new biome (dungeon → jungle → frozen → volcanic → catacombs → corrupted → sunken → mushroom → crystal → shadow → infernal). Biome config drives which enemies spawn and which background image `UI.applyFloorTheme()` applies.

### Enemy Spawn Rules

`TileEngine._pickEnemyType(floor, tileType)` filters `enemies.js` by biome (`spawn: 'universal'` or a biome list) and behaviour (`'boss'` only on boss tiles, `'fast'` only on `enemy_fast` tiles, `'archer'` never via normal spawn — only via `_spawnArcherGoblin()`).

### Meta-Progression

Persistent gold (earned each run, survives death) buys character unlocks and passive upgrades. Per-character ability upgrades are purchased between runs from the hero select screen. All stored in IndexedDB via `SaveManager`.

## File Map

| Path | Role |
|------|------|
| `js/main.js` | Boot, menus, hero select, backpack UI, shop |
| `js/core/GameController.js` | Game loop, tile reveals, combat routing, floor transitions |
| `js/systems/TileEngine.js` | Grid model, tile/enemy factories, loot pools, sub-floor generators |
| `js/systems/CombatResolver.js` | Damage formulas, status effects (pure functions) |
| `js/ui/UI.js` | All DOM updates; element cache initialized at boot |
| `js/config.js` | All tunable constants (grid sizes, scaling rates, spawn chances) |
| `js/data/enemies.js` | Enemy stat definitions |
| `js/data/items.js` | Trinket/potion definitions (40+ items) |
| `js/data/tiles.js` | Tile type definitions and weights |
| `js/data/tileIcons.js` | Sprite path map for enemies and tile types |
| `js/data/abilities.js` | Warrior ability tree |
| `js/data/ranger.js` | Ranger stats and ability tree |
| `js/save/SaveManager.js` | IndexedDB wrapper |
| `sw.js` | Service worker — bump `CACHE_NAME` on every deploy |
| `css/tiles.css` | Tile grid cells, type variants, reveal animations |
| `css/hud.css` | HUD bar, action panel, ability buttons |
| `css/overlays.css` | All modals and panels |
| `css/animations.css` | Keyframe animations |
