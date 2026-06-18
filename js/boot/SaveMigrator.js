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
  if (save.safePocketTrinket === undefined) save.safePocketTrinket = null

  if (!save.meta) {
    save.meta = {
      gameCompleted: false,
      voidPearls: 0,
      voidPearlFloor50Awarded: false,
      voidUnlocked: false,
    }
    changed = true
  } else {
    if (save.meta.gameCompleted == null) save.meta.gameCompleted = false
    if (save.meta.voidPearls == null) save.meta.voidPearls = 0
    if (save.meta.voidPearlFloor50Awarded == null) {
      save.meta.voidPearlFloor50Awarded = save.meta.voidPearls > 0 || !!save.meta.gameCompleted
      changed = true
    }
    if (save.meta.voidUnlocked == null) {
      save.meta.voidUnlocked = !!(
        save.meta.voidPearlFloor50Awarded ||
        save.meta.voidPearls > 0 ||
        save.meta.gameCompleted
      )
      changed = true
    }
    if (save.meta.voidPearls > 0 && !save.meta.voidUnlocked) {
      save.meta.voidUnlocked = true
      changed = true
    }
  }

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
  if (!save.ninja) {
    save.ninja = { totalXP: 0, upgrades: [] }
    changed = true
  }
  if (!save.selectedCharacter) {
    save.selectedCharacter = 'warrior'
  }

  if (!save.warrior.upgrades.includes('slam')) {
    save.warrior.upgrades.push('slam')
    changed = true
  }

  if (!save.meta.casino) {
    save.meta.casino = { totalSpins: 0, totalGoldSpent: 0, totalScrapSpent: 0, voidFragments: 0, pendingGear: [] }
    changed = true
  } else {
    if (!Array.isArray(save.meta.casino.pendingGear)) { save.meta.casino.pendingGear = []; changed = true }
  }
  if (save.meta.deepestFloor == null) { save.meta.deepestFloor = 1; changed = true }

  MetaProgression.normalizeUnlockedHeroes(save)
  {
    const necroRenames = {
      'abyssal-reach':      'corpse-explosion-abyssal-1',
      'detonation-chain':   'corpse-explosion-detonation-1',
    }
    const ups = save.necromancer?.upgrades
    if (Array.isArray(ups)) {
      for (let i = 0; i < ups.length; i++) {
        if (ups[i] === 'corpse-explosion-mastery-1') {
          ups.splice(i, 1)
          i--
          changed = true
        } else if (necroRenames[ups[i]]) {
          ups[i] = necroRenames[ups[i]]
          changed = true
        }
      }
    }
  }
  {
    const engineerRenames = {
      'construct-turret-mastery-1': 'turret-mastery-mastery-1',
      'construct-turret-mastery-2': 'turret-mastery-mastery-2',
      'construct-turret-mastery-3': 'turret-mastery-mastery-3',
    }
    const ups = save.engineer?.upgrades
    if (Array.isArray(ups)) {
      for (let i = 0; i < ups.length; i++) {
        if (engineerRenames[ups[i]]) {
          ups[i] = engineerRenames[ups[i]]
          changed = true
        }
      }
    }
  }
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
