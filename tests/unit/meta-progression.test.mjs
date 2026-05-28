import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import MetaProgression from '../../js/systems/MetaProgression.js'
import { createSave } from '../helpers/mockSave.mjs'

describe('MetaProgression.applyToPlayer', () => {
  test('applies global passive max HP bonus', () => {
    const save = createSave({ globalPassives: ['courage'] })
    const player = { maxHp: 50, hp: 50, mana: 30, maxMana: 30, gold: 0, damageBonus: 0 }
    MetaProgression.applyToPlayer(player, save)
    assert.equal(player.maxHp, 60)
    assert.equal(player.hp, 60)
  })
})

describe('MetaProgression buyUpgrade', () => {
  test('canBuyUpgrade and buyUpgrade deduct XP', () => {
    const save = createSave({ warrior: { totalXP: 50, upgrades: ['slam'], shopCart: [] } })
    assert.equal(MetaProgression.canBuyUpgrade(save, 'slam-mastery-1'), true)
    assert.equal(MetaProgression.buyUpgrade(save, 'slam-mastery-1'), true)
    assert.equal(save.warrior.totalXP, 10)
    assert.ok(save.warrior.upgrades.includes('slam-mastery-1'))
    assert.equal(MetaProgression.canBuyUpgrade(save, 'slam-mastery-1'), false)
  })
})

describe('MetaProgression.normalizeUnlockedHeroes', () => {
  test('grandfathers XP progress into unlockedHeroes', () => {
    const save = createSave({
      unlockedHeroes: ['warrior'],
      mage: { totalXP: 100, upgrades: [] },
    })
    MetaProgression.normalizeUnlockedHeroes(save)
    assert.ok(save.unlockedHeroes.includes('mage'))
    assert.ok(save.unlockedHeroes.includes('warrior'))
  })

  test('syncs ranger.unlocked when ranger is unlocked', () => {
    const save = createSave({
      unlockedHeroes: ['warrior', 'ranger'],
      ranger: { unlocked: false, totalXP: 0, upgrades: [] },
    })
    MetaProgression.normalizeUnlockedHeroes(save)
    assert.equal(save.ranger.unlocked, true)
  })
})

describe('MetaProgression endRun / calcRunXP', () => {
  test('calcRunXP rewards floor, tiles, and level', () => {
    const xp = MetaProgression.calcRunXP({ floor: 10, tilesRevealed: 50, level: 5 })
    assert.equal(xp, 10 * 15 + 50 + 5 * 8)
  })

  test('endRun credits XP and banks gold on escape', () => {
    const save = createSave({ selectedCharacter: 'warrior', persistentGold: 0 })
    const result = MetaProgression.endRun(
      save,
      { floor: 5, tilesRevealed: 20, level: 3, gold: 30, safeGold: 10 },
      'escape',
    )
    assert.equal(result.xpEarned, MetaProgression.calcRunXP({ floor: 5, tilesRevealed: 20, level: 3 }))
    assert.equal(result.xpRetained, result.xpEarned)
    assert.equal(result.goldBanked, 40)
    assert.equal(save.persistentGold, 40)
    assert.deepEqual(save.warrior.shopCart, [])
  })

  test('endRun retains partial XP on death at normal difficulty', () => {
    const save = createSave({ settings: { difficulty: 'normal', childMode: false } })
    const stats = { floor: 10, tilesRevealed: 40, level: 4, gold: 20, safeGold: 0 }
    const result = MetaProgression.endRun(save, stats, 'death')
    assert.equal(result.xpRetained, Math.floor(result.xpEarned * 0.5))
    assert.ok(result.xpLost > 0)
  })
})
