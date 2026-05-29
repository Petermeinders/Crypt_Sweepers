import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { canForgeRecipe } from '../../js/controllers/ForgeController.js'
import { FORGE_RECIPES } from '../../js/data/combinations.js'

const delversKit = FORGE_RECIPES.find(r => r.id === 'recipe-delvers-kit')

describe('canForgeRecipe', () => {
  test('allows forge with a full backpack when two distinct ingredients are present', () => {
    const inv = [
      { id: 'cursed-lockpick', qty: 1 },
      { id: 'scavengers-bag', qty: 1 },
      { id: 'blood-pact', qty: 1 },
      { id: 'fire-ring', qty: 1 },
      { id: 'thorn-wrap', qty: 1 },
      { id: 'echo-charm', qty: 1 },
      { id: 'surge-pearl', qty: 1 },
      { id: 'lucky-rabbit-foot', qty: 1 },
      { id: 'bone-dice', qty: 1 },
    ]
    assert.equal(inv.length, 9)
    assert.equal(canForgeRecipe(inv, delversKit), true)
  })

  test('still requires both ingredients', () => {
    const inv = Array.from({ length: 9 }, (_, i) => ({ id: `item-${i}`, qty: 1 }))
    inv[0] = { id: 'cursed-lockpick', qty: 1 }
    assert.equal(canForgeRecipe(inv, delversKit), false)
  })

  test('duplicate recipes count stack qty, not just slot count', () => {
    const honedEdge = FORGE_RECIPES.find(r => r.id === 'recipe-honed-edge')
    const inv = [{ id: 'whetstone', qty: 2 }]
    assert.equal(canForgeRecipe(inv, honedEdge), true)
    assert.equal(canForgeRecipe([{ id: 'whetstone', qty: 1 }], honedEdge), false)
  })
})
