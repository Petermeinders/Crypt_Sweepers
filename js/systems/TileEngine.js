import { CONFIG }     from '../config.js'
import { TILE_DEFS }  from '../data/tiles.js'
import { ENEMY_DEFS, BOSS_POOL } from '../data/enemies.js'
import {
  ITEM_ICONS_BASE,
  MONSTER_ICONS_BASE,
  TILE_TYPE_ICON_FILES,
  ENEMY_ICON_FILES,
  ENEMY_SPRITES,
} from '../data/tileIcons.js'
import Logger         from '../core/Logger.js'
import { scaleEnemyDef } from './EnemyScaling.js'

// ── Grid state ───────────────────────────────────────────────
let _grid = []
let _currentFloor = 1
/** 'dungeon' | 'rest' — rest floors are 3×3 between boss and next dungeon */
let _gridMode = 'dungeon'

// ── Factories ────────────────────────────────────────────────

function _randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

/**
 * Display string for enemy attack on tiles / cards.
 * After reveal, `hitDamage` is set once (see rollEnemyHitDamage); until then shows potential range from `dmg`.
 */
function formatEnemyDamageDisplay(dmg, hitDamage) {
  if (hitDamage != null) return String(hitDamage)
  if (dmg == null) return '—'
  if (!Array.isArray(dmg)) return String(dmg)
  const [lo, hi] = dmg
  return lo === hi ? String(lo) : `${lo}–${hi}`
}

/** Roll once from scaled `dmg` [lo, hi]; idempotent. Call when the tile is revealed. */
function rollEnemyHitDamage(enemyData) {
  if (!enemyData || enemyData.hitDamage != null) return enemyData?.hitDamage
  const raw = enemyData.dmg
  const [lo, hi] = Array.isArray(raw) ? raw : [Number(raw), Number(raw)]
  enemyData.hitDamage = _randInt(lo, hi)
  return enemyData.hitDamage
}

/** Update ⚔️ line after hitDamage is rolled (tile already in DOM). */
function refreshEnemyDamageOnTile(tile) {
  if (!tile?.element || !tile.enemyData) return
  const el = tile.element.querySelector('.stat-dmg')
  if (!el) return
  const str = formatEnemyDamageDisplay(tile.enemyData.dmg, tile.enemyData.hitDamage)
  el.textContent = `⚔️ ${str}`
}

function createEnemy(type, floor = 1) {
  const def = ENEMY_DEFS[type]
  if (!def) { Logger.error(`[TileEngine] Unknown enemy type: ${type}`); return null }
  const scaled = scaleEnemyDef(def, floor)
  const threatLevel = Number.isFinite(def.threatLevel)
    ? def.threatLevel
    : Math.max(1, Math.min(12, scaled.xpDrop ?? 2))
  return { ...scaled, enemyId: type, threatLevel }
}

function createTile(type, row, col, floor = 1) {
  const def = TILE_DEFS[type]
  return {
    row,
    col,
    type,
    revealed:  false,
    locked:    false,
    enemyData: def.isEnemy ? createEnemy(def.enemyType, floor) : null,
    itemData:  null,
    element:   null,
  }
}

// ── Weighted random ──────────────────────────────────────────

function weightedRandom(types, weights, total) {
  let r = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    r -= weights[i]
    if (r <= 0) return types[i]
  }
  return types[types.length - 1]
}

// Tile weight adjustments by floor depth: deeper = more enemies, fewer empties
function _adjustedWeights(floor) {
  const defs = { ...TILE_DEFS }
  const weights = {}
  for (const [t, d] of Object.entries(defs)) {
    // Rest-only tile types never roll on dungeon floors
    if (t === 'well' || t === 'anvil' || t === 'rope') continue
    // Special tiles placed only by GameController after generation
    if (t === 'war_banner') continue
    weights[t] = d.weight
  }
  // Boss weight is always 0 (placed explicitly)
  weights.boss = 0
  // Deeper floors: ramp enemy density, reduce empty
  if (floor >= 5) {
    weights.enemy      = Math.min(32, weights.enemy      + (floor - 4) * 2)
    weights.enemy_fast = Math.min(14, weights.enemy_fast + (floor - 4))
    weights.empty      = Math.max(10, weights.empty      - (floor - 4) * 2)
  }
  return weights
}

/**
 * Returns true if an enemy's spawn rule allows it on the given biome.
 * spawn: 'universal' | { fromBiome: 'id' } | { biomes: ['id',...] }
 */
function _enemyAllowedInBiome(enemyId, biomeId) {
  const def   = ENEMY_DEFS[enemyId]
  if (!def) return false
  const spawn = def.spawn ?? 'universal'
  if (spawn === 'universal') return true
  if (spawn.biomes) return spawn.biomes.includes(biomeId)
  if (spawn.fromBiome) {
    // Find ordered biome index; enemy allowed if current biome index >= fromBiome index
    const biomes = CONFIG.biomes.map(b => b.id)
    const fromIdx    = biomes.indexOf(spawn.fromBiome)
    const currentIdx = biomes.indexOf(biomeId)
    return fromIdx !== -1 && currentIdx >= fromIdx
  }
  return true
}

// Pick enemy type for standard enemy slot, scaling by floor
function _pickEnemyType(floor, tileType) {
  if (tileType === 'boss') {
    const idx = Math.floor((floor - 1) / 5) % BOSS_POOL.length
    return BOSS_POOL[idx]
  }

  const biomeId = CONFIG.biomeFor(floor)?.id ?? 'dungeon'

  // All non-boss enemies, filtered by spawn rules for this biome
  const allIds = Object.keys(ENEMY_DEFS).filter(id => {
    const def = ENEMY_DEFS[id]
    return def.behaviour !== 'boss' && _enemyAllowedInBiome(id, biomeId)
  })

  if (tileType === 'enemy_fast') {
    const fastPool = allIds.filter(e => {
      const def = ENEMY_DEFS[e]
      return def.behaviour === 'fast' || def.attributes?.includes('fast')
    })
    return fastPool.length ? fastPool[Math.floor(Math.random() * fastPool.length)] : 'goblin'
  }
  // Standard enemy tile — exclude behaviour-fast, behaviour-archer, and behaviour-mouse
  // (archer_goblin spawns via _spawnArcherGoblin only; mouse spawns via _spawnMouse only)
  const stdPool = allIds.filter(e => ENEMY_DEFS[e]?.behaviour !== 'fast' && ENEMY_DEFS[e]?.behaviour !== 'archer' && ENEMY_DEFS[e]?.behaviour !== 'mouse')
  return stdPool.length
    ? stdPool[Math.floor(Math.random() * stdPool.length)]
    : allIds[Math.floor(Math.random() * allIds.length)]
}

// ── Sub-floor generation ─────────────────────────────────────

/**
 * Generate a standalone sub-floor grid (plain objects, no DOM).
 * Returns { rows, cols, tiles: tile[][] } — tiles are TileEngine tile objects
 * without .element (rendered separately by UI.renderSubFloorGrid).
 */
function generateSubFloor(type, mainFloor) {
  switch (type) {
    case 'mob_den':            return _genMobDen(mainFloor)
    case 'boss_vault':         return _genBossVault(mainFloor)
    case 'treasure_vault':     return _genTreasureVault(mainFloor)
    case 'shrine':             return _genShrine(mainFloor)
    case 'ambush':             return _genAmbush(mainFloor)
    case 'collapsed_tunnel':   return _genCollapsedTunnel(mainFloor)
    case 'cartographers_cache':return _genCartographersCache(mainFloor)
    case 'toxic_gas':          return _genToxicGas(mainFloor)
    default:                   return _genMobDen(mainFloor)
  }
}

function _sfTile(type, row, col, floor) {
  const base = { row, col, type, revealed: false, locked: false, enemyData: null, itemData: null, element: null, reachable: false }
  if (TILE_DEFS[type]?.isEnemy) {
    base.enemyData = createEnemy(_pickEnemyType(floor, type), floor)
  }
  return base
}

function _sfBossTile(row, col, floor) {
  const tile = _sfTile('boss', row, col, floor)
  return tile
}

/** Pick one normal (non-fast, non-boss) enemy type and use it for all mob tiles */
function _pickSingleMobType(floor) {
  const biomeId = CONFIG.biomeFor(floor)?.id ?? 'dungeon'
  const pool = Object.keys(ENEMY_DEFS).filter(id => {
    const d = ENEMY_DEFS[id]
    return d.behaviour !== 'boss' && d.behaviour !== 'fast' && _enemyAllowedInBiome(id, biomeId)
  })
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'skeleton'
}

function _positivePool() {
  return ['gold', 'gold', 'gold', 'chest', 'heart', 'empty', 'empty']
}

function _randomPositive(row, col, floor) {
  const pool = _positivePool()
  const type = pool[Math.floor(Math.random() * pool.length)]
  return _sfTile(type, row, col, floor)
}

/** 4×4 mob den — one enemy type, many enemies, 1 chest, stairs at (3,3) */
function _genMobDen(floor) {
  const rows = 4, cols = 4
  const mobType = _pickSingleMobType(floor)
  const tiles = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < cols; c++) {
      row.push(null) // fill below
    }
    tiles.push(row)
  }
  // Stairs at top-left (start area) always revealed
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  // Chest guaranteed somewhere in bottom half
  const chestR = 2 + Math.floor(Math.random() * 2)
  const chestC = Math.floor(Math.random() * 4)
  tiles[chestR][chestC] = _sfTile('chest', chestR, chestC, floor)
  // Fill rest with enemies
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      const t = { row: r, col: c, type: 'enemy', revealed: false, locked: false, reachable: false, element: null, itemData: null }
      t.enemyData = createEnemy(mobType, floor)
      tiles[r][c] = t
    }
  }
  // Mark reachable from start tile
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles, mobType }
}

/** 3×3 boss vault — boss at (1,0), rewards locked until boss slain, stairs at (0,0) */
function _genBossVault(floor) {
  const rows = 3, cols = 3
  const tiles = []
  for (let r = 0; r < rows; r++) tiles.push([null, null, null])
  // Stairs top-left (revealed start)
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  // Boss directly below stairs — orthogonally reachable from start
  tiles[1][0] = _sfBossTile(1, 0, floor)
  tiles[1][0].isBossVaultBoss = true
  // Fill rest with positive rewards (locked until boss dies)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      tiles[r][c] = _randomPositive(r, c, floor)
    }
  }
  // Lock all reward tiles; boss and stairs stay unlocked
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tiles[r][c]
      if (t.type !== 'stairs_up' && t.type !== 'boss') t.locked = true
    }
  }
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/** 3×3 treasure vault — 1 trap center, rest positive, stairs at (0,0) */
function _genTreasureVault(floor) {
  const rows = 3, cols = 3
  const tiles = []
  for (let r = 0; r < rows; r++) tiles.push([null, null, null])
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  tiles[1][1] = _sfTile('trap', 1, 1, floor) // center trap
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      // Guarantee at least 2 chests
      const chestsPlaced = tiles.flat().filter(t => t?.type === 'chest').length
      const remaining = (rows * cols) - tiles.flat().filter(Boolean).length
      const needChest = chestsPlaced < 2 && remaining <= 3
      tiles[r][c] = needChest ? _sfTile('chest', r, c, floor) : _randomPositive(r, c, floor)
    }
  }
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/** 3×3 shrine — shrine center, all surrounding empty, stairs at (0,0) */
function _genShrine(floor) {
  const rows = 3, cols = 3
  const tiles = []
  for (let r = 0; r < rows; r++) tiles.push([null, null, null])
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  tiles[1][1] = _sfTile('shrine', 1, 1, floor)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      tiles[r][c] = { ..._sfTile('empty', r, c, floor), revealed: true } // all revealed, no combat
    }
  }
  // Shrine tile is reachable from start
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/** 4×4 ambush — all enemies, no chest, flavor disguises as treasure */
function _genAmbush(floor) {
  const rows = 4, cols = 4
  const tiles = []
  for (let r = 0; r < rows; r++) {
    tiles.push([null, null, null, null])
  }
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      tiles[r][c] = _sfTile('enemy', r, c, floor)
    }
  }
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/** 1×6 collapsed tunnel — stairs at both ends, traps in middle, chest at far end */
function _genCollapsedTunnel(floor) {
  const rows = 1, cols = 6
  const tiles = [[]]
  // col 0: stairs up (start, revealed)
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  // cols 1–4: traps
  for (let c = 1; c <= 4; c++) {
    tiles[0][c] = _sfTile('trap', 0, c, floor)
  }
  // col 5: chest then stairs — use chest at 4, stairs at 5
  tiles[0][4] = _sfTile('chest', 0, 4, floor)
  tiles[0][5] = _sfTile('stairs_up', 0, 5, floor)
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/** Orthogonal reachability seeding for sub-floor grids */
function _sfMarkReachable(tiles, rows, cols, startR, startC) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  const queue = [[startR, startC]]
  const visited = new Set([`${startR},${startC}`])
  while (queue.length) {
    const [r, c] = queue.shift()
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const key = `${nr},${nc}`
      if (visited.has(key)) continue
      visited.add(key)
      const t = tiles[nr]?.[nc]
      if (!t || t.locked) continue
      if (!t.revealed) { t.reachable = true }
      if (t.revealed) queue.push([nr, nc])
    }
  }
}

/**
 * 3×3 Cartographer's Cache — no enemies, rubble + one map tile.
 * Picking up the map reveals the main-floor exit.
 */
function _genCartographersCache(floor) {
  const rows = 3, cols = 3
  const tiles = []
  for (let r = 0; r < rows; r++) tiles.push([null, null, null])
  // Stairs top-left (revealed)
  tiles[0][0] = { ..._sfTile('stairs_up', 0, 0, floor), revealed: true, reachable: false }
  // Map tile at a random non-stairs position
  const positions = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (r !== 0 || c !== 0) positions.push([r, c])
  const [mr, mc] = positions[Math.floor(Math.random() * positions.length)]
  tiles[mr][mc] = _sfTile('map', mr, mc, floor)
  // Fill rest with rubble
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      tiles[r][c] = _sfTile('rubble', r, c, floor)
    }
  }
  _sfMarkReachable(tiles, rows, cols, 0, 0)
  return { rows, cols, tiles }
}

/**
 * 3×3 Toxic Gas Chamber — no enemies. Player takes damage every flip.
 * Stairs are hidden; find them to escape.
 */
function _genToxicGas(floor) {
  const rows = 3, cols = 3
  const tiles = []
  for (let r = 0; r < rows; r++) tiles.push([null, null, null])
  // Stairs UP at a random position — NOT pre-revealed; player must find them
  const positions = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) positions.push([r, c])
  const [sr, sc] = positions[Math.floor(Math.random() * positions.length)]
  tiles[sr][sc] = _sfTile('stairs_up', sr, sc, floor)
  // Fill rest with rubble
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (tiles[r][c]) continue
      tiles[r][c] = _sfTile('rubble', r, c, floor)
    }
  }
  // All tiles reachable from the start — place a revealed entry at a corner that isn't the stairs
  const corners = [[0,0],[0,2],[2,0],[2,2]].filter(([r,c]) => r !== sr || c !== sc)
  const [er, ec] = corners[Math.floor(Math.random() * corners.length)]
  tiles[er][ec] = { ..._sfTile('rubble', er, ec, floor), revealed: true, reachable: false }
  // Mark all non-revealed tiles reachable (open gas chamber — no locking)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!tiles[r][c].revealed) tiles[r][c].reachable = true
    }
  }
  return { rows, cols, tiles, entryRow: er, entryCol: ec }
}

/** Roll a weighted sub-floor type */
function rollSubFloorType() {
  const weights = CONFIG.subFloor.typeWeights
  const types = Object.keys(weights)
  let total = types.reduce((s, k) => s + weights[k], 0)
  let r = Math.random() * total
  for (const t of types) {
    r -= weights[t]
    if (r <= 0) return t
  }
  return types[0]
}

// ── Grid generation ──────────────────────────────────────────

function _generateRestGrid(floor) {
  const rows = 3
  const cols = 3
  _grid = []
  const layout = [
    ['forge', 'anvil', 'magic_chest'],
    ['rope',  'well',  'empty'],
    ['empty', 'exit',  'empty'],
  ]
  for (let r = 0; r < rows; r++) {
    _grid[r] = []
    for (let c = 0; c < cols; c++) {
      const type = layout[r][c]
      _grid[r][c] = _createTileWithEnemy(type, r, c, floor)
    }
  }
  Logger.debug(`[TileEngine] Rest sanctuary grid (3×3)`)
}

function generateGrid(floor = 1, opts = {}) {
  _currentFloor = floor
  _gridMode = opts.rest ? 'rest' : 'dungeon'
  if (_gridMode === 'rest') {
    _generateRestGrid(floor)
    return
  }

  const { cols, rows } = CONFIG.gridSize(floor)
  const isBossFloor = CONFIG.bossFloors.includes(floor)

  const weights   = _adjustedWeights(floor)
  const types     = Object.keys(weights).filter(t => t !== 'boss')
  const totalW    = types.reduce((s, t) => s + weights[t], 0)
  const count     = cols * rows

  _grid = []
  let exitPlaced = false
  let bossPlaced = false

  for (let r = 0; r < rows; r++) {
    _grid[r] = []
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      let type

      // Boss floor: force a boss tile at a mid-grid position (row 2, col 2)
      if (isBossFloor && !bossPlaced && r === Math.floor(rows / 2) && c === Math.floor(cols / 2)) {
        type = 'boss'
        bossPlaced = true
      } else if (i === count - 1 && !exitPlaced && !isBossFloor) {
        type = 'exit'
        exitPlaced = true
      } else {
        // Never roll a second exit — exclude 'exit' from the pool once one exists.
        // Boss floors: no random exits — only the stairs that replace the boss when slain.
        const poolTypes = types.filter(t => t !== 'exit' || (!exitPlaced && !isBossFloor))
        const poolWeights = poolTypes.map(t => weights[t])
        const poolTotal = poolWeights.reduce((s, w) => s + w, 0)
        type = weightedRandom(poolTypes, poolWeights, poolTotal)
        if (type === 'exit') exitPlaced = true
      }

      // For enemy tiles, pick a floor-appropriate enemy type
      const tile = _createTileWithEnemy(type, r, c, floor)
      _grid[r][c] = tile
    }
  }

  // Re-roll if no exit was placed (shouldn't happen, but safety net)
  if (!exitPlaced && !isBossFloor) {
    _grid[rows - 1][cols - 1] = _createTileWithEnemy('exit', rows - 1, cols - 1, floor)
  }

  // ── Rare tile caps ───────────────────────────────────────────
  // Each rare type may appear AT MOST ONCE per floor, gated by a per-floor
  // probability roll. Extras (or the sole one if the roll fails) become empty.
  const RARE_CAPS = {
    checkpoint: 0.05,   // 1-in-20 chance the floor has a camp at all
    heart:      0.02,   // 1-in-50 chance the floor has a heart at all
  }

  for (const [type, floorChance] of Object.entries(RARE_CAPS)) {
    const allowed = Math.random() < floorChance   // true = one may appear this floor
    let kept = false
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = _grid[r][c]
        if (t.type !== type) continue
        if (allowed && !kept) {
          kept = true   // keep the first one found, strip the rest
        } else {
          _grid[r][c] = _createTileWithEnemy('empty', r, c, floor)
        }
      }
    }
  }

  Logger.debug(`[TileEngine] Floor ${floor} grid generated (${cols}x${rows})${isBossFloor ? ' [BOSS]' : ''}`)
}

/**
 * Replace the current grid from a saved snapshot (same dimensions as CONFIG.gridSize).
 * Used when resuming an active run so the floor is not re-rolled.
 */
function importGridFromSnapshot(snapshot, floor, opts = {}) {
  _currentFloor = floor
  _gridMode = opts.rest ? 'rest' : 'dungeon'
  const { cols, rows } = CONFIG.gridSize(floor, { rest: opts.rest })
  if (!snapshot || snapshot.length !== rows || !snapshot[0] || snapshot[0].length !== cols) {
    Logger.warn('[TileEngine] importGridFromSnapshot: dimension mismatch')
    return false
  }
  _grid = []
  for (let r = 0; r < rows; r++) {
    _grid[r] = []
    for (let c = 0; c < cols; c++) {
      const st = snapshot[r][c]
      const tile = {
        row: r,
        col: c,
        type: st.type,
        revealed: !!st.revealed,
        locked: !!st.locked,
        reachable: !!st.reachable,
        enemyData: st.enemyData ? JSON.parse(JSON.stringify(st.enemyData)) : null,
        itemData: st.itemData ? JSON.parse(JSON.stringify(st.itemData)) : null,
        chestLoot: st.chestLoot ? JSON.parse(JSON.stringify(st.chestLoot)) : null,
        chestReady: st.chestReady,
        chestLooted: st.chestLooted,
        magicChestReady: st.magicChestReady,
        pendingLoot: st.pendingLoot ? JSON.parse(JSON.stringify(st.pendingLoot)) : null,
        exitResolved: st.exitResolved,
        eventResolved: st.eventResolved,
        ropeResolved: st.ropeResolved,
        forgeUsed: st.forgeUsed,
        echoHintCategory: st.echoHintCategory ?? null,
        darkEyesHint: !!st.darkEyesHint,
        bannerReady: st.bannerReady ?? null,
        warBannerFlying: st.type === 'war_banner' ? (st.warBannerFlying !== false) : null,
        element: null,
      }
      // Older saves may have chest_* on a cell that became war_banner — strip so teardown cannot resurrect chest state.
      if (st.type === 'war_banner') {
        tile.chestLoot = null
        delete tile.chestReady
        delete tile.chestLooted
        delete tile.magicChestReady
        tile.pendingLoot = null
      }
      _grid[r][c] = tile
    }
  }
  Logger.debug(`[TileEngine] Grid imported from snapshot (${cols}x${rows})`)
  return true
}

function _createTileWithEnemy(type, row, col, floor) {
  const def = TILE_DEFS[type]
  if (!def) return createTile('empty', row, col, floor)

  let enemyData = null
  if (def.isEnemy) {
    const enemyType = _pickEnemyType(floor, type)
    enemyData = createEnemy(enemyType, floor)
  }

  return {
    row,
    col,
    type,
    revealed:  type === 'hole',
    locked:    false,
    reachable: false,
    enemyData,
    itemData:  null,
    element:   null,
  }
}

// ── Tile face icons (Items/) ─────────────────────────────────

function _resolveTileIconSrc(tile, def) {
  if (def.isEnemy && tile.enemyData?.enemyId) {
    const sprites = ENEMY_SPRITES[tile.enemyData.enemyId]
    if (sprites?.idle) return MONSTER_ICONS_BASE + sprites.idle
    const file = ENEMY_ICON_FILES[tile.enemyData.enemyId]
    return file ? ITEM_ICONS_BASE + file : null
  }
  const file = TILE_TYPE_ICON_FILES[tile.type]
  return file ? ITEM_ICONS_BASE + file : null
}

function _tileFaceIconHTML(tile, def) {
  const emoji = tile.enemyData?.emoji ?? def.emoji
  const src = _resolveTileIconSrc(tile, def)
  if (!src) {
    if (!emoji) return ''
    return `<span class="tile-icon-wrap tile-icon-fallback"><span class="tile-emoji">${emoji}</span></span>`
  }
  return `<span class="tile-icon-wrap"><img class="tile-icon-img" src="${src}" alt="" decoding="async" draggable="false"/></span>`
}

function _wireTileIconFallback(tileEl, emojiFallback) {
  const img = tileEl.querySelector('.tile-icon-img')
  if (!img) return
  img.addEventListener('error', function onIconErr() {
    img.removeEventListener('error', onIconErr)
    const wrap = img.closest('.tile-icon-wrap')
    if (!wrap) return
    wrap.innerHTML = `<span class="tile-emoji">${emojiFallback}</span>`
    wrap.classList.add('tile-icon-fallback')
  })
}

// ── DOM render ───────────────────────────────────────────────

/**
 * Build a single tile DOM element with identical structure/classes/handlers
 * to the main grid. Used by both `renderGrid` (main) and `renderTileGridInto`
 * (sub-floor) so there is one source of truth for tile rendering.
 *
 * @param {boolean} [scrollable=false] – When true the touchend listener is
 *   passive so the parent container can scroll freely. A touchmove guard
 *   suppresses the synthetic click that fires after a swipe.
 */
function _buildTileElement(tile, r, c, onTap, onHold, scrollable = false) {
  const def = TILE_DEFS[tile.type] || TILE_DEFS.empty

  const div = document.createElement('div')
  div.className = 'tile tile-type-' + tile.type + (def.isEnemy ? ' is-enemy' : '')
  div.dataset.row = r
  div.dataset.col = c
  div.setAttribute('aria-label', 'hidden tile')

  // Random back-face texture
  const _backImages = [
    'assets/sprites/tiles/tile-unflipped2.1.png',
    'assets/sprites/tiles/tile-unflipped3.png',
  ]
  const backSrc = _backImages[Math.floor(Math.random() * _backImages.length)]

  const isBoss = tile.enemyData?.isBoss
  const emojiFallback = tile.enemyData?.emoji ?? def.emoji
  const iconHTML = _tileFaceIconHTML(tile, def)
  const showBannerOnBack = tile.type === 'war_banner' && !tile.revealed && tile.warBannerFlying !== false
  const backFlag = showBannerOnBack ? '<span class="tile-war-banner-fly" aria-hidden="true">🚩</span>' : ''

  let enemyStatsHTML = ''
  if (def.isEnemy && tile.enemyData) {
    const rawHp = tile.enemyData.currentHP ?? tile.enemyData.hp
    const hp = Number.isFinite(Number(rawHp)) ? rawHp : (tile.enemyData.hp ?? '—')
    const dmg = tile.enemyData.dmg
    const dmgStr = formatEnemyDamageDisplay(dmg, tile.enemyData.hitDamage)
    enemyStatsHTML = `<div class="tile-enemy-stats">
      <span class="stat-hp">❤️ ${hp}</span>
      <span class="stat-dmg">⚔️ ${dmgStr}</span>
    </div>`
  }

  div.innerHTML = `
    <div class="tile-inner">
      <div class="tile-back">${backFlag}</div>
      <div class="tile-front ${def.cssClass}${isBoss ? ' is-boss' : ''}">
        ${iconHTML}
        ${def.isEnemy ? '' : `<span class="tile-label">${def.label}</span>`}
        ${enemyStatsHTML}
        <span class="tile-threat-clue" aria-hidden="true"></span>
      </div>
    </div>`

  div.querySelector('.tile-back').style.backgroundImage = `url('${backSrc}')`
  _wireTileIconFallback(div, emojiFallback)

  // Apply initial state classes (sub-floor tiles may start revealed/locked/reachable)
  if (tile.revealed)  div.classList.add('revealed')
  if (tile.locked)    div.classList.add('locked')
  if (tile.reachable && !tile.revealed) div.classList.add('reachable')
  if (def.isEnemy && tile.enemyData && !tile.enemyData._slain && tile.revealed) {
    div.classList.add('enemy-alive')
  }
  // Chest: add chest-ready class only if not looted; if looted wipe the icon so no ghost chest
  if (tile.type === 'chest' && tile.revealed) {
    if (tile.chestReady && !tile.chestLooted) {
      div.classList.add('chest-ready')
    } else if (tile.chestLooted) {
      const front = div.querySelector('.tile-front')
      if (front) { front.innerHTML = '' }
    }
  }

  // ── Tap / Hold ──
  let _holdTimer = null
  let _didHold   = false
  let _startX    = 0
  let _startY    = 0
  /** Scrollable sub-floor: true after pointer moved past threshold (drag / scroll vs tap). */
  let _pointerMoved = false
  const HOLD_MS  = 380
  const MOVE_THRESHOLD = 8

  const _cancelHold = () => {
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null }
  }

  div.addEventListener('pointerdown', e => {
    // In a scrollable container, release implicit pointer capture immediately
    // so the scroll container can claim horizontal swipes before the hold timer fires.
    if (scrollable && e.target.releasePointerCapture) {
      e.target.releasePointerCapture(e.pointerId)
    }
    _didHold = false
    _pointerMoved = false
    _startX  = e.clientX
    _startY  = e.clientY
    _holdTimer = setTimeout(() => {
      _holdTimer = null
      _didHold   = true
      if (onHold) onHold(r, c)
    }, HOLD_MS)
  })

  div.addEventListener('pointermove', e => {
    const dx = e.clientX - _startX
    const dy = e.clientY - _startY
    if (scrollable && (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD)) {
      _pointerMoved = true
    }
    if (!_holdTimer) return
    if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) _cancelHold()
  })

  div.addEventListener('pointerup', e => {
    _cancelHold()
    // Desktop / trackpad: no touchend — use pointerup for mouse/pen only (touch uses touchend below).
    if (scrollable && (e.pointerType === 'mouse' || e.pointerType === 'pen')) {
      if (!_didHold && !_pointerMoved) onTap(r, c)
    }
  })
  div.addEventListener('pointercancel', _cancelHold)
  div.addEventListener('contextmenu', e => e.preventDefault())

  if (scrollable) {
    // Passive touch listeners so the scroll container can swipe freely.
    let _touchMoved = false
    div.addEventListener('touchstart', () => { _touchMoved = false }, { passive: true })
    div.addEventListener('touchmove',  () => { _touchMoved = true  }, { passive: true })
    div.addEventListener('touchend',   () => {
      if (!_touchMoved && !_didHold) onTap(r, c)
      _didHold = false
    }, { passive: true })
    // Do not listen for click here — synthetic clicks after touch gestures break horizontal scroll.
  } else {
    div.addEventListener('click', () => { if (!_didHold) onTap(r, c) })
    div.addEventListener('touchend', e => {
      e.preventDefault()
      if (!_didHold) onTap(r, c)
      _didHold = false
    }, { passive: false })
  }

  tile.element = div
  return div
}

function renderGrid(gridEl, onTap, onHold) {
  const { cols, rows } = CONFIG.gridSize(_currentFloor, { rest: _gridMode === 'rest' })
  gridEl.innerHTML = ''
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const div = _buildTileElement(_grid[r][c], r, c, onTap, onHold)
      gridEl.appendChild(div)
    }
  }
}

/**
 * Render an arbitrary 2D array of tiles into a grid element using the same
 * DOM construction as the main grid. Used by the sub-floor overlay so icons,
 * frames, threat clues, and fallbacks all match the main grid.
 */
function renderTileGridInto(gridEl, tileRows, onTap, onHold) {
  gridEl.innerHTML = ''
  const rows = tileRows.length
  const cols = tileRows[0]?.length ?? 0
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = tileRows[r]?.[c]
      if (!tile) { gridEl.appendChild(document.createElement('div')); continue }
      // scrollable=true: passive touch listeners so the grid-wrap can scroll
      const div = _buildTileElement(tile, r, c, onTap, onHold, true)
      gridEl.appendChild(div)
    }
  }
}

// ── Flip animation ───────────────────────────────────────────

function flipTile(tile) {
  return new Promise(resolve => {
    const inner = tile.element.querySelector('.tile-inner')
    tile.element.classList.add('revealed')
    inner.addEventListener('transitionend', function handler(e) {
      if (e.propertyName === 'transform') {
        inner.removeEventListener('transitionend', handler)
        resolve()
      }
    })
  })
}

/**
 * Reverse-flip animation. Mirror of flipTile — removes the 'revealed' class
 * and resolves on the transform transition end. DOM-only (caller updates model).
 * Shared primitive for any creature/hero that needs to unflip tiles.
 */
function unflipTile(tile) {
  return new Promise(resolve => {
    const el = tile.element
    if (!el) { resolve(); return }
    const inner = el.querySelector('.tile-inner')
    if (!inner) { el.classList.remove('revealed'); resolve(); return }
    let resolved = false
    const done = () => { if (!resolved) { resolved = true; resolve() } }
    inner.addEventListener('transitionend', function handler(e) {
      if (e.propertyName === 'transform') {
        inner.removeEventListener('transitionend', handler)
        done()
      }
    })
    el.classList.remove('revealed')
    // Safety net if transitionend never fires (element detached, anim disabled, etc.)
    setTimeout(done, 600)
  })
}

/** Tile types that must never be rolled as an unflip result (one-off or rest-only placements). */
const UNFLIP_EXCLUDED_TYPES = new Set([
  'exit', 'boss', 'checkpoint', 'heart', 'sub_floor_entry', 'war_banner',
  'stairs_up', 'shrine', 'well', 'anvil', 'rope', 'magic_chest', 'forge',
  'map', 'rubble', 'sub_floor_used', 'hole',
])

/**
 * Reusable unflip + reroll primitive. Animates the tile back to unrevealed,
 * resets mutable per-tile state, rerolls its type from the current floor's
 * weighted pool (with unsafe one-off types excluded), and rebuilds enemy
 * data in place. The caller should re-render the single tile via
 * patchMainGridTileAt(...) and then recompute reachability/locks/clues.
 *
 * @param {object} tile   - grid tile (must be .revealed)
 * @param {number} floor  - current floor
 * @param {object} [opts] - { rerollPool?: string[] } override whitelist
 * @returns {Promise<void>}
 */
async function unflipAndRerollTile(tile, floor, opts = {}) {
  if (!tile || !tile.revealed) return
  await unflipTile(tile)

  // Reset mutable per-tile state
  tile.revealed         = false
  tile.reachable        = false
  tile.locked           = false
  tile.enemyData        = null
  tile.itemData         = null
  tile.chestLoot        = null
  tile.chestReady       = undefined
  tile.chestLooted      = undefined
  tile.magicChestReady  = undefined
  tile.pendingLoot      = null
  tile.echoHintCategory = null
  tile.darkEyesHint     = false
  tile.entryReady       = undefined
  tile.eventResolved    = undefined
  tile.exitResolved     = undefined
  tile.ropeResolved     = undefined
  tile.forgeUsed        = undefined
  tile.bannerReady      = undefined
  tile.subFloorVisited  = undefined
  tile.subFloorType     = undefined
  tile.warBannerFlying  = undefined

  // Roll a new type from the current floor's weights
  const weights = _adjustedWeights(floor)
  const pool = Array.isArray(opts.rerollPool) && opts.rerollPool.length
    ? opts.rerollPool
    : Object.keys(weights).filter(t => !UNFLIP_EXCLUDED_TYPES.has(t) && (weights[t] ?? 0) > 0)
  const poolWeights = pool.map(t => weights[t])
  const total = poolWeights.reduce((s, w) => s + w, 0)
  const newType = total > 0 ? weightedRandom(pool, poolWeights, total) : 'empty'

  // Build a fresh tile from the new type, then copy its content into the
  // existing tile object so external references stay valid.
  const fresh = _createTileWithEnemy(newType, tile.row, tile.col, floor)
  tile.type       = fresh.type
  tile.enemyData  = fresh.enemyData
  tile.itemData   = fresh.itemData
  // _createTileWithEnemy sets revealed=true for 'hole' tiles; we excluded hole
  // from the pool above, but keep this line honest in case of override pools.
  tile.revealed   = !!fresh.revealed
}

// ── Adjacency helpers ────────────────────────────────────────

function getAdjacentTiles(row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  return dirs
    .map(([dr, dc]) => _grid[row + dr]?.[col + dc])
    .filter(Boolean)
}

let _diagonalMovement = false
function setDiagonalMovement(enabled) { _diagonalMovement = !!enabled }

function getOrthogonalTiles(row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  return dirs
    .map(([dr, dc]) => _grid[row + dr]?.[col + dc])
    .filter(Boolean)
}

function getDiagonalTiles(row, col) {
  const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]]
  return dirs
    .map(([dr, dc]) => _grid[row + dr]?.[col + dc])
    .filter(Boolean)
}

function _enemyThreatLevelForTile(adj) {
  if (!adj?.enemyData || adj.enemyData._slain) return 0
  const tl = adj.enemyData.threatLevel
  if (Number.isFinite(tl)) return tl
  const xp = adj.enemyData.xpDrop
  return Math.max(1, Math.min(12, Number.isFinite(xp) ? xp : 2))
}

/**
 * Sum of orthogonal (N/E/S/W) only — adjacent living enemies' threat + trap weight per trap tile.
 */
function computeOrthogonalThreatSum(row, col) {
  let sum = 0
  const trapW = CONFIG.threatClues?.trapThreat ?? 2
  for (const adj of getOrthogonalTiles(row, col)) {
    sum += _enemyThreatLevelForTile(adj)
    if (adj.type === 'trap') sum += trapW
  }
  return sum
}

function _tileShouldShowThreatClue(tile) {
  if (!tile?.revealed) return false
  if (tile.enemyData && !tile.enemyData._slain) return false
  return true
}

/** Update clue digits on all tiles (small grids — call after any reveal or enemy death). */
function refreshAllThreatClueDisplays() {
  if (!CONFIG.threatClues?.enabled) {
    for (const row of _grid) {
      for (const t of row) {
        const el = t.element?.querySelector('.tile-threat-clue')
        if (el) {
          el.textContent = ''
          el.classList.add('hidden')
        }
      }
    }
    return
  }
  for (const row of _grid) {
    for (const t of row) {
      const clueEl = t.element?.querySelector('.tile-threat-clue')
      if (!clueEl) continue
      if (!_tileShouldShowThreatClue(t)) {
        clueEl.textContent = ''
        clueEl.classList.add('hidden')
        clueEl.classList.remove('threat-clue-safe', 'threat-clue-risk')
        continue
      }
      const sum = computeOrthogonalThreatSum(t.row, t.col)
      clueEl.textContent = String(sum)
      clueEl.classList.remove('hidden')
      clueEl.classList.toggle('threat-clue-safe', sum === 0)
      clueEl.classList.toggle('threat-clue-risk', sum > 0)
    }
  }
}

function markReachable(row, col, uiMark) {
  for (const adj of getOrthogonalTiles(row, col)) {
    if (!adj.revealed && !adj.reachable) {
      adj.reachable = true
      if (adj.element) uiMark(adj.element)
    }
  }
  if (_diagonalMovement && Math.random() < 0.5) {
    for (const adj of getDiagonalTiles(row, col)) {
      if (!adj.revealed && !adj.reachable) {
        adj.reachable = true
        if (adj.element) uiMark(adj.element)
      }
    }
  }
}

/** After restoring grid state (e.g. Hourglass), rebuild reachable flags and HUD classes. */
function recomputeReachabilityFromRevealed(uiMark) {
  for (const row of _grid) {
    for (const t of row) {
      if (!t.revealed) {
        t.reachable = false
        if (t.element) {
          t.element.classList.remove('reachable')
          // Keep DOM in sync with model — otherwise stale `.locked` (red X) survives after unlock/repair.
          t.element.classList.toggle('locked', !!t.locked)
        }
      }
    }
  }
  for (const row of _grid) {
    for (const t of row) {
      if (!t.revealed) continue
      // Mirror the rules from revealTile: holes/blockages don't spread reachability,
      // and archer/mouse only become reachable once the player paths adjacent.
      if (t.type === 'hole' || t.type === 'blockage') continue
      if ((t.enemyData?.behaviour === 'archer' || t.enemyData?.behaviour === 'mouse') && !t.enemyData._slain) continue
      markReachable(t.row, t.col, uiMark)
    }
  }
}

function lockAdjacent(row, col, uiLock) {
  for (const adj of getAdjacentTiles(row, col)) {
    if (!adj.revealed) {
      adj.locked = true
      if (adj.element) uiLock(adj.element)
    }
  }
  Logger.debug(`[TileEngine] Locked adjacent to [${row},${col}]`)
}

function unlockAdjacent(row, col, uiUnlock) {
  for (const adj of getAdjacentTiles(row, col)) {
    adj.locked = false
    if (adj.element) uiUnlock(adj.element)
  }
  Logger.debug(`[TileEngine] Unlocked adjacent to [${row},${col}]`)
}

/**
 * Rebuild monster-lock state for the whole grid. Use after an enemy dies: a tile can be in the
 * ambush zone of multiple enemies — naive unlockAdjacent() would clear locks still required by
 * another living enemy (wrong X's on the map).
 */
function recomputeAllEnemyLocks(uiLock, uiUnlock) {
  for (const row of _grid) {
    for (const t of row) {
      if (!t.revealed && t.locked) {
        t.locked = false
        if (t.element) uiUnlock(t.element)
      }
    }
  }
  for (const row of _grid) {
    for (const t of row) {
      // Ranger passive can skip locking on reveal — must not re-lock here or X's come back wrong.
      if (t.revealed && t.enemyData && !t.enemyData._slain && !t.enemyData.rangerSkipAdjacentLock && t.enemyData.behaviour !== 'archer' && t.enemyData.behaviour !== 'mouse') {
        lockAdjacent(t.row, t.col, uiLock)
      }
    }
  }
  // Model is source of truth — force DOM to match (covers stale .locked if unlock missed an element).
  for (const row of _grid) {
    for (const t of row) {
      if (!t.element) continue
      if (t.revealed) {
        t.locked = false
        t.element.classList.remove('locked')
      } else {
        t.element.classList.toggle('locked', !!t.locked)
      }
    }
  }
}

// ── Getters ──────────────────────────────────────────────────

function getGrid()     { return _grid }
function getTile(r, c) { return _grid[r]?.[c] }
function getCurrentFloor() { return _currentFloor }

/**
 * Swap a grid cell for a new empty tile with the same exploration flags.
 * Used when tearing down the war banner so no stale chest/loot/banner fields
 * remain on the shared tile object (snapshots + DOM both read the model).
 */
function replaceTileWithEmptyPreserveState(r, c) {
  const old = _grid[r]?.[c]
  if (!old) return
  const t = _createTileWithEnemy('empty', r, c, _currentFloor)
  t.revealed = !!old.revealed
  t.locked = !!old.locked
  t.reachable = !!old.reachable
  _grid[r][c] = t
}

/**
 * Replace one main-grid tile's DOM to match `_grid[r][c]` without rebuilding the whole grid.
 * Use after war-banner teardown so slain-enemy spirit FX / chest pulses are not replayed everywhere.
 */
function patchMainGridTileAt(r, c, gridEl, onTap, onHold) {
  const tile = _grid[r]?.[c]
  if (!tile || !gridEl) return false
  const newEl = _buildTileElement(tile, r, c, onTap, onHold, false)
  const oldEl = gridEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`)
  if (!oldEl?.parentNode) {
    renderGrid(gridEl, onTap, onHold)
    return false
  }
  oldEl.parentNode.replaceChild(newEl, oldEl)
  tile.element = newEl
  return true
}

export default {
  createEnemy,
  generateGrid,
  importGridFromSnapshot,
  replaceTileWithEmptyPreserveState,
  patchMainGridTileAt,
  renderGrid,
  renderTileGridInto,
  flipTile,
  unflipTile,
  unflipAndRerollTile,
  lockAdjacent,
  unlockAdjacent,
  recomputeAllEnemyLocks,
  markReachable,
  recomputeReachabilityFromRevealed,
  getGrid,
  getTile,
  getCurrentFloor,
  formatEnemyDamageDisplay,
  rollEnemyHitDamage,
  refreshEnemyDamageOnTile,
  getOrthogonalTiles,
  setDiagonalMovement,
  refreshAllThreatClueDisplays,
  computeOrthogonalThreatSum,
  generateSubFloor,
  rollSubFloorType,
}
