import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  rollLeaderSlotCount,
  getSpreadTagsForEnemy,
} from '../../js/systems/EnemyLeaders.js'

describe('EnemyLeaders', () => {
  it('getSpreadTagsForEnemy excludes telegraphs and merges plague-bite', () => {
    const tags = getSpreadTagsForEnemy('spider')
    assert.ok(tags.includes('plague-bite'))
    assert.ok(!tags.includes('telegraphs'))
    assert.ok(!tags.includes('fast'))
  })

  it('drowned hulk spreads crew-aura only when leaderEligible', () => {
    const tags = getSpreadTagsForEnemy('drowned_hulk_pirate')
    assert.deepEqual(tags, ['crew-aura'])
  })

  it('fire centipede spreads burn and poison without duplicate burn', () => {
    const tags = getSpreadTagsForEnemy('fire_centipede')
    assert.ok(tags.includes('burn'))
    assert.ok(tags.includes('poison'))
    assert.equal(tags.filter(t => t === 'burn').length, 1)
  })

  it('rollLeaderSlotCount returns 0, 1, or 2', () => {
    const counts = new Set()
    for (let i = 0; i < 500; i++) counts.add(rollLeaderSlotCount())
    assert.deepEqual(counts, new Set([0, 1, 2]))
  })
})
