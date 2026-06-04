import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  applyShocked,
  shockedDurationForTier,
  tryConsumeShocked,
  tickShockedDurations,
} from '../../js/systems/Thunderstruck.js'

describe('Thunderstruck', () => {
  test('shocked duration by tier', () => {
    assert.equal(shockedDurationForTier(1), 3)
    assert.equal(shockedDurationForTier(2), 5)
    assert.equal(shockedDurationForTier(0), 0)
  })

  test('applyShocked refreshes to max duration', () => {
    const ed = { shockedTurns: 1 }
    applyShocked(ed, 2)
    assert.equal(ed.shockedTurns, 5)
  })

  test('tickShockedDurations decrements', () => {
    const tiles = [{ revealed: true, enemyData: { shockedTurns: 2, _slain: false }, element: null }]
    tickShockedDurations(tiles)
    assert.equal(tiles[0].enemyData.shockedTurns, 1)
  })
})
