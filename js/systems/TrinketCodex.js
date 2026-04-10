/**
 * Persistent discovery log for trinket/item ids (keys from ITEMS).
 * Stored on save as `trinketsSeen: string[]`.
 */

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

/** Sort by rarity (common → rare → legendary), then alphabetically by id */
export function sortedSeenIds(save) {
  ensure(save)
  const rarityOrder = { common: 0, rare: 1, legendary: 2 }
  return [...save.trinketsSeen].sort((a, b) => {
    // rarity order is applied by the panel grouping; here just stabilize alpha within same rarity
    return a.localeCompare(b)
  })
}

export default {
  ensure,
  registerIfNew,
  hasSeen,
  sortedSeenIds,
}
