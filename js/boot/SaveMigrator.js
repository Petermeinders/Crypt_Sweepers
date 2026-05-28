import { GLOBAL_PASSIVE_IDS } from '../data/passives.js'
import { SELECTABLE_HEROES } from '../data/characters.js'
import MetaProgression from '../systems/MetaProgression.js'

/**
 * Migrate old saves missing keys. Returns the (possibly mutated) save and whether
 * the caller should persist — only true when legacy boot() would have called SaveManager.save().
 * @param {object} save
 * @returns {{ save: object, changed: boolean }}
 */
export function migrateSave(save) {
  let changed = false

  if (save.scrap == null) save.scrap = 0

  if (save.equippedGear) {
    let _gearMigrated = false
    for (const slot of ['weapon', 'breastplate', 'offhand']) {
      const piece = save.equippedGear[slot]
      if (!piece?.stats) continue
      if ('maxHp' in piece.stats)   { piece.stats.maxHpPct  = piece.stats.maxHp;   delete piece.stats.maxHp;   _gearMigrated = true }
      if ('maxMana' in piece.stats) { piece.stats.maxManaPct = piece.stats.maxMana; delete piece.stats.maxMana; _gearMigrated = true }
    }
    if (_gearMigrated) changed = true
  }

  if (save.settings.tileColors === undefined) save.settings.tileColors = false
  if (save.settings.musicOn === undefined)    save.settings.musicOn    = true
  if (save.settings.sfxOn   === undefined)    save.settings.sfxOn      = true
  if (save.settings.subLevelsEnabled === undefined) save.settings.subLevelsEnabled = true
  if (save.settings.warBannerIntroSeen === undefined) save.settings.warBannerIntroSeen = false
  if (!save.settings.cheats) save.settings.cheats = {}
  if (!save.globalPassives) save.globalPassives = []
  {
    const _validPassive = new Set(GLOBAL_PASSIVE_IDS)
    const _gp = save.globalPassives.filter((id) => _validPassive.has(id))
    if (_gp.length !== save.globalPassives.length) {
      save.globalPassives = _gp
      changed = true
    }
  }
  if (!Array.isArray(save.bestiarySeen)) save.bestiarySeen = []

  if (!save.ranger) {
    save.ranger = { unlocked: false, totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.engineer) {
    save.engineer = { totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.mage) {
    save.mage = { totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.vampire) {
    save.vampire = { totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.necromancer) {
    save.necromancer = { totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.selectedCharacter) {
    save.selectedCharacter = 'warrior'
  }

  if (!save.warrior.upgrades.includes('slam')) {
    save.warrior.upgrades.push('slam')
    changed = true
  }

  MetaProgression.normalizeUnlockedHeroes(save)
  {
    const selId = save.selectedCharacter ?? 'warrior'
    const selCh = SELECTABLE_HEROES.find(c => c.id === selId)
    if (selCh && (selCh.comingSoon || (selCh.unlockCost != null && !MetaProgression.isHeroUnlocked(save, selId)))) {
      save.selectedCharacter = 'warrior'
      changed = true
    }
  }

  return { save, changed }
}
