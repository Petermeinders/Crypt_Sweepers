# Balance data (JSON)

Tunable curves and multipliers that are awkward to maintain inside `config.js`. Game code still reads **`CONFIG`** — `js/config.js` merges these files at load time.

## Files

| File | Purpose |
|------|---------|
| `floor-difficulty.json` | Enemy tile density curve, per-floor HP/damage scaling, leader spawn chances, Void trial anchor floor (`enemyBaseFloor`) |

## Editing `floor-difficulty.json`

Each tunable value has a sibling key **`fieldName__doc`** on the line above it with a plain-English explanation. The loader strips all `*__doc` keys before merging into `CONFIG` — they are documentation only.

### `enemyDensity`
- **`shareAtFloor1` / `shareAtFloor50` / `shareAtFloor100`** — target share of the dungeon weight pool for `enemy` + `enemy_fast` (interpolated between anchors). See `js/systems/TileDensity.js`.
- **`fastShareRatio`** — fraction of enemy pool that is `enemy_fast` (default 7/29).
- **`minEmptyWeight`** — floor weight for empty tiles so the pool never collapses.

### `enemyScaling`
- **`hpInflectionFloor`** — floor where HP switches from early linear rate to late rate (default 50).
- **`floorScaleHP`** — +HP per floor for floors 2 … inflection.
- **`floorScaleHP_late`** — +HP per floor above inflection.
- **`floorScaleDmgExpRate`** — compound damage multiplier per floor (floors 2 … inflection).
- **`floorScaleDmgExpRate_late`** — compound damage rate above inflection.
- **`statMult`** — global multiplier on scaled enemy HP and damage.

### `voidTrial`
- **`enemyBaseFloor`** — void trial floor 1 uses main-game scaling at this depth; each void floor adds +1 (`voidEffectiveEnemyFloor` in `js/systems/VoidTrial.js`).

## After changes

1. `npm test` (updates `tests/unit/enemy-scaling.test.mjs` golden values if scaling changed materially).
2. `npm run balance-report`
3. Regenerate snapshot if needed: see `js/balance/AGENTS.md`
4. Bump `CACHE_NAME` in `sw.js` on deploy (JSON is precached).

## Why JSON + a tiny loader?

- Vanilla ESM in browser and Node both support `import … with { type: 'json' }`.
- A small loader keeps derived fields (e.g. `fastShareOfEnemies`) out of the JSON and preserves the existing `CONFIG` API so systems do not need rewrites.
