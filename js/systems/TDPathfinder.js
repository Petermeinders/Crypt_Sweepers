/**
 * TDPathfinder — pure path-finding and radius utilities for the TD minigame.
 * No DOM, no session, no imports from game systems.
 */

/**
 * BFS: returns true if a walkable path exists from heroPos to chestPos.
 * Only rock cells are impassable; all other cells (including monster cells) are walkable.
 * @param {number} rows
 * @param {number} cols
 * @param {{row:number,col:number}} heroPos
 * @param {{row:number,col:number}} chestPos
 * @param {{row:number,col:number}[]} rockCells - current rock placements
 */
export function hasPath(rows, cols, heroPos, chestPos, rockCells) {
  const blocked = new Set(rockCells.map(c => `${c.row},${c.col}`))
  const visited = new Set()
  const queue = [heroPos]
  const key = p => `${p.row},${p.col}`
  visited.add(key(heroPos))
  while (queue.length) {
    const cur = queue.shift()
    if (cur.row === chestPos.row && cur.col === chestPos.col) return true
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cur.row + dr, nc = cur.col + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      const k = `${nr},${nc}`
      if (visited.has(k) || blocked.has(k)) continue
      visited.add(k)
      queue.push({ row: nr, col: nc })
    }
  }
  return false
}

/**
 * A*: returns ordered path steps from heroPos to chestPos (exclusive of start, inclusive of end).
 * Only rock cells are impassable. Returns [] if no path exists.
 * @param {number} rows
 * @param {number} cols
 * @param {{row:number,col:number}} heroPos
 * @param {{row:number,col:number}} chestPos
 * @param {{row:number,col:number}[]} rockCells
 * @returns {{row:number,col:number}[]}
 */
export function computePath(rows, cols, heroPos, chestPos, rockCells) {
  const blocked = new Set(rockCells.map(c => `${c.row},${c.col}`))
  const key = p => `${p.row},${p.col}`
  const h = p => Math.abs(p.row - chestPos.row) + Math.abs(p.col - chestPos.col)
  const startKey = key(heroPos)

  const gScore = new Map([[startKey, 0]])
  const cameFrom = new Map()
  // open set as sorted array (small grids — sort is fine)
  const open = [{ pos: heroPos, f: h(heroPos) }]
  const inOpen = new Set([startKey])

  while (open.length) {
    open.sort((a, b) => a.f - b.f)
    const { pos: cur } = open.shift()
    const curKey = key(cur)
    inOpen.delete(curKey)

    if (cur.row === chestPos.row && cur.col === chestPos.col) {
      const path = []
      let k = curKey
      while (cameFrom.has(k)) {
        const [r, c] = k.split(',').map(Number)
        path.unshift({ row: r, col: c })
        k = cameFrom.get(k)
      }
      return path
    }

    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cur.row + dr, nc = cur.col + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      const nk = `${nr},${nc}`
      if (blocked.has(nk)) continue
      const ng = (gScore.get(curKey) ?? Infinity) + 1
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng)
        cameFrom.set(nk, curKey)
        if (!inOpen.has(nk)) {
          open.push({ pos: { row: nr, col: nc }, f: ng + h({ row: nr, col: nc }) })
          inOpen.add(nk)
        }
      }
    }
  }
  return []
}

/**
 * Returns all grid cells covered by a piece's attack radius, clamped to bounds.
 * @param {string} radiusType
 * @param {number} row - piece row
 * @param {number} col - piece col
 * @param {number} rows - grid row count
 * @param {number} cols - grid col count
 * @returns {{row:number,col:number}[]}
 */
export function getRadiusCells(radiusType, row, col, rows, cols) {
  const cells = []
  const dirs4 = [[-1,0],[1,0],[0,-1],[0,1]]
  const diag4 = [[-1,-1],[-1,1],[1,-1],[1,1]]
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols

  switch (radiusType) {
    case 'orthogonal_1':
      for (const [dr, dc] of dirs4) {
        const nr = row + dr, nc = col + dc
        if (inBounds(nr, nc)) cells.push({ row: nr, col: nc })
      }
      break

    case 'diagonal_all':
      for (const [dr, dc] of diag4) {
        let nr = row + dr, nc = col + dc
        while (inBounds(nr, nc)) {
          cells.push({ row: nr, col: nc })
          nr += dr; nc += dc
        }
      }
      break

    case 'orthogonal_2':
      for (const [dr, dc] of dirs4) {
        for (let dist = 1; dist <= 2; dist++) {
          const nr = row + dr * dist, nc = col + dc * dist
          if (inBounds(nr, nc)) cells.push({ row: nr, col: nc })
          else break
        }
      }
      break

    case 'orthogonal_1_plus_self':
      cells.push({ row, col })
      for (const [dr, dc] of dirs4) {
        const nr = row + dr, nc = col + dc
        if (inBounds(nr, nc)) cells.push({ row: nr, col: nc })
      }
      break

    case 'none':
    default:
      break
  }
  return cells
}
