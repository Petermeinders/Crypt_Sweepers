import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { MODIFIERS, pickModifier } from '../../js/systems/FloorModifiers.js'
import { withRandomSequence } from '../helpers/mockRandom.mjs'

describe('pickModifier', () => {
  test('returns null on rest floors', () => {
    withRandomSequence([0], () => {
      assert.equal(pickModifier(10, true, false), null)
    })
  })

  test('returns null on boss floors', () => {
    withRandomSequence([0], () => {
      assert.equal(pickModifier(10, false, true), null)
    })
  })

  test('returns null below floor 6', () => {
    withRandomSequence([0], () => {
      assert.equal(pickModifier(5, false, false), null)
    })
  })

  test('floor 6 always picks a modifier', () => {
    withRandomSequence([0, 0], () => {
      const mod = pickModifier(6, false, false)
      assert.ok(mod)
      assert.ok(MODIFIERS.some(m => m.id === mod.id))
    })
  })

  test('floor 10 may skip modifier when roll fails chance gate', () => {
    withRandomSequence([0.99], () => {
      assert.equal(pickModifier(10, false, false), null)
    })
  })
})

describe('MODIFIERS schema', () => {
  test('every modifier has required fields', () => {
    for (const mod of MODIFIERS) {
      assert.equal(typeof mod.id, 'string')
      assert.equal(typeof mod.name, 'string')
      assert.equal(typeof mod.description, 'string')
      assert.ok(mod.weight >= 1)
      assert.equal(typeof mod.apply, 'function')
    }
  })

  test('modifier ids are unique', () => {
    const ids = MODIFIERS.map(m => m.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})
