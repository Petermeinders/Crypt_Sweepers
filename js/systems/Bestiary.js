/**
 * Persistent discovery log for enemy types (enemyId keys from ENEMY_DEFS).
 * Stored on save as `bestiarySeen: string[]`.
 */

export function ensure(save) {
  if (!Array.isArray(save.bestiarySeen)) save.bestiarySeen = []
}

/** @returns {boolean} true if this was a new registration */
export function registerIfNew(save, enemyId) {
  if (!enemyId) return false
  ensure(save)
  if (save.bestiarySeen.includes(enemyId)) return false
  save.bestiarySeen.push(enemyId)
  return true
}

export function hasSeen(save, enemyId) {
  ensure(save)
  return save.bestiarySeen.includes(enemyId)
}

/** Stable display order: bosses last, then alphabetical */
export function sortedSeenIds(save) {
  ensure(save)
  const ids = [...save.bestiarySeen]
  return ids.sort((a, b) => {
    const da = a.includes('lord') || a.includes('king') || a.includes('warlord') ? 1 : 0
    const db = b.includes('lord') || b.includes('king') || b.includes('warlord') ? 1 : 0
    if (da !== db) return da - db
    return a.localeCompare(b)
  })
}

export default {
  ensure,
  registerIfNew,
  hasSeen,
  sortedSeenIds,
}
