# AGENTS.md — js/data/

The data directory is the game's content layer. Every file is a plain JS export of static object definitions — no functions, no class instances, no runtime mutation. All "apply" logic lives in `MetaProgression.js`, `ProgressionSystem.js`, `CombatResolver.js`, or `GameController.js`.

## Key Files

| File | Purpose |
|------|---------|
| `enemies.js` | `ENEMY_DEFS` — base stats for all enemy types at floor 1. Scaling is applied by `EnemyScaling.scaleEnemyDef()`. Each entry has `hp`, `dmg[]`, `type`, `behaviour`, `spawn` rule, `goldDrop`, `xpDrop`. |
| `items.js` | `ITEMS` — trinket and consumable definitions. Each entry has `name`, `icon`, `spriteSrc`, `rarity`, `stackable`, `effect` (handled by `GameController._useItem`), `details[]`. |
| `tiles.js` | `TILE_DEFS` — tile type definitions with `weight`, `cssClass`, `isEnemy`, `enemyType`. Weights are floor-1 baselines; `TileEngine._adjustedWeights()` tunes them per floor. |
| `upgrades.js` | `WARRIOR_UPGRADES` and `SHOP_ITEMS` — warrior XP tree and persistent gold shop. Each upgrade has `xpCost`/`goldCost`, optional `requires`, and an `effect` object consumed by `MetaProgression`. |
| `passives.js` | `GLOBAL_PASSIVE_UPGRADES` and `GLOBAL_PASSIVE_IDS` — hero-agnostic passives bought with persistent gold. Applied to every hero via `MetaProgression.applyToPlayer()`. |
| `abilities.js` | `WARRIOR_ABILITIES` — in-run level-up choices for the Warrior (stat buffs, masteries, actives). |
| `ranger.js` | `RANGER_BASE`, `RANGER_UPGRADES`, `RANGER_ABILITIES` — Ranger hero definition. |
| `engineer.js` | `ENGINEER_BASE`, `ENGINEER_UPGRADES`, `ENGINEER_ABILITIES`, turret constants — Engineer hero definition. |
| `mage.js` | `MAGE_BASE`, `MAGE_UPGRADES`, `MAGE_ABILITIES` — Mage hero definition. |
| `vampire.js` | `VAMPIRE_BASE`, `VAMPIRE_UPGRADES`, `VAMPIRE_MASTERY_ABILITIES` — Vampire hero definition. |
| `necromancer.js` | `NECROMANCER_BASE`, `NECROMANCER_UPGRADES`, `NECROMANCER_ABILITIES`, minion/cost constants — Necromancer definition. |
| `combinations.js` | `FORGE_RECIPES` — trinket combination recipes for the Sanctuary Forge. Unordered ingredient pairs + result item ID. |
| `events.js` | `STORY_EVENTS`, `MERCHANT_ITEMS`, `rollEventType()` — random event pool and merchant item definitions. |
| `tileIcons.js` | Sprite path maps: `ENEMY_SPRITES`, `TILE_TYPE_ICON_FILES`, `ITEM_ICONS_BASE`, etc. Used by `TileEngine` and `UI`. |
| `tileBlurbs.js` | `TILE_BLURBS` — flavour text strings keyed by tile type, shown in the info bar on reveal. |
| `changelog.js` | In-game changelog entries shown on the main menu. Not game logic. |
| `characters.js` | `CHARACTERS` hero roster for hero-select UI + `SELECTABLE_HEROES` guard for `SaveMigrator`. Imports upgrade maps and `CONFIG` unlock costs. |
| `balance/floor-difficulty.json` | Main-game floor difficulty tuning (density, HP/dmg scaling, Void anchor floor). Loaded by `balance/loadFloorDifficulty.js` into `CONFIG`. |
| `balance/loadFloorDifficulty.js` | Imports JSON; normalizes derived fields; used only from `config.js`. |

## Patterns

- **Plain data only.** No functions, no class instances, no `import` statements inside data files (they export only). Exception: `events.js` exports `rollEventType()` — a single pure helper.
- **`effect.type` is a contract.** The string in `effect.type` is matched by a `switch` in `MetaProgression._applyUpgradeEffect()` or `GameController._useItem()`. Adding a new effect type requires a handler in both places.
- **Enemy `leaderEligible`:** when `true`, floor spawn may promote this type to Leader (rare; see `CONFIG.enemy.leader`, `js/systems/EnemyLeaders.js`, `docs/enemy-leaders-design.md`).
- **Enemy `spawn` field shapes:**
  - `'universal'` — all floors
  - `{ fromBiome: 'id' }` — that biome and all later ones
  - `{ biomes: ['id', ...] }` — only listed biomes
  - `{ minFloor: N }` — floor N and deeper
- **Enemy `behaviour` field** controls spawn routing in `TileEngine`: `'standard'`, `'fast'`, `'boss'`, `'archer'` (archer is never spawned via normal pool — only via `_spawnArcherGoblin()`).
- **Item `rarity`** controls loot pool assignment in `js/systems/LootTables.js`: `'common'` → `COMMON_LOOT_IDS`, `'rare'` → `RARE_TRINKET_IDS`, `'epic'` → `EPIC_TRINKET_IDS`, `'legendary'` → `LEGENDARY_TRINKET_IDS`. Magic-chest-exclusive items are in `MAGIC_CHEST_EXCLUSIVE_IDS` in `LootTables.js`, not in `items.js`. Legendary trinkets only drop from floor 10+ (`LEGENDARY_MIN_FLOOR`).
- **`dowsing-rod`** (common, stacks to 10) — one-time use, instantly reveals the nearest unrevealed trap. Uses safe reveal (sets `tile.revealed = true` + `patchMainGridTileAt`) so the trap is exposed but does NOT trigger trap damage. Handled by `dowsingRodAction()` in `GameController`.
- **Upgrade `requires`** is a single prerequisite upgrade ID. `MetaProgression` enforces this gate before purchase.
- **Balance impact warning.** Changes to `enemies.js`, `passives.js`, `upgrades.js`, `balance/floor-difficulty.json`, or other `config.js` values affect balance snapshot tests (`npm test`). Run `npm run balance-report` after edits to review the impact.

## Data Schemas

**Enemy def:** `{ hp, dmg: [lo, hi], type, behaviour, emoji, label, goldDrop, xpDrop, blurb, attributes[], spawn, threatLevel? }`

**Item def:** `{ name, icon, spriteSrc?, rarity, stackable, maxStack?, blurb, details[], effect: { type, amount? } }`

**Upgrade def:** `{ name, desc, icon, iconSrc?, xpCost | goldCost, requires?, masteryOf?, effect: { type, ... } }`

**Forge recipe:** `{ id, result, ingredientA, ingredientB, hint }`

## External Dependencies

- **Called by:** `TileEngine`, `CombatResolver`, `MetaProgression`, `ProgressionSystem`, `GameController`, `UI`, `js/balance/snapshot.js`
- **Calls nothing** (data files have no imports, except `events.js` which is self-contained)
