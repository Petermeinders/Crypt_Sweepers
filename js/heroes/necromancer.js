import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import {
  NECROMANCER_MINION,
  RAISE_MINION_COST,
  STRENGTHEN_MINION_COST,
  STRENGTHEN_MINION_HP_GAIN,
  CORPSE_EXPLOSION_COST,
  CORPSE_EXPLOSION_DAMAGE,
  DETONATION_CHAIN_EXTRA_COST,
  NECROMANCER_UPGRADES,
} from '../data/necromancer.js'
import { session, charKey } from '../core/RunContext.js'

let _nextMinionId = 1

export function getMinionMaxHp() {
  const lvl = Math.min(3, Math.max(1, session.run?.player?.minionMasteryLevel ?? 1))
  return NECROMANCER_MINION.hpByLevel[lvl - 1]
}

export function getMinionDmg() {
  const lvl = Math.min(3, Math.max(1, session.run?.player?.minionMasteryLevel ?? 1))
  return NECROMANCER_MINION.damageByLevel[lvl - 1]
}

export function syncMinionVisual(minion) {
  const tile = TileEngine.getTile(minion.row, minion.col)
  if (!tile?.element) return
  const existing = tile.element.querySelector('.minion-overlay')
  if (existing) existing.remove()
  if (minion.hp <= 0) return
  const overlay = document.createElement('div')
  overlay.className = 'minion-overlay'
  overlay.innerHTML = `<span class="minion-icon">🧟</span>
    <div class="minion-stats">
      <span class="stat-hp">❤️ ${minion.hp}</span>
      <span class="stat-dmg">⚔️ ${minion.dmg}</span>
    </div>`
  tile.element.appendChild(overlay)
}

export function syncAllMinionVisuals() {
  if (!session.run?.minions) return
  for (const m of session.run.minions) {
    syncMinionVisual(m)
  }
}

export function clearMinionVisuals() {
  if (!session.run?.minions) return
  for (const m of session.run.minions) {
    const tile = TileEngine.getTile(m.row, m.col)
    tile?.element?.querySelector('.minion-overlay')?.remove()
  }
}

export function necroClearAshAfterMinionDeath(ctx, row, col) {
  if (!session.run || charKey() !== 'necromancer') return
  const t = TileEngine.getTile(row, col)
  if (!t?.enemyData?._slain) return
  TileEngine.replaceTileWithEmptyPreserveState(row, col)
  const fresh = TileEngine.getTile(row, col)
  fresh.revealed = true
  const patched = TileEngine.patchMainGridTileAt(row, col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
  ctx.saveActiveRun()
}

export function necroRaiseMinion(ctx, tile) {
  if (!session.run || !tile?.enemyData?._slain) return
  if (charKey() !== 'necromancer') return
  if (session.run.player.mana < RAISE_MINION_COST) {
    UI.setMessage(`Not enough mana to raise a minion! (need ${RAISE_MINION_COST})`, true)
    return
  }

  // Check if a minion already sits on this tile
  const existing = (session.run.minions ?? []).findIndex(m => m.row === tile.row && m.col === tile.col)
  if (existing >= 0) {
    UI.setMessage('A minion already guards this tile.', true)
    return
  }

  session.run.player.mana -= RAISE_MINION_COST
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  // Master's Sight: reveal category hints for all orthogonal neighbors when a minion rises
  for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
    if (!adj.revealed && adj.element && !adj.echoHintCategory) {
      const cat = ctx.echoCharmCategoryForTileType(adj.type)
      adj.echoHintCategory = cat
      adj.element.classList.add('echo-hint')
      adj.element.dataset.echoHint = cat
    }
  }

  const maxHp = getMinionMaxHp()
  const dmg   = getMinionDmg()
  const minion = {
    row:   tile.row,
    col:   tile.col,
    hp:    maxHp,
    maxHp,
    dmg,
    id:    _nextMinionId++,
  }
  if (!session.run.minions) session.run.minions = []
  session.run.minions.push(minion)
  syncMinionVisual(minion)
  // Make the tile tappable again so the minion tile is interactive (re-applies pointer events)
  tile.element.classList.add('enemy-alive')
  UI.spawnFloat(tile.element, '🧟 Risen!', 'xp')
  UI.setMessage(`You raise a minion from the ashes! (❤️ ${maxHp}, ⚔️ ${dmg}) Mana: ${session.run.player.mana}/${session.run.player.maxMana}`)
  ctx.saveActiveRun()
}

export function necroMinionTotalDmg() {
  if (!session.run?.minions?.length) return 0
  let total = 0
  for (const m of session.run.minions) total += m.dmg
  return total
}

export function necroMinionAbsorbDamage(ctx, rawAmount, floatEl, enemyTile) {
  if (!session.run?.minions?.length) return false
  let closest = null
  let closestDist = Infinity
  for (const m of session.run.minions) {
    if (m.hp <= 0) continue
    const dist = enemyTile
      ? Math.abs(m.row - enemyTile.row) + Math.abs(m.col - enemyTile.col)
      : 0
    if (dist < closestDist) { closest = m; closestDist = dist }
  }
  if (!closest) return false

  const eff = ctx.computeEffectiveDamageTaken(rawAmount)
  closest.hp -= eff
  const tile = TileEngine.getTile(closest.row, closest.col)
  const refEl = tile?.element ?? floatEl ?? document.getElementById('hud-portrait')
  UI.spawnFloat(refEl, `🧟 −${eff}`, 'damage')
  if (closest.hp <= 0) {
    closest.hp = 0
    session.run.minions = session.run.minions.filter(m => m.id !== closest.id)
    if (tile?.element) tile.element.querySelector('.minion-overlay')?.remove()
    necroClearAshAfterMinionDeath(ctx, closest.row, closest.col)
    UI.setMessage('Your minion falls protecting you! The ashes scatter — only one minion may rise from each corpse.')
  } else {
    syncMinionVisual(closest)
    UI.setMessage(`Your minion absorbs the blow! (❤️ ${closest.hp}/${closest.maxHp})`)
  }
  return true
}

export function isNecroActiveUnlocked(ctx, abilityKey) {
  return ctx.isActiveUnlocked(abilityKey, 'necromancer')
}

export function hasNecroMetaUpgrade(id) {
  return (session.save.necromancer?.upgrades ?? []).includes(id)
}

export function strengthenMinionAction(ctx) {
  if (charKey() !== 'necromancer') return
  if (!isNecroActiveUnlocked(ctx, 'strengthen-minion')) return
  if (session.tap.combatBusy) return
  if (session.tap.strengthenMinionSelecting) {
    ctx.cancelStrengthenMinionMode()
    UI.setMessage('Strengthen Minion cancelled.')
    return
  }
  const _smCost = hasNecroMetaUpgrade('strengthen-minion-mastery-3') ? 6 : STRENGTHEN_MINION_COST
  if (session.run.player.mana < _smCost) {
    UI.setMessage('Not enough mana for Strengthen Minion!', true)
    return
  }
  const aliveMinions = (session.run.minions ?? []).filter(m => m.hp > 0)
  if (!aliveMinions.length) {
    UI.setMessage('You have no minions to strengthen.', true)
    return
  }
  ctx.cancelCorpseExplosionMode()
  session.tap.strengthenMinionSelecting = true
  UI.setStrengthenMinionActive?.(true)
  UI.setMessage(`💪 Strengthen Minion — tap a minion to grant +${STRENGTHEN_MINION_HP_GAIN} max HP. (${STRENGTHEN_MINION_COST} mana)`)
}

export function corpseExplosionAction(ctx) {
  if (ctx.isSilenced()) return
  if (charKey() !== 'necromancer') return
  if (!isNecroActiveUnlocked(ctx, 'corpse-explosion')) return
  if (session.tap.combatBusy) return
  if (session.tap.corpseExplosionSelecting) {
    ctx.cancelCorpseExplosionMode()
    UI.setMessage('Corpse Explosion cancelled.')
    return
  }
  if (session.run.player.mana < CORPSE_EXPLOSION_COST) {
    UI.setMessage('Not enough mana for Corpse Explosion!', true)
    return
  }
  ctx.cancelStrengthenMinionMode()
  session.tap.corpseExplosionSelecting = true
  UI.setCorpseExplosionActive?.(true)
  UI.setGridCorpseExplosionMode?.(true)
  UI.setMessage(`💥 Corpse Explosion — tap a corpse or minion to detonate. (${CORPSE_EXPLOSION_COST} mana)`)
}

export function corpseExplosionOuterRingTiles(row, col) {
  const grid = TileEngine.getGrid()
  if (!grid) return []
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const out = []
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== 2) continue
      const r = row + dr
      const c = col + dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      out.push(grid[r][c])
    }
  }
  return out
}

export function damageEnemyFromCorpseExplosion(ctx, targetTile, dmg) {
  if (!targetTile?.enemyData || targetTile.enemyData._slain) return
  if (!targetTile.revealed) return
  const ed = targetTile.enemyData
  ed.currentHP = Math.max(0, (ed.currentHP ?? ed.hp ?? 0) - dmg)
  if (targetTile.element) UI.spawnFloat(targetTile.element, `💥 ${dmg}`, 'damage')
  if (ed.currentHP <= 0) {
    ctx.gainGold(ed.goldDrop ? ctx.rand(...ed.goldDrop) : 1, targetTile.element, true)
    ctx.gainXP(ed.xpDrop ?? 0, targetTile.element)
    ctx.endCombatVictory(targetTile)
  } else if (targetTile.element) {
    UI.updateEnemyHP(targetTile.element, ed.currentHP)
  }
}

export function executeCorpseExplosion(ctx, rootTile) {
  const hasChain    = hasNecroMetaUpgrade('detonation-chain')
  const hasAbyssal  = hasNecroMetaUpgrade('abyssal-reach')
  const abyssalProc = hasAbyssal && Math.random() < 0.5

  let cost = CORPSE_EXPLOSION_COST
  if (hasChain)    cost += DETONATION_CHAIN_EXTRA_COST
  if (abyssalProc) cost *= 2

  if (session.run.player.mana < cost) {
    UI.setMessage(`Not enough mana for this Corpse Explosion! (needs ${cost})`, true)
    ctx.cancelCorpseExplosionMode()
    return
  }

  session.run.player.mana -= cost
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  EventBus.emit('audio:play', { sfx: 'hit' })

  // BFS: each queued center explodes; chained corpses enqueue if Detonation Chain owned.
  const visited = new Set()
  const queue = [rootTile]
  const keyOf = (t) => `${t.row},${t.col}`
  visited.add(keyOf(rootTile))

  while (queue.length) {
    const center = queue.shift()
    // Visual flash on the detonating tile
    if (center.element) UI.spawnFloat(center.element, '💥 BOOM', 'damage')

    const innerRing = TileEngine.getAdjacentTiles(center.row, center.col)
    const ring = abyssalProc
      ? innerRing.concat(corpseExplosionOuterRingTiles(center.row, center.col))
      : innerRing

    for (const t of ring) {
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        const ceDmg = CORPSE_EXPLOSION_DAMAGE + (hasNecroMetaUpgrade('corpse-explosion-mastery-1') ? 1 : 0)
        damageEnemyFromCorpseExplosion(ctx, t, ceDmg)
      }
      if (hasChain && t.revealed && t.enemyData?._slain && !t.corpseExploded) {
        const k = keyOf(t)
        if (!visited.has(k)) {
          visited.add(k)
          queue.push(t)
        }
      }
    }

    // Consume the center
    consumeCorpseExplosionSource(ctx, center)
  }

  ctx.cancelCorpseExplosionMode()

  const msg = abyssalProc
    ? `💥 Corpse Explosion — Abyssal Reach!${hasChain ? ' Chain reaction!' : ''} (${cost} mana)`
    : hasChain
      ? `💥 Corpse Explosion — chain reaction! (${cost} mana)`
      : `💥 Corpse Explosion! (${cost} mana)`
  UI.setMessage(msg)

  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  ctx.saveActiveRun()
}

export function consumeCorpseExplosionSource(ctx, tile) {
  tile.corpseExploded = true
  // If a minion sat on this tile, destroy it.
  const minionIdx = (session.run.minions ?? []).findIndex(m => m.row === tile.row && m.col === tile.col)
  if (minionIdx >= 0) {
    const minion = session.run.minions[minionIdx]
    session.run.minions.splice(minionIdx, 1)
    if (tile.element) tile.element.querySelector('.minion-overlay')?.remove()
    if (minion) necroClearAshAfterMinionDeath(ctx, minion.row, minion.col)
  } else {
    necroClearAshAfterMinionDeath(ctx, tile.row, tile.col)
  }
}

export function refreshNecroActiveHud(ctx) {
  if (charKey() !== 'necromancer') return
  // Clear other-hero slot bindings so they don't leak from a prior session.run
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setDivineLightBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setRicochetBtn(false, 0)
  UI.setSlamBtn(false)
  UI.setChainLightningBtn?.(false)
  UI.setLifeTapBtn(false)
  UI.setStrengthenMinionBtn(
    isNecroActiveUnlocked(ctx, 'strengthen-minion'),
    hasNecroMetaUpgrade('strengthen-minion-mastery-3') ? 6 : STRENGTHEN_MINION_COST,
  )
  UI.setCorpseExplosionBtn(
    isNecroActiveUnlocked(ctx, 'corpse-explosion'),
    NECROMANCER_UPGRADES['corpse-explosion']?.manaCost ?? CORPSE_EXPLOSION_COST,
  )
}
