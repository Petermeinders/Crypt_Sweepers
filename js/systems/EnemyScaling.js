import { CONFIG } from '../config.js'

const FLOOR_DAMAGE_INFLECTION = 50

/**
 * Enemy damage multiplier by floor — compound growth (moderate exponential curve).
 * Floor 1 → 1×; each subsequent floor multiplies by (1 + rate) instead of adding a flat %.
 * @param {number} floor — 1-based floor index
 */
export function floorDamageMult(floor) {
  const f = Math.max(1, Math.floor(floor))
  const e = CONFIG.enemy
  const earlyRate = e.floorScaleDmgExpRate ?? 0.048
  const lateRate  = e.floorScaleDmgExpRate_late ?? 0.024
  if (f <= FLOOR_DAMAGE_INFLECTION) {
    return Math.pow(1 + earlyRate, f - 1)
  }
  const base50 = Math.pow(1 + earlyRate, FLOOR_DAMAGE_INFLECTION - 1)
  return base50 * Math.pow(1 + lateRate, f - FLOOR_DAMAGE_INFLECTION)
}

/**
 * Scale an enemy definition for dungeon floor depth (same formula as production).
 * @param {object} def — entry from ENEMY_DEFS (must have hp, dmg array)
 * @param {number} floor — 1-based floor index
 */
export function scaleEnemyDef(def, floor) {
  // HP: piecewise linear; damage: compound (see floorDamageMult)
  let hpMult
  if (floor <= FLOOR_DAMAGE_INFLECTION) {
    hpMult = 1 + CONFIG.enemy.floorScaleHP * (floor - 1)
  } else {
    const base50Hp = 1 + CONFIG.enemy.floorScaleHP * (FLOOR_DAMAGE_INFLECTION - 1)
    hpMult = base50Hp + CONFIG.enemy.floorScaleHP_late * (floor - FLOOR_DAMAGE_INFLECTION)
  }
  const dmgMult = floorDamageMult(floor)
  const statMult = CONFIG.enemy.statMult ?? 1
  const baseHp = Number(def.hp)
  const hp = Math.max(1, Math.round((Number.isFinite(baseHp) ? baseHp : 1) * hpMult * statMult))
  const rawDmg = Array.isArray(def.dmg) && def.dmg.length ? def.dmg : [1, 1]
  const dmg = rawDmg.map(v => Math.round((Number(v) || 0) * dmgMult * statMult))
  return { ...def, hp, dmg, currentHP: hp }
}
