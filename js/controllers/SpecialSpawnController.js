import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { ITEMS } from '../data/items.js'
import { RARE_TRINKET_IDS } from '../systems/LootTables.js'
import { session } from '../core/RunContext.js'

function pickSpecialSpawnEnemyTile(usedCoords) {
  const grid = TileEngine.getGrid()
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast') && t.enemyData) {
        const k = `${t.row},${t.col}`
        if (usedCoords?.has(k)) continue
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/** BFS shortest-path length (orthogonal steps) between two passable cells; null if unreachable. */
function shortestPathStepsMainGrid(sr, sc, tr, tc) {
  const grid = TileEngine.getGrid()
  if (!grid?.length) return null
  const passable = t => t && t.type !== 'hole' && t.type !== 'blockage'
  const rows = grid.length
  const cols = grid[0].length
  const q = [[sr, sc, 0]]
  const seen = new Set([`${sr},${sc}`])
  while (q.length) {
    const [r, c, d] = q.shift()
    if (r === tr && c === tc) return d
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const k = `${nr},${nc}`
      if (seen.has(k)) continue
      const t = grid[nr][nc]
      if (!passable(t)) continue
      seen.add(k)
      q.push([nr, nc, d + 1])
    }
  }
  return null
}

function attachTreasureGoblinTimerUi(tile) {
  if (!tile?.element || !session.run?.treasureGoblin) return
  tile.element.querySelector('.treasure-goblin-timer')?.remove()
  const badge = document.createElement('div')
  badge.className = 'treasure-goblin-timer'
  badge.textContent = String(session.run.treasureGoblin.turnsLeft)
  tile.element.appendChild(badge)
}

function syncTreasureGoblinTimerBadge() {
  if (!session.run?.treasureGoblin) return
  const t = TileEngine.getTile(session.run.treasureGoblin.row, session.run.treasureGoblin.col)
  const badge = t?.element?.querySelector('.treasure-goblin-timer')
  if (badge) badge.textContent = String(session.run.treasureGoblin.turnsLeft)
}

export function restoreTreasureGoblinAfterResume() {
  if (!session.run?.treasureGoblin) return
  const t = TileEngine.getTile(session.run.treasureGoblin.row, session.run.treasureGoblin.col)
  if (t?.enemyData?.enemyId === 'treasure_goblin' && !t.enemyData._slain) {
    attachTreasureGoblinTimerUi(t)
  } else {
    session.run.treasureGoblin = null
  }
}

function treasureGoblinEscape(ctx) {
  const g = session.run?.treasureGoblin
  if (!g) return
  const tr = g.row
  const tc = g.col
  const tile = TileEngine.getTile(tr, tc)
  if (!tile?.enemyData || tile.enemyData.enemyId !== 'treasure_goblin' || tile.enemyData._slain) {
    session.run.treasureGoblin = null
    return
  }
  tile.element?.querySelector('.treasure-goblin-timer')?.remove()
  session.run.treasureGoblin = null
  TileEngine.replaceTileWithEmptyPreserveState(tr, tc)
  const fresh = TileEngine.getTile(tr, tc)
  fresh.revealed = true
  const patched = TileEngine.patchMainGridTileAt(tr, tc, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
  const floatEl = TileEngine.getTile(tr, tc)?.element
  if (floatEl) {
    floatEl.classList.add('treasure-goblin-escaped')
    UI.spawnFloat(floatEl, '💨 Escaped!', 'damage')
    setTimeout(() => floatEl.classList.remove('treasure-goblin-escaped'), 800)
  }
  UI.setMessage('💨 The Treasure Goblin escapes with his sack!')
  ctx.saveActiveRun()
}

export function tickTreasureGoblinCountdown(ctx) {
  if (session.run?._resumeTreasureGoblinTickSkip) {
    session.run._resumeTreasureGoblinTickSkip = false
    return
  }
  if (!session.run?.treasureGoblin) return
  const g = session.run.treasureGoblin
  const tile = TileEngine.getTile(g.row, g.col)
  if (!tile?.enemyData || tile.enemyData.enemyId !== 'treasure_goblin' || tile.enemyData._slain) {
    session.run.treasureGoblin = null
    return
  }
  g.turnsLeft--
  syncTreasureGoblinTimerBadge()
  if (g.turnsLeft <= 0) treasureGoblinEscape(ctx)
}

export async function finishTreasureGoblinReward(ctx, tile) {
  if (tile.enemyData?.enemyId !== 'treasure_goblin' || tile._treasureRewardGranted) return
  tile._treasureRewardGranted = true
  session.run.treasureGoblin = null
  tile.element?.querySelector('.treasure-goblin-timer')?.remove()
  const owned = new Set(session.run.player.inventory.flatMap(e => (e?.id ? [e.id] : [])))
  let pool = RARE_TRINKET_IDS.filter(id => !owned.has(id))
  if (pool.length === 0) pool = [...RARE_TRINKET_IDS]
  const id = ctx.pickRandom(pool)
  await ctx.addToBackpack(id)
  const def = ITEMS[id]
  if (def && tile.element) UI.spawnFloat(tile.element, `${def.icon ?? '✨'} ${def.name}`, 'xp')
  UI.setMessage(`You bag the Treasure Goblin — ${def?.name ?? 'a rare trinket'}!`)
  ctx.saveActiveRun()
}

export function spawnTreasureGoblin(ctx, usedCoords) {
  const sr = session.run.floorStartRow
  const sc = session.run.floorStartCol
  if (typeof sr !== 'number' || typeof sc !== 'number') return
  const target = pickSpecialSpawnEnemyTile(usedCoords)
  if (!target) return
  const steps = shortestPathStepsMainGrid(sr, sc, target.row, target.col)
  if (steps === null) return
  const turnsLeft = steps + 2
  const ed = TileEngine.createEnemy('treasure_goblin', session.run.floor)
  ed.hp = 1
  ed.currentHP = 1
  ed.dmg = [0, 0]
  ed.hitDamage = 0
  target.enemyData = ed
  target.type = 'enemy'
  target.revealed = true
  session.run.tilesRevealed++
  usedCoords.add(`${target.row},${target.col}`)
  session.run.treasureGoblin = { row: target.row, col: target.col, turnsLeft }
  const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
  attachTreasureGoblinTimerUi(target)
  UI.setMessage('💰 A Treasure Goblin appears! Reach him before the timer hits zero.')
}

export function spawnArcherGoblin(ctx, usedCoords) {
  const target = pickSpecialSpawnEnemyTile(usedCoords)
  if (!target) return
  target.enemyData = TileEngine.createEnemy('archer_goblin', session.run.floor)
  TileEngine.rollEnemyHitDamage(target.enemyData)
  target.type = 'enemy'
  target.revealed = true
  session.run.tilesRevealed++
  usedCoords?.add(`${target.row},${target.col}`)
  const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
}

export function spawnMouse(ctx, usedCoords) {
  const target = pickSpecialSpawnEnemyTile(usedCoords)
  if (!target) return
  target.enemyData = TileEngine.createEnemy('mouse', session.run.floor)
  TileEngine.rollEnemyHitDamage(target.enemyData)
  target.type = 'enemy'
  target.revealed = true
  session.run.tilesRevealed++
  usedCoords?.add(`${target.row},${target.col}`)
  const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
}
