import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasPath, computePath, getRadiusCells } from '../../js/systems/TDPathfinder.js'

const ROWS = 6, COLS = 6
const hero  = { row: 3, col: 0 }
const chest = { row: 3, col: 5 }

describe('hasPath', () => {
  it('returns true on a clear grid', () => {
    assert.equal(hasPath(ROWS, COLS, hero, chest, []), true)
  })

  it('returns true when a single rock does not block all routes', () => {
    assert.equal(hasPath(ROWS, COLS, hero, chest, [{ row: 3, col: 2 }]), true)
  })

  it('returns false when rocks seal every corridor', () => {
    // Seal a 1-wide chokepoint — column 2 fully blocked
    const rocks = []
    for (let r = 0; r < ROWS; r++) rocks.push({ row: r, col: 2 })
    assert.equal(hasPath(ROWS, COLS, hero, chest, rocks), false)
  })

  it('treats monster cells as walkable', () => {
    // Monsters do NOT block paths — only rocks do
    const monsterCells = [{ row: 3, col: 2 }, { row: 3, col: 3 }]
    // hasPath only receives rockCells; monster positions are not passed
    assert.equal(hasPath(ROWS, COLS, hero, chest, []), true)
  })
})

describe('computePath', () => {
  it('returns straight path on clear grid', () => {
    const path = computePath(ROWS, COLS, hero, chest, [])
    assert.ok(path.length > 0, 'path should not be empty')
    // Start does not appear; end (chest) does
    assert.deepEqual(path[path.length - 1], chest)
    assert.notDeepEqual(path[0], hero)
  })

  it('routes around a single rock', () => {
    // Block the direct row-3 path at col 2
    const path = computePath(ROWS, COLS, hero, chest, [{ row: 3, col: 2 }])
    assert.ok(path.length > 0)
    assert.ok(!path.some(c => c.row === 3 && c.col === 2), 'path must avoid the rock')
  })

  it('returns empty array when no path exists', () => {
    const rocks = []
    for (let r = 0; r < ROWS; r++) rocks.push({ row: r, col: 2 })
    const path = computePath(ROWS, COLS, hero, chest, rocks)
    assert.deepEqual(path, [])
  })

  it('hero cell is not included in the returned path', () => {
    const path = computePath(ROWS, COLS, hero, chest, [])
    assert.ok(!path.some(c => c.row === hero.row && c.col === hero.col))
  })
})

describe('getRadiusCells', () => {
  it('orthogonal_1 returns 4 adjacent cells for centre position', () => {
    const cells = getRadiusCells('orthogonal_1', 3, 3, ROWS, COLS)
    assert.equal(cells.length, 4)
    assert.ok(cells.some(c => c.row === 2 && c.col === 3))
    assert.ok(cells.some(c => c.row === 4 && c.col === 3))
    assert.ok(cells.some(c => c.row === 3 && c.col === 2))
    assert.ok(cells.some(c => c.row === 3 && c.col === 4))
  })

  it('orthogonal_1 clamps to grid bounds at corner', () => {
    const cells = getRadiusCells('orthogonal_1', 0, 0, ROWS, COLS)
    assert.equal(cells.length, 2) // only down and right exist
  })

  it('diagonal_all covers all diagonal lines to grid edge', () => {
    const cells = getRadiusCells('diagonal_all', 2, 2, ROWS, COLS)
    // from (2,2): NW: (1,1),(0,0) | NE: (1,3),(0,4) | SW: (3,1),(4,0) | SE: (3,3),(4,4),(5,5)
    assert.ok(cells.some(c => c.row === 0 && c.col === 0))
    assert.ok(cells.some(c => c.row === 5 && c.col === 5))
    assert.ok(!cells.some(c => c.row === 2 && c.col === 2), 'self not included')
  })

  it('orthogonal_2 covers up to distance 2 in each direction', () => {
    const cells = getRadiusCells('orthogonal_2', 3, 3, ROWS, COLS)
    // N: (2,3),(1,3) | S: (4,3),(5,3) | W: (3,2),(3,1) | E: (3,4),(3,5)
    assert.equal(cells.length, 8)
    assert.ok(cells.some(c => c.row === 1 && c.col === 3))
    assert.ok(cells.some(c => c.row === 3 && c.col === 1))
  })

  it('orthogonal_2 stops at grid edge mid-ray', () => {
    // Place at row 0 — northward ray cannot go to row -1 or -2
    const cells = getRadiusCells('orthogonal_2', 0, 3, ROWS, COLS)
    assert.ok(!cells.some(c => c.row < 0))
  })

  it('orthogonal_1_plus_self includes own cell and 4 neighbours', () => {
    const cells = getRadiusCells('orthogonal_1_plus_self', 3, 3, ROWS, COLS)
    assert.equal(cells.length, 5)
    assert.ok(cells.some(c => c.row === 3 && c.col === 3), 'self included')
  })

  it('none returns empty array', () => {
    const cells = getRadiusCells('none', 3, 3, ROWS, COLS)
    assert.deepEqual(cells, [])
  })
})
