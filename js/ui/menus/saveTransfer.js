import { CHARACTERS } from '../../data/characters.js'
import MetaProgression from '../../systems/MetaProgression.js'

/** Shared save import — optional run resume when activeRun is present. */
export async function applyImportedSave(ctx, result, { resumeIfPossible = false } = {}) {
  const { GameController, UI } = ctx
  const imported = result?.save
  if (!imported) return { ok: false }

  if (result.partial) {
    const tiers = result.recoveredTiers?.join(', ') ?? 'partial data'
    UI.setMessage(`Save partially recovered (${tiers}).`, true)
  }

  MetaProgression.normalizeUnlockedHeroes(imported)
  const impSel = imported.selectedCharacter ?? 'warrior'
  const impCh  = CHARACTERS.find(c => c.id === impSel)
  if (impCh && (impCh.comingSoon || (impCh.unlockCost != null && !MetaProgression.isHeroUnlocked(imported, impSel)))) {
    imported.selectedCharacter = 'warrior'
  }

  GameController.init(imported)

  if (resumeIfPossible && imported.activeRun) {
    GameController.resumeRun()
    UI.setMessage(result.partial
      ? 'Partial save imported — run resumed where possible.'
      : 'Progress imported — run resumed.')
    return { ok: true, resumed: true }
  }

  UI.setActiveDifficulty(imported.settings?.difficulty ?? 'normal')
  UI.setMessage(result.partial ? 'Save partially imported.' : 'Save imported.')
  return { ok: true, resumed: false }
}
