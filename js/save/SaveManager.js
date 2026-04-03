import Logger from '../core/Logger.js'

const DB_NAME    = 'cryptic-grids'
const DB_VERSION = 1
const STORE      = 'save'
const SAVE_KEY   = 'main'

let _db = null

// ── IndexedDB helpers ────────────────────────────────────────

async function _openDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess  = e => { _db = e.target.result; resolve(_db) }
    req.onerror    = e => reject(e.target.error)
    req.onblocked  = ()  => Logger.warn('[SaveManager] DB upgrade blocked by open tab')
  })
}

// ── Public API ───────────────────────────────────────────────

async function save(data) {
  try {
    const db = await _openDB()
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ ...data, lastSaved: Date.now() }, SAVE_KEY)
      tx.oncomplete = resolve
      tx.onerror    = e => reject(e.target.error)
    })
    Logger.debug('[SaveManager] Save written')
  } catch (err) {
    Logger.error('[SaveManager] Write failed', err)
    throw err
  }
}

async function load() {
  try {
    const db = await _openDB()
    const data = await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(SAVE_KEY)
      req.onsuccess = e => resolve(e.target.result ?? null)
      req.onerror   = e => reject(e.target.error)
    })
    Logger.debug('[SaveManager] Save loaded', data ? 'found' : 'none')
    return data
  } catch (err) {
    Logger.error('[SaveManager] Load failed', err)
    return null
  }
}

function exportJSON(data) {
  try {
    const json = JSON.stringify({ ...data, exportedAt: Date.now() }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cryptic-grids-save-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    Logger.debug('[SaveManager] Export triggered')
  } catch (err) {
    Logger.error('[SaveManager] Export failed', err)
    throw err
  }
}

async function importJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString)
    if (!data.version) throw new Error('Missing version field — not a valid save file')
    await save(data)
    Logger.debug('[SaveManager] Import successful')
    return data
  } catch (err) {
    Logger.error('[SaveManager] Import failed', err)
    throw err
  }
}

async function clear() {
  try {
    const db = await _openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(SAVE_KEY)
      tx.oncomplete = resolve
      tx.onerror    = e => reject(e.target.error)
    })
    Logger.debug('[SaveManager] Save cleared')
  } catch (err) {
    Logger.error('[SaveManager] Clear failed', err)
  }
}

export default { save, load, exportJSON, importJSON, clear }
