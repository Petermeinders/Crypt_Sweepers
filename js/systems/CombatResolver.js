import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { ENGINEER_BASE } from '../data/engineer.js'
import Logger    from '../core/Logger.js'

// Resolves combat actions. Pure logic — no DOM, no state transitions.
// GameController calls these and handles state changes + UI updates.

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Returns { enemyDmg, playerDmg, goldDrop, xpDrop, message }
function resolveFight(player, enemyData) {
  // Enemy per-hit damage: fixed when tile was revealed (hitDamage); else roll from range (defensive fallback)
  const [dmgMin, dmgMax] = enemyData?.dmg ?? CONFIG.enemy.damage
  const enemyDmg = typeof enemyData?.hitDamage === 'number'
    ? enemyData.hitDamage
    : rand(dmgMin, dmgMax)
  const bonus = player.damageBonus ?? 0

  let playerDmg
  if (player.isRanger) {
    const [lo, hi] = RANGER_BASE.damage
    playerDmg = rand(lo + bonus, hi + bonus)
  } else if (player.isEngineer) {
    const bd = ENGINEER_BASE.damage
    const base = Array.isArray(bd) ? rand(...bd) : bd
    playerDmg = base + bonus
  } else {
    const bd = CONFIG.player.baseDamage
    const base = Array.isArray(bd) ? rand(...bd) : bd
    playerDmg = base + bonus
  }

  const goldDrop = 1
  const xpDrop   = enemyData?.xpDrop ?? 5

  Logger.debug(`[CombatResolver] fight — enemy:${enemyDmg}, player:${playerDmg}, gold:${goldDrop}`)

  return { enemyDmg, playerDmg, goldDrop, xpDrop,
    message: `You strike for ${playerDmg}! Enemy slain. +${goldDrop} gold.` }
}

// Returns { manaCost, damage, goldDrop, xpDrop } or { error }
function resolveSpell(player, enemyData) {
  if (player.mana < CONFIG.spell.manaCost) {
    return { error: 'not-enough-mana' }
  }

  const damage   = rand(...CONFIG.spell.damage)
  const goldDrop = 1
  const xpDrop   = enemyData?.xpDrop ?? 5

  Logger.debug(`[CombatResolver] spell — damage:${damage}, gold:${goldDrop}`)

  return { manaCost: CONFIG.spell.manaCost, damage, goldDrop, xpDrop,
    message: `Your spell blasts for ${damage}! +${goldDrop} gold.` }
}

// Returns { fleeDmg, message }
function resolveFlee() {
  const fleeDmg = rand(2, 8)
  Logger.debug(`[CombatResolver] flee — dmg:${fleeDmg}`)
  return {
    fleeDmg,
    message: `You back away, taking ${fleeDmg} damage. The enemy remains.`,
  }
}

// Fast enemy: hits on reveal before combat starts. Returns { dmg }
function resolveFastReveal(enemyData) {
  const [dmgMin, dmgMax] = enemyData?.dmg ?? CONFIG.enemy.fastDamage
  const dmg = typeof enemyData?.hitDamage === 'number'
    ? enemyData.hitDamage
    : rand(dmgMin, dmgMax)
  Logger.debug(`[CombatResolver] fast reveal hit — dmg:${dmg}`)
  return { dmg }
}

// Goblin Merchant dice roll. Returns the outcome entry.
function rollMerchant() {
  const roll = rand(1, 6)
  const outcomes = CONFIG.merchant.dice
  for (const outcome of outcomes) {
    const [lo, hi] = outcome.roll
    if (roll >= lo && roll <= hi) {
      Logger.debug(`[CombatResolver] merchant roll: ${roll} → ${outcome.label}`)
      return { roll, ...outcome }
    }
  }
  // Fallback (shouldn't happen)
  return { roll, ...outcomes[1] }
}

export default { resolveFight, resolveSpell, resolveFlee, resolveFastReveal, rollMerchant }
