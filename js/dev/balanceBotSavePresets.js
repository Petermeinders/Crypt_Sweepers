/**
 * One-shot save mutations for balance-bot spectrum tests (beginner vs end).
 * Only applied when the page is loaded with balanceBot=1 and a preset param — see main.js.
 */
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_UPGRADES } from '../data/vampire.js'
import { NECROMANCER_UPGRADES } from '../data/necromancer.js'
import { GLOBAL_PASSIVE_IDS } from '../data/passives.js'

const UPGRADE_MAPS = {
  warrior:     WARRIOR_UPGRADES,
  ranger:      RANGER_UPGRADES,
  engineer:    ENGINEER_UPGRADES,
  mage:        MAGE_UPGRADES,
  vampire:     VAMPIRE_UPGRADES,
  necromancer: NECROMANCER_UPGRADES,
}

function _ensureHeroSave(save, hero) {
  if (!save[hero]) save[hero] = { totalXP: 0, upgrades: [] }
  if (!Array.isArray(save.unlockedHeroes)) save.unlockedHeroes = ['warrior']
  if (!save.unlockedHeroes.includes(hero)) save.unlockedHeroes.push(hero)
  if (hero === 'ranger' && save.ranger) save.ranger.unlocked = true
}

/**
 * @param {object} save — MetaProgression save object (mutated in place)
 * @param {'beginner' | 'end'} preset
 * @param {string} [hero] — hero id ('warrior','ranger','mage','engineer','vampire','necromancer')
 */
export function applyBalanceBotSavePreset(save, preset, hero = 'warrior') {
  const safeHero = UPGRADE_MAPS[hero] ? hero : 'warrior'
  _ensureHeroSave(save, safeHero)

  if (preset === 'beginner') {
    save.selectedCharacter = safeHero
    save[safeHero].upgrades = []
    save[safeHero].totalXP = 0
    save.warrior.shopCart = []
    save.globalPassives = []
    save.persistentGold = 0
    return
  }

  if (preset === 'end') {
    save.selectedCharacter = safeHero
    const upgradeMap = UPGRADE_MAPS[safeHero]
    save[safeHero].upgrades = Object.keys(upgradeMap)
    const spent = Object.values(upgradeMap).reduce((s, u) => s + (u.xpCost ?? 0), 0)
    save[safeHero].totalXP = spent
    save.warrior.shopCart = []
    save.globalPassives = [...GLOBAL_PASSIVE_IDS]
    save.persistentGold = 0
  }
}
