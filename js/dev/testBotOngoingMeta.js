/**
 * Meta spending for test-bot-ongoing: global passives (gold) then character XP upgrades.
 * Cheapest affordable purchase each iteration until nothing left to buy.
 */
import MetaProgression from '../systems/MetaProgression.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { GLOBAL_PASSIVE_UPGRADES, GLOBAL_PASSIVE_IDS } from '../data/passives.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'

function _charXp(save, char) {
  if (char === 'ranger') return save.ranger?.totalXP ?? 0
  if (char === 'engineer') return save.engineer?.totalXP ?? 0
  return save.warrior?.totalXP ?? 0
}

/**
 * @returns {{ passivesBought: number, xpUpgradesBought: number }}
 */
export function applyTestBotOngoingMetaPurchases(save) {
  let passivesBought = 0
  let xpUpgradesBought = 0
  const char = save.selectedCharacter ?? 'warrior'

  for (let guard = 0; guard < 500; guard++) {
    let bought = false

    const passiveIds = GLOBAL_PASSIVE_IDS.filter(id => MetaProgression.canBuyGlobalPassive(save, id))
    if (passiveIds.length) {
      passiveIds.sort(
        (a, b) => GLOBAL_PASSIVE_UPGRADES[a].goldCost - GLOBAL_PASSIVE_UPGRADES[b].goldCost,
      )
      const id = passiveIds[0]
      if (MetaProgression.buyGlobalPassive(save, id)) {
        passivesBought++
        bought = true
        console.log(`[test-bot-ongoing] bought global passive: ${id}`)
        continue
      }
    }

    if (char === 'warrior') {
      const ids = Object.keys(WARRIOR_UPGRADES).filter(id => MetaProgression.canBuyUpgrade(save, id))
      ids.sort((a, b) => WARRIOR_UPGRADES[a].xpCost - WARRIOR_UPGRADES[b].xpCost)
      if (ids.length && MetaProgression.buyUpgrade(save, ids[0])) {
        xpUpgradesBought++
        bought = true
        console.log(`[test-bot-ongoing] bought warrior upgrade: ${ids[0]}`)
        continue
      }
    } else if (char === 'ranger') {
      const ids = Object.keys(RANGER_UPGRADES).filter(id => MetaProgression.canBuyRangerUpgrade(save, id))
      ids.sort((a, b) => RANGER_UPGRADES[a].xpCost - RANGER_UPGRADES[b].xpCost)
      if (ids.length && MetaProgression.buyRangerUpgrade(save, ids[0])) {
        xpUpgradesBought++
        bought = true
        console.log(`[test-bot-ongoing] bought ranger upgrade: ${ids[0]}`)
        continue
      }
    } else if (char === 'engineer') {
      const ids = Object.keys(ENGINEER_UPGRADES).filter(id =>
        MetaProgression.canBuyEngineerUpgrade(save, id),
      )
      ids.sort((a, b) => ENGINEER_UPGRADES[a].xpCost - ENGINEER_UPGRADES[b].xpCost)
      if (ids.length && MetaProgression.buyEngineerUpgrade(save, ids[0])) {
        xpUpgradesBought++
        bought = true
        console.log(`[test-bot-ongoing] bought engineer upgrade: ${ids[0]}`)
        continue
      }
    }

    if (!bought) break
  }

  SaveManager.save(save).catch(() => {})
  UI.updateMenuStats(save.persistentGold, _charXp(save, char))
  return { passivesBought, xpUpgradesBought }
}
