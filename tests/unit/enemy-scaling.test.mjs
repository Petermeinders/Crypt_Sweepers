import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scaleEnemyDef } from '../../js/systems/EnemyScaling.js'
import { ENEMY_DEFS } from '../../js/data/enemies.js'

const GOLDEN = {
  1:  { hp: 3,  dmg: [1, 1] },
  10: { hp: 5,  dmg: [2, 2] },
  50: { hp: 15, dmg: [4, 4] },
  51: { hp: 15, dmg: [4, 4] },
}

for (const [floor, expected] of Object.entries(GOLDEN)) {
  test(`skeleton at floor ${floor} — HP ${expected.hp}, DMG ${expected.dmg.join('-')}`, () => {
    const scaled = scaleEnemyDef(ENEMY_DEFS.skeleton, Number(floor))
    assert.equal(scaled.hp, expected.hp)
    assert.deepEqual(scaled.dmg, expected.dmg)
    assert.equal(scaled.currentHP, expected.hp)
  })
}
