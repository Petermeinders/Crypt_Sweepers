import { ITEMS } from '../../data/items.js'
import { adjustScrap, trinketTrashScrapYield, trinketTrashDropSuffix } from '../../controllers/GearController.js'

let _pendingPickupId = null
let _pendingGearPiece = null

const GEAR_IMGS = {
  weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
  breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
  offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
}
const _gImg = (slot, tier) => GEAR_IMGS[slot]?.[tier] ?? GEAR_IMGS[slot]?.default ?? ''

export function getPendingGearPiece() {
  return _pendingGearPiece
}

export function renderBackpack(ctx, opts = {}) {
  const { GameController, UI } = ctx
  GameController.consolidateStackables()
  const replaceMode = _pendingPickupId !== null
  UI.renderBackpack(
    GameController.getInventory(),
    ITEMS,
    (index) => {
      if (replaceMode) return
      const id = GameController.getInventory()[index]?.id
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
      const id = GameController.getInventory()[index]?.id
      const item = ITEMS[id]
      if (!item) return
      UI.showInfoCard(
        { ...item },
        {
          onDrop: () => {
            GameController.dropItemAtIndex(index)
            UI.hideInfoCard()
            renderBackpack(ctx)
          },
        },
      )
    },
    replaceMode,
    {
      ...opts,
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
  _showPendingBar({
    artHtml: slotImg ? `<img src="${slotImg}" alt="${piece.name ?? ''}">` : `<span>🎁</span>`,
    name: piece.name ?? 'Gear',
    trashLabel: '🗑️ Trash',
    onTrash: () => clearPendingGear(ctx),
  })

  renderBackpack(ctx, { filterSlot: piece.slot })
  setBackpackOpen(ctx, true)
  const SLOT_ICONS = { weapon: '⚔️', breastplate: '🧥', offhand: '🛡️' }
  const icon = SLOT_ICONS[piece.slot] ?? '🎁'
  UI.setMessage(`${icon} ${piece.name} found — backpack full! Tap matching gear to swap, or trash the new item.`, true)
}

function doReplaceGearAtIndex(ctx, index) {
  const piece = _pendingGearPiece
  if (!piece) return
  clearPendingGear(ctx)
  ctx.GameController.acceptPendingGearAtSlot(index, piece)
  renderBackpack(ctx)
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
  if (!_pendingGearPiece) {
    document.getElementById('backpack-pending-bar')?.classList.add('hidden')
  }
  renderBackpack(ctx)
}

export function clearPendingGear(ctx) {
  _pendingGearPiece = null
  if (!_pendingPickupId) {
    document.getElementById('backpack-pending-bar')?.classList.add('hidden')
  }
  renderBackpack(ctx)
}

async function doReplaceAtIndex(ctx, index) {
  const { GameController } = ctx
  const newId = _pendingPickupId
  if (!newId) return
  clearPendingTrinket(ctx)
  await GameController.forceReplaceItemAtIndex(index, newId)
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
  if (!open) {
    ctx.GameController.consolidateStackables()
    if (_pendingPickupId || _pendingGearPiece) {
      UI.setMessage('Pickup discarded — backpack still full.', true)
      _pendingPickupId = null
      _pendingGearPiece = null
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
