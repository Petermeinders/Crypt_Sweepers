// MaterialsController — persistent ingredient stash between runs.
// Stored in save.meta.ingredientStash as { id, qty }[].
// Base 6 slots; player can unlock up to 3 more (9 total) at 50 scrap each.

import { ITEMS } from '../data/items.js'
import { session } from '../core/RunContext.js'
import EventBus from '../core/EventBus.js'
import { adjustScrap } from './GearController.js'
import { switchToTranWithItem, renderTranPanel, tranSlotCommitted, refreshTranPanelIfOpen, executeCraft } from './TransmutationController.js'
import { useIngredientFromStash, _materialsBridge } from './InventoryController.js'
import SaveManager from '../save/SaveManager.js'
import {
  activateBackpackTab,
  wireBackpackPanelsScroll,
  setBackpackTabHandlers,
  getBackpackTabIndex,
} from './BackpackTabs.js'

// Wire circular-safe bridge so InventoryController can call removeFromMaterials
_materialsBridge.removeFromMaterials = (save, id, qty) => removeFromMaterials(save, id, qty)

const BASE_SLOTS      = 6
const MAX_BONUS_SLOTS = 3
const SLOT_COST       = 50  // scrap per slot

export function getMaterialsMaxSlots(save) {
  return BASE_SLOTS + Math.min(save?.meta?.materialsBonusSlots ?? 0, MAX_BONUS_SLOTS)
}

export function getMaterialsStash(save) {
  if (!Array.isArray(save?.meta?.ingredientStash)) return []
  return save.meta.ingredientStash
}

/** True when the stash can accept another unit (stack merge or empty slot). */
export function canAddToMaterialsStash(save, itemId, qty = 1) {
  const item = ITEMS[itemId]
  if (!item || qty <= 0) return false
  if (!Array.isArray(save?.meta?.ingredientStash)) return qty === 1

  const stash = save.meta.ingredientStash
  const maxSlots = getMaterialsMaxSlots(save)
  let remaining = qty

  if (item.stackable) {
    const maxS = item.maxStack ?? 99
    for (const s of stash) {
      if (!s || s.id !== itemId || s.qty >= maxS) continue
      remaining -= Math.min(remaining, maxS - s.qty)
      if (remaining <= 0) return true
    }
  }

  const freeSlots = maxSlots - stash.filter(Boolean).length
  return remaining <= freeSlots
}

/** Why a pickup cannot auto-add; null when merge or a new slot is available. */
export function getMaterialsPickupBlockReason(save, itemId) {
  if (canAddToMaterialsStash(save, itemId)) return null
  const item = ITEMS[itemId]
  if (!item) return { type: 'unknown', name: itemId }

  const stash = getMaterialsStash(save)
  if (item.stackable) {
    const maxS = item.maxStack ?? 99
    const existing = stash.find(s => s?.id === itemId)
    if (existing && (existing.qty ?? 1) >= maxS) {
      return {
        type: 'stack_full',
        name: item.name ?? itemId,
        qty: existing.qty ?? 1,
        maxStack: maxS,
      }
    }
  }
  return { type: 'slots_full', name: item.name ?? itemId }
}

/** True when this stash entry cannot accept another of the same item (at max stack). */
export function isMaterialsStackFull(entry) {
  if (!entry?.id) return false
  const item = ITEMS[entry.id]
  if (!item?.stackable) return false
  return (entry.qty ?? 1) >= (item.maxStack ?? 99)
}

/** Add directly to stash (chest drops, etc.) — does not touch backpack inventory. */
export function addToMaterialsStash(save, itemId, qty = 1) {
  if (!canAddToMaterialsStash(save, itemId, qty)) return false
  if (!Array.isArray(save?.meta?.ingredientStash)) save.meta.ingredientStash = []

  const stash = save.meta.ingredientStash
  const item = ITEMS[itemId]
  let remaining = qty

  while (remaining > 0) {
    if (item.stackable) {
      const maxS = item.maxStack ?? 99
      const existing = stash.find(s => s?.id === itemId && s.qty < maxS)
      if (existing) {
        existing.qty++
        remaining--
        continue
      }
    }
    stash.push({ id: itemId, qty: 1 })
    remaining--
  }

  SaveManager.save(save).catch(() => {})
  EventBus.emit('materials:changed')
  return true
}

/** Replace one occupied stash slot (materials-full swap prompt). */
export function forceReplaceMaterialsAtIndex(save, index, itemId) {
  if (!Array.isArray(save?.meta?.ingredientStash)) save.meta.ingredientStash = []
  const stash = save.meta.ingredientStash
  if (index < 0 || index >= getMaterialsMaxSlots(save)) return false
  stash[index] = { id: itemId, qty: 1 }
  SaveManager.save(save).catch(() => {})
  EventBus.emit('materials:changed')
  return true
}

/** Move an item from backpack to materials stash. Returns true if moved. */
export function moveToMaterials(ctx, itemId) {
  const save = ctx.GameController.getSave?.()
  if (!save) return false
  const maxSlots = getMaterialsMaxSlots(save)
  const stash    = getMaterialsStash(save)
  const item     = ITEMS[itemId]
  if (!item) return false

  // Stackable: merge into existing stack first
  if (item.stackable) {
    const maxS = item.maxStack ?? 99
    const existing = stash.find(s => s?.id === itemId && s.qty < maxS)
    if (existing) {
      existing.qty++
      ctx.GameController.consumeItemQty(itemId, 1)
      SaveManager.save(save).catch(() => {})
      EventBus.emit('materials:changed')
      return true
    }
  }

  const usedSlots = stash.filter(Boolean).length
  if (usedSlots >= maxSlots) return false   // stash full

  stash.push({ id: itemId, qty: 1 })
  ctx.GameController.consumeItemQty(itemId, 1)
  SaveManager.save(save).catch(() => {})
  EventBus.emit('materials:changed')
  return true
}

/** Remove an item from the stash (used when pulling into Tran slots). */
export function removeFromMaterials(save, itemId, qty = 1) {
  const stash = getMaterialsStash(save)
  let remaining = qty
  for (let i = 0; i < stash.length && remaining > 0; i++) {
    const s = stash[i]
    if (!s || s.id !== itemId) continue
    const take = Math.min(s.qty, remaining)
    s.qty -= take
    remaining -= take
    if (s.qty <= 0) stash.splice(i, 1)
  }
  SaveManager.save(save).catch(() => {})
  EventBus.emit('materials:changed')
}

/** Unlock one more materials slot for 50 scrap (up to 3 bonus slots). */
export function tryExpandMaterials(ctx) {
  const save = ctx.GameController.getSave?.()
  if (!save) return
  const current = save.meta.materialsBonusSlots ?? 0
  if (current >= MAX_BONUS_SLOTS) return
  const scrap = session.save?.scrap ?? 0
  if (scrap < SLOT_COST) {
    ctx.UI.setMessage(`Not enough scrap — need ${SLOT_COST} ⚙️ per slot.`, true)
    return
  }
  adjustScrap(-SLOT_COST)
  save.meta.materialsBonusSlots = current + 1
  SaveManager.save(save).catch(() => {})
  renderMaterialsPanel(ctx)
}

/** Unlock one more backpack slot for 50 scrap (up to 3 bonus slots). */
export function tryExpandBackpack(ctx) {
  const save = ctx.GameController.getSave?.()
  if (!save) return
  const current = save.meta.backpackBonusSlots ?? 0
  if (current >= 3) return
  const scrap = session.save?.scrap ?? 0
  if (scrap < SLOT_COST) {
    ctx.UI.setMessage(`Not enough scrap — need ${SLOT_COST} ⚙️ per slot.`, true)
    return
  }
  adjustScrap(-SLOT_COST)
  save.meta.backpackBonusSlots = current + 1
  SaveManager.save(save).catch(() => {})
  // Refresh backpack grid and button state
  ctx.renderBackpack?.()
  _syncBackpackExpandBtn(save)
}

// ── UI ───────────────────────────────────────────────────────────

export function renderMaterialsPanel(ctx) {
  const save        = ctx.GameController?.getSave?.()
  const stash       = getMaterialsStash(save)
  const bonusSlots  = save?.meta?.materialsBonusSlots ?? 0
  const maxSlots    = getMaterialsMaxSlots(save)
  const canExpand   = bonusSlots < MAX_BONUS_SLOTS
  const replaceMode = !!ctx.getPendingMaterialsId?.()
  const pendingId   = ctx.getPendingMaterialsId?.() ?? null
  const onReplace   = ctx.onMaterialsReplaceIndex

  const grid  = document.getElementById('materials-grid')
  const empty = document.getElementById('materials-empty')
  if (!grid) return

  grid.innerHTML = ''
  grid.classList.toggle('replace-mode', replaceMode)
  const occupied = stash.filter(Boolean)
  const showEmpty = !canExpand && occupied.length === 0

  if (empty) empty.classList.toggle('hidden', !showEmpty)

  // Render base + unlocked slots
  for (let i = 0; i < maxSlots; i++) {
    const entry = stash[i] ?? null
    const slot = document.createElement('div')
    slot.className = 'materials-slot' + (entry ? ' occupied' : '')
    const stackFullSame = replaceMode && pendingId && entry?.id === pendingId && isMaterialsStackFull(entry)
    if (replaceMode && entry && !stackFullSame) slot.classList.add('replace-target')
    if (stackFullSame) slot.classList.add('materials-slot-stack-full')

    if (entry) {
      const def       = ITEMS[entry.id]
      const committed = tranSlotCommitted(entry.id)
      const available = (entry.qty ?? 1) - committed
      const exhausted = available <= 0

      if (exhausted) slot.classList.add('materials-slot-exhausted')

      if (def?.spriteSrc) {
        const img = document.createElement('img')
        img.src = def.spriteSrc
        img.alt = def.name ?? entry.id
        img.className = 'materials-slot-img'
        slot.appendChild(img)
      } else {
        slot.textContent = def?.icon ?? '?'
      }
      // Show available/total qty
      const qtyEl = document.createElement('span')
      qtyEl.className = 'materials-slot-qty'
      const displayAvail = Math.max(0, available)
      qtyEl.textContent = committed > 0 ? `${displayAvail}/${entry.qty}` : entry.qty > 1 ? entry.qty : ''
      if (qtyEl.textContent) slot.appendChild(qtyEl)

      const name = document.createElement('span')
      name.className = 'materials-slot-name'
      name.textContent = def?.name ?? entry.id
      slot.appendChild(name)

      if (replaceMode) {
        const badge = document.createElement('div')
        badge.className = 'bp-replace-badge' + (stackFullSame ? ' bp-stack-full-badge' : '')
        badge.textContent = stackFullSame ? 'Full' : 'Replace'
        slot.appendChild(badge)
      }

      if (exhausted) {
        // Skip tap/hold wiring — fully committed, show in-use indicator only
        grid.appendChild(slot)
        continue
      }

      if (replaceMode && onReplace) {
        if (stackFullSame) {
          slot.addEventListener('click', () => {
            const def = ITEMS[entry.id]
            const maxS = def?.maxStack ?? 99
            ctx.UI.setMessage(`${def?.name ?? entry.id} is already at max stack (${entry.qty}/${maxS}). Pick a different slot or trash the new item.`, true)
          })
        } else {
          slot.addEventListener('click', () => onReplace(i, entry))
        }
        grid.appendChild(slot)
        continue
      }

      // Tap → send one to Tran; hold (500ms) → info card with Use button
      let _holdTimer = null
      let _didHold   = false
      const _openCard = () => {
        _didHold = true
        const def = ITEMS[entry.id]
        ctx.UI.showInfoCard(
          { ...def, id: entry.id, _qty: entry.qty },
          {
            onUse: def?.effect ? () => {
              ctx.UI.hideInfoCard()
              useIngredientFromStash(ctx, save, entry.id)
              renderMaterialsPanel(ctx)
            } : null,
          },
        )
      }
      slot.addEventListener('pointerdown', () => {
        _didHold = false
        _holdTimer = setTimeout(() => { _holdTimer = null; _openCard() }, 500)
      })
      slot.addEventListener('pointerup',    () => { if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null } })
      slot.addEventListener('pointerleave', () => { if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null } })
      slot.addEventListener('click', () => {
        if (_didHold) return   // hold already handled
        switchToTranWithItem(ctx, entry.id, 1)
      })
    }

    grid.appendChild(slot)
  }

  // Show one locked slot tile for each purchasable slot
  if (canExpand) {
    const remaining = MAX_BONUS_SLOTS - bonusSlots
    for (let i = 0; i < remaining; i++) {
      const expandSlot = document.createElement('div')
      expandSlot.className = 'materials-slot materials-slot-locked'
      expandSlot.innerHTML = `<span class="materials-lock-icon">🔒</span><span class="materials-lock-label">+1 slot<br>${SLOT_COST} ⚙️</span>`
      expandSlot.addEventListener('click', () => tryExpandMaterials(ctx))
      grid.appendChild(expandSlot)
    }
  }
}

export function _syncBackpackExpandBtn(save) {
  const row = document.getElementById('backpack-expand-row')
  const btn = document.getElementById('backpack-expand-btn')
  if (!row) return
  const current = save?.meta?.backpackBonusSlots ?? 0
  const maxed = current >= 3
  row.classList.toggle('hidden', maxed)
  if (btn && !maxed) {
    btn.textContent = `🔓 +1 slot (${50} ⚙️) — ${current}/3 unlocked`
  }
}

export function wireMaterialsTab(ctx) {
  const tabMaterials = document.getElementById('tab-materials')
  const tabBackpack  = document.getElementById('tab-backpack')
  const tabTran      = document.getElementById('tab-tran')
  const expandBtn    = document.getElementById('backpack-expand-btn')

  setBackpackTabHandlers({
    onTabActivated: (idx) => {
      if (idx === 0) renderMaterialsPanel(ctx)
      if (idx === 2) renderTranPanel(ctx)
    },
  })
  wireBackpackPanelsScroll()

  tabMaterials?.addEventListener('click', () => {
    activateBackpackTab('tab-materials')
  })

  tabBackpack?.addEventListener('click', () => {
    activateBackpackTab('tab-backpack')
  })

  tabTran?.addEventListener('click', () => {
    activateBackpackTab('tab-tran')
  })

  expandBtn?.addEventListener('click', () => tryExpandBackpack(ctx))

  document.getElementById('tran-craft-btn')?.addEventListener('click', () => executeCraft(ctx))

  EventBus.on('materials:changed', () => {
    refreshTranPanelIfOpen(ctx)
    if (getBackpackTabIndex() === 0) renderMaterialsPanel(ctx)
  })

  // Sync expand button visibility on open
  const save = ctx.GameController?.getSave?.()
  _syncBackpackExpandBtn(save)
}
