import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { ENGINEER_BASE, ENGINEER_UPGRADES, ENGINEER_TURRET, ENGINEER_CONSTRUCT_MANA_COST, ENGINEER_MOVE_MANA_COST, ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { session, charKey } from '../core/RunContext.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

export function isEngineerUpgradeUnlocked(ctx, id) {
  return ctx.isActiveUnlocked(id, 'engineer')
}

export function engineerTurretMaxHp(level) {
  return ENGINEER_TURRET.maxHpByLevel[Math.max(1, Math.min(3, level)) - 1]
}

export function engineerTurretDamage(level) {
  return ENGINEER_TURRET.damageByLevel[Math.max(1, Math.min(3, level)) - 1]
}

export function teslaStacks() {
  return session.run?.player?.engineerActiveStacks?.['tesla-tower'] ?? 0
}

export function teslaRadius() {
  const s = teslaStacks()
  return s >= 3 ? 4 : s >= 2 ? 3 : s >= 1 ? 2 : 1
}

export function teslaArcChance() {
  const s = teslaStacks()
  return s >= 3 ? 0.75 : s >= 2 ? 0.50 : s >= 1 ? 0.25 : 0
}

export function inTeslaPerimeter(tr, tile) {
  if (!tr || tile == null) return false
  return Math.max(Math.abs(tr.row - tile.row), Math.abs(tr.col - tile.col)) <= teslaRadius()
}

export function turretDeployedOnTile(tile) {
  if (!tile) return false
  const tr = session.run?.turret
  if (!tr || tr.hp <= 0) return false
  return tr.row === tile.row && tr.col === tile.col
}

export function syncTurretVisual(constructing = false) {
  if (!session.run) return
  const grid = TileEngine.getGrid()
  if (!grid) return
  // Clear turret classes, perimeter, and injected content from all tiles
  for (const row of grid) {
    for (const t of row) {
      if (t.element) {
        t.element.classList.remove('engineer-turret', 'engineer-turret-tesla', 'turret-perimeter')
        const old = t.element.querySelector('.turret-overlay')
        if (old) old.remove()
      }
    }
  }
  const tr = session.run.turret
  if (!tr) return
  const tile = TileEngine.getTile(tr.row, tr.col)
  if (!tile?.element) return

  tile.element.classList.add('engineer-turret')
  if (tr.mode === 'tesla') {
    tile.element.classList.add('engineer-turret-tesla')
    for (const row of grid) {
      for (const t of row) {
        if (!t.element) continue
        if (inTeslaPerimeter(tr, t)) t.element.classList.add('turret-perimeter')
      }
    }
  }

  // Inject turret sprite + HP/DMG stats into the tile front
  const dmg = engineerTurretDamage(tr.level)
  const overlay = document.createElement('div')
  overlay.className = 'turret-overlay'
  const idleSrc = tr.manaGeneratorActive
    ? 'assets/sprites/Heroes/Engineer/turret-mana.gif'
    : tr.mode === 'tesla'
      ? 'assets/sprites/Heroes/Engineer/turret-tesla.gif'
      : 'assets/sprites/Heroes/Engineer/turret-t1.gif'
  const spriteSrc = constructing
    ? 'assets/sprites/Heroes/Engineer/turret-construction.gif'
    : idleSrc
  const statLine = tr.manaGeneratorActive
    ? `<span class="stat-dmg">🔋 +mana</span>`
    : `<span class="stat-dmg">⚔️ ${dmg}</span>`
  overlay.innerHTML = `
    <span class="turret-level-badge">T${tr.level}</span>
    <img class="turret-sprite" src="${spriteSrc}?t=${Date.now()}" alt="Turret">
    <div class="tile-enemy-stats">
      <span class="stat-hp">❤️ ${tr.hp}</span>
      ${statLine}
    </div>`
  tile.element.appendChild(overlay)

  if (constructing) {
    setTimeout(() => syncTurretVisual(false), 2160)
  }
}

export function destroyTurret(ctx) {
  EventBus.emit('audio:play', { sfx: 'turretDestroyed' })
  session.run.turret = null
  syncTurretVisual()
  // Feedback blast: losing the turret costs the player 5 HP
  const backlash = 5
  session.run.player.hp = Math.max(0, session.run.player.hp - backlash)
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.spawnFloat(document.getElementById('hud-portrait'), `💥 −${backlash} HP`, 'damage')
  refreshEngineerHud(ctx)
  if (session.run.player.hp <= 0) {
    ctx.die(null, { deathCause: 'turret_destroyed' })
  }
}

export function damageTurretFromEnemyHit(ctx, rawAmount, floatEl) {
  if (!session.run.turret || session.run.turret.hp <= 0) return
  const eff = ctx.computeEffectiveDamageTaken(rawAmount)
  session.run.turret.hp -= eff
  UI.spawnFloat(floatEl ?? document.getElementById('hud-portrait'), `🛡️ Turret −${eff}`, 'damage')
  if (session.run.turret.hp <= 0) {
    UI.setMessage('💥 Your turret is destroyed! You take 5 damage from the feedback blast.')
    destroyTurret(ctx)
  } else {
    syncTurretVisual()
  }
}

export function engineerSeismicPingTargetTiles(row, col) {
  const raw = session.run?.player?.seismicPingLevel ?? ENGINEER_SEISMIC_PING.defaultLevel
  const radius = Math.max(1, Math.min(ENGINEER_SEISMIC_PING.maxLevel, raw))
  const grid = TileEngine.getGrid()
  if (!grid) return []
  const out = []
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr === 0 && dc === 0) continue
      if (Math.max(Math.abs(dr), Math.abs(dc)) > radius) continue
      const t = grid[row + dr]?.[col + dc]
      if (t) out.push(t)
    }
  }
  return out
}

export function engineerTurretSeismicPing(ctx, row, col) {
  if (charKey() !== 'engineer' || row == null || col == null) return
  const neighbors = engineerSeismicPingTargetTiles(row, col)
  for (const adj of neighbors) {
    if (!adj?.element || adj.revealed) continue
    if (!adj.echoHintCategory) {
      const cat = ctx.echoCharmCategoryForTileType(adj.type)
      adj.echoHintCategory = cat
      adj.element.classList.add('echo-hint')
      adj.element.dataset.echoHint = cat
    }
    adj.element.classList.add('flash-seismic')
    setTimeout(() => adj.element.classList.remove('flash-seismic'), 520)
  }
}

export function engineerTurretAfterReveal(ctx, tile) {
  if (charKey() !== 'engineer' || !session.run.turret?.hp) return
  if (!tile?.enemyData || tile.enemyData._slain) return
  const tr = session.run.turret
  if (tr.manaGeneratorActive) return
  if (tr.mode === 'tesla' && !inTeslaPerimeter(tr, tile)) return
  const dmg = engineerTurretDamage(tr.level)
  const td = tile.enemyData
  td.currentHP = Math.max(0, td.currentHP - dmg)
  UI.spawnFloat(tile.element, `🛡️ ${dmg}`, 'damage')
  const turretTileEl = TileEngine.getTile(tr.row, tr.col)?.element
  if (tr.mode === 'tesla') {
    UI.spawnTeslaArc(turretTileEl, tile.element)
  } else {
    UI.spawnCannonShot(turretTileEl, tile.element)
  }
  EventBus.emit('audio:play', { sfx: 'hit' })
  if (td.currentHP <= 0) {
    ctx.gainGold(td.goldDrop ? ctx.rand(...td.goldDrop) : 1, tile.element, true)
    ctx.gainXP(td.xpDrop ?? 0, tile.element)
    // Turret kill heal (Mastery III in-session.run pick)
    if (session.run.player.turretKillHeal && tr.level >= 3 && tr.hp > 0) {
      const tkHeal = Math.max(1, Math.floor(session.run.player.maxHp * 0.03))
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + tkHeal)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(tile.element, `💚 +${tkHeal}`, 'xp')
    }
    ctx.endCombatVictory(tile)
    return
  }
  // Tesla arc: after firing, chance to arc to a second revealed enemy
  if (tr.mode === 'tesla' && Math.random() < teslaArcChance()) {
    const arcTargets = ctx.getActiveTiles().filter(t =>
      t !== tile && t.revealed && t.enemyData && !t.enemyData._slain
    )
    if (arcTargets.length > 0) {
      const arcTile = arcTargets[Math.floor(Math.random() * arcTargets.length)]
      arcTile.enemyData.currentHP = Math.max(0, arcTile.enemyData.currentHP - dmg)
      const turretTileEl = TileEngine.getTile(tr.row, tr.col)?.element
      setTimeout(() => UI.spawnTeslaArc(turretTileEl, arcTile.element), 120)
      UI.spawnFloat(arcTile.element, `⚡ ${dmg}`, 'damage')
      if (arcTile.enemyData.currentHP <= 0) {
        arcTile.enemyData._slain = true
        ctx.gainGold(arcTile.enemyData.goldDrop ? ctx.rand(...arcTile.enemyData.goldDrop) : 1, arcTile.element, true)
        ctx.gainXP(arcTile.enemyData.xpDrop ?? 0, arcTile.element)
        if (session.run.player.turretKillHeal && tr.level >= 3 && tr.hp > 0) {
          const tkHeal = Math.max(1, Math.floor(session.run.player.maxHp * 0.03))
          session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + tkHeal)
          UI.updateHP(session.run.player.hp, session.run.player.maxHp)
          UI.spawnFloat(arcTile.element, `💚 +${tkHeal}`, 'xp')
        }
      } else {
        UI.updateEnemyHP(arcTile.element, arcTile.enemyData.currentHP)
      }
    }
  }
  UI.updateEnemyHP(tile.element, td.currentHP)
  const [dmgMin, dmgMax] = td.dmg ?? CONFIG.enemy.damage
  const enemyCounter = typeof td.hitDamage === 'number'
    ? td.hitDamage
    : dmgMin + Math.floor(Math.random() * (dmgMax - dmgMin + 1))
  damageTurretFromEnemyHit(ctx, enemyCounter, tile.element)
}

export function handleEngineerConstructTileTap(ctx, tile) {
  const tr = session.run.turret
  if (tr && tr.row === tile.row && tr.col === tile.col) {
    const cost = ENGINEER_CONSTRUCT_MANA_COST
    const maxLevel = session.run.player.turretMaxLevel ?? 1
    if (tr.level >= maxLevel) {
      UI.setMessage(maxLevel < 3
        ? `Pick Turret Mastery ${maxLevel === 1 ? 'I' : 'II'} at level-up to upgrade further.`
        : 'Turret is already max level.', true)
      return true
    }
    if (tr.level >= 3) {
      UI.setMessage('Turret is already max level.', true)
      return true
    }
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana.', true)
      return true
    }
    session.run.player.mana -= cost
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    tr.level++
    tr.maxHp = engineerTurretMaxHp(tr.level)
    tr.hp = tr.maxHp
    syncTurretVisual()
    session.tap.engineerPendingTile = null
    UI.setEngineerPlaceMode(false)
    EventBus.emit('audio:play', { sfx: 'confirmClick' })
    UI.setMessage(`Turret upgraded to level ${tr.level}!`)
    ctx.saveActiveRun()
    return true
  }
  // Do not require tile.reachable: the start tile is revealed but never gets reachable=true
  // (markReachable only tags unrevealed neighbors). Any revealed empty is a valid build site.
  const canPlace = tile.revealed && tile.type === 'empty' && !tile.locked
  if (!canPlace) {
    session.tap.engineerPendingTile = null
    UI.setEngineerPlaceMode(false)
    return false
  }
  const pending = session.tap.engineerPendingTile
  if (pending && (pending.row !== tile.row || pending.col !== tile.col)) {
    session.tap.engineerPendingTile = { row: tile.row, col: tile.col }
    UI.setEngineerPlaceMode(true)
    UI.flashTile(tile.element)
    UI.setMessage('🛠️ Tap again to confirm placement.')
    return true
  }
  if (pending && pending.row === tile.row && pending.col === tile.col) {
    const isRelocation = !!session.run.turret
    const cost = isRelocation ? ENGINEER_MOVE_MANA_COST : ENGINEER_CONSTRUCT_MANA_COST
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana.', true)
      return true
    }
    session.run.player.mana -= cost
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    if (isRelocation) {
      session.run.turret.row = tile.row
      session.run.turret.col = tile.col
    } else {
      session.run.turret = {
        row: tile.row,
        col: tile.col,
        level: 1,
        mode: 'ballistic',
        hp: engineerTurretMaxHp(1),
        maxHp: engineerTurretMaxHp(1),
      }
    }
    session.tap.engineerPendingTile = null
    UI.setEngineerPlaceMode(false)
    syncTurretVisual(true)
    engineerTurretSeismicPing(ctx, tile.row, tile.col)
    EventBus.emit('audio:play', { sfx: 'turretSetup' })
    UI.setMessage(isRelocation ? 'Turret relocated!' : 'Turret constructed!')
    ctx.saveActiveRun()
    return true
  }
  session.tap.engineerPendingTile = { row: tile.row, col: tile.col }
  UI.setEngineerPlaceMode(true)
  UI.flashTile(tile.element)
  UI.setMessage('🛠️ Tap again to confirm placement.')
  return true
}

export function constructTurretAction(ctx) {
  if (isEngineerUpgradeUnlocked(ctx, 'mana-generator')) manaGeneratorAction(ctx)
}

export function teslaTowerAction(ctx) {
  if (!isEngineerUpgradeUnlocked(ctx, 'tesla-tower')) return
  if (session.tap.combatBusy) return
  if (ctx.isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  if (!GameState.is(States.FLOOR_EXPLORE)) return
  if (!session.run.turret?.hp) {
    UI.setMessage('Build a turret first.', true)
    return
  }
  const tr = session.run.turret
  const enabling = tr.mode !== 'tesla'
  tr.mode = enabling ? 'tesla' : 'ballistic'
  if (enabling) tr.manaGeneratorActive = false
  syncTurretVisual()
  refreshEngineerHud(ctx)
  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  UI.setMessage(enabling ? '⚡ Tesla Tower online!' : '⚡ Tesla Tower offline.')
  ctx.saveActiveRun()
}

export function manaGeneratorAction(ctx) {
  if (!isEngineerUpgradeUnlocked(ctx, 'mana-generator')) return
  if (session.tap.combatBusy) return
  if (ctx.isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  if (!GameState.is(States.FLOOR_EXPLORE)) return
  if (!session.run.turret?.hp) {
    UI.setMessage('Build a turret first.', true)
    return
  }
  const tr = session.run.turret
  const enabling = !tr.manaGeneratorActive
  tr.manaGeneratorActive = enabling
  if (enabling) tr.mode = 'ballistic'
  syncTurretVisual()
  refreshEngineerHud(ctx)
  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  UI.setMessage(enabling ? '🔋 Mana Generator online!' : '🔋 Mana Generator offline.')
  ctx.saveActiveRun()
}

export function engineerManaGeneratorOnReveal(tileEl) {
  if (charKey() !== 'engineer') return
  if (!session.run.turret?.hp || !session.run.turret.manaGeneratorActive) return
  const stacks = session.run.player.manaGeneratorMasteryStacks ?? 0
  // M3: when mana is already full, heal 1 HP instead
  if (stacks >= 3 && session.run.player.mana >= session.run.player.maxMana) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 1)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(tileEl, '💚 +1', 'xp')
    return
  }
  let gain = 1
  if (stacks >= 2 && Math.random() < 0.25) gain = 3
  else if (stacks >= 1 && Math.random() < 0.25) gain = 2
  session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + gain)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.spawnFloat(tileEl, `🔋 +${gain}`, 'xp')
}

export function refreshEngineerHud(ctx) {
  const t = ENGINEER_UPGRADES['tesla-tower'].manaCost
  UI.setSlamBtn(false)
  UI.setRicochetBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setLifeTapBtn(false)
  UI.setEngineerManaGeneratorBtn(isEngineerUpgradeUnlocked(ctx, 'mana-generator'), session.run.turret?.manaGeneratorActive ?? false)
  UI.setEngineerTeslaBtn(isEngineerUpgradeUnlocked(ctx, 'tesla-tower'), session.run.turret?.mode === 'tesla')
}
