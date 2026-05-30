import { CONFIG } from '../config.js'
import GameState, { States } from './GameState.js'
import EventBus from './EventBus.js'
import Logger from './Logger.js'
import TileEngine from '../systems/TileEngine.js'
import MetaProgression from '../systems/MetaProgression.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import * as Haptics from '../systems/Haptics.js'
import { session, initSession, charKey } from './RunContext.js'
import { RANGER_BASE } from '../data/ranger.js'
import { ENGINEER_BASE, ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { MAGE_BASE } from '../data/mage.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { NECROMANCER_BASE } from '../data/necromancer.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { createInitialTelemetry } from '../balance/runTelemetry.js'

export function buildRunState(ctx) {
  const isRanger      = ctx.charKey() === 'ranger'
  const isEngineer    = ctx.charKey() === 'engineer'
  const isMage        = ctx.charKey() === 'mage'
  const isVampire     = ctx.charKey() === 'vampire'
  const isNecromancer = ctx.charKey() === 'necromancer'
  const baseHP     = isMage ? MAGE_BASE.hp : isRanger ? RANGER_BASE.hp : isEngineer ? ENGINEER_BASE.hp : isVampire ? VAMPIRE_BASE.hp : isNecromancer ? NECROMANCER_BASE.hp : CONFIG.player.baseHP
  const baseMana   = isMage ? MAGE_BASE.mana : isRanger ? RANGER_BASE.mana : isEngineer ? ENGINEER_BASE.mana : isVampire ? VAMPIRE_BASE.mana : isNecromancer ? NECROMANCER_BASE.mana : CONFIG.player.baseMana

  const p = {
    hp:      baseHP,
    maxHp:   baseHP,
    mana:    baseMana,
    maxMana: baseMana,
    gold:    CONFIG.player.startGold,
    xp:      0,
    level:   1,
    safeGold: 0,
    abilities:          isRanger ? ['trapfinder'] : [],
    /** Active-ability IDs unlocked this run via level-up picks (e.g. 'slam', 'ricochet', 'tesla-tower'). */
    unlockedActives:    isEngineer ? ['construct-turret'] : [],
    /** Engineer: highest turret level the player can build/upgrade to (Mastery I → 2, Mastery II → 3). */
    turretMaxLevel:     1,
    /** Engineer passive — Seismic Ping ring radius (Chebyshev steps). L1 = 8 neighbors; masteries may raise this later. */
    seismicPingLevel:   isEngineer ? ENGINEER_SEISMIC_PING.defaultLevel : undefined,
    damageBonus:        0,
    damageReduction:    0,
    spellCostReduction: 0,
    onKillHeal:         0,
    fleeMaxCost:        null,
    undeadBonus:        false,
    beastBonus:         false,
    trapReduction:      0,
    /** Ranger: starts at 1 from passive; further ranks from level-ups. */
    trapfinderStacks:   isRanger ? 1 : 0,
    /** Warrior: Slam Mastery picks (integer stacks; mult = (baseTenths + stacks) / 10). */
    slamMasteryStacks: 0,
    /** Warrior: Blinding Light mastery — +0.1 to stun-turn mult per pick (same tenths pattern as Slam). */
    blindingLightMasteryStacks: 0,
    /** Ranger: level-up picks for Ricochet / Triple Volley / Poison — +10% damage per stack for that active. */
    rangerActiveStacks: isRanger
      ? { ricochet: 0, 'arrow-barrage': 0, 'poison-arrow-shot': 0 }
      : undefined,
    /** Mage: level-up picks for Chain Lightning / Telekinetic Throw / Mana Shield / Life Tap masteries. */
    mageActiveStacks: isMage
      ? { 'chain-lightning': 0, 'telekinetic-throw': 0, 'mana-shield': 0, 'life-tap': 0 }
      : undefined,
    /** Warrior: level-up picks for Divine Light heal tier. */
    warriorActiveStacks: ctx.charKey() === 'warrior'
      ? { 'divine-light': 0 }
      : undefined,
    /** Vampire: level-up picks for Mist Form duration / Blood Pact mana. */
    vampireActiveStacks: isVampire
      ? { 'mist-form': 0, 'blood-pact': 0 }
      : undefined,
    /** Engineer: level-up picks for Tesla Tower radius/arc. */
    engineerActiveStacks: isEngineer
      ? { 'tesla-tower': 0 }
      : undefined,
    /** Necromancer: Strengthen Minion mastery level (HP gain + damage bonus). */
    strengthenMinionStacks: isNecromancer ? 0 : undefined,
    /** Engineer: turret heal-on-kill (Turret Mastery III in-run pick). */
    turretKillHeal: false,
    /** Mage: Mana Shield toggle state. */
    manaShieldActive: false,
    /** Mage: Life Tap toggle state. */
    lifeTapActive: false,
    retreatPercent:     CONFIG.retreat.goldKeepPercent,
    extraAbilityChoice: false,
    damageTakenMult:    1,
    isRanger,
    isEngineer,
    isMage,
    isVampire,
    isNecromancer,
    minionMasteryLevel: 1,
    inventory:          [],   // [{ id, qty }]
    goldenKeys:         0,
    meleeHitCount:      0,    // Stormcaller's Fist tracker
    deathmaskPending:   false, // Deathmask of the Fallen: next reveal = instant kill
    trapImmune:         false, // Rope Coil: skip next trap
    regenTurns:         0,    // Bandage Roll HOT turns remaining
    regenPerTurn:       0,    // Bandage Roll HOT amount per turn
    shieldShard:        false, // Shield Shard: absorb next hit
    whettsoneHits:      0,    // Whetstone: bonus hits remaining
    eagleEyeFreeFlip:   false, // Eagle Eye: next flip ignores adjacency
    soulboundBonus:     0,    // Soulbound Blade: accumulated kill bonus (float)
    resurrectionUsed:   false, // Resurrection Stone: one-time death prevention
    burnStacks:         0,    // Fire Goblin: burning DoT stacks (max 3)
    poisonStacks:       0,    // Enemy poison: player poison stacks (max 5)
    corruptionStacks:      0, // Infected Goblin: corruption stacks (max 5)
    corruptionBaseMaxHp:   0, // Uncorrupted maxHp — restored when stacks clear
    corruptionBaseMaxMana: 0, // Uncorrupted maxMana — restored when stacks clear
    // Gear system
    armor:        0,
    negation:     0,
    damageBonus:  0,
    damageReduction: 0,
    equippedGear: { weapon: null, breastplate: null, offhand: null },
    safePocketTrinket: null,
  }

  MetaProgression.applyToPlayer(p, session.save)
  p.baseMaxHp   = p.maxHp    // pre-gear base — used for maxHpPct calculations
  p.baseMaxMana = p.maxMana  // pre-gear base — used for maxManaPct calculations
  ctx.applyEquippedGear(p)
  ctx.applySafePocket(p)

  return {
    player:           p,
    floor:            1,
    tilesRevealed:    0,
    activeCombatTile: null,
    eventTile:        null,
    /** Between boss and next dungeon — 3×3 sanctuary */
    atRest:           false,
    /** After boss dies, stairs appear; first tap goes to sanctuary */
    bossFloorExitPending: false,
    /** Chronological level-up picks this run: { level, abilityId, name, icon } */
    levelUpLog:       [],
    floorKeyAwarded:  false,
    /** @type {{ row: number, col: number, level: number, mode: 'ballistic'|'tesla', hp: number, maxHp: number } | null} */
    turret:           null,
    /** @type {Array<{ row: number, col: number, hp: number, maxHp: number, dmg: number, id: number }>} */
    minions:          [],
    /** Balance / bot: per-run stats (see js/balance/runTelemetry.js) */
    telemetry:        createInitialTelemetry(),
    /** While active: { row, col, active, mult } — buffs all enemies until banner tile is cleared */
    warBanner:        null,
    /** Entry tile for this floor (shortest-path timer for Treasure Goblin) */
    floorStartRow:    null,
    floorStartCol:    null,
    /** While active: { row, col, turnsLeft } — countdown until goblin escapes */
    treasureGoblin:   null,
    /** Paladin Kill Echo: how many hidden enemies may be marked at once (1 → 2 → 3 this floor). */
    killEchoQuota:    1,
  }
}


// ── Init ─────────────────────────────────────────────────────

export function init(ctx, saveData) {
  initSession(saveData)
  Haptics.bindHaptics({
    getSave: () => session.save,
    getRun: () => session.run,
    charKey: ctx.charKey,
    computeEffectiveDamageTaken: ctx.computeEffectiveDamageTaken,
  })
}

// ── New game ─────────────────────────────────────────────────

export function newGame(ctx) {
  UI.hideRunSummary()
  clearActiveRun(ctx)
  session.run = buildRunState(ctx)
  TileEngine.setDiagonalMovement((session.save.selectedCharacter ?? 'warrior') === 'mage')
  UI.hideMainMenu()
  EventBus.emit('audio:crossfade', { track: 'dungeon', duration: 1500 })
  ctx.startFloor()
}

// ── Run persistence ──────────────────────────────────────────

function serializeGridSnapshot(ctx) {
  const grid = TileEngine.getGrid()
  if (!grid?.length) return null
  return grid.map(row =>
    row.map(t => ({
      type: t.type,
      revealed: t.revealed,
      locked: t.locked,
      reachable: t.reachable,
      enemyData: t.enemyData ? structuredClone(t.enemyData) : null,
      itemData: t.itemData ? structuredClone(t.itemData) : null,
      chestLoot: t.chestLoot ? structuredClone(t.chestLoot) : null,
      chestReady: t.chestReady,
      chestLooted: t.chestLooted,
      magicChestReady: t.magicChestReady,
      pendingLoot: t.pendingLoot ? structuredClone(t.pendingLoot) : null,
      exitResolved: t.exitResolved,
      eventResolved: t.eventResolved,
      ropeResolved: t.ropeResolved,
      forgeUsed: t.forgeUsed,
      echoHintCategory: t.echoHintCategory ?? null,
      darkEyesHint: !!t.darkEyesHint,
      bannerReady: t.bannerReady ?? null,
      warBannerFlying: t.warBannerFlying ?? null,
      killEchoMarked: !!(t.killEchoMarked || t.senseEvilMarked),
      armorValue: t.armorValue ?? null,
    })),
  )
}

export function saveActiveRun(ctx) {
  if (!session.run || !session.save) return
  session.save.activeRun = {
    player:          structuredClone(session.run.player),
    floor:           session.run.floor,
    atRest:          session.run.atRest,
    levelUpLog:      session.run.levelUpLog.slice(),
    floorKeyAwarded: !!session.run.floorKeyAwarded,
    turret:          session.run.turret ? structuredClone(session.run.turret) : null,
    minions:         session.run.minions ? structuredClone(session.run.minions) : [],
    telemetry:       session.run.telemetry ? structuredClone(session.run.telemetry) : undefined,
    tilesRevealed:   session.run.tilesRevealed,
    bossFloorExitPending: !!session.run.bossFloorExitPending,
    eventTile:       session.run.eventTile ? { row: session.run.eventTile.row, col: session.run.eventTile.col } : null,
    gridSnapshot:    serializeGridSnapshot(ctx),
    combatEngagement: ctx.getCombatEngagementTile() ? { ...ctx.getCombatEngagementTile() } : null,
    warBanner:       session.run.warBanner ? structuredClone(session.run.warBanner) : null,
    treasureGoblin:  session.run.treasureGoblin ? structuredClone(session.run.treasureGoblin) : null,
    floorStartRow:   session.run.floorStartRow ?? null,
    floorStartCol:   session.run.floorStartCol ?? null,
    killEchoQuota:   session.run.killEchoQuota ?? 1,
  }
  SaveManager.save(session.save).catch(() => {})
}

export function clearActiveRun(ctx) {
  UI.hideSubFloor()
  if (!session.save?.activeRun) return
  delete session.save.activeRun
  SaveManager.save(session.save).catch(() => {})
}

/** In-run background music key for AudioManager (sanctuary rest vs dungeon). */
function runMusicTrack(ctx) {
  if (!session.run) return 'dungeon'
  if (session.run.atRest) return 'sanctuary'
  return 'dungeon'
}

export function resumeRun(ctx) {
  const saved = session.save?.activeRun
  if (!saved) return
  session.run = {
    player:               saved.player,
    floor:                saved.floor,
    atRest:               saved.atRest ?? false,
    levelUpLog:           saved.levelUpLog ?? [],
    floorKeyAwarded:      saved.floorKeyAwarded ?? false,
    tilesRevealed:        saved.tilesRevealed ?? 0,
    activeCombatTile:     null,
    eventTile:            null,
    bossFloorExitPending: !!saved.bossFloorExitPending,
    turret:               saved.turret ?? null,
    minions:              saved.minions ?? [],
    _resumeGridSnapshot:  saved.gridSnapshot ?? null,
    _resumeEventTile:     saved.eventTile ?? null,
    _resumeCombatEngagement: saved.combatEngagement ?? null,
    telemetry:            (() => {
      if (!saved.telemetry) return createInitialTelemetry()
      const t = structuredClone(saved.telemetry)
      if (t.runStartSnapshotDone == null) t.runStartSnapshotDone = true
      if (!t.damageByFloor) t.damageByFloor = {}
      if (!Array.isArray(t.floorSnapshots)) t.floorSnapshots = []
      return t
    })(),
    warBanner: saved.warBanner ?? null,
    treasureGoblin: saved.treasureGoblin ?? null,
    floorStartRow: saved.floorStartRow ?? null,
    floorStartCol: saved.floorStartCol ?? null,
    killEchoQuota: saved.killEchoQuota ?? 1,
  }
  const ch = session.save.selectedCharacter ?? 'warrior'
  if (ch === 'engineer' && (session.run.player.seismicPingLevel == null || session.run.player.seismicPingLevel < 1)) {
    session.run.player.seismicPingLevel = ENGINEER_SEISMIC_PING.defaultLevel
  }
  session.run.player.isEngineer    = ch === 'engineer'
  session.run.player.isRanger      = ch === 'ranger'
  session.run.player.isMage        = ch === 'mage'
  session.run.player.isVampire     = ch === 'vampire'
  session.run.player.isNecromancer = ch === 'necromancer'
  MetaProgression.applyShopCartToPlayer(session.run.player, session.save)
  TileEngine.setDiagonalMovement(ch === 'mage')
  UI.hideMainMenu()
  EventBus.emit('audio:crossfade', { track: runMusicTrack(ctx), duration: 1500 })
  ctx.startFloor()
}

export function abandonRun(ctx) {
  session.run = null
  clearActiveRun(ctx)
  returnToMenu(ctx)
}


export function returnToMenu(ctx, autoSave = false) {
  clearActiveRun(ctx)
  session.run = null
  if (!GameState.transition(States.MENU)) GameState.set(States.MENU)
  if (autoSave) SaveManager.save(session.save)
  const char = ctx.charKey()
  const xp   = char === 'ranger'
    ? session.save.ranger.totalXP
    : char === 'engineer'
      ? session.save.engineer.totalXP
      : char === 'mage'
        ? (session.save.mage?.totalXP ?? 0)
        : char === 'vampire'
          ? (session.save.vampire?.totalXP ?? 0)
          : char === 'necromancer'
            ? (session.save.necromancer?.totalXP ?? 0)
            : session.save.warrior.totalXP
  UI.updateMenuStats(session.save.persistentGold, xp, char, session.save)
  UI.setActiveDifficulty(session.save.settings.difficulty)
  UI.showMainMenu()
  UI.refreshSkipFloorButton(session.save)
  EventBus.emit('audio:crossfade', { track: 'menu', duration: 1500 })
}



export function doRetreat(ctx, reason = 'player') {
  if (!session.run) return

  if (GameState.is(States.NPC_INTERACT) && session.run.eventTile) {
    ctx.closeEventSession(session.run.eventTile)
  }

  const hpAtRetreat = session.run?.player?.hp ?? null
  const goldBeforeRetreat = session.run?.player?.gold ?? null
  const pct      = session.save.settings?.childMode ? 1.0 : (session.run.player.retreatPercent ?? CONFIG.retreat.goldKeepPercent)
  const keptGold = Math.floor(session.run.player.gold * pct)
  session.run.player.gold = keptGold
  UI.updateGold(keptGold)
  UI.hideRetreat()
  UI.hideActionPanel()
  UI.hideEventOverlays()
  UI.setMessage(`You flee the dungeon, clutching ${keptGold} gold.`)
  EventBus.emit('run:retreat', { goldBanked: keptGold })

  const stats = runStats(ctx)
  finalizeRunTelemetry(ctx, 'retreat', {
    killerEnemyId: null,
    retreatReason: reason,
    hpAtRetreat,
    goldBeforeRetreat,
  })
  const { xpEarned, xpRetained, xpLost, goldBanked } = MetaProgression.endRun(session.save, stats, 'retreat')

  if (session.run?.player?.equippedGear) session.save.equippedGear = structuredClone(session.run.player.equippedGear)
  session.save.safePocketTrinket = session.run?.player?.safePocketTrinket
    ? structuredClone(session.run.player.safePocketTrinket)
    : null
  // End run immediately
  clearActiveRun(ctx)
  session.run = null
  GameState.set(States.BETWEEN_RUNS)

  setTimeout(() => {
    UI.showRunSummary('retreat', { ...stats, xpEarned, xpRetained, xpLost, goldBanked })
    wireRunSummaryBtn(ctx)
  }, 1200)
}



export function die(ctx, killerData = null, opts = {}) {
  const explicitCause = opts.deathCause
  let resolved = killerData
  let killerInferred = false
  if (!resolved?.enemyId && session.run?.activeCombatTile?.enemyData) {
    const e = session.run.activeCombatTile.enemyData
    if (!e._slain) {
      resolved = e
      killerInferred = true
    }
  }

  Logger.info('[GameController] Player died', {
    floor: session.run?.floor,
    hero: session.run?.heroId,
    hp: session.run?.player?.hp,
    cause: explicitCause ?? resolved?.enemyId ?? 'unknown',
    killer: resolved?.label ?? null,
    isBoss: !!(resolved?.isBoss),
    inventory: session.run?.player?.inventory?.map(e => e.id) ?? [],
  })

  ctx.resetCombatOnDeath()
  const deathExtras = {
    killerEnemyId: resolved?.enemyId ?? null,
    killerLabel:   resolved?.label ?? null,
    killerIsBoss:  !!(resolved?.isBoss),
    hpAtDeath:     session.run?.player?.hp ?? 0,
  }
  if (explicitCause === 'witching_stone' && resolved?.enemyId) {
    // HP death from Witching Stone during combat — attribute killer, not the item.
  } else if (explicitCause) {
    deathExtras.deathCause = explicitCause
  } else if (!resolved?.enemyId) {
    deathExtras.deathCause = 'unknown'
  }
  if (killerInferred && !killerData?.enemyId) deathExtras.killerInferred = true
  finalizeRunTelemetry(ctx, 'death', deathExtras)
  if (session.run?.player?.equippedGear) session.save.equippedGear = structuredClone(session.run.player.equippedGear)
  session.save.safePocketTrinket = session.run?.player?.safePocketTrinket
    ? structuredClone(session.run.player.safePocketTrinket)
    : null
  clearActiveRun(ctx)
  UI.setPortraitAnim('death')
  GameState.transition(States.DEATH)
  UI.hideActionPanel()
  UI.hideRetreat()
  UI.hideEventOverlays()
  UI.clearFloorModifier()
  UI.setMessage('💀 You have perished in the depths...', true)
  EventBus.emit('audio:play', { sfx: 'death' })

  const stats = runStats(ctx)
  const { xpEarned, xpRetained, xpLost, goldBanked } = MetaProgression.endRun(session.save, stats, 'death')
  EventBus.emit('player:death', { runStats: stats })

  // Build killer card data for the summary screen
  const killer = resolved ? buildKillerCard(resolved) : null

  setTimeout(() => {
    UI.showRunSummary('death', { ...stats, xpEarned, xpRetained, xpLost, goldBanked, killer })
    wireRunSummaryBtn(ctx)
  }, 800)
}

export function buildKillerCard(e) {
  const sprites = ENEMY_SPRITES[e.enemyId]
  return {
    name:      e.label,
    emoji:     e.emoji,
    spriteSrc: sprites?.idle ? MONSTER_ICONS_BASE + sprites.idle : null,
    hp:        e.hp,
    dmg:       Array.isArray(e.dmg) ? `${e.dmg[0]}–${e.dmg[1]}` : e.dmg,
    blurb:     e.blurb ?? '',
    type:      e.type ?? '',
    attributes: e.attributes ?? [],
  }
}

export function runStats(ctx) {
  return {
    gold:          session.run.player.gold,
    safeGold:      session.run.player.safeGold,
    level:         session.run.player.level,
    floor:         session.run.floor,
    tilesRevealed: session.run.tilesRevealed,
    character:     ctx.charKey(),
  }
}

function buildRunEndSummary(ctx, outcomeType, extras = {}) {
  const rs = runStats(ctx)
  const tel = session.run.telemetry
  const taken = tel?.totalDamageTaken ?? 0
  const gold = rs.gold ?? 0
  return {
    outcome: outcomeType,
    floor: rs.floor,
    level: rs.level,
    character: rs.character,
    gold,
    tilesRevealed: rs.tilesRevealed,
    totalDamageTaken: taken,
    totalDamageDealtToEnemies: tel?.totalDamageDealtToEnemies ?? 0,
    goldPerHpLost: taken > 0 ? gold / taken : null,
    ...extras,
  }
}

export function finalizeRunTelemetry(ctx, outcomeType, extras = {}) {
  if (!session.run?.telemetry) return
  session.run.telemetry.outcome = {
    type: outcomeType,
    endedAt: Date.now(),
    runStats: runStats(ctx),
    runEndSummary: buildRunEndSummary(ctx, outcomeType, extras),
    ...extras,
  }
  session.lastRunTelemetrySnapshot = {
    telemetry: structuredClone(session.run.telemetry),
    levelUpLog: (session.run.levelUpLog ?? []).slice(),
    runStats: runStats(ctx),
  }
}

export function wireRunSummaryBtn(ctx) {
  const btn = document.getElementById('try-again-btn')
  if (btn) btn.addEventListener('click', () => {
    UI.hideRunSummary()
    returnToMenu(ctx, true)
  }, { once: true })
}

