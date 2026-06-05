import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CONFIG } from '../../js/config.js'
import { loadVoidCorruption } from '../../js/data/balance/loadVoidCorruption.js'
import { corruptionStackSummary } from '../../js/systems/VoidCorruption.js'

describe('void-corruption.json → CONFIG', () => {
  it('loads tuned perPick values', () => {
    const c = loadVoidCorruption().curses
    assert.equal(c.hp_pct.perPick.maxHpMult, -0.02)
    assert.equal(c.mp_pct.perPick.maxManaMult, -0.02)
    assert.equal(c.loot_drop.perPick.lootMult, -0.02)
  })

  it('CONFIG.void.corruption matches JSON loader', () => {
    assert.equal(CONFIG.void.corruption.curses.hp_pct.perPick.maxHpMult, -0.02)
    assert.equal(CONFIG.void.corruption.tripletSize, 3)
  })

  it('corruptionStackSummary reads perPick for HUD', () => {
    assert.equal(corruptionStackSummary('loot_drop', 3), '−6% loot drops (total)')
    assert.equal(corruptionStackSummary('hp_pct', 1), '−2% max HP (total)')
  })
})
