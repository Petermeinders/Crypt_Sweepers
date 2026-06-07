/**
 * Persistent discovery log for expedition journal entries.
 * Stored on save as `manuscriptsSeen: string[]` (entry ids).
 */

import { MANUSCRIPTS } from '../data/manuscripts.js'
import { MANUSCRIPTS_NAVIGATOR } from '../data/manuscripts-navigator.js'

const ALL_COLLECTIONS = [MANUSCRIPTS, MANUSCRIPTS_NAVIGATOR]

/** Flat list of all entries across all collections, each stamped with author/role. */
function allEntries() {
  return ALL_COLLECTIONS.flatMap(col =>
    col.entries.map(e => ({ ...e, author: col.author, role: col.role, authorId: col.authorId }))
  )
}

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

/**
 * Pick a random authorId for this run from collections that still have unseen entries.
 * Collections marked `isLast: true` are reserved until they are the only option remaining.
 * Returns null if every entry across all collections has been found.
 */
export function pickRandomAuthor(save) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  const withUnseen = ALL_COLLECTIONS.filter(col => col.entries.some(e => !seen.has(e.id)))
  if (withUnseen.length === 0) return null
  const pool = withUnseen.filter(col => !col.isLast)
  const candidates = pool.length > 0 ? pool : withUnseen
  return candidates[Math.floor(Math.random() * candidates.length)].authorId
}

/** Pick the lowest-numbered unseen entry across all collections, or null if all found. */
export function pickUnseen(save) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  const unseen = allEntries()
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
  const col = ALL_COLLECTIONS.find(c => c.authorId === authorId)
  const pool = col
    ? col.entries
        .map(e => ({ ...e, author: col.author, role: col.role, authorId: col.authorId }))
        .filter(e => !seen.has(e.id))
        .sort((a, b) => a.number - b.number)
    : []
  if (pool.length) return pool[0]
  return pickUnseen(save)
}

/** Returns the ordered list of all manuscript collections (for rendering author sections). */
export function collections() { return ALL_COLLECTIONS }

/** All entries across all collections sorted by author then number, annotated with seen status. */
export function allEntriesWithStatus(save) {
  ensure(save)
  const seen = new Set(save.manuscriptsSeen)
  return allEntries().map(e => ({ ...e, seen: seen.has(e.id) }))
}

export default { ensure, registerIfNew, hasSeen, pickUnseen, pickUnseenForAuthor, pickRandomAuthor, collections, allEntriesWithStatus }
