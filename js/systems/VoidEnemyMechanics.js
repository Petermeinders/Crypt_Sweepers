/**
 * Void-trial enemy mechanics — Death Split, Gaze, Rend, Shatter Shell, Obsidian Plate, Rift Maw.
 */
import { ENEMY_DEFS } from '../data/enemies.js'
import GameState, { States } from '../core/GameState.js'
import UI from '../ui/UI.js'
import TileEngine from './TileEngine.js'
import { isVoidTrialRun } from './VoidTrial.js'

/** @param {object} def — ENEMY_DEFS entry */
export function isVoidTrialEnemyDef(def) {
  return !!def?.spawn?.voidTrial
}

/** Apply runtime fields after createEnemy scaling. */
export function initVoidEnemyRuntime(enemyData, def) {
  if (!enemyData || !def) return
  enemyData.maxHpAtSpawn = enemyData.hp
  if (def.obsidianCharges != null) {
    enemyData.obsidianCharges = def.obsidianCharges
  }
  if (def.shatterShell) {
    enemyData.shellIntact = true
    enemyData.shatterPct = def.shatterPct ?? 0.25
  }
}

/**
 * Mitigate incoming player damage (obsidian plate / shatter shell).
 * @returns {{ hpDamage: number, playerPulse: number, floatText: string|null, floatKind: string }}
 */
export function resolveVoidEnemyIncomingDamage(enemyData, rawDmg) {
  const dmg = Math.max(0, Math.floor(Number(rawDmg) || 0))
  if (dmg <= 0 || !enemyData) {
    return { hpDamage: 0, playerPulse: 0, floatText: null, floatKind: 'armor' }
  }

  if ((enemyData.obsidianCharges ?? 0) > 0) {
    enemyData.obsidianCharges--
    return { hpDamage: 0, playerPulse: 0, floatText: '🛡️ Plate holds.', floatKind: 'armor' }
  }

  if (enemyData.shellIntact) {
    enemyData.shellIntact = false
    const base = enemyData.maxHpAtSpawn ?? enemyData.hp ?? 1
    const pct = enemyData.shatterPct ?? 0.25
    const pulse = Math.max(1, Math.ceil(base * pct))
    return { hpDamage: 0, playerPulse: pulse, floatText: '💠 Shatter!', floatKind: 'damage' }
  }

  return { hpDamage: dmg, playerPulse: 0, floatText: null, floatKind: 'armor' }
}

/** @param {object} player */
export function applyArmorRend(player, amount = 1) {
  const rend = Math.max(0, Math.floor(amount))
  if (rend <= 0 || !player) return 0
  const before = player.armor ?? 0
  player.armor = Math.max(0, before - rend)
  return before - player.armor
}

/** Shave tile-armor on enemy reveal (Hook Crawler and future armor-rend foes). */
export function applyRevealArmorRend(player, tile) {
  const amount = tile?.enemyData?.armorRend
  if (!amount || !player) return 0
  const shaved = applyArmorRend(player, amount)
  if (shaved > 0) {
    UI.updateArmor(player.armor)
    if (tile.element) UI.spawnFloat(tile.element, `🪝 −${shaved} armor`, 'damage')
  }
  return shaved
}

/**
 * Seed Death Split on an adjacent unrevealed tile (always when possible).
 * @returns {boolean}
 */
export function tryDeathSplit(grid, row, col, burstDmg = 1) {
  if (!grid) return false
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  const candidates = []
  for (const [dr, dc] of dirs) {
    const r = row + dr
    const c = col + dc
    const t = grid[r]?.[c]
    if (t && !t.revealed && t.type !== 'hole' && t.type !== 'blockage') {
      candidates.push(t)
    }
  }
  if (!candidates.length) return false
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  target.deathSplitBurst = Math.max(1, Math.floor(burstDmg))
  target.deathSplitTurns = 1
  return true
}

/** Tick pending death-split bursts and rift maw / void gaze (called each global turn). */
export function tickVoidEnemyGlobalTurn(ctx, grid) {
  if (!grid || !ctx?.session?.run) return
  const run = ctx.session.run
  if (!isVoidTrialRun(run)) return
  const p = run.player
  if (!p || GameState.is(States.DEATH)) return

  // Death Split remnants
  for (const row of grid) {
    for (const tile of row) {
      if ((tile.deathSplitTurns ?? 0) <= 0) continue
      tile.deathSplitTurns--
      if (tile.deathSplitTurns > 0) continue
      const burst = tile.deathSplitBurst ?? 1
      delete tile.deathSplitBurst
      delete tile.deathSplitTurns
      if (tile.revealed) continue
      tile.revealed = true
      if (tile.element) {
        tile.element.classList.add('revealed')
        UI.shakeTile(tile.element)
        UI.spawnFloat(tile.element, '💚 Split burst!', 'damage')
      }
      ctx.takeDamage?.(burst, tile.element, false, null, {
        enemyAttack: true,
        deathCause: 'fast_enemy',
      })
      if (!GameState.is(States.DEATH)) {
        tile.type = 'empty'
        tile.enemyData = null
        if (tile.element) {
          TileEngine.patchMainGridTileAt(
            tile.row, tile.col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold,
          )
        }
      }
    }
  }

  // Void Gaze + Rift Maw
  let anyGhast = false
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
      const id = tile.enemyData.enemyId
      const def = ENEMY_DEFS[id]

      if (def?.voidGaze) anyGhast = true

      if (def?.voidGaze && Math.random() < (def.voidGazeProcChance ?? 0.5)) {
        const max = def.voidGazeMaxStacks ?? 3
        const per = def.voidGazeFizzlePerStack ?? 0.05
        p.voidGazeStacks = Math.min(max, (p.voidGazeStacks ?? 0) + 1)
        p.voidGazeFizzlePerStack = per
        if (tile.element) UI.spawnFloat(tile.element, '👁️ Gaze', 'damage')
      }

      if (def?.riftMaw) {
        if ((p.mana ?? 0) > 0) {
          const drain = Math.max(1, Math.ceil((p.maxMana ?? 1) * (def.riftMawManaPct ?? 0.1)))
          p.mana = Math.max(0, p.mana - drain)
          UI.updateMana(p.mana, p.maxMana)
          if (tile.element) UI.spawnFloat(tile.element, `🌀 −${drain} mana`, 'damage')
        } else {
          const drain = Math.max(1, Math.ceil((p.maxHp ?? 1) * (def.riftMawHpPct ?? 0.05)))
          ctx.takeDamage?.(drain, tile.element, false, tile.enemyData, {
            enemyAttack: true,
            deathCause: 'combat',
          })
          if (tile.element) UI.spawnFloat(tile.element, '🌀 Maw feeds!', 'damage')
        }
      }
    }
  }

  if (!anyGhast && (p.voidGazeStacks ?? 0) > 0) {
    p.voidGazeStacks = 0
  }
}

/** Extra ability fizzle rate from Void Gaze stacks. */
export function voidGazeFizzleBonus(run) {
  if (!isVoidTrialRun(run)) return 0
  const stacks = run.player?.voidGazeStacks ?? 0
  const per = run.player?.voidGazeFizzlePerStack ?? 0.05
  return stacks * per
}

/** Weighted void enemy id for tile placement. */
export function pickVoidEnemyId(floor, opts = {}) {
  const run = opts.run
  if (!run) return 'void_maw'
  const tier = run.voidTier ?? 1
  const ids = Object.keys(ENEMY_DEFS).filter(id => {
    const def = ENEMY_DEFS[id]
    if (!def?.spawn?.voidTrial || def.behaviour === 'boss') return false
    if (def.spawn.voidMinTier != null && tier < def.spawn.voidMinTier) return false
    if (def.spawn.voidMinFloor != null && floor < def.spawn.voidMinFloor) return false
    if (opts.forceFast && !def.attributes?.includes('fast')) return false
    if (!opts.forceFast && def.attributes?.includes('fast')) return false
    return true
  })
  if (!ids.length) return opts.forceFast ? 'void_maw' : 'hook_crawler'
  const weights = ids.map(id => ENEMY_DEFS[id].voidSpawnWeight ?? 5)
  const total = weights.reduce((s, w) => s + w, 0)
  let r = Math.random() * total
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i]
    if (r <= 0) return ids[i]
  }
  return ids[ids.length - 1]
}

export default {
  isVoidTrialEnemyDef,
  initVoidEnemyRuntime,
  resolveVoidEnemyIncomingDamage,
  applyArmorRend,
  applyRevealArmorRend,
  tryDeathSplit,
  tickVoidEnemyGlobalTurn,
  voidGazeFizzleBonus,
  pickVoidEnemyId,
}
