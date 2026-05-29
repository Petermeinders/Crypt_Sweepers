import { CONFIG }           from '../config.js'
import GameState, { States } from './GameState.js'
import EventBus              from './EventBus.js'
import Logger                from './Logger.js'
import TileEngine            from '../systems/TileEngine.js'
import CombatResolver        from '../systems/CombatResolver.js'
import ProgressionSystem     from '../systems/ProgressionSystem.js'
import MetaProgression       from '../systems/MetaProgression.js'
import SaveManager           from '../save/SaveManager.js'
import UI                    from '../ui/UI.js'
import { RANGER_BASE, RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_BASE, ENGINEER_UPGRADES, ENGINEER_TURRET, ENGINEER_CONSTRUCT_MANA_COST, ENGINEER_MOVE_MANA_COST, ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { MAGE_BASE, MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_BASE, VAMPIRE_DARK_EYES_MAX_TILES, VAMPIRE_UPGRADES } from '../data/vampire.js'
import {
  NECROMANCER_BASE,
  NECROMANCER_MINION,
  RAISE_MINION_COST,
  STRENGTHEN_MINION_COST,
  STRENGTHEN_MINION_HP_GAIN,
  CORPSE_EXPLOSION_COST,
  CORPSE_EXPLOSION_DAMAGE,
  DETONATION_CHAIN_EXTRA_COST,
  NECROMANCER_UPGRADES,
} from '../data/necromancer.js'
import { WARRIOR_UPGRADES }  from '../data/upgrades.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE, TILE_TYPE_ICON_FILES, MAGIC_CHEST_OPEN_GIF, MAGIC_CHEST_GIF_DURATION_MS } from '../data/tileIcons.js'
import { TILE_BLURBS }       from '../data/tileBlurbs.js'
import { ITEMS }             from '../data/items.js'
import { STORY_EVENTS, MERCHANT_ITEMS, rollEventType } from '../data/events.js'
import { pickModifier } from '../systems/FloorModifiers.js'
import Bestiary              from '../systems/Bestiary.js'
import TrinketCodex          from '../systems/TrinketCodex.js'
import { FORGE_RECIPES }     from '../data/combinations.js'
import {
  createInitialTelemetry,
  buildLevelSnapshotRecord,
} from '../balance/runTelemetry.js'
import * as _gearModule from '../data/gear.js'
import {
  COMMON_LOOT_IDS,
  RARE_TRINKET_IDS,
  MAGIC_CHEST_EXCLUSIVE_IDS,
  LEGENDARY_TRINKET_IDS,
  BACKPACK_MAX_SLOTS,
  pickRandom as _pickRandom,
  rollCommonLoot as _rollCommonLootFromTable,
  rollChestLoot as _rollChestLootFromTable,
  rollMagicChestLoot as _rollMagicChestLootFromTable,
} from '../systems/LootTables.js'
import * as Haptics from '../systems/Haptics.js'
import * as CheatController from '../controllers/CheatController.js'
import * as BalanceBotBridge from '../controllers/BalanceBotBridge.js'
import { session, charKey as runCharKey } from './RunContext.js'
import * as GSH from './GameStateHandlers.js'
import * as TapRouter from '../controllers/TileTapRouter.js'
import * as RevealController from '../controllers/TileRevealController.js'
import * as CombatController from '../controllers/CombatController.js'
import * as FloorController from '../controllers/FloorController.js'
import * as GearController from '../controllers/GearController.js'
import * as SafePocketController from '../controllers/SafePocketController.js'
import * as InventoryController from '../controllers/InventoryController.js'
import * as Warrior from '../heroes/warrior.js'
import * as Ranger from '../heroes/ranger.js'
import * as Mage from '../heroes/mage.js'
import * as Engineer from '../heroes/engineer.js'
import * as Necromancer from '../heroes/necromancer.js'
import * as Vampire from '../heroes/vampire.js'
import * as PlayerStats from '../systems/PlayerStats.js'
import * as EnemyMechanics from '../systems/EnemyMechanics.js'
import * as ForgeController from '../controllers/ForgeController.js'
import * as EventTileController from '../controllers/EventTileController.js'
import * as SubFloorController from '../controllers/SubFloorController.js'
import * as TargetingController from '../controllers/TargetingController.js'
import * as SpecialSpawnController from '../controllers/SpecialSpawnController.js'



const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

const _vibrationRequiresSyncUserActivation = Haptics.vibrationRequiresSyncUserActivation
const _hapticFromUserGesture = Haptics.hapticFromUserGesture
const _hapticFromAsyncTask = Haptics.hapticFromAsyncTask
const _firefoxPreFlipHapticsIfNeeded = Haptics.firefoxPreFlipHapticsIfNeeded

function hasItem(id) {
  if (session.run?.player?.safePocketTrinket?.id === id) return true
  return session.run?.player?.inventory?.some(e => e?.id === id) ?? false
}

// ── Player stats + enemy mechanics (extracted) ───────────────
const _statsCtx = () => ({ hasItem })
const _playerOutgoingDamageMult = () => PlayerStats.playerOutgoingDamageMult(_statsCtx())
const _scaleOutgoingDamageToEnemy = (dmg) => PlayerStats.scaleOutgoingDamageToEnemy(_statsCtx(), dmg)
const _xpNeeded = () => PlayerStats.xpNeeded()
const _computeEffectiveDamageTaken = (raw) => PlayerStats.computeEffectiveDamageTaken(raw)
const _playerDamageRange = (p) => PlayerStats.playerDamageRange(p)
const _applyFreezingHit = () => EnemyMechanics.applyFreezingHit()
const _applyCorruption = () => EnemyMechanics.applyCorruption()
const _applyBurnHit = (amt) => EnemyMechanics.applyBurnHit(amt)
const _applyPlayerPoison = (amt) => EnemyMechanics.applyPlayerPoison(amt)
const _findLiveHulk = () => EnemyMechanics.findLiveHulk()
const _applyHulkBuffToTile = (t) => EnemyMechanics.applyHulkBuffToTile(t)
const _removeHulkBuffFromAll = () => EnemyMechanics.removeHulkBuffFromAll()
const _applyHulkBuffToAll = () => EnemyMechanics.applyHulkBuffToAll()

function _forgeCtx() {
  return {
    dropItem,
    canAddToBackpack: _canAddToBackpack,
    addToBackpack: _addToBackpack,
  }
}
const _openForge = (tile) => ForgeController.openForge(_forgeCtx(), tile)

function _eventCtx() {
  return {
    pickRandom: _pickRandom,
    rollCommonLoot: _rollCommonLoot,
    addToBackpack: _addToBackpack,
    canAddToBackpack: _canAddToBackpack,
    dropItem,
    gainGold: _gainGold,
    takeDamage: _takeDamage,
    flushDeferredLevelUpXp: _flushDeferredLevelUpXp,
  }
}
const _openEvent = (tile) => EventTileController.openEvent(_eventCtx(), tile)
const _closeEventSession = (tile) => EventTileController.closeEventSession(_eventCtx(), tile)

function _subFloorCtx() {
  return {
    charKey: _charKey,
    rand: _rand,
    gainGold: _gainGold,
    gainXP: _gainXP,
    takeDamage: _takeDamage,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    playerDamageRange: _playerDamageRange,
    rollChestLoot: _rollChestLoot,
    addToBackpack: _addToBackpack,
    forcePlayChestGif: _forcePlayChestGif,
    saveActiveRun: _saveActiveRun,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    tryConsumeTargetingTap: _tryConsumeTargetingTap,
    isInSubFloor: _isInSubFloor,
    onTileTap,
    onTileHold,
  }
}
const _spawnSubFloorEntry = () => SubFloorController.spawnSubFloorEntry()
const _applyWarBannerBuffToEnemyGrid = (m) => SubFloorController.applyWarBannerBuffToEnemyGrid(m)
const _stripWarBannerBuff = (m) => SubFloorController.stripWarBannerBuff(m)
const _syncWarBannerCoordsFromGrid = () => SubFloorController.syncWarBannerCoordsFromGrid()
const _spawnWarBannerEntry = () => SubFloorController.spawnWarBannerEntry()
const _destroyWarBanner = (t) => SubFloorController.destroyWarBanner(_subFloorCtx(), t)
const _enterSubFloor = (t) => SubFloorController.enterSubFloor(_subFloorCtx(), t)
const _exitSubFloor = () => SubFloorController.exitSubFloor()
const _onSubFloorTileTap = (r, c) => SubFloorController.onSubFloorTileTap(_subFloorCtx(), r, c)
const _onSubFloorTileHold = (r, c) => SubFloorController.onSubFloorTileHold(r, c)
const _recomputeSubFloorEnemyLocks = () => SubFloorController.recomputeSubFloorEnemyLocks()
const _patchActiveTileDom = (r, c) => SubFloorController.patchActiveTileDom(_subFloorCtx(), r, c)
const _sfUnlockAdjacent = (t) => SubFloorController.sfUnlockAdjacent(t)


function _lootRollCtx() {
  return { hasItem, rand: _rand }
}

function _rollCommonLoot() {
  return _rollCommonLootFromTable(_lootRollCtx())
}

function _rollChestLoot() {
  return _rollChestLootFromTable(_lootRollCtx())
}

function _rollMagicChestLoot() {
  return _rollMagicChestLootFromTable(_lootRollCtx())
}

function _tryDemonFlip(demonTile) {
  const chance = demonTile.enemyData?.demonFlipChance ?? 0.10
  if (Math.random() >= chance) return
  const grid = TileEngine.getGrid()
  if (!grid) return
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast')) {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  UI.spawnFloat(demonTile.element, '💎 Awakens ally!', 'xp')
  revealTile(target)
}

/** Still Water Amulet: after 10 turns without spending mana on spells/abilities, next mana cost is 35% less. */
function _stillWaterManaCost(baseCost) {
  const p = session.run?.player
  if (!p?.inventory?.some(e => e?.id === 'still-water-amulet')) return baseCost
  if ((p.turnsWithoutSpell ?? 0) < 10) return baseCost
  return Math.max(1, Math.round(baseCost * 0.65))
}

function _markStillWaterAbilityUsed() {
  if (session.run?.player) session.run.player.turnsWithoutSpell = 0
}

function _previewSpellManaCostForUi() {
  if (!session.run?.player) return Math.max(1, CONFIG.spell.manaCost)
  return _stillWaterManaCost(
    Math.max(1, CONFIG.spell.manaCost - (session.run.player.spellCostReduction ?? 0)) + _tearyExtraCost(),
  )
}

function _serializeHourglassSnapshot() {
  const grid = TileEngine.getGrid()
  const tiles = grid.map(row =>
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
      killEchoMarked: !!(t.killEchoMarked || t.senseEvilMarked),
    })),
  )
  return {
    tilesRevealed: session.run.tilesRevealed,
    player: structuredClone(session.run.player),
    eventTile: session.run.eventTile ? { row: session.run.eventTile.row, col: session.run.eventTile.col } : null,
    bossFloorExitPending: session.run.bossFloorExitPending,
    killEchoQuota: session.run.killEchoQuota ?? 1,
    tiles,
  }
}

function _restoreHourglassSnapshot(snap) {
  if (!snap) return
  const grid = TileEngine.getGrid()
  session.run.player = structuredClone(snap.player)
  session.run.tilesRevealed = snap.tilesRevealed
  session.run.bossFloorExitPending = snap.bossFloorExitPending
  session.run.eventTile = snap.eventTile
    ? TileEngine.getTile(snap.eventTile.row, snap.eventTile.col)
    : null

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const t = grid[r][c]
      const st = snap.tiles[r][c]
      t.type = st.type
      t.revealed = st.revealed
      t.locked = st.locked
      t.reachable = st.reachable
      t.enemyData = st.enemyData ? structuredClone(st.enemyData) : null
      t.itemData = st.itemData ? structuredClone(st.itemData) : null
      t.chestLoot = st.chestLoot ? structuredClone(st.chestLoot) : null
      t.chestReady = st.chestReady
      t.chestLooted = st.chestLooted
      t.magicChestReady = st.magicChestReady
      t.pendingLoot = st.pendingLoot ? structuredClone(st.pendingLoot) : null
      t.exitResolved = st.exitResolved
      t.eventResolved = st.eventResolved
      t.ropeResolved = st.ropeResolved
      t.forgeUsed = st.forgeUsed
      t.echoHintCategory = st.echoHintCategory ?? null
      t.darkEyesHint = !!st.darkEyesHint
      t.killEchoMarked = !!st.killEchoMarked
      delete t.senseEvilMarked
      _normalizeTileFieldsForType(t)
    }
  }

  session.run.killEchoQuota = snap.killEchoQuota ?? 1

  _refreshMainGridDomFromModel()
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateGold(session.run.player.gold)
  UI.updateScrap(session.save?.scrap ?? 0)
  UI.updateGoldenKeys(session.run.player.goldenKeys ?? 0)
  _syncMagicChestKeyGlow()
  UI.setFreezingHit(session.run.player.freezingHitStacks ?? 0)
  UI.setBurnOverlay(session.run.player.burnStacks ?? 0)
  UI.setPlayerPoison(session.run.player.poisonStacks ?? 0)
  UI.setCorruption(session.run.player.corruptionStacks ?? 0)
  UI.updateXP(session.run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  TileEngine.refreshAllThreatClueDisplays()
}

/** Paladin Kill Echo — unrevealed enemy tiles only; Manhattan distance for “closest”. */


/** Clear Kill Echo marks only (⚔️ hints we placed); strips legacy senseEvilMarked too. */






/** Mark up to `pickCount` still-unmarked hidden enemies, closest first to (anchorRow, anchorCol). */


/** Floor start: clear prior floor’s marks, then mark `count` closest to the entrance. */


/** After slaying a marked foe: keep other marks; add new ones until we reach `session.run.killEchoQuota`. */


function _echoCharmCategoryForTileType(type) {
  if (type === 'enemy' || type === 'enemy_fast' || type === 'boss') return '⚔️'
  if (type === 'trap') return '🕸️'
  if (type === 'gold' || type === 'chest' || type === 'heart') return '🪙'
  if (type === 'event' || type === 'checkpoint') return '✨'
  if (type === 'exit') return '🚪'
  if (type === 'empty') return '·'
  if (type === 'blockage' || type === 'hole') return '🕳️'
  if (type === 'war_banner') return '🚩'
  return '❓'
}

function _spyglassHintLabel(type) {
  if (type === 'enemy' || type === 'enemy_fast' || type === 'boss') return '⚔️ Foe'
  if (type === 'trap') return '🕸️ Snare'
  if (type === 'gold' || type === 'chest' || type === 'heart') return '🪙 Loot'
  if (type === 'event' || type === 'checkpoint') return '✨ Special'
  if (type === 'exit') return '🚪 Way'
  if (type === 'empty') return '· Quiet'
  if (type === 'well' || type === 'anvil' || type === 'rope') return '🏕️ Rest'
  if (type === 'blockage' || type === 'hole') return '🕳️ Hazard'
  return '❓ Unknown'
}

/** Golden perimeter pulse on magic chest only while the player has at least one 🗝️. */
function _syncMagicChestKeyGlow() {
  if (!session.run) return
  const hasKeys = (session.run.player.goldenKeys ?? 0) > 0
  const grid = TileEngine.getGrid()
  for (const row of grid) {
    for (const t of row) {
      if (t.type !== 'magic_chest' || !t.element) continue
      t.element.classList.toggle('magic-chest-has-keys', hasKeys && !!t.magicChestReady)
    }
  }
}

function _charKey() { return runCharKey() }

/** True iff the active is meta-unlocked AND picked this run via level-up. */
function _isActiveUnlocked(abilityKey, charKey = _charKey()) {
  const list = charKey === 'ranger'      ? (session.save.ranger?.upgrades      ?? [])
             : charKey === 'engineer'    ? (session.save.engineer?.upgrades    ?? [])
             : charKey === 'mage'        ? (session.save.mage?.upgrades        ?? [])
             : charKey === 'necromancer' ? (session.save.necromancer?.upgrades ?? [])
             : charKey === 'vampire'     ? (session.save.vampire?.upgrades     ?? [])
             :                             (session.save.warrior?.upgrades     ?? [])
  if (!list.includes(abilityKey)) return false
  const runUnlocked = session.run?.player?.unlockedActives ?? []
  return runUnlocked.includes(abilityKey)
}













/** Legacy alias used by ranger HUD/actions. Now delegates to the unified active-unlock check. */










/** Ranger __Attack.gif length — portrait stays on "attack" until this elapses. */
const RANGER_FIGHT_ATTACK_PORTRAIT_MS = 4000
/** Warrior strike gif length — portrait stays on "attack" until this elapses. */
const WARRIOR_FIGHT_ATTACK_PORTRAIT_MS = 2000
/** Ranger passive: chance per enemy reveal to skip locking adjacent tiles. */
const RANGER_PASSIVE_SKIP_ADJ_LOCK = 0.1

/** Strip Dark Eyes hints when a tile becomes reachable; then mark DOM reachable. */
function _markReachableUi(tileEl) {
  if (!tileEl) return
  const r = tileEl.dataset?.row
  const c = tileEl.dataset?.col
  if (r != null && c != null) {
    const t = TileEngine.getTile(+r, +c)
    if (t?.darkEyesHint) {
      t.darkEyesHint = false
      t.echoHintCategory = null
      if (t.element) {
        t.element.classList.remove('echo-hint')
        delete t.element.dataset.echoHint
      }
    }
  }
  UI.markTileReachable(tileEl)
}

/** Unrevealed enemy tile types (for Dark Eyes hints only). */




/** Shake / strike VFX, then after 400ms resolve kill — mirrors fightAction’s fatal-blow delay (multi-kill skips long portrait hold so chains stay snappy). */


/** First “kill” on a splittable slime: same split branch as fightAction (telemetry + UI.splitSlime). */








function buildRunState() { return GSH.buildRunState(_stateCtx()) }

// ── Accessors ────────────────────────────────────────────────

function getActiveCombatTile() { return session.run?.activeCombatTile ?? null }

// ── Engineer turret ───────────────────────────────────────────















/** True when Engineer has a live turret deployed on this grid cell (never unflip / re-reveal over it). */








// ── Necromancer minions ───────────────────────────────────────

let _nextMinionId = 1











/** After a raised minion dies, remove the corpse tile so it cannot be raised again (1 minion per slain enemy). */




/** Returns total minion co-strike damage for the active combat. */


/** Absorb damage with the closest minion to the given enemy tile. Returns true if absorbed. */


// ── Necromancer: active abilities ────────────────────────────















/** Mark the corpse or minion tile at `tile` as spent by the explosion. */


/** Unrevealed tiles within Chebyshev distance `radius` of (row,col), excluding the center. */


/** Engineer passive — Seismic Ping: after turret is placed or moved, scan hidden tiles in the ping ring for category hints + brief flash. */



















function _stateCtx() {
  return {
    charKey: _charKey,
    applyEquippedGear: _applyEquippedGear,
    applySafePocket: _applySafePocket,
    startFloor: _startFloor,
    getCombatEngagementTile: () => session.tap.combatEngagementTile,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    closeEventSession: _closeEventSession,
    resetCombatOnDeath: _resetCombatOnDeath,
  }
}


// Active grid + combat engagement (TileTapRouter)
const _isInSubFloor = TapRouter.isInSubFloor
const _getActiveTiles = TapRouter.getActiveTiles
const _getActiveTileRows = TapRouter.getActiveTileRows
const _getActiveTileAt = TapRouter.getActiveTileAt
const _getActiveOrthogonal = TapRouter.getActiveOrthogonal
const _syncCombatEngagementDom = TapRouter.syncCombatEngagementDom
const _setCombatEngagement = TapRouter.setCombatEngagement
const _clearCombatEngagementForTile = TapRouter.clearCombatEngagementForTile
const _clearAllCombatEngagement = TapRouter.clearAllCombatEngagement
const _isCombatCommitmentLocked = TapRouter.isCombatCommitmentLocked
const _canAttackEnemy = TapRouter.canAttackEnemy
const _suspendCombatEngagementForMultiTargetAbility = TapRouter.suspendCombatEngagementForMultiTargetAbility
const _restoreCombatEngagementAfterMultiTargetAbility = TapRouter.restoreCombatEngagementAfterMultiTargetAbility


// Tile reveal / hold / chest (TileRevealController)
const _applyRangerTrapfinderMitigation = RevealController.applyRangerTrapfinderMitigation
const _tickPoisonArrowDotOnGlobalTurn = (opts) => RevealController.tickPoisonArrowDotOnGlobalTurn(_revealCtx(), opts)
const _maybeOfferDeadlockEscape = () => RevealController.maybeOfferDeadlockEscape(_revealCtx())
const _maybeMouseIntro = () => RevealController.maybeMouseIntro()
const _maybeWarBannerIntro = () => RevealController.maybeWarBannerIntro()
const _maybeBestiaryDiscovery = (tile) => RevealController.maybeBestiaryDiscovery(tile)


// Combat (CombatController)
const _shouldShowParryWindow = CombatController.shouldShowParryWindow

// Targeting cancel modes + tap consumption (TargetingController)
const _cancelRicochetMode = TargetingController.cancelRicochetMode
const _cancelArrowBarrageMode = TargetingController.cancelArrowBarrageMode
const _cancelPoisonArrowShotMode = TargetingController.cancelPoisonArrowShotMode
const _cancelEngineerConstructMode = TargetingController.cancelEngineerConstructMode
const _cancelChainLightningMode = TargetingController.cancelChainLightningMode
const _cancelTelekineticThrowMode = TargetingController.cancelTelekineticThrowMode
const _cancelStrengthenMinionMode = TargetingController.cancelStrengthenMinionMode
const _cancelCorpseExplosionMode = TargetingController.cancelCorpseExplosionMode

function _targetingUiCtx() {
  return { previewSpellManaCostForUi: _previewSpellManaCostForUi }
}
const _cancelSpellLanternBlindingForRicochet = () =>
  TargetingController.cancelSpellLanternBlindingForRicochet(_targetingUiCtx())

function _targetingTapCtx() {
  return {
    ..._targetingUiCtx(),
    castSpell: _castSpell,
    castBlindingLight: _castBlindingLight,
    stillWaterManaCost: _stillWaterManaCost,
    tearyExtraCost: _tearyExtraCost,
    executeTripleVolley: _executeTripleVolley,
    executePoisonArrowShot: _executePoisonArrowShot,
    executeRicochet: _executeRicochet,
    executeChainLightning: _executeChainLightning,
    isTelekineticThrowEnemyTarget: _isTelekineticThrowEnemyTarget,
    getActiveTileAt: _getActiveTileAt,
    isTelekineticThrowDestination: _isTelekineticThrowDestination,
    executeTelekineticThrow: _executeTelekineticThrow,
  }
}
const _tryConsumeTargetingTap = (tile) => TargetingController.tryConsumeTargetingTap(_targetingTapCtx(), tile)

function _spawnCtx() {
  return {
    onTileTap,
    onTileHold,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    saveActiveRun: _saveActiveRun,
    pickRandom: _pickRandom,
    addToBackpack: _addToBackpack,
  }
}
const _restoreTreasureGoblinAfterResume = SpecialSpawnController.restoreTreasureGoblinAfterResume
const _spawnTreasureGoblin = (usedCoords) => SpecialSpawnController.spawnTreasureGoblin(_spawnCtx(), usedCoords)
const _spawnArcherGoblin = (usedCoords) => SpecialSpawnController.spawnArcherGoblin(_spawnCtx(), usedCoords)
const _spawnMouse = (usedCoords) => SpecialSpawnController.spawnMouse(_spawnCtx(), usedCoords)
const _tickTreasureGoblinCountdown = () => SpecialSpawnController.tickTreasureGoblinCountdown(_spawnCtx())
const _finishTreasureGoblinReward = (tile) => SpecialSpawnController.finishTreasureGoblinReward(_spawnCtx(), tile)

// Floor progression (FloorController)
function _floorCtx() {
  return {
    ..._combatCtx(),
    cancelEngineerConstructMode: _cancelEngineerConstructMode,
    cancelChainLightningMode: _cancelChainLightningMode,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    cancelCorpseExplosionMode: _cancelCorpseExplosionMode,
    syncWarBannerCoordsFromGrid: _syncWarBannerCoordsFromGrid,
    syncTurretVisual: _syncTurretVisual,
    revealStartTile: _revealStartTile,
    restoreTreasureGoblinAfterResume: _restoreTreasureGoblinAfterResume,
    spawnSubFloorEntry: _spawnSubFloorEntry,
    spawnWarBannerEntry: _spawnWarBannerEntry,
    spawnTreasureGoblin: _spawnTreasureGoblin,
    spawnArcherGoblin: _spawnArcherGoblin,
    spawnMouse: _spawnMouse,
    maybeMouseIntro: _maybeMouseIntro,
    resolveEffect: _resolveEffect,
    paladinKillEchoApplyMarks: _paladinKillEchoApplyMarks,
    refreshRangerActiveHud: _refreshRangerActiveHud,
    refreshEngineerHud: _refreshEngineerHud,
    refreshMageHud: _refreshMageHud,
    refreshVampireHud: _refreshVampireHud,
    refreshNecroActiveHud: _refreshNecroActiveHud,
    isActiveUnlocked: _isActiveUnlocked,
    previewSpellManaCostForUi: _previewSpellManaCostForUi,
    appendLevelSnapshot: _appendLevelSnapshot,
    appendFloorSnapshot: _appendFloorSnapshot,
    saveActiveRun: _saveActiveRun,
    runMusicTrack: _runMusicTrack,
    xpNeeded: _xpNeeded,
  }
}

function _startFloor() { FloorController.startFloor(_floorCtx()) }
function _nextFloor() { FloorController.nextFloor(_floorCtx()) }
function _handleExit() { FloorController.handleExit(_floorCtx()) }
function _confirmRope(tile) { FloorController.confirmRope(_floorCtx(), tile) }
function _checkFloorModifierOnReveal(tile) { FloorController.checkFloorModifierOnReveal(_floorCtx(), tile) }


// ── Hero ability ctx + facades (js/heroes/) ───────────────────

function _heroAbilityBaseCtx() {
  return {
    ..._revealCtx(),
    charKey: _charKey,
    getActiveTiles: _getActiveTiles,
    getActiveTileRows: _getActiveTileRows,
    getActiveTileAt: _getActiveTileAt,
    getActiveOrthogonal: _getActiveOrthogonal,
    isInSubFloor: _isInSubFloor,
    suspendCombatEngagementForMultiTargetAbility: _suspendCombatEngagementForMultiTargetAbility,
    restoreCombatEngagementAfterMultiTargetAbility: _restoreCombatEngagementAfterMultiTargetAbility,
    scaleOutgoingDamageToEnemy: _scaleOutgoingDamageToEnemy,
    gainGold: _gainGold,
    gainXP: _gainXP,
    endCombatVictory: _endCombatVictory,
    rand: _rand,
    saveActiveRun: _saveActiveRun,
    isSilenced: _isSilenced,
    stillWaterManaCost: _stillWaterManaCost,
    markStillWaterAbilityUsed: _markStillWaterAbilityUsed,
    tearyExtraCost: _tearyExtraCost,
    isActiveUnlocked: _isActiveUnlocked,
    previewSpellManaCostForUi: _previewSpellManaCostForUi,
    cancelRicochetMode: _cancelRicochetMode,
    cancelArrowBarrageMode: _cancelArrowBarrageMode,
    cancelPoisonArrowShotMode: _cancelPoisonArrowShotMode,
    cancelChainLightningMode: _cancelChainLightningMode,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    cancelCorpseExplosionMode: _cancelCorpseExplosionMode,
    cancelEngineerConstructMode: _cancelEngineerConstructMode,
    cancelSpellLanternBlindingForRicochet: _cancelSpellLanternBlindingForRicochet,
    resolveTauntTarget: (tile) => CombatController.resolveTauntTarget(_combatCtx(), tile),
    checkShieldBlock: (tile) => CombatController.checkShieldBlock(_combatCtx(), tile),
    checkOnionLayer: _checkOnionLayer,
    canAttackEnemy: _canAttackEnemy,
    applyTearyEyes: _applyTearyEyes,
    die: _die,
    avgMeleeDamage: () => Warrior.avgMeleeDamage(_warriorCtx()),
  }
}

function _warriorCtx() {
  return { ..._heroAbilityBaseCtx() }
}

function _rangerCtx() {
  const ctx = {
    ..._heroAbilityBaseCtx(),
    isRangerActiveUnlocked: (k) => Ranger.isRangerActiveUnlocked(ctx, k),
    rangerActiveDamageMult: (k) => Ranger.rangerActiveDamageMult(k),
  }
  return ctx
}

function _mageCtx() {
  const ctx = {
    ..._heroAbilityBaseCtx(),
    isMageActiveUnlocked: (k) => Mage.isMageActiveUnlocked(ctx, k),
    mageActiveDamageMult: (k) => Mage.mageActiveDamageMult(k),
    refreshMageHud: () => Mage.refreshMageHud(_mageCtx()),
    lifeTapHpCost: () => Mage.lifeTapHpCost(),
    lifeTapMpGain: () => Mage.lifeTapMpGain(),
    manaShieldAbsorptionRate: () => Mage.manaShieldAbsorptionRate(),
    manaShieldDrainRatio: () => Mage.manaShieldDrainRatio(),
    previewSpellManaCostForUi: () => Mage.previewSpellManaCostForUi(_mageCtx()),
    chainLightningDamagePerZap: () => Mage.chainLightningDamagePerZap(_mageCtx()),
    telekineticThrowDamage: () => Mage.telekineticThrowDamage(_mageCtx()),
    pickRandomDistinct: Mage.pickRandomDistinct,
    isTelekineticThrowDestination: (t) => Mage.isTelekineticThrowDestination(ctx, t),
    isTelekineticThrowEnemyTarget: (t) => Mage.isTelekineticThrowEnemyTarget(t),
    patchActiveTileDom: _patchActiveTileDom,
    recomputeSubFloorEnemyLocks: _recomputeSubFloorEnemyLocks,
    die: _die,
  }
  return ctx
}

function _engineerCtx() {
  const ctx = {
    ..._heroAbilityBaseCtx(),
    isEngineerUpgradeUnlocked: (id) => Engineer.isEngineerUpgradeUnlocked(ctx, id),
    engineerTurretMaxHp: Engineer.engineerTurretMaxHp,
    engineerTurretDamage: Engineer.engineerTurretDamage,
    teslaStacks: Engineer.teslaStacks,
    teslaRadius: Engineer.teslaRadius,
    teslaArcChance: Engineer.teslaArcChance,
    inTeslaPerimeter: Engineer.inTeslaPerimeter,
    syncTurretVisual: Engineer.syncTurretVisual,
    destroyTurret: () => Engineer.destroyTurret(_engineerCtx()),
    damageTurretFromEnemyHit: (a, b) => Engineer.damageTurretFromEnemyHit(_engineerCtx(), a, b),
    refreshEngineerHud: () => Engineer.refreshEngineerHud(_engineerCtx()),
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    onTileTap,
    onTileHold,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
  }
  return ctx
}

function _necroCtx() {
  const ctx = {
    ..._heroAbilityBaseCtx(),
    isNecroActiveUnlocked: (k) => Necromancer.isNecroActiveUnlocked(ctx, k),
    hasNecroMetaUpgrade: Necromancer.hasNecroMetaUpgrade,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    onTileTap,
    onTileHold,
    syncMinionVisual: Necromancer.syncMinionVisual,
    necroClearAshAfterMinionDeath: (r, c) => Necromancer.necroClearAshAfterMinionDeath(ctx, r, c),
  }
  return ctx
}

function _vampireCtx() {
  return {
    ..._heroAbilityBaseCtx(),
    applyTearyEyes: _applyTearyEyes,
    telemetryBumpDamageTaken: _telemetryBumpDamageTaken,
    telemetryBumpDamageSource: _telemetryBumpDamageSource,
    telemetryBumpDamageDealt: _telemetryBumpDamageDealt,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    finalizeVampireDrainKill: (t, d) => Vampire.finalizeVampireDrainKill(_vampireCtx(), t, d),
    vampireDrainKillPresentationThenResolve: (t, d, cb) => Vampire.vampireDrainKillPresentationThenResolve(_vampireCtx(), t, d, cb),
    vampireDrainSlimeSplitPresentation: (t, hp, cb) => Vampire.vampireDrainSlimeSplitPresentation(_vampireCtx(), t, hp, cb),
    runVampireDrainPresentationChain: (e, i, h) => Vampire.runVampireDrainPresentationChain(_vampireCtx(), e, i, h),
    vampireDarkEyesRoll: (t) => Vampire.vampireDarkEyesRoll(_vampireCtx(), t),
    isDarkEyesEnemyTileType: Vampire.isDarkEyesEnemyTileType,
    bloodTitheHpCost: Vampire.bloodTitheHpCost,
    bloodTitheManaGain: Vampire.bloodTitheManaGain,
    bloodPactManaCost: Vampire.bloodPactManaCost,
  }
}

function slamAction() { Warrior.slamAction(_warriorCtx()) }
function blindingLightAction() { Warrior.blindingLightAction(_warriorCtx()) }
function divineLightAction() { Warrior.divineLightAction(_warriorCtx()) }
function divineLightHealAction() { Warrior.divineLightHealAction(_warriorCtx()) }
function getSlamDamageBreakdown() { return Warrior.getSlamDamageBreakdown(_warriorCtx()) }
function getDivineLightBreakdown() { return Warrior.getDivineLightBreakdown(_warriorCtx()) }
function getBlindingLightBreakdown() { return Warrior.getBlindingLightBreakdown(_warriorCtx()) }
const _castBlindingLight = (t) => Warrior.castBlindingLight(_warriorCtx(), t)
const _castDivineLightSmite = (t) => Warrior.castDivineLightSmite(_warriorCtx(), t)
const _paladinKillEchoAddMarksAfterKill = (t) => Warrior.paladinKillEchoAddMarksAfterKill(t)
const _paladinKillEchoApplyMarks = (r, c, n) => Warrior.paladinKillEchoApplyMarks(r, c, n)
const _paladinKillEchoClearMarks = () => Warrior.paladinKillEchoClearMarks()
const _hemorrhageBurst = (t) => Warrior.hemorrhageBurst(_warriorCtx(), t)
const _refreshAllEnemyStatusDisplays = () => Warrior.refreshAllEnemyStatusDisplays(_warriorCtx())

function ricochetAction() { Ranger.ricochetAction(_rangerCtx()) }
function arrowBarrageAction() { Ranger.arrowBarrageAction(_rangerCtx()) }
function poisonArrowShotAction() { Ranger.poisonArrowShotAction(_rangerCtx()) }
function getRicochetBreakdown() { return Ranger.getRicochetBreakdown(_rangerCtx()) }
function getArrowBarrageBreakdown() { return Ranger.getArrowBarrageBreakdown(_rangerCtx()) }
function getPoisonArrowShotBreakdown() { return Ranger.getPoisonArrowShotBreakdown(_rangerCtx()) }
const _isRangerActiveUnlocked = (k) => Ranger.isRangerActiveUnlocked(_rangerCtx(), k)
const _refreshRangerActiveHud = () => Ranger.refreshRangerActiveHud(_rangerCtx())
const _executeRicochet = () => Ranger.executeRicochet(_rangerCtx())
const _executeTripleVolley = (c) => Ranger.executeTripleVolley(_rangerCtx(), c)
const _executePoisonArrowShot = (t) => Ranger.executePoisonArrowShot(_rangerCtx(), t)
const _poisonArrowUnitDamage = () => Ranger.poisonArrowUnitDamage(_rangerCtx())

function spellAction() { Mage.spellAction(_mageCtx()) }
function chainLightningAction() { Mage.chainLightningAction(_mageCtx()) }
function telekineticThrowAction() { Mage.telekineticThrowAction(_mageCtx()) }
function manaShieldAction() { Mage.manaShieldAction(_mageCtx()) }
function lifeTapAction() { Mage.lifeTapAction(_mageCtx()) }
function getChainLightningBreakdown() { return Mage.getChainLightningBreakdown(_mageCtx()) }
function getTelekineticThrowBreakdown() { return Mage.getTelekineticThrowBreakdown(_mageCtx()) }
const _isMageActiveUnlocked = (k) => Mage.isMageActiveUnlocked(_mageCtx(), k)
const _refreshMageHud = () => Mage.refreshMageHud(_mageCtx())
const _mageLifeTapOnFlip = (el) => Mage.mageLifeTapOnFlip(_mageCtx(), el)
const _castSpell = (t) => Mage.castSpell(_mageCtx(), t)
const _executeChainLightning = (p) => Mage.executeChainLightning(_mageCtx(), p)
const _executeTelekineticThrow = (o, d) => Mage.executeTelekineticThrow(_mageCtx(), o, d)
const _isTelekineticThrowEnemyTarget = (t) => Mage.isTelekineticThrowEnemyTarget(t)
const _isTelekineticThrowDestination = (t) => Mage.isTelekineticThrowDestination(_mageCtx(), t)
const _manaShieldAbsorptionRate = () => Mage.manaShieldAbsorptionRate()
const _manaShieldDrainRatio = () => Mage.manaShieldDrainRatio()
const _lifeTapHpCost = () => Mage.lifeTapHpCost()
const _lifeTapMpGain = () => Mage.lifeTapMpGain()

function constructTurretAction() { Engineer.constructTurretAction(_engineerCtx()) }
function teslaTowerAction() { Engineer.teslaTowerAction(_engineerCtx()) }
function manaGeneratorAction() { Engineer.manaGeneratorAction(_engineerCtx()) }
const _isEngineerUpgradeUnlocked = (id) => Engineer.isEngineerUpgradeUnlocked(_engineerCtx(), id)
const _engineerTurretMaxHp = Engineer.engineerTurretMaxHp
const _engineerTurretDamage = Engineer.engineerTurretDamage
const _teslaRadius = () => Engineer.teslaRadius()
const _inTeslaPerimeter = (tr, t) => Engineer.inTeslaPerimeter(tr, t)
const _turretDeployedOnTile = (t) => Engineer.turretDeployedOnTile(t)
const _syncTurretVisual = (c) => Engineer.syncTurretVisual(c)
const _engineerTurretAfterReveal = (t) => Engineer.engineerTurretAfterReveal(_engineerCtx(), t)
const _engineerManaGeneratorOnReveal = (el) => Engineer.engineerManaGeneratorOnReveal(_engineerCtx(), el)
const _handleEngineerConstructTileTap = (t) => Engineer.handleEngineerConstructTileTap(_engineerCtx(), t)
const _refreshEngineerHud = () => Engineer.refreshEngineerHud(_engineerCtx())
const _damageTurretFromEnemyHit = (a, b) => Engineer.damageTurretFromEnemyHit(_engineerCtx(), a, b)

function strengthenMinionAction() { Necromancer.strengthenMinionAction(_necroCtx()) }
function corpseExplosionAction() { Necromancer.corpseExplosionAction(_necroCtx()) }
const _necroRaiseMinion = (t) => Necromancer.necroRaiseMinion(_necroCtx(), t)
const _necroMinionTotalDmg = () => Necromancer.necroMinionTotalDmg()
const _necroMinionAbsorbDamage = (a, b, c) => Necromancer.necroMinionAbsorbDamage(_necroCtx(), a, b, c)
const _refreshNecroActiveHud = () => Necromancer.refreshNecroActiveHud(_necroCtx())
const _executeCorpseExplosion = (t) => Necromancer.executeCorpseExplosion(_necroCtx(), t)
const _hasNecroMetaUpgrade = Necromancer.hasNecroMetaUpgrade
const _syncMinionVisual = Necromancer.syncMinionVisual
const _syncAllMinionVisuals = () => Necromancer.syncAllMinionVisuals()
const _clearMinionVisuals = () => Necromancer.clearMinionVisuals()

function bloodTitheAction() { Vampire.bloodTitheAction(_vampireCtx()) }
function mistFormAction() { Vampire.mistFormAction(_vampireCtx()) }
function bloodPactAction() { Vampire.bloodPactAction(_vampireCtx()) }
function getBloodTitheBreakdown() { return Vampire.getBloodTitheBreakdown(_vampireCtx()) }
function getBloodPactBreakdown() { return Vampire.getBloodPactBreakdown(_vampireCtx()) }
const _refreshVampireHud = () => Vampire.refreshVampireHud(_vampireCtx())
const _vampireCorruptedBloodAndDarkEyes = (t) => Vampire.vampireCorruptedBloodAndDarkEyes(_vampireCtx(), t)

function _combatCtx() {
  return {
    ..._revealCtx(),
    canAttackEnemy: _canAttackEnemy,
    tickPoisonArrowDotOnGlobalTurn: _tickPoisonArrowDotOnGlobalTurn,
    engineerTurretDamage: _engineerTurretDamage,
    necroMinionTotalDmg: _necroMinionTotalDmg,
    scaleOutgoingDamageToEnemy: _scaleOutgoingDamageToEnemy,
    gainManaFromMeleeHit: _gainManaFromMeleeHit,
    applyTearyEyes: _applyTearyEyes,
    checkOnionLayer: _checkOnionLayer,
    vibrationRequiresSyncUserActivation: _vibrationRequiresSyncUserActivation,
    telemetryBumpDamageDealt: _telemetryBumpDamageDealt,
    takeDamage: _takeDamage,
    applyFreezingHit: _applyFreezingHit,
    applyBurnHit: _applyBurnHit,
    applyPlayerPoison: _applyPlayerPoison,
    applyCorruption: _applyCorruption,
    tryDemonFlip: _tryDemonFlip,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    sfUnlockAdjacent: _sfUnlockAdjacent,
    finishTreasureGoblinReward: _finishTreasureGoblinReward,
    telemetryBumpKill: _telemetryBumpKill,
    removeHulkBuffFromAll: _removeHulkBuffFromAll,
    paladinKillEchoAddMarksAfterKill: _paladinKillEchoAddMarksAfterKill,
    checkFloorCleared: _checkFloorCleared,
    maybeOfferDeadlockEscape: _maybeOfferDeadlockEscape,
  }
}

function fightAction(tile) { CombatController.fightAction(_combatCtx(), tile) }
function _endCombatVictory(tile) { CombatController.endCombatVictory(_combatCtx(), tile) }

function _revealCtx() {
  return {
    ..._tapCtx(),
    onTileTap,
    onTileHold,
    turretDeployedOnTile: _turretDeployedOnTile,
    syncAllUnrevealedLockedDom: _syncAllUnrevealedLockedDom,
    serializeHourglassSnapshot: _serializeHourglassSnapshot,
    firefoxPreFlipHapticsIfNeeded: _firefoxPreFlipHapticsIfNeeded,
    gainXP: _gainXP,
    engineerManaGeneratorOnReveal: _engineerManaGeneratorOnReveal,
    checkFloorModifierOnReveal: _checkFloorModifierOnReveal,
    rand: _rand,
    gainGold: _gainGold,
    endCombatVictory: _endCombatVictory,
    markReachableUi: _markReachableUi,
    applyHulkBuffToAll: _applyHulkBuffToAll,
    findLiveHulk: _findLiveHulk,
    applyHulkBuffToTile: _applyHulkBuffToTile,
    engineerTurretAfterReveal: _engineerTurretAfterReveal,
    charKey: _charKey,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    vampireCorruptedBloodAndDarkEyes: _vampireCorruptedBloodAndDarkEyes,
    mageLifeTapOnFlip: _mageLifeTapOnFlip,
    hapticFromUserGesture: _hapticFromUserGesture,
    hapticFromAsyncTask: _hapticFromAsyncTask,
    tickTreasureGoblinCountdown: _tickTreasureGoblinCountdown,
    scaleOutgoingDamageToEnemy: _scaleOutgoingDamageToEnemy,
    poisonArrowUnitDamage: _poisonArrowUnitDamage,
    hemorrhageBurst: _hemorrhageBurst,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    takeDamage: _takeDamage,
    refreshAllEnemyStatusDisplays: _refreshAllEnemyStatusDisplays,
    playerDamageRange: _playerDamageRange,
    addToBackpack: _addToBackpack,
    rollChestLoot: _rollChestLoot,
    tryGearDrop: _tryGearDrop,
    openForge: _openForge,
    syncMagicChestKeyGlow: _syncMagicChestKeyGlow,
    engineerTurretDamage: _engineerTurretDamage,
    inTeslaPerimeter: _inTeslaPerimeter,
    teslaRadius: _teslaRadius,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    isPlayerDeadlocked: _isPlayerDeadlocked,
  }
}

async function revealTile(tile) { return RevealController.revealTile(_revealCtx(), tile) }
function onTileHold(row, col) { RevealController.onTileHold(_revealCtx(), row, col) }
async function _openChest(tile) { return RevealController.openChest(_revealCtx(), tile) }
function _resolveEffect(tile) { RevealController.resolveEffect(_revealCtx(), tile) }

function _tapCtx() {
  return {
    ..._stateCtx(),
    charKey: _charKey,
    syncAllUnrevealedLockedDom: _syncAllUnrevealedLockedDom,
    handleEngineerConstructTileTap: _handleEngineerConstructTileTap,
    isCombatCommitmentLocked: _isCombatCommitmentLocked,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    syncMinionVisual: _syncMinionVisual,
    saveActiveRun: _saveActiveRun,
    executeCorpseExplosion: _executeCorpseExplosion,
    castSpell: _castSpell,
    rand: _rand,
    gainGold: _gainGold,
    gainXP: _gainXP,
    endCombatVictory: _endCombatVictory,
    useLanternOn: _useLanternOn,
    useSpyglassOn: _useSpyglassOn,
    castBlindingLight: _castBlindingLight,
    castDivineLightSmite: _castDivineLightSmite,
    stillWaterManaCost: _stillWaterManaCost,
    tearyExtraCost: _tearyExtraCost,
    executeTripleVolley: _executeTripleVolley,
    executePoisonArrowShot: _executePoisonArrowShot,
    executeRicochet: _executeRicochet,
    executeChainLightning: _executeChainLightning,
    isTelekineticThrowEnemyTarget: _isTelekineticThrowEnemyTarget,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    isTelekineticThrowDestination: _isTelekineticThrowDestination,
    executeTelekineticThrow: _executeTelekineticThrow,
    getActiveTileAt: _getActiveTileAt,
    enterSubFloor: _enterSubFloor,
    destroyWarBanner: _destroyWarBanner,
    openChest: _openChest,
    openMagicChest: _openMagicChest,
    revealTile,
    openForge: _openForge,
    confirmExit: _confirmExit,
    confirmRope: _confirmRope,
    openEvent: _openEvent,
    climbThroughHazard: _climbThroughHazard,
    necroRaiseMinion: _necroRaiseMinion,
    fightAction,
    hapticFromUserGesture: _hapticFromUserGesture,
    hasNecroMetaUpgrade: _hasNecroMetaUpgrade,
  }
}

function _resetCombatOnDeath() {
  session.tap.spellTargeting         = false
  session.tap.combatBusy             = false
  _clearAllCombatEngagement()
  session.tap.lanternTargeting       = false
  session.tap.spyglassTargeting      = false
  session.tap.blindingLightTargeting = false
  session.tap.divineLightSelecting   = false
  UI.setDivineLightActive(false)
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (session.run?.player) {
    session.run.player.tearyEyesTurns = 0
    UI.setTearyEyes(0)
    session.run.player.freezingHitStacks = 0
    UI.setFreezingHit(0)
    session.run.player.burnStacks = 0
    UI.setBurnOverlay(0)
    session.run.player.poisonStacks = 0
    UI.setPlayerPoison(0)
    session.run.player.corruptionStacks = 0
    if (session.run.player.corruptionBaseMaxHp) {
      session.run.player.maxHp = session.run.player.corruptionBaseMaxHp
      session.run.player.corruptionBaseMaxHp = 0
    }
    if (session.run.player.corruptionBaseMaxMana) {
      session.run.player.maxMana = session.run.player.corruptionBaseMaxMana
      session.run.player.corruptionBaseMaxMana = 0
    }
    UI.setCorruption(0)
  }
}

// ── Init ─────────────────────────────────────────────────────

function init(saveData) { GSH.init(_stateCtx(), saveData) }

// ── New game ─────────────────────────────────────────────────

function newGame() { GSH.newGame(_stateCtx()) }

// ── Run persistence ──────────────────────────────────────────


// Gear + blacksmith (GearController)
function _adjustPlayerStat(stat, delta) { GearController.adjustPlayerStat(stat, delta) }

function _gearCtx() {
  return {
    rand: _rand,
    playerDamageRange: _playerDamageRange,
  }
}

function _applyEquippedGear(p) { GearController.applyEquippedGear(_gearCtx(), p) }
function _applySafePocket(p) { SafePocketController.applySafePocket(_inventoryCtx(), p) }
function _equipSafePocket(inventoryIndex) { SafePocketController.equipSafePocket(_inventoryCtx(), inventoryIndex) }
function _equipGear(inventoryIndex) { GearController.equipGear(_gearCtx(), inventoryIndex) }
function _unequipGear(slot, inventoryIndex) { GearController.unequipGear(_gearCtx(), slot, inventoryIndex) }
function _handleGearPickup(piece) { GearController.handleGearPickup(_gearCtx(), piece) }
function _tryGearDrop(floor, chance) { return GearController.tryGearDrop(_gearCtx(), floor, chance) }
function _upgradeGear(slot) { return GearController.upgradeGear(_gearCtx(), slot) }
function _disassembleGear(slot) { return GearController.disassembleGear(_gearCtx(), slot) }
function _reduceDetriment(slot, statKey) { return GearController.reduceDetriment(_gearCtx(), slot, statKey) }
function _trashGear(inventoryIndex) { GearController.trashGear(_gearCtx(), inventoryIndex) }

function _saveActiveRun() { GSH.saveActiveRun(_stateCtx()) }

function _clearActiveRun() { GSH.clearActiveRun(_stateCtx()) }

/** In-run background music key for AudioManager (sanctuary rest vs dungeon). */
function _runMusicTrack() {
  if (!session.run) return 'dungeon'
  if (session.run.atRest) return 'sanctuary'
  return 'dungeon'
}

function resumeRun() { GSH.resumeRun(_stateCtx()) }

function abandonRun() { GSH.abandonRun(_stateCtx()) }

// ── Return to menu ───────────────────────────────────────────

function returnToMenu(autoSave = false) { GSH.returnToMenu(_stateCtx(), autoSave) }

/** Full main-grid rebuild from model — use after hourglass rewind or war banner teardown. */
function _refreshMainGridDomFromModel() {
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  _syncGridDomClassesFromModel()
}

/**
 * Hourglass snapshots omit some per-type fields (e.g. bannerReady). Without this, stale props
 * from a prior object identity can make an empty tile behave or save like a chest.
 */
function _normalizeTileFieldsForType(t) {
  if (t.type !== 'war_banner') {
    delete t.bannerReady
    delete t.warBannerFlying
  } else if (t.revealed) {
    t.bannerReady = true
    t.warBannerFlying = false
  } else {
    t.bannerReady = false
    if (t.warBannerFlying === undefined || t.warBannerFlying === null) t.warBannerFlying = true
  }
  if (t.type !== 'chest') {
    delete t.chestLoot
    delete t.chestReady
    delete t.chestLooted
  }
  if (t.type !== 'magic_chest') {
    delete t.magicChestReady
  }
}

/** After loading a floor from snapshot, sync tile CSS classes to match model (no flip animation). */
function _syncGridDomClassesFromModel() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t.element) continue
      const el = t.element
      el.classList.toggle('revealed', !!t.revealed)
      el.classList.toggle('locked', !!t.locked)
      el.classList.toggle('reachable', !!t.reachable && !t.revealed)
      if (t.type === 'event') {
        el.classList.toggle('event-pending', !t.eventResolved)
      }
      if (t.type === 'chest') {
        el.classList.toggle('chest-ready', !!(t.chestReady && !t.chestLooted))
      }
      if (t.type === 'magic_chest') {
        el.classList.toggle('chest-ready', !!t.magicChestReady)
      }
      if (t.type === 'forge') {
        el.classList.toggle('forge-used', !!t.forgeUsed)
      }
      if (t.type === 'exit') {
        el.classList.toggle('exit-pending', !t.exitResolved)
      }
      if (t.type === 'rope') {
        el.classList.toggle('rope-pending', !t.ropeResolved)
      }
      // Echo hints only apply to unrevealed backs; strip after full grid rebuilds (e.g. banner → empty).
      if (t.revealed) {
        el.classList.remove('echo-hint')
        delete el.dataset.echoHint
      } else if (t.echoHintCategory) {
        el.classList.add('echo-hint')
        el.dataset.echoHint = t.echoHintCategory
      } else {
        el.classList.remove('echo-hint')
        delete el.dataset.echoHint
      }
      // Full grid rebuilds (e.g. war banner torn down) recreate living enemy faces — restore slain art
      if (t.revealed && t.enemyData?._slain && t.element) {
        const front = t.element.querySelector('.tile-front')
        if (front && !front.classList.contains('type-slain')) {
          UI.markTileSlain(t.element)
        }
      }
      // .tile.revealed defaults to pointer-events:none; .enemy-alive restores taps (see tiles.css).
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        UI.markTileEnemyAlive(el)
      } else if (t.revealed && t.enemyData?._slain && _charKey() === 'necromancer') {
        // Necromancer can tap ash piles to raise minions
        UI.markTileEnemyAlive(el)
      } else {
        el.classList.remove('enemy-alive')
      }
    }
  }
}

// ── Starting tile ────────────────────────────────────────────

function _revealStartTile() {
  const grid = TileEngine.getGrid()
  const { cols, rows } = CONFIG.gridSize(session.run.floor, { rest: session.run.atRest })

  // Start tile must be empty — find all empty tiles and pick one at random
  const empties = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].type === 'empty') empties.push(grid[r][c])
    }
  }

  // Fallback: if somehow no empty tile exists, force the first tile to empty
  let tile
  if (empties.length > 0) {
    tile = empties[Math.floor(Math.random() * empties.length)]
  } else {
    tile = grid[0][0]
    tile.type = 'empty'
  }

  tile.revealed = true
  tile.isStart = true
  session.run.tilesRevealed++
  session.run.floorStartRow = tile.row
  session.run.floorStartCol = tile.col
  // Mark neighbours reachable immediately so they're clickable before the flip finishes
  TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  TileEngine.flipTile(tile)

  // Turret carries over — deploy it on the starting tile of the new floor
  if (session.run.turret?.hp > 0 && !session.run.atRest) {
    session.run.turret.row = tile.row
    session.run.turret.col = tile.col
    _syncTurretVisual()
    _engineerTurretSeismicPing(tile.row, tile.col)
    UI.setMessage(`🛡️ Your turret followed you to floor ${session.run.floor}.`)
  }
  _tickPoisonArrowDotOnGlobalTurn()
  TileEngine.refreshAllThreatClueDisplays()
}

// ── Tile tap router ──────────────────────────────────────────
// ── Angry Onion helpers ───────────────────────────────────────

/** Extra mana cost while Teary Eyes debuff is active. */
function _tearyExtraCost() {
  return (session.run?.player?.tearyEyesTurns ?? 0) > 0 ? 1 : 0
}

/** Apply / refresh Teary Eyes debuff on the player (2 turns). */
function _applyTearyEyes() {
  if (!session.run) return
  session.run.player.tearyEyesTurns = 2
  UI.setTearyEyes(2)
  UI.spawnFloat(document.getElementById('hud-portrait'), '💧 Teary Eyes!', 'damage')
}

/**
 * Called after any HP reduction on the Angry Onion.
 * Strips a layer when HP crosses the 2/3 or 1/3 max-HP threshold,
 * increasing damage each time.
 */
function _checkOnionLayer(tile) {
  const e = tile?.enemyData
  if (!e || e._slain || e.enemyId !== 'onion') return
  const maxHp = e.hp
  const currentLayer = e.onionLayer ?? 3
  const layer2Threshold = Math.ceil(maxHp * 2 / 3)
  const layer1Threshold = Math.ceil(maxHp * 1 / 3)

  let newLayer = currentLayer
  if (currentLayer >= 3 && e.currentHP < layer2Threshold) newLayer = 2
  if (currentLayer >= 2 && e.currentHP < layer1Threshold) newLayer = 1
  if (newLayer === currentLayer) return

  e.onionLayer = newLayer
  e.dmg        = newLayer === 1 ? [2, 2] : [1, 2]
  e.hitDamage  = null
  TileEngine.rollEnemyHitDamage(e)
  TileEngine.refreshEnemyDamageOnTile(tile)

  const emoji = newLayer === 1 ? '😡' : '😤'
  UI.spawnFloat(tile.element, `${emoji} Angrier!`, 'damage')
  UI.shakeTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'hit2' })
}

/** Keep `.locked` (red X) aligned with `tile.locked` on every tile — DOM can drift after unlock/repair paths. */
function _syncAllUnrevealedLockedDom() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      const el = t.element
      if (!el) continue
      if (t.revealed) {
        el.classList.remove('locked')
      } else {
        el.classList.toggle('locked', !!t.locked)
      }
    }
  }
}




/**
 * Reveal the exit tile on the main floor (map pickup reward).
 * Finds any unrevealed exit tile and flips it in place.
 */


/** Fade out and clear the icon on a collected sub-floor tile (gold, heart). */












function onTileTap(row, col) { TapRouter.onTileTap(_tapCtx(), row, col) }

function _confirmExit(tile) {
  if (tile.type !== 'exit' || tile.exitResolved) return
  if (session.run.floorModifier?.id === 'warded-dungeon') {
    const grid = TileEngine.getGrid()
    const total = grid.reduce((s, row) => s + row.length, 0)
    const threshold = Math.ceil(total * 0.60)
    if (session.run.tilesRevealed < threshold) {
      UI.setMessage(`🔒 Warded Dungeon — the exit won't open until ${threshold} tiles are revealed (${session.run.tilesRevealed}/${threshold}).`, true)
      return
    }
  }
  tile.exitResolved = true
  tile.element?.classList.remove('exit-pending')
  _handleExit()
}

function abilitySlotAAction() {
  if (_charKey() === 'ranger') ricochetAction()
  else if (_charKey() === 'engineer') constructTurretAction()
  else if (_charKey() === 'mage') chainLightningAction()
  else if (_charKey() === 'necromancer') strengthenMinionAction()
  else if (_charKey() === 'vampire') bloodTitheAction()
  else slamAction()
}



















// ── Mage: Chain Lightning ─────────────────────────────────────

/** Per-zap damage for Chain Lightning: equal across bounces, scaled by mage mastery. */






/** Pick `count` distinct random entries from `pool` (returns a new array). */




// ── Mage: Telekinetic Throw ───────────────────────────────────





/** True if `tile` is a safe destination for Telekinetic Throw — revealed empty, no content. */


/** True if `tile` holds a valid TK Throw pickup target — revealed living non-boss non-immune. */












/** Re-render a single tile's DOM in-place from its model. For sub-floors we re-render the whole grid. */


/** Sub-floor local version of recomputeAllEnemyLocks — mirrors TileEngine behaviour for sf.tiles. */
















function lanternAction() {
  const inv = session.run.player.inventory
  const entry = inv.find(e => e?.id === 'lantern')
  if (!entry) return
  if (session.tap.combatBusy) return
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

  session.tap.spyglassTargeting = false
  session.tap.lanternTargeting = !session.tap.lanternTargeting
  UI.setLanternTargeting(session.tap.lanternTargeting)
  if (session.tap.lanternTargeting) {
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    UI.setMessage('🏮 Lantern lit — tap any hidden tile to reveal it.')
  } else {
    UI.setMessage('Lantern extinguished.')
  }
}

function spyglassAction() {
  const inv = session.run.player.inventory
  const entry = inv.find(e => e?.id === 'spyglass')
  if (!entry) return
  if (session.tap.combatBusy) return
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

  if (session.tap.spellTargeting) {
    session.tap.spellTargeting = false
    const effectiveCost = _previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (session.tap.lanternTargeting) {
    session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
  }
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (session.tap.blindingLightTargeting) {
    session.tap.blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (session.tap.divineLightSelecting) {
    session.tap.divineLightSelecting = false
    UI.setDivineLightActive(false)
  }

  session.tap.spyglassTargeting = !session.tap.spyglassTargeting
  UI.setLanternTargeting(session.tap.spyglassTargeting)
  if (session.tap.spyglassTargeting) {
    UI.setMessage('🔭 Spyglass raised — tap a hidden tile to glimpse it.')
  } else {
    UI.setMessage('Spyglass lowered.')
  }
}

function hourglassAction() {
  if (!session.run._hourglassSnapshot) {
    UI.setMessage('Nothing to rewind yet.', true)
    return
  }
  if (session.tap.combatBusy) {
    UI.setMessage('Not while combat is resolving.', true)
    return
  }
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  if (GameState.is(States.LEVEL_UP)) {
    UI.setMessage('Cannot rewind during level-up.', true)
    return
  }
  const p = session.run.player
  if (p.gold < 1) {
    UI.setMessage('You need 1 gold to use Hourglass Sand.', true)
    return
  }
  _restoreHourglassSnapshot(session.run._hourglassSnapshot)
  session.tap.spyglassTargeting = false
  session.tap.lanternTargeting = false
  UI.setLanternTargeting(false)
  p.mana = 0
  p.hp -= 1
  p.gold -= 1
  UI.updateMana(p.mana, p.maxMana)
  UI.updateHP(p.hp, p.maxHp)
  UI.updateGold(p.gold)
  if (p.hp <= 0) {
    _die(null, { deathCause: 'hourglass' })
    return
  }
  UI.setMessage('⏳ The sands reverse — your last step is undone, at a grim price.')
  EventBus.emit('audio:play', { sfx: 'spell' })
}

function _useLanternOn(tile) {
  session.tap.lanternTargeting = false
  session.tap.spyglassTargeting = false
  UI.setLanternTargeting(false)

  const inv   = session.run.player.inventory
  const entry = inv.find(e => e?.id === 'lantern')
  if (!entry) return

  // Consume lantern
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)

  revealTile(tile)
  UI.setMessage('🏮 The lantern burns bright — a tile revealed!')
}

function dowsingRodAction() {
  const inv = session.run.player.inventory
  const entry = inv.find(e => e?.id === 'dowsing-rod')
  if (!entry) return
  if (session.tap.combatBusy) return
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

  // Find closest unrevealed trap by Manhattan distance to any revealed tile
  const tiles = _getActiveTiles()
  const revealed = tiles.filter(t => t.revealed)
  const traps = tiles.filter(t => !t.revealed && t.type === 'trap')

  if (traps.length === 0) {
    UI.setMessage('🪄 The rod is still — no traps lurk nearby.', true)
    return
  }

  let best = null
  let bestDist = Infinity
  for (const trap of traps) {
    let minDist = Infinity
    for (const r of revealed) {
      const d = Math.abs(trap.row - r.row) + Math.abs(trap.col - r.col)
      if (d < minDist) minDist = d
    }
    if (minDist < bestDist) { bestDist = minDist; best = trap }
  }

  if (!best) {
    UI.setMessage('🪄 The rod is still — no traps lurk nearby.', true)
    return
  }

  // Consume one charge
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)

  // Safe reveal: set flag + patch DOM, do NOT call revealTile() which triggers trap damage
  best.revealed = true
  const patched = TileEngine.patchMainGridTileAt(best.row, best.col, UI.getGridEl(), onTileTap, onTileHold)
  if (!patched) _refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    _syncGridDomClassesFromModel()
  }

  UI.setMessage('🪄 The rod twitches — a nearby trap is revealed!')
  EventBus.emit('audio:play', { sfx: 'spell' })
  _saveActiveRun()
}

function _useSpyglassOn(tile) {
  session.tap.spyglassTargeting = false
  session.tap.lanternTargeting = false
  UI.setLanternTargeting(false)

  const inv   = session.run.player.inventory
  const entry = inv.find(e => e?.id === 'spyglass')
  if (!entry) return

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)

  const label = _spyglassHintLabel(tile.type)
  const cat   = _echoCharmCategoryForTileType(tile.type)
  tile.echoHintCategory = cat
  if (tile.element) {
    tile.element.classList.add('echo-hint')
    tile.element.dataset.echoHint = cat
  }
  UI.spawnFloat(tile.element, label, 'mana')
  UI.setMessage(`🔭 You glimpse: ${label}`)
  EventBus.emit('audio:play', { sfx: 'menu' })
  _saveActiveRun()
}









// ── Divine Light ──────────────────────────────────────────────









// ── Hasty Retreat ────────────────────────────────────────────

function doRetreat(reason = 'player') { GSH.doRetreat(_stateCtx(), reason) }

// ── Floor progression ────────────────────────────────────────

// ── Player stat helpers ──────────────────────────────────────

function _takeDamage(amount, tileEl, skipPortraitAnim = false, killerData = null, opts = {}) {
  if (!session.run) return
  const enemyAttack = opts.enemyAttack === true
  if (enemyAttack && _charKey() === 'engineer' && session.run.turret?.hp > 0) {
    _damageTurretFromEnemyHit(amount, tileEl)
    return
  }
  if (enemyAttack && _charKey() === 'necromancer' && session.run.minions?.some(m => m.hp > 0)) {
    _necroMinionAbsorbDamage(amount, tileEl, session.run.activeCombatTile)
    return
  }
  if (session.save.settings.cheats?.godMode) return
  // Shield Shard: absorb next hit entirely
  if (session.run?.player?.shieldShard) {
    session.run.player.shieldShard = false
    UI.spawnFloat(tileEl, '🛡️ Blocked!', 'heal')
    return
  }
  if (hasItem('') && Math.random() < 0.05) {
    UI.spawnFloat(tileEl, '🃏 Gambit!', 'heal')
    return
  }
  if (hasItem('') && Math.random() < 0.02) {
    UI.spawnFloat(tileEl, '🐰 Lucky!', 'heal')
    return
  }
  let effective = _computeEffectiveDamageTaken(amount)
  // Mana Shield: absorb a portion of damage by draining mana
  if (_charKey() === 'mage' && session.run.player.manaShieldActive && session.run.player.mana > 0) {
    const rate       = _manaShieldAbsorptionRate()
    const drainRatio = _manaShieldDrainRatio()
    const wantAbsorb = Math.max(1, Math.floor(effective * rate))
    const wantDrain  = Math.max(1, Math.round(wantAbsorb * drainRatio))
    const actualDrain  = Math.min(session.run.player.mana, wantDrain)
    const actualAbsorb = wantDrain > 0 ? Math.min(wantAbsorb, Math.round(wantAbsorb * actualDrain / wantDrain)) : 0
    session.run.player.mana -= actualDrain
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    if (actualAbsorb > 0) UI.spawnFloat(tileEl, `-${actualAbsorb} MP`, 'xp')
    effective = Math.max(0, effective - actualAbsorb)
    if (session.run.player.mana <= 0) {
      session.run.player.manaShieldActive = false
      _refreshMageHud()
      const msStacks = session.run.player.mageActiveStacks?.['mana-shield'] ?? 0
      if (msStacks >= 3) {
        const [dmgMin, dmgMax] = _playerDamageRange(session.run.player)
        const explosionDmg = Math.floor((dmgMin + dmgMax) / 2)
        for (const t of _getActiveTiles()) {
          if (t.revealed && t.enemyData && !t.enemyData._slain) {
            t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - explosionDmg)
            UI.spawnFloat(t.element, `💥 ${explosionDmg}`, 'damage')
            if (t.enemyData.currentHP <= 0) t.enemyData._slain = true
          }
        }
        UI.setMessage(`💥 Mana Shield collapsed and exploded for ${explosionDmg} damage!`)
      } else {
        UI.setMessage('🔵 Mana Shield collapsed!')
      }
    }
    if (effective <= 0) {
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      return
    }
  }
  // Armor / Negation — combat hits only (traps and self-damage bypass armor)
  if (enemyAttack && effective > 0 && (session.run.player.armor ?? 0) > 0) {
    const negation = Math.min(session.run.player.negation ?? 0, CONFIG.armor.negationCap)
    if (negation > 0 && Math.random() < negation) {
      // Negation proc: armor preserved, hit fully blocked
      UI.spawnFloat(tileEl, '🛡️ Blocked!', 'armor')
      UI.setMessage('The blow glances off your armor — blocked!')
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      return
    }
    // Armor absorption: absorbs the entire hit, costs 1 armor point
    session.run.player.armor -= 1
    UI.updateArmor(session.run.player.armor)
    if (session.run.player.armor === 0) {
      UI.spawnFloat(tileEl, '🛡️ Shattered!', 'damage')
      UI.setMessage('Your armor shatters under the blow!')
    } else {
      UI.spawnFloat(tileEl, '🛡️ -1 Armor', 'armor')
    }
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    return
  }

  // Pauper's Crown: drain gold before HP
  if (session.run.player.inventory?.some(e => e?.id === 'paupers-crown')) {
    const goldDrained = Math.min(session.run.player.gold, effective)
    session.run.player.gold  -= goldDrained
    UI.updateGold(session.run.player.gold)
    if (goldDrained > 0) UI.spawnFloat(tileEl, `-${goldDrained}🪙`, 'damage')
    const hpDmg = effective - goldDrained
    if (hpDmg <= 0) return
    session.run.player.hp = Math.max(0, session.run.player.hp - hpDmg)
    if (session.run.telemetry && hpDmg > 0) {
      session.run.telemetry.totalDamageTaken += hpDmg
      _telemetryBumpDamageTaken(session.run.floor, hpDmg)
      _telemetryBumpDamageSource(opts.deathCause ?? (opts.enemyAttack ? 'combat' : 'other'), hpDmg)
    }
    UI.spawnFloat(tileEl, `-${hpDmg} HP`, 'damage')
  } else {
    session.run.player.hp = Math.max(0, session.run.player.hp - effective)
    if (session.run.telemetry && effective > 0) {
      session.run.telemetry.totalDamageTaken += effective
      _telemetryBumpDamageTaken(session.run.floor, effective)
      _telemetryBumpDamageSource(opts.deathCause ?? (opts.enemyAttack ? 'combat' : 'other'), effective)
    }
    UI.spawnFloat(tileEl, `-${effective} HP`, 'damage')
  }
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  if (opts.hapticChannel === 'gesture') {
    _hapticFromUserGesture(55)
  } else {
    _hapticFromAsyncTask(55)
  }
  UI.shakeScreenDamage()
  EventBus.emit('player:hpChange', { amount: -effective, newHP: session.run.player.hp })
  // Resurrection Stone: prevent death once, restore half max HP
  if (session.run.player.hp <= 0 && !session.run.player.resurrectionUsed &&
      session.run.player.inventory?.some(e => e?.id === 'resurrection-stone')) {
    session.run.player.resurrectionUsed = true
    session.run.player.hp = Math.max(1, Math.floor(session.run.player.maxHp / 2))
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(tileEl, '💎 Resurrected!', 'heal')
    UI.setMessage('💎 The Resurrection Stone shatters — you cling to life!')
    // Remove the stone from inventory
    const inv = session.run.player.inventory
    const idx = inv.findIndex(e => e.id === 'resurrection-stone')
    if (idx !== -1) inv.splice(idx, 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (session.run.player.hp <= 0) { _die(killerData, opts.deathCause ? { deathCause: opts.deathCause } : {}); return }
  // Auto-potion: use a health potion if HP drops below 30% threshold (player setting)
  if (session.save.settings?.autoPotions && session.run.player.hp > 0) {
    const ratio = session.run.player.hp / session.run.player.maxHp
    if (ratio < 0.30) {
      const inv = session.run.player.inventory
      const potEntry = inv.find(e => e?.id === 'potion-red' && e.qty > 0)
      if (potEntry) {
        const healed = Math.min(ITEMS['potion-red'].effect.amount, session.run.player.maxHp - session.run.player.hp)
        if (healed > 0) {
          session.run.player.hp += healed
          potEntry.qty--
          if (potEntry.qty <= 0) inv.splice(inv.indexOf(potEntry), 1)
          UI.updateHP(session.run.player.hp, session.run.player.maxHp)
          UI.spawnFloat(tileEl ?? document.getElementById('hud-portrait'), `🧪 Auto +${healed} HP`, 'heal')
          EventBus.emit('inventory:changed')
        }
      }
    }
  }
  // Thorn Wrap / Inferno Barbs / Barbed Mantle / Living Bramble: reflect damage to attacker
  const hasThorn        = session.run.player.inventory.some(e => e?.id === 'thorn-wrap')
  const hasInferno      = session.run.player.inventory.some(e => e?.id === 'inferno-barbs')
  const hasBarbedMantle = session.run.player.inventory.some(e => e?.id === 'barbed-mantle')
  const hasLivingBramble = session.run.player.inventory.some(e => e?.id === 'living-bramble')
  if (killerData && !killerData._slain && (hasThorn || hasInferno || hasBarbedMantle || hasLivingBramble)) {
    const reflectDmg = hasInferno ? 2 : hasBarbedMantle ? 3 : 1
    killerData.currentHP = Math.max(0, killerData.currentHP - reflectDmg)
    const reflectLabel = hasInferno ? `🌋 Barbs! −${reflectDmg}` : hasBarbedMantle ? `🦔 Barbed! −${reflectDmg}` : '🌿 Thorn!'
    UI.spawnFloat(tileEl, reflectLabel, 'heal')
    if (hasInferno) _applyBurnHit(1)   // Inferno Barbs also burns attacker
    if (killerData.currentHP <= 0) {
      const combatTile = session.run.activeCombatTile
      if (combatTile) {
        _gainGold(combatTile.enemyData?.goldDrop ? _rand(...combatTile.enemyData.goldDrop) : 1, combatTile.element, true)
        _gainXP(combatTile.enemyData?.xpDrop ?? 0, combatTile.element)
        _endCombatVictory(combatTile)
      }
    } else if (session.run.activeCombatTile) {
      UI.updateEnemyHP(session.run.activeCombatTile.element, killerData.currentHP)
    }
  }
  if (!skipPortraitAnim) {
    UI.setPortraitAnim('hit')
    setTimeout(() => UI.setPortraitAnim('idle'), 800)
  }
}

function _gainGold(amount, tileEl, fromEnemy = false, fromChest = false) {
  if (!session.run) return
  let actual = amount
  if (fromEnemy) {
    if (session.run.player.inventory.some(e => e?.id === 'misers-pouch')) actual += 1
    if (session.run.player.inventory.some(e => e?.id === 'tomb-tithe')) actual += 1
    if (session.run.player.inventory.some(e => e?.id === 'gamblers-mark')) actual = Math.random() < 0.5 ? 0 : actual * 2
    if (session.run.player.inventory.some(e => e?.id === 'fortunes-fool')) actual *= 2
    if (session.run.player.inventory.some(e => e?.id === 'devils-gambit') && Math.random() < 0.20) actual *= 2
    if (session.run.player.inventory.some(e => e?.id === 'vault-key')) actual += 2
    actual = Math.round(actual)
  }
  // Fortune's Fool: also doubles chest gold
  if (fromChest && session.run.player.inventory.some(e => e?.id === 'fortunes-fool')) actual *= 2
  // Floor modifiers: Ancient Cache (chest double gold) and Hungry Dungeon (halve enemy/chest gold)
  if (session.run.floorModifier?.id === 'ancient-cache' && fromChest) actual *= 2
  if (session.run.floorModifier?.id === 'hungry-dungeon' && (fromEnemy || fromChest)) actual = Math.max(0, Math.floor(actual / 2))
  // Vault Key: auto-bank 15% of all earned gold to persistent gold
  if (session.run.player.inventory.some(e => e?.id === 'vault-key') && actual > 0) {
    const bank = Math.floor(actual * 0.15)
    if (bank > 0) {
      session.save.persistentGold = (session.save.persistentGold ?? 0) + bank
      UI.spawnFloat(tileEl, `🗝️ +${bank} banked`, 'gold')
    }
  }
  // Philosopher's Coin: all gold × 5
  if (session.run.player.inventory.some(e => e?.id === 'philosophers-coin')) actual *= 5
  if (actual <= 0) {
    UI.spawnFloat(tileEl, '♠️ No gold!', 'damage')
    return
  }
  session.run.player.gold += actual
  _telemetryBumpGold(session.run.floor, actual)
  UI.spawnFloat(tileEl, `+${actual}🪙`, 'gold')
  UI.updateGold(session.run.player.gold)
  EventBus.emit('player:goldChange', { amount: actual, newTotal: session.run.player.gold })
}

function _isSilenced() {
  if (!session.run?.floorModifier || session.run.floorModifier.id !== 'silence') return false
  UI.setMessage('🤫 Silence — active abilities are sealed this floor.', true)
  return true
}

/** +mana on successful melee strike (not on shield block — see fightAction). Mana ring: 10% double. Mana Crucible: +1 guaranteed. */
function _gainManaFromMeleeHit(tileEl) {
  if (!session.run?.player) return
  const add = CONFIG.player.manaPerMeleeHit ?? 0
  const hasManaRing     = session.run.player.inventory.some(e => e?.id === 'mana-ring')
  const hasCrucible     = session.run.player.inventory.some(e => e?.id === 'mana-crucible')
  let gain = 0
  if (add > 0) {
    gain += (hasManaRing && Math.random() < 0.10) ? add * 2 : add
  }
  if (hasCrucible) gain += 1
  if (gain <= 0 || session.run.player.mana >= session.run.player.maxMana) return
  session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + gain)
  if (hasManaRing && gain > add) {
    UI.spawnFloat(tileEl, `+${gain}🔵`, 'mana')
  } else if (hasCrucible) {
    UI.spawnFloat(tileEl, '+1🔵', 'mana')
  }
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
}

function _gainXP(amount, tileEl) {
  if (!session.run) return
  session.run.player.xp += amount
  const needed = _xpNeeded()
  if (session.run.player.xp >= needed) {
    if (_shouldDeferLevelUpDueToNpc()) {
      UI.updateXP(session.run.player.xp, _xpNeeded())
      return
    }
    session.run.player.xp -= needed
    session.run.player.level++
    UI.spawnFloat(tileEl, `⬆️ Lv ${session.run.player.level}!`, 'xp')
    EventBus.emit('player:levelup', { newLevel: session.run.player.level })
    EventBus.emit('audio:play', { sfx: 'levelup' })
    _triggerLevelUp()
  }
  UI.updateXP(session.run.player.xp, _xpNeeded())
}

function _metaUnlockedForLevelUp() {
  const c = _charKey()
  if (c === 'ranger') return session.save.ranger?.upgrades ?? []
  if (c === 'engineer') return session.save.engineer?.upgrades ?? []
  if (c === 'mage') return session.save.mage?.upgrades ?? []
  if (c === 'vampire') return session.save.vampire?.upgrades ?? []
  if (c === 'necromancer') return session.save.necromancer?.upgrades ?? []
  return session.save.warrior?.upgrades ?? []
}

/** Ability-pick level-up uses GameState.LEVEL_UP, which is invalid during NPC events — defer until back on the floor. */
function _shouldDeferLevelUpDueToNpc() {
  if (!GameState.is(States.NPC_INTERACT)) return false
  const choices = ProgressionSystem.getChoices(session.run.player, _charKey(), _metaUnlockedForLevelUp())
  return choices.length > 0
}

/**
 * Apply deferred XP level-ups once we're in FLOOR_EXPLORE (e.g. after closing a story / merchant overlay).
 * Handles multiple stacked levels; stops when an ability-pick overlay is shown.
 */
function _flushDeferredLevelUpXp() {
  if (!session.run || GameState.is(States.NPC_INTERACT)) return
  const floatEl = () => document.getElementById('hud-portrait')
  while (session.run.player.xp >= _xpNeeded()) {
    if (_shouldDeferLevelUpDueToNpc()) break
    session.run.player.xp -= _xpNeeded()
    session.run.player.level++
    UI.spawnFloat(floatEl(), `⬆️ Lv ${session.run.player.level}!`, 'xp')
    EventBus.emit('player:levelup', { newLevel: session.run.player.level })
    EventBus.emit('audio:play', { sfx: 'levelup' })
    const choices = ProgressionSystem.getChoices(session.run.player, _charKey(), _metaUnlockedForLevelUp())
    if (choices.length === 0) {
      _triggerLevelUp()
      continue
    }
    _triggerLevelUp()
    break
  }
  UI.updateXP(session.run.player.xp, _xpNeeded())
}

function _triggerLevelUp() {
  const char     = _charKey()
  const count    = session.run.player.extraAbilityChoice ? 4 : 3
  const descs    = ProgressionSystem.getChoices(session.run.player, char, _metaUnlockedForLevelUp(), count)
  if (descs.length === 0) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 10)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    session.run.levelUpLog.push({
      level:     session.run.player.level,
      abilityId: null,
      name:      '+10 HP (all choices mastered)',
      icon:      '❤️',
    })
    _appendLevelSnapshot('levelUpMasteryHp')
    UI.setMessage(`Level ${session.run.player.level}! Fully mastered. (+10 HP)`)
    return
  }

  GameState.transition(States.LEVEL_UP)

  // First-pick mode: every choice is a `kind:'active'` and player.level just hit 2.
  const isFirstActivePick = session.run.player.level === 2 && descs.every(d => d.kind === 'active')
  const subtitle = isFirstActivePick
    ? 'Choose your first active ability!'
    : 'Choose an ability'

  const choiceData = descs.map(d => {
    const def = ProgressionSystem.getAbilityDef(d.id, char) ?? {}
    const data = { id: d.id, ...def }
    if (d.kind === 'coins') {
      data.name = 'Coin Pouch'
      data.desc = `+${session.run.floor} gold (filler — pool was empty).`
    }
    if (d.kind === 'active') data.tag = 'NEW ACTIVE'
    return data
  })

    UI.setLevelUpSubtitle(subtitle)
    UI.showLevelUpOverlay(choiceData, (abilityId) => {
      ProgressionSystem.applyAbility(abilityId, session.run.player, char, { floor: session.run.floor })
      const def = ProgressionSystem.getAbilityDef(abilityId, char)
      session.run.levelUpLog.push({
        level:     session.run.player.level,
        abilityId,
        name:      def?.name ?? abilityId,
        icon:      def?.icon ?? '✨',
      })
      _appendLevelSnapshot('levelUp')
      UI.hideLevelUpOverlay()
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.updateGold(session.run.player.gold)
    {
      const [d0, d1] = _playerDamageRange(session.run.player)
      UI.updateDamageRange(d0, d1)
    }
    UI.setMessage(`${def?.name ?? abilityId} acquired! Level ${session.run.player.level}.`)
    if (char === 'ranger')         _refreshRangerActiveHud()
    else if (char === 'engineer')  _refreshEngineerHud()
    else if (char === 'mage')      _refreshMageHud()
    else if (char === 'necromancer') _refreshNecroActiveHud()
    else if (char === 'vampire')   _refreshVampireHud()
    else if (char === 'warrior')   {
      UI.setSlamBtn(_isActiveUnlocked('slam', 'warrior'), WARRIOR_UPGRADES.slam.manaCost)
      UI.setBlindingLightBtn(_isActiveUnlocked('blinding-light', 'warrior'), WARRIOR_UPGRADES['blinding-light'].manaCost)
      UI.setDivineLightBtn(_isActiveUnlocked('divine-light', 'warrior'), WARRIOR_UPGRADES['divine-light'].manaCost)
    }
    GameState.transition(States.FLOOR_EXPLORE)
    _flushDeferredLevelUpXp()
  })
}











/** Stun turns only — same avgMelee × mult formula as old “damage”; no HP loss. Minimum 2 turns. */




/** For Slam info modal — null if no active session.run or not warrior. */










/** Returns [1st, 2nd, 3rd] shot damage for Ricochet (length matches targets). Ricochet only: 4:3:2 with meta Ricochet Mastery. */




/** Poison Arrow initial hit + each DoT tick — same unit formula as Ricochet’s 1× shot. */






// ── Death ────────────────────────────────────────────────────

function _die(killerData = null, opts = {}) { GSH.die(_stateCtx(), killerData, opts) }

function _runStats() { return GSH.runStats(_stateCtx()) }

function _finalizeRunTelemetry(outcomeType, extras = {}) { GSH.finalizeRunTelemetry(_stateCtx(), outcomeType, extras) }

function _wireRunSummaryBtn() { GSH.wireRunSummaryBtn(_stateCtx()) }

function _appendLevelSnapshot(trigger) {
  if (!session.run?.telemetry || !session.run.player) return
  const [d0, d1] = _playerDamageRange(session.run.player)
  session.run.telemetry.levelSnapshots.push(
    buildLevelSnapshotRecord({
      trigger,
      floor: session.run.floor,
      player: session.run.player,
      xpToNext: _xpNeeded(),
      meleeDamageRange: [d0, d1],
    }),
  )
}

function _telemetryBumpDamageTaken(floor, amount) {
  if (!session.run?.telemetry || amount <= 0) return
  const k = String(floor)
  if (!session.run.telemetry.damageByFloor[k]) session.run.telemetry.damageByFloor[k] = { taken: 0, dealt: 0 }
  session.run.telemetry.damageByFloor[k].taken += amount
}

function _telemetryBumpDamageDealt(floor, amount) {
  if (!session.run?.telemetry || amount <= 0) return
  const k = String(floor)
  if (!session.run.telemetry.damageByFloor[k]) session.run.telemetry.damageByFloor[k] = { taken: 0, dealt: 0 }
  session.run.telemetry.damageByFloor[k].dealt += amount
}

function _telemetryBumpDamageSource(source, amount) {
  if (!session.run?.telemetry || amount <= 0) return
  session.run.telemetry.damageSources[source] = (session.run.telemetry.damageSources[source] ?? 0) + amount
}

function _telemetryBumpKill(floor) {
  if (!session.run?.telemetry) return
  const k = String(floor)
  session.run.telemetry.killsByFloor[k] = (session.run.telemetry.killsByFloor[k] ?? 0) + 1
}

function _telemetryBumpGold(floor, amount) {
  if (!session.run?.telemetry || amount <= 0) return
  const k = String(floor)
  session.run.telemetry.goldByFloor[k] = (session.run.telemetry.goldByFloor[k] ?? 0) + amount
}

function _appendFloorSnapshot(trigger) {
  if (!session.run?.telemetry) return
  const grid = TileEngine.getGrid()
  let locked = 0
  let unrevealedUnlocked = 0
  let revealed = 0
  let livingEnemies = 0
  if (grid) {
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed) {
          revealed++
          if (t.enemyData && !t.enemyData._slain) livingEnemies++
        } else if (t.locked) locked++
        else unrevealedUnlocked++
      }
    }
  }
  const isBossFloor = CONFIG.bossFloors.includes(session.run.floor) && !session.run.atRest
  session.run.telemetry.floorSnapshots.push({
    at: Date.now(),
    trigger,
    floor: session.run.floor,
    atRest: !!session.run.atRest,
    isBossFloor,
    level: session.run.player.level,
    hp: session.run.player.hp,
    gold: session.run.player.gold,
    tilesRevealed: session.run.tilesRevealed,
    grid: { locked, unrevealedUnlocked, revealed, livingEnemies },
  })
}


function _rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Inventory / backpack (InventoryController)
function _inventoryCtx() {
  return {
    ..._revealCtx(),
    die: _die,
    restoreHourglassSnapshot: _restoreHourglassSnapshot,
    lanternAction,
    dowsingRodAction,
    spyglassAction,
    hourglassAction,
  }
}

async function _addToBackpack(id) { return InventoryController.addToBackpack(_inventoryCtx(), id) }
function _canAddToBackpack(id) { return InventoryController.canAddToBackpack(_inventoryCtx(), id) }
function useItem(id, inventoryIndex = null) { InventoryController.useItem(_inventoryCtx(), id, inventoryIndex) }
function useItemAtIndex(index) { InventoryController.useItemAtIndex(_inventoryCtx(), index) }
function dropItem(id, inventoryIndex = null) { InventoryController.dropItem(_inventoryCtx(), id, inventoryIndex) }
function dropItemAtIndex(index) { InventoryController.dropItemAtIndex(_inventoryCtx(), index) }
function consolidateStackables() { return InventoryController.consolidateStackables(_inventoryCtx()) }
async function forceReplaceItem(oldId, newId) { return InventoryController.forceReplaceItem(_inventoryCtx(), oldId, newId) }
async function forceReplaceItemAtIndex(index, newId) { return InventoryController.forceReplaceItemAtIndex(_inventoryCtx(), index, newId) }
function acceptPendingGearAtSlot(index, piece) { GearController.acceptPendingGearAtSlot(_gearCtx(), index, piece) }
function swapPendingGearWithEquipped(piece) { GearController.swapPendingGearWithEquipped(_gearCtx(), piece) }

/** Swap PNG→GIF reliably (restart animation from frame 0) across browsers. */
function _forcePlayChestGif(img, gifSrc) {
  if (!img || img.tagName !== 'IMG') return
  img.removeAttribute('src')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.src = gifSrc
    })
  })
}

function _checkFloorCleared() {
  if (session.run.atRest) return
  if (CONFIG.bossFloors.includes(session.run.floor)) return
  if (session.run.floorKeyAwarded) return
  const grid = TileEngine.getGrid()
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === 'enemy' || tile.type === 'enemy_fast') {
        if (!tile.revealed || !tile.enemyData?._slain) return
      }
    }
  }
  session.run.floorKeyAwarded = true
  session.run.player.goldenKeys = (session.run.player.goldenKeys ?? 0) + 1
  UI.updateGoldenKeys(session.run.player.goldenKeys)
  _syncMagicChestKeyGlow()
  UI.spawnFloat(document.getElementById('hud-portrait'), '🗝️ Golden Key!', 'xp')
  UI.setMessage(`Floor cleared! You find a 🗝️ Golden Key. (${session.run.player.goldenKeys} total) Spend it at the Magic Chest in the sanctuary.`)
  EventBus.emit('audio:play', { sfx: 'gold' })
}

function _openMagicChest(tile) {
  const keys = session.run.player.goldenKeys ?? 0
  if (keys <= 0) {
    UI.setMessage('The Magic Chest glimmers… but you have no 🗝️ Golden Keys. Clear a floor without fleeing to earn one.')
    return
  }
  const loot = tile.pendingLoot ?? _rollMagicChestLoot()
  const item = ITEMS[loot.type]
  if (loot.type === 'gold') {
    const amt = loot.amount ?? _rand(...CONFIG.chest.goldDrop)
    session.run.player.goldenKeys--
    UI.updateGoldenKeys(session.run.player.goldenKeys)
    _syncMagicChestKeyGlow()
    tile.pendingLoot = null
    session.run.player.gold += amt
    UI.updateGold(session.run.player.gold)
    EventBus.emit('player:goldChange', { amount: amt, newTotal: session.run.player.gold })
    EventBus.emit('audio:play', { sfx: 'chest' })
    _animateMagicChestOpenClose(tile, `+${amt}🪙`)
    UI.setMessage(`The Magic Chest spills ${amt} gold! (${session.run.player.goldenKeys} keys left)`)
    return
  }
  if (loot.type === 'smiths-tools') {
    session.run.player.goldenKeys--
    UI.updateGoldenKeys(session.run.player.goldenKeys)
    _syncMagicChestKeyGlow()
    tile.pendingLoot = null
    const def = ITEMS['smiths-tools']
    const amt = def?.effect?.amount ?? 1
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + amt
    {
      const [d0, d1] = _playerDamageRange(session.run.player)
      UI.updateDamageRange(d0, d1)
    }
    const floatLabel = `🔧 ${def.name}`
    EventBus.emit('audio:play', { sfx: 'chest' })
    _animateMagicChestOpenClose(tile, floatLabel)
    UI.setMessage(`The Magic Chest grants ${def.name}! +${amt} attack damage. (${session.run.player.goldenKeys} keys left)`)
    return
  }
  if (!_canAddToBackpack(loot.type)) {
    tile.pendingLoot = loot
    UI.setMessage(`Your backpack is full! Drop an item, then tap the Magic Chest again to claim your ${item?.name ?? loot.type}.`)
    return
  }
  session.run.player.goldenKeys--
  UI.updateGoldenKeys(session.run.player.goldenKeys)
  _syncMagicChestKeyGlow()
  tile.pendingLoot = null
  _addToBackpack(loot.type)
  EventBus.emit('inventory:changed')
  const floatLabel = item ? `${item.icon} ${item.name}` : `✨ ${loot.type}`
  EventBus.emit('audio:play', { sfx: 'chest' })
  _animateMagicChestOpenClose(tile, floatLabel)
  UI.setMessage(`✨ The Magic Chest bestows: ${item?.name ?? loot.type}! (${session.run.player.goldenKeys} keys left)`)
}

function _animateMagicChestOpenClose(tile, floatText) {
  const el = tile.element
  if (!el) return
  const closedSrc = ITEM_ICONS_BASE + (TILE_TYPE_ICON_FILES.magic_chest || 'magic-chest-closed.png')
  const gifSrc = ITEM_ICONS_BASE + MAGIC_CHEST_OPEN_GIF + '?t=' + Date.now()
  const wrap = el.querySelector('.tile-icon-wrap')
  const baseImg = el.querySelector('.tile-icon-img')

  const finish = () => {
    el.classList.remove('magic-chest-opening')
    el.classList.remove('magic-chest-animating')
    const imgNow = el.querySelector('.tile-icon-img')
    if (imgNow && imgNow.tagName === 'IMG') imgNow.src = closedSrc
    if (floatText) UI.spawnFloat(el, floatText, 'xp')
  }

  el.classList.add('magic-chest-opening')
  el.classList.add('magic-chest-animating')

  if (baseImg && baseImg.tagName === 'IMG') {
    _forcePlayChestGif(baseImg, gifSrc)
    setTimeout(finish, MAGIC_CHEST_GIF_DURATION_MS)
    return
  }

  if (wrap) {
    const ov = document.createElement('img')
    ov.className = 'tile-icon-img'
    ov.alt = ''
    ov.draggable = false
    ov.style.cssText =
      'position:absolute;inset:0;margin:auto;width:88%;max-width:90px;height:auto;object-fit:contain;pointer-events:none;z-index:4;'
    wrap.appendChild(ov)
    _forcePlayChestGif(ov, gifSrc)
    setTimeout(() => {
      ov.remove()
      finish()
    }, MAGIC_CHEST_GIF_DURATION_MS)
    return
  }

  requestAnimationFrame(finish)
}

function getInventory() { return session.run?.player.inventory ?? [] }

function getLevelUpLog() {
  return session.run?.levelUpLog ? [...session.run.levelUpLog] : []
}

function getRunTelemetry() {
  if (session.run?.telemetry) {
    return {
      telemetry: structuredClone(session.run.telemetry),
      levelUpLog: (session.run.levelUpLog ?? []).slice(),
      runStats: _runStats(),
    }
  }
  if (session.lastRunTelemetrySnapshot) {
    return {
      telemetry: structuredClone(session.lastRunTelemetrySnapshot.telemetry),
      levelUpLog: session.lastRunTelemetrySnapshot.levelUpLog.slice(),
      runStats: { ...session.lastRunTelemetrySnapshot.runStats },
    }
  }
  return null
}

/** Live snapshot for balance-bot / Playwright — not persisted as session.run telemetry until the session.run ends. */
/** Current HP fraction (0–1) for test-bot-ongoing low-HP retreat; null if no session.run. */
function getPlayerHpRatio() {
  if (!session.run?.player?.maxHp) return null
  return session.run.player.hp / session.run.player.maxHp
}

/**
 * Player-facing deadlock detection: no unrevealed tile is reachable, no exit-pending tile waits to
 * be tapped, but unrevealed tiles still exist on the floor. Sub-floors and rest floors are skipped
 * (they have their own exits / sanctuary loop). Returns false during combat / overlays / animations.
 */
function _isPlayerDeadlocked() {
  if (!session.run || _isInSubFloor() || session.run.atRest) return false
  if (!GameState.is(States.FLOOR_EXPLORE)) return false
  if (session.tap.combatBusy) return false
  const grid = TileEngine.getGrid()
  if (!grid) return false
  // Refresh reachability from revealed tiles — stale .reachable on unrevealed cells (e.g. after
  // hazards rerolled mid-floor) could otherwise make this return false when the player is stuck.
  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  let hasUnrevealed = false
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed) {
        if (t.type === 'exit' && !t.exitResolved) return false
        if (t.enemyData && !t.enemyData._slain && t.enemyData.behaviour !== 'archer') return false
        continue
      }
      if (t.locked) continue
      hasUnrevealed = true
      if (t.reachable) return false
    }
  }
  return hasUnrevealed
}

/**
 * On deadlock, pick a revealed pit or rubble tile that touches a revealed passable tile and mark it
 * as a one-time escape. Player taps it to replace it with empty floor and refresh reachability.
 * Idempotent — running again with an existing escape tile re-asserts the message but won't
 * mark a second tile.
 */
function _climbThroughHazard(tile) {
  if (!session.run || !tile?.deadlockEscape) return
  tile.deadlockEscape = false
  tile.element?.classList.remove('deadlock-escape')
  TileEngine.replaceTileWithEmptyPreserveState(tile.row, tile.col)
  const fresh = TileEngine.getTile(tile.row, tile.col)
  fresh.revealed = true
  TileEngine.patchMainGridTileAt(tile.row, tile.col, UI.getGridEl(), onTileTap, onTileHold)
  TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  UI.setMessage('You clear the hazard and find a new path.')
}

/** Remove one item from backpack (stack −1 or remove slot). Does not apply use effects. */
// ── Balance bot bridge + cheat (extracted controllers) ───────

function _botFlags() {
  return {
    get spellTargeting() { return session.tap.spellTargeting },
    set spellTargeting(v) { session.tap.spellTargeting = v },
    get lanternTargeting() { return session.tap.lanternTargeting },
    set lanternTargeting(v) { session.tap.lanternTargeting = v },
    get spyglassTargeting() { return session.tap.spyglassTargeting },
    set spyglassTargeting(v) { session.tap.spyglassTargeting = v },
    get blindingLightTargeting() { return session.tap.blindingLightTargeting },
    set blindingLightTargeting(v) { session.tap.blindingLightTargeting = v },
    get divineLightSelecting() { return session.tap.divineLightSelecting },
    set divineLightSelecting(v) { session.tap.divineLightSelecting = v },
    get ricochetSelecting() { return session.tap.ricochetSelecting },
    set ricochetSelecting(v) { session.tap.ricochetSelecting = v },
    get arrowBarrageSelecting() { return session.tap.arrowBarrageSelecting },
    set arrowBarrageSelecting(v) { session.tap.arrowBarrageSelecting = v },
    get poisonArrowShotSelecting() { return session.tap.poisonArrowShotSelecting },
    set poisonArrowShotSelecting(v) { session.tap.poisonArrowShotSelecting = v },
    get engineerPendingTile() { return session.tap.engineerPendingTile },
    set engineerPendingTile(v) { session.tap.engineerPendingTile = v },
    get throwingKnifeTargeting() { return session.tap.throwingKnifeTargeting },
    set throwingKnifeTargeting(v) { session.tap.throwingKnifeTargeting = v },
    get twinBladesTargeting() { return session.tap.twinBladesTargeting },
    set twinBladesTargeting(v) { session.tap.twinBladesTargeting = v },
    get rustyNailTargeting() { return session.tap.rustyNailTargeting },
    set rustyNailTargeting(v) { session.tap.rustyNailTargeting = v },
    get tripleVolleyCenter() { return session.tap.tripleVolleyCenter },
  }
}

function _botDeps() {
  return {
    getRun: () => session.run,
    getSave: () => session.save,
    GameState,
    States,
    UI,
    TileEngine,
    ITEMS,
    WARRIOR_UPGRADES,
    getCombatBusy: () => session.tap.combatBusy,
    flags: _botFlags(),
    charKey: _charKey,
    closeEventSession: _closeEventSession,
    flushDeferredLevelUpXp: _flushDeferredLevelUpXp,
    previewSpellManaCostForUi: _previewSpellManaCostForUi,
    stillWaterManaCost: _stillWaterManaCost,
    tearyExtraCost: _tearyExtraCost,
    isCombatCommitmentLocked: _isCombatCommitmentLocked,
    getActiveTileAt: _getActiveTileAt,
    getCombatEngagementTile: () => session.tap.combatEngagementTile,
    getRicochetTiles: () => session.tap.ricochetTiles,
    getTripleVolleyCenter: () => session.tap.tripleVolleyCenter,
    cancelPoisonArrowShotMode: _cancelPoisonArrowShotMode,
    divineLightHealAction,
    lanternAction,
    spyglassAction,
    spellAction,
    slamAction,
    blindingLightAction,
    divineLightAction,
    playerDamageRange: _playerDamageRange,
    markReachableUi: _markReachableUi,
  }
}

function _cheatDeps() {
  return {
    getSave: () => session.save,
    getRun: () => session.run,
    GameState,
    States,
    UI,
    EventBus,
    SaveManager,
    xpNeeded: _xpNeeded,
    playerDamageRange: _playerDamageRange,
    triggerLevelUp: _triggerLevelUp,
    syncMagicChestKeyGlow: _syncMagicChestKeyGlow,
    nextFloor: _nextFloor,
    startFloor: _startFloor,
    runMusicTrack: _runMusicTrack,
  }
}

function getBalanceBotUseItemCandidates() {
  return BalanceBotBridge.getBalanceBotUseItemCandidates(_botDeps())
}

function getBalanceBotTapCandidates() {
  return BalanceBotBridge.getBalanceBotTapCandidates(_botDeps())
}

function balanceBotTryOpenRevealTool() {
  return BalanceBotBridge.balanceBotTryOpenRevealTool(_botDeps())
}

function getBalanceBotDiagnostics() {
  return BalanceBotBridge.getBalanceBotDiagnostics(_botDeps())
}

function getBalanceBotDeadlockDiagnostics() {
  return BalanceBotBridge.getBalanceBotDeadlockDiagnostics(_botDeps())
}

function balanceBotRepairReachability() {
  return BalanceBotBridge.balanceBotRepairReachability(_botDeps())
}

function balanceBotForceUnlockAll() {
  return BalanceBotBridge.balanceBotForceUnlockAll(_botDeps())
}

function balanceBotTryWarriorAbilities(abilityWeights = {}) {
  return BalanceBotBridge.balanceBotTryWarriorAbilities(_botDeps(), abilityWeights)
}

function balanceBotTryAbilitiesPolicy(abilityWeights = {}) {
  return BalanceBotBridge.balanceBotTryAbilitiesPolicy(_botDeps(), abilityWeights)
}

function balanceBotDismissNpcEvent() {
  return BalanceBotBridge.balanceBotDismissNpcEvent(_botDeps())
}

function applyCheat(key, enabled) {
  CheatController.applyCheat(_cheatDeps(), key, enabled)
}

function cheatSkipFloor() {
  CheatController.cheatSkipFloor(_cheatDeps())
}

function cheatHudStatBoost(stat) {
  CheatController.cheatHudStatBoost(_cheatDeps(), stat)
}

const uiButtonHaptic = Haptics.uiButtonHaptic

// ── Test harness (?testHarness=1 — inert in normal play) ───────

function _deepMergeSaveOverrides(target, overrides) {
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (
      v && typeof v === 'object' && !Array.isArray(v)
      && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])
    ) {
      _deepMergeSaveOverrides(target[k], v)
    } else {
      target[k] = v
    }
  }
}

function testHarnessSetupRun(opts = {}) {
  const { hero = 'warrior', floor = 1, saveOverrides = {}, playerOverrides = {} } = opts
  if (!session.save) return false
  if (hero) session.save.selectedCharacter = hero
  session.save.settings = session.save.settings ?? {}
  session.save.settings.firstRunIntroDismissed = true
  session.save.settings.parryChoiceDismissed = true
  session.save.settings.parryEnabled = false
  _deepMergeSaveOverrides(session.save, saveOverrides)
  if (session.run) {
    _clearActiveRun()
    session.run = null
  } else if (session.save.activeRun) {
    delete session.save.activeRun
  }
  newGame()
  if (!session.run) return false
  if (floor !== session.run.floor) session.run.floor = floor
  if (Object.keys(playerOverrides).length) Object.assign(session.run.player, playerOverrides)
  UI.updateFloor(session.run.floor, { rest: session.run.atRest })
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateGold(session.run.player.gold)
  UI.updateXP(session.run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  return true
}

function testHarnessImportGrid(snapshot) {
  if (!session.run || !snapshot) return false
  const ok = TileEngine.importGridFromSnapshot(snapshot, session.run.floor, { rest: session.run.atRest })
  if (!ok) return false
  let revealed = 0
  let startRow = null
  let startCol = null
  for (let r = 0; r < snapshot.length; r++) {
    for (let c = 0; c < snapshot[r].length; c++) {
      const st = snapshot[r][c]
      if (st.revealed) {
        revealed++
        if (st.type === 'empty' && startRow == null) {
          startRow = r
          startCol = c
        }
      }
    }
  }
  session.run.tilesRevealed = revealed
  if (startRow != null) {
    session.run.floorStartRow = startRow
    session.run.floorStartCol = startCol
  }
  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  _syncGridDomClassesFromModel()
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  return true
}

function testHarnessGetSnapshot() {
  const grid = TileEngine.getGrid()
  return {
    gameState: GameState.current(),
    playerHp: session.run?.player?.hp ?? null,
    playerMaxHp: session.run?.player?.maxHp ?? null,
    playerGold: session.run?.player?.gold ?? null,
    playerXp: session.run?.player?.xp ?? null,
    floor: session.run?.floor ?? null,
    inventory: session.run?.player?.inventory?.map(e => e?.id ?? null) ?? null,
    grid: grid
      ? grid.map(row => row.map(t => ({
        type: t.type,
        revealed: t.revealed,
        enemySlain: !!(t.enemyData?._slain),
        chestLooted: !!t.chestLooted,
      })))
      : null,
  }
}

function testHarnessForceLevelUp() {
  if (!session.run) return false
  if (_shouldDeferLevelUpDueToNpc()) return false
  const needed = _xpNeeded()
  session.run.player.xp = needed
  session.run.player.xp -= needed
  session.run.player.level++
  UI.spawnFloat(document.getElementById('hud-portrait'), `⬆️ Lv ${session.run.player.level}!`, 'xp')
  _triggerLevelUp()
  return GameState.is(States.LEVEL_UP)
}

function testHarnessPickLevelUp(abilityId) {
  if (!session.run || !GameState.is(States.LEVEL_UP)) return false
  const char = _charKey()
  ProgressionSystem.applyAbility(abilityId, session.run.player, char, { floor: session.run.floor })
  const def = ProgressionSystem.getAbilityDef(abilityId, char)
  session.run.levelUpLog.push({
    level: session.run.player.level,
    abilityId,
    name: def?.name ?? abilityId,
    icon: def?.icon ?? '✨',
  })
  _appendLevelSnapshot('levelUp')
  UI.hideLevelUpOverlay()
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateGold(session.run.player.gold)
  {
    const [d0, d1] = _playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setMessage(`${def?.name ?? abilityId} acquired! Level ${session.run.player.level}.`)
  GameState.transition(States.FLOOR_EXPLORE)
  _flushDeferredLevelUpXp()
  return true
}

export default {
  init,
  getSave() { return session.save },
  isRangerActiveUnlocked: _isRangerActiveUnlocked,
  isMageActiveUnlocked:   _isMageActiveUnlocked,
  getSlamDamageBreakdown,
  getBlindingLightBreakdown,
  getDivineLightBreakdown,
  getRicochetBreakdown,
  getArrowBarrageBreakdown,
  getPoisonArrowShotBreakdown,
  getChainLightningBreakdown,
  getTelekineticThrowBreakdown,
  getBloodTitheBreakdown,
  getBloodPactBreakdown,
  newGame,
  returnToMenu,
  onTileTap,
  spellAction,
  slamAction,
  abilitySlotAAction,
  constructTurretAction,
  teslaTowerAction,
  manaGeneratorAction,
  ricochetAction,
  arrowBarrageAction,
  poisonArrowShotAction,
  chainLightningAction,
  telekineticThrowAction,
  manaShieldAction,
  getManaShieldStacks: Mage.getManaShieldStacks,
  lifeTapAction,
  getLifeTapStacks: Mage.getLifeTapStacks,
  strengthenMinionAction,
  corpseExplosionAction,
  bloodTitheAction,
  mistFormAction,
  bloodPactAction,
  blindingLightAction,
  divineLightAction,
  divineLightHealAction,
  lanternAction,
  dowsingRodAction,
  spyglassAction,
  hourglassAction,
  doRetreat,
  applyCheat,
  cheatSkipFloor,
  cheatHudStatBoost,
  useItem,
  useItemAtIndex,
  dropItem,
  dropItemAtIndex,
  consolidateStackables,
  forceReplaceItem,
  forceReplaceItemAtIndex,
  acceptPendingGearAtSlot,
  swapPendingGearWithEquipped,
  getInventory,
  getArmor()        { return session.run?.player?.armor    ?? 0 },
  getNegation()     { return session.run?.player?.negation  ?? 0 },
  getEquippedGear() { return session.run?.player?.equippedGear ?? { weapon: null, breastplate: null, offhand: null } },
  getSafePocketTrinket() { return session.run?.player?.safePocketTrinket ?? null },
  getScrap()        { return session.save?.scrap ?? 0 },
  getSavedEquippedGear() { return session.save?.equippedGear ?? { weapon: null, breastplate: null, offhand: null } },
  upgradeGear(slot)                    { return _upgradeGear(slot) },
  disassembleGear(slot)                { return _disassembleGear(slot) },
  reduceDetriment(slot, statKey)       { return _reduceDetriment(slot, statKey) },
  equipGear(inventoryIndex)            { _equipGear(inventoryIndex) },
  equipSafePocket(inventoryIndex)      { _equipSafePocket(inventoryIndex) },
  unequipGear(slot, inventoryIndex)    { _unequipGear(slot, inventoryIndex) },
  trashGear(inventoryIndex) { _trashGear(inventoryIndex) },
  openForge: _openForge,
  getLevelUpLog,
  getPlayerHpRatio,
  getBalanceBotTapCandidates,
  balanceBotTryOpenRevealTool,
  getBalanceBotUseItemCandidates,
  getBalanceBotDiagnostics,
  getBalanceBotDeadlockDiagnostics,
  balanceBotRepairReachability,
  balanceBotForceUnlockAll,
  balanceBotClearCombatBusy() {
    session.tap.combatBusy = false
    _clearAllCombatEngagement()
  },
  balanceBotTryWarriorAbilities,
  balanceBotTryAbilitiesPolicy,
  balanceBotDismissNpcEvent,
  getRunTelemetry,
  getTearyEyesTurns()    { return session.run?.player?.tearyEyesTurns ?? 0 },
  getFreezingHitStacks() { return session.run?.player?.freezingHitStacks ?? 0 },
  getBurnStacks()        { return session.run?.player?.burnStacks ?? 0 },
  hasActiveRun()      { return !!session.save?.activeRun },
  getActiveRunInfo()  { return session.save?.activeRun ?? null },
  resumeRun,
  abandonRun,
  persistActiveRun()  { _saveActiveRun() },
  uiButtonHaptic,
  testHarnessSetupRun,
  testHarnessImportGrid,
  testHarnessGetSnapshot,
  testHarnessForceLevelUp,
  testHarnessPickLevelUp,
}
