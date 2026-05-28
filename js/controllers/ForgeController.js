import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { session } from '../core/RunContext.js'

export function openForge(ctx, tile) {
  if (tile.forgeUsed) { UI.setMessage('The forge has already been used this sanctuary.'); return }
  const inv = session.run.player.inventory
  const recipes = FORGE_RECIPES.map(r => {
    // For duplicate recipes (same ingredient), need two in inventory
    const isDupe = r.ingredientA === r.ingredientB
    const count  = inv.filter(e => e?.id === r.ingredientA).length
    const hasA   = isDupe ? count >= 2 : inv.some(e => e?.id === r.ingredientA)
    const hasB   = isDupe ? true        : inv.some(e => e?.id === r.ingredientB)
    const canForge = hasA && hasB && ctx.canAddToBackpack(r.result)
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
  const isDupe = recipe.ingredientA === recipe.ingredientB
  const count  = inv.filter(e => e?.id === recipe.ingredientA).length
  const hasA   = isDupe ? count >= 2 : inv.some(e => e?.id === recipe.ingredientA)
  const hasB   = isDupe ? true        : inv.some(e => e?.id === recipe.ingredientB)
  if (!hasA || !hasB) { UI.setMessage('Missing ingredients!', true); return }

  ctx.dropItem(recipe.ingredientA)
  if (!isDupe) ctx.dropItem(recipe.ingredientB)
  else         ctx.dropItem(recipe.ingredientA)   // drop second copy

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
