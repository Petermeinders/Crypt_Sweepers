import TileEngine from './TileEngine.js'

/** Browsers block vibrate until the user has interacted with the page (avoids console intervention spam). */
let _hapticUserGestureOk = false
if (typeof document !== 'undefined') {
  const arm = () => { _hapticUserGestureOk = true }
  document.addEventListener('pointerdown', arm, { capture: true, passive: true })
  document.addEventListener('touchstart', arm, { capture: true, passive: true })
  document.addEventListener('keydown', arm, { capture: true, passive: true })
}

let _getSave = () => null
let _getRun = () => null
let _charKey = () => 'warrior'
let _computeEffectiveDamageTaken = (dmg) => dmg

/** Wire save/run accessors from GameController.init. */
export function bindHaptics({ getSave, getRun, charKey, computeEffectiveDamageTaken }) {
  _getSave = getSave
  _getRun = getRun
  _charKey = charKey
  _computeEffectiveDamageTaken = computeEffectiveDamageTaken
}

/** Firefox enforces sticky user activation: vibrate() is ignored after await/setTimeout/microtasks. */
export function vibrationRequiresSyncUserActivation() {
  if (typeof navigator === 'undefined') return false
  return /Firefox/i.test(navigator.userAgent || '')
}

function _hapticApplyPattern(pattern) {
  if (typeof pattern === 'number' && Number.isFinite(pattern)) {
    navigator.vibrate(Math.max(0, Math.min(400, Math.round(pattern))))
  } else if (Array.isArray(pattern) && pattern.length) {
    const capped = pattern.map(n => Math.max(0, Math.min(400, Math.round(Number(n) || 0))))
    const ok = navigator.vibrate(capped)
    if (ok === false && capped[0] > 0) {
      navigator.vibrate(Math.min(capped[0], 80))
    }
  }
}

/** Call only from the same synchronous stack as pointerdown/click (tile tap, melee start, settings). */
export function hapticFromUserGesture(pattern) {
  if (!_hapticUserGestureOk || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  if (!(_getSave()?.settings?.hapticFeedback ?? true)) return
  try {
    _hapticApplyPattern(pattern)
  } catch (_) { /* ignore */ }
}

/** After async work (damage ticks, setTimeout combat). Silently skipped on Firefox — use hapticFromUserGesture earlier if possible. */
export function hapticFromAsyncTask(pattern) {
  if (vibrationRequiresSyncUserActivation()) return
  hapticFromUserGesture(pattern)
}

/** Light buzz for menu/settings/chrome buttons (main wires delegated click). */
export function uiButtonHaptic() {
  hapticFromUserGesture(10)
}

/** Read-only: would harass damage the player this global tick (matches tick loop + engineer/necro absorb rules)? */
function _previewHarassDamageThisTurn() {
  const grid = TileEngine.getGrid()
  const run = _getRun()
  if (!grid || !run) return false
  if (_charKey() === 'engineer' && run.turret?.hp > 0) return false
  if (_charKey() === 'necromancer' && run.minions?.some(m => m.hp > 0)) return false
  let total = 0
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
      if (!t.enemyData.harassPlayer) continue
      const rawDmg = t.enemyData.harassDmg ?? 1
      total += _computeEffectiveDamageTaken(rawDmg)
    }
  }
  return total > 0
}

/**
 * Firefox: vibrate in the user-gesture turn before the first await in revealTile.
 * One short pulse if trap (hurt path), DoT tick, or harass will apply. Sets tile._trapDodgeRoll for trap dodge sync with _resolveEffect.
 */
export function firefoxPreFlipHapticsIfNeeded(tile) {
  if (!vibrationRequiresSyncUserActivation()) return
  const run = _getRun()
  if (!run || !tile) return
  const p = run.player
  let shouldPulse = false

  if (tile.type === 'trap' && !p.trapImmune) {
    tile._trapDodgeRoll = Math.random()
    const chance = p.trapDodgeChance ?? 0
    const dodged = chance > 0 && tile._trapDodgeRoll < chance
    if (!dodged) shouldPulse = true
  }

  if ((p.poisonStacks ?? 0) > 0 || (p.burnStacks ?? 0) > 0) shouldPulse = true
  if (_previewHarassDamageThisTurn()) shouldPulse = true

  if (shouldPulse) hapticFromUserGesture(20)
}
