# Cryptic Grids — Project Context for AI Agents

> **Purpose:** This file is a fast-reference guide for AI agents implementing Cryptic Grids.
> Read this before touching any code. It captures rules that are easy to miss and
> patterns that must be consistent across all epics.

---

## What This Game Is

Minesweeper-meets-dungeon-crawler roguelike. Mobile PWA (portrait only). Tap tiles to reveal
enemies/loot/traps. Turn-based combat. Mana pool spell system. Permadeath. Meta-progression
across runs via banked gold and character XP trees.

**Stack:** Vanilla JS + DOM + CSS. No engine, no canvas, no build step.
**Entry point:** `index.html` → `js/main.js` → boot sequence.

---

## Project Structure (where things live)

```
js/
  config.js               ← CONFIG + SETTINGS — all tunable values here
  main.js                 ← boot sequence only
  core/
    GameState.js          ← state machine, transition validation
    GameController.js     ← turn orchestration, calls all systems
    EventBus.js           ← pub/sub (Audio + UI ONLY)
    Logger.js             ← console wrapper
  systems/
    TileEngine.js         ← grid gen, reveal, lock/unlock, onTileTap()
    CombatResolver.js     ← fight/spell/flee resolution
    ProgressionSystem.js  ← XP, level-up, ability choices (in-run)
    MetaProgression.js    ← character XP trees, gold shop (between runs)
    AudioSystem.js        ← Web Audio API, iOS unlock
    Loader.js             ← asset preloading
  data/
    tiles.js              ← tile type definitions + weights (NO functions)
    enemies.js            ← enemy definitions (NO functions)
    abilities.js          ← ability definitions (NO functions)
    items.js              ← item definitions (NO functions)
    characters.js         ← character base stats (NO functions)
  save/
    SaveManager.js        ← IndexedDB wrapper ONLY — no game logic here
  ui/
    UI.js                 ← ALL DOM updates — no game logic here
css/
  main.css, tiles.css, hud.css, overlays.css, animations.css
```

---

## Critical Rules (read these first)

### 1. Never use `setTimeout` for animation timing
```js
// ❌ WRONG
setTimeout(() => resolveEffect(tile), 300)

// ✅ CORRECT — always await animationend
function flipTile(tile) {
  return new Promise(resolve => {
    tile.element.classList.add('revealed')
    tile.element.addEventListener('animationend', resolve, { once: true })
  })
}
async function revealTile(tile) {
  await TileEngine.flipTile(tile)
  resolveEffect(tile)
}
```
**Why:** CSS animation duration is adjusted in CSS only. JS must not encode timing.

---

### 2. All tile taps route through one function
```js
// js/systems/TileEngine.js — the ONLY tap handler
function onTileTap(row, col) {
  const state = GameState.current()
  const tile = grid[row][col]
  if (state === States.FLOOR_EXPLORE) {
    if (!tile.revealed && !tile.locked) GameController.revealTile(tile)
    else if (tile.revealed && tile.enemyData) GameController.initiateCombat(tile)
    // else: ignore silently
  }
  // all other states: ignore silently
}
```
**Why:** No other module attaches tap listeners to tiles. New interactions = new branch here.

---

### 3. Tap the enemy tile to fight (no Fight button)
The revealed enemy tile IS the fight action. In `COMBAT` state, tapping the enemy tile
again triggers the fight action. The action panel shows **Spell** and **Flee** only.
**Why:** Core UX — "Interaction Fidelity First" design pillar.

---

### 4. Module boundaries — never cross these
| Module | Can do | Cannot do |
|--------|--------|-----------|
| `js/systems/*` | Call `UI.*`, emit events, call `SaveManager.*` | Touch DOM directly |
| `js/ui/UI.js` | Update DOM | Any game logic |
| `js/data/*` | Export plain objects | Contain functions or side effects |
| `js/save/SaveManager.js` | IndexedDB operations | Any game logic |
| `js/config.js` | Export constants | Contain functions |
| `EventBus` subscribers | `AudioSystem`, `UI.js` | Any other module |

---

### 5. Entity creation — factory + spread, never `new` or inline stats
```js
// js/data/enemies.js — definitions only
export const ENEMY_DEFS = {
  'skeleton': { hp: 15, dmg: 8, type: 'undead', behaviour: 'standard' },
}

// js/systems/TileEngine.js — factory creates runtime instance
function createEnemy(type) {
  const def = ENEMY_DEFS[type]
  return { ...def, currentHP: def.hp }  // spread = copy, not reference
}
```
**Why:** `{ ...def }` ensures mutations (e.g., HP loss) don't affect the definition.

---

### 6. All async ops use `async/await` + `try/catch`
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
// ❌ No .then() chains. No bare Promises. No callbacks.
```

---

### 7. All game values live in CONFIG — never hardcode numbers inline
```js
// ❌ WRONG
player.hp -= 10

// ✅ CORRECT
player.hp -= CONFIG.trap.damage
```

---

### 8. No console.log — use Logger
```js
Logger.error('[ModuleName] message', err)   // always active
Logger.warn('[ModuleName] message')          // always active
Logger.debug('[ModuleName] message')         // only when CONFIG.debug = true
```

---

## Game State Machine

```js
const States = {
  BOOT:             'boot',
  MENU:             'menu',
  CHARACTER_SELECT: 'char-select',
  FLOOR_EXPLORE:    'floor-explore',
  COMBAT:           'combat',
  LEVEL_UP:         'level-up',
  NPC_INTERACT:     'npc-interact',
  RETREAT_CONFIRM:  'retreat-confirm',
  BETWEEN_RUNS:     'between-runs',
  DEATH:            'death',
}
```
- `GameState.transition(newState)` validates against an allowed-transitions map. Throws on invalid.
- Check `GameState.current()` before any state-dependent action.
- AI agents: never assume current state — always check.

---

## Canonical Event Names (EventBus)

Only emit these. Add new ones to this list AND to `game-architecture.md`.

```
tile:revealed     { tile }
tile:locked       { tiles[] }
tile:unlocked     { tiles[] }
combat:start      { enemy }
combat:damage     { amount, target: 'player'|'enemy' }
combat:spell      { spellName, manaCost }
combat:flee       { hpCost }
combat:end        { outcome: 'victory'|'fled' }
player:levelup    { newLevel }
player:death      { runStats }
player:goldChange { amount, newTotal }
player:hpChange   { amount, newHP }
player:manaChange { amount, newMana }
run:start         { character, difficulty }
run:checkpoint    { goldBanked }
run:retreat       { goldBanked }
run:floorAdvance  { newFloor }
```

---

## Tile Object Shape

```js
{
  row: Number,
  col: Number,
  type: String,          // 'empty'|'enemy'|'gold'|'chest'|'trap'|'shrine'|'npc'|'checkpoint'|'exit'
  revealed: Boolean,
  locked: Boolean,       // true when adjacent enemy is alive and unrevealed
  enemyData: Object|null, // { hp, maxHp, currentHP, dmg, type, behaviour } or null
  itemData: Object|null,
  element: HTMLElement   // DOM ref, assigned at grid render time
}
```

---

## Save Data Shape

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
**Auto-save triggers:** after checkpoint, after retreat, after run end. Never mid-combat.

---

## Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| JS modules | `PascalCase.js` | `TileEngine.js` |
| CSS files | `kebab-case.css` | `tiles.css` |
| Module objects | `PascalCase` | `GameState`, `TileEngine` |
| Functions | `camelCase` | `revealTile()` |
| Constants | `UPPER_SNAKE_CASE` | `CONFIG`, `TILE_DEFS` |
| Event names | `namespace:action` | `'combat:damage'` |
| CSS classes | `kebab-case` | `.tile-revealed` |
| Tile sprites | `tile-{type}.webp` | `tile-enemy.webp` |
| Enemy sprites | `enemy-{name}.webp` | `enemy-skeleton.webp` |
| SFX | `sfx-{name}.mp3` | `sfx-hit.mp3` |

---

## Development Epics (order matters — dependencies enforced)

| # | Epic | Depends On |
|---|------|-----------|
| 1 | Foundation & Core Loop | — |
| 2 | Combat System | 1 |
| 3 | Run Economy | 2 |
| 4 | Meta Progression & Save | 3 |
| 5 | Content — Enemies & Tiles | 2 |
| 6 | Ranger & Second Character | 4 |
| 7 | Difficulty & Polish | 5 |
| 8 | Art & Audio Pass | 7 |
| 9 | PWA & Launch | 8 |

Full epic specs: `_bmad-output/epics.md`
Full architecture: `_bmad-output/game-architecture.md`
GDD: `_bmad-output/gdd.md`

---

## Quick Anti-Pattern Reference

| ❌ Don't | ✅ Do |
|---------|-------|
| `setTimeout(fn, 300)` for animation | `await flipTile(tile)` (animationend) |
| Attach tap listeners to tiles elsewhere | Route through `TileEngine.onTileTap()` |
| `new Enemy()` or inline `{ hp: 15 }` | `createEnemy('skeleton')` from ENEMY_DEFS |
| `document.querySelector()` in systems | `UI.updateHP(current, max)` |
| Systems calling each other directly | Via `GameController` only |
| `console.log()` | `Logger.debug()` / `Logger.error()` |
| Hardcoded numbers | `CONFIG.*` values |
| `indexedDB.open()` outside SaveManager | `await SaveManager.save(data)` |
| `.then()` chains | `async/await` + `try/catch` |
| Functions in `js/data/` files | Plain objects only |
