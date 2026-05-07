# CLAUDE.md — Crypt Sweepers

Crypt Sweepers is a minesweeper-style dungeon-crawler PWA. Players reveal tiles on procedurally generated floors, fight enemies in turn-based combat, collect trinkets, and spend persistent gold on hero unlocks and passive upgrades across runs. No bundler, no framework — vanilla ES6 modules served directly from the file system.

## Architecture

```
index.html
  └─ js/main.js              boot, menus, hero select, shop
       └─ js/core/GameController.js   master orchestrator
            ├─ js/core/GameState.js   state machine (floor-explore ↔ combat → level-up → death)
            ├─ js/systems/TileEngine.js    grid model, generation, enemy/loot spawn
            ├─ js/systems/CombatResolver.js  pure damage math, no DOM
            ├─ js/ui/UI.js            all DOM writes; never calls back into game logic
            ├─ js/save/SaveManager.js IndexedDB load/save/export/import
            ├─ js/core/AudioManager.js    subscribes to EventBus for sfx/music
            └─ js/core/EventBus.js    narrow pub/sub (audio + UI cross-cutting only)
```

Data files (`js/data/`) are plain JS object exports — no class instances, no runtime mutation.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | Vanilla ES6 modules |
| Persistence | IndexedDB (via SaveManager) |
| Offline | Service Worker (`sw.js`) |
| Testing | Node built-in test runner + Playwright |
| Balance tooling | Node scripts + `canvas` + `gif-encoder-2` |
| Dev deps | `sharp`, `playwright` |
| Serve | `serve@14` (npx, no install needed) |

## Commands

| Task | Command |
|------|---------|
| Run locally | `npm start` → http://localhost:3456 |
| Unit tests | `npm test` |
| Balance report | `npm run balance-report` |
| Balance bot (batch) | `npm run balance-bot` |
| Balance bot (once) | `npm run balance-bot:once` |

No build step. **Bump `CACHE_NAME` in `sw.js`** on every deploy so clients pick up changes.

## Conventions

- **UI is write-only from game logic.** `GameController` calls `UI.*`; UI never calls back into game logic.
- **Audio always via EventBus.** `EventBus.emit('audio:play', { sfx: '...' })` — never direct calls to AudioManager.
- **Data files are inert.** `js/data/*.js` are static exports. No instances, no mutation.
- **State transitions are declared.** `GameState.js` has an explicit `TRANSITIONS` map; invalid transitions are rejected and logged.
- **Single tile patching.** `GameController.patchMainGridTileAt()` updates one tile's DOM without a full re-render. The tile object carries a `.element` back-reference for this purpose.
- **Active grid abstraction.** `_getActiveTiles()` / `_getActiveTileRows()` return either the main grid or the active sub-floor — abilities and combat use this and work identically in both.
- **No error handling for internal invariants.** Game logic trusts its own state; defensive checks only at save/load boundaries.

## Context Tree

- @js/AGENTS.md — subdirectory map + config notes; imports all child AGENTS.md files
- @css/AGENTS.md — CSS architecture, custom properties, theming pattern
- @tests/AGENTS.md — test framework, snapshot fixture, regeneration instructions
- @scripts/AGENTS.md — headless balance bot runner, env vars, output artifacts

## BMAD Overrides

When working on this codebase:

1. **Read before touching data files.** Enemy/item stat changes have cascading balance effects — run `npm run balance-report` after edits to `js/data/`.
2. **Never add DOM logic to non-UI files.** If game logic needs a visual effect, emit an event or call a `UI.*` method.
3. **State machine first.** New game phases must be wired into `GameState.js` transitions before any other code is written.
4. **Bump the service worker cache version** (`sw.js` → `CACHE_NAME`) on every change that affects served assets, or browsers will serve stale files.
5. **Keep data files as plain objects.** Resist adding methods or class instances to `js/data/` exports.
