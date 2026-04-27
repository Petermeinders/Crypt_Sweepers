import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { ENGINEER_BASE } from '../data/engineer.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import Logger    from '../core/Logger.js'

// Resolves combat actions. Pure logic — no DOM, no state transitions.
// GameController calls these and handles state changes + UI updates.

function rand(min, max) {
  const lo = Number(min)
  const hi = Number(max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 1
  const a = Math.min(lo, hi)
  const b = Math.max(lo, hi)
  return Math.floor(Math.random() * (b - a + 1)) + a
}

// Returns { enemyDmg, playerDmg, goldDrop, xpDrop, message }
function resolveFight(player, enemyData) {
  // Enemy per-hit damage: fixed when tile was revealed (hitDamage); else roll from range (defensive fallback)
  const rawDmg = enemyData?.dmg ?? CONFIG.enemy.damage
  const [lo0, hi0] = Array.isArray(rawDmg) && rawDmg.length >= 2
    ? rawDmg
    : (Array.isArray(rawDmg) && rawDmg.length === 1 ? [rawDmg[0], rawDmg[0]] : CONFIG.enemy.damage)
  const dmgMin = Number(lo0)
  const dmgMax = Number(hi0)
  const enemyDmg = typeof enemyData?.hitDamage === 'number' && Number.isFinite(enemyData.hitDamage)
    ? enemyData.hitDamage
    : rand(dmgMin, dmgMax)
  const bonus       = player.damageBonus ?? 0
  const maskPenalty = player.inventory?.some(e => e.id === 'plague-mask')   ? 1 : 0
  const collarBonus = player.inventory?.some(e => e.id === 'spiked-collar') ? 3 : 0
  const soulBonus   = Math.floor(player.soulboundBonus ?? 0)
  const totalBonus  = bonus + collarBonus + soulBonus - maskPenalty

  let playerDmg
  if (player.isRanger) {
    const [lo, hi] = RANGER_BASE.damage
    const hasRazor = player.inventory?.some(e => e.id === 'razors-edge')
    const max = Math.max(1, hi + totalBonus)
    playerDmg = hasRazor ? max : rand(Math.max(1, lo + totalBonus), max)
  } else if (player.isEngineer) {
    const bd = ENGINEER_BASE.damage
    const base = Array.isArray(bd) ? rand(...bd) : bd
    playerDmg = base + totalBonus
  } else if (player.isVampire) {
    playerDmg = VAMPIRE_BASE.damage + totalBonus
  } else {
    const bd = CONFIG.player.baseDamage
    const base = Array.isArray(bd) ? rand(...bd) : bd
    playerDmg = base + totalBonus
  }

  const goldDrop = 1
  const xpDrop   = enemyData?.xpDrop ?? 5

  const safePlayerDmg = Number.isFinite(playerDmg) ? Math.max(0, Math.floor(playerDmg)) : 1
  const safeEnemyDmg = Number.isFinite(enemyDmg) ? Math.max(0, Math.floor(enemyDmg)) : 1

  Logger.debug(`[CombatResolver] fight — enemy:${safeEnemyDmg}, player:${safePlayerDmg}, gold:${goldDrop}`)

  return { enemyDmg: safeEnemyDmg, playerDmg: safePlayerDmg, goldDrop, xpDrop,
    message: `You strike for ${safePlayerDmg}! Enemy slain. +${goldDrop} gold.` }
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
  const rawDmg = enemyData?.dmg ?? CONFIG.enemy.fastDamage
  const [lo0, hi0] = Array.isArray(rawDmg) && rawDmg.length >= 2
    ? rawDmg
    : (Array.isArray(rawDmg) && rawDmg.length === 1 ? [rawDmg[0], rawDmg[0]] : CONFIG.enemy.fastDamage)
  const dmg = typeof enemyData?.hitDamage === 'number' && Number.isFinite(enemyData.hitDamage)
    ? enemyData.hitDamage
    : rand(Number(lo0), Number(hi0))
  const safeDmg = Number.isFinite(dmg) ? Math.max(0, Math.floor(dmg)) : 1
  Logger.debug(`[CombatResolver] fast reveal hit — dmg:${safeDmg}`)
  return { dmg: safeDmg }
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

/**
 * Minimum ability damage that scales with floor depth.
 * Ensures abilities never feel useless even on a low-meta run.
 * Full-meta players are unaffected (their damage exceeds this floor).
 * floor 1–9 → 1, floor 10–19 → 2, floor 20–29 → 3, etc.
 */
function abilityDmgFloor(floor) {
  return Math.max(1, Math.floor((floor ?? 1) / 10))
}

export default { resolveFight, resolveSpell, resolveFlee, resolveFastReveal, rollMerchant, abilityDmgFloor }
