import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'

const SHOCK_BONUS = 2
const ARC_RAW_DMG = 2

/** @returns {number} */
export function shockedDurationForTier(tier) {
  if (!tier) return 0
  return tier >= 2 ? 5 : 3
}

/** Apply or refresh Shocked on an enemy (Chain Lightning hits). */
export function applyShocked(enemyData, tier) {
  const dur = shockedDurationForTier(tier)
  if (dur <= 0 || !enemyData) return
  enemyData.shockedTurns = Math.max(enemyData.shockedTurns ?? 0, dur)
}

/**
 * On damage to a Shocked enemy: +2 lightning, consume Shocked; tier II+ arcs; tier III melee restores mana.
 * @param {object} ctx — GameController context (scaleOutgoingDamageToEnemy, getActiveTiles, …)
 * @param {object} tile
 * @param {{ source: 'melee' | 'ability' }} opts
 * @returns {{ bonus: number, consumed: boolean }}
 */
export function tryConsumeShocked(ctx, tile, { source }) {
  const tier = session.run?.player?.chainLightningShockedTier ?? 0
  if (!tier || !tile?.enemyData || (tile.enemyData.shockedTurns ?? 0) <= 0) {
    return { bonus: 0, consumed: false }
  }

  tile.enemyData.shockedTurns = 0
  if (tile.element) UI.updateEnemyStatus(tile.element, tile.enemyData)

  if (tier >= 2) {
    _arcFromShockedConsume(ctx, tile, tier)
  }

  if (tier >= 3 && source === 'melee' && session.run?.player) {
    const p = session.run.player
    const before = p.mana
    p.mana = Math.min(p.maxMana, p.mana + 3)
    if (p.mana > before) {
      UI.updateMana(p.mana, p.maxMana)
      const portrait = document.getElementById('hud-portrait')
      if (portrait) UI.spawnFloat(portrait, '+3 MP', 'mana')
    }
  }

  return { bonus: SHOCK_BONUS, consumed: true }
}

function _orthAdjacentTiles(fromTile, tiles) {
  const out = []
  for (const t of tiles) {
    if (Math.abs(t.row - fromTile.row) + Math.abs(t.col - fromTile.col) !== 1) continue
    out.push(t)
  }
  return out
}

function _arcFromShockedConsume(ctx, fromTile, tier) {
  const candidates = _orthAdjacentTiles(fromTile, ctx.getActiveTiles()).filter(t =>
    t.revealed &&
    t.enemyData &&
    !t.enemyData._slain &&
    !t.enemyData.spellImmune &&
    !(t.row === fromTile.row && t.col === fromTile.col),
  )
  if (!candidates.length) return

  const target = candidates[Math.floor(Math.random() * candidates.length)]
  const arcDmg = ctx.scaleOutgoingDamageToEnemy(ARC_RAW_DMG)
  target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - arcDmg)
  EventBus.emit('audio:play', { sfx: 'zap' })
  if (target.element) {
    UI.spawnFloat(target.element, `⚡ ${arcDmg}`, 'xp')
    UI.shakeTile(target.element)
  }
  if (tier >= 3) applyShocked(target.enemyData, tier)

  if (target.enemyData.currentHP <= 0) {
    ctx.gainGold(target.enemyData.goldDrop ? ctx.rand(...target.enemyData.goldDrop) : 1, target.element, true)
    ctx.gainXP(target.enemyData.xpDrop ?? 0, target.element)
    ctx.endCombatVictory(target)
  } else if (target.element) {
    UI.updateEnemyHP(target.element, target.enemyData.currentHP)
    UI.updateEnemyStatus(target.element, target.enemyData)
  }
}

/** Decrement Shocked duration on all living enemies (global turn). */
export function tickShockedDurations(tiles) {
  for (const tile of tiles) {
    if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
    if ((tile.enemyData.shockedTurns ?? 0) <= 0) continue
    tile.enemyData.shockedTurns--
    if (tile.element) UI.updateEnemyStatus(tile.element, tile.enemyData)
  }
}
