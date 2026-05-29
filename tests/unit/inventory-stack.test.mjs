import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { mergeDuplicateStacks } from '../../js/controllers/InventoryController.js'

describe('mergeDuplicateStacks', () => {
  test('merges smaller stack into larger for same item id', () => {
    const inv = [
      { id: 'potion-red', qty: 3 },
      { id: 'potion-red', qty: 2 },
    ]
    assert.equal(mergeDuplicateStacks(inv), true)
    assert.equal(inv[0].qty, 5)
    assert.equal(inv[1], null)
  })

  test('respects maxStack and keeps overflow in smaller stack', () => {
    const inv = [
      { id: 'potion-red', qty: 4 },
      { id: 'potion-red', qty: 3 },
    ]
    assert.equal(mergeDuplicateStacks(inv), true)
    assert.equal(inv[0].qty, 5)
    assert.equal(inv[1].qty, 2)
  })

  test('consolidates three stacks into two full stacks', () => {
    const inv = [
      { id: 'potion-red', qty: 5 },
      { id: 'potion-red', qty: 3 },
      { id: 'potion-red', qty: 2 },
    ]
    assert.equal(mergeDuplicateStacks(inv), true)
    const stacks = inv.filter(e => e?.qty > 0).map(e => e.qty).sort()
    assert.deepEqual(stacks, [5, 5])
  })

  test('is idempotent when nothing to merge', () => {
    const inv = [{ id: 'potion-red', qty: 3 }]
    assert.equal(mergeDuplicateStacks(inv), false)
    assert.equal(inv[0].qty, 3)
  })

  test('ignores non-stackable items', () => {
    const inv = [
      { id: 'blood-pact', qty: 1 },
      { id: 'blood-pact', qty: 1 },
    ]
    assert.equal(mergeDuplicateStacks(inv), false)
    assert.equal(inv.length, 2)
  })
})
