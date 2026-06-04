import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import {
  applyCorruptionCapsToPlayer,
  applyCorruptionPick,
  getCorruptionPool,
  needsCorruptionPick,
  recomputePlayerCapsFromCorruption,
  rollCorruptionTriplet,
} from '../systems/VoidCorruption.js'
import { isVoidTrialRun } from '../systems/VoidTrial.js'

function ensureCorruptionState(run) {
  if (!run.corruption) {
    run.corruption = { stacks: {}, pickedFloors: [], pendingTriplet: null, introShown: false }
  }
}

/** After floor load — intro (once per run) then triplet pick if needed. */
export function beginVoidCorruptionFlow(ctx) {
  const run = session.run
  if (!isVoidTrialRun(run) || run.atRest) {
    run._voidCorruptionBlocking = false
    UI.renderVoidCorruptionPanel(run)
    return
  }
  recomputePlayerCapsFromCorruption(run.player)
  applyCorruptionCapsToPlayer(run, run.player)
  if (!needsCorruptionPick(run)) {
    run._voidCorruptionBlocking = false
    UI.renderVoidCorruptionPanel(run)
    return
  }

  ensureCorruptionState(run)
  run._voidCorruptionBlocking = true

  const startPick = () => {
    let triplet = run.corruption.pendingTriplet
    if (!triplet?.length) {
      triplet = rollCorruptionTriplet(getCorruptionPool())
      run.corruption.pendingTriplet = triplet
      ctx.saveActiveRun?.()
    }
    UI.showVoidCorruptionPick(triplet, curseId => {
      applyCorruptionPick(run, curseId)
      recomputePlayerCapsFromCorruption(run.player)
      applyCorruptionCapsToPlayer(run, run.player)
      const [d0, d1] = ctx.playerDamageRange(run.player)
      UI.updateHP(run.player.hp, run.player.maxHp)
      UI.updateMana(run.player.mana, run.player.maxMana)
      UI.updateDamageRange(d0, d1)
      UI.renderVoidCorruptionPanel(run)
      ctx.saveActiveRun?.()
    })
  }

  if (!run.corruption.introShown) {
    UI.showVoidCorruptionIntro(() => {
      run.corruption.introShown = true
      ctx.saveActiveRun?.()
      startPick()
    })
  } else {
    startPick()
  }
}
