import assert from 'node:assert/strict'
import { describe, test, beforeEach } from 'node:test'
import TileEngine from '../../js/systems/TileEngine.js'
import {
  buildMinimalGridSnapshot,
  gridToSnapshot,
} from '../helpers/gridFixtures.mjs'

beforeEach(() => {
  const snapshot = buildMinimalGridSnapshot({ floor: 1 })
  TileEngine.importGridFromSnapshot(snapshot, 1)
})

describe('TileEngine.importGridFromSnapshot', () => {
  test('round-trips minimal grid snapshot', () => {
    const snapshot = buildMinimalGridSnapshot({ floor: 1 })
    assert.equal(TileEngine.importGridFromSnapshot(snapshot, 1), true)
    const live = gridToSnapshot(TileEngine.getGrid())
    assert.equal(live.length, snapshot.length)
    assert.equal(live[0].length, snapshot[0].length)
    assert.equal(live[0][0].type, 'empty')
    assert.equal(live[0][0].revealed, true)
    assert.equal(live[0][1].type, 'enemy_goblin')
    assert.equal(live[0][1].enemyData.enemyId, 'goblin')
  })

  test('rejects invalid snapshot', () => {
    assert.equal(TileEngine.importGridFromSnapshot(null, 1), false)
    assert.equal(TileEngine.importGridFromSnapshot([], 1), false)
  })

  test('resume clears stale exitResolved on exit tiles', () => {
    const snapshot = buildMinimalGridSnapshot({ floor: 1 })
    snapshot[0][2] = { ...snapshot[0][2], type: 'exit', revealed: true, exitResolved: true }
    TileEngine.importGridFromSnapshot(snapshot, 1, { resume: true })
    const exit = TileEngine.getGrid()[0][2]
    assert.equal(exit.type, 'exit')
    assert.equal(exit.exitResolved, false)
  })

  test('isSanctuarySnapshot detects 3×3 rest layout', () => {
    const snap = [
      [{ type: 'forge' }, { type: 'anvil' }, { type: 'magic_chest' }],
      [{ type: 'rope' }, { type: 'well' }, { type: 'empty' }],
      [{ type: 'empty' }, { type: 'exit' }, { type: 'empty' }],
    ]
    assert.equal(TileEngine.isSanctuarySnapshot(snap), true)
    assert.equal(TileEngine.isSanctuarySnapshot(buildMinimalGridSnapshot({ floor: 1 })), false)
  })
})

describe('TileEngine lockAdjacent / unlockAdjacent', () => {
  test('locks and unlocks unrevealed neighbors', () => {
    const locked = []
    const unlocked = []
    TileEngine.lockAdjacent(0, 0, (el) => locked.push(el))
    const grid = TileEngine.getGrid()
    assert.equal(grid[0][1].locked, true)
    assert.equal(grid[1][0].locked, true)

    TileEngine.unlockAdjacent(0, 0, (el) => unlocked.push(el))
    assert.equal(grid[0][1].locked, false)
    assert.equal(grid[1][0].locked, false)
  })
})

describe('TileEngine.recomputeReachabilityFromRevealed', () => {
  test('marks orthogonally adjacent tiles reachable from revealed start', () => {
    const marked = []
    TileEngine.recomputeReachabilityFromRevealed((el) => marked.push(el))
    const grid = TileEngine.getGrid()
    assert.equal(grid[0][1].reachable, true)
    assert.equal(grid[1][0].reachable, true)
    assert.equal(grid[2][0]?.reachable ?? false, false)
  })
})
