import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { session } from '../core/RunContext.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'

function countIngredientQty(inv, id) {
  return inv.reduce((sum, e) => (e?.id === id ? sum + (e.qty ?? 1) : sum), 0)
}

function cloneInventory(inv) {
  return inv.map(e => (e ? { ...e } : e))
}

/** Mirror dropItem consumption — one unit removed from the first matching stack. */
function simulateDropOne(inv, id) {
  const entry = inv.find(e => e?.id === id)
  if (!entry) return false
  entry.qty = (entry.qty ?? 1) - 1
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
  return true
}

function canFitInBackpack(inv, id) {
  const item = ITEMS[id]
  if (!item) return false
  if (item.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    if (inv.some(e => e?.id === id && (e.qty ?? 1) < maxS)) return true
  }
  return inv.filter(e => e != null).length < BACKPACK_MAX_SLOTS
}

/** True when ingredients are present and the merged result fits after both are consumed. */
export function canForgeRecipe(inv, recipe) {
  const isDupe = recipe.ingredientA === recipe.ingredientB
  const hasA = isDupe
    ? countIngredientQty(inv, recipe.ingredientA) >= 2
    : countIngredientQty(inv, recipe.ingredientA) >= 1
  const hasB = isDupe ? true : countIngredientQty(inv, recipe.ingredientB) >= 1
  if (!hasA || !hasB) return false
  if (canFitInBackpack(inv, recipe.result)) return true

  const sim = cloneInventory(inv)
  if (!simulateDropOne(sim, recipe.ingredientA)) return false
  if (isDupe) {
    if (!simulateDropOne(sim, recipe.ingredientA)) return false
  } else if (!simulateDropOne(sim, recipe.ingredientB)) {
    return false
  }
  return canFitInBackpack(sim, recipe.result)
}

export function openForge(ctx, tile) {
  if (tile.forgeUsed) { UI.setMessage('The forge has already been used this sanctuary.'); return }
  const inv = session.run.player.inventory
  const recipes = FORGE_RECIPES.map(r => {
    const isDupe = r.ingredientA === r.ingredientB
    const qtyA   = countIngredientQty(inv, r.ingredientA)
    const hasA   = isDupe ? qtyA >= 2 : qtyA >= 1
    const hasB   = isDupe ? true : countIngredientQty(inv, r.ingredientB) >= 1
    const canForge = canForgeRecipe(inv, r)
    return { ...r, canForge, hasA, hasB, isDupe }
  })
  UI.showForgeOverlay(recipes, ITEMS, (recipeId) => doForge(ctx, tile, recipeId), () => {
    UI.hideForgeOverlay()
    UI.setMessage('The forge cools as you step away.')
  })
}

export async function doForge(ctx, tile, recipeId) {
  const recipe = FORGE_RECIPES.find(r => r.id === recipeId)
  if (!recipe) return
  const inv    = session.run.player.inventory
  if (!canForgeRecipe(inv, recipe)) { UI.setMessage('Missing ingredients!', true); return }

  ctx.dropItem(recipe.ingredientA)
  if (recipe.ingredientA === recipe.ingredientB) ctx.dropItem(recipe.ingredientA)
  else                                           ctx.dropItem(recipe.ingredientB)

  UI.hideForgeOverlay()
  await ctx.addToBackpack(recipe.result)
  EventBus.emit('inventory:changed')

  if (TrinketCodex.registerIfNew(session.save, recipe.result)) {
    await SaveManager.save(session.save).catch(() => {})
    await UI.showTrinketDiscovery(recipe.result)
  }

  tile.forgeUsed = true
  EventBus.emit('audio:play', { sfx: 'spell' })
  UI.setMessage(`⚒️ Forged: ${ITEMS[recipe.result]?.name ?? recipe.result}!`)
}
