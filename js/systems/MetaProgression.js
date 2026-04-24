import { WARRIOR_UPGRADES, SHOP_ITEMS } from '../data/upgrades.js'
import { RANGER_UPGRADES }             from '../data/ranger.js'
import { ENGINEER_UPGRADES }           from '../data/engineer.js'
import { MAGE_UPGRADES }               from '../data/mage.js'
import { NECROMANCER_UPGRADES }        from '../data/necromancer.js'
import { VAMPIRE_UPGRADES }            from '../data/vampire.js'
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
    /** Hero IDs unlocked for selection (always includes warrior). Ranger syncs with ranger.unlocked. */
    unlockedHeroes: ['warrior'],
    ranger: {
      unlocked:  false,
      totalXP:   0,
      upgrades:  [],
    },
    engineer: {
      totalXP:  0,
      upgrades: [],
    },
    mage: {
      totalXP:  0,
      upgrades: [],
    },
    vampire: {
      totalXP:  0,
      upgrades: [],
    },
    necromancer: {
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
  Logger.info(`[MetaProgression] Upgrade purchased: ${upgradeId}`)
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
  Logger.info(`[MetaProgression] Global passive bought: ${id}`)
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
  Logger.info(`[MetaProgression] Shop item bought: ${itemId}`)
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
      : char === 'mage'
        ? (save.mage?.upgrades ?? [])
        : char === 'vampire'
          ? (save.vampire?.upgrades ?? [])
          : char === 'necromancer'
            ? (save.necromancer?.upgrades ?? [])
            : (save.warrior?.upgrades ?? [])
  const upgradeMap = char === 'ranger'
    ? RANGER_UPGRADES
    : char === 'engineer'
      ? ENGINEER_UPGRADES
      : char === 'mage'
        ? MAGE_UPGRADES
        : char === 'vampire'
          ? VAMPIRE_UPGRADES
          : char === 'necromancer'
            ? NECROMANCER_UPGRADES
            : WARRIOR_UPGRADES

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

// ── Hero gold unlocks (Paladin/warrior free; others purchased) ─────────────────

/** Gold cost to unlock this hero ID, or null if not sold for gold. */
function heroUnlockGoldCost(heroId) {
  if (heroId === 'ranger') return CONFIG.rangerUnlockCost
  if (heroId === 'mage') return CONFIG.mageUnlockCost
  if (heroId === 'vampire') return CONFIG.vampireUnlockCost
  if (heroId === 'engineer') return CONFIG.engineerUnlockCost
  if (heroId === 'necromancer') return CONFIG.necromancerUnlockCost
  return null
}

/** Merge unlockedHeroes array, legacy ranger.unlocked, and grandfathered meta progress. */
function normalizeUnlockedHeroes(save) {
  if (!save) return
  if (!Array.isArray(save.unlockedHeroes)) save.unlockedHeroes = ['warrior']
  const set = new Set(save.unlockedHeroes)
  set.add('warrior')
  if (save.ranger?.unlocked) set.add('ranger')
  for (const id of ['mage', 'engineer', 'vampire', 'necromancer']) {
    const st = save[id]
    if (st && ((st.totalXP ?? 0) > 0 || (st.upgrades?.length ?? 0) > 0)) set.add(id)
  }
  save.unlockedHeroes = [...set]
  if (set.has('ranger') && save.ranger) save.ranger.unlocked = true
}

function isHeroUnlocked(save, heroId) {
  if (!save || heroId === 'warrior') return true
  normalizeUnlockedHeroes(save)
  return save.unlockedHeroes.includes(heroId)
}

function canUnlockHero(save, heroId) {
  if (!save || heroId === 'warrior') return false
  if (isHeroUnlocked(save, heroId)) return false
  const cost = heroUnlockGoldCost(heroId)
  if (cost == null) return false
  return save.persistentGold >= cost
}

function unlockHero(save, heroId) {
  if (!canUnlockHero(save, heroId)) return false
  const cost = heroUnlockGoldCost(heroId)
  save.persistentGold -= cost
  normalizeUnlockedHeroes(save)
  if (!save.unlockedHeroes.includes(heroId)) save.unlockedHeroes.push(heroId)
  if (heroId === 'ranger' && save.ranger) save.ranger.unlocked = true
  Logger.info(`[MetaProgression] Hero unlocked: ${heroId}`)
  return true
}

function canUnlockRanger(save) {
  return canUnlockHero(save, 'ranger')
}

function unlockRanger(save) {
  return unlockHero(save, 'ranger')
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
  Logger.info(`[MetaProgression] Ranger upgrade: ${id}`)
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
  Logger.info(`[MetaProgression] Engineer upgrade: ${id}`)
  return true
}

// ── Mage XP tree ──────────────────────────────────────────────

function canBuyMageUpgrade(save, id) {
  const def = MAGE_UPGRADES[id]
  if (!def) return false
  if (!save.mage) return false
  if (save.mage.upgrades.includes(id)) return false
  if (def.requires && !save.mage.upgrades.includes(def.requires)) return false
  return save.mage.totalXP >= def.xpCost
}

function buyMageUpgrade(save, id) {
  if (!canBuyMageUpgrade(save, id)) return false
  save.mage.totalXP -= MAGE_UPGRADES[id].xpCost
  save.mage.upgrades.push(id)
  Logger.info(`[MetaProgression] Mage upgrade: ${id}`)
  return true
}

// ── Necromancer XP tree ───────────────────────────────────────

function canBuyNecromancerUpgrade(save, id) {
  const def = NECROMANCER_UPGRADES[id]
  if (!def) return false
  if (!save.necromancer) return false
  if (save.necromancer.upgrades.includes(id)) return false
  if (def.requires && !save.necromancer.upgrades.includes(def.requires)) return false
  return save.necromancer.totalXP >= def.xpCost
}

function buyNecromancerUpgrade(save, id) {
  if (!canBuyNecromancerUpgrade(save, id)) return false
  save.necromancer.totalXP -= NECROMANCER_UPGRADES[id].xpCost
  save.necromancer.upgrades.push(id)
  Logger.info(`[MetaProgression] Necromancer upgrade: ${id}`)
  return true
}

// ── Vampire XP tree ──────────────────────────────────────────

function canBuyVampireUpgrade(save, id) {
  const def = VAMPIRE_UPGRADES[id]
  if (!def) return false
  if (!save.vampire) return false
  if (save.vampire.upgrades.includes(id)) return false
  if (def.requires && !save.vampire.upgrades.includes(def.requires)) return false
  return save.vampire.totalXP >= def.xpCost
}

function buyVampireUpgrade(save, id) {
  if (!canBuyVampireUpgrade(save, id)) return false
  save.vampire.totalXP -= VAMPIRE_UPGRADES[id].xpCost
  save.vampire.upgrades.push(id)
  Logger.info(`[MetaProgression] Vampire upgrade: ${id}`)
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
  } else if (char === 'mage') {
    if (!save.mage) save.mage = { totalXP: 0, upgrades: [] }
    save.mage.totalXP += xpEarned
  } else if (char === 'vampire') {
    if (!save.vampire) save.vampire = { totalXP: 0, upgrades: [] }
    save.vampire.totalXP += xpEarned
  } else if (char === 'necromancer') {
    if (!save.necromancer) save.necromancer = { totalXP: 0, upgrades: [] }
    save.necromancer.totalXP += xpEarned
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

  Logger.info(`[MetaProgression] Run ended: +${xpEarned} XP, +${goldBanked} gold banked`)
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
  normalizeUnlockedHeroes,
  heroUnlockGoldCost,
  isHeroUnlocked,
  canUnlockHero,
  unlockHero,
  canUnlockRanger,
  unlockRanger,
  canBuyRangerUpgrade,
  buyRangerUpgrade,
  canBuyEngineerUpgrade,
  buyEngineerUpgrade,
  canBuyMageUpgrade,
  buyMageUpgrade,
  canBuyNecromancerUpgrade,
  buyNecromancerUpgrade,
  canBuyVampireUpgrade,
  buyVampireUpgrade,
  applyToPlayer,
  calcRunXP,
  endRun,
  WARRIOR_UPGRADES,
  SHOP_ITEMS,
  RANGER_UPGRADES,
  ENGINEER_UPGRADES,
  MAGE_UPGRADES,
  NECROMANCER_UPGRADES,
  VAMPIRE_UPGRADES,
}
