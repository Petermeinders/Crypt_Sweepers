import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canCraftRecipe } from '../../js/controllers/TransmutationController.js'

const wardWrap = {
  ingredientA: 'smelling-salts',
  ingredientB: 'rope-coil',
}

const goldRush = {
  ingredientA: 'loose-pouch',
  ingredientB: 'loose-pouch',
}

const trapfindersKit = {
  ingredientA: 'rope-coil',
  ingredientB: 'rope-coil',
}

describe('canCraftRecipe', () => {
  it('allows distinct two-ingredient recipes when both are present', () => {
    const stash = [
      { id: 'smelling-salts', qty: 1 },
      { id: 'rope-coil', qty: 1 },
    ]
    assert.equal(canCraftRecipe(wardWrap, stash), true)
  })

  it('requires two copies when both ingredients are the same item', () => {
    const stash = [{ id: 'loose-pouch', qty: 1 }]
    assert.equal(canCraftRecipe(goldRush, stash), false)
    assert.equal(canCraftRecipe(trapfindersKit, [{ id: 'rope-coil', qty: 1 }]), false)
  })

  it('allows same-item recipes when total qty meets the sum', () => {
    assert.equal(canCraftRecipe(goldRush, [{ id: 'loose-pouch', qty: 2 }]), true)
    assert.equal(canCraftRecipe(trapfindersKit, [{ id: 'rope-coil', qty: 2 }]), true)
  })

  it('only highlights ward wrap for mixed single stacks', () => {
    const stash = [
      { id: 'loose-pouch', qty: 1 },
      { id: 'rope-coil', qty: 1 },
      { id: 'smelling-salts', qty: 1 },
    ]
    assert.equal(canCraftRecipe(wardWrap, stash), true)
    assert.equal(canCraftRecipe(goldRush, stash), false)
    assert.equal(canCraftRecipe(trapfindersKit, stash), false)
  })
})
