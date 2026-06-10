/**
 * One-shot save mutations for balance-bot progression profiles.
 *
 * Profiles:
 *   fresh    — no upgrades, no gold, no passives  (alias: beginner)
 *   mid      — first ~50% of upgrades, 4 global passives, 500 gold
 *   late     — first ~75% of upgrades, 6 global passives, 1500 gold
 *   full     — all upgrades, all passives          (alias: end)
 *
 * Usage: ?balanceBot=1&balanceBotPreset=mid&balanceBotHero=mage
 */
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_UPGRADES } from '../data/vampire.js'
import { NECROMANCER_UPGRADES } from '../data/necromancer.js'
import { NINJA_UPGRADES } from '../data/ninja.js'
import { GLOBAL_PASSIVE_IDS } from '../data/passives.js'
import { generateGear } from '../data/gear.js'

const UPGRADE_MAPS = {
  warrior:     WARRIOR_UPGRADES,
  ranger:      RANGER_UPGRADES,
  engineer:    ENGINEER_UPGRADES,
  mage:        MAGE_UPGRADES,
  vampire:     VAMPIRE_UPGRADES,
  necromancer: NECROMANCER_UPGRADES,
  ninja:       NINJA_UPGRADES,
}

export const VALID_PRESETS = ['fresh', 'beginner', 'early', 'mid', 'late', 'full', 'end', 'maxed', 'hero']

function _applyUpgrades(piece, count) {
  for (let i = 0; i < count; i++) {
    for (const key of Object.keys(piece.stats)) {
      const val = piece.stats[key]
      if (val <= 0) continue
      piece.stats[key] = key === 'negation'
        ? Math.round(val * 1.25 * 1000) / 1000
        : Math.round(val * 1.25)
    }
  }
  piece.upgradeCount = count
}

function _ensureHeroSave(save, hero) {
  if (!save[hero]) save[hero] = { totalXP: 0, upgrades: [] }
  if (!Array.isArray(save.unlockedHeroes)) save.unlockedHeroes = ['warrior']
  if (!save.unlockedHeroes.includes(hero)) save.unlockedHeroes.push(hero)
  if (hero === 'ranger' && save.ranger) save.ranger.unlocked = true
  if (hero === 'ninja' && save.ninja) save.ninja.unlocked = true
}

function _upgradeSlice(upgradeMap, fraction) {
  const ids = Object.keys(upgradeMap)
  const count = Math.max(1, Math.floor(ids.length * fraction))
  const slice = ids.slice(0, count)
  const xp = slice.reduce((s, id) => s + (upgradeMap[id].xpCost ?? 0), 0)
  return { ids: slice, xp }
}

/**
 * @param {object} save — MetaProgression save object (mutated in place)
 * @param {'fresh'|'beginner'|'mid'|'late'|'full'|'end'} preset
 * @param {string} [hero] — hero id
 */
export function applyBalanceBotSavePreset(save, preset, hero = 'warrior') {
  const safeHero = UPGRADE_MAPS[hero] ? hero : 'warrior'
  _ensureHeroSave(save, safeHero)
  if (save.warrior && !save.warrior.shopCart) save.warrior.shopCart = []

  const normalized = preset === 'beginner' ? 'fresh'
                   : preset === 'end'      ? 'full'
                   : preset === 'hero'     ? 'maxed'
                   : preset

  if (normalized === 'fresh') {
    save.selectedCharacter = safeHero
    save[safeHero].upgrades = []
    save[safeHero].totalXP = 0
    save.globalPassives = []
    save.persistentGold = 0
    return
  }

  if (normalized === 'early') {
    save.selectedCharacter = safeHero
    const { ids, xp } = _upgradeSlice(UPGRADE_MAPS[safeHero], 0.25)
    save[safeHero].upgrades = ids
    save[safeHero].totalXP = xp
    save.globalPassives = GLOBAL_PASSIVE_IDS.slice(0, 2)
    save.persistentGold = 250
    // Common weapon + rare breastplate at floor 1, no detriments guaranteed but RNG applies
    if (!save.equippedGear) save.equippedGear = { weapon: null, breastplate: null, offhand: null }
    save.equippedGear.weapon      = generateGear('weapon',      'common', 3)
    save.equippedGear.breastplate = generateGear('breastplate', 'rare',   3)
    // Trinket in safe pocket — heals on kill, rewarding aggressive play
    save.safePocketTrinket = { id: 'vampire-fang' }
    return
  }

  if (normalized === 'mid') {
    save.selectedCharacter = safeHero
    const { ids, xp } = _upgradeSlice(UPGRADE_MAPS[safeHero], 0.5)
    save[safeHero].upgrades = ids
    save[safeHero].totalXP = xp
    save.globalPassives = GLOBAL_PASSIVE_IDS.slice(0, 4)
    save.persistentGold = 500
    return
  }

  if (normalized === 'late') {
    save.selectedCharacter = safeHero
    const { ids, xp } = _upgradeSlice(UPGRADE_MAPS[safeHero], 0.75)
    save[safeHero].upgrades = ids
    save[safeHero].totalXP = xp
    save.globalPassives = GLOBAL_PASSIVE_IDS.slice(0, 6)
    save.persistentGold = 1500
    return
  }

  if (normalized === 'full') {
    save.selectedCharacter = safeHero
    const upgradeMap = UPGRADE_MAPS[safeHero]
    save[safeHero].upgrades = Object.keys(upgradeMap)
    save[safeHero].totalXP = Object.values(upgradeMap).reduce((s, u) => s + (u.xpCost ?? 0), 0)
    save.globalPassives = [...GLOBAL_PASSIVE_IDS]
    save.persistentGold = 0
    return
  }

  if (normalized === 'maxed') {
    // All upgrades + all passives + fully-upgraded legendary/epic gear at floor 50
    save.selectedCharacter = safeHero
    const upgradeMap = UPGRADE_MAPS[safeHero]
    save[safeHero].upgrades = Object.keys(upgradeMap)
    save[safeHero].totalXP = Object.values(upgradeMap).reduce((s, u) => s + (u.xpCost ?? 0), 0)
    save.globalPassives = [...GLOBAL_PASSIVE_IDS]
    save.persistentGold = 0
    if (!save.equippedGear) save.equippedGear = { weapon: null, breastplate: null, offhand: null }
    const weapon      = generateGear('weapon',      'legendary', 50)
    const breastplate = generateGear('breastplate', 'legendary', 50)
    const offhand     = generateGear('offhand',     'epic',      50)
    _applyUpgrades(weapon,      3)
    _applyUpgrades(breastplate, 3)
    _applyUpgrades(offhand,     3)
    save.equippedGear.weapon      = weapon
    save.equippedGear.breastplate = breastplate
    save.equippedGear.offhand     = offhand
    // Unlock floor 50 checkpoint so player/bot can start deep
    if (!save.meta) save.meta = {}
    save.meta.deepestFloor = Math.max(save.meta.deepestFloor ?? 0, 50)
    // Clear any in-progress run so the game lands on the main menu
    delete save.activeRun
    return
  }
}
