import { CONFIG } from '../config.js'
import { isFoeTileType } from '../data/tiles.js'
import {
  isVoidTrialRun,
  isVoidPreBossSanctuaryFloor,
  isBossFloorForRun,
  voidMaxFloor,
} from '../systems/VoidTrial.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import EnemyLeaders from '../systems/EnemyLeaders.js'
import SaveManager from '../save/SaveManager.js'
import MetaProgression from '../systems/MetaProgression.js'
import UI from '../ui/UI.js'
import { pickModifier } from '../systems/FloorModifiers.js'
import { beginVoidCorruptionFlow } from './VoidCorruptionController.js'
import { session } from '../core/RunContext.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { clearAllCombatEngagement, syncCombatEngagementDom } from './TileTapRouter.js'

export function startFloor(ctx) {
  if (session.run) session.run._exitTransitionPending = false
  session.tap.spellTargeting         = false
  session.tap.combatBusy             = false
  clearAllCombatEngagement()
  session.tap.lanternTargeting       = false
  session.tap.spyglassTargeting      = false
  session.tap.blindingLightTargeting = false
  session.tap.divineLightSelecting   = false
  UI.setDivineLightActive(false)
  session.tap.ricochetSelecting = false
  session.tap.ricochetTiles     = []
  UI.clearRicochetMarks()
  UI.setRicochetActive(false)
  UI.setGridRicochetMode(false)
  session.tap.arrowBarrageSelecting = false
  session.tap.tripleVolleyCenter = null
  UI.clearTripleVolleyAoePreview()
  UI.setArrowBarrageActive(false)
  UI.setGridArrowBarrageMode(false)
  session.tap.poisonArrowShotSelecting = false
  UI.setPoisonArrowShotActive(false)
  UI.setGridPoisonArrowShotMode(false)
  ctx.cancelEngineerConstructMode()
  ctx.cancelChainLightningMode()
  ctx.cancelTelekineticThrowMode()
  ctx.cancelStrengthenMinionMode()
  ctx.cancelCorpseExplosionMode()
  session.tap.mistFormFlipsRemaining = 0
  if (session.run?.player) { session.run.player.tearyEyesTurns = 0; UI.setTearyEyes(0); session.run.player.freezingHitStacks = 0; UI.setFreezingHit(0); session.run.player.burnStacks = 0; UI.setBurnOverlay(0); session.run.player.poisonStacks = 0; UI.setPlayerPoison(0); session.run.player.corruptionStacks = 0; if (session.run.player.corruptionBaseMaxHp) { session.run.player.maxHp = session.run.player.corruptionBaseMaxHp; session.run.player.corruptionBaseMaxHp = 0 } if (session.run.player.corruptionBaseMaxMana) { session.run.player.maxMana = session.run.player.corruptionBaseMaxMana; session.run.player.corruptionBaseMaxMana = 0 } UI.setCorruption(0) }
  if (session.run) { session.run._hourglassSnapshot = null }
  session.tap.throwingKnifeTargeting  = false
  session.tap.rustyNailTargeting      = false
  session.tap.twinBladesTargeting     = false
  if (session.run?.player) session.run.player.navigatorsChartUsed = false
  const resumeSnapshot = !!(session.run?._resumeGridSnapshot)
  // Hunger Stone: costs 2 HP and grants +1 max damage each floor (skip sanctuary)
  if (!resumeSnapshot && session.run && !session.run.atRest && session.run.floor > 1 && session.run.player.inventory.some(e => e?.id === 'hunger-stone')) {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 1
    session.run.player.hp = Math.max(1, session.run.player.hp - 2)
  }
  let gridRestored = false
  if (session.run?._resumeGridSnapshot) {
    const snap = session.run._resumeGridSnapshot
    if (TileEngine.isSanctuarySnapshot(snap)) {
      session.run.atRest = true
    }
    if (snap?.length && snap[0]?.length) {
      session.run.floorGridSizes ??= {}
      session.run.floorGridSizes[session.run.floor] = {
        cols: snap[0].length,
        rows: snap.length,
      }
    }
    gridRestored = TileEngine.importGridFromSnapshot(snap, session.run.floor, {
      rest: session.run.atRest,
      resume: true,
      ropeUsedThisSanctuary: !!session.run._ropeUsedThisSanctuary,
    })
    session.run._resumeGridSnapshot = null
    ctx.syncWarBannerCoordsFromGrid()
  }
  if (!gridRestored) {
    const size = CONFIG.ensureFloorGridSize(session.run.floor, session.run, { rest: session.run.atRest })
    TileEngine.generateGrid(session.run.floor, {
      rest: session.run.atRest,
      cols: size.cols,
      rows: size.rows,
    })
    if (session.run) {
      session.run.treasureGoblin = null
      session.run.floorStartRow = null
      session.run.floorStartCol = null
    }
  }
  if (!session.run.atRest) {
    TileEngine.ensureExitConnectivityFromGrid(session.run.floor)
  }
  TileEngine.renderGrid(UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (gridRestored) EnemyLeaders.recomputeLeaderAuras(TileEngine.getGrid())
  if (session.run.turret) ctx.syncTurretVisual()
  session.run.minions = []

  // ── Floor modifier ─────────────────────────────────────────
  if (session.run.floorModifier?.clear) {
    try { session.run.floorModifier.clear(session.run, TileEngine.getGrid()) } catch (_) {}
  }
  if (!gridRestored && isVoidPreBossSanctuaryFloor(session.run, session.run.floor)) {
    session.run.atRest = true
  }

  if (!gridRestored) {
    const isBoss = isBossFloorForRun(session.run, session.run.floor)
    session.run.floorModifier = isVoidTrialRun(session.run)
      ? null
      : (pickModifier(session.run.floor, session.run.atRest, isBoss) ?? null)
    if (session.run.floorModifier) {
      try { session.run.floorModifier.apply(session.run, TileEngine.getGrid()) } catch (_) {}
      UI.setFloorModifier(session.run.floorModifier)
    } else {
      UI.clearFloorModifier()
    }
  } else {
    // Resumed session.run — re-apply The Hunt marks (visual only, tiles already exist)
    if (session.run.floorModifier?.id === 'the-hunt') {
      const grid = TileEngine.getGrid()
      for (const row of grid) {
        for (const t of row) {
          if (t.enemyData && !t.revealed && !t.enemyData._slain && t.element) {
            t.element.classList.add('hunt-marked')
          }
        }
      }
    }
    if (session.run.floorModifier) UI.setFloorModifier(session.run.floorModifier)
    else UI.clearFloorModifier()
  }
  if (session.run._resumeEventTile) {
    session.run.eventTile = TileEngine.getTile(session.run._resumeEventTile.row, session.run._resumeEventTile.col)
    session.run._resumeEventTile = null
  }
  if (gridRestored) {
    TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
    ctx.syncGridDomClassesFromModel()
    ctx.restoreTreasureGoblinAfterResume()
    // Skip one treasure tick so resume-time poison/harass tick does not consume a goblin turn
    session.run._resumeTreasureGoblinTickSkip = true
    ctx.tickPoisonArrowDotOnGlobalTurn()
  } else {
    ctx.revealStartTile()
  }
  // First-session.run intro: show once on floor 1 (skipped during bot runs)
  const _isBot = new URLSearchParams(location.search).has('balanceBot')
    || new URLSearchParams(location.search).has('testBotOngoing')
    || new URLSearchParams(location.search).has('testHarness')
  // Floor modifier modal: shown once per new floor when a modifier is active
  if (!_isBot && !gridRestored && session.run.floorModifier) {
    UI.showFloorModifierModal(session.run.floorModifier, () => {})
  }
  if (!_isBot && session.run.floor === 1 && !(session.save.settings?.firstRunIntroDismissed)) {
    UI.showFirstRunIntro(() => {
      session.save.settings = session.save.settings ?? {}
      session.save.settings.firstRunIntroDismissed = true
      SaveManager.save(session.save).catch(() => {})
      if (!(session.save.settings?.parryChoiceDismissed)) {
        UI.showParryOnboarding((enabled) => {
          session.save.settings.parryEnabled = enabled
          session.save.settings.parryChoiceDismissed = true
          SaveManager.save(session.save).catch(() => {})
        })
      }
    })
  } else if (!_isBot && session.run.floor === 1 && !(session.save.settings?.parryChoiceDismissed)) {
    UI.showParryOnboarding((enabled) => {
      session.save.settings = session.save.settings ?? {}
      session.save.settings.parryEnabled = enabled
      session.save.settings.parryChoiceDismissed = true
      SaveManager.save(session.save).catch(() => {})
    })
  }
  // Cracked Compass: mark the exit like spyglass (skip rest floors)
  if (!session.run.atRest && session.run.player.inventory.some(e => e?.id === 'cracked-compass')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (t.type === 'exit' && !t.revealed && !t.echoHintCategory) {
          ctx.markTileTypeHint(t, {
            float: !gridRestored,
            message: gridRestored
              ? null
              : '🧭 The bent needle trembles — the way out is marked.',
          })
          if (!gridRestored) EventBus.emit('audio:play', { sfx: 'menu' })
          break
        }
      }
    }
  }

  // Sub-floor spawn: always on floor 1, otherwise 5% chance on non-boss, non-sanctuary floors
  if ((session.save.settings.subLevelsEnabled ?? true) && !gridRestored && !session.run.atRest && !isBossFloorForRun(session.run, session.run.floor)
      && (session.run.floor === 1 || Math.random() < CONFIG.subFloor.spawnChance)) {
    ctx.spawnSubFloorEntry()
  }

  // War banner: always on floor 1; otherwise 20% per non-boss dungeon floor — buffs all enemies until cleared
  if (!gridRestored && !session.run.atRest && !isBossFloorForRun(session.run, session.run.floor)
      && (session.run.floor === 1 || Math.random() < CONFIG.warBanner.spawnChance)) {
    ctx.spawnWarBannerEntry()
  } else if (!gridRestored && !session.run.atRest) {
    session.run.warBanner = null
  }

  const specialSpawnUsed = new Set()
  // Treasure Goblin — 5% per non-boss dungeon floor; pre-revealed with escape timer (path from entry + 2)
  if (!gridRestored && !session.run.atRest && !isBossFloorForRun(session.run, session.run.floor)
      && Math.random() < (CONFIG.treasureGoblin?.spawnChance ?? 0.05)) {
    ctx.spawnTreasureGoblin(specialSpawnUsed)
  }
  // Archer Goblin: from minSpawnFloor onward, CONFIG.archerGoblin.spawnChance per dungeon floor.
  // Immediately revealed; starts firing arrows each turn until killed.
  const archerMinFloor = CONFIG.archerGoblin?.minSpawnFloor ?? 6
  if (!gridRestored && !session.run.atRest && !isBossFloorForRun(session.run, session.run.floor)
      && session.run.floor >= archerMinFloor
      && Math.random() < (CONFIG.archerGoblin?.spawnChance ?? 0.15)) {
    ctx.spawnArcherGoblin(specialSpawnUsed)
  }

  // Dungeon Mouse: CONFIG.mouse.spawnChance per non-boss dungeon floor (no floor-1 guarantee).
  // Pre-revealed; each time the player flips a tile, 50% to unflip a random revealed empty tile.
  if (!gridRestored && !session.run.atRest && !isBossFloorForRun(session.run, session.run.floor)
      && Math.random() < (CONFIG.mouse?.spawnChance ?? 0.20)) {
    ctx.spawnMouse(specialSpawnUsed)
    ctx.maybeMouseIntro()
  }

  // Forsaken Idol: reveal all unrevealed enemy tiles from floor start
  if (!gridRestored && !session.run.atRest && session.run.player.inventory.some(e => e?.id === 'forsaken-idol')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && isFoeTileType(t.type)) {
          t.revealed = true
          session.run.tilesRevealed++
          TileEngine.markReachable(t.row, t.col, ctx.markReachableUi)
          if (t.element) TileEngine.flipTile(t, UI)
          if (t.enemyData) TileEngine.rollEnemyHitDamage(t.enemyData)
          ctx.resolveEffect(t)
        }
      }
    }
  }
  // Paladin Kill Echo: mark closest hidden enemy/enemies to floor start; quota resets each floor
  if (!gridRestored && !session.run.atRest && ctx.charKey() === 'warrior') {
    session.run.killEchoQuota = 1
    ctx.paladinKillEchoApplyMarks(session.run.floorStartRow, session.run.floorStartCol, session.run.killEchoQuota)
  }
  // Mending Moss / Living Bramble: restore 3 HP at start of each new floor (skip floor 1 and sanctuary)
  if (!gridRestored && !session.run.atRest && session.run.floor > 1 && (session.run.player.inventory.some(e => e?.id === 'mending-moss') || session.run.player.inventory.some(e => e?.id === 'living-bramble'))) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 3)
  }
  // Predator's Edge: +1 max damage per floor, costs 2 HP (same as Hunger Stone)
  if (!resumeSnapshot && session.run && !session.run.atRest && session.run.floor > 1 && session.run.player.inventory.some(e => e?.id === 'predators-edge')) {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 1
    session.run.player.hp = Math.max(1, session.run.player.hp - 2)
  }
  // Twin Fates: coin flip each floor (skip floor 1 and sanctuary)
  if (!gridRestored && !session.run.atRest && session.run.floor > 1 && session.run.player.inventory.some(e => e?.id === 'twin-fates')) {
    if (Math.random() < 0.5) {
      session.run.player.maxHp += 4
      session.run.player.hp    += 4
    } else {
      session.run.player.maxHp = Math.max(1, session.run.player.maxHp - 2)
      session.run.player.hp    = Math.min(session.run.player.hp, session.run.player.maxHp)
    }
  }
  // Abyssal Lens: hint all tile categories on the back of unrevealed tiles
  if (!gridRestored && !session.run.atRest && session.run.player.inventory.some(e => e?.id === 'abyssal-lens')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && t.element) {
          const cat = ctx.echoCharmCategoryForTileType(t.type)
          t.echoHintCategory = cat
          t.element.classList.add('echo-hint')
          t.element.dataset.echoHint = cat
        }
      }
    }
  }

  GameState.set(States.FLOOR_EXPLORE)
  if (session.run.atRest && isVoidTrialRun(session.run) && !session.run._voidSanctuaryPearlRolled) {
    session.run._voidSanctuaryPearlOffer =
      MetaProgression.isVoidUnlocked(session.save) &&
      Math.random() < (CONFIG.void?.merchantPearlChance ?? 0.01)
    session.run._voidSanctuaryPearlRolled = true
  }

  UI.updateFloor(session.run.floor, { rest: session.run.atRest, isVoidTrial: !!session.run.isVoidTrial })
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateGold(session.run.player.gold)
  UI.updateScrap(session.save?.scrap ?? 0)
  UI.updateArmor(session.run.player.armor ?? 0)
  UI.updateGoldenKeys(session.run.player.goldenKeys ?? 0)
  ctx.syncMagicChestKeyGlow()
  UI.setFreezingHit(session.run.player.freezingHitStacks ?? 0)
  UI.setBurnOverlay(session.run.player.burnStacks ?? 0)
  UI.setPlayerPoison(session.run.player.poisonStacks ?? 0)
  UI.setCorruption(session.run.player.corruptionStacks ?? 0)
  UI.updateXP(session.run.player.xp, ctx.xpNeeded())
  {
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setHudCharacter(ctx.charKey())
  UI.renderVoidCorruptionPanel(session.run)
  if (isVoidTrialRun(session.run) && !session.run.atRest) {
    beginVoidCorruptionFlow(ctx)
  }
  // Slot A — actives appear only after the player picks them at level-up (gated by meta unlock + session.run unlock)
  if (ctx.charKey() === 'ranger') {
    ctx.refreshRangerActiveHud()
  } else if (ctx.charKey() === 'engineer') {
    ctx.refreshEngineerHud()
  } else if (ctx.charKey() === 'mage') {
    ctx.refreshMageHud()
  } else if (ctx.charKey() === 'vampire') {
    ctx.refreshVampireHud()
  } else if (ctx.charKey() === 'necromancer') {
    ctx.refreshNecroActiveHud()
  } else {
    UI.setSlamBtn(ctx.isActiveUnlocked('slam', 'warrior'), WARRIOR_UPGRADES.slam.manaCost)
    UI.setArrowBarrageBtn(false)
    UI.setPoisonArrowShotBtn(false)
    UI.setDivineLightBtn(ctx.isActiveUnlocked('divine-light', 'warrior'), WARRIOR_UPGRADES['divine-light'].manaCost)
  }
  // Blinding Light — warrior only, slot B (ranger uses B for Poison Arrow, C for Triple Volley)
  if (ctx.charKey() === 'warrior') {
    UI.setBlindingLightBtn(ctx.isActiveUnlocked('blinding-light', 'warrior'), WARRIOR_UPGRADES['blinding-light'].manaCost)
  }
  // Show spell button always — player can target any enemy at any time
  const effectiveCost = ctx.previewSpellManaCostForUi()
  UI.showActionPanel(effectiveCost, session.run.player.mana >= effectiveCost)
  // Start tile is already revealed — player can flee; only close dialog if it was open.
  document.getElementById('retreat-confirm')?.classList.add('hidden')
  UI.showRetreat()
  UI.hideRunSummary()
  UI.hideEventOverlays()

  const isBoss = isBossFloorForRun(session.run, session.run.floor)
  const hasWarBanner = session.run.warBanner?.active && !session.run.atRest
  UI.setMessage(session.run.atRest
    ? 'A quiet sanctuary. The well restores you; the rope lets you bank gold; the stairs go deeper.'
    : isBoss
      ? `⚠️ Floor ${session.run.floor} — Boss floor! Tread carefully.`
      : hasWarBanner
        ? '🚩 A war banner flies over this floor — enemies hit harder until you tear it down!'
      : 'Tap a tile to reveal what lurks beneath...')

  if (session.run.telemetry && !session.run.telemetry.runStartSnapshotDone) {
    ctx.appendLevelSnapshot('runStart')
    session.run.telemetry.runStartSnapshotDone = true
  }
  ctx.appendFloorSnapshot('floorEnter')

  Logger.debug(`[GameController] Floor ${session.run.floor} started`)
  TileEngine.refreshAllThreatClueDisplays()
  UI.refreshSkipFloorButton(session.save)
  if (session.run._resumeCombatEngagement) {
    const raw = session.run._resumeCombatEngagement
    const pos = Array.isArray(raw) ? raw[0] : raw
    if (pos && typeof pos.row === 'number' && typeof pos.col === 'number') {
      const t = TileEngine.getTile(pos.row, pos.col)
      if (t?.enemyData && !t.enemyData._slain) {
        session.tap.combatEngagementTile = { row: pos.row, col: pos.col }
        syncCombatEngagementDom()
      }
    }
    session.run._resumeCombatEngagement = null
  }
  ctx.saveActiveRun()
}

function _beginFloorTransition(ctx, mid, floorNumber) {
  if (session.run._exitTransitionPending) return false
  session.run._exitTransitionPending = true
  UI.runFloorTransition(3000, () => {
    if (!session.run) return
    GameState.set(States.BOOT)
    mid()
  }, floorNumber)
  return true
}

export function handleExit(ctx) {
  if (session.run._exitTransitionPending) return
  if (session.run.atRest) {
    session.run.atRest = false
    session.run.floorKeyAwarded = false
    session.run.floor++
    Logger.info(`[GameController] Floor transition → ${session.run.floor}`, {
      hp: session.run.player.hp, maxHp: session.run.player.maxHp,
      mana: session.run.player.mana, gold: session.run.player.gold,
      inventory: session.run.player.inventory.map(e => e?.id ?? null),
    })
    EventBus.emit('audio:crossfade', { track: ctx.runMusicTrack(), duration: 1500 })
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage(`🚪 Descending to floor ${session.run.floor}...`)
    EventBus.emit('run:floorAdvance', { newFloor: session.run.floor })
    _beginFloorTransition(ctx, () => startFloor(ctx), session.run.floor)
    return
  }
  if (session.run.bossFloorExitPending) {
    session.run.bossFloorExitPending = false
    session.run.atRest = true
    EventBus.emit('audio:crossfade', { track: 'sanctuary', duration: 1500 })
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage('Stone gives way to still air — a sanctuary between the depths.')
    EventBus.emit('run:floorAdvance', { newFloor: session.run.floor })
    _beginFloorTransition(ctx, () => startFloor(ctx), null)
    return
  }
  nextFloor(ctx)
}

export function confirmRope(ctx, tile) {
  if (tile.type !== 'rope' || session.run._ropeUsedThisSanctuary) return
  UI.showRopeModal(
    (pct) => {
      session.run._ropeUsedThisSanctuary = true
      tile.ropeResolved = true
      tile.element?.classList.remove('rope-pending')
      const p = session.run.player
      const banked = Math.floor(p.gold * pct)
      p.safeGold = (p.safeGold ?? 0) + banked
      p.gold     = Math.max(0, p.gold - banked)
      UI.updateGold(p.gold)
      UI.spawnFloat(tile.element, `-${banked}🪙`, 'damage')
      UI.spawnFloat(tile.element, `🔒 +${banked} banked`, 'gold')
      UI.setMessage(`🧵 You send ${banked} gold to the surface. It's yours even if you fall.`)
      EventBus.emit('player:goldChange', { amount: -banked, newTotal: p.gold })
      EventBus.emit('audio:play', { sfx: 'gold' })
      SaveManager.save(session.save)
    },
    () => {
      UI.setMessage('You leave the vault for now. Tap again to bank your gold.')
    }
  )
}

export function nextFloor(ctx) {
  if (session.run._exitTransitionPending) return
  if (isVoidTrialRun(session.run) && session.run.floor >= voidMaxFloor(session.run)) return
  // Clear modifier before advancing — Glass Cannon/Silence stat reversals happen here
  if (session.run.floorModifier?.clear) {
    try { session.run.floorModifier.clear(session.run, TileEngine.getGrid()) } catch (_) {}
  }
  session.run.floorModifier = null
  UI.clearFloorModifier()
  session.run._ropeUsedThisSanctuary = false
  session.run.floorKeyAwarded = false
  session.run.floor++
  EventBus.emit('audio:crossfade', { track: ctx.runMusicTrack(), duration: 1500 })
  EventBus.emit('audio:play', { sfx: 'footsteps' })
  UI.setMessage(`🚪 Descending to floor ${session.run.floor}...`)
  EventBus.emit('run:floorAdvance', { newFloor: session.run.floor })
  _beginFloorTransition(ctx, () => startFloor(ctx), session.run.floor)
}

export function checkFloorModifierOnReveal(ctx, tile) {
  if (!session.run?.floorModifier) return
  const mod = session.run.floorModifier
  const el  = tile.element

  if (mod.id === 'miasma') {
    session.run._miasmaCounter = (session.run._miasmaCounter ?? 0) + 1
    if (session.run._miasmaCounter % 3 === 0) {
      ctx.takeDamage(1, el, false, null, { deathCause: 'miasma' })
      UI.spawnFloat(el, '☠️ Miasma!', 'damage')
    }
  }

  if (mod.id === 'crumbling-walls' && Math.random() < 0.20) {
    ctx.takeDamage(1, el, false, null, { deathCause: 'crumbling_walls' })
    UI.spawnFloat(el, '🪨 Crumble!', 'damage')
  }

  // Remove hunt-marked class when an enemy tile is revealed
  if (mod.id === 'the-hunt' && tile.enemyData) {
    el?.classList.remove('hunt-marked')
  }
}

