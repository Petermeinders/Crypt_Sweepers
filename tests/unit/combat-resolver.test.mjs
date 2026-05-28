import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import CombatResolver from '../../js/systems/CombatResolver.js'
import { withRandomSequence } from '../helpers/mockRandom.mjs'

const baseEnemy = { hp: 3, dmg: [2, 4], xpDrop: 5 }

describe('CombatResolver.resolveFight', () => {
  test('uses hitDamage when present instead of rolling', () => {
    withRandomSequence([0], () => {
      const player = { damageBonus: 0, inventory: [] }
      const enemy = { ...baseEnemy, hitDamage: 7 }
      const result = CombatResolver.resolveFight(player, enemy)
      assert.equal(result.enemyDmg, 7)
    })
  })

  test('rolls enemy damage when hitDamage is absent', () => {
    withRandomSequence([0], () => {
      const player = { damageBonus: 0, inventory: [] }
      const result = CombatResolver.resolveFight(player, baseEnemy)
      assert.equal(result.enemyDmg, 2)
    })
  })

  test('warrior rolls base damage plus bonuses', () => {
    withRandomSequence([0], () => {
      const player = { damageBonus: 2, inventory: [{ id: 'spiked-collar' }] }
      const result = CombatResolver.resolveFight(player, baseEnemy)
      assert.equal(result.playerDmg, 6)
    })
  })

  test('plague-mask reduces damage bonus', () => {
    withRandomSequence([0], () => {
      const player = { damageBonus: 3, inventory: [{ id: 'plague-mask' }] }
      const result = CombatResolver.resolveFight(player, baseEnemy)
      assert.equal(result.playerDmg, 3)
    })
  })

  test('ranger uses razors-edge for max damage', () => {
    withRandomSequence([0], () => {
      const player = { isRanger: true, damageBonus: 0, inventory: [{ id: 'razors-edge' }] }
      const result = CombatResolver.resolveFight(player, baseEnemy)
      assert.equal(result.playerDmg, 1)
    })
  })

  test('engineer rolls engineer base damage', () => {
    withRandomSequence([0], () => {
      const player = { isEngineer: true, damageBonus: 1, inventory: [] }
      const result = CombatResolver.resolveFight(player, baseEnemy)
      assert.equal(result.playerDmg, 2)
    })
  })

  test('vampire uses flat base damage', () => {
    const player = { isVampire: true, damageBonus: 2, inventory: [] }
    const result = CombatResolver.resolveFight(player, baseEnemy)
    assert.equal(result.playerDmg, 4)
  })
})

describe('CombatResolver.resolveFastReveal', () => {
  test('prefers hitDamage over roll', () => {
    withRandomSequence([0], () => {
      const result = CombatResolver.resolveFastReveal({ dmg: [1, 5], hitDamage: 3 })
      assert.equal(result.dmg, 3)
    })
  })
})

describe('CombatResolver.abilityDmgFloor', () => {
  test('floor bands at 1, 10, and 20', () => {
    assert.equal(CombatResolver.abilityDmgFloor(1), 1)
    assert.equal(CombatResolver.abilityDmgFloor(9), 1)
    assert.equal(CombatResolver.abilityDmgFloor(10), 1)
    assert.equal(CombatResolver.abilityDmgFloor(19), 1)
    assert.equal(CombatResolver.abilityDmgFloor(20), 2)
    assert.equal(CombatResolver.abilityDmgFloor(29), 2)
  })
})
