import EventBus from '../core/EventBus.js'
import { session } from '../core/RunContext.js'
import { ITEMS } from '../data/items.js'
import { applyTrinketEquipEffects } from './InventoryController.js'

export function isPassiveTrinketId(id) {
  const item = ITEMS[id]
  if (!item || item.stackable) return false
  return item.effect?.type?.startsWith('passive-') ?? false
}

/** Load persisted safe-pocket trinket at run start (after gear apply). */
export function applySafePocket(ctx, p) {
  const saved = session.save?.safePocketTrinket
  if (!saved?.id || !isPassiveTrinketId(saved.id)) {
    p.safePocketTrinket = null
    return
  }
  p.safePocketTrinket = { id: saved.id }
  applyTrinketEquipEffects(ctx, saved.id, { silent: true })
}

/** Gear-style swap: backpack trinket ↔ safe pocket. Passives stay active while owned. */
export function equipSafePocket(ctx, inventoryIndex) {
  if (!session.run) return
  const inv = session.run.player.inventory
  const entry = inv[inventoryIndex]
  if (!entry?.id || !isPassiveTrinketId(entry.id)) return

  const prev = session.run.player.safePocketTrinket
  const newId = entry.id

  inv[inventoryIndex] = prev ? { id: prev.id, qty: 1 } : null
  session.run.player.safePocketTrinket = { id: newId }
  EventBus.emit('inventory:changed')
}
