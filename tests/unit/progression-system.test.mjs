import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import ProgressionSystem from '../../js/systems/ProgressionSystem.js'
import { withRandomSequence } from '../helpers/mockRandom.mjs'

describe('ProgressionSystem.getAbilityDef', () => {
  test('returns warrior vitality stat ability', () => {
    const def = ProgressionSystem.getAbilityDef('vitality', 'warrior')
    assert.equal(def.name, 'Vitality')
    assert.equal(def.effect.type, 'buff-hp')
  })

  test('returns null for unknown id', () => {
    assert.equal(ProgressionSystem.getAbilityDef('not-real'), null)
  })
})

describe('ProgressionSystem.applyAbility', () => {
  test('vitality increases maxHp and heals', () => {
    const player = { maxHp: 50, hp: 40, abilities: [] }
    const kind = ProgressionSystem.applyAbility('vitality', player, 'warrior')
    assert.equal(kind, 'buff-hp')
    assert.equal(player.maxHp, 55)
    assert.equal(player.hp, 45)
    assert.ok(player.abilities.includes('vitality'))
  })
})

describe('ProgressionSystem.getChoices', () => {
  test('level 2 with frozen meta unlocks offers only actives', () => {
    withRandomSequence([0.1, 0.2, 0.3], () => {
      const player = {
        level: 2,
        abilities: [],
        unlockedActives: [],
      }
      const choices = ProgressionSystem.getChoices(player, 'warrior', ['slam'], 3)
      assert.ok(choices.length >= 1)
      assert.ok(choices.every(c => c.kind === 'active'))
      assert.ok(choices.every(c => c.id === 'slam'))
    })
  })

  test("level 2 with Scholar's Notes (4 slots) pads with a stat when actives are exhausted", () => {
    withRandomSequence([0.1, 0.2, 0.3], () => {
      const player = { level: 2, abilities: [], unlockedActives: [] }
      const meta = ['slam', 'blinding-light', 'divine-light']
      const choices = ProgressionSystem.getChoices(player, 'warrior', meta, 4)
      assert.equal(choices.length, 4)
      assert.equal(choices.filter(c => c.kind === 'active').length, 3)
      assert.equal(choices.filter(c => c.kind === 'stat').length, 1)
    })
  })

  test('frozen unlock state excludes already-unlocked actives from forced pool', () => {
    withRandomSequence([0.5], () => {
      const player = {
        level: 4,
        abilities: [],
        unlockedActives: ['slam'],
      }
      const choices = ProgressionSystem.getChoices(player, 'warrior', ['slam'], 3)
      assert.ok(choices.length >= 1)
      assert.ok(!choices.some(c => c.kind === 'active' && c.id === 'slam'))
    })
  })
})
