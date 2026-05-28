import { CONFIG } from '../../js/config.js'

/** Minimal serialized cell matching TileEngine importGridFromSnapshot shape. */
export function cell(type, opts = {}) {
  return {
    type,
    revealed: !!opts.revealed,
    locked: !!opts.locked,
    reachable: !!opts.reachable,
    enemyData: opts.enemyData ?? null,
    itemData: opts.itemData ?? null,
    chestLoot: null,
    chestReady: undefined,
    chestLooted: undefined,
    magicChestReady: undefined,
    pendingLoot: null,
    exitResolved: undefined,
    eventResolved: undefined,
    ropeResolved: undefined,
    forgeUsed: undefined,
    echoHintCategory: null,
    darkEyesHint: false,
    killEchoMarked: false,
    armorValue: null,
    bannerReady: null,
    warBannerFlying: null,
  }
}

/**
 * Build a minimal grid snapshot for a floor (default floor 1 → 5×6).
 * Revealed empty at [0,0] acts as the run start; optional enemy at [0,1].
 */
export function buildMinimalGridSnapshot(opts = {}) {
  const floor = opts.floor ?? 1
  const rest = !!opts.rest
  const { cols, rows } = CONFIG.gridSize(floor, { rest })
  const enemyAt = opts.enemyAt ?? { row: 0, col: 1 }
  const enemyData = opts.enemyData ?? {
    enemyId: 'goblin',
    hp: 2,
    dmg: [1, 1],
    currentHP: 2,
    behaviour: 'standard',
  }

  const grid = []
  for (let r = 0; r < rows; r++) {
    grid[r] = []
    for (let c = 0; c < cols; c++) {
      const isStart = r === 0 && c === 0
      const isEnemy = r === enemyAt.row && c === enemyAt.col
      grid[r][c] = cell(isEnemy ? 'enemy_goblin' : 'empty', {
        revealed: isStart,
        reachable: isStart,
        enemyData: isEnemy ? { ...enemyData } : null,
      })
    }
  }
  return grid
}

/** Serialize live TileEngine grid tiles for round-trip comparison. */
export function gridToSnapshot(grid) {
  return grid.map(row =>
    row.map(t => ({
      type: t.type,
      revealed: t.revealed,
      locked: t.locked,
      reachable: t.reachable,
      enemyData: t.enemyData ? structuredClone(t.enemyData) : null,
      itemData: t.itemData ? structuredClone(t.itemData) : null,
    })),
  )
}
