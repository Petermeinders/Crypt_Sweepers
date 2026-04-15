import { WARRIOR_UPGRADES, SHOP_ITEMS } from '../data/upgrades.js'
import { RANGER_UPGRADES }             from '../data/ranger.js'
import { ENGINEER_UPGRADES }           from '../data/engineer.js'
import { GLOBAL_PASSIVE_UPGRADES }     from '../data/passives.js'
import { CONFIG }                       from '../config.js'
import Logger                           from '../core/Logger.js'

// ── Default save data ────────────────────────────────────────

export function defaultSave() {
  return {
    version:       '1.2',
    lastSaved:     0,
    persistentGold: 0,
    /** @type {string[]} enemyId keys from ENEMY_DEFS */
    bestiarySeen:  [],
    globalPassives: [],
    warrior: {
      totalXP:   0,
      upgrades:  [],
      shopCart:  [],
    },
    ranger: {
      unlocked:  false,
      totalXP:   0,
      upgrades:  [],
    },
    engineer: {
      totalXP:  0,
      upgrades: [],
    },
    selectedCharacter: 'warrior',
    settings: {
      difficulty:  'normal',
      tileColors:  false,
      /** Feature flag: hidden passages / sub-floors (default on) */
      subLevelsEnabled: true,
      /** Shown once: full-screen war banner intro (bestiary-style) */
      warBannerIntroSeen: false,
    },
  }
}

// ── XP tree ──────────────────────────────────────────────────

function canBuyUpgrade(save, upgradeId) {
  const def = WARRIOR_UPGRADES[upgradeId]
  if (!def) return false
  if (save.warrior.upgrades.includes(upgradeId)) return false
  return save.warrior.totalXP >= def.xpCost
}

function buyUpgrade(save, upgradeId) {
  if (!canBuyUpgrade(save, upgradeId)) return false
  save.warrior.totalXP -= WARRIOR_UPGRADES[upgradeId].xpCost
  save.warrior.upgrades.push(upgradeId)
  Logger.debug(`[MetaProgression] Upgrade purchased: ${upgradeId}`)
  return true
}

// ── Global passives ──────────────────────────────────────────

function canBuyGlobalPassive(save, id) {
  const def = GLOBAL_PASSIVE_UPGRADES[id]
  if (!def) return false
  if ((save.globalPassives ?? []).includes(id)) return false
  return save.persistentGold >= def.goldCost
}

function buyGlobalPassive(save, id) {
  if (!canBuyGlobalPassive(save, id)) return false
  if (!save.globalPassives) save.globalPassives = []
  save.persistentGold -= GLOBAL_PASSIVE_UPGRADES[id].goldCost
  save.globalPassives.push(id)
  Logger.debug(`[MetaProgression] Global passive bought: ${id}`)
  return true
}

// ── Gold shop ─────────────────────────────────────────────────

function canBuyShopItem(save, itemId) {
  const def = SHOP_ITEMS[itemId]
  if (!def) return false
  if (save.warrior.shopCart.includes(itemId)) return false
  return save.persistentGold >= def.goldCost
}

function buyShopItem(save, itemId) {
  if (!canBuyShopItem(save, itemId)) return false
  save.persistentGold -= SHOP_ITEMS[itemId].goldCost
  save.warrior.shopCart.push(itemId)
  Logger.debug(`[MetaProgression] Shop item bought: ${itemId}`)
  return true
}

function removeShopItem(save, itemId) {
  const idx = save.warrior.shopCart.indexOf(itemId)
  if (idx === -1) return false
  save.warrior.shopCart.splice(idx, 1)
  save.persistentGold += SHOP_ITEMS[itemId].goldCost
  return true
}

// ── Apply upgrades + shop cart to a fresh player object ──────
// Called at run start. Mutates player in-place.

function applyToPlayer(player, save) {
  const diff = save.settings.difficulty
  const diffMod = CONFIG.difficulty[diff] ?? CONFIG.difficulty.normal

  player.damageTakenMult = diffMod.damageTakenMult

  // Pick correct XP tree based on selected character
  const char = save.selectedCharacter ?? 'warrior'
  const upgradeIds = char === 'ranger'
    ? (save.ranger?.upgrades ?? [])
    : char === 'engineer'
      ? (save.engineer?.upgrades ?? [])
      : (save.warrior?.upgrades ?? [])
  const upgradeMap = char === 'ranger' ? RANGER_UPGRADES : char === 'engineer' ? ENGINEER_UPGRADES : WARRIOR_UPGRADES

  for (const id of upgradeIds) {
    const def = upgradeMap[id]
    if (!def) continue
    _applyUpgradeEffect(player, def.effect)
  }

  // Global passives (apply to all heroes)
  for (const id of (save.globalPassives ?? [])) {
    const def = GLOBAL_PASSIVE_UPGRADES[id]
    if (!def) continue
    _applyUpgradeEffect(player, def.effect)
  }

  // Gold shop cart (warrior only for now; shared pool)
  for (const id of save.warrior.shopCart) {
    const def = SHOP_ITEMS[id]
    if (!def) continue
    const { effect } = def
    switch (effect.type) {
      case 'bonus-hp-this-run':
        player.maxHp += effect.amount
        player.hp    += effect.amount
        break
      case 'bonus-mana-this-run':
        player.maxMana += effect.amount
        player.mana   += effect.amount
        break
      case 'bonus-starting-gold-run':
        player.gold += effect.amount
        break
      case 'bonus-damage-reduction-run':
        player.damageReduction += effect.amount
        break
      case 'extra-ability-choice':
        player.extraAbilityChoice = true
        break
    }
  }
}

function _applyUpgradeEffect(player, effect) {
  switch (effect.type) {
    case 'bonus-max-hp':
      player.maxHp += effect.amount
      player.hp    += effect.amount
      break
    case 'bonus-damage':
      player.damageBonus += effect.amount
      break
    case 'bonus-max-mana':
      player.maxMana += effect.amount
      player.mana   += effect.amount
      break
    case 'better-retreat':
      player.retreatPercent = effect.percent
      break
    case 'bonus-damage-reduction':
      player.damageReduction += effect.amount
      break
    case 'bonus-spell-reduction':
      player.spellCostReduction += effect.amount
      break
    case 'bonus-starting-gold':
      player.gold += effect.amount
      break
    case 'trap-dodge':
      player.trapDodgeChance = (player.trapDodgeChance ?? 0) + effect.chance
      break
    case 'reflex-dodge':
      player.reflexDodgeChance = (player.reflexDodgeChance ?? 0) + effect.chance
      break
  }
}

// ── Ranger unlock ─────────────────────────────────────────────

function canUnlockRanger(save) {
  return !save.ranger.unlocked && save.persistentGold >= CONFIG.rangerUnlockCost
}

function unlockRanger(save) {
  if (!canUnlockRanger(save)) return false
  save.persistentGold -= CONFIG.rangerUnlockCost
  save.ranger.unlocked = true
  Logger.debug('[MetaProgression] Ranger unlocked')
  return true
}

// ── Ranger XP tree ────────────────────────────────────────────

function canBuyRangerUpgrade(save, id) {
  const def = RANGER_UPGRADES[id]
  if (!def) return false
  if (save.ranger.upgrades.includes(id)) return false
  if (def.requires && !save.ranger.upgrades.includes(def.requires)) return false
  return save.ranger.totalXP >= def.xpCost
}

function buyRangerUpgrade(save, id) {
  if (!canBuyRangerUpgrade(save, id)) return false
  save.ranger.totalXP -= RANGER_UPGRADES[id].xpCost
  save.ranger.upgrades.push(id)
  Logger.debug(`[MetaProgression] Ranger upgrade: ${id}`)
  return true
}

// ── Engineer XP tree ──────────────────────────────────────────

function canBuyEngineerUpgrade(save, id) {
  const def = ENGINEER_UPGRADES[id]
  if (!def) return false
  if (save.engineer.upgrades.includes(id)) return false
  if (def.requires && !save.engineer.upgrades.includes(def.requires)) return false
  return save.engineer.totalXP >= def.xpCost
}

function buyEngineerUpgrade(save, id) {
  if (!canBuyEngineerUpgrade(save, id)) return false
  save.engineer.totalXP -= ENGINEER_UPGRADES[id].xpCost
  save.engineer.upgrades.push(id)
  Logger.debug(`[MetaProgression] Engineer upgrade: ${id}`)
  return true
}

// ── Run XP calculation ────────────────────────────────────────

function calcRunXP(runStats) {
  // Always earn XP — reward for playing regardless of outcome
  return Math.floor(
    runStats.floor          * 15 +
    runStats.tilesRevealed  *  1 +
    runStats.level          *  8
  )
}

// ── End-of-run update ─────────────────────────────────────────
// Returns { xpEarned, goldBanked }

function endRun(save, runStats, outcome) {
  const xpEarned = calcRunXP(runStats)
  // Credit XP to the correct character
  const char = save.selectedCharacter ?? 'warrior'
  if (char === 'ranger') {
    save.ranger.totalXP += xpEarned
  } else if (char === 'engineer') {
    save.engineer.totalXP += xpEarned
  } else {
    save.warrior.totalXP += xpEarned
  }

  let goldBanked = 0
  if (outcome === 'escape' || outcome === 'retreat') {
    goldBanked = runStats.gold
  } else if (outcome === 'death') {
    // Only safe gold (banked at checkpoints) is kept
    goldBanked = runStats.safeGold ?? 0
  }

  save.persistentGold += goldBanked

  // Clear shop cart — items were consumed this run
  save.warrior.shopCart = []

  Logger.debug(`[MetaProgression] Run ended: +${xpEarned} XP, +${goldBanked} gold banked`)
  return { xpEarned, goldBanked }
}

export default {
  defaultSave,
  canBuyUpgrade,
  buyUpgrade,
  canBuyGlobalPassive,
  buyGlobalPassive,
  canBuyShopItem,
  buyShopItem,
  removeShopItem,
  canUnlockRanger,
  unlockRanger,
  canBuyRangerUpgrade,
  buyRangerUpgrade,
  canBuyEngineerUpgrade,
  buyEngineerUpgrade,
  applyToPlayer,
  calcRunXP,
  endRun,
  WARRIOR_UPGRADES,
  SHOP_ITEMS,
  RANGER_UPGRADES,
  ENGINEER_UPGRADES,
}
