# AGENTS.md — js/dev/

The dev directory contains in-browser automation tools for balance testing. These modules are loaded conditionally based on URL parameters (e.g. `?balanceBot=1`) and are never bundled into normal gameplay.

## Key Files

| File | Purpose |
|------|---------|
| `balanceBotAutopilot.js` | Core bot engine. Runs a `setInterval` tick loop that simulates legal player actions: tap unrevealed tiles, handle combat, dismiss overlays, choose level-up abilities, buy merchant items. Handles stall/deadlock recovery. Entry point: `startBalanceBotAutopilot(opts)`. |
| `balanceBotSavePresets.js` | `applyBalanceBotSavePreset(save, preset, hero)` — one-shot save mutations for `'beginner'` (no meta upgrades) and `'end'` (all upgrades) spectrum tests. Applied to the live save before a run starts. |
| `testBotOngoing.js` | Thin wrapper around `balanceBotAutopilot` with `testBotOngoing: true`. Uses the real save (no wipe), spends gold/XP before each run, and retreats at low HP. Entry point: `startTestBotOngoing(opts)`. |
| `testBotOngoingMeta.js` | `applyTestBotOngoingMetaPurchases(save)` — called by the ongoing bot before each run to greedily spend persistent gold on global passives and XP on per-hero upgrades. |

## Patterns

- **Activated by URL params only.** `js/main.js` checks `?balanceBot=1` / `?testBotOngoing=1` and imports these modules dynamically. They are never imported at startup in normal play.
- **Bot tick interval is 80ms.** Each tick checks `GameState.current()` and takes one action. Deadlock detection counters (`stuckNoTapTicks`, `modalWaitTicks`, etc.) increment when no progress is made and trigger recovery actions (retreat, force-close overlays) after thresholds.
- **Results land on `window.__balanceBotRuns`** (array of run telemetry records) and `window.__balanceBotReport` (aggregate). The headless script (`scripts/balance-bot-batch.mjs`) polls for these via Playwright's `page.evaluate()`.
- **Console log tags:** `[bot:tick]`, `[bot:tap]`, `[bot:levelup]`, `[bot:stuck]`, `[bot:run]` — filter by these to debug specific phases.
- **Presets are mutate-in-place.** `applyBalanceBotSavePreset` mutates the save object directly. Call it before `SaveManager.save()` during a run setup; don't call it mid-run.

## External Dependencies

- **`balanceBotAutopilot.js`** — imports `GameController`, `GameState`, `TileEngine`, `UI`, `testBotOngoingMeta`
- **`balanceBotSavePresets.js`** — imports all upgrade maps from `js/data/`
- **`testBotOngoing.js`** — imports `balanceBotAutopilot`
- **`testBotOngoingMeta.js`** — imports upgrade maps and `MetaProgression`
- **Called by:** `js/main.js` (URL-param conditional import); `scripts/balance-bot-batch.mjs` drives these indirectly via Playwright
- **Headless runner:** `scripts/balance-bot-batch.mjs` — requires `npm start` running on port 3456
