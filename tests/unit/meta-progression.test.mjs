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

  test("applies Scholar's Notes from gold shop cart", () => {
    const save = createSave({ persistentGold: 100, warrior: { totalXP: 0, upgrades: ['slam'], shopCart: ['scholars-notes'] } })
    const player = { maxHp: 50, hp: 50, mana: 30, maxMana: 30, gold: 0, extraAbilityChoice: false }
    MetaProgression.applyToPlayer(player, save)
    assert.equal(player.extraAbilityChoice, true)
    assert.deepEqual(player.appliedShopItems, ['scholars-notes'])
  })
})

describe('MetaProgression.applyShopCartToPlayer', () => {
  test('does not double-apply the same cart item', () => {
    const save = createSave({ warrior: { totalXP: 0, upgrades: ['slam'], shopCart: ['healing-draft'] } })
    const player = { maxHp: 50, hp: 50, mana: 30, maxMana: 30, appliedShopItems: ['healing-draft'] }
    MetaProgression.applyShopCartToPlayer(player, save)
    assert.equal(player.maxHp, 50)
  })
})

describe('MetaProgression buyUpgrade', () => {
  test('canBuyUpgrade and buyUpgrade deduct XP', () => {
    const save = createSave({ warrior: { totalXP: 400, upgrades: ['slam'], shopCart: [] } })
    assert.equal(MetaProgression.canBuyUpgrade(save, 'slam-mastery-1'), true)
    assert.equal(MetaProgression.buyUpgrade(save, 'slam-mastery-1'), true)
    assert.equal(save.warrior.totalXP, 100)
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

describe('MetaProgression game completion', () => {
  test('completeGame awards one pearl on first completion only', () => {
    const save = createSave()
    const first = MetaProgression.completeGame(save)
    assert.equal(first.firstTime, true)
    assert.equal(first.pearlGranted, 1)
    assert.equal(save.meta.gameCompleted, true)
    assert.equal(save.meta.voidPearls, 1)

    const second = MetaProgression.completeGame(save)
    assert.equal(second.firstTime, false)
    assert.equal(second.pearlGranted, 0)
    assert.equal(save.meta.voidPearls, 1)
  })

  test('defaultSave includes meta block', () => {
    const save = MetaProgression.defaultSave()
    assert.deepEqual(save.meta, { gameCompleted: false, voidPearls: 0 })
  })
})

describe('MetaProgression endRun / calcRunXP', () => {
  test('calcRunXP rewards floor, tiles, and level', () => {
    const xp = MetaProgression.calcRunXP({ floor: 10, tilesRevealed: 50, level: 5 })
    assert.equal(xp, 10 * 15 + 50 + 5 * 8)
  })

  test('endRun credits XP and banks gold on complete like escape', () => {
    const save = createSave({ selectedCharacter: 'warrior', persistentGold: 0 })
    const result = MetaProgression.endRun(
      save,
      { floor: 100, tilesRevealed: 200, level: 20, gold: 50, safeGold: 5 },
      'complete',
    )
    assert.equal(result.goldBanked, 55)
    assert.equal(save.persistentGold, 55)
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
