// TransmutationController — Backpack ⚗️ Transmutation tab logic.
// Manages the 3-ingredient + result UI, recipe list, and crafting.

import { TRAN_RECIPES } from '../data/transmutation.js'
import { ITEMS } from '../data/items.js'
import { GEMS } from '../data/gems.js'
import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import { canAddToBackpack } from './InventoryController.js'
import { activateBackpackTab, getBackpackTabIndex } from './BackpackTabs.js'

// Ingredient IDs used across all recipes (for the Materials tab)
const MATERIAL_IDS = new Set(
  TRAN_RECIPES.flatMap(r => [r.ingredientA, r.ingredientB, r.ingredientC].filter(Boolean))
)

// Slot state: up to 3 ingredient slots (indices 0-2); result is computed
let _slots = [null, null, null]   // each: { id, qty } or null
let _activeRecipe = null

// ── Helpers ─────────────────────────────────────────────────────

function _getIngredientDef(id) {
  return ITEMS[id] ?? GEMS[id] ?? null
}

function _findMatchingRecipe(save) {
  const filled = _slots.filter(Boolean)
  if (filled.length < 2) return null

  const counts = {}
  for (const s of filled) {
    if (!s) continue
    counts[s.id] = (counts[s.id] ?? 0) + (s.qty ?? 1)
  }

  for (const recipe of TRAN_RECIPES) {
    if (recipe.isGem) {
      // 3-ingredient gem recipe: needs ingredientA, B, C each × stackA/B/C
      if (filled.length < 3) continue
      if (!recipe.ingredientC) continue
      const needed = {
        [recipe.ingredientA]: recipe.stackA ?? 10,
        [recipe.ingredientB]: recipe.stackB ?? 10,
        [recipe.ingredientC]: recipe.stackC ?? 10,
      }
      let match = true
      for (const [id, qty] of Object.entries(needed)) {
        if ((counts[id] ?? 0) < qty) { match = false; break }
      }
      if (!match) continue
      if (!save?.meta?.unlockedGemRecipes?.includes(recipe.result)) continue
      return recipe
    } else {
      // 2-ingredient consumable recipe
      const a = recipe.ingredientA
      const b = recipe.ingredientB
      if (a === b) {
        if ((counts[a] ?? 0) < 2) continue
      } else {
        if (!counts[a] || !counts[b]) continue
      }
      return recipe
    }
  }
  return null
}

// ── Slot management ──────────────────────────────────────────────

export function tranClearSlots() {
  _slots = [null, null, null]
  _activeRecipe = null
}

export function tranSetSlot(index, id, qty = 1) {
  _slots[index] = id ? { id, qty } : null
}

export function tranGetSlots() {
  return [..._slots]
}

// ── UI render ────────────────────────────────────────────────────

export function renderTranPanel(ctx) {
  const save = ctx.GameController?.getSave?.() ?? null
  _activeRecipe = _findMatchingRecipe(save)
  _renderResultSlot()
  _renderIngredientSlots(ctx)
  _renderCraftButton(save)
  renderTranRecipeList(ctx, save)
}

function _renderResultSlot() {
  const el = document.getElementById('tran-result-slot')
  if (!el) return
  el.innerHTML = ''
  if (_activeRecipe) {
    const id = _activeRecipe.result
    const def = _getIngredientDef(id)
    el.classList.add('filled')
    if (def?.spriteSrc) {
      const img = document.createElement('img')
      img.src = def.spriteSrc
      img.alt = def.name ?? id
      el.appendChild(img)
    } else {
      el.textContent = def?.icon ?? '?'
    }
    const label = document.createElement('span')
    label.className = 'tran-result-name'
    label.style.cssText = 'font-size:0.58rem;color:#ddd;text-align:center;padding:0 2px;'
    label.textContent = def?.name ?? id
    el.appendChild(label)
  } else {
    el.classList.remove('filled')
    const label = document.createElement('span')
    label.className = 'tran-slot-label'
    label.textContent = 'Result'
    el.appendChild(label)
  }
}

function _renderIngredientSlots(ctx) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`tran-ing-${i}`)
    if (!el) continue
    el.innerHTML = ''
    const slot = _slots[i]
    if (slot) {
      el.classList.add('filled')
      const def = _getIngredientDef(slot.id)
      if (def?.spriteSrc) {
        const img = document.createElement('img')
        img.src = def.spriteSrc
        img.alt = def.name ?? slot.id
        el.appendChild(img)
      } else {
        el.textContent = def?.icon ?? '?'
      }
      const nameLabel = document.createElement('span')
      nameLabel.className = 'tran-ing-name'
      nameLabel.textContent = def?.name ?? slot.id
      el.appendChild(nameLabel)
      if (slot.qty > 1) {
        const stack = document.createElement('span')
        stack.className = 'tran-slot-stack'
        stack.textContent = `×${slot.qty}`
        el.appendChild(stack)
      }
      const clearBtn = document.createElement('span')
      clearBtn.style.cssText = 'position:absolute;top:1px;right:3px;font-size:0.6rem;color:#aaa;cursor:pointer;'
      clearBtn.textContent = '✕'
      const idx = i
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        _slots[idx] = null
        _activeRecipe = _findMatchingRecipe(ctx.GameController?.getSave?.() ?? null)
        _renderResultSlot()
        _renderIngredientSlots(ctx)
        _renderCraftButton(ctx.GameController?.getSave?.() ?? null)
        renderTranRecipeList(ctx, ctx.GameController?.getSave?.() ?? null)
      })
      el.appendChild(clearBtn)
    } else {
      el.classList.remove('filled')
      const label = document.createElement('span')
      label.className = 'tran-slot-label'
      label.textContent = 'Ingredient'
      el.appendChild(label)
      // Tap empty slot → go to Materials tab
      el.style.cursor = 'pointer'
      el.addEventListener('click', () => {
        activateBackpackTab('tab-materials')
      })
    }
  }
}

function _renderCraftButton(save) {
  const btn = document.getElementById('tran-craft-btn')
  if (!btn) return
  const stash = Array.isArray(save?.meta?.ingredientStash) ? save.meta.ingredientStash : []
  const craftable = _activeRecipe && canCraftRecipe(_activeRecipe, stash)
  btn.disabled = !craftable
}

export function renderTranRecipeList(ctx, save) {
  const list = document.getElementById('tran-recipe-list')
  if (!list) return
  list.innerHTML = ''
  const unlockedGems = save?.meta?.unlockedGemRecipes ?? []
  const stash = Array.isArray(save?.meta?.ingredientStash) ? save.meta.ingredientStash : []

  // Build filter from currently filled slots — only show recipes that match all filled ingredients
  const filledIds = _slots.filter(Boolean).map(s => s.id)
  const _recipeMatchesFilter = (recipe) => {
    if (!filledIds.length) return true
    const recipeIds = [recipe.ingredientA, recipe.ingredientB, recipe.ingredientC].filter(Boolean)
    return filledIds.every(id => recipeIds.includes(id))
  }

  const visible = []
  for (let i = 0; i < TRAN_RECIPES.length; i++) {
    const recipe = TRAN_RECIPES[i]
    if (recipe.isGem && !unlockedGems.includes(recipe.result)) continue
    visible.push({
      recipe,
      order: i,
      craftable: canCraftRecipe(recipe, stash),
      matchesFilter: _recipeMatchesFilter(recipe),
    })
  }

  visible.sort((a, b) => {
    if (a.craftable !== b.craftable) return a.craftable ? -1 : 1
    if (a.matchesFilter !== b.matchesFilter) return a.matchesFilter ? -1 : 1
    return a.order - b.order
  })

  let shownCount = 0
  for (const { recipe, craftable, matchesFilter } of visible) {
    const def = _getIngredientDef(recipe.result)
    const card = document.createElement('div')
    card.className = 'tran-recipe-card'
    if (recipe.isGem) card.classList.add('gem-recipe')
    if (craftable) card.classList.add('tran-recipe-active')
    else card.classList.add('tran-recipe-locked')
    if (!matchesFilter && filledIds.length) card.classList.add('tran-recipe-dimmed')
    shownCount++

    // Sprite
    if (def?.spriteSrc) {
      const img = document.createElement('img')
      img.src = def.spriteSrc
      img.alt = def.name ?? recipe.result
      card.appendChild(img)
    }

    // Info
    const info = document.createElement('div')
    info.className = 'tran-recipe-info'
    const nameEl = document.createElement('div')
    nameEl.className = 'tran-recipe-name'
    nameEl.textContent = def?.name ?? recipe.result
    info.appendChild(nameEl)

    const hintEl = document.createElement('div')
    hintEl.className = 'tran-recipe-hint'
    hintEl.textContent = recipe.hint ?? ''
    info.appendChild(hintEl)

    const ingEl = document.createElement('div')
    ingEl.className = 'tran-recipe-ingredients'
    const ingNames = [recipe.ingredientA, recipe.ingredientB, recipe.ingredientC]
      .filter(Boolean)
      .map(id => {
        const d = _getIngredientDef(id)
        const name = d?.name ?? id
        const needStack = recipe.isGem ? (recipe.stackA ?? 10) : 1
        return needStack > 1 ? `${name} ×${needStack}` : name
      })
    ingEl.textContent = ingNames.join(' + ')
    info.appendChild(ingEl)
    card.appendChild(info)

    // Click to load recipe into slots
    card.addEventListener('click', () => {
      _loadRecipeIntoSlots(recipe, ctx)
    })

    list.appendChild(card)
  }

  if (shownCount === 0) {
    const msg = document.createElement('div')
    msg.className = 'tran-recipe-empty'
    msg.textContent = 'No recipes available yet.'
    list.appendChild(msg)
  }
}

function _stashQty(stash, id) {
  return stash.filter(s => s?.id === id).reduce((sum, s) => sum + (s.qty ?? 1), 0)
}

/** True when ingredient stash holds enough for this recipe (ignores tran slot UI). */
export function canCraftRecipe(recipe, stash) {
  const neededById = {}
  for (const { id, qty } of _recipeIngredientNeeds(recipe)) {
    neededById[id] = (neededById[id] ?? 0) + qty
  }
  for (const [id, qty] of Object.entries(neededById)) {
    if (_stashQty(stash, id) < qty) return false
  }
  return true
}

function _recipeIngredientNeeds(recipe) {
  return [
    { id: recipe.ingredientA, qty: recipe.stackA ?? 1 },
    { id: recipe.ingredientB, qty: recipe.stackB ?? 1 },
    ...(recipe.ingredientC ? [{ id: recipe.ingredientC, qty: recipe.stackC ?? 1 }] : []),
  ]
}

export function refreshTranPanelIfOpen(ctx) {
  const ov = document.getElementById('backpack-overlay')
  if (!ov?.classList.contains('is-open')) return
  if (getBackpackTabIndex() !== 2) return
  renderTranPanel(ctx)
}

function _loadRecipeIntoSlots(recipe, ctx) {
  const save  = ctx.GameController?.getSave?.() ?? null
  const stash = Array.isArray(save?.meta?.ingredientStash) ? save.meta.ingredientStash : []

  const ingredientsNeeded = [
    { id: recipe.ingredientA, need: recipe.stackA ?? 1 },
    { id: recipe.ingredientB, need: recipe.stackB ?? 1 },
    ...(recipe.ingredientC ? [{ id: recipe.ingredientC, need: recipe.stackC ?? 1 }] : []),
  ]

  // Only fill empty slots — track running committed per id to avoid over-filling
  const loopCommitted = {}   // extra committed during this fill pass
  for (let i = 0; i < ingredientsNeeded.length; i++) {
    if (_slots[i]) continue   // already filled
    const { id, need } = ingredientsNeeded[i]
    const alreadyIn = tranSlotCommitted(id) + (loopCommitted[id] ?? 0)
    const have = _stashQty(stash, id) - alreadyIn
    if (have <= 0) continue
    const qty = Math.min(have, need)
    _slots[i] = { id, qty, need }
    loopCommitted[id] = (loopCommitted[id] ?? 0) + qty
  }

  _activeRecipe = _findMatchingRecipe(save)
  _renderResultSlot()
  _renderIngredientSlots(ctx)
  _renderCraftButton(save)
  renderTranRecipeList(ctx, save)
}

// ── Crafting ─────────────────────────────────────────────────────

export async function executeCraft(ctx) {
  if (!_activeRecipe) return

  const recipe = _activeRecipe
  const { GameController, UI } = ctx
  const save = GameController.getSave?.()
  if (!save) return

  const stash = Array.isArray(save.meta?.ingredientStash) ? save.meta.ingredientStash : []
  if (!canCraftRecipe(recipe, stash)) {
    UI?.setMessage?.('Missing ingredients in Materials.', true)
    renderTranPanel(ctx)
    return
  }

  if (!canAddToBackpack(ctx, recipe.result)) {
    UI?.setMessage?.('Backpack full — make room before crafting.', true)
    return
  }

  const consumed = _recipeIngredientNeeds(recipe)
  const neededById = {}
  for (const { id, qty } of consumed) {
    neededById[id] = (neededById[id] ?? 0) + qty
  }
  for (const [id, qty] of Object.entries(neededById)) {
    let remaining = qty
    for (let i = stash.length - 1; i >= 0 && remaining > 0; i--) {
      const s = stash[i]
      if (!s || s.id !== id) continue
      const take = Math.min(s.qty ?? 1, remaining)
      s.qty = (s.qty ?? 1) - take
      remaining -= take
      if (s.qty <= 0) stash.splice(i, 1)
    }
    if (remaining > 0) {
      UI?.setMessage?.('Missing ingredients in Materials.', true)
      renderTranPanel(ctx)
      return
    }
  }

  const resultId = recipe.result
  await GameController.addItemToInventory?.(resultId)

  if (recipe.isGem && save.meta && !save.meta.unlockedGemRecipes.includes(resultId)) {
    save.meta.unlockedGemRecipes.push(resultId)
  }

  await SaveManager.save(save).catch(() => {})

  const resultDef = _getIngredientDef(resultId)
  UI?.setMessage?.(`Crafted ${resultDef?.name ?? resultId}.`)

  tranClearSlots()
  renderTranPanel(ctx)
  EventBus.emit('materials:changed')
  EventBus.emit('inventory:changed')
}

// ── Materials Panel ──────────────────────────────────────────────

export function renderMaterialsPanel(ctx) {
  const grid = document.getElementById('materials-grid')
  const empty = document.getElementById('materials-empty')
  if (!grid) return

  const inventory = ctx.GameController?.getInventory?.() ?? []
  const materials = inventory.filter(entry => entry?.id && MATERIAL_IDS.has(entry.id))

  // Aggregate by id
  const byId = {}
  for (const entry of materials) {
    if (!byId[entry.id]) byId[entry.id] = 0
    byId[entry.id] += entry.qty ?? 1
  }

  grid.innerHTML = ''
  const ids = Object.keys(byId)

  if (ids.length === 0) {
    empty?.classList.remove('hidden')
    return
  }
  empty?.classList.add('hidden')

  for (const id of ids) {
    const def = ITEMS[id] ?? GEMS[id] ?? null
    const qty = Math.min(byId[id], 10)
    const cell = document.createElement('div')
    cell.className = 'materials-cell'
    cell.title = def?.name ?? id

    if (def?.spriteSrc) {
      const img = document.createElement('img')
      img.src = def.spriteSrc
      img.alt = def.name ?? id
      cell.appendChild(img)
    } else {
      const icon = document.createElement('span')
      icon.style.fontSize = '1.6rem'
      icon.textContent = def?.icon ?? '?'
      cell.appendChild(icon)
    }

    const nameEl = document.createElement('span')
    nameEl.className = 'materials-cell-name'
    nameEl.textContent = def?.name ?? id
    cell.appendChild(nameEl)

    if (qty > 0) {
      const stackEl = document.createElement('span')
      stackEl.className = 'materials-cell-stack'
      stackEl.textContent = `×${qty}`
      cell.appendChild(stackEl)
    }

    // Click to load into tran tab
    cell.addEventListener('click', () => {
      switchToTranWithItem(ctx, id, qty)
    })

    grid.appendChild(cell)
  }
}

// Called from BackpackPanel or Materials tab when clicking an ingredient item
/** How many of itemId are already committed across all slots. */
export function tranSlotCommitted(itemId) {
  return _slots.reduce((sum, s) => sum + (s?.id === itemId ? (s.qty ?? 1) : 0), 0)
}

export function switchToTranWithItem(ctx, itemId, qty = 1) {
  activateBackpackTab('tab-tran')

  // Check stash quantity vs already-committed slots
  const save  = ctx.GameController?.getSave?.()
  const stash = Array.isArray(save?.meta?.ingredientStash) ? save.meta.ingredientStash : []
  const available = _stashQty(stash, itemId) - tranSlotCommitted(itemId)
  if (available <= 0) {
    renderTranPanel(ctx)
    return
  }

  // Place item in first empty slot
  const emptyIdx = _slots.findIndex(s => !s)
  if (emptyIdx !== -1) {
    _slots[emptyIdx] = { id: itemId, qty: Math.min(qty, available) }
  }
  renderTranPanel(ctx)
}
