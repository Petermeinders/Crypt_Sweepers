---
title: 'Game Architecture'
project: 'Game2'
date: '2026-03-31'
author: 'Peter'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'

# Source Documents
gdd: '_bmad-output/gdd.md'
epics: '_bmad-output/epics.md'
brief: '_bmad-output/game-brief.md'
---

# Cryptic Grids - Game Architecture

## Executive Summary

**Cryptic Grids** architecture is designed for Vanilla JS + DOM + CSS targeting mobile PWA (iOS/Android first, desktop supported).

**Key Architectural Decisions:**

- **Explicit State Machine** — 10-state enum with transition validation prevents impossible UI states across all game phases
- **Hybrid Controller + EventBus** — Direct calls for game logic (GameController, CombatController), EventBus for side effects (Audio, UI overlay), eliminating tight coupling between systems
- **Factory Pattern for Entities** — Plain `{ ...def }` object spread for enemies, tiles, and items ensures clean IndexedDB serialization and zero class-inheritance complexity
- **Animated State Transition Contract** — All animations use `animationend` promises (never `setTimeout`), making animation timing reliable and CSS-adjustable without JS changes
- **Tile Tap Router** — Single `onTileTap(row, col)` entry point dispatches all grid interactions based on current game state, making the tap-to-fight and lock mechanic deterministic

**Project Structure:** Feature-module organization with 13 core systems across `js/systems/`, `js/ui/`, and `js/data/`.

**Implementation Patterns:** 8 patterns defined ensuring AI agent consistency across all 9 development epics.

**Ready for:** Epic 1 implementation — Foundation & Core Loop.

---

## Development Environment

### Prerequisites

- Node.js 18+ (for local dev server only — no build step required)
- A modern browser (Chrome/Safari/Firefox/Edge)
- A text editor or IDE with JS support

### AI Tooling (MCP Servers)

The following MCP server was selected during architecture to enhance AI-assisted development:

| MCP Server | Purpose | Install Type |
| ---------- | ------- | ------------ |
| Context7 (`@upstash/context7-mcp`) | Live web API documentation (MDN, IndexedDB, Service Worker, CSS specs) | User-scoped |

**Setup:**

```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp
```

This gives your AI assistant live access to MDN and other web API docs for context-aware code generation when working with IndexedDB, Service Workers, CSS animations, and other browser APIs.

### Setup Commands

```bash
# Clone or create your project directory
cd C:/Users/peter/github/Game2

# Install a simple dev server (optional — any static server works)
npm install -g serve

# Serve the project locally
serve .
# or use VS Code Live Server, Python's http.server, etc.
```

### First Steps

1. Create `index.html` as the entry point with PWA meta tags and viewport settings
2. Create `js/core/GameState.js` — the state machine is the foundation everything else calls into
3. Configure MCP server per the AI Tooling instructions above
4. Create `js/data/CONFIG.js` with all tunable game values before writing any game logic

---

## Document Status

**Architecture Complete** — All 9 workflow steps finished.

---

## Engine & Framework

### Selected Stack

**Vanilla JS + DOM + CSS** — No game engine

**Rationale:** Validated by working prototype on mobile. DOM-native rendering eliminates engine overhead, enables CSS GPU-accelerated animations, and keeps the bundle under 5MB with no build toolchain required. Browser IS the engine.

### Stack-Provided Architecture

| Component | Solution | Notes |
|-----------|----------|-------|
| Rendering | DOM elements + CSS transforms | Browser layout engine handles positioning |
| Animation | CSS transitions + keyframes | GPU compositor path — no JS animation loop |
| Input | touchstart + click events | Unified tap/click model |
| Audio | Web Audio API | Manual context setup required |
| Networking | None | Single-player, no networking needed |
| Build system | None (MVP) | Plain HTML/CSS/JS, no bundler required |
| Deployment | Static file host | GitHub Pages / Netlify / Vercel |

### Project Initialization

No scaffolding command required. Project structure defined manually (see Project Structure section). Served via:

```bash
# Development
npx serve -p 3000

# Deploy
# Push to GitHub → auto-deploy via GitHub Pages / Netlify
```

### Remaining Architectural Decisions

The following must be defined explicitly (addressed in subsequent steps):

- Game state machine pattern and state definitions
- Module/file structure and code organisation
- Inter-module event/communication system
- Grid data model and tile representation
- Combat resolver pattern
- Progression and ability system pattern
- IndexedDB save system wrapper
- Audio system initialisation and management

---

## Architectural Decisions

### Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| State Management | Explicit State Machine | Prevents invalid actions, clear transitions, AI-agent safe |
| Module Communication | Hybrid: Controller + Event Bus | Direct calls for game logic, events for audio/UI reactions |
| Grid Data Model | 2D Array of tile objects | Intuitive indexing, simple adjacency math |
| Data Persistence | SaveManager module (IndexedDB) | Async complexity isolated, single interface for all systems |
| Asset Loading | Preload all on first load | No mid-game hitches, surfaces problems early, service worker caches |
| UI Architecture | Direct DOM via UI module | Right scope for project, explicit, easy to trace and debug |

---

### State Management

**Approach:** Explicit State Machine

A `GameState` module defines all valid states as an enum and enforces valid transitions. Every system checks current state before acting — no action is possible in the wrong state.

**States:**
```js
const States = {
  BOOT:             'boot',            // initial load
  MENU:             'menu',            // main screen
  CHARACTER_SELECT: 'char-select',     // character + difficulty
  FLOOR_EXPLORE:    'floor-explore',   // tapping tiles
  COMBAT:           'combat',          // active fight
  LEVEL_UP:         'level-up',        // ability choice overlay
  NPC_INTERACT:     'npc-interact',    // Goblin Merchant
  RETREAT_CONFIRM:  'retreat-confirm', // Hasty Retreat confirmation
  BETWEEN_RUNS:     'between-runs',    // upgrade shop
  DEATH:            'death',           // run summary
}
```

**Transition validation:** `GameState.transition(newState)` checks against an allowed-transitions map and throws if the transition is invalid. AI agents cannot accidentally skip states.

**Tap routing:** Tile tap handler checks state first:
- `FLOOR_EXPLORE` + hidden tile → reveal
- `FLOOR_EXPLORE` + revealed enemy tile → transition to `COMBAT`
- `COMBAT` + enemy tile → fight action
- Any other state → tap ignored

---

### Module Communication

**Approach:** Hybrid — Game Controller orchestrates + Event Bus for reactions

**Game Controller** owns the state machine and calls game systems directly for all gameplay logic. It is the single source of truth for turn flow.

**Event Bus** is used by Audio and UI systems only — they subscribe to game events and react without being explicitly called by the Controller.

```js
// Controller calls systems directly (gameplay logic):
TileEngine.revealTile(tile)
CombatResolver.processTurn(action)
ProgressionSystem.awardXP(amount)

// Systems emit events that Audio/UI react to:
EventBus.emit('tile:revealed', { tile })
EventBus.emit('combat:damage', { amount, target })
EventBus.emit('player:levelup', { newLevel })

// Audio and UI listen:
EventBus.on('combat:damage', ({ amount }) => AudioSystem.play('hit'))
EventBus.on('player:levelup', () => UI.showLevelUpOverlay())
```

**Rule:** Only Audio and UI systems use the Event Bus. All other cross-system communication goes through the Game Controller.

---

### Grid Data Model

**Approach:** 2D Array of tile objects

```js
// Grid structure
const grid = []  // grid[row][col] = tileObject

// Tile object shape
{
  row: Number,
  col: Number,
  type: String,        // 'empty' | 'enemy' | 'gold' | 'chest' | etc.
  revealed: Boolean,
  locked: Boolean,     // true if adjacent enemy is unrevealed
  enemyData: Object|null,  // { hp, maxHp, dmg, type } or null
  itemData: Object|null,
  element: HTMLElement  // reference to DOM tile element
}
```

**Adjacency helper:**
```js
function getAdjacentTiles(grid, row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  return dirs
    .map(([dr, dc]) => grid[row+dr]?.[col+dc])
    .filter(Boolean)
}
```

**Lock/unlock:** When enemy revealed → call `lockAdjacent(grid, row, col)`. When enemy defeated/fled → call `unlockAdjacent(grid, row, col)`.

---

### Data Persistence

**Approach:** SaveManager module wrapping IndexedDB

A thin async module. All other systems call SaveManager — never IndexedDB directly.

```js
// SaveManager interface
SaveManager.save(saveData)       // auto-save trigger points
SaveManager.load()               // returns save object or null
SaveManager.exportJSON()         // downloads save as .json file
SaveManager.importJSON(string)   // restores from .json string
SaveManager.clear()              // nuclear option (settings screen)
```

**Save data shape:**
```js
{
  version: '1.0',
  lastSaved: timestamp,
  gold: Number,
  characters: {
    warrior: { xp: Number, unlockedAbilities: [], upgrades: {} },
    ranger:  { xp: Number, unlockedAbilities: [], upgrades: {}, unlocked: Boolean }
  },
  shopPurchases: {},
  settings: { difficulty: 'normal', sfxVol: 1, musicVol: 1 }
}
```

**Auto-save triggers:** After checkpoint banking, after Hasty Retreat, after run end (death or exit). Never during active combat or tile reveal.

**Corruption guard:** Save includes a `version` field. On load, if version mismatch or parse error → alert user, offer to reset or import backup.

---

### Asset Loading

**Approach:** Preload all assets on first load

A `Loader` module fetches all sprites and audio on boot, before entering `MENU` state. Shows a simple loading screen with progress indicator.

**Benefits:**
- No hitches during gameplay
- Surfaces missing/broken assets immediately at startup
- Service worker caches all assets after first load — subsequent loads are instant

**Asset manifest:** A single `ASSETS` config object lists all files. Loader iterates it. Adding a new asset = add one line to config.

```js
const ASSETS = {
  sprites: {
    tileBack:  'assets/sprites/tile-back.webp',
    tileEmpty: 'assets/sprites/tile-empty.webp',
    tileEnemy: 'assets/sprites/tile-enemy.webp',
    // ... all tile types
  },
  audio: {
    ambient: 'assets/audio/dungeon-ambient.mp3',
    hit:     'assets/audio/hit.mp3',
    // ... all SFX
  }
}
```

---

### UI Architecture

**Approach:** Direct DOM manipulation via `UI` module

A `UI` module caches all DOM element references at init and exposes named update functions. No framework. No innerHTML re-renders.

```js
// UI module interface
UI.init()                         // cache all element refs
UI.updateHP(current, max)         // update HP bar width + text
UI.updateMana(current, max)       // update mana bar
UI.updateGold(amount)             // update gold counter
UI.showActionPanel(actions)       // show Spell/Flee buttons
UI.hideActionPanel()
UI.showLevelUpOverlay(choices)
UI.hideLevelUpOverlay()
UI.showFloorNumber(n)
UI.showFloatText(text, x, y, type) // damage/gold/xp floats
UI.showDeathScreen(runStats)
UI.showRunSummary(stats)
```

**Rule:** UI module only updates DOM. It contains zero game logic. Game logic never touches DOM directly — always via UI module.

### Development Tools

#### Context7 MCP

Gives AI assistants live access to current web API documentation (MDN, IndexedDB spec, Web Audio API, Service Worker API) instead of relying on training data. Recommended for all AI-assisted work on Web Audio API, IndexedDB, and PWA APIs.

**Package:** `@upstash/context7-mcp`
**Install (Claude Code):**
```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp
```
**API key:** Free tier available at context7.com/dashboard (recommended for higher rate limits)
**Requirements:** Node.js 18+

---

## Cross-cutting Concerns

These patterns apply to ALL systems and must be followed by every implementation.

### Error Handling

**Strategy:** Two-tier — critical errors surface to user, game logic errors log and recover gracefully. The game never crashes silently and never crashes without giving the player a path forward.

**Tier 1 — Critical Errors** (SaveManager, asset loading, IndexedDB):
```js
try {
  await SaveManager.save(data)
} catch (err) {
  Logger.error('[SaveManager] Write failed', err)
  UI.showError('Save failed — export your save file as backup.')
  // Game continues — data loss is not a crash condition
}
```

**Tier 2 — Game Logic Errors** (invalid state, unexpected tile type):
```js
if (!States[newState]) {
  Logger.error('[GameState] Invalid transition attempted:', newState)
  return // defensive — do not transition, do not crash
}
```

**Rules:**
- Every `async` function that touches IndexedDB or the file system uses `try/catch`
- Game logic errors log and return — never `throw` into the game loop
- Player-visible errors use `UI.showError(message)` — never raw `alert()`
- Never swallow errors silently — always `Logger.error()`

---

### Logging

**Module:** Single `Logger` wrapper around `console`.
**Format:** `[ModuleName] message` — consistent prefix for filtering.
**Debug gate:** `CONFIG.debug` flag — debug/trace logs only fire when true.

```js
// Always active
Logger.error('[SaveManager] IndexedDB write failed', err)
Logger.warn('[AudioSystem] Audio context not yet unlocked')

// Debug mode only (CONFIG.debug = true)
Logger.debug('[GameState] transition: floor-explore → combat')
Logger.debug('[TileEngine] Tile revealed at [2,3]: enemy')
```

**Rules:**
- All module logs prefixed with `[ModuleName]`
- `Logger.error()` for caught exceptions and unexpected states
- `Logger.warn()` for handled but unexpected conditions
- `Logger.debug()` for state transitions, turn resolution, game events
- No `console.log()` calls directly — always via `Logger`
- `CONFIG.debug = false` in production — all debug logs silenced

---

### Configuration

**Two-layer config pattern:**

**Layer 1 — `CONFIG`** (gameplay balancing, never persisted):
```js
const CONFIG = {
  debug: false,

  player: {
    baseHP: 100,
    baseMana: 60,
    baseDamage: 1,
    manaRegenPerTile: 3,
  },

  xp: {
    perTileReveal: 10,
    levelUpThresholds: [100, 250, 450, 700],
  },

  retreat: {
    goldPercent: 0.20,
  },

  tiles: {
    weights: {
      empty: 30, enemy: 25, gold: 15, chest: 10,
      trap: 8, shrine: 5, npc: 4, checkpoint: 3,
    }
  },

  audio: {
    musicVolume: 0.5,
    sfxVolume: 0.8,
  }
}
```

**Layer 2 — `SETTINGS`** (player preferences, persisted via SaveManager):
```js
// Defaults — overwritten by SaveManager.load() on boot
const SETTINGS = {
  difficulty: 'normal',
  musicVolume: 0.5,
  sfxVolume: 0.8,
}
```

**Rules:**
- Gameplay numbers live in `CONFIG` — never hardcoded inline
- Player preferences live in `SETTINGS` — always loaded from save on boot
- `CONFIG.debug = true` enables all debug tooling — never ship as true

---

### Event System

**Pattern:** String-based synchronous Event Bus
**Scope:** Audio and UI systems only
**Naming convention:** `namespace:action` — lowercase, colon-separated

**Canonical event names:**
```js
// Tile events
'tile:revealed'        // { tile }
'tile:locked'          // { tiles[] }
'tile:unlocked'        // { tiles[] }

// Combat events
'combat:start'         // { enemy }
'combat:damage'        // { amount, target: 'player'|'enemy' }
'combat:spell'         // { spellName, manaCost }
'combat:flee'          // { hpCost }
'combat:end'           // { outcome: 'victory'|'fled' }

// Player events
'player:levelup'       // { newLevel }
'player:death'         // { runStats }
'player:goldChange'    // { amount, newTotal }
'player:hpChange'      // { amount, newHP }
'player:manaChange'    // { amount, newMana }

// Run events
'run:start'            // { character, difficulty }
'run:checkpoint'       // { goldBanked }
'run:retreat'          // { goldBanked }
'run:floorAdvance'     // { newFloor }
```

**Rules:**
- Only AudioSystem and UI subscribe to events
- Game Controller emits events after resolving game logic — never before
- Events are synchronous — no async listeners
- New events must be added to the canonical list above

---

### Debug Tools

**Activation:** `CONFIG.debug = true` in `config.js`

**Debug overlay:** Long-press on floor indicator (mobile) or `` ` `` key (desktop). Shows: current game state, floor number, player stats, grid data dump, last 10 events.

**Console cheat commands** (debug mode only):
```js
Game.cheat.maxGold()           // set gold to 9999
Game.cheat.fullHP()            // restore player to max HP/mana
Game.cheat.skipToFloor(n)      // jump to floor n
Game.cheat.killAllEnemies()    // defeat all revealed enemies
Game.cheat.triggerLevelUp()    // force level-up overlay
Game.cheat.unlockAll()         // unlock all characters/upgrades
```

**Rules:**
- All cheat/debug code gated behind `if (CONFIG.debug)` — never active in production
- Debug overlay does not affect game state — read-only
- Cheat commands log their action via `Logger.debug()`

---

## Project Structure

### Organization Pattern

**Pattern:** By Type at root, by System within `js/`

**Rationale:** Standard web project conventions at root (index.html, manifest, service worker). JS organised by system so AI agents know exactly where each module lives. No build toolchain means flat, navigable structure.

### Directory Structure

```
cryptic-grids/
├── index.html                  # Single HTML entry point
├── manifest.json               # PWA manifest
├── sw.js                       # Service worker (offline cache)
├── css/
│   ├── main.css                # Layout, variables, base styles
│   ├── tiles.css               # Tile grid + flip animations
│   ├── hud.css                 # HUD + action panel styles
│   ├── overlays.css            # Level-up, death, menus
│   └── animations.css          # Keyframes (float text, shake, pulse)
├── js/
│   ├── config.js               # CONFIG + SETTINGS constants
│   ├── main.js                 # Entry point — boot sequence
│   ├── core/
│   │   ├── GameState.js        # State machine + transition map
│   │   ├── GameController.js   # Turn orchestration, system calls
│   │   ├── EventBus.js         # Pub/sub (Audio + UI only)
│   │   └── Logger.js           # Logging wrapper
│   ├── systems/
│   │   ├── TileEngine.js       # Grid generation, reveal, lock/unlock
│   │   ├── CombatResolver.js   # Turn-based combat logic
│   │   ├── ProgressionSystem.js # XP, level-up, ability choices
│   │   ├── MetaProgression.js  # Character XP trees, gold shop, unlocks
│   │   ├── AudioSystem.js      # Web Audio API, iOS unlock, SFX/music
│   │   └── Loader.js           # Asset preloading, progress tracking
│   ├── data/
│   │   ├── tiles.js            # Tile type definitions + weights
│   │   ├── enemies.js          # Enemy definitions (stats, type, behaviour)
│   │   ├── abilities.js        # Ability definitions per character
│   │   ├── items.js            # Item definitions (consumable/equip/passive)
│   │   └── characters.js       # Character base stats + unique mechanics
│   ├── save/
│   │   └── SaveManager.js      # IndexedDB wrapper, export/import JSON
│   └── ui/
│       └── UI.js               # DOM update functions, element cache
├── assets/
│   ├── sprites/
│   │   ├── tiles/              # tile-back.webp, tile-empty.webp, etc.
│   │   ├── enemies/            # enemy-skeleton.webp, enemy-goblin.webp, etc.
│   │   └── characters/         # char-warrior.webp, char-ranger.webp
│   └── audio/
│       ├── music/              # music-dungeon-ambient.mp3, music-boss-floor.mp3
│       └── sfx/                # sfx-hit.mp3, sfx-spell.mp3, sfx-gold.mp3, etc.
└── _bmad-output/               # Design docs (not shipped)
```

### System Location Mapping

| System | File | Responsibility |
|--------|------|----------------|
| Game State Machine | `js/core/GameState.js` | State enum, transition validation |
| Turn Orchestration | `js/core/GameController.js` | Calls systems, drives game loop |
| Event Bus | `js/core/EventBus.js` | Pub/sub for Audio + UI |
| Logging | `js/core/Logger.js` | Console wrapper, debug gate |
| Configuration | `js/config.js` | CONFIG + SETTINGS objects |
| Grid + Tiles | `js/systems/TileEngine.js` | Generate, reveal, lock, unlock |
| Combat | `js/systems/CombatResolver.js` | Fight, spell, flee resolution |
| In-run Progression | `js/systems/ProgressionSystem.js` | XP, level-up, ability tree |
| Meta Progression | `js/systems/MetaProgression.js` | Character XP, gold shop, unlocks |
| Audio | `js/systems/AudioSystem.js` | Web Audio API, all sound playback |
| Asset Loading | `js/systems/Loader.js` | Preload all assets, progress screen |
| Save / Load | `js/save/SaveManager.js` | IndexedDB, export/import |
| UI / DOM | `js/ui/UI.js` | All DOM updates, element cache |
| Tile Data | `js/data/tiles.js` | Type definitions, tile weights |
| Enemy Data | `js/data/enemies.js` | Stats, types, behaviours |
| Ability Data | `js/data/abilities.js` | Ability definitions per character |
| Item Data | `js/data/items.js` | Item types, effects, rarity |
| Character Data | `js/data/characters.js` | Base stats, unique mechanics |

### Naming Conventions

#### Files
- JS modules: `PascalCase.js` — matches the class/object they export (`GameState.js`, `TileEngine.js`)
- CSS files: `kebab-case.css` — matches their concern (`tiles.css`, `hud.css`)
- Assets: `kebab-case.ext` — descriptive, type-prefixed (`tile-enemy.webp`, `sfx-hit.mp3`)

#### Code Elements

| Element | Convention | Example |
|---------|------------|---------|
| Module objects | PascalCase | `GameState`, `TileEngine` |
| Functions | camelCase | `revealTile()`, `processTurn()` |
| Variables | camelCase | `currentFloor`, `playerHP` |
| Constants | UPPER_SNAKE_CASE | `CONFIG`, `States`, `ASSETS` |
| Event names | `namespace:action` | `'combat:damage'`, `'tile:revealed'` |
| CSS classes | `kebab-case` | `.tile-revealed`, `.action-panel` |
| Data IDs | `kebab-case` string | `'enemy-skeleton'`, `'tile-chest'` |

#### Asset Naming

- Tile sprites: `tile-{type}.webp` (e.g. `tile-enemy.webp`, `tile-chest.webp`)
- Enemy sprites: `enemy-{name}.webp` (e.g. `enemy-skeleton.webp`)
- Character sprites: `char-{name}.webp` (e.g. `char-warrior.webp`)
- Music: `music-{name}.mp3` (e.g. `music-dungeon-ambient.mp3`)
- SFX: `sfx-{name}.mp3` (e.g. `sfx-hit.mp3`, `sfx-tile-flip.mp3`)

### Architectural Boundaries

**Rules AI agents must follow:**

1. `js/core/` — no gameplay logic. State transitions and infrastructure only.
2. `js/systems/` — no DOM manipulation. Call `UI.*` for any display updates.
3. `js/ui/UI.js` — no game logic. DOM updates only.
4. `js/data/` — no functions, no side effects. Plain data objects only.
5. `js/save/SaveManager.js` — no game logic. Storage operations only.
6. `js/config.js` — no functions. Constants only.
7. EventBus subscribers: AudioSystem and UI.js only. No other module subscribes.
8. IndexedDB: never called directly outside `SaveManager.js`.

---

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents.

### Novel Patterns

#### 1. Tile Tap Router

**Purpose:** Single canonical handler for all tile tap interactions. Prevents
AI agents implementing tap logic in multiple places with conflicting behaviour.

**Rule:** One function in `TileEngine.js` handles all tile taps. No other
module attaches tap listeners to tiles.

```js
// js/systems/TileEngine.js
function onTileTap(row, col) {
  const state = GameState.current()
  const tile = grid[row][col]

  if (state === States.FLOOR_EXPLORE) {
    if (!tile.revealed && !tile.locked) {
      GameController.revealTile(tile)       // hidden tile → reveal
    } else if (tile.revealed && tile.enemyData) {
      GameController.initiateCombat(tile)   // revealed enemy → fight
    }
    // revealed non-enemy or locked → ignore silently
  }
  // all other states → tap ignored
}
```

**When to use:** Any new tap interaction on the grid goes through this function.
Add new branches here — never attach new listeners to tile elements.

---

#### 2. Animated State Transition

**Purpose:** Ensures game logic waits for CSS animations to complete before
resolving effects. Prevents race conditions between visual feedback and state.

**Rule:** All tile flip → effect sequences use `await flipTile()`. Never use
`setTimeout` for animation timing.

```js
// js/systems/TileEngine.js
function flipTile(tile) {
  return new Promise(resolve => {
    tile.element.classList.add('revealed')
    tile.element.addEventListener('animationend', resolve, { once: true })
  })
}

// js/core/GameController.js
async function revealTile(tile) {
  await TileEngine.flipTile(tile)   // wait for CSS flip (~300ms)
  resolveEffect(tile)               // then resolve effect
  EventBus.emit('tile:revealed', { tile })
}
```

**When to use:** Any sequence where a CSS animation must complete before game
state advances. Pattern: `await animatedAction()` then `resolveLogic()`.

---

#### 3. Data-Driven Factory Pattern

**Purpose:** All game entities (enemies, tiles, items) created from data
definitions via factory functions. Guarantees consistent object shape across
all AI agent implementations.

**Rule:** Data files (`js/data/`) contain plain definition objects only — no
functions, no constructors. Factory functions in system files create runtime
instances via object spread.

```js
// js/data/enemies.js — definitions only, no functions
export const ENEMY_DEFS = {
  'skeleton': { hp: 15, dmg: 8,  type: 'undead',   behaviour: 'standard' },
  'goblin':   { hp: 10, dmg: 5,  type: 'humanoid', behaviour: 'fast'     },
  'troll':    { hp: 30, dmg: 12, type: 'humanoid', behaviour: 'standard' },
  'wraith':   { hp: 20, dmg: 10, type: 'undead',   behaviour: 'standard' },
}

// js/systems/TileEngine.js — factory creates runtime instance
function createEnemy(type) {
  const def = ENEMY_DEFS[type]
  return { ...def, currentHP: def.hp }  // spread copies, adds runtime state
}

// js/systems/TileEngine.js — tile factory
function createTile(type, row, col) {
  const def = TILE_DEFS[type]
  return {
    row, col, type,
    revealed: false,
    locked: false,
    enemyData: def.isEnemy ? createEnemy(def.enemyType) : null,
    itemData: null,
    element: null,   // assigned when DOM element is created
  }
}
```

**Why spread matters:** `{ ...def }` copies the definition — mutating one
enemy's `currentHP` does not affect the definition or other enemies.

**When to use:** Any time a game entity is instantiated from a data definition.
Never inline stats. Never `new`. Always factory function + data file.

---

### Standard Patterns

#### Component Communication

**Pattern:** Game Controller calls systems directly for gameplay logic.
EventBus for Audio + UI reactions only.

```js
// ✅ Correct — Controller calls system directly
GameController → CombatResolver.processTurn(action)
GameController → ProgressionSystem.awardXP(amount)

// ✅ Correct — emit event after logic resolves
EventBus.emit('combat:damage', { amount, target })

// ❌ Wrong — system calling another system directly
CombatResolver → ProgressionSystem.awardXP()  // never do this
```

#### Data Access

**Pattern:** Direct ES module import of data files. No data manager layer.

```js
// ✅ Correct
import { ENEMY_DEFS } from '../data/enemies.js'
import { TILE_DEFS }  from '../data/tiles.js'

// ❌ Wrong — no wrapper or manager needed
DataManager.get('enemies')
```

#### Async Operations

**Pattern:** All IndexedDB operations are `async/await` with `try/catch`.
All animation sequences `await` the `animationend` promise. No `.then()`
chains, no callbacks, no bare Promises.

```js
// ✅ Correct
async function saveAndContinue() {
  try {
    await SaveManager.save(buildSaveData())
  } catch (err) {
    Logger.error('[GameController] Save failed', err)
    UI.showError('Save failed — export your save as backup.')
  }
}

// ❌ Wrong
SaveManager.save(data).then(() => ...).catch(() => ...)
```

### Consistency Rules

| Pattern | Rule | Violation |
|---------|------|-----------|
| Tile taps | All routing in `TileEngine.onTileTap()` | Adding tap listeners elsewhere |
| Animation timing | `await flipTile()` — never `setTimeout` | `setTimeout(resolve, 300)` |
| Entity creation | Factory function + data spread | Inline stats or `new ClassName()` |
| Data files | Definitions only, no functions | Adding methods to data files |
| Async | `async/await` + `try/catch` | `.then()` chains or bare Promises |
| Cross-system calls | Via GameController only | Systems calling each other directly |
| DOM updates | Via `UI.*` only | `document.querySelector()` in system files |

---

## Project Context

### Game Overview

**Cryptic Grids** — A minesweeper-meets-dungeon-crawler roguelike PWA.
Players explore a procedurally generated grid, tapping hidden tiles to reveal
enemies, loot, traps, and NPCs. Turn-based combat with a mana pool spell system,
permadeath, and meta-progression across runs.

### Technical Scope

**Platform:** PWA — Mobile Web (iOS Safari / Android Chrome), portrait only
**Secondary:** Desktop browser (same codebase, fixed 480px column)
**Genre:** Roguelike dungeon crawler
**Stack:** Vanilla JS + DOM + CSS — no game engine, no canvas, no WebGL
**Project Level:** Medium complexity — novel DOM-as-game-renderer approach, validated by prototype

### Core Systems

| System | Complexity | Notes |
|--------|------------|-------|
| Tile Engine (grid generation + reveal) | Medium | CSS 3D flip, weighted random, adjacency locking |
| Combat Resolver | Medium | Turn-based state machine, enemy-first, mana cost |
| Game State Machine | High | Manages: menu / floor / combat / level-up / retreat / death |
| Procedural Generation | Medium | Weighted tile placement, floor-depth scaling |
| Progression System (in-run) | Medium | XP → level-up → ability choice |
| Meta Progression | Medium | IndexedDB persistence, character XP trees, gold shop |
| Save System | High | IndexedDB, auto-save, export/import JSON, corruption prevention |
| Audio System | Low | Web Audio API, iOS first-touch activation, looping ambient |
| PWA Infrastructure | Low | Service worker, manifest, offline cache |
| UI / HUD | Low | CSS-rendered for MVP, DOM elements |

### Technical Requirements

- **Frame rate:** 60fps consistent — all animation via CSS transitions/keyframes (GPU path)
- **Load time:** Under 3s first load, under 5s max
- **Bundle size:** Under 5MB total including assets
- **Offline:** Full gameplay offline via service worker
- **Persistence:** IndexedDB — survives browser restarts, more robust than localStorage
- **No backend:** Single-player only, all state local
- **Portrait only:** CSS orientation lock + manifest
- **Audio:** Web Audio API with iOS first-touch unlock pattern

### Complexity Drivers

**High Complexity:**
- **Game State Machine** — the central nervous system. Many states (menu, floor exploration, combat, level-up choice, NPC interaction, retreat, death, between-runs). Transitions must be clean and predictable for AI agents.
- **Save System** — IndexedDB async API, export/import JSON, auto-save triggers, corruption guard. Must be robust against iOS storage events.

**Novel Concepts (no standard patterns):**
- **DOM as game renderer** — tiles are real DOM elements with CSS 3D transforms, not canvas sprites. Layout, touch events, and animation all DOM-native.
- **Adjacency lock system** — enemy reveal locks surrounding tiles. Requires spatial awareness on a grid model, not a physics world.
- **Tap-to-fight UX** — no separate fight button. The revealed enemy tile IS the fight action. State machine must handle "tap on revealed enemy" as a distinct interaction from "tap on hidden tile."

**Technical Risks:**
- **iOS Safari audio:** Requires user gesture before any sound plays. Pattern: unlock audio context on first tap, queue all subsequent sounds.
- **IndexedDB async in game loop:** Save operations are async — must not block turn resolution. Fire-and-forget with error handling.
- **CSS animation + DOM manipulation timing:** Tile flip animation (~300ms) must complete before game state resolves. Requires animation event listeners, not arbitrary timeouts.
- **PWA storage quota:** iOS limits PWA storage — mitigated by export/import save feature and IndexedDB (higher quota than localStorage).

### Technical Risks Summary

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| iOS audio blocked | High (known) | First-touch unlock pattern |
| IndexedDB async blocking turns | Medium | Fire-and-forget save, error boundaries |
| CSS animation/state timing mismatch | Medium | animationend events, not setTimeout |
| iOS storage purge | Low-Medium | IndexedDB + export/import save |
| Tile layout break on edge devices | Low | Fixed max-width 480px column |
