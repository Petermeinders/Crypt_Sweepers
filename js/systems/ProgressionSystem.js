import { WARRIOR_ABILITIES } from '../data/abilities.js'
import { RANGER_ABILITIES, RANGER_UPGRADES }   from '../data/ranger.js'
import { ENGINEER_ABILITIES, ENGINEER_UPGRADES } from '../data/engineer.js'
import { MAGE_ABILITIES, MAGE_UPGRADES }       from '../data/mage.js'
import { NECROMANCER_ABILITIES, NECROMANCER_UPGRADES } from '../data/necromancer.js'
import { VAMPIRE_UPGRADES, VAMPIRE_MASTERY_ABILITIES } from '../data/vampire.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import Logger from '../core/Logger.js'

const STAT_ABILITIES = {
  vitality:        WARRIOR_ABILITIES.vitality,
  'arcane-reserve':WARRIOR_ABILITIES['arcane-reserve'],
  scavenger:       WARRIOR_ABILITIES.scavenger,
}

const ABILITY_MAPS = {
  warrior:     WARRIOR_ABILITIES,
  ranger:      RANGER_ABILITIES,
  engineer:    ENGINEER_ABILITIES,
  mage:        MAGE_ABILITIES,
  vampire:     { ...STAT_ABILITIES, ...VAMPIRE_MASTERY_ABILITIES },
  necromancer: NECROMANCER_ABILITIES,
}

const UPGRADE_MAPS = {
  warrior:     WARRIOR_UPGRADES,
  ranger:      RANGER_UPGRADES,
  engineer:    ENGINEER_UPGRADES,
  mage:        MAGE_UPGRADES,
  vampire:     VAMPIRE_UPGRADES,
  necromancer: NECROMANCER_UPGRADES,
}

const WEIGHTS = {
  stat:    10,
  mastery: 10,
  active:  1,    // locked actives — ~10% relative to a stat pick
}

function _getActiveUpgradeIds(charKey) {
  const map = UPGRADE_MAPS[charKey] ?? {}
  const ids = []
  for (const [id, def] of Object.entries(map)) {
    if (def.effect?.type === 'active-ability') ids.push(id)
  }
  return ids
}

function getAbilityDef(abilityId, charKey = 'warrior') {
  const aMap = ABILITY_MAPS[charKey] ?? WARRIOR_ABILITIES
  if (aMap[abilityId]) return aMap[abilityId]
  const uMap = UPGRADE_MAPS[charKey] ?? {}
  if (uMap[abilityId]) return uMap[abilityId]
  // Mastery upgrades for actives may live in another hero's map (e.g. ranger-arc-mastery) — search wide
  for (const map of Object.values(UPGRADE_MAPS)) if (map[abilityId]) return map[abilityId]
  for (const map of Object.values(ABILITY_MAPS)) if (map[abilityId]) return map[abilityId]
  return null
}

/** Returns array of choice descriptors: { id, kind } where kind ∈ 'active'|'mastery'|'stat'|'coins'. */
function getChoices(player, charKey = 'warrior', metaUnlockedIds = [], choiceCount = 3) {
  const meta            = new Set(metaUnlockedIds)
  const acquired        = new Set(player.abilities ?? [])
  const unlockedActives = new Set(player.unlockedActives ?? [])

  const allActives        = _getActiveUpgradeIds(charKey)
  const metaUnlockActives = allActives.filter(id => meta.has(id))
  const lockedActives     = metaUnlockActives.filter(id => !unlockedActives.has(id))

  // First level-up (player.level just bumped to 2): force-pick from up to 3 actives, skip stats entirely.
  if (player.level === 2 && metaUnlockActives.length > 0) {
    const shuffled = metaUnlockActives.slice().sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(choiceCount, shuffled.length)).map(id => ({ id, kind: 'active' }))
  }

  const aMap = ABILITY_MAPS[charKey] ?? STAT_ABILITIES
  const pool = []  // { id, kind, weight }

  // Always: HP / mana
  if (aMap.vitality)         pool.push({ id: 'vitality',         kind: 'stat',    weight: WEIGHTS.stat })
  if (aMap['arcane-reserve'])pool.push({ id: 'arcane-reserve',   kind: 'stat',    weight: WEIGHTS.stat })

  // Trapfinder is ranger-only and not gated by an active.
  if (charKey === 'ranger' && aMap.trapfinder) {
    pool.push({ id: 'trapfinder', kind: 'mastery', weight: WEIGHTS.mastery })
  }

  // Mastery picks for actives the player has chosen this run.
  for (const [id, def] of Object.entries(aMap)) {
    if (id === 'vitality' || id === 'arcane-reserve' || id === 'scavenger' || id === 'trapfinder') continue
    const reqActive  = def.requiresActive
    const reqAbility = def.requiresAbility
    if (reqActive && !unlockedActives.has(reqActive)) continue
    if (reqAbility && !acquired.has(reqAbility)) continue
    if (!def.repeatable && acquired.has(id)) continue
    pool.push({ id, kind: 'mastery', weight: WEIGHTS.mastery })
  }

  // Locked actives at low weight.
  for (const id of lockedActives) {
    pool.push({ id, kind: 'active', weight: WEIGHTS.active })
  }

  // Sample without replacement.
  const picked = _weightedSample(pool, choiceCount)

  // Coins (Scavenger) only as filler when the pool can't fill choiceCount.
  if (picked.length < choiceCount && aMap.scavenger) {
    if (!picked.find(p => p.id === 'scavenger')) {
      picked.push({ id: 'scavenger', kind: 'coins', weight: 0 })
    }
  }

  return picked
}

function _weightedSample(entries, n) {
  const remaining = entries.slice()
  const result = []
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const total = remaining.reduce((s, e) => s + e.weight, 0)
    if (total <= 0) break
    let r = Math.random() * total
    let idx = 0
    for (; idx < remaining.length; idx++) {
      r -= remaining[idx].weight
      if (r <= 0) break
    }
    if (idx >= remaining.length) idx = remaining.length - 1
    result.push(remaining[idx])
    remaining.splice(idx, 1)
  }
  return result
}

function applyAbility(abilityId, player, charKey = 'warrior', ctx = {}) {
  const def = getAbilityDef(abilityId, charKey)
  if (!def) {
    Logger.error(`[ProgressionSystem] Unknown ability: ${abilityId}`)
    return null
  }

  const { effect } = def

  switch (effect.type) {
    case 'active-ability': {
      if (!Array.isArray(player.unlockedActives)) player.unlockedActives = []
      const aid = effect.ability
      if (!player.unlockedActives.includes(aid)) player.unlockedActives.push(aid)
      break
    }
    case 'turret-max-level':
      player.turretMaxLevel = Math.max(player.turretMaxLevel ?? 1, effect.level)
      break
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
    case 'buff-gold': {
      const amt = effect.perFloor ? Math.max(1, ctx.floor ?? 1) : effect.amount
      player.gold = (player.gold ?? 0) + amt
      break
    }
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
    case 'trapfinder-stack':
      player.trapfinderStacks = (player.trapfinderStacks ?? 0) + (effect.amount ?? 1)
      break
    case 'slam-mult-bonus':
      player.slamMasteryStacks = (player.slamMasteryStacks ?? 0) + (effect.amount ?? 1)
      break
    case 'blinding-mult-bonus':
      player.blindingLightMasteryStacks = (player.blindingLightMasteryStacks ?? 0) + (effect.amount ?? 1)
      break
    case 'ranger-active-mastery': {
      const key = effect.ability
      if (!player.rangerActiveStacks) player.rangerActiveStacks = {}
      player.rangerActiveStacks[key] = (player.rangerActiveStacks[key] ?? 0) + 1
      break
    }
    case 'mage-active-mastery': {
      const key = effect.ability
      if (!player.mageActiveStacks) player.mageActiveStacks = {}
      player.mageActiveStacks[key] = (player.mageActiveStacks[key] ?? 0) + 1
      break
    }
    case 'necro-minion-mastery':
      player.minionMasteryLevel = Math.max(player.minionMasteryLevel ?? 1, effect.level)
      break
    case 'mana-generator-mastery':
      player.manaGeneratorMasteryStacks = (player.manaGeneratorMasteryStacks ?? 0) + 1
      break
    case 'blood-tithe-mastery':
      player.bloodTitheMasteryTier = Math.max(player.bloodTitheMasteryTier ?? 1, effect.tier)
      break
  }

  if (!Array.isArray(player.abilities)) player.abilities = []
  if (!player.abilities.includes(abilityId)) player.abilities.push(abilityId)

  Logger.debug(`[ProgressionSystem] Applied ability: ${abilityId}`)
  return effect.type
}

export default { getChoices, applyAbility, getAbilityDef, WARRIOR_ABILITIES, RANGER_ABILITIES, ENGINEER_ABILITIES, NECROMANCER_ABILITIES }
