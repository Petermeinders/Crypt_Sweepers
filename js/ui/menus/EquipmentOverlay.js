let _comparePendingIndex = null

export function openEquipment(ctx) {
  const { GameController, UI } = ctx
  ctx.setBackpackOpen(false)
  UI.renderEquipmentSlots(GameController.getEquippedGear(), UI.getHudCharacterId())
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
      UI.updateScrap(GameController.getScrap())
      UI.hideCompareModal()
      _comparePendingIndex = null
      ctx.renderBackpack()
    },
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
      ctx.openBackpackFiltered(slotEl.dataset.slot)
      return
    }
    if (e.target.id === 'equipment-overlay') closeEquipment(ctx)
  })
  document.getElementById('equipment-close-btn')?.addEventListener('click', () => closeEquipment(ctx))
}
