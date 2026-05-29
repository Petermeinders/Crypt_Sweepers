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
  const { GameController, EventBus } = ctx

  document.getElementById('hud-portrait-wrap')?.addEventListener('click', () => {
    const ov = document.getElementById('equipment-overlay')
    GameController.uiButtonHaptic()
    EventBus.emit('audio:play', { sfx: 'menu' })
    if (ov?.classList.contains('is-open')) { closeEquipment(ctx) } else { openEquipment(ctx) }
  })
  document.getElementById('equipment-overlay')?.addEventListener('click', (e) => {
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
