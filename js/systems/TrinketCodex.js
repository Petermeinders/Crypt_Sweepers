/**
 * Persistent discovery log for trinket/item ids (keys from ITEMS).
 * Stored on save as `trinketsSeen: string[]`.
 */

import { ITEMS } from '../data/items.js'

export function ensure(save) {
  if (!Array.isArray(save.trinketsSeen)) save.trinketsSeen = []
}

/** @returns {boolean} true if this was a new registration */
export function registerIfNew(save, itemId) {
  if (!itemId) return false
  ensure(save)
  if (save.trinketsSeen.includes(itemId)) return false
  save.trinketsSeen.push(itemId)
  return true
}

export function hasSeen(save, itemId) {
  ensure(save)
  return save.trinketsSeen.includes(itemId)
}

/** Sort by rarity (common → rare → epic → legendary), then alphabetically by id */
export function sortedSeenIds(save) {
  ensure(save)
  const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 }
  return [...save.trinketsSeen].sort((a, b) => {
    const ra = rarityOrder[ITEMS[a]?.rarity] ?? 99
    const rb = rarityOrder[ITEMS[b]?.rarity] ?? 99
    if (ra !== rb) return ra - rb
    return a.localeCompare(b)
  })
}

export default {
  ensure,
  registerIfNew,
  hasSeen,
  sortedSeenIds,
}
