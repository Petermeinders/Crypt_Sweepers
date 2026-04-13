import { CONFIG } from '../config.js'

/**
 * Scale an enemy definition for dungeon floor depth (same formula as production).
 * @param {object} def — entry from ENEMY_DEFS (must have hp, dmg array)
 * @param {number} floor — 1-based floor index
 */
export function scaleEnemyDef(def, floor) {
  const hpMult  = 1 + CONFIG.enemy.floorScaleHP  * (floor - 1)
  const dmgMult = 1 + CONFIG.enemy.floorScaleDmg * (floor - 1)
  const baseHp = Number(def.hp)
  const hp = Math.max(1, Math.round((Number.isFinite(baseHp) ? baseHp : 1) * hpMult))
  const rawDmg = Array.isArray(def.dmg) && def.dmg.length ? def.dmg : [1, 1]
  const dmg = rawDmg.map(v => Math.round((Number(v) || 0) * dmgMult))
  return { ...def, hp, dmg, currentHP: hp }
}
