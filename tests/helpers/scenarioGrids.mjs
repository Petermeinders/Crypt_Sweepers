/**
 * Build a floor-1 (5×6) grid snapshot for scenario fixtures.
 * Matches TileEngine.importGridFromSnapshot / _serializeGridSnapshot cell shape.
 */
export function emptyCell() {
  return {
    type: 'empty',
    revealed: false,
    locked: false,
    reachable: false,
    enemyData: null,
    itemData: null,
    chestLoot: null,
    exitResolved: undefined,
    eventResolved: undefined,
  }
}

export function skeletonEnemy(overrides = {}) {
  return {
    enemyId: 'skeleton',
    hp: 2,
    currentHP: 1,
    dmg: [1, 1],
    hitDamage: 1,
    type: 'undead',
    behaviour: 'standard',
    emoji: '💀',
    label: 'Skeleton',
    goldDrop: [2, 2],
    xpDrop: 2,
    threatLevel: 2,
    attributes: ['telegraphs'],
    ...overrides,
  }
}

export function lethalEnemy(overrides = {}) {
  return skeletonEnemy({
    hp: 50,
    currentHP: 50,
    hitDamage: 10,
    goldDrop: [1, 1],
    ...overrides,
  })
}

/** Start at [0,0] revealed; patch cells by { row, col, ...cellFields }. */
export function gridWithPatches(patches = []) {
  const rows = 6
  const cols = 5
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => emptyCell()),
  )
  grid[0][0] = { ...emptyCell(), revealed: true, reachable: true }
  for (const p of patches) {
    const { row, col, ...rest } = p
    grid[row][col] = { ...emptyCell(), ...rest }
  }
  return grid
}
