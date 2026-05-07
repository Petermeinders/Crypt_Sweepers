# AGENTS.md — js/

The `js/` directory contains all game source code. Two files live at this level; the rest is organized into subdirectories by responsibility.

## Key Files at This Level

| File | Purpose |
|------|---------|
| `main.js` | Entry point. Bootstraps `AudioManager`, `UI`, and `GameController` on DOM ready. Wires all top-level event listeners (menu buttons, settings, keyboard shortcuts). Conditionally imports balance-bot modules based on URL params. |
| `config.js` | Exports `CONFIG` (all tunable gameplay constants) and `SETTINGS` (player preferences, overwritten by `SaveManager` on boot). The authoritative source for all magic numbers. |

## CONFIG Notes

`CONFIG` contains helper methods alongside plain values:
- `CONFIG.gridSize(floor, opts)` — returns `{ cols, rows }` for a given floor
- `CONFIG.biomeFor(floor)` — returns the biome object
- `CONFIG.floorBackgroundFor(floor)` — returns the background image path

`SETTINGS` is a mutable object shared with `AudioManager`. `SaveManager` overwrites it on load.

## Subdirectory Map

| Directory | Role |
|-----------|------|
| `core/` | Game orchestrator, state machine, event bus, logger |
| `systems/` | Game systems (tile engine, combat, progression, audio, etc.) |
| `ui/` | All DOM writes; zero game logic |
| `data/` | Static content — enemies, items, tiles, upgrades, abilities |
| `save/` | IndexedDB persistence wrapper |
| `balance/` | Static analysis, telemetry shapes, balance targets |
| `dev/` | In-browser balance bot (URL-param activated only) |
| `lib/` | Third-party vendored libraries (Matter.js) |

## Context Tree

- @js/core/AGENTS.md
- @js/systems/AGENTS.md
- @js/ui/AGENTS.md
- @js/data/AGENTS.md
- @js/save/AGENTS.md
- @js/balance/AGENTS.md
- @js/dev/AGENTS.md
