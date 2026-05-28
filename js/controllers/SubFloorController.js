import { CONFIG } from '../config.js'
import GameState from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import UI from '../ui/UI.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE } from '../data/tileIcons.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ITEMS } from '../data/items.js'
import { session } from '../core/RunContext.js'

export function spawnSubFloorEntry() {
  const grid = TileEngine.getGrid()
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked && t.type !== 'exit' && t.type !== 'boss') {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  target.type = 'sub_floor_entry'
  target.enemyData = null
  target.subFloorType = TileEngine.rollSubFloorType()
  Logger.info(`[GameController] Sub-floor spawned: ${target.subFloorType} on floor ${session.run.floor}`)
  // Update the front face so when the player flips it, spiral art shows
  if (target.element) {
    for (const cls of [...target.element.classList]) {
      if (cls.startsWith('tile-type-')) target.element.classList.remove(cls)
    }
    target.element.classList.add('tile-type-sub_floor_entry')
    const front = target.element.querySelector('.tile-front')
    if (front) {
      front.className = 'tile-front type-sub-floor-entry'
      front.innerHTML = ''
    }
  }
}

export function applyWarBannerBuffToEnemyGrid(mult) {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t?.enemyData || t.enemyData._slain || t.enemyData._warBannerBuffed) continue
      const e = t.enemyData
      e.hp = Math.max(1, Math.round(e.hp * mult))
      e.currentHP = Math.max(1, Math.round((e.currentHP ?? e.hp) * mult))
      if (Array.isArray(e.dmg)) e.dmg = e.dmg.map(d => Math.max(1, Math.round(d * mult)))
      e._warBannerBuffed = true
      // Unrevealed tiles still render stats on the flip face — refresh DOM for every enemy tile
      if (t.element) {
        UI.updateEnemyHP(t.element, e.currentHP)
        TileEngine.refreshEnemyDamageOnTile(t)
      }
    }
  }
}

export function stripWarBannerBuff(mult) {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t?.enemyData || !t.enemyData._warBannerBuffed) continue
      const e = t.enemyData
      // Dead enemies — do not strip stats (Math.max(1,…) would revive); also guard HP≤0 without _slain
      if (e._slain || (e.currentHP ?? 1) <= 0) {
        delete e._warBannerBuffed
        continue
      }
      e.hp = Math.max(1, Math.round(e.hp / mult))
      e.currentHP = Math.max(1, Math.min(e.hp, Math.round(e.currentHP / mult)))
      if (Array.isArray(e.dmg)) e.dmg = e.dmg.map(d => Math.max(1, Math.round(d / mult)))
      if (e.hitDamage != null) e.hitDamage = Math.max(1, Math.round(e.hitDamage / mult))
      delete e._warBannerBuffed
      if (t.element) {
        UI.updateEnemyHP(t.element, e.currentHP)
        TileEngine.refreshEnemyDamageOnTile(t)
      }
    }
  }
}

export function syncWarBannerCoordsFromGrid() {
  if (!session.run?.warBanner?.active) return
  const { row, col } = session.run.warBanner
  const atSaved = TileEngine.getTile(row, col)
  if (atSaved?.type === 'war_banner') return

  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const r of grid) {
    for (const cell of r) {
      if (cell?.type === 'war_banner') {
        const mult = session.run.warBanner.mult ?? CONFIG.warBanner.statMult
        session.run.warBanner = { row: cell.row, col: cell.col, active: true, mult }
        Logger.debug(`[GameController] warBanner coords synced to (${cell.row},${cell.col})`)
        return
      }
    }
  }
  session.run.warBanner = null
  Logger.debug('[GameController] warBanner cleared — no war_banner tile in grid')
}

export function spawnWarBannerEntry() {
  const mult = CONFIG.warBanner.statMult
  const grid = TileEngine.getGrid()
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked && t.type !== 'exit' && t.type !== 'boss' && t.type !== 'sub_floor_entry'
          && t.type !== 'chest' && t.type !== 'magic_chest' && t.type !== 'heart' && t.type !== 'gold') {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  target.type = 'war_banner'
  target.enemyData = null
  target.warBannerFlying = true
  Logger.info(`[GameController] War banner spawned on floor ${session.run.floor} (enemy buff ×${mult})`)
  // Replacing whatever was under this tile — drop loot-specific state so it cannot resurface after teardown.
  delete target.chestLoot
  delete target.chestReady
  delete target.chestLooted
  delete target.magicChestReady
  delete target.pendingLoot
  session.run.warBanner = { row: target.row, col: target.col, active: true, mult }
  applyWarBannerBuffToEnemyGrid(mult)
  if (target.element) {
    for (const cls of [...target.element.classList]) {
      if (cls.startsWith('tile-type-')) target.element.classList.remove(cls)
    }
    target.element.classList.add('tile-type-war_banner')
    const back = target.element.querySelector('.tile-back')
    if (back) {
      back.innerHTML = '<span class="tile-war-banner-fly" aria-hidden="true">🚩</span>'
    }
    const front = target.element.querySelector('.tile-front')
    if (front) {
      front.className = 'tile-front type-war-banner'
      front.innerHTML = '<span class="tile-icon-wrap tile-icon-fallback"><span class="tile-emoji">🚩</span></span><span class="tile-label">War Banner</span><span class="tile-threat-clue" aria-hidden="true"></span>'
    }
  }
}

export function destroyWarBanner(ctx, tile) {
  if (!tile || tile.type !== 'war_banner' || !session.run.warBanner?.active) return
  const mult = session.run.warBanner.mult ?? CONFIG.warBanner.statMult
  const floatEl = tile.element
  const tr = tile.row
  const tc = tile.col
  if (session.run.warBanner.row !== tr || session.run.warBanner.col !== tc) {
    Logger.warn('[GameController] warBanner row/col !== tapped tile — replacing tapped cell', { warBanner: session.run.warBanner, tr, tc })
  }
  stripWarBannerBuff(mult)
  session.run.warBanner = null
  // Always replace the tapped tile's cell — it is the war_banner the player destroyed (avoids stale session.run.warBanner coords).
  TileEngine.replaceTileWithEmptyPreserveState(tr, tc)
  EventBus.emit('audio:play', { sfx: 'hit' })
  if (floatEl) UI.spawnFloat(floatEl, 'Banner torn!', 'heal')
  UI.setMessage('The war banner falls! Enemies on this floor lose their fighting spirit.')
  // Do not full renderGrid here — that remounts every tile and replays slain spirit FX, chest/gold pulses, etc.
  const patched = TileEngine.patchMainGridTileAt(tr, tc, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
  ctx.saveActiveRun()
}

export function enterSubFloor(ctx, tile) {
  if (tile.subFloorVisited) return // already depleted

  // ── Debug: type picker ───────────────────────────────────────
  if (window.__DEBUG_SUBFLOOR) {
    const types = ['mob_den', 'boss_vault', 'treasure_vault', 'shrine', 'ambush', 'collapsed_tunnel', 'cartographers_cache', 'toxic_gas']
    const picker = document.createElement('div')
    picker.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999',
      'background:rgba(0,0,0,0.82)', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:10px',
    ].join(';')
    const heading = document.createElement('div')
    heading.textContent = '🗺️ DEBUG — Choose sub-floor type'
    heading.style.cssText = 'color:#e8d8a0;font-size:1rem;font-weight:700;margin-bottom:6px'
    picker.appendChild(heading)
    types.forEach(t => {
      const btn = document.createElement('button')
      btn.textContent = t.replace(/_/g, ' ')
      btn.style.cssText = [
        'padding:8px 28px', 'font-size:0.95rem', 'border-radius:6px',
        'border:1px solid #7a6040', 'background:#2a1e10', 'color:#e8d8a0',
        'cursor:pointer', 'min-width:180px',
      ].join(';')
      btn.addEventListener('click', () => {
        document.body.removeChild(picker)
        loadSubFloor(ctx, tile, t)   // skip debug check — go straight to load
      })
      picker.appendChild(btn)
    })
    document.body.appendChild(picker)
    return
  }
  // ────────────────────────────────────────────────────────────

  loadSubFloor(ctx, tile, tile.subFloorType ?? 'mob_den')
}

function loadSubFloor(ctx, tile, type) {
  const sfData = TileEngine.generateSubFloor(type, session.run.floor)
  session.run.subFloor = {
    type,
    tiles: sfData.tiles,
    rows: sfData.rows,
    cols: sfData.cols,
    mobType: sfData.mobType ?? null,
    entryTile: { row: tile.row, col: tile.col },
    active: true,
  }
  UI.showSubFloor(
    session.run.subFloor,
    (r, c) => onSubFloorTileTap(ctx, r, c),
    onSubFloorTileHold,
  )
  const msgs = {
    mob_den:              'You descend into a cramped warren. Creatures scurry in the dark.',
    boss_vault:           'A heavy door seals behind you. Something massive stirs in the center.',
    treasure_vault:       'The glitter of gold catches your eye. But the floor feels... wrong.',
    shrine:               'Silence. Torchlight flickers over an ancient idol.',
    ambush:               'The air is still. Too still.',
    collapsed_tunnel:     'The passage is unstable. Stairs behind you offer escape at any moment.',
    cartographers_cache:  'Dusty scrolls and crumbled maps. Something useful might be buried here.',
    toxic_gas:            '☠️ Toxic gas burns your lungs! Find the exit — every step costs you.',
  }
  UI.setSubFloorMessage(msgs[type] ?? 'You descend into the dark.')
}

export function exitSubFloor() {
  if (!session.run.subFloor) return
  const { entryTile } = session.run.subFloor
  session.run.subFloor.active = false
  // Mark entry tile as depleted on main floor
  const mainTile = TileEngine.getTile(entryTile.row, entryTile.col)
  if (mainTile) {
    mainTile.subFloorVisited = true
    mainTile.type = 'sub_floor_used'
    if (mainTile.element) {
      for (const cls of [...mainTile.element.classList]) {
        if (cls.startsWith('tile-type-')) mainTile.element.classList.remove(cls)
      }
      mainTile.element.classList.add('tile-type-sub_floor_used')
    }
  }
  session.run.subFloor = null
  UI.hideSubFloor()
  UI.setMessage('You climb back to the main floor.')
}

export function onSubFloorTileHold(row, col) {
  if (!session.run?.subFloor) return
  const tile = session.run.subFloor.tiles[row]?.[col]
  if (!tile) return
  if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
    const e = tile.enemyData
    const sprites = ENEMY_SPRITES[e.enemyId]
    UI.showInfoCard({
      name: e.label, spriteSrc: sprites?.idle ? MONSTER_ICONS_BASE + sprites.idle : null,
      emoji: e.emoji, hp: e.currentHP ?? e.hp, maxHp: e.hp,
      dmg: TileEngine.formatEnemyDamageDisplay(e.dmg, e.hitDamage),
      type: e.type, blurb: e.blurb ?? '', attributes: e.attributes ?? [],
    })
  } else if (tile.revealed && tile.type === 'trap') {
    UI.showTrapModal(() => {})
  } else if (tile.revealed) {
    const info = TILE_BLURBS[tile.type]
    if (info) UI.showInfoCard({ name: info.label, emoji: info.emoji, spriteSrc: null, blurb: info.blurb, attributes: [] })
  } else {
    UI.showInfoCard({ name: 'Unknown', emoji: '❓', spriteSrc: null, blurb: 'Darkness conceals what lurks within.', attributes: [] })
  }
}

export function onSubFloorTileTap(ctx, row, col) {
  if (!session.run?.subFloor?.active) return
  const sf = session.run.subFloor
  const tile = sf.tiles[row]?.[col]
  if (!tile) return

  // Ability targeting — shared with main grid
  if (ctx.tryConsumeTargetingTap(tile)) return

  // Stairs up — exit sub-floor
  if (tile.revealed && tile.type === 'stairs_up') {
    exitSubFloor()
    return
  }

  // Shrine — open choice modal
  if (tile.revealed && tile.type === 'shrine' && !tile.shrineUsed) {
    openShrine(ctx, tile)
    return
  }

  // Chest — open loot
  if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
    openSubFloorChest(ctx, tile)
    return
  }

  // Living enemy — fight
  if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
    if (session.tap.combatBusy && Date.now() - session.tap.combatBusySetAt > 3000) {
      session.tap.combatBusy = false
    }
    if (!session.tap.combatBusy) subFloorFight(ctx, tile)
    return
  }

  // Reveal unrevealed tile
  if (!tile.revealed && !tile.locked && tile.reachable) {
    EventBus.emit('audio:play', { sfx: 'flip' })
    subFloorReveal(ctx, tile)
  }
}

function openSubFloorChest(ctx, tile) {
  tile.chestReady = false
  tile.chestLooted = true
  tile.element?.classList.remove('chest-ready')
  EventBus.emit('audio:play', { sfx: 'chest' })

  const loot = tile.chestLoot ?? ctx.rollChestLoot()
  const itemDef = ITEMS[loot.type]

  // Give the loot
  if (loot.type === 'gold') {
    ctx.gainGold(loot.amount ?? 1, tile.element)
    UI.setSubFloorMessage(`You pry it open — +${loot.amount ?? 1} gold!`)
  } else if (loot.type === 'smiths-tools') {
    const amt = itemDef?.effect?.amount ?? 1
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + amt
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    UI.setSubFloorMessage(`You pry it open — ${itemDef?.name ?? "Smith's Tools"}! +${amt} attack.`)
  } else {
    ctx.addToBackpack(loot.type)
    UI.setSubFloorMessage(`You pry it open — ${itemDef?.name ?? 'something useful'}!`)
  }

  // Float the item icon out of the chest — mirrors main _openChest
  if (itemDef) UI.spawnFloat(tile.element, `${itemDef.icon ?? '📦'} ${itemDef.name}`, 'xp')

  // Play chest-open gif, then fade icon out with collecting animation
  const chestImg = tile.element?.querySelector('.tile-icon-img')
  const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
  const GIF_DURATION = 750

  if (chestImg) ctx.forcePlayChestGif(chestImg, ITEM_ICONS_BASE + 'chest.gif?t=' + Date.now())

  setTimeout(() => {
    if (chestImg) chestImg.remove()
    if (iconWrap) {
      iconWrap.classList.add('collecting')
      setTimeout(() => {
        iconWrap.innerHTML = ''
        iconWrap.classList.remove('collecting')
      }, 560)
    }
  }, GIF_DURATION)
}

function sfRevealMainFloorExit() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (t.type === 'exit' && !t.revealed) {
        t.revealed = true
        t.reachable = true
        if (t.element) {
          t.element.classList.add('revealed')
          t.element.classList.add('exit-pending')
          UI.spawnFloat(t.element, '🗺️ Exit found!', 'xp')
        }
        return
      }
    }
  }
}

function sfFadeOutTileIcon(tile) {
  const wrap = tile.element?.querySelector('.tile-icon-wrap')
  if (!wrap) return
  setTimeout(() => {
    wrap.style.transition = 'opacity 0.4s ease'
    wrap.style.opacity = '0'
    setTimeout(() => { wrap.innerHTML = ''; wrap.style.cssText = '' }, 420)
  }, 500)
}

function subFloorReveal(ctx, tile) {
  if (!session.run?.subFloor) return
  const sf = session.run.subFloor
  tile.revealed = true
  UI.flipSubFloorTile(tile)
  // Resolve tile effect
  switch (tile.type) {
    case 'enemy':
    case 'boss': {
      // Lock orthogonal neighbors in sub-floor
      sfLockAdjacent(tile)
      ctx.gainXP(CONFIG.xp.perTileReveal, null)
      UI.setSubFloorMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
      break
    }
    case 'chest': {
      tile.chestLoot = ctx.rollChestLoot()
      tile.chestReady = true
      tile.element?.classList.add('chest-ready')
      ctx.gainXP(CONFIG.xp.perTileReveal, null)
      UI.setSubFloorMessage('A chest! Tap it to open.')
      break
    }
    case 'gold': {
      ctx.gainGold(1, tile.element)
      ctx.gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage('You pocket a coin. +1 gold.')
      sfFadeOutTileIcon(tile)
      break
    }
    case 'heart': {
      const heal = CONFIG.heart.healAmount
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + heal)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(tile.element, `+${heal} HP`, 'heal')
      ctx.gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage(`A healing sigil. +${heal} HP.`)
      sfFadeOutTileIcon(tile)
      break
    }
    case 'trap': {
      const trapDmg = ctx.rand(2, 5)
      ctx.takeDamage(trapDmg, tile.element, false, null, { deathCause: 'trap' })
      ctx.gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage(`A trap! You take ${trapDmg} damage.`)
      break
    }
    case 'empty': {
      ctx.gainXP(CONFIG.xp.perTileReveal, null)
      UI.setSubFloorMessage('Nothing here but stone.')
      break
    }
    case 'stairs_up': {
      UI.setSubFloorMessage('Stairs lead back up. Tap to ascend.')
      break
    }
    case 'shrine': {
      UI.setSubFloorMessage('An ancient shrine. Tap it to make an offering.')
      break
    }
    case 'map': {
      ctx.gainXP(CONFIG.xp.perTileReveal, tile.element)
      // Reveal the main-floor exit tile
      sfRevealMainFloorExit()
      UI.setSubFloorMessage('📜 You found a map! The exit on the main floor is now visible.')
      sfFadeOutTileIcon(tile)
      break
    }
    case 'rubble': {
      // Toxic gas: deal damage each flip
      if (session.run.subFloor?.type === 'toxic_gas') {
        const dmg = CONFIG.subFloor.toxicGasDamagePerFlip
        ctx.takeDamage(dmg, tile.element, false, null, { deathCause: 'toxic_gas' })
        UI.setSubFloorMessage(`☠️ Gas chokes you — ${dmg} damage! Keep searching for the exit.`)
      } else {
        UI.setSubFloorMessage('Just rubble and dust.')
      }
      sfFadeOutTileIcon(tile)
      break
    }
  }
  // Expand reachability from this tile (orthogonal)
  const { tiles, rows, cols } = sf
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  for (const [dr, dc] of dirs) {
    const nr = tile.row + dr, nc = tile.col + dc
    const adj = tiles[nr]?.[nc]
    if (adj && !adj.revealed && !adj.locked && !adj.reachable) {
      adj.reachable = true
      UI.markSubFloorTileReachable(adj)
    }
  }
  // Boss vault: on boss death, unlock all tiles
  if (sf.type === 'boss_vault') {
    const bossAlive = tiles.flat().some(t => t?.enemyData && !t.enemyData._slain && t.isBossVaultBoss)
    if (!bossAlive) {
      for (const row of tiles) for (const t of row) {
        if (t && t.locked) {
          t.locked = false
          t.reachable = true
          UI.markSubFloorTileReachable(t)
        }
      }
    }
  }
}

function sfLockAdjacent(tile) {
  if (!session.run?.subFloor) return
  const { tiles } = session.run.subFloor
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  for (const [dr, dc] of dirs) {
    const adj = tiles[tile.row + dr]?.[tile.col + dc]
    if (adj && !adj.revealed) {
      adj.locked = true
      adj.reachable = false
      UI.lockSubFloorTile(adj)
    }
  }
}

export function sfUnlockAdjacent(tile) {
  if (!session.run?.subFloor) return
  const { tiles, rows, cols } = session.run.subFloor
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  for (const [dr, dc] of dirs) {
    const adj = tiles[tile.row + dr]?.[tile.col + dc]
    if (adj && !adj.revealed && adj.locked) {
      // Only unlock if no other living enemy locks this tile
      let stillLocked = false
      for (const [er, ec] of dirs) {
        const e = tiles[adj.row + er]?.[adj.col + ec]
        if (e && e.revealed && e.enemyData && !e.enemyData._slain && e !== tile) {
          stillLocked = true; break
        }
      }
      if (!stillLocked) {
        adj.locked = false
        adj.reachable = true
        UI.unlockSubFloorTile(adj)
        UI.markSubFloorTileReachable(adj)
      }
    }
  }
}

function subFloorFight(ctx, tile) {
  if (session.tap.combatBusy) return
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  const result = CombatResolver.resolveFight(session.run.player, tile.enemyData)
  const playerDmg = result.playerDmg

  UI.setPortraitAnim('attack')
  EventBus.emit('audio:play', { sfx: 'hit' })
  if (ctx.charKey() === 'mage') UI.spawnMageAttack(tile.element)
  else if (ctx.charKey() === 'vampire') UI.spawnVampireAttack(tile.element)
  else if (ctx.charKey() === 'necromancer') UI.spawnNecromancerAttack(tile.element)
  else UI.spawnSlash(tile.element)
  UI.shakeTile(tile.element)

  // Apply player damage to enemy
  const prevHP = tile.enemyData.currentHP ?? tile.enemyData.hp
  tile.enemyData.currentHP = Math.max(0, prevHP - playerDmg)
  const enemySlain = tile.enemyData.currentHP <= 0

  if (enemySlain) {
    tile.enemyData.currentHP = 0
    tile.enemyData._slain = true
    ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
    ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'damage')
    UI.setSubFloorMessage(`You slay the ${tile.enemyData.label} for ${playerDmg} damage!`)
    UI.markSubFloorTileSlain(tile)
    sfUnlockAdjacent(tile)
    // Boss vault: unlock all rewards on boss death
    if (tile.isBossVaultBoss) {
      const sf = session.run.subFloor
      for (const row of sf.tiles) for (const t of row) {
        if (t && t.locked) {
          t.locked = false; t.reachable = true
          UI.unlockSubFloorTile(t); UI.markSubFloorTileReachable(t)
        }
      }
      UI.setSubFloorMessage('The boss falls! The vault trembles — riches await.')
    }
    setTimeout(() => { UI.setPortraitAnim('idle'); session.tap.combatBusy = false }, 400)
  } else {
    const taken = ctx.computeEffectiveDamageTaken(result.enemyDmg)
    UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'damage')
    ctx.takeDamage(taken, tile.element, false, tile.enemyData, { enemyAttack: true })
    UI.setSubFloorMessage(`You strike for ${playerDmg}. The ${tile.enemyData.label} hits back for ${taken}.`)
    UI.updateSubFloorEnemyHP(tile)
    setTimeout(() => { UI.setPortraitAnim('idle'); session.tap.combatBusy = false }, 500)
  }
}

function openShrine(ctx, tile) {
  const cfg = CONFIG.subFloor.shrine
  const canAffordGold = session.run.player.gold >= cfg.goldOfferingCost
  const goldBtn = document.getElementById('shrine-btn-gold')
  if (goldBtn) goldBtn.disabled = !canAffordGold

  const shrineOverlay = document.getElementById('shrine-overlay')
  if (!shrineOverlay) return
  shrineOverlay.classList.remove('hidden')
  shrineOverlay.removeAttribute('aria-hidden')

  function _closeShrineOverlay() {
    shrineOverlay.classList.add('hidden')
    shrineOverlay.setAttribute('aria-hidden', 'true')
    document.getElementById('shrine-btn-blood')?.removeEventListener('click', onBlood)
    document.getElementById('shrine-btn-gold')?.removeEventListener('click', onGold)
    document.getElementById('shrine-btn-leave')?.removeEventListener('click', onLeave)
  }

  function onBlood() {
    const hpCost = Math.max(1, Math.floor(session.run.player.maxHp * cfg.bloodSacrificeHpPct))
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp - hpCost)
    session.run.player.hp = Math.min(session.run.player.hp, session.run.player.maxHp)
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + cfg.bloodSacrificeDmgBonus
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    tile.shrineUsed = true
    _closeShrineOverlay()
    UI.setSubFloorMessage(`You offer your blood. −${hpCost} max HP, +${cfg.bloodSacrificeDmgBonus} damage.`)
  }

  function onGold() {
    if (session.run.player.gold < cfg.goldOfferingCost) return
    session.run.player.gold -= cfg.goldOfferingCost
    session.run.player.maxHp += cfg.goldOfferingHpBonus
    session.run.player.hp = Math.min(session.run.player.hp + cfg.goldOfferingHpBonus, session.run.player.maxHp)
    UI.updateGold(session.run.player.gold)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    tile.shrineUsed = true
    _closeShrineOverlay()
    UI.setSubFloorMessage(`You lay gold at the shrine. −${cfg.goldOfferingCost}🪙, +${cfg.goldOfferingHpBonus} max HP.`)
  }

  function onLeave() {
    _closeShrineOverlay()
    UI.setSubFloorMessage('You leave the shrine undisturbed.')
  }

  // Delay wiring by one frame so any ghost click from the shrine-tile tap
  // has already fired before the button listeners are attached.
  setTimeout(() => {
    document.getElementById('shrine-btn-blood')?.addEventListener('click', onBlood, { once: true })
    document.getElementById('shrine-btn-gold')?.addEventListener('click', onGold, { once: true })
    document.getElementById('shrine-btn-leave')?.addEventListener('click', onLeave, { once: true })
  }, 0)
}

export function recomputeSubFloorEnemyLocks() {
  const sf = session.run?.subFloor
  if (!sf?.tiles) return
  const rows = sf.tiles.length
  const cols = sf.tiles[0]?.length ?? 0
  // Clear locks on unrevealed tiles.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = sf.tiles[r][c]
      if (!t.revealed && t.locked) {
        t.locked = false
        t.element?.classList.remove('locked')
      }
    }
  }
  // Re-lock adjacent to living enemies (skip archers/mice per main-grid rules).
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = sf.tiles[r][c]
      const e = t.enemyData
      if (!t.revealed || !e || e._slain) continue
      if (e.behaviour === 'archer' || e.behaviour === 'mouse') continue
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = r + dr, nc = c + dc
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
          const adj = sf.tiles[nr][nc]
          if (!adj.revealed) {
            adj.locked = true
            adj.element?.classList.add('locked')
          }
        }
      }
    }
  }
}

export function patchActiveTileDom(ctx, row, col) {
  if (ctx.isInSubFloor()) {
    const sf = session.run?.subFloor
    if (!sf) return
    // Sub-floor tiles don't support a single-tile patch, so rebuild the whole grid.
    UI.showSubFloor(sf, (r, c) => onSubFloorTileTap(ctx, r, c), onSubFloorTileHold)
    return
  }
  const gridEl = UI.getGridEl?.() ?? document.getElementById('grid')
  if (!gridEl) return
  TileEngine.patchMainGridTileAt(row, col, gridEl, ctx.onTileTap, ctx.onTileHold)
}
