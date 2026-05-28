import MetaProgression from '../../systems/MetaProgression.js'

export function metaCharSave(save, charId) {
  return save[charId] ?? save.warrior
}

/** Gold-locked roster hero (not Paladin, not Coming Soon) — must appear in save.unlockedHeroes. */
export function heroIsGoldLocked(save, char) {
  if (!save || !char || char.comingSoon) return false
  if (char.id === 'warrior') return false
  if (char.unlockCost == null) return false
  return !MetaProgression.isHeroUnlocked(save, char.id)
}
