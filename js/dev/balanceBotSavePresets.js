/**
 * One-shot save mutations for balance-bot spectrum tests (beginner vs end).
 * Only applied when the page is loaded with balanceBot=1 and a preset param — see main.js.
 */
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { GLOBAL_PASSIVE_IDS } from '../data/passives.js'

/**
 * @param {object} save — MetaProgression save object (mutated in place)
 * @param {'beginner' | 'end'} preset
 */
export function applyBalanceBotSavePreset(save, preset) {
  if (preset === 'beginner') {
    save.selectedCharacter = 'warrior'
    save.warrior.upgrades = []
    save.warrior.totalXP = 0
    save.warrior.shopCart = []
    save.globalPassives = []
    save.persistentGold = 0
    return
  }

  if (preset === 'end') {
    save.selectedCharacter = 'warrior'
    save.warrior.upgrades = Object.keys(WARRIOR_UPGRADES)
    const spent = Object.values(WARRIOR_UPGRADES).reduce((s, u) => s + (u.xpCost ?? 0), 0)
    save.warrior.totalXP = spent
    save.warrior.shopCart = []
    save.globalPassives = [...GLOBAL_PASSIVE_IDS]
    save.persistentGold = 0
  }
}
