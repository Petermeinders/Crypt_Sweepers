import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  enemyDensityShare,
  computeDungeonTileWeights,
  expectedEnemyTiles,
} from '../../js/systems/TileDensity.js'

describe('TileDensity', () => {
  it('enemyDensityShare ramps 1 → 50 → 100', () => {
    assert.equal(enemyDensityShare(1), 0.20)
    assert.equal(enemyDensityShare(50), 0.32)
    assert.equal(enemyDensityShare(100), 0.38)
    assert.ok(enemyDensityShare(25) > enemyDensityShare(10))
  })

  it('computeDungeonTileWeights hits target pool share', () => {
    const floor = 10
    const w = computeDungeonTileWeights(floor)
    const types = Object.keys(w).filter(t => t !== 'boss')
    const total = types.reduce((s, t) => s + w[t], 0)
    const share = w.enemy / total
    assert.ok(Math.abs(share - enemyDensityShare(floor)) < 0.02)
  })

  it('floor 1 has lower enemy weights than floor 50', () => {
    const w1 = computeDungeonTileWeights(1)
    const w50 = computeDungeonTileWeights(50)
    assert.ok(w1.enemy < w50.enemy)
  })

  it('expectedEnemyTiles on 5×6 floor 1 is below legacy ~9', () => {
    const ex = expectedEnemyTiles(1, 5, 6)
    assert.ok(ex.expectedEnemy < 8)
    assert.ok(ex.expectedEnemy > 4)
  })
})
