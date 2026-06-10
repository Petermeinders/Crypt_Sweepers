import { ITEMS } from '../../data/items.js'

let _comparePendingIndex = null

export function openEquipment(ctx) {
  const { GameController, UI } = ctx
  ctx.setBackpackOpen(false)
  UI.renderEquipmentSlots(
    GameController.getEquippedGear(),
    UI.getHudCharacterId(),
    GameController.getSafePocketTrinket(),
  )
}

export function closeEquipment(_ctx) {
  const { UI } = _ctx
  UI.hideEquipmentOverlay()
}

export function openGearPickupCompareModal(ctx, inventoryIndex) {
  const { GameController, UI } = ctx
  const pending = ctx.getPendingGearPiece?.()
  if (!pending) return openCompareModal(ctx, inventoryIndex)

  const inventory = GameController.getInventory()
  const oldPiece = inventory[inventoryIndex]
  if (!oldPiece?.slot) return

  UI.renderCompareModal(
    pending,
    oldPiece,
    () => {
      // Confirm: swap the gear pieces
      GameController.acceptPendingGearAtSlot(inventoryIndex, pending)
      ctx.clearPendingGear?.()
      UI.hideCompareModal()
      ctx.renderBackpack()
    },
    () => {
      // Back: return to backpack slot selection
      UI.hideCompareModal()
      ctx.renderBackpack?.()
    },
    () => {
      // Trash pending gear: discard the new piece
      ctx.clearPendingGear?.()
      UI.hideCompareModal()
      UI.setMessage(`${pending.name} discarded.`)
    },
  )
}

export function openCompareModal(ctx, inventoryIndex) {
  const { GameController, UI } = ctx
  _comparePendingIndex = inventoryIndex
  const inventory   = GameController.getInventory()
  const candidate   = inventory[inventoryIndex]
  if (!candidate?.slot) return
  const equippedGear = GameController.getEquippedGear()
  const equipped     = equippedGear[candidate.slot] ?? null
  UI.renderCompareModal(
    candidate,
    equipped,
    () => {
      GameController.equipGear(inventoryIndex)
      UI.hideCompareModal()
      _comparePendingIndex = null
      ctx.renderBackpack()
      openEquipment(ctx)
    },
    () => {
      UI.hideCompareModal()
      _comparePendingIndex = null
    },
    () => {
      GameController.trashGear(inventoryIndex)
      UI.hideCompareModal()
      _comparePendingIndex = null
      ctx.renderBackpack()
    },
  )
}

export function openSafePocketCompareModal(ctx, inventoryIndex) {
  const { GameController, UI } = ctx
  const inventory = GameController.getInventory()
  const entry = inventory[inventoryIndex]
  const candidate = entry?.id ? ITEMS[entry.id] : null
  if (!candidate) return
  const equippedId = GameController.getSafePocketTrinket()?.id
  const equippedDef = equippedId ? ITEMS[equippedId] : null
  UI.renderSafePocketCompareModal(
    candidate,
    equippedDef,
    () => {
      GameController.equipSafePocket(inventoryIndex)
      UI.hideCompareModal()
      ctx.renderBackpack()
      openEquipment(ctx)
    },
    () => UI.hideCompareModal(),
  )
}

export function wireEquipmentOverlay(ctx) {
  const { GameController, EventBus, UI } = ctx

  document.getElementById('hud-portrait-wrap')?.addEventListener('click', () => {
    const ov = document.getElementById('equipment-overlay')
    GameController.uiButtonHaptic()
    EventBus.emit('audio:play', { sfx: 'menu' })
    if (ov?.classList.contains('is-open')) { closeEquipment(ctx) } else { openEquipment(ctx) }
  })

  // Hold-to-inspect: 500 ms hold on a gear card opens detail modal
  const gearRow = () => document.getElementById('equipment-gear-row')
  let _holdTimer = null
  let _holdTarget = null
  let _holdFired = false
  let _holdStartX = 0
  let _holdStartY = 0

  function _cancelHold() {
    clearTimeout(_holdTimer)
    _holdTimer = null
    _holdTarget = null
  }

  document.getElementById('equipment-overlay')?.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.eq-card[data-slot]')
    if (!card || card.classList.contains('eq-card-empty')) return
    _holdTarget = card
    _holdFired = false
    _holdStartX = e.clientX
    _holdStartY = e.clientY
    _holdTimer = setTimeout(() => {
      _holdTimer = null
      _holdFired = true
      const slot = _holdTarget?.dataset.slot
      if (!slot) return
      const gear = GameController.getEquippedGear()
      const piece = gear?.[slot]
      if (!piece) return
      UI.renderGearDetailModal(piece, slot)
    }, 500)
  })

  document.getElementById('equipment-overlay')?.addEventListener('pointerup', _cancelHold)
  document.getElementById('equipment-overlay')?.addEventListener('pointercancel', _cancelHold)
  document.getElementById('equipment-overlay')?.addEventListener('pointermove', (e) => {
    if (_holdTimer === null) return
    const dx = e.clientX - _holdStartX
    const dy = e.clientY - _holdStartY
    if (dx * dx + dy * dy > 100) _cancelHold() // 10px threshold
  })

  document.getElementById('equipment-overlay')?.addEventListener('click', (e) => {
    if (_holdFired) { _holdFired = false; return }
    const slotEl = e.target.closest('[data-slot]')
    if (slotEl) {
      if (slotEl.dataset.slot === 'safe-pocket') {
        ctx.openBackpackFilteredTrinkets()
      } else {
        ctx.openBackpackFiltered(slotEl.dataset.slot)
      }
      return
    }
    if (e.target.id === 'equipment-overlay') closeEquipment(ctx)
  })
  document.getElementById('equipment-close-btn')?.addEventListener('click', () => closeEquipment(ctx))
}
