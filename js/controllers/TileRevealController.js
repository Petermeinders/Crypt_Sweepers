import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import Bestiary from '../systems/Bestiary.js'
import { session } from '../core/RunContext.js'
import { ITEMS } from '../data/items.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { resolveEnemySpriteSrc, ITEM_ICONS_BASE, TILE_TYPE_ICON_FILES } from '../data/tileIcons.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { tickShockedDurations } from '../systems/Thunderstruck.js'
import { tickVoidEnemyGlobalTurn, applyRevealArmorRend } from '../systems/VoidEnemyMechanics.js'
import {
  getActiveTiles,
  setCombatEngagement,
} from './TileTapRouter.js'

const RANGER_PASSIVE_SKIP_ADJ_LOCK = 0.1

async function maybeMouseUnflip(ctx, sourceTile) {
  const grid = TileEngine.getGrid()
  if (!grid) return
  // Collect all live mice first (so later unflips don't consider mice spawned by another mouse proc)
  const mice = []
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.tileFlipper) {
        mice.push(t)
      }
    }
  }
  if (!mice.length) return

  for (const mouseTile of mice) {
    if (!mouseTile.enemyData || mouseTile.enemyData._slain) continue
    const chance = mouseTile.enemyData.tileFlipChance ?? 0.5
    if (Math.random() >= chance) continue

    // Candidates: revealed, plain empty tiles — never the tile just revealed, never Engineer's turret tile
    const candidates = []
    for (const row of grid) {
      for (const t of row) {
        if (t === sourceTile) continue
        if (!t.revealed) continue
        if (t.type !== 'empty') continue
        if (t.isStart) continue
        if (ctx.turretDeployedOnTile(t)) continue
        candidates.push(t)
      }
    }
    if (!candidates.length) continue

    const target = candidates[Math.floor(Math.random() * candidates.length)]

    EventBus.emit('audio:play', { sfx: 'flip' })
    if (mouseTile.element) UI.spawnFloat(mouseTile.element, '🐭 Hidden!', 'damage')
    UI.setMessage('A mouse scurries across the floor — a tile is hidden again!')

    await TileEngine.unflipAndRerollTile(target, session.run.floor, { isProtected: (t) => ctx.turretDeployedOnTile(t) })
    if (!session.run) return
    const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
    if (!patched) ctx.refreshMainGridDomFromModel()

    if (TileEngine.ensureExitConnectivityFromGrid(session.run.floor) > 0) {
      ctx.refreshMainGridDomFromModel()
    }
    TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
}


// ── Tile hold (info card) ────────────────────────────────────

function showTurretPerimeter(ctx, tr) {
  const grid = TileEngine.getGrid()
  if (!grid || !tr) return
  for (const row of grid) {
    for (const t of row) {
      if (!t.element) continue
      t.element.classList.toggle('turret-perimeter', tr.mode === 'tesla' && ctx.inTeslaPerimeter(tr, t))
    }
  }
}

function clearTurretPerimeter() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      t.element?.classList.remove('turret-perimeter')
    }
  }
}

export function onTileHold(ctx, row, col) {
  const tile = TileEngine.getTile(row, col)
  if (!tile) return

  // Turret hold — check before empty guard since turret sits on empty tiles
  const tr = session.run?.turret
  if (tile.revealed && tr && tr.row === row && tr.col === col) {
    const dmg    = ctx.engineerTurretDamage(tr.level)
    const pingLv = Math.max(1, Math.min(ENGINEER_SEISMIC_PING.maxLevel, session.run.player.seismicPingLevel ?? ENGINEER_SEISMIC_PING.defaultLevel))
    const seismicDesc = pingLv === 1
      ? 'Passive Seismic Ping L1 — each build or move pings the 8 adjacent hidden tiles with category hints (enemy, trap, loot, …) and a quick pulse.'
      : `Passive Seismic Ping L${pingLv} — each build or move pings hidden tiles up to ${pingLv} steps from the turret (same hints + pulse).`
    const modeDesc = tr.manaGeneratorActive
      ? 'Mana Generator — grants mana on every tile flip'
      : tr.mode === 'tesla' ? 'Tesla — zaps enemies in the 8 surrounding tiles' : 'Ballistic — fires at all revealed enemies'
    const details = [
      { icon: '🛡️', label: 'Mode',   desc: modeDesc },
      { icon: '⬆️', label: 'Level',  desc: `T${tr.level}` },
      { icon: '❤️', label: 'HP',     desc: `${tr.hp} / ${tr.maxHp}` },
      { icon: '⚔️', label: 'Damage', desc: `${dmg} per hit` },
      { icon: '📳', label: 'Seismic', desc: seismicDesc },
    ]
    showTurretPerimeter(ctx, tr)
    const overlay = document.getElementById('info-card-overlay')
    const onClose = () => {
      clearTurretPerimeter()
      overlay?.removeEventListener('click', onClose)
    }
    overlay?.addEventListener('click', onClose)
    UI.showInfoCard({
      name:      `Turret (T${tr.level})`,
      spriteSrc: tr.mode === 'tesla'
        ? 'assets/sprites/Heroes/Engineer/turret-tesla.gif'
        : 'assets/sprites/Heroes/Engineer/turret-t1.gif',
      blurb:     tr.mode === 'tesla'
        ? `⚡ Tesla Tower — zaps any enemy you attack within its ${ctx.teslaRadius()}-tile perimeter.`
        : '🛡️ Ballistic Turret — fires at every enemy tile you reveal.',
      details,
      attributes: [],
    })
    return
  }

  if (tile.type === 'empty') return   // nothing interesting to show

  if (tile.type === 'war_banner') {
    const info = TILE_BLURBS.war_banner
    if (info) {
      const blurb = `${info.blurb}\n\n${info.holdHint ?? ''}`
      UI.showInfoCard({ name: info.label, emoji: info.emoji, spriteSrc: null, blurb, attributes: [] })
    }
    return
  }

  let cardData

  if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
    const e       = tile.enemyData
    const childMode = session.save?.settings?.childMode ?? false
    const blurbBase = e.blurb ?? ''
    const blurb     = e.holdHint ? `${blurbBase}\n\n${e.holdHint}` : blurbBase
    cardData = {
      name:       e.label,
      spriteSrc:  resolveEnemySpriteSrc(e.enemyId, { state: 'idle', childMode }),
      emoji:      e.emoji,
      hp:         e.currentHP ?? e.hp,
      maxHp:      e.hp,
      dmg:        TileEngine.formatEnemyDamageDisplay(e.dmg, e.hitDamage),
      type:       e.type,
      blurb,
      attributes: e.attributes ?? [],
    }
  } else if (tile.revealed && tile.type === 'trap') {
    UI.showTrapModal(() => {})
    return
  } else if (tile.revealed) {
    const info = TILE_BLURBS[tile.type]
    if (!info) return
    const iconFile = TILE_TYPE_ICON_FILES[tile.type]
    const spriteSrc = iconFile ? ITEM_ICONS_BASE + iconFile : null
    cardData = {
      name:       info.label,
      emoji:      spriteSrc ? '' : info.emoji,
      spriteSrc,
      blurb:      info.blurb,
      attributes: [],
    }
  } else {
    // Unrevealed — show mystery card
    cardData = {
      name:       'Unknown',
      emoji:      '❓',
      spriteSrc:  null,
      blurb:      'The darkness conceals all. Reveal this tile to learn what lurks within.',
      attributes: [],
    }
  }

  UI.showInfoCard(cardData)
}

// ── Reveal tile ──────────────────────────────────────────────

/** Traps, dedicated fast tiles, and fast ambush on normal enemy reveals — 10% to shave trapfinderStacks HP (min 1). */
export function applyRangerTrapfinderMitigation(preMitigationDmg, p) {
  if (!p?.isRanger || (p.trapfinderStacks ?? 0) <= 0) {
    return { dmg: preMitigationDmg, proc: false }
  }
  if (Math.random() >= CONFIG.ability.trapfinderProcChance) {
    return { dmg: preMitigationDmg, proc: false }
  }
  const mitigated = Math.max(1, preMitigationDmg - p.trapfinderStacks)
  return { dmg: mitigated, proc: true }
}

/** One global “turn” for DoT / debuff effects: each tile flip/reveal, or starting a melee vs any enemy. */
export function tickPoisonArrowDotOnGlobalTurn(ctx, opts = {}) {
  const hapticChannel = opts.hapticChannel === 'gesture' ? 'gesture' : 'deferred'
  const dotHaptic = hapticChannel === 'gesture' ? ctx.hapticFromUserGesture : ctx.hapticFromAsyncTask
  if (!session.run || GameState.is(States.DEATH)) return
  ctx.tickTreasureGoblinCountdown()
  // Teary Eyes debuff tick
  if ((session.run.player.tearyEyesTurns ?? 0) > 0) {
    session.run.player.tearyEyesTurns--
    UI.setTearyEyes(session.run.player.tearyEyesTurns)
  }
  // Freezing Hit debuff tick (1 stack falls off per global turn)
  if ((session.run.player.freezingHitStacks ?? 0) > 0) {
    session.run.player.freezingHitStacks--
    UI.setFreezingHit(session.run.player.freezingHitStacks)
  }
  // Corruption debuff tick: 1 stack falls off per global turn, restoring max HP/Mana proportionally
  if ((session.run.player.corruptionStacks ?? 0) > 0) {
    session.run.player.corruptionStacks--
    const stacks = session.run.player.corruptionStacks
    if (stacks === 0) {
      // Fully restore base max values
      if (session.run.player.corruptionBaseMaxHp)   session.run.player.maxHp   = session.run.player.corruptionBaseMaxHp
      if (session.run.player.corruptionBaseMaxMana) session.run.player.maxMana = session.run.player.corruptionBaseMaxMana
      session.run.player.corruptionBaseMaxHp   = 0
      session.run.player.corruptionBaseMaxMana = 0
    } else {
      // Partial restore — recompute from base
      session.run.player.maxHp   = Math.max(1, Math.round(session.run.player.corruptionBaseMaxHp   * (1 - stacks * 0.02)))
      session.run.player.maxMana = Math.max(1, Math.round(session.run.player.corruptionBaseMaxMana * (1 - stacks * 0.02)))
    }
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.setCorruption(stacks)
  }
  // Player Poison debuff tick: 1 HP damage per stack, then 1 stack falls off
  if ((session.run.player.poisonStacks ?? 0) > 0) {
    const dmg = session.run.player.poisonStacks
    session.run.player.hp = Math.max(1, session.run.player.hp - dmg)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    dotHaptic(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `☠️ Poison ${dmg}`, 'damage')
    session.run.player.poisonStacks--
    UI.setPlayerPoison(session.run.player.poisonStacks)
  }
  // Burn debuff tick: 1 HP damage per stack, then 1 stack falls off
  if ((session.run.player.burnStacks ?? 0) > 0) {
    const dmg = session.run.player.burnStacks
    session.run.player.hp = Math.max(1, session.run.player.hp - dmg)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    dotHaptic(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🔥 Burn ${dmg}`, 'damage')
    session.run.player.burnStacks--
    UI.setBurnOverlay(session.run.player.burnStacks)
    if (session.run.player.hp <= 1 && !GameState.is(States.DEATH)) {
      // Don't kill from burn — leave at 1 HP minimum
    }
  }
  const grid = TileEngine.getGrid()
  const plagueBonus    = session.run.player.inventory?.some(e => e?.id === 'plague-rat-skull') ? 1 : 0
  const festerBonus   = session.run.player.inventory?.some(e => e?.id === 'festering-wound') ? 2 : 0
  const pDmg = ctx.scaleOutgoingDamageToEnemy(ctx.poisonArrowUnitDamage()) + plagueBonus + festerBonus
  for (const tile of getActiveTiles()) {
    if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
    if ((tile.enemyData.poisonTurns ?? 0) <= 0) continue

    tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - pDmg)
    tile.enemyData.poisonTurns--
    if (tile.element) {
      UI.spawnFloat(tile.element, `☠️ ${pDmg}`, 'damage')
      UI.shakeTile(tile.element)
    }
    if (tile.enemyData.currentHP <= 0) {
      const gold = tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1
      ctx.gainGold(gold, tile.element)
      ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
      ctx.endCombatVictory(tile)
    } else if (tile.element) {
      UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
    }
  }
  tickShockedDurations(getActiveTiles())

  // Hemorrhage bleed tick: enemies bleeding from Slam → Hemorrhage branch
  for (const tile of getActiveTiles()) {
    if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
    if ((tile.enemyData.bleedTurns ?? 0) <= 0) continue
    const bDmg = tile.enemyData.bleedDmg ?? 2
    tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - bDmg)
    tile.enemyData.bleedTurns--
    if (tile.element) {
      UI.spawnFloat(tile.element, `🩸 ${bDmg}`, 'damage')
      UI.shakeTile(tile.element)
    }
    if (tile.enemyData.currentHP <= 0) {
      const gold = tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1
      ctx.gainGold(gold, tile.element)
      ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
      if (tile.enemyData.bleedBurst) ctx.hemorrhageBurst(tile)
      ctx.endCombatVictory(tile)
    } else if (tile.element) {
      UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
    }
  }
  if (!grid) return
  tickVoidEnemyGlobalTurn(ctx, grid)
  // Harass tick: each revealed living enemy with harassPlayer=true fires at player every global turn
  let totalHarassDmg = 0
  let archerCount = 0
  let batCount = 0
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
      if (!tile.enemyData.harassPlayer) continue
      const rawDmg = tile.enemyData.harassDmg ?? 1
      // Harass damage scales +1 per 10 floors (floor 1-9 = base, 10-19 = base+1, ...)
      const harassFloorBonus = Math.floor((session.run.floor ?? 1) / 10)
      const dmg = ctx.computeEffectiveDamageTaken(rawDmg + harassFloorBonus)
      totalHarassDmg += dmg
      if (tile.enemyData.enemyId === 'archer_goblin') {
        archerCount++
        const childMode = session.save?.settings?.childMode ?? false
        const img = tile.element?.querySelector('.tile-icon-img')
        if (img && !childMode) {
          img.src = resolveEnemySpriteSrc('archer_goblin', { state: 'attack', childMode: false }) + '?t=' + Date.now()
          setTimeout(() => {
            if (img.isConnected) {
              img.src = resolveEnemySpriteSrc('archer_goblin', { state: 'idle', childMode: false }) + '?t=' + Date.now()
            }
          }, 4000)
        }
        UI.spawnFloat(tile.element, `🏹 ${dmg}`, 'damage')
      } else {
        batCount++
        UI.spawnFloat(tile.element, `🦇 ${dmg}`, 'damage')
      }
    }
  }
  if (totalHarassDmg > 0 && !GameState.is(States.DEATH)) {
    if (archerCount > 0) {
      EventBus.emit('audio:play', archerCount > 1
        ? { sfx: 'enemyArcherShot', layered: { count: Math.min(archerCount, 8), spreadMs: 72, jitterMs: 40 } }
        : { sfx: 'enemyArcherShot' })
    }
    ctx.takeDamage(totalHarassDmg, document.getElementById('hud-portrait'), false, null, {
      enemyAttack: true,
      hapticChannel,
      deathCause: 'archer_harass',
    })
    const parts = []
    if (archerCount > 0) parts.push(`🏹 Goblin Archer${archerCount > 1 ? 's fire' : ' fires'} for ${totalHarassDmg} dmg!`)
    if (batCount > 0) parts.push(`🦇 Shadow Bat${batCount > 1 ? 's attack' : ' attacks'}!`)
    UI.setMessage(parts.join(' ') + ` (${totalHarassDmg} total)`)
  }

  if (session.run.player.inventory?.some(e => e?.id === 'still-water-amulet')) {
    session.run.player.turnsWithoutSpell = (session.run.player.turnsWithoutSpell ?? 0) + 1
  }
  // Bandage Roll HOT
  if ((session.run.player.regenTurns ?? 0) > 0) {
    const amt = session.run.player.regenPerTurn ?? 1
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + amt)
    session.run.player.regenTurns--
    UI.spawnFloat(document.getElementById('hud-portrait'), `🩹 +${amt} HP`, 'heal')
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }
  ctx.refreshAllEnemyStatusDisplays()
}

export function applyRevealOutcome(ctx, tile) {
  if (tile.enemyData) {
    TileEngine.rollEnemyHitDamage(tile.enemyData)
    if (tile.element) {
      UI.updateEnemyHP(tile.element, tile.enemyData.currentHP ?? tile.enemyData.hp)
      TileEngine.refreshEnemyDamageOnTile(tile)
    }
  }
  resolveEffect(ctx, tile)
  session.tap.enemyRevealInProgress = false
}

export async function revealTile(ctx, tile) {
  if (!tile.revealed && ctx.turretDeployedOnTile(tile)) return
  ctx.syncAllUnrevealedLockedDom()
  if (session.run.player.inventory.some(e => e?.id === 'hourglass-sand')) {
    session.run._hourglassSnapshot = ctx.serializeHourglassSnapshot()
  }
  if (tile.element) {
    tile.element.classList.remove('echo-hint')
    delete tile.element.dataset.echoHint
  }
  delete tile.echoHintCategory

  tile.revealed = true
  session.run.tilesRevealed++
  ctx.firefoxPreFlipHapticsIfNeeded(tile)
  UI.setPortraitAnim('run')
  EventBus.emit('audio:play', { sfx: 'flip' })
  if (!tile._lensReveal && (tile.type === 'enemy' || tile.type === 'enemy_fast' || tile.type === 'boss')) {
    session.tap.enemyRevealInProgress = true
  }
  await TileEngine.flipTile(tile)
  if (!session.run) return  // session.run ended (retreat/death) during the flip animation
  UI.setPortraitAnim('idle')
  ctx.gainXP(CONFIG.xp.perTileReveal, tile.element)
  ctx.engineerManaGeneratorOnReveal(tile.element)
  ctx.checkFloorModifierOnReveal(tile)
  EventBus.emit('tile:revealed', { tile })
  // Deathmask: instant kill on first enemy reveal after a proc
  if (tile.enemyData && !tile.enemyData._slain && session.run.player.deathmaskPending) {
    TileEngine.rollEnemyHitDamage(tile.enemyData)
    session.run.player.deathmaskPending = false
    UI.spawnFloat(tile.element, '💀 Instant Kill!', 'xp')
    ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
    ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    ctx.endCombatVictory(tile)
    TileEngine.markReachable(tile.row, tile.col, ctx.markReachableUi)
    return
  }
  await maybeBestiaryDiscovery(tile)
  applyRevealOutcome(ctx, tile)
  if (tile.type === 'war_banner') await maybeWarBannerIntro()
  // Drowned Hulk aura: if the revealed tile IS the hulk, buff all current visible enemies.
  // If a hulk is already alive, buff this newly revealed enemy.
  if (tile.enemyData && !tile.enemyData._slain) {
    ctx.onEnemyLeaderReveal(tile)
    ctx.engineerTurretAfterReveal(tile)
  }
  // Blockage / hole tiles do not extend reachability — player must path around them
  if (tile.type !== 'blockage' && tile.type !== 'hole') {
    TileEngine.markReachable(tile.row, tile.col, ctx.markReachableUi)
  }
  // Ranger unique trait: 50% chance to sense the category of orthogonal neighbors
  if (ctx.charKey() === 'ranger' && Math.random() < 0.5) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element && !adj.echoHintCategory) {
        const cat = ctx.echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }
  if (ctx.charKey() === 'vampire' && session.run && !GameState.is(States.DEATH) && !session.run.atRest) {
    ctx.vampireCorruptedBloodAndDarkEyes(tile)
  }
  if (ctx.charKey() === 'mage' && session.run && !GameState.is(States.DEATH)) {
    ctx.mageLifeTapOnFlip(tile.element ?? document.getElementById('hud-portrait'))
  }
  // Abyssal Lens: randomly reveal one additional tile per flip (non-recursive)
  if (!tile._lensReveal && session.run.player.inventory.some(e => e?.id === 'abyssal-lens')) {
    const grid = TileEngine.getGrid()
    const candidates = []
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && !t.locked && t !== tile) candidates.push(t)
      }
    }
    if (candidates.length > 0) {
      const extra = candidates[Math.floor(Math.random() * candidates.length)]
      extra._lensReveal = true
      await revealTile(ctx, extra)
      delete extra._lensReveal
    }
  }
  tickPoisonArrowDotOnGlobalTurn(ctx, { hapticChannel: 'deferred' })
  TileEngine.refreshAllThreatClueDisplays()
  // Dungeon Mouse (and future tile-flipping creatures): roll after every player flip.
  // Skip on cascaded reveals (Abyssal Lens) so a single tap only triggers mice once.
  if (!tile._lensReveal) {
    await maybeMouseUnflip(ctx, tile)
  }
  maybeOfferDeadlockEscape(ctx)
  if (!tile._lensReveal) ctx.saveActiveRun()
}

export async function maybeWarBannerIntro() {
  if (session.save.settings.warBannerIntroSeen) return
  try {
    await UI.showWarBannerIntro()
    session.save.settings.warBannerIntroSeen = true
    await SaveManager.save(session.save).catch(() => {})
  } catch (e) {
    Logger.debug('[GameController] war banner intro', e)
  }
}

export async function maybeMouseIntro() {
  if (session.save.settings.mouseTutorialSeen) return
  try {
    await UI.showMouseIntro()
    session.save.settings.mouseTutorialSeen = true
    await SaveManager.save(session.save).catch(() => {})
  } catch (e) {
    Logger.debug('[GameController] mouse intro', e)
  }
}

export async function maybeBestiaryDiscovery(tile) {
  const id = tile.enemyData?.enemyId
  if (!id) return
  try {
    if (!Bestiary.registerIfNew(session.save, id)) return
    await SaveManager.save(session.save).catch(() => {})
    await UI.showBestiaryDiscovery(id)
  } catch (e) {
    Logger.debug('[GameController] bestiary discovery', e)
  }
}

// ── Chest open ───────────────────────────────────────────────

/** Swap PNG→GIF reliably (restart animation from frame 0) across browsers. */
function forcePlayChestGif(img, gifSrc) {
  if (!img || img.tagName !== 'IMG') return
  img.removeAttribute('src')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.src = gifSrc
    })
  })
}

export async function openChest(ctx, tile) {
  tile.chestReady = false
  tile.element?.classList.remove('chest-ready')
  const loot = tile.chestLoot

  EventBus.emit('audio:play', { sfx: 'chest' })
  if (loot.type === 'smiths-tools') {
    const def = ITEMS['smiths-tools']
    const amt = def?.effect?.amount ?? 1
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + amt
    {
      const [d0, d1] = ctx.playerDamageRange(session.run.player)
      UI.updateDamageRange(d0, d1)
    }
    UI.spawnFloat(tile.element, `🔧 ${def.name}`, 'xp')
    UI.setMessage(`You pry it open — ${def.name}! +${amt} attack damage for this run.`)
  } else if (loot.type === 'gold') {
    ctx.gainGold(loot.amount, tile.element, false, true)
    UI.setMessage(`You pry it open — +${loot.amount} gold!`)
  } else {
    const def = ITEMS[loot.type]
    if (def) {
      await ctx.addToBackpack(loot.type)
      const tag = def.effect?.type?.startsWith('passive') ? 'Passive' : 'Item'
      UI.spawnFloat(tile.element, `${def.icon} ${def.name}`, 'xp')
      UI.setMessage(`You pry it open — ${def.name}! (${tag})`)
    } else {
      ctx.gainGold(loot.amount ?? 1, tile.element)
      UI.setMessage('You pry it open — something glitters inside.')
    }
  }

  // Swap static chest image to animated gif, wait for it to finish, then collect
  const chestImg = tile.element?.querySelector('.tile-icon-img')
  const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
  const GIF_DURATION = 750 // ms — one play-through of chest.gif

  if (chestImg) forcePlayChestGif(chestImg, ITEM_ICONS_BASE + 'chest.gif?t=' + Date.now())

  setTimeout(() => {
    // Remove the img so no broken-image box shows during collect animation
    if (chestImg) chestImg.remove()
    if (iconWrap) {
      iconWrap.classList.add('collecting')
      setTimeout(() => {
        iconWrap.innerHTML = ''
        iconWrap.classList.remove('collecting')
      }, 560)
    }
  }, GIF_DURATION)

  tile.chestLooted = true
}

// ── Tile effect resolution ───────────────────────────────────

export function resolveEffect(ctx, tile) {
  const p = session.run.player

  switch (tile.type) {

    case 'empty':
      if (session.run.player.inventory.some(e => e?.id === 'tomb-tithe') || session.run.player.inventory.some(e => e?.id === 'delvers-kit')) {
        ctx.gainGold(1, tile.element)
        UI.setMessage('🪦 The tomb pays its tithe — +1 gold.')
      } else if ((() => {
        const bagCount = session.run.player.inventory.filter(e => e?.id === 'scavengers-bag').reduce((sum, e) => sum + (e?.qty ?? 1), 0)
        return bagCount > 0 && Array.from({ length: bagCount }).some(() => Math.random() < 0.05)
      })()) {
        ctx.gainGold(1, tile.element)
        UI.setMessage("Your scavenger's bag catches a glint — +1 gold!")
      } else {
        UI.setMessage('Dust, silence, and the distant drip of water.')
      }
      if (session.run.floorModifier?.id === 'consecrated-ground') {
        session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 1)
        UI.updateHP(session.run.player.hp, session.run.player.maxHp)
        UI.spawnFloat(tile.element, '✨ +1', 'heal')
      }
      UI.showRetreat()
      break

    case 'gold': {
      const g = 1
      ctx.gainGold(g, tile.element)
      tile.type = 'empty'
      UI.setMessage(`A coin on the floor. +1 gold.`)
      UI.showRetreat()
      // Animate the coin icon flying upward and fading out
      const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
      if (iconWrap) iconWrap.classList.add('collecting')
      break
    }

    case 'chest': {
      tile.chestLoot = ctx.rollChestLoot()
      tile.chestReady = true
      if (tile.element) tile.element.classList.add('chest-ready')
      UI.setMessage('A locked chest — tap again to pry it open.')
      UI.showRetreat()
      break
    }

    case 'trap': {
      if (p.trapImmune) {
        p.trapImmune = false
        EventBus.emit('audio:play', { sfx: 'trap' })
        UI.setMessage('🪢 The rope coil trips the snare harmlessly — you walk right through.')
        UI.spawnFloat(tile.element, '🪢 Blocked!', 'heal')
        UI.showRetreat()
        break
      }
      if ((p.trapDodgeChance ?? 0) > 0) {
        const r = tile._trapDodgeRoll != null ? tile._trapDodgeRoll : Math.random()
        if (tile._trapDodgeRoll != null) delete tile._trapDodgeRoll
        if (r < p.trapDodgeChance) {
          EventBus.emit('audio:play', { sfx: 'trap' })
          UI.setMessage('A trap snaps shut — your training pays off! You dodge it.')
          UI.spawnFloat(tile.element, '🪤 Dodged!', 'heal')
          break
        }
      } else if (tile._trapDodgeRoll != null) {
        delete tile._trapDodgeRoll
      }
      let rawDmg = ctx.rand(...CONFIG.trap.damage)
      if (session.run.floorModifier?.id === 'haunted-ground') rawDmg *= 2
      let dmg = Math.max(1, rawDmg - (p.trapReduction ?? 0))
      if (p.inventory?.some(e => e?.id === 'greed-tooth')) dmg += 1
      const reduced = rawDmg !== dmg ? ` (reduced from ${rawDmg})` : ''
      let tfNote = ''
      if (p.isRanger && (p.trapfinderStacks ?? 0) > 0) {
        const r = applyRangerTrapfinderMitigation(dmg, p)
        dmg = r.dmg
        if (r.proc) tfNote = ' Trapfinder!'
      }
      EventBus.emit('audio:play', { sfx: 'trap' })
      ctx.takeDamage(dmg, tile.element, false, null, { deathCause: 'trap' })
      const hauntedNote = session.run.floorModifier?.id === 'haunted-ground' ? ' 💀 Haunted Ground!' : ''
      UI.setMessage(`A trap snaps shut! You take ${dmg} damage${reduced}.${tfNote}${hauntedNote}`)
      if (!GameState.is(States.DEATH)) {
        if (session.run.floorModifier?.id === 'haunted-ground') {
          const hauntedLoot = ctx.rollChestLoot()
          if (hauntedLoot.type !== 'gold') {
            ctx.addToBackpack(hauntedLoot.type).then(() => {
              const def = ITEMS[hauntedLoot.type]
              if (def) UI.spawnFloat(tile.element, `${def.icon} ${def.name}`, 'xp')
            }).catch(() => {})
          } else {
            ctx.gainGold(hauntedLoot.amount ?? 1, tile.element)
          }
        }
        UI.showRetreat()
      }
      break
    }

    case 'well': {
      p.hp   = p.maxHp
      p.mana = p.maxMana
      UI.updateHP(p.hp, p.maxHp)
      UI.updateMana(p.mana, p.maxMana)
      UI.spawnFloat(tile.element, 'Restored!', 'heal')
      UI.setMessage('The well washes over you — health and mana restored.')
      EventBus.emit('audio:play', { sfx: 'heal' })
      UI.showRetreat()
      break
    }

    case 'anvil': {
      p.damageBonus = (p.damageBonus ?? 0) + 1
      {
        const [d0, d1] = ctx.playerDamageRange(p)
        UI.updateDamageRange(d0, d1)
      }
      UI.spawnFloat(tile.element, '+1 ATK', 'xp')
      UI.setMessage('You temper your weapon on the anvil — +1 attack damage for this run.')
      EventBus.emit('audio:play', { sfx: 'hit' })
      UI.showRetreat()
      break
    }

    case 'forge': {
      const inv = session.run.player.inventory
      const hasMatch = FORGE_RECIPES.some(r => {
        const isDupe = r.ingredientA === r.ingredientB
        const count  = inv.filter(e => e?.id === r.ingredientA).length
        const hasA   = isDupe ? count >= 2 : inv.some(e => e?.id === r.ingredientA)
        const hasB   = isDupe ? true        : inv.some(e => e?.id === r.ingredientB)
        return hasA && hasB
      })
      if (hasMatch) {
        ctx.openForge(tile)
      } else {
        UI.setMessage('The forge awaits — bring two combinable trinkets to merge them.')
        UI.showRetreat()
      }
      break
    }

    case 'magic_chest': {
      tile.magicChestReady = true
      if (tile.element) tile.element.classList.add('chest-ready')
      ctx.syncMagicChestKeyGlow()
      const keys = session.run.player.goldenKeys ?? 0
      UI.setMessage(`✨ A Magic Chest! Spend a 🗝️ Golden Key to open it. You have ${keys} key${keys === 1 ? '' : 's'}.`)
      UI.showRetreat()
      break
    }

    case 'rope': {
      tile.ropeResolved = false
      if (tile.element) tile.element.classList.add('rope-pending')
      UI.setMessage('🧵 A vault rope. Tap again to bank some gold before pushing deeper.')
      UI.showRetreat()
      break
    }

    case 'heart': {
      const bonus   = CONFIG.heart.maxHpBonus
      const healAmt = Math.min(CONFIG.heart.healAmount, p.maxHp + bonus - p.hp)
      p.maxHp += bonus
      p.hp     = Math.min(p.maxHp, p.hp + healAmt)
      UI.spawnFloat(tile.element, `+${bonus} Max HP`, 'heal')
      UI.spawnFloat(tile.element, `+${healAmt} HP`, 'heal')
      UI.updateHP(p.hp, p.maxHp)
      UI.setMessage(`✨ A sacred heart! Your max HP grows. +${bonus} max HP, +${healAmt} HP restored.`)
      UI.showRetreat()
      break
    }

    case 'armor': {
      const av = tile.armorValue ?? 1
      p.armor = (p.armor ?? 0) + av
      tile.type = 'empty'
      EventBus.emit('audio:play', { sfx: 'armor_pickup' })
      UI.spawnFloat(tile.element, `+${av} Armor`, 'armor')
      UI.updateArmor(p.armor)
      UI.setMessage(`🛡️ You pick up a piece of armor. +${av} Armor.`)
      UI.showRetreat()
      const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
      if (iconWrap) iconWrap.classList.add('collecting-spin')
      break
    }

    case 'manuscript': {
      tile.manuscriptReady = true
      if (tile.element) tile.element.classList.add('manuscript-ready')
      EventBus.emit('audio:play', { sfx: 'chest' })
      UI.setMessage('📄 A crumpled journal page — tap again to read it.')
      UI.showRetreat()
      break
    }

    case 'checkpoint': {
      const healAmt = Math.floor(p.maxHp * CONFIG.checkpoint.healPercent)
      const manaAmt = CONFIG.checkpoint.manaRestore
      p.hp       = Math.min(p.maxHp,   p.hp   + healAmt)
      p.mana     = Math.min(p.maxMana, p.mana + manaAmt)
      UI.spawnFloat(tile.element, `+${healAmt} HP`, 'heal')
      UI.spawnFloat(tile.element, `+${manaAmt} MP`, 'mana')
      UI.updateHP(p.hp, p.maxHp)
      UI.updateMana(p.mana, p.maxMana)
      UI.setMessage(`🏕️ A hidden camp! You rest and recover. +${healAmt} HP, +${manaAmt} mana.`)
      UI.showRetreat()
      SaveManager.save(session.save)
      EventBus.emit('run:checkpoint', {})
      break
    }

    case 'blockage':
      UI.setMessage('A pile of rubble blocks the way. Find another path.')
      break

    case 'hole':
      UI.setMessage('A gaping pit blocks the way. Find another path.')
      break

    case 'merchant':
      UI.setMessage('🛒 A travelling merchant is here. Tap to browse their wares.')
      UI.showRetreat()
      break

    case 'event':
      tile.eventResolved = false
      session.run.eventTile = tile
      if (tile.element) tile.element.classList.add('event-pending')
      UI.setMessage('Something stirs in the shadows. Tap to investigate.')
      UI.showRetreat()
      break

    case 'boss': {
      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (rangerSkipLock) {
        tile.enemyData.rangerSkipAdjacentLock = true
      } else if (tile.enemyData?.behaviour !== 'archer') {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)
      if (!GameState.is(States.DEATH)) {
        UI.setMessage(
          `⚠️ BOSS: ${tile.enemyData.label} — stands before you. Tap when ready to fight.`,
          true,
        )
        UI.showRetreat()
        EventBus.emit('tile:locked', {})
      }
      break
    }

    case 'enemy':
    case 'enemy_fast': {
      const isFastAmbush =
        (tile.type === 'enemy_fast' || tile.enemyData?.attributes?.includes('fast'))
        && !tile.enemyData?.isBoss
        && !p.isVampire

      if (isFastAmbush) {
        let reflexDodge = false
        const { dmg } = CombatResolver.resolveFastReveal(tile.enemyData)
        const wardensBlock = p.inventory.some(e => e?.id === 'wardens-brand')
        reflexDodge =
          !wardensBlock
          && (p.reflexDodgeChance ?? 0) > 0
          && Math.random() < p.reflexDodgeChance
        if (!wardensBlock && !reflexDodge) {
          const baseDmg = dmg + (p.inventory.some(e => e?.id === 'abyssal-lens') ? 1 : 0)
          const r = applyRangerTrapfinderMitigation(baseDmg, p)
          ctx.takeDamage(r.dmg, tile.element, false, tile.enemyData, { enemyAttack: true, deathCause: 'fast_enemy' })
        }
        UI.shakeTile(tile.element)
        const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
        if (rangerSkipLock) {
          tile.enemyData.rangerSkipAdjacentLock = true
        } else if (tile.enemyData?.behaviour !== 'archer') {
          TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
        }
        UI.markTileEnemyAlive(tile.element)
        if (!GameState.is(States.DEATH)) {
          const dodgeNote = reflexDodge ? ' Your reflexes kick in — ambush dodged!' : ''
          UI.setMessage(`⚡ Fast enemy strikes first!${dodgeNote} Tap it to fight.`, true)
          if (reflexDodge) UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
          if (wardensBlock || reflexDodge) applyRevealArmorRend(p, tile)
          UI.showRetreat()
          EventBus.emit('tile:locked', {})
        }
        break
      }

      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (rangerSkipLock) {
        tile.enemyData.rangerSkipAdjacentLock = true
      } else if (tile.enemyData?.behaviour !== 'archer') {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)

      // Fortune's Fool: auto-reroll enemy stats on reveal (free, no mana cost)
      if (session.run.player.inventory.some(e => e?.id === 'fortunes-fool')) {
        TileEngine.refreshEnemyDamageOnTile(tile, session.run.floor)
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        UI.spawnFloat(tile.element, '🤡 Rerolled!', 'xp')
      }
      // Tongue Snatch: Toad Beast steals 1–5 gold on reveal
      if (tile.enemyData?.tongueSnatch) {
        const snatch = Math.min(p.gold, ctx.rand(1, 5))
        if (snatch > 0) {
          p.gold -= snatch
          tile.enemyData.snatched = snatch
          UI.updateGold(p.gold)
          UI.spawnFloat(tile.element, `👅 −${snatch}💰`, 'damage')
          UI.setMessage(`👅 The Toad Beast's tongue snaps out and snatches ${snatch} gold! Kill it to get it back.`, true)
          EventBus.emit('audio:play', { sfx: 'gold' })
          UI.showRetreat()
          break
        }
      }

      const hasLens = p.inventory.some(e => e?.id === 'abyssal-lens')
      if (hasLens && !tile.enemyData?.isBoss && !p.isVampire) {
        // Abyssal Lens: normal enemies also deal 1 ambush damage
        ctx.takeDamage(1, tile.element, false, tile.enemyData, { enemyAttack: true })
        if (!GameState.is(States.DEATH)) {
          UI.setMessage(`👁️ The ${tile.enemyData?.label ?? 'enemy'} senses your sight and strikes! Tap to fight.`)
          setCombatEngagement(tile, { force: true })
        }
      } else {
        applyRevealArmorRend(p, tile)
        UI.setMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
      }
      UI.showRetreat()
      EventBus.emit('tile:locked', {})
      break
    }

    case 'exit':
      tile.exitResolved = false
      if (tile.element) tile.element.classList.add('exit-pending')
      if (session.run.floor >= CONFIG.maxFloor) {
        UI.setMessage('🚪 Daylight ahead! Tap the exit again when you\'re ready to leave the dungeon.')
      } else {
        UI.setMessage('🚪 Stairs lead downward. Tap the exit again when you\'re ready to descend.')
      }
      UI.showRetreat()
      break

    case 'sub_floor_entry': {
      const warnings = { ambush: ' Something feels wrong…', collapsed_tunnel: ' Dust falls from above.' }
      const warn = warnings[tile.subFloorType] ?? ''
      UI.setMessage(`🕳️ A hidden passage yawns open.${warn} Tap again to descend — or leave it be.`)
      tile.entryReady = true
      if (tile.element) tile.element.classList.add('sub-floor-entry-ready')
      UI.showRetreat()
      break
    }

    case 'war_banner': {
      tile.bannerReady = true
      tile.warBannerFlying = false
      if (tile.element) {
        tile.element.classList.add('war-banner-ready')
        const fly = tile.element.querySelector('.tile-war-banner-fly')
        if (fly) fly.remove()
      }
      UI.setMessage('🚩 An enemy war banner! Tear it down quickly — your foes fight harder while it flies. Tap again to destroy it.')
      UI.showRetreat()
      break
    }
  }
}


export function maybeOfferDeadlockEscape(ctx) {
  if (!session.run || !ctx.isPlayerDeadlocked()) return
  const grid = TileEngine.getGrid()
  if (!grid) return
  // Already offered? Just re-show the prompt so the player isn't confused.
  for (const row of grid) {
    for (const t of row) {
      if (t.deadlockEscape) {
        UI.setMessage('No path forward — tap the highlighted hazard to clear a path.')
        return
      }
    }
  }
  let pick = null
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed || (t.type !== 'hole' && t.type !== 'blockage')) continue
      const adj = TileEngine.getOrthogonalTiles(t.row, t.col)
      const hasWalkable = adj.some(n => n.revealed && n.type !== 'hole' && n.type !== 'blockage')
      if (!hasWalkable) continue
      pick = t
      break
    }
    if (pick) break
  }
  if (!pick) {
    UI.setMessage('No path forward and no hazard to clear. Use the Retreat button to escape this floor.', true)
    return
  }
  pick.deadlockEscape = true
  if (pick.element) pick.element.classList.add('deadlock-escape')
  UI.setMessage('No path forward — tap the highlighted tile to clear a path.', true)
}

