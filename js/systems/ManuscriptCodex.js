/**
 * Persistent discovery log for Brannik Stonefuse's journal entries.
 * Stored on save as `manuscriptsSeen: string[]` (entry ids).
 */

import { MANUSCRIPTS } from '../data/manuscripts.js'

function ensure(save) {
  if (!Array.isArray(save.manuscriptsSeen)) save.manuscriptsSeen = []
}

/** @returns {boolean} true if this was a new registration */
export function registerIfNew(save, entryId) {
  if (!entryId) return false
  ensure(save)
  if (save.manuscriptsSeen.includes(entryId)) return false
  save.manuscriptsSeen.push(entryId)
  return true
}

export function hasSeen(save, entryId) {
  ensure(save)
  return save.manuscriptsSeen.includes(entryId)
}

/** Pick the lowest-numbered unseen entry, or null if all found. */
export function pickUnseen(save) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  const unseen = MANUSCRIPTS.entries
    .filter(e => !seen.has(e.id))
    .sort((a, b) => a.number - b.number)
  return unseen[0] ?? null
}

/**
 * Pick the lowest-numbered unseen entry restricted to a specific author.
 * Falls back to any unseen entry if the author has no remaining entries.
 */
export function pickUnseenForAuthor(save, authorId) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  // Currently only one manuscript collection — extend here when more authors are added
  const pool = MANUSCRIPTS.authorId === authorId
    ? MANUSCRIPTS.entries.filter(e => !seen.has(e.id)).sort((a, b) => a.number - b.number)
    : []
  if (pool.length) return pool[0]
  // All entries for this author found — fall back to any unseen
  return pickUnseen(save)
}

/** All entries sorted by number, annotated with seen status. */
export function allEntriesWithStatus(save) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  return MANUSCRIPTS.entries.map(e => ({ ...e, seen: seen.has(e.id) }))
}

export default { ensure, registerIfNew, hasSeen, pickUnseen, pickUnseenForAuthor, allEntriesWithStatus }
