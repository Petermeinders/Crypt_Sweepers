import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { migrateSave } from '../../js/boot/SaveMigrator.js'
import MetaProgression from '../../js/systems/MetaProgression.js'

describe('migrateSave', () => {
  test('adds missing scrap without marking changed', () => {
    const save = MetaProgression.defaultSave()
    delete save.scrap
    const { save: out, changed } = migrateSave(save)
    assert.equal(out.scrap, 0)
    assert.equal(changed, false)
  })

  test('renames legacy gear stat keys', () => {
    const save = MetaProgression.defaultSave()
    save.equippedGear = {
      weapon: { stats: { maxHp: 5, maxMana: 3, damageBonus: 1 } },
      breastplate: null,
      offhand: null,
    }
    const { save: out, changed } = migrateSave(save)
    assert.equal(out.equippedGear.weapon.stats.maxHpPct, 5)
    assert.equal(out.equippedGear.weapon.stats.maxManaPct, 3)
    assert.ok(!('maxHp' in out.equippedGear.weapon.stats))
    assert.ok(!('maxMana' in out.equippedGear.weapon.stats))
    assert.equal(changed, true)
  })

  test('adds missing hero keys', () => {
    const save = MetaProgression.defaultSave()
    delete save.ranger
    delete save.engineer
    delete save.mage
    delete save.vampire
    delete save.necromancer
    const { save: out, changed } = migrateSave(save)
    assert.ok(out.ranger)
    assert.ok(out.engineer)
    assert.ok(out.mage)
    assert.ok(out.vampire)
    assert.ok(out.necromancer)
    assert.equal(changed, true)
  })

  test('filters invalid global passives', () => {
    const save = MetaProgression.defaultSave()
    save.globalPassives = ['courage', 'not-a-real-passive']
    const { save: out, changed } = migrateSave(save)
    assert.deepEqual(out.globalPassives, ['courage'])
    assert.equal(changed, true)
  })

  test('resets locked character selection to warrior', () => {
    const save = MetaProgression.defaultSave()
    save.selectedCharacter = 'mage'
    save.unlockedHeroes = ['warrior']
    const { save: out, changed } = migrateSave(save)
    assert.equal(out.selectedCharacter, 'warrior')
    assert.equal(changed, true)
  })

  test('resets coming-soon character selection', () => {
    const save = MetaProgression.defaultSave()
    save.selectedCharacter = 'druid'
    const { save: out, changed } = migrateSave(save)
    assert.equal(out.selectedCharacter, 'warrior')
    assert.equal(changed, true)
  })

  test('ensures slam is in warrior upgrades', () => {
    const save = MetaProgression.defaultSave()
    save.warrior.upgrades = save.warrior.upgrades.filter(id => id !== 'slam')
    const { save: out, changed } = migrateSave(save)
    assert.ok(out.warrior.upgrades.includes('slam'))
    assert.equal(changed, true)
  })
})
