import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scaleEnemyDef } from '../../js/systems/EnemyScaling.js'
import { ENEMY_DEFS } from '../../js/data/enemies.js'

const GOLDEN = {
  1:  { hp: 3,  dmg: [1, 1] },
  10: { hp: 8,  dmg: [2, 2] },
  50: { hp: 32, dmg: [7, 7] },
  51: { hp: 33, dmg: [8, 8] },
}

for (const [floor, expected] of Object.entries(GOLDEN)) {
  test(`skeleton at floor ${floor} — HP ${expected.hp}, DMG ${expected.dmg.join('-')}`, () => {
    const scaled = scaleEnemyDef(ENEMY_DEFS.skeleton, Number(floor))
    assert.equal(scaled.hp, expected.hp)
    assert.deepEqual(scaled.dmg, expected.dmg)
    assert.equal(scaled.currentHP, expected.hp)
  })
}
