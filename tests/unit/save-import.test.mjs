import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import MetaProgression from '../../js/systems/MetaProgression.js'
import { importSaveData, salvageSaveImport, mergeSaveOntoDefaults } from '../../js/save/SaveImporter.js'

describe('SaveImporter', () => {
  test('importSaveData merges unknown keys onto defaults', () => {
    const raw = {
      version: '1.2',
      persistentGold: 42,
      scrap: 7,
      warrior: { totalXP: 100, upgrades: ['slam'] },
    }
    const { save, partial } = importSaveData(JSON.stringify(raw))
    assert.equal(partial, false)
    assert.equal(save.persistentGold, 42)
    assert.equal(save.scrap, 7)
    assert.equal(save.warrior.totalXP, 100)
    assert.ok(save.settings)
    assert.ok(save.unlockedHeroes.includes('warrior'))
  })

  test('salvageSaveImport recovers currencies when version is missing', () => {
    const raw = {
      persistentGold: 500,
      scrap: 12,
      warrior: { totalXP: 250 },
      ranger: { totalXP: 80, upgrades: ['ricochet'] },
    }
    const result = salvageSaveImport(JSON.stringify(raw))
    assert.ok(result)
    assert.equal(result.partial, true)
    assert.ok(result.recoveredTiers.includes('currencies'))
    assert.equal(result.save.persistentGold, 500)
    assert.equal(result.save.scrap, 12)
    assert.equal(result.save.warrior.totalXP, 250)
  })

  test('salvageSaveImport recovers hero unlocks and passives', () => {
    const raw = {
      persistentGold: 100,
      unlockedHeroes: ['warrior', 'ranger', 'mage'],
      globalPassives: ['courage'],
      bestiarySeen: ['skeleton'],
      trinketsSeen: ['lucky-charm'],
      selectedCharacter: 'mage',
      mage: { totalXP: 50, upgrades: ['chain-lightning'] },
    }
    const result = salvageSaveImport(JSON.stringify(raw))
    assert.ok(result)
    assert.ok(result.recoveredTiers.includes('character-unlocks'))
    assert.ok(result.recoveredTiers.includes('other-unlocks'))
    assert.deepEqual(result.save.unlockedHeroes.sort(), ['mage', 'ranger', 'warrior'])
    assert.deepEqual(result.save.globalPassives, ['courage'])
    assert.equal(result.save.selectedCharacter, 'mage')
  })

  test('salvageSaveImport returns null for invalid JSON', () => {
    assert.equal(salvageSaveImport('not json'), null)
  })

  test('mergeSaveOntoDefaults preserves defaults for missing nested settings', () => {
    const merged = mergeSaveOntoDefaults({ version: '1.2', persistentGold: 9 })
    assert.equal(merged.persistentGold, 9)
    assert.equal(merged.settings.difficulty, 'normal')
    assert.ok(merged.warrior.upgrades.includes('slam'))
  })
})
