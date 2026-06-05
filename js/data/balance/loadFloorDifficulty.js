/**
 * Loads floor-difficulty tuning from JSON (balance data, not gameplay logic).
 * Imported by config.js; keeps CONFIG.enemy / CONFIG.enemyDensity shape stable.
 */
import floorDifficultyJson from './floor-difficulty.json' with { type: 'json' }

/** Drop `*__doc` keys and other documentation-only fields from a tuning section. */
function stripDocKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith('__doc')) continue
    out[key] = value
  }
  return out
}

function fastShareOfEnemies(density) {
  if (typeof density.fastShareOfEnemies === 'number') return density.fastShareOfEnemies
  const r = density.fastShareRatio
  if (r && Number(r.denominator) > 0) return r.numerator / r.denominator
  return 7 / 29
}

/**
 * @returns {{
 *   enemyDensity: object,
 *   enemyScaling: object,
 *   enemyLeaders: object,
 *   voidTrial: { enemyBaseFloor: number },
 * }}
 */
export function loadFloorDifficulty() {
  const raw = stripDocKeys(floorDifficultyJson)
  const densityRaw = stripDocKeys(raw.enemyDensity ?? {})
  const enemyDensity = {
    ...densityRaw,
    fastShareOfEnemies: fastShareOfEnemies(densityRaw),
  }
  delete enemyDensity.fastShareRatio

  return {
    enemyDensity,
    enemyScaling: stripDocKeys(raw.enemyScaling ?? {}),
    enemyLeaders: stripDocKeys(raw.enemyLeaders ?? {}),
    voidTrial: stripDocKeys(raw.voidTrial ?? {}),
  }
}

export default loadFloorDifficulty
