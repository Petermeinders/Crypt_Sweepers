/**
 * Meta spending for test-bot-ongoing: global passives (gold) then character XP upgrades,
 * then gear blacksmith upgrades (only once passives+XP options are exhausted).
 * Cheapest affordable purchase each iteration until nothing left to buy.
 */
import MetaProgression from '../systems/MetaProgression.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { CONFIG } from '../config.js'
import { GLOBAL_PASSIVE_UPGRADES, GLOBAL_PASSIVE_IDS } from '../data/passives.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'

function _charXp(save, char) {
  if (char === 'ranger') return save.ranger?.totalXP ?? 0
  if (char === 'engineer') return save.engineer?.totalXP ?? 0
  if (char === 'mage') return save.mage?.totalXP ?? 0
  if (char === 'vampire') return save.vampire?.totalXP ?? 0
  return save.warrior?.totalXP ?? 0
}

const GEAR_SLOTS = ['weapon', 'breastplate', 'offhand']
const TIER_PRIORITY = ['legendary', 'void', 'epic', 'rare', 'common']

/**
 * Try to buy one gear upgrade. Prioritises highest-tier piece, lowest upgrade number first.
 * Returns true if a purchase was made.
 */
function _tryOneGearUpgrade(save) {
  const gear = save.equippedGear
  if (!gear) return false

  // Build candidate list: slot, piece, upgrade cost
  const candidates = []
  for (const slot of GEAR_SLOTS) {
    const piece = gear[slot]
    if (!piece || piece.upgradeCount >= 3) continue
    const upgradeNum = piece.upgradeCount + 1
    const cost = CONFIG.blacksmith.upgradeCosts[piece.tier]?.[upgradeNum]
    if (!cost) continue
    if ((save.persistentGold ?? 0) < cost.gold) continue
    if ((save.scrap ?? 0) < cost.scrap) continue
    candidates.push({ slot, piece, cost, upgradeNum })
  }

  if (candidates.length === 0) return false

  // Sort: highest tier first, then by upgrade number ascending (cheapest first within tier)
  candidates.sort((a, b) => {
    const ta = TIER_PRIORITY.indexOf(a.piece.tier)
    const tb = TIER_PRIORITY.indexOf(b.piece.tier)
    if (ta !== tb) return ta - tb
    return a.upgradeNum - b.upgradeNum
  })

  const { slot, piece, cost } = candidates[0]
  save.persistentGold = (save.persistentGold ?? 0) - cost.gold
  save.scrap = Math.max(0, (save.scrap ?? 0) - cost.scrap)

  // Apply +25% to all positive stats (mirrors GearController.applyGearUpgrade)
  for (const key of Object.keys(piece.stats)) {
    const val = piece.stats[key]
    if (val <= 0) continue
    if (key === 'negation') {
      piece.stats[key] = Math.round(val * 1.25 * 1000) / 1000
    } else {
      piece.stats[key] = Math.round(val * 1.25)
    }
  }
  piece.upgradeCount++

  console.log(`[test-bot-ongoing] gear upgrade: ${slot} ${piece.name} → +${piece.upgradeCount} (gold ${cost.gold}, scrap ${cost.scrap})`)
  return true
}

/**
 * @returns {{ passivesBought: number, xpUpgradesBought: number, gearUpgradesBought: number }}
 */
export function applyTestBotOngoingMetaPurchases(save) {
  let passivesBought = 0
  let xpUpgradesBought = 0
  let gearUpgradesBought = 0
  const char = save.selectedCharacter ?? 'warrior'

  for (let guard = 0; guard < 500; guard++) {
    let bought = false

    // Priority 1: global passives (gold cost)
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

    // Priority 2: hero XP ability upgrades
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

    // Priority 3: gear blacksmith upgrades (only when passives+XP are exhausted)
    if (_tryOneGearUpgrade(save)) {
      gearUpgradesBought++
      bought = true
      continue
    }

    if (!bought) break
  }

  SaveManager.save(save).catch(() => {})
  UI.updateMenuStats(save.persistentGold, _charXp(save, char))
  return { passivesBought, xpUpgradesBought, gearUpgradesBought }
}
