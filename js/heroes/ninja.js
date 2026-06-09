import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { session, charKey } from '../core/RunContext.js'
import { NINJA_UPGRADES } from '../data/ninja.js'

export function refreshNinjaHud(ctx) {
  if (charKey() !== 'ninja') return
  // Clear all other hero buttons
  UI.setSlamBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setRicochetBtn(false, 0)
  UI.setPoisonArrowShotBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setChainLightningBtn?.(false)
  UI.setStrengthenMinionBtn(false)
  UI.setBloodTitheBtn(false)
  UI.setMistFormBtn(false)
  UI.setBloodPactBtn(false)

  // Slot A: Shadowstrike
  const hasShadowstrike = ctx.isActiveUnlocked('shadowstrike', 'ninja')
  UI.setShadowstrikeBtn?.(hasShadowstrike, NINJA_UPGRADES['shadowstrike']?.manaCost ?? 10)

  // Slot B: Smoke Bomb
  const hasSmokeBomb = ctx.isActiveUnlocked('smoke-bomb', 'ninja')
  UI.setSmokeBombBtn?.(hasSmokeBomb, NINJA_UPGRADES['smoke-bomb']?.manaCost ?? 12)

  // Slot C: Shuriken
  const hasShuriken = ctx.isActiveUnlocked('shuriken', 'ninja')
  UI.setShurikenBtn?.(hasShuriken, NINJA_UPGRADES['shuriken']?.manaCost ?? 6)
}

export function shadowstrikeAction(ctx) {
  if (charKey() !== 'ninja') return
  if (!ctx.isActiveUnlocked('shadowstrike', 'ninja')) return
  // Stub — full implementation wired when targeting system is extended for ninja
  EventBus.emit('audio:play', { sfx: 'spell' })
}

export function smokeBombAction(ctx) {
  if (charKey() !== 'ninja') return
  if (!ctx.isActiveUnlocked('smoke-bomb', 'ninja')) return
  EventBus.emit('audio:play', { sfx: 'spell' })
}

export function shurikenAction(ctx) {
  if (charKey() !== 'ninja') return
  if (!ctx.isActiveUnlocked('shuriken', 'ninja')) return
  EventBus.emit('audio:play', { sfx: 'arrowShot' })
}

/** Returns how many Concealment stacks the ninja currently has. */
export function concealmentStacks() {
  return session.tap?.ninjaConcealment ?? 0
}

/** Consume one Concealment stack and return whether it was active. */
export function consumeConcealment() {
  if (!session.tap) return false
  if ((session.tap.ninjaConcealment ?? 0) <= 0) return false
  session.tap.ninjaConcealment -= 1
  return true
}

/** Grant a Concealment stack up to the cap. */
export function grantConcealment(save) {
  if (!session.tap) return
  const upgrades = save?.ninja?.upgrades ?? []
  const cap = upgrades.includes('shadow-step-2') ? 5
    : upgrades.includes('shadow-step') ? 4 : 3
  session.tap.ninjaConcealment = Math.min(cap, (session.tap.ninjaConcealment ?? 0) + 1)
}
