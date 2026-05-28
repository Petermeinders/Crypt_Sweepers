# AGENTS.md — tests/

Automated tests for Crypt Sweepers. Framework: Node's built-in test runner (`node:test`) + `node:assert/strict` — no Jest, no Vitest. E2E uses Playwright against the in-browser test harness.

Human-oriented overview: [`docs/tests/README.md`](../docs/tests/README.md).

## Layout

```
tests/
├── helpers/
│   ├── mockRandom.mjs         — withRandomSequence(values, fn) for deterministic Math.random
│   ├── mockSave.mjs           — createSave(overrides) wrapping MetaProgression.defaultSave()
│   ├── gridFixtures.mjs       — minimal grid snapshot builders for TileEngine unit tests
│   ├── scenarioGrids.mjs      — grid builders for E2E scenario fixtures
│   └── playwrightHarness.mjs  — server spawn, launchGame, evalHarness, console guards
├── unit/                      — fast pure-logic unit tests (*.test.mjs)
├── integration/
│   ├── game-controller-api.test.mjs  — GameController export contract
│   └── scenarios.test.mjs              — Playwright E2E scenario runner
├── fixtures/
│   ├── balance-snapshot.json
│   ├── game-controller-api.json
│   └── scenarios/             — one JSON file per E2E scenario
└── balance-snapshot.test.mjs
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Fast CI: unit tests + balance snapshot + API contract |
| `npm run test:unit` | Same as `npm test` |
| `npm run test:e2e` | Playwright scenarios (spawns serve on :3456 if needed) |
| `npm run test:all` | Unit + e2e — pre-refactor gate |

## Patterns

- **Test files use `.mjs`** — explicit ES module extension for the runner.
- **No DOM in unit tests.** Pure systems import directly from `js/`. Browser scenarios use `?testHarness=1` via Playwright.
- **Use helpers** — `withRandomSequence` for `Math.random`; `createSave` for save fixtures; `buildMinimalGridSnapshot` / `scenarioGrids` for grids (match `CONFIG.gridSize`, not ad-hoc dimensions).
- **TileEngine isolation** — call `TileEngine.importGridFromSnapshot()` in `beforeEach` to reset module `_grid` state. Do not call `generateGrid` in unit tests.
- **Balance snapshot** — regression gate for `js/data/` changes. Regenerate intentionally when balance changes.
- **GameController API test** — refactor contract. Update fixture when adding/removing default export keys.
- **E2E determinism** — pin `enemyData.hitDamage` in scenario grids; fail on `[GameState] Invalid transition` in console.

## Fixture regeneration

**Balance snapshot** (after edits to `js/data/` or `js/config.js`):

```bash
node --input-type=module <<'EOF' > tests/fixtures/balance-snapshot.json
import { computeBalanceSnapshot } from './js/balance/snapshot.js'
process.stdout.write(JSON.stringify(computeBalanceSnapshot(), null, 2))
EOF
```

**GameController API keys** (after changing default export):

```bash
node --input-type=module -e "import GameController from './js/core/GameController.js'; process.stdout.write(JSON.stringify(Object.keys(GameController).sort(), null, 2))" > tests/fixtures/game-controller-api.json
```

## External Dependencies

- **Imports:** `js/balance/snapshot.js`, `js/systems/*`, `js/core/GameState.js`, `js/core/GameController.js`, `js/boot/SaveMigrator.js`
- **E2E:** Playwright + `js/dev/testHarness.js` (URL param `?testHarness=1`)
- **Save migration:** `js/boot/SaveMigrator.js` — tested by `tests/unit/save-migration.test.mjs`

## Adding scenarios

See [`docs/tests/adding-scenarios.md`](../docs/tests/adding-scenarios.md). Drop a new JSON file in `tests/fixtures/scenarios/` — the runner auto-discovers it.
