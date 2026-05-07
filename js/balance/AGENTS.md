# AGENTS.md — js/balance/

The balance directory contains the static analysis layer — snapshot computation, per-run telemetry data structures, and design pillar definitions. This code runs both in-browser (telemetry accumulation during play) and in Node (snapshot tests, balance reports).

## Key Files

| File | Purpose |
|------|---------|
| `snapshot.js` | `computeBalanceSnapshot()` — pure function that builds a serializable report: warrior melee vs scaled enemy HP at reference floors, across multiple meta scenarios (baseline, full-meta, in-run damage bands). Used by `npm test` and `npm run balance-report`. |
| `runTelemetry.js` | `createInitialTelemetry()` and `buildLevelSnapshotRecord()` — data shape factories for per-run telemetry accumulated in `GameController`. Written to `window.__balanceBotRuns` by the balance bot. |
| `balanceTargets.js` | `BALANCE_PILLARS` and `RECOMMENDED_TUNING_ORDER` — design intent documentation. Imported by `snapshot.js` and the test to assert they're well-formed. |

## Patterns

- **`snapshot.js` must be runnable in Node without a DOM.** It imports only `js/config.js`, `js/data/`, and `js/systems/MetaProgression.js` + `EnemyScaling.js`. Do not import anything that touches `document` or `window`.
- **`computeBalanceSnapshot()` is deterministic** — it uses no randomness. The output is committed as `tests/fixtures/balance-snapshot.json` and compared in `npm test`.
- **When you change balance numbers, update the fixture.** Run `node -e "import('./js/balance/snapshot.js').then(m => console.log(JSON.stringify(m.computeBalanceSnapshot(), null, 2)))" > tests/fixtures/balance-snapshot.json` (or `npm run balance-report` and copy the relevant section) to regenerate.
- **Telemetry is append-only during a run.** `GameController` pushes to `telemetry.levelSnapshots[]`, `telemetry.floorSnapshots[]`, increments counters, and sets `outcome` at run end. Never read telemetry back during play.
- **Reference scenarios** are defined in `snapshot.js`: `baseline` (no meta), `fullMeta` (all passives + gold shop), and damage-bonus overrides. Add new scenarios here when testing new meta layers.

## Data Models

**Telemetry record** (from `createInitialTelemetry()`):
- `damageByFloor` — `{ [floor]: { taken, dealt } }`
- `damageSources` — `{ combat, trap, fast_enemy, archer_harass, toxic_gas, … }`
- `killsByFloor`, `goldByFloor` — `{ [floor]: number }`
- `levelSnapshots[]`, `floorSnapshots[]`
- `outcome` — `'death' | 'escape' | 'retreat'`

**Level snapshot** (from `buildLevelSnapshotRecord()`):
- `trigger`, `characterLevel`, `floor`, `xp`, `xpToNext`, `hp`, `maxHp`, `mana`, `maxMana`, `damageBonus`, `damageReduction`, `gold`, `meleeDamageRange`

**Balance snapshot row:**
- `scenarioId`, `floor`, `enemyId`, `enemyHp`, `playerMelee`, `hitsToKill`, `hitsToDieApprox`, `trivialKill`

## External Dependencies

- **`snapshot.js`** — imports `CONFIG`, `ENEMY_DEFS`, `GLOBAL_PASSIVE_IDS`, `SHOP_ITEMS`, `MetaProgression`, `EnemyScaling`, `balanceTargets`
- **`runTelemetry.js`** — pure data shapes; no imports
- **Called by:** `GameController` (telemetry), `tests/balance-snapshot.test.mjs`, `scripts/balance-report.mjs`
