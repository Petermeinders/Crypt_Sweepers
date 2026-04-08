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
import { WARRIOR_UPGRADES }  from '../data/upgrades.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE, TILE_TYPE_ICON_FILES, MAGIC_CHEST_OPEN_GIF, MAGIC_CHEST_GIF_DURATION_MS } from '../data/tileIcons.js'
import { TILE_BLURBS }       from '../data/tileBlurbs.js'
import { ITEMS }             from '../data/items.js'
import Bestiary              from '../systems/Bestiary.js'

/** Chest trinkets at 2% each (order = roll order). Legendary hourglass is rolled first at 1%. */
const CHEST_RARE_TRINKET_IDS = [
  'spyglass', 'echo-charm', 'vampire-fang', 'glass-cannon-shard', 'duelists-glove',
  'surge-pearl', 'still-water-amulet', 'greed-tooth', 'lucky-rabbit-foot', 'cursed-lockpick',
  'fire-ring', 'mana-ring',
]

function _rollChestLoot() {
  const hasLockpick = run?.player?.inventory?.some(e => e.id === 'cursed-lockpick')
  let r = Math.random()
  if (hasLockpick && r < 0.12) {
    r = Math.random() * 0.28
  }
  let acc = 0
  if (r < (acc += 0.01)) return { type: 'hourglass-sand' }
  for (const id of CHEST_RARE_TRINKET_IDS) {
    if (r < (acc += 0.02)) return { type: id }
  }
  if (r < (acc += 0.10)) return { type: 'lantern' }
  if (r < (acc += 0.28)) return { type: 'potion-red' }
  if (r < (acc += 0.23)) return { type: 'potion-blue' }
  if (r < (acc += 0.05)) return { type: 'smiths-tools' }
  const loot = { type: 'gold', amount: _rand(...CONFIG.chest.goldDrop) }
  if (hasLockpick && Math.random() < 0.10) {
    const pool = ['hourglass-sand', ...CHEST_RARE_TRINKET_IDS]
    return { type: pool[Math.floor(Math.random() * pool.length)] }
  }
  return loot
}

const BACKPACK_MAX_SLOTS = 9

/** Max gold from a magic-chest gold hit: current dungeon floor, or last cleared floor while in sanctuary (run.floor is not advanced until stairs). */
function _magicChestGoldFloorCap() {
  if (!run) return 1
  return Math.max(1, run.floor)
}

function _rollMagicChestGoldAmount() {
  const cap = _magicChestGoldFloorCap()
  const [gMin, gMax] = CONFIG.chest.goldDrop
  const upper = Math.min(gMax, cap)
  const lower = Math.min(gMin, upper)
  return _rand(lower, upper)
}

function _rollMagicChestLoot() {
  let r = Math.random()
  let acc = 0
  if (r < (acc += 0.01)) return { type: 'hourglass-sand' }
  if (r < (acc += 0.02)) {
    const pool = CHEST_RARE_TRINKET_IDS
    return { type: pool[Math.floor(Math.random() * pool.length)] }
  }
  if (r < (acc += 0.10)) return { type: 'lantern' }
  if (r < (acc += 0.05)) return { type: 'smiths-tools' }
  if (r < (acc += 0.18)) return { type: 'gold' }
  if (r < (acc += 0.32)) return { type: 'potion-red' }
  return { type: 'potion-blue' }
}

function _playerOutgoingDamageMult() {
  if (!run?.player?.inventory?.some(e => e.id === 'glass-cannon-shard')) return 1
  const p = run.player
  const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 0
  return ratio > 0.5 ? 1.5 : 0.5
}

function _scaleOutgoingDamageToEnemy(dmg) {
  return Math.max(1, Math.round(dmg * _playerOutgoingDamageMult()))
}

/** Still Water Amulet: after 10 turns without spending mana on spells/abilities, next mana cost is 35% less. */
function _stillWaterManaCost(baseCost) {
  const p = run?.player
  if (!p?.inventory?.some(e => e.id === 'still-water-amulet')) return baseCost
  if ((p.turnsWithoutSpell ?? 0) < 10) return baseCost
  return Math.max(1, Math.round(baseCost * 0.65))
}

function _markStillWaterAbilityUsed() {
  if (run?.player) run.player.turnsWithoutSpell = 0
}

function _previewSpellManaCostForUi() {
  if (!run?.player) return Math.max(1, CONFIG.spell.manaCost)
  return _stillWaterManaCost(
    Math.max(1, CONFIG.spell.manaCost - (run.player.spellCostReduction ?? 0)) + _tearyExtraCost(),
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
      enemyData: t.enemyData ? JSON.parse(JSON.stringify(t.enemyData)) : null,
      itemData: t.itemData ? JSON.parse(JSON.stringify(t.itemData)) : null,
      chestLoot: t.chestLoot ? JSON.parse(JSON.stringify(t.chestLoot)) : null,
      chestReady: t.chestReady,
      chestLooted: t.chestLooted,
      magicChestReady: t.magicChestReady,
      pendingLoot: t.pendingLoot ? JSON.parse(JSON.stringify(t.pendingLoot)) : null,
      exitResolved: t.exitResolved,
      merchantResolved: t.merchantResolved,
      ropeResolved: t.ropeResolved,
      echoHintCategory: t.echoHintCategory ?? null,
    })),
  )
  return {
    tilesRevealed: run.tilesRevealed,
    player: JSON.parse(JSON.stringify(run.player)),
    merchantTile: run.merchantTile ? { row: run.merchantTile.row, col: run.merchantTile.col } : null,
    bossFloorExitPending: run.bossFloorExitPending,
    tiles,
  }
}

function _restoreHourglassSnapshot(snap) {
  if (!snap) return
  const grid = TileEngine.getGrid()
  run.player = JSON.parse(JSON.stringify(snap.player))
  run.tilesRevealed = snap.tilesRevealed
  run.bossFloorExitPending = snap.bossFloorExitPending
  run.merchantTile = snap.merchantTile
    ? TileEngine.getTile(snap.merchantTile.row, snap.merchantTile.col)
    : null

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const t = grid[r][c]
      const st = snap.tiles[r][c]
      const el = t.element
      t.type = st.type
      t.revealed = st.revealed
      t.locked = st.locked
      t.reachable = st.reachable
      t.enemyData = st.enemyData ? JSON.parse(JSON.stringify(st.enemyData)) : null
      t.itemData = st.itemData ? JSON.parse(JSON.stringify(st.itemData)) : null
      t.chestLoot = st.chestLoot ? JSON.parse(JSON.stringify(st.chestLoot)) : null
      t.chestReady = st.chestReady
      t.chestLooted = st.chestLooted
      t.magicChestReady = st.magicChestReady
      t.pendingLoot = st.pendingLoot ? JSON.parse(JSON.stringify(st.pendingLoot)) : null
      t.exitResolved = st.exitResolved
      t.merchantResolved = st.merchantResolved
      t.ropeResolved = st.ropeResolved
      t.echoHintCategory = st.echoHintCategory ?? null
      t.element = el
      if (el) {
        el.classList.toggle('revealed', !!t.revealed)
        el.classList.toggle('reachable', !!t.reachable && !t.revealed)
        el.classList.toggle('locked', !!t.locked)
        el.classList.toggle('echo-hint', !!t.echoHintCategory)
        if (t.echoHintCategory) el.dataset.echoHint = t.echoHintCategory
        else delete el.dataset.echoHint
      }
    }
  }

  TileEngine.recomputeReachabilityFromRevealed(UI.markTileReachable.bind(UI))
  for (const row of grid) {
    for (const t of row) {
      if (!t.element) continue
      if (t.type === 'merchant') {
        t.element.classList.toggle('merchant-pending', !t.merchantResolved)
      }
      if (t.type === 'chest') {
        t.element.classList.toggle('chest-ready', !!(t.chestReady && !t.chestLooted))
      }
      if (t.type === 'magic_chest') {
        t.element.classList.toggle('chest-ready', !!t.magicChestReady)
      }
      if (t.type === 'exit') {
        t.element.classList.toggle('exit-pending', !t.exitResolved)
      }
      if (t.type === 'rope') {
        t.element.classList.toggle('rope-pending', !t.ropeResolved)
      }
    }
  }
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.updateGold(run.player.gold)
  UI.updateGoldenKeys(run.player.goldenKeys ?? 0)
  _syncMagicChestKeyGlow()
  UI.updateXP(run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
}

function _echoCharmCategoryForTileType(type) {
  if (type === 'enemy' || type === 'enemy_fast' || type === 'boss') return '⚔️'
  if (type === 'trap') return '🕸️'
  if (type === 'gold' || type === 'chest' || type === 'heart') return '🪙'
  if (type === 'merchant' || type === 'checkpoint') return '✨'
  if (type === 'exit') return '🚪'
  if (type === 'empty') return '·'
  return '❓'
}

function _spyglassHintLabel(type) {
  if (type === 'enemy' || type === 'enemy_fast' || type === 'boss') return '⚔️ Foe'
  if (type === 'trap') return '🕸️ Snare'
  if (type === 'gold' || type === 'chest' || type === 'heart') return '🪙 Loot'
  if (type === 'merchant' || type === 'checkpoint') return '✨ Special'
  if (type === 'exit') return '🚪 Way'
  if (type === 'empty') return '· Quiet'
  if (type === 'well' || type === 'anvil' || type === 'rope') return '🏕️ Rest'
  return '❓ Unknown'
}

/** Golden perimeter pulse on magic chest only while the player has at least one 🗝️. */
function _syncMagicChestKeyGlow() {
  if (!run) return
  const hasKeys = (run.player.goldenKeys ?? 0) > 0
  const grid = TileEngine.getGrid()
  for (const row of grid) {
    for (const t of row) {
      if (t.type !== 'magic_chest' || !t.element) continue
      t.element.classList.toggle('magic-chest-has-keys', hasKeys && !!t.magicChestReady)
    }
  }
}

// ── Persistent save + run state ──────────────────────────────
let _save = null
let run   = null

function _charKey() {
  return _save?.selectedCharacter ?? 'warrior'
}

/** Meta XP unlock or at least one run mastery stack — HUD + actions. */
function _isRangerActiveUnlocked(abilityKey) {
  if ((_save.ranger?.upgrades ?? []).includes(abilityKey)) return true
  const stacks = run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return stacks > 0
}

function _rangerActiveDamageMult(abilityKey) {
  const stacks = run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return 1 + 0.1 * stacks
}

function _refreshRangerActiveHud() {
  if (_charKey() !== 'ranger') return
  UI.setRicochetBtn(_isRangerActiveUnlocked('ricochet'), RANGER_UPGRADES.ricochet.manaCost)
  UI.setArrowBarrageBtn(
    _isRangerActiveUnlocked('arrow-barrage'),
    RANGER_UPGRADES['arrow-barrage'].manaCost,
  )
  UI.setPoisonArrowShotBtn(
    _isRangerActiveUnlocked('poison-arrow-shot'),
    RANGER_UPGRADES['poison-arrow-shot'].manaCost,
  )
}

/** Ranger __Attack.gif length — portrait stays on "attack" until this elapses. */
const RANGER_FIGHT_ATTACK_PORTRAIT_MS = 4000
/** Warrior strike gif length — portrait stays on "attack" until this elapses. */
const WARRIOR_FIGHT_ATTACK_PORTRAIT_MS = 2000
/** Ranger passive: chance per enemy reveal to skip locking adjacent tiles. */
const RANGER_PASSIVE_SKIP_ADJ_LOCK = 0.1

function buildRunState() {
  const isRanger = _charKey() === 'ranger'
  const baseHP   = isRanger ? RANGER_BASE.hp   : CONFIG.player.baseHP
  const baseMana = isRanger ? RANGER_BASE.mana : CONFIG.player.baseMana

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
    retreatPercent:     CONFIG.retreat.goldKeepPercent,
    extraAbilityChoice: false,
    damageTakenMult:    1,
    isRanger,
    inventory:          [],   // [{ id, qty }]
    goldenKeys:         0,
  }

  MetaProgression.applyToPlayer(p, _save)

  return {
    player:           p,
    floor:            1,
    tilesRevealed:    0,
    activeCombatTile: null,
    merchantTile:     null,
    /** Between boss and next dungeon — 3×3 sanctuary */
    atRest:           false,
    /** After boss dies, stairs appear; first tap goes to sanctuary */
    bossFloorExitPending: false,
    /** Chronological level-up picks this run: { level, abilityId, name, icon } */
    levelUpLog:       [],
    floorKeyAwarded:  false,
  }
}

// ── Accessors ────────────────────────────────────────────────

function getActiveCombatTile() { return run?.activeCombatTile ?? null }

// ── Init ─────────────────────────────────────────────────────

function init(saveData) {
  _save = saveData
}

// ── New game ─────────────────────────────────────────────────

function newGame() {
  run = buildRunState()
  UI.hideMainMenu()
  EventBus.emit('audio:crossfade', { track: 'dungeon', duration: 1500 })
  _startFloor()
}

// ── Run persistence ──────────────────────────────────────────

function _saveActiveRun() {
  if (!run || !_save) return
  _save.activeRun = {
    player:          JSON.parse(JSON.stringify(run.player)),
    floor:           run.floor,
    atRest:          run.atRest,
    levelUpLog:      run.levelUpLog.slice(),
    floorKeyAwarded: !!run.floorKeyAwarded,
  }
  SaveManager.save(_save).catch(() => {})
}

function _clearActiveRun() {
  if (!_save?.activeRun) return
  delete _save.activeRun
  SaveManager.save(_save).catch(() => {})
}

function resumeRun() {
  const saved = _save?.activeRun
  if (!saved) return
  run = {
    player:               saved.player,
    floor:                saved.floor,
    atRest:               saved.atRest ?? false,
    levelUpLog:           saved.levelUpLog ?? [],
    floorKeyAwarded:      saved.floorKeyAwarded ?? false,
    tilesRevealed:        0,
    activeCombatTile:     null,
    merchantTile:         null,
    bossFloorExitPending: false,
  }
  UI.hideMainMenu()
  const track = CONFIG.bossFloors.includes(run.floor) ? 'boss' : 'dungeon'
  EventBus.emit('audio:crossfade', { track, duration: 1500 })
  _startFloor()
}

function abandonRun() {
  run = null
  _clearActiveRun()
  returnToMenu()
}

// ── Return to menu ───────────────────────────────────────────

function returnToMenu(autoSave = false) {
  _clearActiveRun()
  if (autoSave) SaveManager.save(_save)
  const char = _charKey()
  const xp   = char === 'ranger' ? _save.ranger.totalXP : _save.warrior.totalXP
  UI.updateMenuStats(_save.persistentGold, xp, char, _save)
  UI.setActiveDifficulty(_save.settings.difficulty)
  UI.showMainMenu()
  UI.refreshSkipFloorButton(_save)
  EventBus.emit('audio:crossfade', { track: 'menu', duration: 1500 })
}

function _startFloor() {
  _spellTargeting         = false
  _combatBusy             = false
  _lanternTargeting       = false
  _spyglassTargeting      = false
  _blindingLightTargeting = false
  _divineLightSelecting   = false
  UI.setDivineLightActive(false)
  _ricochetSelecting = false
  _ricochetTiles     = []
  UI.clearRicochetMarks()
  UI.setRicochetActive(false)
  UI.setGridRicochetMode(false)
  _arrowBarrageSelecting = false
  _tripleVolleyCenter = null
  UI.clearTripleVolleyAoePreview()
  UI.setArrowBarrageActive(false)
  UI.setGridArrowBarrageMode(false)
  _poisonArrowShotSelecting = false
  UI.setPoisonArrowShotActive(false)
  UI.setGridPoisonArrowShotMode(false)
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0) }
  if (run) { run._hourglassSnapshot = null }
  _saveActiveRun()
  TileEngine.generateGrid(run.floor, { rest: run.atRest })
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  _revealStartTile()

  GameState.set(States.FLOOR_EXPLORE)
  UI.updateFloor(run.floor, { rest: run.atRest })
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.updateGold(run.player.gold)
  UI.updateGoldenKeys(run.player.goldenKeys ?? 0)
  _syncMagicChestKeyGlow()
  UI.updateXP(run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setHudCharacter(_charKey())
  // Slot A — Warrior Slam or Ranger Ricochet when unlocked in XP tree
  const warriorUpgrades = _save.warrior?.upgrades ?? []
  const slamUnlocked    = _charKey() === 'warrior' && warriorUpgrades.includes('slam')
  if (_charKey() === 'ranger') {
    _refreshRangerActiveHud()
  } else {
    UI.setSlamBtn(slamUnlocked, WARRIOR_UPGRADES.slam.manaCost)
    UI.setArrowBarrageBtn(false)
    UI.setPoisonArrowShotBtn(false)
    const divineLightUnlocked = warriorUpgrades.includes('divine-light')
    UI.setDivineLightBtn(divineLightUnlocked, WARRIOR_UPGRADES['divine-light'].manaCost)
  }
  // Blinding Light — warrior only, slot B (ranger uses B for Poison Arrow, C for Triple Volley)
  if (_charKey() === 'warrior') {
    const blindingUnlocked = warriorUpgrades.includes('blinding-light')
    UI.setBlindingLightBtn(blindingUnlocked, WARRIOR_UPGRADES['blinding-light'].manaCost)
  }
  // Show spell button always — player can target any enemy at any time
  const effectiveCost = _previewSpellManaCostForUi()
  UI.showActionPanel(effectiveCost, run.player.mana >= effectiveCost)
  // Start tile is already revealed — player can flee; only close dialog if it was open.
  document.getElementById('retreat-confirm')?.classList.add('hidden')
  UI.showRetreat()
  UI.hideRunSummary()
  UI.hideMerchant()

  const isBoss = CONFIG.bossFloors.includes(run.floor) && !run.atRest
  UI.setMessage(run.atRest
    ? 'A quiet sanctuary. The well restores you; the rope leads out with your gold; the stairs go deeper.'
    : isBoss
      ? `⚠️ Floor ${run.floor} — Boss floor! Tread carefully.`
      : 'Tap a tile to reveal what lurks beneath...')

  Logger.debug(`[GameController] Floor ${run.floor} started`)
  UI.refreshSkipFloorButton(_save)
}

// ── Starting tile ────────────────────────────────────────────

function _revealStartTile() {
  const grid = TileEngine.getGrid()
  const { cols, rows } = CONFIG.gridSize(run.floor, { rest: run.atRest })

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
  run.tilesRevealed++
  // Mark neighbours reachable immediately so they're clickable before the flip finishes
  TileEngine.markReachable(tile.row, tile.col, UI.markTileReachable.bind(UI))
  TileEngine.flipTile(tile)
  _tickPoisonArrowDotOnGlobalTurn()
}

// ── Tile tap router ──────────────────────────────────────────

let _spellTargeting         = false
let _combatBusy             = false
let _lanternTargeting       = false
let _spyglassTargeting      = false
let _blindingLightTargeting = false
let _divineLightSelecting   = false
let _ricochetSelecting = false
let _ricochetTiles     = []
let _arrowBarrageSelecting = false
/** Triple Volley: { row, col } center after first tap; second tap same tile fires. */
let _tripleVolleyCenter = null
let _poisonArrowShotSelecting = false

// ── Angry Onion helpers ───────────────────────────────────────

/** Extra mana cost while Teary Eyes debuff is active. */
function _tearyExtraCost() {
  return (run?.player?.tearyEyesTurns ?? 0) > 0 ? 1 : 0
}

/** Apply / refresh Teary Eyes debuff on the player (2 turns). */
function _applyTearyEyes() {
  if (!run) return
  run.player.tearyEyesTurns = 2
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

function _cancelRicochetMode() {
  _ricochetSelecting = false
  _ricochetTiles     = []
  UI.clearRicochetMarks()
  UI.setRicochetActive(false)
  UI.setGridRicochetMode(false)
}

function _cancelArrowBarrageMode() {
  _arrowBarrageSelecting = false
  _tripleVolleyCenter = null
  UI.clearTripleVolleyAoePreview()
  UI.setArrowBarrageActive(false)
  UI.setGridArrowBarrageMode(false)
}

function _cancelPoisonArrowShotMode() {
  _poisonArrowShotSelecting = false
  UI.setPoisonArrowShotActive(false)
  UI.setGridPoisonArrowShotMode(false)
}

function _cancelSpellLanternBlindingForRicochet() {
  if (_spellTargeting) {
    _spellTargeting = false
    const effectiveCost = _previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (_lanternTargeting) {
    _lanternTargeting = false
    UI.setLanternTargeting(false)
  }
  if (_spyglassTargeting) {
    _spyglassTargeting = false
    UI.setLanternTargeting(false)
  }
  if (_blindingLightTargeting) {
    _blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (_divineLightSelecting) {
    _divineLightSelecting = false
    UI.setDivineLightActive(false)
  }
}

function onTileTap(row, col) {
  const state = GameState.current()
  const tile  = TileEngine.getTile(row, col)
  if (!tile) return

  if (state === States.NPC_INTERACT) return

  // Spell targeting mode: only enemy taps fire; everything else ignored
  if (_spellTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _castSpell(tile)
    }
    return
  }

  // Lantern targeting: any unrevealed tile (ignores reachable restriction)
  if (_lanternTargeting) {
    if (!tile.revealed) {
      _useLanternOn(tile)
    }
    return
  }

  if (_spyglassTargeting) {
    if (!tile.revealed) {
      _useSpyglassOn(tile)
    }
    return
  }

  // Blinding Light targeting: revealed living enemy
  if (_blindingLightTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _castBlindingLight(tile)
    }
    return
  }

  // Divine Light targeting: revealed living enemy → smite
  if (_divineLightSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _castDivineLightSmite(tile)
    }
    return
  }

  // Triple Volley: first tap sets 3×3 center (preview); second tap same tile confirms
  if (_arrowBarrageSelecting) {
    if (!tile.revealed) {
      UI.setMessage('Triple Volley — tap a revealed tile to place the 3×3 area.', true)
      return
    }
    const cost = _stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + _tearyExtraCost())
    if (!_tripleVolleyCenter) {
      _tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage(
        'Triple Volley — blinking tiles show the blast. Tap the same tile again to fire (or tap the ability to cancel).',
      )
      return
    }
    if (tile.row !== _tripleVolleyCenter.row || tile.col !== _tripleVolleyCenter.col) {
      _tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — area moved. Tap the center tile again to confirm.')
      return
    }
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return
    }
    _executeTripleVolley(_tripleVolleyCenter)
    return
  }

  // Poison Arrow (active): single living enemy — initial hit + 3 poison ticks (global turns)
  if (_poisonArrowShotSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const cost = _stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + _tearyExtraCost())
      if (run.player.mana < cost) {
        UI.setMessage('Not enough mana for Poison Arrow!', true)
      } else {
        _executePoisonArrowShot(tile)
      }
    }
    return
  }

  // Ricochet: mark up to 3 enemies in tap order; 3rd pick fires immediately
  if (_ricochetSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const idx = _ricochetTiles.findIndex(t => t.row === tile.row && t.col === tile.col)
      if (idx >= 0) {
        _ricochetTiles.splice(idx, 1)
        UI.refreshRicochetMarks(_ricochetTiles)
      } else if (_ricochetTiles.length < 3) {
        _ricochetTiles.push(tile)
        UI.refreshRicochetMarks(_ricochetTiles)
        if (_ricochetTiles.length === 3) {
          const cost = _stillWaterManaCost(RANGER_UPGRADES.ricochet.manaCost + _tearyExtraCost())
          if (run.player.mana < cost) {
            _ricochetTiles.pop()
            UI.refreshRicochetMarks(_ricochetTiles)
            UI.setMessage('Not enough mana for Ricochet!', true)
          } else {
            _executeRicochet()
          }
        }
      } else {
        UI.setMessage('Ricochet — max 3 targets.', true)
      }
    }
    return
  }

  if (state === States.FLOOR_EXPLORE) {
    if (!tile.revealed && !tile.locked && tile.reachable) {
      revealTile(tile)
    } else if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
      _openChest(tile)
    } else if (tile.revealed && tile.type === 'magic_chest' && tile.magicChestReady) {
      _openMagicChest(tile)
    } else if (tile.revealed && tile.type === 'exit' && !tile.exitResolved) {
      _confirmExit(tile)
    } else if (tile.revealed && tile.type === 'rope' && !tile.ropeResolved) {
      _confirmRope(tile)
    } else if (tile.revealed && tile.type === 'merchant' && !tile.merchantResolved) {
      openMerchant(tile)
    } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (!_combatBusy) fightAction(tile)
    }
  }
}

// ── Tile hold (info card) ────────────────────────────────────

function onTileHold(row, col) {
  const tile = TileEngine.getTile(row, col)
  if (!tile) return

  if (tile.type === 'empty') return   // nothing interesting to show

  let cardData

  if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
    const e       = tile.enemyData
    const sprites = ENEMY_SPRITES[e.enemyId]
    cardData = {
      name:       e.label,
      spriteSrc:  sprites?.idle ? MONSTER_ICONS_BASE + sprites.idle : null,
      emoji:      e.emoji,
      hp:         e.currentHP ?? e.hp,
      maxHp:      e.hp,
      dmg:        TileEngine.formatEnemyDamageDisplay(e.dmg, e.hitDamage),
      type:       e.type,
      blurb:      e.blurb ?? '',
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
function _applyRangerTrapfinderMitigation(preMitigationDmg, p) {
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
function _tickPoisonArrowDotOnGlobalTurn() {
  if (!run || GameState.is(States.DEATH)) return
  // Teary Eyes debuff tick
  if ((run.player.tearyEyesTurns ?? 0) > 0) {
    run.player.tearyEyesTurns--
    UI.setTearyEyes(run.player.tearyEyesTurns)
  }
  const grid = TileEngine.getGrid()
  if (!grid) return
  const pDmg = _scaleOutgoingDamageToEnemy(_poisonArrowUnitDamage())
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
      if ((tile.enemyData.poisonTurns ?? 0) <= 0) continue

      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - pDmg)
      tile.enemyData.poisonTurns--
      if (tile.element) {
        UI.spawnFloat(tile.element, `☠️ ${pDmg}`, 'damage')
        UI.shakeTile(tile.element)
      }
      if (tile.enemyData.currentHP <= 0) {
        const gold = tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1
        _gainGold(gold, tile.element)
        _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        _endCombatVictory(tile)
      } else if (tile.element) {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
      }
    }
  }
  if (run.player.inventory?.some(e => e.id === 'still-water-amulet')) {
    run.player.turnsWithoutSpell = (run.player.turnsWithoutSpell ?? 0) + 1
  }
}

async function revealTile(tile) {
  if (run.player.inventory.some(e => e.id === 'hourglass-sand')) {
    run._hourglassSnapshot = _serializeHourglassSnapshot()
  }
  if (tile.element) {
    tile.element.classList.remove('echo-hint')
    delete tile.element.dataset.echoHint
  }
  delete tile.echoHintCategory

  tile.revealed = true
  run.tilesRevealed++
  UI.setPortraitAnim('run')
  EventBus.emit('audio:play', { sfx: 'flip' })
  await TileEngine.flipTile(tile)
  if (tile.enemyData) {
    TileEngine.rollEnemyHitDamage(tile.enemyData)
    TileEngine.refreshEnemyDamageOnTile(tile)
  }
  UI.setPortraitAnim('idle')
  _gainXP(CONFIG.xp.perTileReveal, tile.element)
  EventBus.emit('tile:revealed', { tile })
  TileEngine.markReachable(tile.row, tile.col, UI.markTileReachable.bind(UI))
  await _maybeBestiaryDiscovery(tile)
  _resolveEffect(tile)
  _tickPoisonArrowDotOnGlobalTurn()
}

async function _maybeBestiaryDiscovery(tile) {
  const id = tile.enemyData?.enemyId
  if (!id) return
  try {
    if (!Bestiary.registerIfNew(_save, id)) return
    await SaveManager.save(_save).catch(() => {})
    await UI.showBestiaryDiscovery(id)
  } catch (e) {
    Logger.debug('[GameController] bestiary discovery', e)
  }
}

// ── Chest open ───────────────────────────────────────────────

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

function _openChest(tile) {
  tile.chestReady = false
  tile.element?.classList.remove('chest-ready')
  const loot = tile.chestLoot

  EventBus.emit('audio:play', { sfx: 'chest' })
  if (loot.type === 'smiths-tools') {
    const def = ITEMS['smiths-tools']
    const amt = def?.effect?.amount ?? 1
    run.player.damageBonus = (run.player.damageBonus ?? 0) + amt
    {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
    }
    UI.spawnFloat(tile.element, `🔧 ${def.name}`, 'xp')
    UI.setMessage(`You pry it open — ${def.name}! +${amt} attack damage for this run.`)
  } else if (loot.type === 'gold') {
    _gainGold(loot.amount, tile.element)
    UI.setMessage(`You pry it open — +${loot.amount} gold!`)
  } else {
    const def = ITEMS[loot.type]
    if (def) {
      _addToBackpack(loot.type)
      const tag = def.effect?.type?.startsWith('passive') ? 'Passive' : 'Item'
      UI.spawnFloat(tile.element, `${def.icon} ${def.name}`, 'xp')
      UI.setMessage(`You pry it open — ${def.name}! (${tag})`)
    } else {
      _gainGold(loot.amount ?? 1, tile.element)
      UI.setMessage('You pry it open — something glitters inside.')
    }
  }

  // Swap static chest image to animated gif, wait for it to finish, then collect
  const chestImg = tile.element?.querySelector('.tile-icon-img')
  const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
  const GIF_DURATION = 750 // ms — one play-through of chest.gif

  if (chestImg) _forcePlayChestGif(chestImg, ITEM_ICONS_BASE + 'chest.gif?t=' + Date.now())

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

function _resolveEffect(tile) {
  const p = run.player

  switch (tile.type) {

    case 'empty':
      UI.setMessage('Dust, silence, and the distant drip of water.')
      UI.showRetreat()
      break

    case 'gold': {
      const g = 1
      _gainGold(g, tile.element)
      UI.setMessage(`A coin on the floor. +1 gold.`)
      UI.showRetreat()
      // Animate the coin icon flying upward and fading out
      const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
      if (iconWrap) iconWrap.classList.add('collecting')
      break
    }

    case 'chest': {
      tile.chestLoot = _rollChestLoot()
      tile.chestReady = true
      if (tile.element) tile.element.classList.add('chest-ready')
      UI.setMessage('A locked chest — tap again to pry it open.')
      UI.showRetreat()
      break
    }

    case 'trap': {
      if ((p.trapDodgeChance ?? 0) > 0 && Math.random() < p.trapDodgeChance) {
        EventBus.emit('audio:play', { sfx: 'trap' })
        UI.setMessage('A trap snaps shut — your training pays off! You dodge it.')
        UI.spawnFloat(tile.element, '🪤 Dodged!', 'heal')
        break
      }
      const rawDmg = _rand(...CONFIG.trap.damage)
      let dmg = Math.max(1, rawDmg - (p.trapReduction ?? 0))
      if (p.inventory?.some(e => e.id === 'greed-tooth')) dmg += 1
      const reduced = rawDmg !== dmg ? ` (reduced from ${rawDmg})` : ''
      let tfNote = ''
      if (p.isRanger && (p.trapfinderStacks ?? 0) > 0) {
        const r = _applyRangerTrapfinderMitigation(dmg, p)
        dmg = r.dmg
        if (r.proc) tfNote = ' Trapfinder!'
      }
      EventBus.emit('audio:play', { sfx: 'trap' })
      _takeDamage(dmg, tile.element)
      UI.setMessage(`A trap snaps shut! You take ${dmg} damage${reduced}.${tfNote}`)
      if (!GameState.is(States.DEATH)) UI.showRetreat()
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
        const [d0, d1] = _playerDamageRange(p)
        UI.updateDamageRange(d0, d1)
      }
      UI.spawnFloat(tile.element, '+1 ATK', 'xp')
      UI.setMessage('You temper your weapon on the anvil — +1 attack damage for this run.')
      EventBus.emit('audio:play', { sfx: 'hit' })
      UI.showRetreat()
      break
    }

    case 'magic_chest': {
      tile.magicChestReady = true
      if (tile.element) tile.element.classList.add('chest-ready')
      _syncMagicChestKeyGlow()
      const keys = run.player.goldenKeys ?? 0
      UI.setMessage(`✨ A Magic Chest! Spend a 🗝️ Golden Key to open it. You have ${keys} key${keys === 1 ? '' : 's'}.`)
      UI.showRetreat()
      break
    }

    case 'rope': {
      tile.ropeResolved = false
      if (tile.element) tile.element.classList.add('rope-pending')
      UI.setMessage('A rope leads upward. Tap again to climb out with all your gold.')
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

    case 'checkpoint': {
      const healAmt = Math.floor(p.maxHp * CONFIG.checkpoint.healPercent)
      const manaAmt = CONFIG.checkpoint.manaRestore
      p.hp       = Math.min(p.maxHp,   p.hp   + healAmt)
      p.mana     = Math.min(p.maxMana, p.mana + manaAmt)
      p.safeGold = p.gold
      UI.spawnFloat(tile.element, `+${healAmt} HP`, 'heal')
      UI.spawnFloat(tile.element, `+${manaAmt} MP`, 'mana')
      UI.updateHP(p.hp, p.maxHp)
      UI.updateMana(p.mana, p.maxMana)
      UI.setMessage(`🏕️ A hidden camp! You rest and recover. +${healAmt} HP, +${manaAmt} mana. Gold banked!`)
      UI.showRetreat()
      SaveManager.save(_save)
      EventBus.emit('run:checkpoint', { goldBanked: p.gold })
      break
    }

    case 'merchant':
      tile.merchantResolved = false
      run.merchantTile = tile
      if (tile.element) tile.element.classList.add('merchant-pending')
      UI.setMessage('A goblin merchant haggles in the shadows. Tap the tile to trade — or walk on by.')
      UI.showRetreat()
      break

    case 'boss':
    case 'enemy_fast': {
      const { dmg } = CombatResolver.resolveFastReveal(tile.enemyData)
      const reflexDodge = !tile.enemyData?.isBoss && (p.reflexDodgeChance ?? 0) > 0 && Math.random() < p.reflexDodgeChance
      if (!reflexDodge) {
        const r = _applyRangerTrapfinderMitigation(dmg, p)
        _takeDamage(r.dmg, tile.element)
      }
      UI.shakeTile(tile.element)
      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (!rangerSkipLock) {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)
      if (!GameState.is(States.DEATH)) {
        const label = tile.enemyData?.isBoss ? `⚠️ BOSS: ${tile.enemyData.label}` : '⚡ Fast enemy'
        const dodgeNote = reflexDodge ? ' Your reflexes kick in — ambush dodged!' : ''
        UI.setMessage(`${label} strikes first!${dodgeNote} Tap it to fight.`, true)
        UI.showRetreat()
        EventBus.emit('tile:locked', {})
        if (reflexDodge) UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
      }
      break
    }

    case 'enemy': {
      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (!rangerSkipLock) {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)

      // Tongue Snatch: Toad Beast steals 1–5 gold on reveal
      if (tile.enemyData?.tongueSnatch) {
        const snatch = Math.min(p.gold, _rand(1, 5))
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

      // Fast enemies get a free strike the moment they're revealed
      if (tile.enemyData?.attributes?.includes('fast')) {
        const d = tile.enemyData.dmg
        const ambushDmg = tile.enemyData.hitDamage ?? (Array.isArray(d) ? d[0] : d)
        const reflexDodge = (p.reflexDodgeChance ?? 0) > 0 && Math.random() < p.reflexDodgeChance
        if (reflexDodge) {
          UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
          UI.setMessage(`⚡ The ${tile.enemyData.label} lunges — your reflexes save you! Tap to fight.`)
        } else {
          const r = _applyRangerTrapfinderMitigation(ambushDmg, p)
          _takeDamage(r.dmg, tile.element, false, tile.enemyData)
          const tf = r.proc ? ' Trapfinder!' : ''
          UI.setMessage(`⚡ The ${tile.enemyData.label} strikes first for ${r.dmg}!${tf} Tap to fight back.`)
        }
      } else {
        UI.setMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
      }
      UI.showRetreat()
      EventBus.emit('tile:locked', {})
      break
    }

    case 'exit':
      tile.exitResolved = false
      if (tile.element) tile.element.classList.add('exit-pending')
      if (run.floor >= CONFIG.floorNames.length) {
        UI.setMessage('🚪 Daylight ahead! Tap the exit again when you\'re ready to leave the dungeon.')
      } else {
        UI.setMessage('🚪 Stairs lead downward. Tap the exit again when you\'re ready to descend.')
      }
      UI.showRetreat()
      break
  }
}

function _confirmExit(tile) {
  if (tile.type !== 'exit' || tile.exitResolved) return
  tile.exitResolved = true
  tile.element?.classList.remove('exit-pending')
  _handleExit()
}

// ── Merchant ─────────────────────────────────────────────────

function openMerchant(tile) {
  if (tile.merchantResolved) return
  if (!GameState.transition(States.NPC_INTERACT)) return

  const p = run.player
  UI.showMerchant(
    p.gold,
    CONFIG.merchant.cost,
    () => _doMerchantRoll(tile),
    () => _closeMerchantSession(tile, false),
  )
}

/** After roll or walking away — @param rolled whether the dice were rolled */
function _closeMerchantSession(tile, rolled) {
  if (tile) {
    tile.merchantResolved = true
    tile.element?.classList.remove('merchant-pending')
  }
  run.merchantTile = null
  UI.hideMerchant()
  if (GameState.is(States.NPC_INTERACT)) {
    GameState.transition(States.FLOOR_EXPLORE)
  }
  if (!rolled && tile && !GameState.is(States.DEATH)) {
    UI.setMessage('You leave the merchant to his dice.')
  }
}

function _doMerchantRoll(tile) {
  const p = run.player
  if (p.gold < CONFIG.merchant.cost) {
    UI.setMessage('Not enough gold to trade!', true)
    return
  }
  p.gold -= CONFIG.merchant.cost
  UI.updateGold(p.gold)

  const result = CombatResolver.rollMerchant()
  UI.showMerchantResult(result, () => {
    switch (result.effect) {
      case 'damage':
        _takeDamage(result.value, tile.element)
        break
      case 'gold':
        _gainGold(result.value, tile.element)
        break
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + result.value)
        UI.spawnFloat(tile.element, `+${result.value} HP`, 'heal')
        UI.updateHP(p.hp, p.maxHp)
        break
      case 'mana':
        p.mana = Math.min(p.maxMana, p.mana + result.value)
        UI.spawnFloat(tile.element, `+${result.value}🔵`, 'mana')
        UI.updateMana(p.mana, p.maxMana)
        break
    }
    _closeMerchantSession(tile, true)
    if (!GameState.is(States.DEATH)) {
      UI.setMessage(`The goblin cackles. Roll: ${result.roll} — ${result.label}!`)
    }
  })
  EventBus.emit('audio:play', { sfx: 'merchant' })
}

// ── Enemy sprite swap ────────────────────────────────────────

function _setEnemySprite(tile, state) {
  const sprites = ENEMY_SPRITES[tile.enemyData?.enemyId]
  if (!sprites) return
  const img = tile.element?.querySelector('.tile-icon-img')
  if (!img) return
  const src = state === 'attack' ? sprites.attack : sprites.idle
  if (src) img.src = MONSTER_ICONS_BASE + src
}

// ── Combat ───────────────────────────────────────────────────

function fightAction(tile) {
  _combatBusy = true

  _tickPoisonArrowDotOnGlobalTurn()
  if (!tile?.enemyData || tile.enemyData._slain) {
    _combatBusy = false
    return
  }

  const result = CombatResolver.resolveFight(run.player, tile.enemyData)

  let playerDmg = result.playerDmg
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) playerDmg = Math.round(playerDmg * 2)
  if (run.player.beastBonus  && isBeast)  playerDmg = Math.round(playerDmg * 2)

  if (run.player.inventory.some(e => e.id === 'duelists-glove') && !tile.enemyData._duelistFirstMeleeDone) {
    playerDmg += 1
    tile.enemyData._duelistFirstMeleeDone = true
  }
  playerDmg = _scaleOutgoingDamageToEnemy(playerDmg)

  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast) ? ' (2×!)' : ''
  const newEnemyHP = _save.settings.cheats?.instantKill ? 0 : Math.max(0, tile.enemyData.currentHP - playerDmg)
  const killsEnemy = newEnemyHP <= 0

  // Fire Ring: 10% chance to ignite on hit
  const hasFireRing = run.player.inventory.some(e => e.id === 'fire-ring')
  const ignite = hasFireRing && !killsEnemy && Math.random() < 0.10

  // Stun: enemy is stunned if stunTurns > 0
  const isStunned = (tile.enemyData.stunTurns ?? 0) > 0

  UI.setPortraitAnim('attack')
  if (_charKey() === 'ranger') UI.spawnArrow(tile.element)
  else UI.spawnSlash(tile.element)
  const attackSfx = _charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })

  const attackPortraitT0 = performance.now()
  const isRanger = _charKey() === 'ranger'
  const afterAttackPortrait = (fn) => {
    const holdMs = isRanger ? RANGER_FIGHT_ATTACK_PORTRAIT_MS : WARRIOR_FIGHT_ATTACK_PORTRAIT_MS
    const elapsed = performance.now() - attackPortraitT0
    setTimeout(fn, Math.max(0, holdMs - elapsed))
  }

  // Slime split: first kill restores half HP and splits visually
  const canSplit = killsEnemy
    && tile.enemyData?.attributes?.includes('splits')
    && !tile.enemyData.hasSplit

  if (killsEnemy && !canSplit) {
    // Fatal blow — enemy never gets to counter
    setTimeout(() => {
      tile.enemyData.currentHP = 0
      if (tile.enemyData?.enemyId === 'onion') _applyTearyEyes()
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls before they can strike back. +${result.goldDrop} gold.`)
      _gainGold(result.goldDrop, tile.element)
      _gainXP(result.xpDrop ?? 0, tile.element)
      _endCombatVictory(tile)
      afterAttackPortrait(() => {
        UI.setPortraitAnim('idle')
      })
      _combatBusy = false
    }, 400)
  } else if (canSplit) {
    setTimeout(() => {
      const splitHP = Math.max(1, Math.floor(tile.enemyData.hp / 2))
      tile.enemyData.currentHP = splitHP
      tile.enemyData.hasSplit  = true
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.spawnFloat(tile.element, '🟢 Split!', 'damage')
      UI.splitSlime(tile.element)
      UI.updateEnemyHP(tile.element, splitHP)
      UI.setMessage(`The slime splits in two! Each half still fights. (${splitHP} HP remaining)`)
      afterAttackPortrait(() => {
        UI.setPortraitAnim('idle')
      })
      _combatBusy = false
    }, 400)
  } else {
    setTimeout(() => {
      tile.enemyData.currentHP = newEnemyHP
      if (tile.enemyData?.enemyId === 'onion') { _applyTearyEyes(); _checkOnionLayer(tile) }

      if (ignite) {
        tile.enemyData.burnTurns = 3
        UI.spawnFloat(tile.element, '🔥 Ignited!', 'damage')
      }

      // Tick burn damage if active
      if ((tile.enemyData.burnTurns ?? 0) > 0) {
        const burnDmg = Math.max(1, Math.floor(tile.enemyData.currentHP * 0.2))
        tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - burnDmg)
        tile.enemyData.burnTurns--
        UI.spawnFloat(tile.element, `🔥 ${burnDmg}`, 'damage')
        if (tile.enemyData.currentHP <= 0) {
          UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
          UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls to flames before they can strike back. +${result.goldDrop} gold.`)
          _gainGold(result.goldDrop, tile.element)
          _gainXP(result.xpDrop ?? 0, tile.element)
          _endCombatVictory(tile)
          afterAttackPortrait(() => {
            UI.setPortraitAnim('idle')
          })
          _combatBusy = false
          return
        }
      }

      // Decrement stun
      if (isStunned) tile.enemyData.stunTurns--

      // Enemy counter-attack (skipped if stunned)
      if (!isStunned) {
        _setEnemySprite(tile, 'attack')
        _takeDamage(result.enemyDmg, tile.element, true, tile.enemyData)
        UI.shakeTile(tile.element)
        if (GameState.is(States.DEATH)) { _combatBusy = false; return }
      }

      setTimeout(() => {
        _setEnemySprite(tile, 'idle')
        UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
        EventBus.emit('combat:damage', { amount: playerDmg, target: 'enemy' })
        let tradeMsg
        if (isStunned) {
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy is stunned — no counter-attack.`
        } else if (_save.settings.cheats?.godMode) {
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy strikes back — you take no damage.`
        } else {
          const taken = _computeEffectiveDamageTaken(result.enemyDmg)
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy strikes back for ${taken} damage.`
        }
        UI.setMessage(tradeMsg)
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)

        afterAttackPortrait(() => {
          if (!isStunned) UI.setPortraitAnim('hit')
          setTimeout(() => {
            UI.setPortraitAnim('idle')
          }, isStunned ? 0 : 500)
        })
        _combatBusy = false
      }, isStunned ? 200 : 500)
    }, 400)
  }
}

// ── Spell ─────────────────────────────────────────────────────

function slamAction() {
  if (!(_save.warrior?.upgrades ?? []).includes('slam')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(WARRIOR_UPGRADES.slam.manaCost)
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Slam!', true)
    return
  }

  UI.playSlam()
  EventBus.emit('audio:play', { sfx: 'slam' })

  // Collect all revealed living enemies
  const grid = TileEngine.getGrid()
  const targets = []
  for (const row of grid) {
    for (const tile of row) {
      if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        targets.push(tile)
      }
    }
  }

  if (targets.length === 0) {
    UI.setMessage('No enemies to Slam!', true)
    return
  }

  // Spend mana
  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true
  UI.setPortraitAnim('attack')
  const slamDmg = _scaleOutgoingDamageToEnemy(_slamDamagePerTarget())
  UI.setMessage(`💥 Slam! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} struck for ${slamDmg} each!`)

  // Stagger slash effects across targets
  targets.forEach((target, i) => {
    setTimeout(() => {
      UI.spawnSlash(target.element)
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - slamDmg)
      UI.spawnFloat(target.element, `💥 ${slamDmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        _gainGold(target.enemyData.goldDrop ? _rand(...target.enemyData.goldDrop) : 1, target.element)
        _gainXP(target.enemyData.xpDrop ?? 0, target.element)
        _endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 120)
  })

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
  }, targets.length * 120 + 400)
}

function abilitySlotAAction() {
  if (_charKey() === 'ranger') ricochetAction()
  else slamAction()
}

function ricochetAction() {
  if (!_isRangerActiveUnlocked('ricochet')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(RANGER_UPGRADES.ricochet.manaCost + _tearyExtraCost())

  if (!_ricochetSelecting) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Ricochet!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    _ricochetSelecting = true
    _ricochetTiles     = []
    UI.setRicochetActive(true)
    UI.setGridRicochetMode(true)
    UI.clearRicochetMarks()
    UI.setMessage('🏹 Ricochet — tap up to 3 enemies (order matters). The 3rd pick fires; with 1–2 picks, tap Ricochet again.')
    return
  }

  if (_ricochetTiles.length === 0) {
    _cancelRicochetMode()
    UI.setMessage('Ricochet cancelled.')
    return
  }

  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Ricochet!', true)
    return
  }

  _executeRicochet()
}

function _executeRicochet() {
  const cost    = _stillWaterManaCost(RANGER_UPGRADES.ricochet.manaCost + _tearyExtraCost())
  const ordered = _ricochetTiles.slice()
  _cancelRicochetMode()

  const targets = ordered.filter(t => t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune)
  const immuneCount = ordered.filter(t => t.enemyData && !t.enemyData._slain && t.enemyData.spellImmune).length
  if (targets.length === 0) {
    UI.setMessage(immuneCount > 0 ? '🛡️ All selected enemies are immune to Ricochet!' : 'Ricochet — no valid targets left.', true)
    return
  }

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true
  UI.setPortraitAnim('attack')
  const dmgSeq = _ricochetDamageSequence(targets.length, 'ricochet')
  UI.setMessage(`🏹 Ricochet — ${targets.length} shot${targets.length > 1 ? 's' : ''}! (${dmgSeq.join(' → ')})`)

  targets.forEach((target, i) => {
    const dmg = _scaleOutgoingDamageToEnemy(dmgSeq[i])
    setTimeout(() => {
      if (!target.enemyData || target.enemyData._slain) return
      UI.spawnArrow(target.element)
      EventBus.emit('audio:play', { sfx: 'arrowShot' })
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - dmg)
      _checkOnionLayer(target)
      UI.spawnFloat(target.element, `🏹 ${dmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        _gainGold(target.enemyData.goldDrop ? _rand(...target.enemyData.goldDrop) : 1, target.element)
        _gainXP(target.enemyData.xpDrop ?? 0, target.element)
        _endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 120)
  })

  // Unlike Ranger melee, Ricochet is a short volley — do not hold _combatBusy for
  // RANGER_FIGHT_ATTACK_PORTRAIT_MS (4s) or the next enemy tap is silently ignored.
  const doneMs = targets.length * 120 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
  }, doneMs)
}

function arrowBarrageAction() {
  if (!_isRangerActiveUnlocked('arrow-barrage')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + _tearyExtraCost())

  if (!_arrowBarrageSelecting) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelRicochetMode()
    _cancelPoisonArrowShotMode()
    _arrowBarrageSelecting = true
    UI.setArrowBarrageActive(true)
    UI.setGridArrowBarrageMode(true)
    UI.setMessage(
      '🏹 Triple Volley — tap a revealed tile to place a 3×3 blast (50% attack each enemy, min 1). Tap the same tile again to fire; tap the ability to cancel.',
    )
    return
  }

  _cancelArrowBarrageMode()
  UI.setMessage('Triple Volley cancelled.')
}

function _tripleVolleyDamagePerEnemy() {
  const avg = _avgMeleeDamage()
  const pct = CONFIG.ability.tripleVolleyHeroDamagePct
  const mult = _rangerActiveDamageMult('arrow-barrage')
  return Math.max(1, Math.round(avg * pct * mult))
}

function _tilesIn3x3(centerRow, centerCol) {
  const grid = TileEngine.getGrid()
  if (!grid?.length) return []
  const rows = grid.length
  const cols = grid[0].length
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerRow + dr
      const c = centerCol + dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      out.push(grid[r][c])
    }
  }
  return out
}

function _executeTripleVolley(center) {
  const cost = _stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + _tearyExtraCost())
  const tiles = _tilesIn3x3(center.row, center.col)
  const targets = tiles.filter(t => t.revealed && t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune)

  if (targets.length === 0) {
    UI.setMessage('Triple Volley — no enemies in that 3×3 area. Pick another center.', true)
    _tripleVolleyCenter = null
    UI.clearTripleVolleyAoePreview()
    return
  }

  _cancelArrowBarrageMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const dmg = _scaleOutgoingDamageToEnemy(_tripleVolleyDamagePerEnemy())
  _combatBusy = true
  UI.setPortraitAnim('attack')
  UI.setMessage(`🏹 Triple Volley! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} for ${dmg} each.`)

  EventBus.emit('audio:play', {
    sfx: 'arrowShot',
    layered: {
      count: Math.min(14, 6 + targets.length * 2),
      spreadMs: 120,
      jitterMs: 35,
    },
  })

  // Rain of arrows overlay across all 9 tiles
  UI.spawnArrowRain(tiles.map(t => t.element), targets.length * 120 + 600)

  targets.forEach((target, i) => {
    setTimeout(() => {
      const t = TileEngine.getTile(target.row, target.col)
      if (!t?.enemyData || t.enemyData._slain) return
      UI.spawnArrow(t.element)
      UI.shakeTile(t.element)
      t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - dmg)
      _checkOnionLayer(t)
      UI.spawnFloat(t.element, `🏹 ${dmg}`, 'xp')
      if (t.enemyData.currentHP <= 0) {
        _gainGold(t.enemyData.goldDrop ? _rand(...t.enemyData.goldDrop) : 1, t.element)
        _gainXP(t.enemyData.xpDrop ?? 0, t.element)
        _endCombatVictory(t)
      } else {
        UI.updateEnemyHP(t.element, t.enemyData.currentHP)
      }
    }, i * 120)
  })

  const doneMs = targets.length * 120 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
  }, doneMs)
}

function poisonArrowShotAction() {
  if (!_isRangerActiveUnlocked('poison-arrow-shot')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + _tearyExtraCost())

  if (!_poisonArrowShotSelecting) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Poison Arrow!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _poisonArrowShotSelecting = true
    UI.setPoisonArrowShotActive(true)
    UI.setGridPoisonArrowShotMode(true)
    UI.setMessage('☠️ Poison Arrow — tap one enemy. Tap again to cancel.')
    return
  }

  _cancelPoisonArrowShotMode()
  UI.setMessage('Poison Arrow cancelled.')
}

function _executePoisonArrowShot(tile) {
  const cost = _stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + _tearyExtraCost())
  if (!tile?.enemyData || tile.enemyData._slain) {
    _cancelPoisonArrowShotMode()
    return
  }

  if (tile.enemyData?.spellImmune) {
    _cancelPoisonArrowShotMode()
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to Poison Arrow!`, true)
    return
  }

  const row = tile.row
  const col = tile.col
  _cancelPoisonArrowShotMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const initial = _scaleOutgoingDamageToEnemy(_poisonArrowUnitDamage())
  _combatBusy = true
  UI.setPortraitAnim('attack')

  const t0 = TileEngine.getTile(row, col)
  if (!t0?.enemyData || t0.enemyData._slain) {
    UI.setPortraitAnim('idle')
    _combatBusy = false
    return
  }

  UI.spawnArrow(t0.element)
  EventBus.emit('audio:play', { sfx: 'arrowShot' })
  UI.shakeTile(t0.element)
  t0.enemyData.currentHP = Math.max(0, t0.enemyData.currentHP - initial)
  UI.spawnFloat(t0.element, `☠️ ${initial}`, 'xp')

  if (t0.enemyData.currentHP <= 0) {
    _gainGold(t0.enemyData.goldDrop ? _rand(...t0.enemyData.goldDrop) : 1, t0.element)
    _gainXP(t0.enemyData.xpDrop ?? 0, t0.element)
    _endCombatVictory(t0)
    setTimeout(() => {
      UI.setPortraitAnim('idle')
      _combatBusy = false
    }, 400)
    return
  }

  t0.enemyData.poisonTurns = 3
  UI.updateEnemyHP(t0.element, t0.enemyData.currentHP)
  UI.setMessage(`☠️ Poison Arrow! The foe is poisoned (${initial} + ${3} ticks on turns — flips or melee).`)

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
  }, 400)
}

function spellAction() {
  const effectiveCost = _previewSpellManaCostForUi()
  if (run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }
  // Toggle targeting mode
  _spellTargeting = !_spellTargeting
  UI.setSpellTargeting(_spellTargeting, effectiveCost)
  if (_spellTargeting) {
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    _spyglassTargeting = false
    _lanternTargeting = false
    UI.setLanternTargeting(false)
    UI.setMessage('✨ Choose an enemy to target.')
  } else {
    UI.setMessage('Spell cancelled.')
  }
}

function lanternAction() {
  const inv = run.player.inventory
  const entry = inv.find(e => e.id === 'lantern')
  if (!entry) return
  if (_combatBusy) return

  _spyglassTargeting = false
  _lanternTargeting = !_lanternTargeting
  UI.setLanternTargeting(_lanternTargeting)
  if (_lanternTargeting) {
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    UI.setMessage('🏮 Lantern lit — tap any hidden tile to reveal it.')
  } else {
    UI.setMessage('Lantern extinguished.')
  }
}

function spyglassAction() {
  const inv = run.player.inventory
  const entry = inv.find(e => e.id === 'spyglass')
  if (!entry) return
  if (_combatBusy) return

  if (_spellTargeting) {
    _spellTargeting = false
    const effectiveCost = _previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (_lanternTargeting) {
    _lanternTargeting = false
    UI.setLanternTargeting(false)
  }
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (_blindingLightTargeting) {
    _blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (_divineLightSelecting) {
    _divineLightSelecting = false
    UI.setDivineLightActive(false)
  }

  _spyglassTargeting = !_spyglassTargeting
  UI.setLanternTargeting(_spyglassTargeting)
  if (_spyglassTargeting) {
    UI.setMessage('🔭 Spyglass raised — tap a hidden tile to glimpse it.')
  } else {
    UI.setMessage('Spyglass lowered.')
  }
}

function hourglassAction() {
  if (!run._hourglassSnapshot) {
    UI.setMessage('Nothing to rewind yet.', true)
    return
  }
  if (_combatBusy) {
    UI.setMessage('Not while combat is resolving.', true)
    return
  }
  if (GameState.is(States.LEVEL_UP)) {
    UI.setMessage('Cannot rewind during level-up.', true)
    return
  }
  const p = run.player
  if (p.gold < 1) {
    UI.setMessage('You need 1 gold to use Hourglass Sand.', true)
    return
  }
  _restoreHourglassSnapshot(run._hourglassSnapshot)
  _spyglassTargeting = false
  _lanternTargeting = false
  UI.setLanternTargeting(false)
  p.mana = 0
  p.hp -= 1
  p.gold -= 1
  UI.updateMana(p.mana, p.maxMana)
  UI.updateHP(p.hp, p.maxHp)
  UI.updateGold(p.gold)
  if (p.hp <= 0) {
    _die()
    return
  }
  UI.setMessage('⏳ The sands reverse — your last step is undone, at a grim price.')
  EventBus.emit('audio:play', { sfx: 'spell' })
}

function _useLanternOn(tile) {
  _lanternTargeting = false
  _spyglassTargeting = false
  UI.setLanternTargeting(false)

  const inv   = run.player.inventory
  const entry = inv.find(e => e.id === 'lantern')
  if (!entry) return

  // Consume lantern
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)

  revealTile(tile)
  UI.setMessage('🏮 The lantern burns bright — a tile revealed!')
}

function _useSpyglassOn(tile) {
  _spyglassTargeting = false
  _lanternTargeting = false
  UI.setLanternTargeting(false)

  const inv   = run.player.inventory
  const entry = inv.find(e => e.id === 'spyglass')
  if (!entry) return

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)

  const label = _spyglassHintLabel(tile.type)
  UI.spawnFloat(tile.element, label, 'mana')
  UI.setMessage(`🔭 You glimpse: ${label}`)
  EventBus.emit('audio:play', { sfx: 'menu' })
}

function blindingLightAction() {
  if (!(_save.warrior?.upgrades ?? []).includes('blinding-light')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Blinding Light!', true)
    return
  }

  _blindingLightTargeting = !_blindingLightTargeting
  UI.setBlindingLightActive(_blindingLightTargeting)
  if (_blindingLightTargeting) {
    _spyglassTargeting = false
    _lanternTargeting = false
    UI.setLanternTargeting(false)
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    UI.setMessage('✨ Choose an enemy to blind.')
  } else {
    UI.setMessage('Blinding Light cancelled.')
  }
}

function _castBlindingLight(tile) {
  _blindingLightTargeting = false
  UI.setBlindingLightActive(false)

  const cost = _stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  let stun = _blindingLightStunTurns()
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) stun = Math.round(stun * 2)
  if (run.player.beastBonus  && isBeast)  stun = Math.round(stun * 2)
  stun = Math.max(2, stun)
  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast)
    ? ' (2× stun!)' : ''

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  UI.setPortraitAnim('attack')
  UI.spawnFloat(tile.element, `⏱️ +${stun}`, 'mana')
  UI.flashTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'spell' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)

  tile.enemyData.stunTurns = (tile.enemyData.stunTurns ?? 0) + stun

  UI.setMessage(
    `✨ Blinding Light${bonusSuffix} — +${stun} stun turn${stun === 1 ? '' : 's'}! ${tile.enemyData.label} cannot counter-attack (${tile.enemyData.currentHP} HP).`,
  )
}

// ── Divine Light ──────────────────────────────────────────────

function divineLightAction() {
  if (_charKey() !== 'warrior') return
  const warriorUpgrades = _save.warrior?.upgrades ?? []
  if (!warriorUpgrades.includes('divine-light')) return
  if (_combatBusy) return

  const cost = _stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + _tearyExtraCost())
  if (!_divineLightSelecting) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Divine Light!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelRicochetMode()
    _cancelArrowBarrageMode()
    _cancelPoisonArrowShotMode()
    _spyglassTargeting = false
    _lanternTargeting = false
    UI.setLanternTargeting(false)
    _divineLightSelecting = true
    UI.setDivineLightActive(true)
    UI.setMessage('🌟 Divine Light — tap an enemy to smite it, or tap your portrait to heal 10% HP.')
  } else {
    _divineLightSelecting = false
    UI.setDivineLightActive(false)
    UI.setMessage('Divine Light cancelled.')
  }
}

function divineLightHealAction() {
  if (!_divineLightSelecting) return
  const cost = _stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }
  _divineLightSelecting = false
  UI.setDivineLightActive(false)
  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const heal = Math.max(1, Math.floor(run.player.maxHp * 0.10))
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal)
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.setPortraitAnim('attack')
  EventBus.emit('audio:play', { sfx: 'divineLight' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)
  UI.setMessage(`🌟 Divine Light — restored ${heal} HP! (${run.player.hp}/${run.player.maxHp})`)
}

function _castDivineLightSmite(tile) {
  _divineLightSelecting = false
  UI.setDivineLightActive(false)

  const cost = _stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  const dmg = _scaleOutgoingDamageToEnemy(Math.max(1, Math.round(_avgMeleeDamage())))
  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
  UI.setPortraitAnim('attack')
  UI.spawnFloat(tile.element, `🌟 ${dmg}`, 'mana')
  UI.flashTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'divineLight' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)

  if (tile.enemyData.currentHP <= 0) {
    UI.setMessage(`🌟 Divine Light smites for ${dmg}! The enemy is destroyed. +${tile.enemyData.goldDrop ? 1 : 0} gold.`)
    _gainGold(1, tile.element)
    _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
  } else {
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
    UI.setMessage(`🌟 Divine Light smites for ${dmg}! ${tile.enemyData.label} has ${tile.enemyData.currentHP} HP left.`)
  }
}

function _castSpell(tile) {
  _spellTargeting = false
  const effectiveCost = _stillWaterManaCost(
    Math.max(1, CONFIG.spell.manaCost - (run.player.spellCostReduction ?? 0)) + _tearyExtraCost(),
  )
  UI.setSpellTargeting(false, effectiveCost)

  if (run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  const result = CombatResolver.resolveSpell(run.player, tile.enemyData)

  let spellDmg = result.damage
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) spellDmg = Math.round(spellDmg * 2)
  if (run.player.beastBonus  && isBeast)  spellDmg = Math.round(spellDmg * 2)
  spellDmg = _scaleOutgoingDamageToEnemy(spellDmg)

  UI.setPortraitAnim('attack')
  run.player.mana -= effectiveCost
  _markStillWaterAbilityUsed()
  if (run.player.inventory.some(e => e.id === 'surge-pearl') && Math.random() < 0.20) {
    const refund = Math.floor(effectiveCost / 2)
    if (refund > 0) {
      run.player.mana = Math.min(run.player.maxMana, run.player.mana + refund)
      UI.spawnFloat(document.getElementById('hud-portrait'), `+${refund} MP`, 'mana')
    }
  }
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.spawnFloat(tile.element, `✨ ${spellDmg}`, 'mana')
  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast)
    ? ' (2×!)' : ''
  tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - spellDmg)
  _checkOnionLayer(tile)
  EventBus.emit('audio:play', { sfx: 'spell' })
  EventBus.emit('combat:spell', { manaCost: effectiveCost })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)
  if (tile.enemyData.currentHP <= 0) {
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! +${result.goldDrop} gold.`)
    _gainGold(result.goldDrop, tile.element)
    _gainXP(result.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
  } else {
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! Enemy has ${tile.enemyData.currentHP} HP left.`)
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
  }
}

function _endCombatVictory(tile) {
  tile.enemyData._slain = true
  TileEngine.unlockAdjacent(tile.row, tile.col, UI.unlockTile.bind(UI))
  if (tile.enemyData?.isBoss) {
    run.bossFloorExitPending = true
    tile.type = 'exit'
    tile.enemyData = null
    UI.markBossTileAsExit(tile.element)
    tile.exitResolved = false
    tile.element?.classList.add('exit-pending')
    UI.setMessage('🚪 The way forward opens. Tap the stairs when you are ready.')
  } else {
    UI.markTileSlain(tile.element)
  }

  // Tongue Snatch: return stolen gold on kill
  if ((tile.enemyData?.snatched ?? 0) > 0) {
    _gainGold(tile.enemyData.snatched, tile.element)
    UI.spawnFloat(tile.element, `👅 +${tile.enemyData.snatched}💰 returned!`, 'heal')
  }

  if (run.player.onKillHeal > 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.onKillHeal)
    UI.spawnFloat(tile.element, `+${run.player.onKillHeal} HP`, 'heal')
    UI.updateHP(run.player.hp, run.player.maxHp)
  }

  if (run.player.inventory.some(e => e.id === 'vampire-fang')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 1)
    UI.spawnFloat(tile.element, '+1 HP', 'heal')
    UI.updateHP(run.player.hp, run.player.maxHp)
  }
  if (run.player.inventory.some(e => e.id === 'greed-tooth')) {
    _gainGold(1, tile.element)
  }
  if (run.player.inventory.some(e => e.id === 'echo-charm')) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element) {
        const cat = _echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }

  EventBus.emit('audio:play', { sfx: 'gold' })
  EventBus.emit('combat:end', { outcome: 'victory' })
  _checkFloorCleared()
}

// ── Hasty Retreat ────────────────────────────────────────────

function doRetreat() {
  if (GameState.is(States.NPC_INTERACT) && run.merchantTile) {
    _closeMerchantSession(run.merchantTile, false)
  }

  const pct      = run.player.retreatPercent ?? CONFIG.retreat.goldKeepPercent
  const keptGold = Math.floor(run.player.gold * pct)
  run.player.gold = keptGold
  UI.updateGold(keptGold)
  UI.hideRetreat()
  UI.hideActionPanel()
  UI.hideMerchant()
  UI.setMessage(`You flee the dungeon, clutching ${keptGold} gold.`)
  EventBus.emit('run:retreat', { goldBanked: keptGold })

  const stats = _runStats()
  const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'retreat')

  setTimeout(() => {
    UI.showRunSummary('retreat', { ...stats, xpEarned, goldBanked })
    _wireRunSummaryBtn()
  }, 1200)
}

// ── Floor progression ────────────────────────────────────────

function _handleExit() {
  if (run.atRest) {
    run.atRest = false
    run.floorKeyAwarded = false
    run.floor++
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage(`🚪 Descending to floor ${run.floor}...`)
    EventBus.emit('run:floorAdvance', { newFloor: run.floor })
    UI.runFloorTransition(3000, () => {
      GameState.set(States.BOOT)
      _startFloor()
    }, run.floor)
    return
  }
  if (run.bossFloorExitPending) {
    run.bossFloorExitPending = false
    run.atRest = true
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage('Stone gives way to still air — a sanctuary between the depths.')
    EventBus.emit('run:floorAdvance', { newFloor: run.floor })
    UI.runFloorTransition(3000, () => {
      GameState.set(States.BOOT)
      _startFloor()
    }, null)
    return
  }
  if (run.floor >= CONFIG.floorNames.length) {
    const stats = _runStats()
    const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'escape')
    UI.setMessage('🚪 You escaped the dungeon alive!')
    EventBus.emit('run:complete', { outcome: 'escape' })
    EventBus.emit('audio:play', { sfx: 'levelup' })
    setTimeout(() => {
      UI.showRunSummary('escape', { ...stats, xpEarned, goldBanked })
      _wireRunSummaryBtn()
    }, 800)
  } else {
    _nextFloor()
  }
}

function _confirmRope(tile) {
  if (tile.type !== 'rope' || tile.ropeResolved) return
  UI.showRopeModal(
    () => {
      tile.ropeResolved = true
      tile.element?.classList.remove('rope-pending')
      const stats = _runStats()
      const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'escape')
      UI.setMessage('You climb the rope and escape with all your gold!')
      EventBus.emit('run:complete', { outcome: 'escape' })
      EventBus.emit('audio:play', { sfx: 'retreat' })
      UI.hideRetreat()
      UI.hideActionPanel()
      setTimeout(() => {
        UI.showRunSummary('escape', { ...stats, xpEarned, goldBanked })
        _wireRunSummaryBtn()
      }, 600)
    },
    () => {
      UI.setMessage('You leave the rope for now. Tap again when you are ready to climb out.')
    }
  )
}

function _nextFloor() {
  run.floorKeyAwarded = false
  run.floor++
  EventBus.emit('audio:play', { sfx: 'footsteps' })
  UI.setMessage(`🚪 Descending to floor ${run.floor}...`)
  EventBus.emit('run:floorAdvance', { newFloor: run.floor })
  UI.runFloorTransition(3000, () => {
    GameState.set(States.BOOT)
    _startFloor()
  }, run.floor)
}

// ── Player stat helpers ──────────────────────────────────────

function _computeEffectiveDamageTaken(rawAmount) {
  const scaled = Math.round(rawAmount * (run.player.damageTakenMult ?? 1))
  return Math.max(1, scaled - (run.player.damageReduction ?? 0))
}

function _takeDamage(amount, tileEl, skipPortraitAnim = false, killerData = null) {
  if (_save.settings.cheats?.godMode) return
  if (run?.player?.inventory?.some(e => e.id === 'lucky-rabbit-foot') && Math.random() < 0.02) {
    UI.spawnFloat(tileEl, '🐰 Lucky!', 'heal')
    return
  }
  const effective = _computeEffectiveDamageTaken(amount)
  run.player.hp   = Math.max(0, run.player.hp - effective)
  UI.spawnFloat(tileEl, `-${effective} HP`, 'damage')
  UI.updateHP(run.player.hp, run.player.maxHp)
  EventBus.emit('player:hpChange', { amount: -effective, newHP: run.player.hp })
  if (run.player.hp <= 0) { _die(killerData); return }
  if (!skipPortraitAnim) {
    UI.setPortraitAnim('hit')
    setTimeout(() => UI.setPortraitAnim('idle'), 800)
  }
}

function _gainGold(amount, tileEl) {
  run.player.gold += amount
  UI.spawnFloat(tileEl, `+${amount}🪙`, 'gold')
  UI.updateGold(run.player.gold)
  EventBus.emit('player:goldChange', { amount, newTotal: run.player.gold })
}

function _gainXP(amount, tileEl) {
  const regen = CONFIG.player.manaRegenPerTile
  if (regen > 0 && run.player.mana < run.player.maxMana) {
    const hasManaRing = run.player.inventory.some(e => e.id === 'mana-ring')
    const manaGain = (hasManaRing && Math.random() < 0.10) ? regen * 2 : regen
    run.player.mana = Math.min(run.player.maxMana, run.player.mana + manaGain)
    if (hasManaRing && manaGain > regen) {
      UI.spawnFloat(tileEl, `+${manaGain}🔵`, 'mana')
    }
    UI.updateMana(run.player.mana, run.player.maxMana)
  }

  run.player.xp += amount
  const needed = _xpNeeded()
  if (run.player.xp >= needed) {
    run.player.xp -= needed
    run.player.level++
    UI.spawnFloat(tileEl, `⬆️ Lv ${run.player.level}!`, 'xp')
    EventBus.emit('player:levelup', { newLevel: run.player.level })
    EventBus.emit('audio:play', { sfx: 'levelup' })
    _triggerLevelUp()
  }
  UI.updateXP(run.player.xp, _xpNeeded())
}

function _metaUnlockedForLevelUp() {
  const c = _charKey()
  return c === 'ranger'
    ? (_save.ranger?.upgrades ?? [])
    : (_save.warrior?.upgrades ?? [])
}

function _triggerLevelUp() {
  const char    = _charKey()
  const choices = ProgressionSystem.getChoices(run.player.abilities, char, _metaUnlockedForLevelUp())
  if (choices.length === 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 10)
    UI.updateHP(run.player.hp, run.player.maxHp)
    run.levelUpLog.push({
      level:     run.player.level,
      abilityId: null,
      name:      '+10 HP (all choices mastered)',
      icon:      '❤️',
    })
    UI.setMessage(`Level ${run.player.level}! Fully mastered. (+10 HP)`)
    return
  }

  GameState.transition(States.LEVEL_UP)

  const count      = run.player.extraAbilityChoice ? 4 : 3
  const choiceData = choices.slice(0, count).map(id => ({
    id,
    ...ProgressionSystem.getAbilityDef(id, char),
  }))

  UI.showLevelUpOverlay(choiceData, (abilityId) => {
    ProgressionSystem.applyAbility(abilityId, run.player, char)
    const def = ProgressionSystem.getAbilityDef(abilityId, char)
    run.levelUpLog.push({
      level:     run.player.level,
      abilityId,
      name:      def?.name ?? abilityId,
      icon:      def?.icon ?? '✨',
    })
    UI.hideLevelUpOverlay()
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.updateGold(run.player.gold)
    {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
    }
    UI.setMessage(`${def?.name ?? abilityId} acquired! Level ${run.player.level}.`)
    if (char === 'ranger') _refreshRangerActiveHud()
    GameState.transition(States.FLOOR_EXPLORE)
  })
}

function _xpNeeded() {
  return CONFIG.xp.levelUpAt * run.player.level
}

function _playerDamageRange(player) {
  const bonus = player.damageBonus ?? 0
  if (player.isRanger) {
    const [lo, hi] = RANGER_BASE.damage
    return [lo + bonus, hi + bonus]
  }
  const base = CONFIG.player.baseDamage
  const b = Array.isArray(base) ? base[0] : base
  return [b + bonus, b + bonus]
}

function _avgMeleeDamage() {
  const [lo, hi] = _playerDamageRange(run.player)
  return (lo + hi) / 2
}

function _slamMultFromStacks(stacks) {
  const baseTenths = Math.round(CONFIG.ability.slamPerTargetMult * 10)
  return (baseTenths + stacks) / 10
}

function _blindingLightMultFromStacks(stacks) {
  const baseTenths = Math.round(CONFIG.ability.blindingLightStunMult * 10)
  return (baseTenths + stacks) / 10
}

/** Stun turns only — same avgMelee × mult formula as old “damage”; no HP loss. Minimum 2 turns. */
function _blindingLightStunTurns() {
  const avg = _avgMeleeDamage()
  const m = _blindingLightMultFromStacks(run.player.blindingLightMasteryStacks ?? 0)
  return Math.max(2, Math.round(avg * m))
}

function _slamDamagePerTarget() {
  const avg    = _avgMeleeDamage()
  const stacks = run.player.slamMasteryStacks ?? 0
  const m      = _slamMultFromStacks(stacks)
  return Math.max(1, Math.round(avg * m))
}

/** For Slam info modal — null if no active run or not warrior. */
function getSlamDamageBreakdown() {
  if (!run || run.player?.isRanger) return null
  const avg = _avgMeleeDamage()
  const baseTenths = Math.round(CONFIG.ability.slamPerTargetMult * 10)
  const stacks = run.player.slamMasteryStacks ?? 0
  const m = _slamMultFromStacks(stacks)
  const final = Math.max(1, Math.round(avg * m))
  return { avgMelee: avg, baseTenths, stacks, mult: m, final }
}

function getDivineLightBreakdown() {
  if (!run || run.player?.isRanger) return null
  const avg  = _avgMeleeDamage()
  const smite = Math.max(1, Math.round(avg))
  const heal  = Math.max(1, Math.floor(run.player.maxHp * 0.10))
  return { avgMelee: avg, smite, heal, maxHp: run.player.maxHp }
}

function getBlindingLightBreakdown() {
  if (!run || run.player?.isRanger) return null
  const avg = _avgMeleeDamage()
  const baseTenths = Math.round(CONFIG.ability.blindingLightStunMult * 10)
  const stacks = run.player.blindingLightMasteryStacks ?? 0
  const m = _blindingLightMultFromStacks(stacks)
  const stunTurns = Math.max(2, Math.round(avg * m))
  return { avgMelee: avg, baseTenths, stacks, mult: m, stunTurns, final: stunTurns }
}

function _hasRicochetArcMasteryMeta() {
  return (_save.ranger?.upgrades ?? []).includes('ricochet-arc-mastery')
}

/** Returns [1st, 2nd, 3rd] shot damage for Ricochet (length matches targets). Ricochet only: 4:3:2 with meta Ricochet Mastery. */
function _ricochetDamageSequence(targetCount, abilityKey = 'ricochet') {
  const avg = _avgMeleeDamage()
  const m   = CONFIG.ability.ricochetUnitMult
  const mult = _rangerActiveDamageMult(abilityKey)
  const unit = Math.max(1, Math.round(avg * m * mult))
  const weights =
    abilityKey === 'ricochet' && _hasRicochetArcMasteryMeta() ? [4, 3, 2] : [3, 2, 1]
  const seq = weights.map(w => w * unit)
  return seq.slice(0, targetCount)
}

function getRicochetBreakdown() {
  if (!run || !run.player?.isRanger) return null
  const arc = _hasRicochetArcMasteryMeta()
  const seq = _ricochetDamageSequence(3, 'ricochet')
  const weights = arc ? [4, 3, 2] : [3, 2, 1]
  const unit = seq[0] / weights[0]
  return { shots: seq, unit, patternLabel: arc ? '4 : 3 : 2' : '3 : 2 : 1' }
}

/** Poison Arrow initial hit + each DoT tick — same unit formula as Ricochet’s 1× shot. */
function _poisonArrowUnitDamage() {
  const avg = _avgMeleeDamage()
  const m   = CONFIG.ability.ricochetUnitMult
  const mult = _rangerActiveDamageMult('poison-arrow-shot')
  return Math.max(1, Math.round(avg * m * mult))
}

function getArrowBarrageBreakdown() {
  if (!run || !run.player?.isRanger) return null
  const avg = _avgMeleeDamage()
  const pct = CONFIG.ability.tripleVolleyHeroDamagePct
  const mult = _rangerActiveDamageMult('arrow-barrage')
  const perEnemy = Math.max(1, Math.round(avg * pct * mult))
  return { perEnemy, avgMelee: avg, heroDamagePct: pct, mult, area: '3×3' }
}

function getPoisonArrowShotBreakdown() {
  if (!run || !run.player?.isRanger) return null
  const per = _poisonArrowUnitDamage()
  return { perHit: per, initial: per, flipTicks: 3, dotTotal: per * 3 }
}

// ── Death ────────────────────────────────────────────────────

function _die(killerData = null) {
  _spellTargeting         = false
  _combatBusy             = false
  _lanternTargeting       = false
  _spyglassTargeting      = false
  _blindingLightTargeting = false
  _divineLightSelecting   = false
  UI.setDivineLightActive(false)
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0) }
  _clearActiveRun()
  UI.setPortraitAnim('death')
  GameState.transition(States.DEATH)
  UI.hideActionPanel()
  UI.hideRetreat()
  UI.hideMerchant()
  UI.setMessage('💀 You have perished in the depths...', true)
  EventBus.emit('audio:play', { sfx: 'death' })

  const stats = _runStats()
  const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'death')
  EventBus.emit('player:death', { runStats: stats })

  // Build killer card data for the summary screen
  const killer = killerData ? _buildKillerCard(killerData) : null

  setTimeout(() => {
    UI.showRunSummary('death', { ...stats, xpEarned, goldBanked, killer })
    _wireRunSummaryBtn()
  }, 800)
}

function _buildKillerCard(e) {
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

function _runStats() {
  return {
    gold:          run.player.gold,
    safeGold:      run.player.safeGold,
    level:         run.player.level,
    floor:         run.floor,
    tilesRevealed: run.tilesRevealed,
    character:     _charKey(),
  }
}

function _wireRunSummaryBtn() {
  const btn = document.getElementById('try-again-btn')
  if (btn) btn.addEventListener('click', () => {
    UI.hideRunSummary()
    returnToMenu(true)
  }, { once: true })
}

function _rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Inventory / backpack ─────────────────────────────────────

function _addToBackpack(id) {
  const inv   = run.player.inventory
  const item  = ITEMS[id]
  if (!item) return
  if (item.stackable) {
    const existing = inv.find(e => e.id === id)
    if (existing) { existing.qty++; return }
  }
  inv.push({ id, qty: 1 })
}

function _canAddToBackpack(id) {
  const inv  = run.player.inventory
  const item = ITEMS[id]
  if (!item) return false
  if (item.stackable && inv.some(e => e.id === id)) return true
  return inv.length < BACKPACK_MAX_SLOTS
}

function _checkFloorCleared() {
  if (run.atRest) return
  if (CONFIG.bossFloors.includes(run.floor)) return
  if (run.floorKeyAwarded) return
  const grid = TileEngine.getGrid()
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === 'enemy' || tile.type === 'enemy_fast') {
        if (!tile.revealed || !tile.enemyData?._slain) return
      }
    }
  }
  run.floorKeyAwarded = true
  run.player.goldenKeys = (run.player.goldenKeys ?? 0) + 1
  UI.updateGoldenKeys(run.player.goldenKeys)
  _syncMagicChestKeyGlow()
  UI.spawnFloat(document.getElementById('hud-portrait'), '🗝️ Golden Key!', 'xp')
  UI.setMessage(`Floor cleared! You find a 🗝️ Golden Key. (${run.player.goldenKeys} total) Spend it at the Magic Chest in the sanctuary.`)
  EventBus.emit('audio:play', { sfx: 'gold' })
}

function _openMagicChest(tile) {
  const keys = run.player.goldenKeys ?? 0
  if (keys <= 0) {
    UI.setMessage('The Magic Chest glimmers… but you have no 🗝️ Golden Keys. Clear a floor without fleeing to earn one.')
    return
  }
  const loot = tile.pendingLoot ?? _rollMagicChestLoot()
  const item = ITEMS[loot.type]
  if (loot.type === 'gold') {
    const amt = loot.amount ?? _rollMagicChestGoldAmount()
    run.player.goldenKeys--
    UI.updateGoldenKeys(run.player.goldenKeys)
    _syncMagicChestKeyGlow()
    tile.pendingLoot = null
    run.player.gold += amt
    UI.updateGold(run.player.gold)
    EventBus.emit('player:goldChange', { amount: amt, newTotal: run.player.gold })
    EventBus.emit('audio:play', { sfx: 'chest' })
    _animateMagicChestOpenClose(tile, `+${amt}🪙`)
    UI.setMessage(`The Magic Chest spills ${amt} gold! (${run.player.goldenKeys} keys left)`)
    return
  }
  // Smiths-tools: always apply instantly, no slot needed
  if (loot.type === 'smiths-tools') {
    run.player.goldenKeys--
    UI.updateGoldenKeys(run.player.goldenKeys)
    _syncMagicChestKeyGlow()
    tile.pendingLoot = null
    const def = ITEMS['smiths-tools']
    const amt = def?.effect?.amount ?? 1
    run.player.damageBonus = (run.player.damageBonus ?? 0) + amt
    {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
    }
    const floatLabel = `🔧 ${def.name}`
    EventBus.emit('audio:play', { sfx: 'chest' })
    _animateMagicChestOpenClose(tile, floatLabel)
    UI.setMessage(`The Magic Chest grants ${def.name}! +${amt} attack damage. (${run.player.goldenKeys} keys left)`)
    return
  }
  if (!_canAddToBackpack(loot.type)) {
    tile.pendingLoot = loot
    UI.setMessage(`Your backpack is full! Drop an item, then tap the Magic Chest again to claim your ${item?.name ?? loot.type}.`)
    return
  }
  run.player.goldenKeys--
  UI.updateGoldenKeys(run.player.goldenKeys)
  _syncMagicChestKeyGlow()
  tile.pendingLoot = null
  _addToBackpack(loot.type)
  EventBus.emit('inventory:changed')
  const floatLabel = item ? `${item.icon} ${item.name}` : `✨ ${loot.type}`
  EventBus.emit('audio:play', { sfx: 'chest' })
  _animateMagicChestOpenClose(tile, floatLabel)
  UI.setMessage(`✨ The Magic Chest bestows: ${item?.name ?? loot.type}! (${run.player.goldenKeys} keys left)`)
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

function useItem(id) {
  const inv   = run.player.inventory
  const entry = inv.find(e => e.id === id)
  if (!entry) return
  const item = ITEMS[id]
  if (!item) return

  const { effect } = item

  if (effect.type.startsWith('passive-')) {
    UI.setMessage(`${item.name} is a passive item — it's always active in your bag.`, true)
    return
  }

  if (effect.type === 'lantern') {
    lanternAction()
    return
  }
  if (effect.type === 'spyglass') {
    spyglassAction()
    return
  }
  if (effect.type === 'hourglass-sand') {
    hourglassAction()
    return
  }

  EventBus.emit('audio:play', { sfx: 'heal' })
  if (effect.type === 'heal') {
    const missing = run.player.maxHp - run.player.hp
    if (missing <= 0) { UI.setMessage('Already at full health!', true); return }
    const healed = Math.min(effect.amount, missing)
    run.player.hp += healed
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${healed} HP`, 'heal')
    UI.setMessage(`❤️ You drink a ${item.name} and restore ${healed} HP.`)
  } else if (effect.type === 'mana') {
    const missing = run.player.maxMana - run.player.mana
    if (missing <= 0) { UI.setMessage('Already at full mana!', true); return }
    const restored = Math.min(effect.amount, missing)
    run.player.mana += restored
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
    UI.setMessage(`🔵 You drink a ${item.name} and restore ${restored} mana.`)
  }

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
}

function getInventory() { return run?.player.inventory ?? [] }

function getLevelUpLog() {
  return run?.levelUpLog ? [...run.levelUpLog] : []
}

/** Remove one item from backpack (stack −1 or remove slot). Does not apply use effects. */
function dropItem(id) {
  if (!run) return
  const inv = run.player.inventory
  const entry = inv.find(e => e.id === id)
  if (!entry) return
  const item = ITEMS[id]
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
  UI.setMessage(item ? `Dropped ${item.name}.` : 'Item removed.')
  EventBus.emit('audio:play', { sfx: 'menu' })
}

// ── Cheat helpers ─────────────────────────────────────────────

function cheatSkipFloor() {
  if (!_save?.settings?.cheats?.skipFloorButton || !run) return
  if (!GameState.is(States.FLOOR_EXPLORE)) {
    UI.setMessage('[Cheat] Skip floor only works while exploring.', true)
    return
  }
  run.bossFloorExitPending = false
  if (run.atRest) {
    run.atRest = false
    run.floorKeyAwarded = false
    run.floor++
    EventBus.emit('audio:play', { sfx: 'footsteps' })
    UI.setMessage(`[Cheat] Skipped sanctuary → floor ${run.floor}`)
    EventBus.emit('run:floorAdvance', { newFloor: run.floor })
    UI.runFloorTransition(3000, () => {
      GameState.set(States.BOOT)
      _startFloor()
    }, run.floor)
    return
  }
  _nextFloor()
}

function applyCheat(key, enabled) {
  if (!_save.settings.cheats) _save.settings.cheats = {}
  _save.settings.cheats[key] = enabled

  if (key === 'skipFloorButton') {
    UI.refreshSkipFloorButton(_save)
  }
  if (key === 'increaseStats') {
    document.body.classList.toggle('cheat-increase-stats', enabled)
  }

  if (!run) return
  if (key === 'gold999' && enabled) {
    run.player.gold = 999
    UI.updateGold(run.player.gold)
  }
  if (key === 'xp999' && enabled) {
    run.player.xp = 999
    UI.updateXP(run.player.xp, _xpNeeded())
  }
}

/**
 * Cheat "Increase stats": tap HUD HP/mana/gold (+10 each), attack (+1 damageBonus), XP bar (+10% to next level), or golden key slot (+1 key).
 * Caller should ensure main menu is hidden (in a run).
 */
function cheatHudStatBoost(stat) {
  if (!_save?.settings?.cheats?.increaseStats || !run) return
  if (GameState.is(States.DEATH)) return
  stat = String(stat ?? '').trim().toLowerCase()
  if (stat === 'xp' && GameState.is(States.LEVEL_UP)) return

  const playable =
    GameState.is(States.FLOOR_EXPLORE) ||
    GameState.is(States.COMBAT) ||
    GameState.is(States.NPC_INTERACT) ||
    GameState.is(States.LEVEL_UP) ||
    GameState.is(States.RETREAT_CONFIRM)
  if (!playable) return

  const p = run.player
  if (stat === 'hp') {
    p.hp = Math.min(p.maxHp, p.hp + 10)
    UI.updateHP(p.hp, p.maxHp)
    return
  }
  if (stat === 'mana') {
    p.mana = Math.min(p.maxMana, p.mana + 10)
    UI.updateMana(p.mana, p.maxMana)
    return
  }
  if (stat === 'gold') {
    p.gold += 10
    UI.updateGold(p.gold)
    EventBus.emit('player:goldChange', { amount: 10, newTotal: p.gold })
    return
  }
  if (stat === 'goldenkey') {
    p.goldenKeys = (p.goldenKeys ?? 0) + 1
    UI.updateGoldenKeys(p.goldenKeys)
    _syncMagicChestKeyGlow()
    return
  }
  if (stat === 'dmg') {
    p.damageBonus = (p.damageBonus ?? 0) + 1
    {
      const [d0, d1] = _playerDamageRange(p)
      UI.updateDamageRange(d0, d1)
    }
    return
  }
  if (stat === 'xp') {
    const add = Math.max(1, Math.round(_xpNeeded() * 0.1))
    p.xp += add
    if (p.xp >= _xpNeeded()) {
      p.xp -= _xpNeeded()
      p.level++
      const xpEl = document.getElementById('xp-bar-container')
      if (xpEl) UI.spawnFloat(xpEl, `⬆️ Lv ${p.level}!`, 'xp')
      EventBus.emit('player:levelup', { newLevel: p.level })
      EventBus.emit('audio:play', { sfx: 'levelup' })
      _triggerLevelUp()
    }
    UI.updateXP(p.xp, _xpNeeded())
  }
}

export default {
  init,
  getSave() { return _save },
  isRangerActiveUnlocked: _isRangerActiveUnlocked,
  getSlamDamageBreakdown,
  getBlindingLightBreakdown,
  getDivineLightBreakdown,
  getRicochetBreakdown,
  getArrowBarrageBreakdown,
  getPoisonArrowShotBreakdown,
  newGame,
  returnToMenu,
  onTileTap,
  spellAction,
  slamAction,
  abilitySlotAAction,
  ricochetAction,
  arrowBarrageAction,
  poisonArrowShotAction,
  blindingLightAction,
  divineLightAction,
  divineLightHealAction,
  lanternAction,
  spyglassAction,
  hourglassAction,
  doRetreat,
  applyCheat,
  cheatSkipFloor,
  cheatHudStatBoost,
  useItem,
  dropItem,
  getInventory,
  getLevelUpLog,
  getTearyEyesTurns() { return run?.player?.tearyEyesTurns ?? 0 },
  hasActiveRun()      { return !!_save?.activeRun },
  getActiveRunInfo()  { return _save?.activeRun ?? null },
  resumeRun,
  abandonRun,
}
