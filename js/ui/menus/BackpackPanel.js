import { ITEMS } from '../../data/items.js'
import { GEMS } from '../../data/gems.js'
import { adjustScrap, gearTrashScrapYield, trinketTrashScrapYield, trinketTrashDropSuffix } from '../../controllers/GearController.js'
import { isPassiveTrinketId } from '../../controllers/SafePocketController.js'
import { switchToTranWithItem, refreshTranPanelIfOpen } from '../../controllers/TransmutationController.js'
import { wireMaterialsTab, _syncBackpackExpandBtn, renderMaterialsPanel, forceReplaceMaterialsAtIndex, getMaterialsPickupBlockReason, isMaterialsStackFull } from '../../controllers/MaterialsController.js'
import { activateBackpackTab, resetBackpackTabOnOpen } from '../../controllers/BackpackTabs.js'

const HOLD_HINT_KEY = 'cs_hint_hold_inspect'

let _pendingPickupId = null
let _pendingGearPiece = null
let _pendingMaterialsId = null
let _pendingMaterialsResolution = null

const GEAR_IMGS = {
  weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
  breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
  offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
}
const _gImg = (slot, tier) => GEAR_IMGS[slot]?.[tier] ?? GEAR_IMGS[slot]?.default ?? ''

export function getPendingGearPiece() {
  return _pendingGearPiece
}

export function getPendingMaterialsId() {
  return _pendingMaterialsId
}

const BACKPACK_ITEM_REGISTRY = { ...ITEMS, ...GEMS }

export function renderBackpack(ctx, opts = {}) {
  const { GameController, UI } = ctx
  GameController.consolidateStackables()
  const replaceMode = _pendingPickupId !== null
  const save = GameController.getSave?.()
  const maxSlots = 9 + (save?.meta?.backpackBonusSlots ?? 0)
  UI.renderBackpack(
    GameController.getInventory(),
    BACKPACK_ITEM_REGISTRY,
    (index) => {
      if (replaceMode) return
      const id = GameController.getInventory()[index]?.id
      if (isPassiveTrinketId(id)) {
        ctx.openSafePocketCompareModal(index)
        return
      }
      if (GEMS[id]) {
        ctx.openGemCompareModal(index)
        return
      }
      // Ingredient-only items open Transmutation instead of consuming
      if (ITEMS[id]?.ingredientOnly) {
        const entry = GameController.getInventory()[index]
        switchToTranWithItem(ctx, id, entry?.qty ?? 1)
        return
      }
      GameController.useItemAtIndex(index)
      const et = ITEMS[id]?.effect?.type
      if (et === 'lantern' || et === 'spyglass' || et === 'hourglass-sand') {
        setBackpackOpen(ctx, false)
      } else {
        renderBackpack(ctx)
      }
    },
    (index) => {
      if (replaceMode) return
      const entry = GameController.getInventory()[index]
      const id = entry?.id
      const item = BACKPACK_ITEM_REGISTRY[id]
      if (!item) return
      const qty = entry?.qty ?? 1
      UI.showInfoCard(
        { ...item, id, _qty: qty },
        {
          onDrop: () => {
            GameController.dropItemAtIndex(index)
            UI.hideInfoCard()
            renderBackpack(ctx)
          },
          onDropStack: qty > 1 ? () => {
            GameController.dropStackAtIndex(index)
            UI.hideInfoCard()
            renderBackpack(ctx)
          } : undefined,
        },
      )
    },
    replaceMode,
    {
      ...opts,
      maxSlots,
      gearPickupMode: _pendingGearPiece !== null,
      onReplaceGearIndex: _pendingGearPiece
        ? (idx) => doReplaceGearAtIndex(ctx, idx)
        : undefined,
      onSwapWithEquipped: _pendingGearPiece
        ? () => doSwapWithEquipped(ctx)
        : undefined,
      onCompare: (idx) => {
        if (_pendingGearPiece) ctx.openGearPickupCompareModal(idx)
        else ctx.openCompareModal(idx)
      },
      onReplaceIndex: replaceMode ? (idx) => doReplaceAtIndex(ctx, idx) : undefined,
    },
  )
  UI.renderBackpackLevelUpLog(GameController.getLevelUpLog())
}

function _showPendingBar({ artHtml, name, trashLabel = '🗑️ Trash', onTrash }) {
  const bar  = document.getElementById('backpack-pending-bar')
  const art  = document.getElementById('backpack-pending-art')
  const nameEl = document.getElementById('backpack-pending-name')
  if (bar && art && nameEl) {
    art.innerHTML = artHtml
    nameEl.textContent = name
    bar.classList.remove('hidden')
  }
  const trashBtn = document.getElementById('backpack-pending-trash')
  if (trashBtn) {
    const fresh = trashBtn.cloneNode(true)
    fresh.textContent = trashLabel
    trashBtn.replaceWith(fresh)
    fresh.addEventListener('click', onTrash)
  }
}

export function openMaterialsFull(ctx, payload) {
  const { UI, GameController } = ctx
  const itemId = payload?.id ?? payload
  _pendingPickupId = null
  _pendingGearPiece = null
  _pendingMaterialsId = itemId
  _pendingMaterialsResolution = payload?.resolution ?? null
  const item = ITEMS[itemId]
  const save = GameController.getSave?.()
  const block = save ? getMaterialsPickupBlockReason(save, itemId) : null
  const hintEl = document.getElementById('backpack-pending-hint')
  let hint = 'Tap a slot to replace it, or trash this item.'
  let message = 'Materials bag full! Tap a slot to replace it, or trash the new item.'
  if (block?.type === 'stack_full') {
    hint = `Already at max stack (${block.qty}/${block.maxStack}) — replace a different slot or trash.`
    message = `${block.name} stack is full (${block.qty}/${block.maxStack}). Tap another slot to replace, or trash the new one.`
  }
  if (hintEl) hintEl.textContent = hint
  _showPendingBar({
    artHtml: item?.spriteSrc
      ? `<img src="${item.spriteSrc}" alt="${item.name ?? ''}">`
      : `<span>${item?.icon ?? '?'}</span>`,
    name: item?.name ?? itemId,
    trashLabel: '🗑️ Trash',
    onTrash: () => clearPendingMaterials(ctx, { trashed: true }),
  })

  renderMaterialsPanel(ctx)
  setBackpackOpen(ctx, true, { initialTab: 'tab-materials' })
  UI.setMessage(message, true)
}

function doReplaceMaterialsAtIndex(ctx, index, existingEntry) {
  const newId = _pendingMaterialsId
  if (!newId) return
  const incomingDef = ITEMS[newId]
  const existingDef = existingEntry?.id ? ITEMS[existingEntry.id] : null
  ctx.UI.renderBackpackReplaceModal(
    incomingDef,
    existingDef,
    () => {
      ctx.UI.hideCompareModal()
      const save = ctx.GameController.getSave?.()
      if (save) forceReplaceMaterialsAtIndex(save, index, newId)
      const resolution = _pendingMaterialsResolution
      clearPendingMaterials(ctx)
      ctx.GameController.finalizePendingPickup?.(resolution, { skipAdd: true })
      renderMaterialsPanel(ctx)
    },
    () => {
      ctx.UI.hideCompareModal()
    },
  )
}

export function clearPendingMaterials(ctx, { trashed = false } = {}) {
  const resolution = _pendingMaterialsResolution
  _pendingMaterialsId = null
  _pendingMaterialsResolution = null
  if (!_pendingPickupId && !_pendingGearPiece) {
    document.getElementById('backpack-pending-bar')?.classList.add('hidden')
  }
  if (trashed && resolution) {
    ctx.GameController.finalizePendingPickup?.(resolution, { discarded: true })
  }
  renderMaterialsPanel(ctx)
}

export function openBackpackFull(ctx, newItemId) {
  const { UI } = ctx
  _pendingGearPiece = null
  _pendingPickupId = newItemId
  const item = ITEMS[newItemId]
  const trashSuffix = trinketTrashDropSuffix(item)
  _showPendingBar({
    artHtml: item?.spriteSrc
      ? `<img src="${item.spriteSrc}" alt="${item.name ?? ''}">`
      : `<span>${item?.icon ?? '?'}</span>`,
    name: item?.name ?? newItemId,
    trashLabel: trashSuffix ? `🗑️ Trash${trashSuffix}` : '🗑️ Trash',
    onTrash: () => clearPendingTrinket(ctx, { grantTrashScrap: true }),
  })

  renderBackpack(ctx)
  setBackpackOpen(ctx, true)
  UI.setMessage(`Backpack full! Tap a slot to replace it, or trash the new item.`, true)
}

export function openBackpackFullGear(ctx, piece) {
  const { UI } = ctx
  _pendingPickupId = null
  _pendingGearPiece = piece
  const slotImg = _gImg(piece.slot, piece.tier)
  const scrapGain = gearTrashScrapYield(piece)
  _showPendingBar({
    artHtml: slotImg ? `<img src="${slotImg}" alt="${piece.name ?? ''}">` : `<span>🎁</span>`,
    name: piece.name ?? 'Gear',
    trashLabel: `🗑️ Trash (+${scrapGain} ⚙️ scrap)`,
    onTrash: () => {
      adjustScrap(scrapGain)
      clearPendingGear(ctx)
    },
  })

  renderBackpack(ctx)
  setBackpackOpen(ctx, true)
  const SLOT_ICONS = { weapon: '⚔️', breastplate: '🧥', offhand: '🛡️' }
  const icon = SLOT_ICONS[piece.slot] ?? '🎁'
  UI.setMessage(`${icon} ${piece.name} found — backpack full! Tap any slot to swap (gear shows compare first), or trash the new item.`, true)
}

function doReplaceGearAtIndex(ctx, index) {
  const piece = _pendingGearPiece
  if (!piece) return
  const existing = ctx.GameController.getInventory()[index]
  if (existing?.slot) {
    // Gear-on-gear: show compare modal first
    ctx.openGearPickupCompareModal(index)
  } else {
    // Non-gear (trinket/consumable): show compare before replacing
    const existingDef = existing?.id ? ITEMS[existing.id] : null
    const incomingDef = { ...piece, name: piece.name, stats: piece.stats }
    ctx.UI.renderBackpackReplaceModal(
      incomingDef,
      existingDef,
      () => {
        ctx.UI.hideCompareModal()
        clearPendingGear(ctx)
        ctx.GameController.forceReplaceSlotWithGear(index, piece)
        renderBackpack(ctx)
      },
      () => {
        ctx.UI.hideCompareModal()
      },
    )
  }
}

function doSwapWithEquipped(ctx) {
  const piece = _pendingGearPiece
  if (!piece) return
  clearPendingGear(ctx)
  ctx.GameController.swapPendingGearWithEquipped(piece)
  setBackpackOpen(ctx, false)
}

function clearPendingTrinket(ctx, { grantTrashScrap = false } = {}) {
  if (grantTrashScrap && _pendingPickupId) {
    const scrapGain = trinketTrashScrapYield(ITEMS[_pendingPickupId])
    if (scrapGain) adjustScrap(scrapGain)
  }
  _pendingPickupId = null
  if (!_pendingGearPiece && !_pendingMaterialsId) {
    document.getElementById('backpack-pending-bar')?.classList.add('hidden')
  }
  renderBackpack(ctx)
}

export function clearPendingGear(ctx) {
  _pendingGearPiece = null
  if (!_pendingPickupId && !_pendingMaterialsId) {
    document.getElementById('backpack-pending-bar')?.classList.add('hidden')
  }
  renderBackpack(ctx)
}

async function doReplaceAtIndex(ctx, index) {
  const { GameController, UI } = ctx
  const newId = _pendingPickupId
  if (!newId) return
  const existing = GameController.getInventory()[index]
  // Gear items have .slot but no .id in ITEMS; use the object directly
  const existingDef = existing?.slot ? existing : (existing?.id ? ITEMS[existing.id] : null)
  const incomingDef = ITEMS[newId]
  // Show compare before committing replacement
  UI.renderBackpackReplaceModal(
    incomingDef,
    existingDef,
    async () => {
      UI.hideCompareModal()
      clearPendingTrinket(ctx)
      await GameController.forceReplaceItemAtIndex(index, newId)
      renderBackpack(ctx)
    },
    () => {
      UI.hideCompareModal()
    },
  )
}

export function setBackpackOpen(ctx, open, opts = {}) {
  const { UI } = ctx
  const el = document.getElementById('backpack-overlay')
  const btn = document.getElementById('hud-backpack-btn')
  if (!el) return
  el.classList.toggle('is-open', open)
  el.setAttribute('aria-hidden', open ? 'false' : 'true')
  btn?.setAttribute('aria-expanded', open ? 'true' : 'false')
  if (open) UI.hideEquipmentOverlay()
  if (open) clearBackpackBadge()
  if (open) _syncBackpackExpandBtn(ctx.GameController?.getSave?.())
  if (open) {
    const banner = document.getElementById('backpack-hint-banner')
    if (banner && !localStorage.getItem(HOLD_HINT_KEY)) banner.classList.remove('hidden')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (opts.initialTab) activateBackpackTab(opts.initialTab, { scrollBehavior: 'instant' })
        else resetBackpackTabOnOpen()
      })
    })
  }
  if (!open) {
    ctx.GameController.consolidateStackables()
    if (_pendingPickupId || _pendingGearPiece || _pendingMaterialsId) {
      UI.setMessage('Pickup discarded — inventory still full.', true)
      _pendingPickupId = null
      _pendingGearPiece = null
      _pendingMaterialsId = null
      _pendingMaterialsResolution = null
      document.getElementById('backpack-pending-bar')?.classList.add('hidden')
    }
  }
}

export function showBackpackBadge() {
  const badge = document.getElementById('backpack-new-badge')
  if (!badge) return
  badge.classList.remove('hidden')
  badge.style.animation = 'none'
  void badge.offsetWidth
  badge.style.animation = ''
}

export function clearBackpackBadge() {
  document.getElementById('backpack-new-badge')?.classList.add('hidden')
}

export function toggleBackpack(ctx) {
  const el = document.getElementById('backpack-overlay')
  if (!el) return
  if (!el.classList.contains('is-open')) {
    renderBackpack(ctx)
    setBackpackOpen(ctx, true)
  } else {
    setBackpackOpen(ctx, false)
  }
}

export function wireBackpackPanel(ctx) {
  const { EventBus } = ctx

  ctx.getPendingMaterialsId = getPendingMaterialsId
  ctx.onMaterialsReplaceIndex = (index, entry) => doReplaceMaterialsAtIndex(ctx, index, entry)

  document.getElementById('hud-backpack-btn').addEventListener('click', () => toggleBackpack(ctx))
  document.getElementById('backpack-close-btn')?.addEventListener('click', () => setBackpackOpen(ctx, false))
  document.getElementById('backpack-hint-banner')?.querySelector('.eq-hint-close')?.addEventListener('click', () => {
    localStorage.setItem(HOLD_HINT_KEY, '1')
    document.getElementById('backpack-hint-banner')?.classList.add('hidden')
    document.getElementById('equipment-hint-banner')?.classList.add('hidden')
  })
  document.getElementById('backpack-levelup-toggle')?.addEventListener('click', () => {
    const acc = document.getElementById('backpack-levelup-accordion')
    const btn = document.getElementById('backpack-levelup-toggle')
    if (!acc || !btn) return
    const open = acc.classList.toggle('open')
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })

  EventBus.on('inventory:changed', () => {
    const ov = document.getElementById('backpack-overlay')
    if (ov?.classList.contains('is-open')) {
      renderBackpack(ctx)
      refreshTranPanelIfOpen(ctx)
    }
  })

  EventBus.on('gear:pickedUp', () => {
    const ov = document.getElementById('backpack-overlay')
    if (!ov?.classList.contains('is-open')) showBackpackBadge()
  })

  // Swipe down to close when scroll is at the top
  const overlay = document.getElementById('backpack-overlay')
  if (overlay) {
    let _swipeTouchId = null
    let _swipeStartY = 0
    overlay.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]
      _swipeTouchId = t.identifier
      _swipeStartY = t.clientY
    }, { passive: true })
    overlay.addEventListener('touchend', (e) => {
      const t = Array.from(e.changedTouches).find(c => c.identifier === _swipeTouchId)
      if (!t) return
      const dy = t.clientY - _swipeStartY
      const scroll = document.getElementById('backpack-panels-scroll')
      const atTop = !scroll || scroll.scrollTop === 0
      if (atTop && dy > 60) setBackpackOpen(ctx, false)
      _swipeTouchId = null
    }, { passive: true })
  }

  wireMaterialsTab(ctx)

  EventBus.on('backpack:full', (payload) => {
    if (payload.type === 'gear') {
      openBackpackFullGear(ctx, payload.piece)
    } else {
      openBackpackFull(ctx, payload.id ?? payload)
    }
  })

  EventBus.on('materials:full', (payload) => {
    openMaterialsFull(ctx, payload)
  })
}

export function openBackpackFiltered(ctx, slotType) {
  const { GameController, UI } = ctx
  const rerender = () => renderBackpack(ctx, {
    filterSlot: slotType,
    onUnequip: (inventoryIndex) => {
      GameController.unequipGear(slotType, inventoryIndex)
      rerender()
      UI.renderEquipmentSlots(
        GameController.getEquippedGear(),
        UI.getHudCharacterId(),
        GameController.getSafePocketTrinket(),
      )
    },
  })
  rerender()
  setBackpackOpen(ctx, true)
}

export function openBackpackFilteredTrinkets(ctx) {
  const rerender = () => renderBackpack(ctx, {
    filterTrinket: true,
    onCompareTrinket: (idx) => ctx.openSafePocketCompareModal(idx),
  })
  rerender()
  setBackpackOpen(ctx, true)
}
