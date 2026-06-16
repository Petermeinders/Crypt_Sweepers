import { CONFIG } from '../config.js'
import CombatResolver from '../systems/CombatResolver.js'
import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { session, charKey } from '../core/RunContext.js'

function apBreakdown(baseBeforeAp, finalAfterAp) {
  const ap = session.run?.player?.abilityPower ?? 0
  if (!ap) return ''
  const bonus = finalAfterAp - baseBeforeAp
  if (bonus <= 0) return ''
  return ` (${baseBeforeAp} base, +${bonus} from ${ap}% Power Bonus)`
}

export function ricochetAction(ctx) {
  if (ctx.isSilenced()) return
  if (!isRangerActiveUnlocked(ctx, 'ricochet')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES.ricochet.manaCost, 'ricochet') + ctx.tearyExtraCost())

  if (!session.tap.ricochetSelecting) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Ricochet!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelArrowBarrageMode()
    ctx.cancelPoisonArrowShotMode()
    session.tap.ricochetSelecting = true
    session.tap.ricochetTiles     = []
    UI.setRicochetActive(true)
    UI.setGridRicochetMode(true)
    UI.clearRicochetMarks()
    UI.setMessage('🏹 Ricochet — tap up to 3 enemies (order matters). The 3rd pick fires; with 1–2 picks, tap Ricochet again.')
    return
  }

  if (session.tap.ricochetTiles.length === 0) {
    ctx.cancelRicochetMode()
    UI.setMessage('Ricochet cancelled.')
    return
  }

  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Ricochet!', true)
    return
  }

  executeRicochet(ctx)
}

export function executeRicochet(ctx) {
  const cost    = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES.ricochet.manaCost, 'ricochet') + ctx.tearyExtraCost())
  const ordered = session.tap.ricochetTiles.slice()

  const targets = ordered.filter(t => t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune)
  const immuneCount = ordered.filter(t => t.enemyData && !t.enemyData._slain && t.enemyData.spellImmune).length
  if (targets.length === 0) {
    ctx.cancelRicochetMode()
    UI.setMessage(immuneCount > 0 ? '🛡️ All selected enemies are immune to Ricochet!' : 'Ricochet — no valid targets left.', true)
    return
  }

  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  const savedEngagement = ctx.suspendCombatEngagementForMultiTargetAbility()
  ctx.cancelRicochetMode()

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  const dmgSeq = ricochetDamageSequence(ctx, targets.length, 'ricochet')
  const _ricBase = (() => {
    const avg = ctx.avgMeleeDamage()
    const m   = CONFIG.ability.ricochetUnitMult
    const mult = rangerActiveDamageMult('ricochet')
    return Math.max(1, Math.round(avg * m * mult))
  })()
  const _ricBreakdown = apBreakdown(_ricBase, dmgSeq[0] ?? dmgSeq[dmgSeq.length - 1])
  UI.setMessage(`🏹 Ricochet — ${targets.length} shot${targets.length > 1 ? 's' : ''}! (${dmgSeq.join(' → ')})${_ricBreakdown}`)

  targets.forEach((target, i) => {
    const dmg = ctx.scaleOutgoingDamageToEnemy(dmgSeq[i])
    setTimeout(() => {
      if (!target.enemyData || target.enemyData._slain) return
      UI.spawnArrow(target.element)
      EventBus.emit('audio:play', { sfx: 'arrowShot' })
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - dmg)
      ctx.checkOnionLayer(target)
      UI.spawnFloat(target.element, `🏹 ${dmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        ctx.gainGold(target.enemyData.goldDrop ? ctx.rand(...target.enemyData.goldDrop) : 1, target.element, true)
        ctx.gainXP(target.enemyData.xpDrop ?? 0, target.element)
        ctx.endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 120)
  })

  // Unlike Ranger melee, Ricochet is a short volley — do not hold session.tap.combatBusy for
  // RANGER_FIGHT_ATTACK_PORTRAIT_MS (4s) or the next enemy tap is silently ignored.
  const doneMs = targets.length * 120 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
    ctx.restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, doneMs)
}

export function arrowBarrageAction(ctx) {
  if (!isRangerActiveUnlocked(ctx, 'arrow-barrage')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost, 'arrow-barrage') + ctx.tearyExtraCost())

  if (!session.tap.arrowBarrageSelecting) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelRicochetMode()
    ctx.cancelPoisonArrowShotMode()
    session.tap.arrowBarrageSelecting = true
    UI.setArrowBarrageActive(true)
    UI.setGridArrowBarrageMode(true)
    UI.setMessage(
      '🏹 Triple Volley — tap a revealed tile to place a 3×3 blast (50% attack each enemy, min 1). Tap the same tile again to fire; tap the ability to cancel.',
    )
    return
  }

  ctx.cancelArrowBarrageMode()
  UI.setMessage('Triple Volley cancelled.')
}

export function tripleVolleyDamagePerEnemy(ctx) {
  const avg = ctx.avgMeleeDamage()
  const pct = CONFIG.ability.tripleVolleyHeroDamagePct
  const mult = rangerActiveDamageMult('arrow-barrage')
  const ap   = CombatResolver.abilityPowerMult(session.run.player)
  return Math.max(1, Math.round(avg * pct * mult * ap))
}

export function tilesIn3x3(ctx, centerRow, centerCol) {
  const grid = ctx.getActiveTileRows()
  if (!grid?.length) return []
  const rows = grid.length
  const cols = grid[0].length
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerRow + dr
      const c = centerCol + dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      const t = grid[r]?.[c]
      if (t) out.push(t)
    }
  }
  return out
}

export function executeTripleVolley(ctx, center) {
  const cost = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost, 'arrow-barrage') + ctx.tearyExtraCost())
  const tiles = tilesIn3x3(ctx, center.row, center.col)
  const targets = tiles.filter(t => t.revealed && t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune)

  if (targets.length === 0) {
    UI.setMessage('Triple Volley — no enemies in that 3×3 area. Pick another center.', true)
    session.tap.tripleVolleyCenter = null
    UI.clearTripleVolleyAoePreview()
    return
  }

  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  const savedEngagement = ctx.suspendCombatEngagementForMultiTargetAbility()

  ctx.cancelArrowBarrageMode()

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  const dmg = ctx.scaleOutgoingDamageToEnemy(tripleVolleyDamagePerEnemy(ctx))
  const _tvBase = ctx.scaleOutgoingDamageToEnemy((() => {
    const avg = ctx.avgMeleeDamage()
    const pct = CONFIG.ability.tripleVolleyHeroDamagePct
    const mult = rangerActiveDamageMult('arrow-barrage')
    return Math.max(1, Math.round(avg * pct * mult))
  })())
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  UI.setMessage(`🏹 Triple Volley! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} for ${dmg} each${apBreakdown(_tvBase, dmg)}.`)

  EventBus.emit('audio:play', {
    sfx: 'arrowShot',
    layered: {
      count: Math.min(14, 6 + targets.length * 2),
      spreadMs: 120,
      jitterMs: 35,
    },
  })

  // Rain of arrows overlay across all 9 tiles
  UI.spawnArrowRain(tiles.map(t => t.element), targets.length * 120 + 600)

  targets.forEach((target, i) => {
    setTimeout(() => {
      const t = target
      if (!t?.enemyData || t.enemyData._slain) return
      UI.spawnArrow(t.element)
      UI.shakeTile(t.element)
      t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - dmg)
      ctx.checkOnionLayer(t)
      UI.spawnFloat(t.element, `🏹 ${dmg}`, 'xp')
      if (t.enemyData.currentHP <= 0) {
        ctx.gainGold(t.enemyData.goldDrop ? ctx.rand(...t.enemyData.goldDrop) : 1, t.element, true)
        ctx.gainXP(t.enemyData.xpDrop ?? 0, t.element)
        ctx.endCombatVictory(t)
      } else {
        UI.updateEnemyHP(t.element, t.enemyData.currentHP)
      }
    }, i * 120)
  })

  const doneMs = targets.length * 120 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
    ctx.restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, doneMs)
}

export function poisonArrowShotAction(ctx) {
  if (!isRangerActiveUnlocked(ctx, 'poison-arrow-shot')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost, 'poison-arrow-shot') + ctx.tearyExtraCost())

  if (!session.tap.poisonArrowShotSelecting) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Poison Arrow!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelRicochetMode()
    ctx.cancelArrowBarrageMode()
    session.tap.poisonArrowShotSelecting = true
    UI.setPoisonArrowShotActive(true)
    UI.setGridPoisonArrowShotMode(true)
    UI.setMessage('☠️ Poison Arrow — tap one enemy. Tap again to cancel.')
    return
  }

  ctx.cancelPoisonArrowShotMode()
  UI.setMessage('Poison Arrow cancelled.')
}

export function executePoisonArrowShot(ctx, tile) {
  const cost = ctx.stillWaterManaCost(ctx.scaledManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost, 'poison-arrow-shot') + ctx.tearyExtraCost())
  if (!tile?.enemyData || tile.enemyData._slain) {
    ctx.cancelPoisonArrowShotMode()
    return
  }

  if (tile.enemyData?.spellImmune) {
    ctx.cancelPoisonArrowShotMode()
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to Poison Arrow!`, true)
    return
  }

  if (!ctx.canAttackEnemy(tile)) {
    ctx.cancelPoisonArrowShotMode()
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  const row = tile.row
  const col = tile.col
  ctx.cancelPoisonArrowShotMode()

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  const initial = ctx.scaleOutgoingDamageToEnemy(poisonArrowUnitDamage(ctx))
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')

  const t0 = ctx.getActiveTileAt(row, col)
  if (!t0?.enemyData || t0.enemyData._slain) {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
    return
  }

  UI.spawnArrow(t0.element)
  EventBus.emit('audio:play', { sfx: 'arrowShot' })
  UI.shakeTile(t0.element)
  t0.enemyData.currentHP = Math.max(0, t0.enemyData.currentHP - initial)
  UI.spawnFloat(t0.element, `☠️ ${initial}`, 'xp')

  if (t0.enemyData.currentHP <= 0) {
    ctx.gainGold(t0.enemyData.goldDrop ? ctx.rand(...t0.enemyData.goldDrop) : 1, t0.element, true)
    ctx.gainXP(t0.enemyData.xpDrop ?? 0, t0.element)
    ctx.endCombatVictory(t0)
    setTimeout(() => {
      UI.setPortraitAnim('idle')
      session.tap.combatBusy = false
    }, 400)
    return
  }

  t0.enemyData.poisonTurns = 3
  UI.updateEnemyHP(t0.element, t0.enemyData.currentHP)
  UI.updateEnemyStatus(t0.element, t0.enemyData)
  const _paBase = (() => {
    const avg = ctx.avgMeleeDamage()
    const m   = CONFIG.ability.ricochetUnitMult
    const mult = rangerActiveDamageMult('poison-arrow-shot')
    return Math.max(1, Math.round(avg * m * mult))
  })()
  UI.setMessage(`☠️ Poison Arrow! The foe is poisoned (${initial}${apBreakdown(_paBase, initial)} + ${3} ticks on turns — flips or melee).`)

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
  }, 400)
}

export function poisonArrowUnitDamage(ctx) {
  const avg = ctx.avgMeleeDamage()
  const m   = CONFIG.ability.ricochetUnitMult
  const mult = rangerActiveDamageMult('poison-arrow-shot')
  const ap   = CombatResolver.abilityPowerMult(session.run.player)
  return Math.max(1, Math.round(avg * m * mult * ap))
}

export function refreshRangerActiveHud(ctx) {
  if (charKey() !== 'ranger') return
  // Clear warrior/engineer/mage slot bindings — otherwise Blinding Light (slot B) survives from a prior Warrior session.run.
  UI.setSlamBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setLifeTapBtn(false)
  UI.setRicochetBtn(isRangerActiveUnlocked(ctx, 'ricochet'), ctx.scaledManaCost(RANGER_UPGRADES.ricochet.manaCost, 'ricochet'))
  UI.setArrowBarrageBtn(
    isRangerActiveUnlocked(ctx, 'arrow-barrage'),
    ctx.scaledManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost, 'arrow-barrage'),
  )
  UI.setPoisonArrowShotBtn(
    isRangerActiveUnlocked(ctx, 'poison-arrow-shot'),
    ctx.scaledManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost, 'poison-arrow-shot'),
  )
}

export function isRangerActiveUnlocked(ctx, abilityKey) {
  if (ctx.isActiveUnlocked(abilityKey, 'ranger')) return true
  // Mastery stacks granted before the active was officially unlocked still imply access (defensive — shouldn't happen with the new pool).
  const stacks = session.run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return stacks > 0 && (session.save.ranger?.upgrades ?? []).includes(abilityKey)
}

export function rangerActiveDamageMult(abilityKey) {
  const stacks = session.run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return 1 + 0.1 * stacks
}

export function getRicochetBreakdown(ctx) {
  if (!session.run || !session.run.player?.isRanger) return null
  const arc = hasRicochetArcMasteryMeta()
  const seq = ricochetDamageSequence(ctx, 3, 'ricochet')
  const weights = arc ? [4, 3, 2] : [3, 2, 1]
  const unit = seq[0] / weights[0]
  return { shots: seq, unit, patternLabel: arc ? '4 : 3 : 2' : '3 : 2 : 1' }
}

export function getArrowBarrageBreakdown(ctx) {
  if (!session.run || !session.run.player?.isRanger) return null
  const avg = ctx.avgMeleeDamage()
  const pct = CONFIG.ability.tripleVolleyHeroDamagePct
  const mult = rangerActiveDamageMult('arrow-barrage')
  const ap = CombatResolver.abilityPowerMult(session.run.player)
  const perEnemy = Math.max(1, Math.round(avg * pct * mult * ap))
  return { perEnemy, avgMelee: avg, heroDamagePct: pct, mult, area: '3×3' }
}

export function getPoisonArrowShotBreakdown(ctx) {
  if (!session.run || !session.run.player?.isRanger) return null
  const per = poisonArrowUnitDamage(ctx)
  return { perHit: per, initial: per, flipTicks: 3, dotTotal: per * 3 }
}

export function hasRicochetArcMasteryMeta() {
  return (session.save.ranger?.upgrades ?? []).includes('ricochet-arc-mastery')
}

export function ricochetDamageSequence(ctx, targetCount, abilityKey = 'ricochet') {
  const avg = ctx.avgMeleeDamage()
  const m   = CONFIG.ability.ricochetUnitMult
  const mult = rangerActiveDamageMult(abilityKey)
  const ap   = CombatResolver.abilityPowerMult(session.run.player)
  const unit = Math.max(1, Math.round(avg * m * mult * ap))
  const weights =
    abilityKey === 'ricochet' && hasRicochetArcMasteryMeta() ? [4, 3, 2] : [3, 2, 1]
  const seq = weights.map(w => w * unit)
  return seq.slice(0, targetCount)
}
