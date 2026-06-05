/**
 * Void trial corruption curse pool — balance data loaded into CONFIG.void.corruption.
 */
import voidCorruptionJson from './void-corruption.json' with { type: 'json' }

function stripDocKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith('__doc')) continue
    out[key] = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? stripDocKeys(value)
      : value
  }
  return out
}

export function loadVoidCorruption() {
  const raw = stripDocKeys(voidCorruptionJson)
  return {
    tripletSize: raw.tripletSize ?? 3,
    curses: stripDocKeys(raw.curses ?? {}),
  }
}

export default loadVoidCorruption
