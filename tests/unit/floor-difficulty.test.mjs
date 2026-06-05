import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CONFIG } from '../../js/config.js'
import { loadFloorDifficulty } from '../../js/data/balance/loadFloorDifficulty.js'

describe('floor-difficulty.json → CONFIG', () => {
  test('loadFloorDifficulty resolves fastShareOfEnemies from ratio', () => {
    const d = loadFloorDifficulty()
    assert.ok(Math.abs(d.enemyDensity.fastShareOfEnemies - 7 / 29) < 1e-9)
    assert.equal(d.enemyDensity.fastShareRatio, undefined)
  })

  test('CONFIG merges scaling and void anchor', () => {
    assert.equal(CONFIG.enemy.floorScaleHP, 0.24)
    assert.equal(CONFIG.enemy.hpInflectionFloor, 50)
    assert.equal(CONFIG.void.enemyBaseFloor, 50)
    assert.equal(CONFIG.enemyDensity.shareAtFloor1, 0.2)
  })
})
