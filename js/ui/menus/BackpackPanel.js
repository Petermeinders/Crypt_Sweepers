import { ITEMS } from '../../data/items.js'
import { adjustScrap, trinketTrashScrapYield } from '../../controllers/GearController.js'

let _pendingPickupId = null

export function renderBackpack(ctx, opts = {}) {
  const { GameController, UI } = ctx
  const replaceMode = _pendingPickupId !== null
  UI.renderBackpack(
    GameController.getInventory(),
    ITEMS,
    (id) => {
      if (replaceMode) {
        doReplace(ctx, id)
        return
      }
      GameController.useItem(id)
      const et = ITEMS[id]?.effect?.type
      if (et === 'lantern' || et === 'spyglass' || et === 'hourglass-sand') {
        setBackpackOpen(ctx, false)
      } else {
        renderBackpack(ctx)
      }
    },
    (id) => {
      if (replaceMode) return
      const item = ITEMS[id]
      if (!item) return
      UI.showInfoCard(
        { ...item },
        {
          onDrop: () => {
            GameController.dropItem(id)
            UI.hideInfoCard()
            renderBackpack(ctx)
          },
        },
      )
    },
    replaceMode,
    { ...opts, onCompare: (idx) => ctx.openCompareModal(idx) },
  )
  UI.renderBackpackLevelUpLog(GameController.getLevelUpLog())
}

export function openBackpackFull(ctx, newItemId) {
  const { UI } = ctx
  _pendingPickupId = newItemId
  const item = ITEMS[newItemId]

  const bar  = document.getElementById('backpack-pending-bar')
  const art  = document.getElementById('backpack-pending-art')
  const name = document.getElementById('backpack-pending-name')
  if (bar && art && name) {
    art.innerHTML = item?.spriteSrc
      ? `<img src="${item.spriteSrc}" alt="${item.name ?? ''}">`
      : `<span>${item?.icon ?? '?'}</span>`
    name.textContent = item?.name ?? newItemId
    bar.classList.remove('hidden')
  }

  const trashBtn = document.getElementById('backpack-pending-trash')
  if (trashBtn) {
    const scrapGain = trinketTrashScrapYield(item)
    const fresh = trashBtn.cloneNode(true)
    trashBtn.replaceWith(fresh)
    fresh.textContent = scrapGain ? `🗑️ Trash (+${scrapGain} ⚙️ scrap)` : '🗑️ Trash'
    fresh.addEventListener('click', () => clearPendingPickup(ctx, { grantTrashScrap: true }))
  }

  renderBackpack(ctx)
  setBackpackOpen(ctx, true)
  UI.setMessage(`Backpack full! Tap a slot to replace it, or trash the new item.`, true)
}

export function openBackpackFullGear(ctx, piece) {
  const { UI } = ctx
  const SLOT_ICONS = { weapon: '⚔️', breastplate: '🧥', offhand: '🛡️' }
  const icon = SLOT_ICONS[piece.slot] ?? '🎁'
  renderBackpack(ctx, { filterSlot: piece.slot })
  setBackpackOpen(ctx, true)
  UI.setMessage(`${icon} ${piece.name} found — backpack full! Swap it with an existing item, or close to discard.`, true)
}

function clearPendingPickup(ctx, { grantTrashScrap = false } = {}) {
  if (grantTrashScrap && _pendingPickupId) {
    const scrapGain = trinketTrashScrapYield(ITEMS[_pendingPickupId])
    if (scrapGain) adjustScrap(scrapGain)
  }
  _pendingPickupId = null
  const bar = document.getElementById('backpack-pending-bar')
  bar?.classList.add('hidden')
  renderBackpack(ctx)
}

async function doReplace(ctx, oldId) {
  const { GameController } = ctx
  const newId = _pendingPickupId
  if (!newId) return
  clearPendingPickup(ctx)
  await GameController.forceReplaceItem(oldId, newId)
  renderBackpack(ctx)
}

export function setBackpackOpen(ctx, open) {
  const { UI } = ctx
  const el = document.getElementById('backpack-overlay')
  const btn = document.getElementById('hud-backpack-btn')
  if (!el) return
  el.classList.toggle('is-open', open)
  el.setAttribute('aria-hidden', open ? 'false' : 'true')
  btn?.setAttribute('aria-expanded', open ? 'true' : 'false')
  if (open) UI.hideEquipmentOverlay()
  if (open) clearBackpackBadge()
  if (!open && _pendingPickupId) clearPendingPickup(ctx)
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

  document.getElementById('hud-backpack-btn').addEventListener('click', () => toggleBackpack(ctx))
  document.getElementById('backpack-close-btn')?.addEventListener('click', () => setBackpackOpen(ctx, false))
  document.getElementById('backpack-levelup-toggle')?.addEventListener('click', () => {
    const acc = document.getElementById('backpack-levelup-accordion')
    const btn = document.getElementById('backpack-levelup-toggle')
    if (!acc || !btn) return
    const open = acc.classList.toggle('open')
    btn.setAttribute('aria-expanded', open ? 'true' : 'false')
  })

  EventBus.on('inventory:changed', () => {
    const ov = document.getElementById('backpack-overlay')
    if (ov?.classList.contains('is-open')) renderBackpack(ctx)
  })

  EventBus.on('gear:pickedUp', () => {
    const ov = document.getElementById('backpack-overlay')
    if (!ov?.classList.contains('is-open')) showBackpackBadge()
  })

  EventBus.on('backpack:full', (payload) => {
    if (payload.type === 'gear') {
      openBackpackFullGear(ctx, payload.piece)
    } else {
      openBackpackFull(ctx, payload.id ?? payload)
    }
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
