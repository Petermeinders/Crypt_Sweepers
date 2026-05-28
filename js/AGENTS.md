# AGENTS.md — js/

The `js/` directory contains all game source code. Two files live at this level; the rest is organized into subdirectories by responsibility.

## Key Files at This Level

| File | Purpose |
|------|---------|
| `main.js` | Thin entry point. Hero carousel, service worker registration, delegates to `boot/boot.js`. |
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
| `ui/menus/` | Menu panel modules — each exports `wireX(ctx)`; listeners call `GameController.*` only |
| `main/` | Shell wiring — HUD, menus, keyboard |
| `data/` | Static content — enemies, items, tiles, upgrades, abilities |
| `save/` | IndexedDB persistence wrapper |
| `balance/` | Static analysis, telemetry shapes, balance targets |
| `boot/` | Save migration, dev URL tooling, boot orchestration, persistence listeners |
| `controllers/` | Extracted GameController domains (tile tap router, cheats, balance-bot bridge) — wired via deps, no GameController imports |
| `heroes/` | Per-hero active ability modules — ctx from GameController, session via RunContext |
| `lib/` | Third-party vendored libraries (Matter.js, omggif.js) |

## js/main/

| File | Purpose |
|------|---------|
| `wireHud.js` | In-run HUD: resume prompt, ability hold-to-inspect, retreat, cheat stat boosts |
| `wireMenus.js` | Main menu overlays, export/import, PWA nudge; delegates to `ui/menus/*` panels |
| `wireKeyboard.js` | Keyboard shortcuts (stub — extend as bindings are added) |

## js/ui/menus/

| File | Purpose |
|------|---------|
| `shared.js` | `metaCharSave`, `heroIsGoldLocked` helpers shared by hero select |
| `HeroSelect.js` | Hero carousel, upgrade grid, unlock/select |
| `GoldShopPanel.js` | Persistent gold shop + global passive upgrades |
| `BlacksmithPanel.js` | Gear upgrade, disassemble, detriment reduction |
| `BackpackPanel.js` | Inventory render, full-backpack pickup flows |
| `EquipmentOverlay.js` | Equipped gear slots + compare/equip modal |
| `SettingsPanel.js` | Settings toggles, cheats, delete save |
| `Changelog.js` | Latest updates overlay content |

## Context Tree

- @js/core/AGENTS.md
- @js/systems/AGENTS.md
- @js/ui/AGENTS.md
- @js/data/AGENTS.md
- @js/save/AGENTS.md
- @js/balance/AGENTS.md
- @js/boot/AGENTS.md
- @js/controllers/AGENTS.md
- @js/heroes/AGENTS.md
