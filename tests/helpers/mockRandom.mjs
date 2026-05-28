/**
 * Temporarily replace Math.random for deterministic tests.
 * @param {number[]} values — sequence returned on each call (last value repeats)
 * @param {() => void} fn
 */
export function withRandomSequence(values, fn) {
  const orig = Math.random
  let i = 0
  Math.random = () => {
    const v = values[Math.min(i, values.length - 1)]
    i++
    return v
  }
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}
