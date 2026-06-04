import { CONFIG } from '../config.js'
import { TILE_DEFS } from '../data/tiles.js'

const DUNGEON_EXCLUDED = new Set(['well', 'anvil', 'rope', 'war_banner', 'boss'])

/**
 * Target fraction of dungeon tile pool weight for enemy + enemy_fast (0–1).
 * Lerps shareAtFloor1 → shareAtFloor50 (floors 1–50) → shareAtFloor100.
 */
export function enemyDensityShare(floor) {
  const d = CONFIG.enemyDensity
  const f = Math.max(1, Math.floor(floor))
  const s1 = d.shareAtFloor1 ?? 0.20
  const s50 = d.shareAtFloor50 ?? 0.32
  const s100 = d.shareAtFloor100 ?? 0.38
  if (f <= 50) {
    const t = (f - 1) / 49
    return s1 + (s50 - s1) * t
  }
  const t = (Math.min(f, 100) - 50) / 50
  return s50 + (s100 - s50) * t
}

/**
 * Sum weights for tiles that are neither enemy, enemy_fast, nor empty.
 */
function _otherWeightSum() {
  let sum = 0
  for (const [t, def] of Object.entries(TILE_DEFS)) {
    if (DUNGEON_EXCLUDED.has(t)) continue
    if (t === 'enemy' || t === 'enemy_fast' || t === 'empty') continue
    sum += def.weight ?? 0
  }
  return sum
}

/**
 * Dungeon generation weights for TileEngine.generateGrid.
 * Other tile types keep TILE_DEFS weights; enemy / enemy_fast / empty follow density curve.
 */
export function computeDungeonTileWeights(floor) {
  const share = enemyDensityShare(floor)
  const d = CONFIG.enemyDensity
  const otherSum = _otherWeightSum()
  const emptyBase = TILE_DEFS.empty?.weight ?? 29
  const minEmpty = d.minEmptyWeight ?? 12

  const enemyMass = (share * (otherSum + emptyBase)) / (1 - share)
  const fastFrac = d.fastShareOfEnemies ?? 7 / 29
  const fastW = Math.max(1, Math.round(enemyMass * fastFrac))
  const enemyW = Math.max(1, Math.round(enemyMass - fastW))
  const emptyFinal = Math.max(minEmpty, Math.round((1 - share) / share * enemyMass - otherSum))

  const weights = {}
  for (const [t, def] of Object.entries(TILE_DEFS)) {
    if (DUNGEON_EXCLUDED.has(t)) continue
    if (t === 'enemy') weights[t] = enemyW
    else if (t === 'enemy_fast') weights[t] = fastW
    else if (t === 'empty') weights[t] = emptyFinal
    else weights[t] = def.weight ?? 0
  }
  weights.boss = 0
  return weights
}

/** Expected enemy tile count for a grid from pool weights (ignores forced boss/exit). */
export function expectedEnemyTiles(floor, cols, rows) {
  const w = computeDungeonTileWeights(floor)
  const types = Object.keys(w).filter(t => t !== 'boss')
  const total = types.reduce((s, t) => s + w[t], 0)
  const enemyShare = (w.enemy + w.enemy_fast) / total
  return {
    cols,
    rows,
    cells: cols * rows,
    enemyShare,
    expectedEnemy: (cols * rows) * enemyShare,
    weights: { enemy: w.enemy, enemy_fast: w.enemy_fast, empty: w.empty },
  }
}

export default {
  enemyDensityShare,
  computeDungeonTileWeights,
  expectedEnemyTiles,
}
