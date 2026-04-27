import { CONFIG } from '../config.js'

/**
 * Scale an enemy definition for dungeon floor depth (same formula as production).
 * @param {object} def — entry from ENEMY_DEFS (must have hp, dmg array)
 * @param {number} floor — 1-based floor index
 */
export function scaleEnemyDef(def, floor) {
  // Piecewise linear scaling: steeper rates kick in after floor 50
  let hpMult, dmgMult
  if (floor <= 50) {
    hpMult  = 1 + CONFIG.enemy.floorScaleHP  * (floor - 1)
    dmgMult = 1 + CONFIG.enemy.floorScaleDmg * (floor - 1)
  } else {
    const base50Hp  = 1 + CONFIG.enemy.floorScaleHP  * 49
    const base50Dmg = 1 + CONFIG.enemy.floorScaleDmg * 49
    hpMult  = base50Hp  + CONFIG.enemy.floorScaleHP_late  * (floor - 50)
    dmgMult = base50Dmg + CONFIG.enemy.floorScaleDmg_late * (floor - 50)
  }
  const baseHp = Number(def.hp)
  const hp = Math.max(1, Math.round((Number.isFinite(baseHp) ? baseHp : 1) * hpMult))
  const rawDmg = Array.isArray(def.dmg) && def.dmg.length ? def.dmg : [1, 1]
  const dmg = rawDmg.map(v => Math.round((Number(v) || 0) * dmgMult))
  return { ...def, hp, dmg, currentHP: hp }
}
