import { WARRIOR_ABILITIES } from '../data/abilities.js'
import { RANGER_ABILITIES }  from '../data/ranger.js'
import Logger from '../core/Logger.js'

const CHOICES_PER_LEVEL = 3

// ── Choice generation ────────────────────────────────────────
// Returns ability IDs to present to the player.
// charKey: 'warrior' | 'ranger'

function getChoices(acquiredAbilities, charKey = 'warrior') {
  const ABILITIES = charKey === 'ranger' ? RANGER_ABILITIES : WARRIOR_ABILITIES
  const pool = Object.keys(ABILITIES).filter(id => {
    const def = ABILITIES[id]
    if (def.repeatable) return true
    return !acquiredAbilities.includes(id)
  })

  if (pool.length === 0) {
    Logger.debug('[ProgressionSystem] Ability pool exhausted')
    return []
  }

  const shuffled = pool.slice().sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(CHOICES_PER_LEVEL, shuffled.length))
}

// ── Apply ability to player ──────────────────────────────────

function applyAbility(abilityId, player, charKey = 'warrior') {
  const ABILITIES = charKey === 'ranger' ? RANGER_ABILITIES : WARRIOR_ABILITIES
  const def = ABILITIES[abilityId]
  if (!def) {
    Logger.error(`[ProgressionSystem] Unknown ability: ${abilityId}`)
    return null
  }

  const { effect } = def

  switch (effect.type) {
    case 'buff-damage':
      player.damageBonus = (player.damageBonus ?? 0) + effect.amount
      break
    case 'buff-hp':
      player.maxHp += effect.maxHp
      player.hp = Math.min(player.maxHp, player.hp + effect.healNow)
      break
    case 'buff-mana':
      player.maxMana += effect.maxMana
      player.mana = Math.min(player.maxMana, player.mana + effect.restoreNow)
      break
    case 'buff-gold':
      player.gold = (player.gold ?? 0) + effect.amount
      break
    case 'reduce-spell-cost':
      player.spellCostReduction = (player.spellCostReduction ?? 0) + effect.amount
      break
    case 'damage-reduction':
      player.damageReduction = (player.damageReduction ?? 0) + effect.amount
      break
    case 'on-kill-heal':
      player.onKillHeal = (player.onKillHeal ?? 0) + effect.amount
      break
    case 'reduce-flee-cost':
      player.fleeMaxCost = effect.max
      break
    case 'undead-bonus':
      player.undeadBonus = true
      break
    case 'beast-bonus':
      player.beastBonus = true
      break
    case 'trap-reduction':
      player.trapReduction = (player.trapReduction ?? 0) + effect.amount
      break
    case 'slam-mult-bonus':
      player.slamMasteryStacks = (player.slamMasteryStacks ?? 0) + (effect.amount ?? 1)
      break
    case 'blinding-mult-bonus':
      player.blindingLightMasteryStacks = (player.blindingLightMasteryStacks ?? 0) + (effect.amount ?? 1)
      break
  }

  if (!player.abilities.includes(abilityId)) {
    player.abilities.push(abilityId)
  }

  Logger.debug(`[ProgressionSystem] Applied ability: ${abilityId}`)
  return effect.type
}

// Returns the correct ability definition map for a given ability ID
function getAbilityDef(abilityId, charKey = 'warrior') {
  const ABILITIES = charKey === 'ranger' ? RANGER_ABILITIES : WARRIOR_ABILITIES
  return ABILITIES[abilityId] ?? null
}

export default { getChoices, applyAbility, getAbilityDef, WARRIOR_ABILITIES, RANGER_ABILITIES }
