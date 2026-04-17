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
import { ENGINEER_BASE, ENGINEER_UPGRADES, ENGINEER_TURRET } from '../data/engineer.js'
import { MAGE_BASE, MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_BASE, VAMPIRE_DARK_EYES_MAX_TILES } from '../data/vampire.js'
import { WARRIOR_UPGRADES }  from '../data/upgrades.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE, TILE_TYPE_ICON_FILES, MAGIC_CHEST_OPEN_GIF, MAGIC_CHEST_GIF_DURATION_MS } from '../data/tileIcons.js'
import { TILE_BLURBS }       from '../data/tileBlurbs.js'
import { ITEMS }             from '../data/items.js'
import { STORY_EVENTS, MERCHANT_ITEMS, rollEventType } from '../data/events.js'
import Bestiary              from '../systems/Bestiary.js'
import TrinketCodex          from '../systems/TrinketCodex.js'
import { FORGE_RECIPES }     from '../data/combinations.js'
import {
  createInitialTelemetry,
  buildLevelSnapshotRecord,
} from '../balance/runTelemetry.js'

// ── Loot pools by rarity ─────────────────────────────────────

const COMMON_LOOT_IDS = [
  'potion-red', 'potion-blue', 'lantern', 'smiths-tools', 'spyglass', 'scavengers-bag',
]

const RARE_TRINKET_IDS = [
  'fire-ring', 'mana-ring', 'echo-charm', 'vampire-fang', 'glass-cannon-shard',
  'duelists-glove', 'surge-pearl', 'still-water-amulet', 'greed-tooth',
  'lucky-rabbit-foot', 'cursed-lockpick',
  'spiked-collar', 'eagle-eye', 'mending-moss', 'hollowed-acorn',
]

// Rare trinkets available only from the magic chest
const MAGIC_CHEST_EXCLUSIVE_IDS = [
  'thorn-wrap', 'misers-pouch', 'cracked-compass', 'plague-mask', 'soul-candle',
  'blood-pact', 'bone-dice', 'hunger-stone', 'gamblers-mark', 'witching-stone',
  'plague-rat-skull',
]

const LEGENDARY_TRINKET_IDS = [
  'hourglass-sand', 'forsaken-idol', 'stormcallers-fist', 'mirror-of-vanity',
  'deathmask', 'traded-codex', 'philosophers-coin',
  'paupers-crown', 'soulbound-blade', 'twin-fates', 'abyssal-lens',
  'resurrection-stone', 'wardens-brand',
]

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

/** Browsers block vibrate until the user has interacted with the page (avoids console intervention spam). */
let _hapticUserGestureOk = false
if (typeof document !== 'undefined') {
  const arm = () => { _hapticUserGestureOk = true }
  document.addEventListener('pointerdown', arm, { capture: true, passive: true })
  document.addEventListener('keydown', arm, { capture: true, passive: true })
}

function _hapticVibrate(pattern) {
  if (!_hapticUserGestureOk || typeof navigator === 'undefined' || !navigator.vibrate) return
  if (!(_save?.settings?.hapticFeedback ?? true)) return
  try {
    navigator.vibrate(pattern)
  } catch (_) { /* ignore */ }
}

function _pickRandom(pool) { return pool[Math.floor(Math.random() * pool.length)] }

function _rollCommonLoot() {
  // Weighted: potions more likely than lantern/spyglass (smiths-tools removed — ~1% via dedicated band in chest rolls)
  const r = Math.random()
  if (r < 0.32) return { type: 'potion-red' }
  if (r < 0.58) return { type: 'potion-blue' }
  if (r < 0.74) return { type: 'lantern' }
  if (r < 0.87) return { type: 'spyglass' }
  if (r < 0.95) return { type: 'scavengers-bag' }
  return { type: 'gold', amount: _rand(...CONFIG.chest.goldDrop) }
}

/** Normal chest: 1% legendary, 2% rare, 1% Smith's Tools, 96% common (no smiths in common pool). */
function _rollChestLoot() {
  if (run?.player?.inventory?.some(e => e.id === 'misers-pouch')) {
    return { type: 'gold', amount: _rand(...CONFIG.chest.goldDrop) }
  }
  let r = Math.random()
  // Cursed lockpick: bias toward rare/legendary
  if (run?.player?.inventory?.some(e => e.id === 'cursed-lockpick') && r < 0.15) {
    r = Math.random() * 0.06  // forces into rare or legendary band
  }
  if (r < 0.01) return { type: _pickRandom(LEGENDARY_TRINKET_IDS) }
  if (r < 0.03) return { type: _pickRandom(RARE_TRINKET_IDS) }
  if (r < 0.04) return { type: 'smiths-tools' }
  return _rollCommonLoot()
}

const BACKPACK_MAX_SLOTS = 9

/** Magic chest: 2% legendary, 5% rare (all rares + exclusives), 1% Smith's Tools, 92% common. */
function _rollMagicChestLoot() {
  const r = Math.random()
  if (r < 0.02) return { type: _pickRandom(LEGENDARY_TRINKET_IDS) }
  if (r < 0.07) {
    const pool = [...RARE_TRINKET_IDS, ...MAGIC_CHEST_EXCLUSIVE_IDS]
    return { type: _pickRandom(pool) }
  }
  if (r < 0.08) return { type: 'smiths-tools' }
  return _rollCommonLoot()
}

function _playerOutgoingDamageMult() {
  let mult = 1
  // Glass Cannon Shard
  if (run?.player?.inventory?.some(e => e.id === 'glass-cannon-shard')) {
    const p = run.player
    const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 0
    mult *= ratio > 0.5 ? 1.5 : 0.5
  }
  // Freezing Hit: -20% per stack, max 5 stacks
  const freezeStacks = run?.player?.freezingHitStacks ?? 0
  if (freezeStacks > 0) {
    mult *= Math.max(0.05, 1 - freezeStacks * 0.20)
  }
  return mult
}

function _scaleOutgoingDamageToEnemy(dmg) {
  const raw = Number(dmg)
  const base = Number.isFinite(raw) ? raw : 1
  const mult = _playerOutgoingDamageMult()
  const m = Number.isFinite(mult) ? mult : 1
  const scaled = Math.max(1, Math.round(base * m))
  // Corruption: -1 flat damage per stack (min 1)
  const corruptionPenalty = run?.player?.corruptionStacks ?? 0
  const out = Math.max(1, scaled - corruptionPenalty)
  return Number.isFinite(out) ? out : 1
}

/** Apply two Freezing Hit stacks (max 5). Called when Frost Giant counter-attacks. */
function _applyFreezingHit() {
  if (!run) return
  const stacks = Math.min(5, (run.player.freezingHitStacks ?? 0) + 2)
  run.player.freezingHitStacks = stacks
  UI.setFreezingHit(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🧊 Freezing Hit! (${stacks})`, 'damage')
}

/** Check Ogre shield block (10%). Returns true if the attack was blocked. */
function _checkShieldBlock(tile) {
  if (!tile.enemyData?.shieldBlock) return false
  if (Math.random() >= 0.10) return false
  UI.spawnFloat(tile.element, '🛡️ Blocked!', 'damage')
  UI.setMessage(`The Ogre raises its shield — your attack is deflected!`)
  EventBus.emit('audio:play', { sfx: 'hit2' })
  return true
}

/** Apply two Corruption stacks (max 5). Called when Infected Goblin counter-attacks.
 *  Temporarily reduces maxHp and maxMana by 2% per stack; restored as stacks decay. */
function _applyCorruption() {
  if (!run) return
  const prev   = run.player.corruptionStacks ?? 0
  const stacks = Math.min(5, prev + 2)
  if (stacks === prev) return  // already at cap
  run.player.corruptionStacks = stacks

  // Capture uncorrupted base max values on first application
  if (!run.player.corruptionBaseMaxHp)   run.player.corruptionBaseMaxHp   = run.player.maxHp
  if (!run.player.corruptionBaseMaxMana) run.player.corruptionBaseMaxMana = run.player.maxMana

  // Reduce max values based on total stacks (2% per stack of base max)
  run.player.maxHp   = Math.max(1, Math.round(run.player.corruptionBaseMaxHp   * (1 - stacks * 0.02)))
  run.player.maxMana = Math.max(1, Math.round(run.player.corruptionBaseMaxMana * (1 - stacks * 0.02)))

  // Clamp current values to the new lower ceiling
  run.player.hp   = Math.min(run.player.hp,   run.player.maxHp)
  run.player.mana = Math.min(run.player.mana, run.player.maxMana)

  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.setCorruption(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `☣️ Corrupted! (${stacks})`, 'damage')
}

/** Apply burn stacks to the player. amount defaults to 2. Max 3 stacks. */
function _applyBurnHit(amount = 2) {
  if (!run) return
  const stacks = Math.min(3, (run.player.burnStacks ?? 0) + amount)
  run.player.burnStacks = stacks
  UI.setBurnOverlay(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🔥 Burning! (${stacks})`, 'damage')
}

/** Apply poison stacks to the player (enemy ability — separate from poison arrow DoT on enemies).
 *  Each stack deals 1 HP per turn. Max 5 stacks, decays 1 per turn. */
function _applyPlayerPoison(amount = 2) {
  if (!run) return
  const stacks = Math.min(5, (run.player.poisonStacks ?? 0) + amount)
  run.player.poisonStacks = stacks
  UI.setPlayerPoison(stacks)
  UI.spawnFloat(document.getElementById('hud-portrait'), `☠️ Poisoned! (${stacks})`, 'damage')
}

/** Mushroom Harvester taunt: if a live, visible Harvester exists and the target is NOT one,
 *  redirect the attack to a random Harvester. Returns the new target tile (or original if no taunt). */
function _resolveTauntTarget(tile) {
  if (tile.enemyData?.taunt) return tile  // already targeting a harvester — no redirect
  const grid = TileEngine.getGrid()
  if (!grid) return tile
  const harvesters = []
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.taunt) harvesters.push(t)
    }
  }
  if (harvesters.length === 0) return tile
  const tauntTarget = harvesters[Math.floor(Math.random() * harvesters.length)]
  UI.spawnFloat(tile.element, '🍄 Taunted!', 'damage')
  UI.spawnFloat(tauntTarget.element, '🛡️', 'xp')
  return tauntTarget
}

/** Returns the live, revealed Drowned Hulk tile if one exists on the grid, otherwise null. */
function _findLiveHulk() {
  const grid = TileEngine.getGrid()
  if (!grid) return null
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.crewBuffAura) return t
    }
  }
  return null
}

const CREW_BUFF_HP = 3

/** Apply the Drowned Hulk +3 HP aura to a single enemy tile (idempotent). */
function _applyHulkBuffToTile(t) {
  if (!t.revealed || !t.enemyData || t.enemyData._slain || t.enemyData.crewBuffAura) return
  if (t.enemyData._hulkBuffed) return
  const cur = Number(t.enemyData.currentHP)
  const base = Number.isFinite(cur) ? cur : Number(t.enemyData.hp)
  t.enemyData.currentHP = (Number.isFinite(base) ? base : 1) + CREW_BUFF_HP
  t.enemyData._hulkBuffed = true
  UI.updateEnemyHP(t.element, t.enemyData.currentHP)
  UI.spawnFloat(t.element, `⚓ +${CREW_BUFF_HP} HP`, 'heal')
}

/** Remove the Drowned Hulk +3 HP aura from all buffed visible enemies (called on hulk death). */
function _removeHulkBuffFromAll() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t.enemyData || t.enemyData._slain || !t.enemyData._hulkBuffed) continue
      const cur = Number(t.enemyData.currentHP)
      const safe = Number.isFinite(cur) ? cur : Number(t.enemyData.hp ?? 1)
      t.enemyData.currentHP = Math.max(1, safe - CREW_BUFF_HP)
      t.enemyData._hulkBuffed = false
      UI.updateEnemyHP(t.element, t.enemyData.currentHP)
      UI.spawnFloat(t.element, `⚓ -${CREW_BUFF_HP} HP`, 'damage')
    }
  }
}

/** Apply hulk aura to all currently visible enemies (called when the hulk is first revealed). */
function _applyHulkBuffToAll() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      _applyHulkBuffToTile(t)
    }
  }
}

// ── Forge ─────────────────────────────────────────────────────

function _openForge(tile) {
  if (tile.forgeUsed) { UI.setMessage('The forge has already been used this sanctuary.'); return }
  const inv = run.player.inventory
  const recipes = FORGE_RECIPES.map(r => {
    // For duplicate recipes (same ingredient), need two in inventory
    const isDupe = r.ingredientA === r.ingredientB
    const count  = inv.filter(e => e.id === r.ingredientA).length
    const hasA   = isDupe ? count >= 2 : inv.some(e => e.id === r.ingredientA)
    const hasB   = isDupe ? true        : inv.some(e => e.id === r.ingredientB)
    const canForge = hasA && hasB && _canAddToBackpack(r.result)
    return { ...r, canForge, hasA, hasB, isDupe }
  })
  UI.showForgeOverlay(recipes, ITEMS, (recipeId) => _doForge(tile, recipeId), () => {
    UI.hideForgeOverlay()
    UI.setMessage('The forge cools as you step away.')
  })
}

async function _doForge(tile, recipeId) {
  const recipe = FORGE_RECIPES.find(r => r.id === recipeId)
  if (!recipe) return
  const inv    = run.player.inventory
  const isDupe = recipe.ingredientA === recipe.ingredientB
  const count  = inv.filter(e => e.id === recipe.ingredientA).length
  const hasA   = isDupe ? count >= 2 : inv.some(e => e.id === recipe.ingredientA)
  const hasB   = isDupe ? true        : inv.some(e => e.id === recipe.ingredientB)
  if (!hasA || !hasB) { UI.setMessage('Missing ingredients!', true); return }

  dropItem(recipe.ingredientA)
  if (!isDupe) dropItem(recipe.ingredientB)
  else         dropItem(recipe.ingredientA)   // drop second copy

  UI.hideForgeOverlay()
  await _addToBackpack(recipe.result)
  EventBus.emit('inventory:changed')

  if (TrinketCodex.registerIfNew(_save, recipe.result)) {
    await SaveManager.save(_save).catch(() => {})
    await UI.showTrinketDiscovery(recipe.result)
  }

  tile.forgeUsed = true
  EventBus.emit('audio:play', { sfx: 'spell' })
  UI.setMessage(`⚒️ Forged: ${ITEMS[recipe.result]?.name ?? recipe.result}!`)
}

/**
 * Dungeon Mouse: every time the player flips a tile, each living mouse rolls to
 * unflip one random revealed empty tile, rerolling what lies beneath. This uses
 * the reusable TileEngine.unflipAndRerollTile primitive shared with future creatures.
 */
async function _maybeMouseUnflip(sourceTile) {
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

    // Candidates: revealed, plain empty tiles — never the tile just revealed
    const candidates = []
    for (const row of grid) {
      for (const t of row) {
        if (t === sourceTile) continue
        if (!t.revealed) continue
        if (t.type !== 'empty') continue
        candidates.push(t)
      }
    }
    if (!candidates.length) continue

    const target = candidates[Math.floor(Math.random() * candidates.length)]

    EventBus.emit('audio:play', { sfx: 'flip' })
    if (mouseTile.element) UI.spawnFloat(mouseTile.element, '🐭 Hidden!', 'damage')
    UI.setMessage('A mouse scurries across the floor — a tile is hidden again!')

    await TileEngine.unflipAndRerollTile(target, run.floor)
    const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), onTileTap, onTileHold)
    if (!patched) _refreshMainGridDomFromModel()

    if (TileEngine.ensureExitConnectivityFromGrid(run.floor) > 0) {
      _refreshMainGridDomFromModel()
    }
    TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
    TileEngine.refreshAllThreatClueDisplays()
    _syncGridDomClassesFromModel()
  }
}

/** Crystal Bone Demon: 10% chance per counter-attack to flip a random unrevealed enemy tile. */
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
      eventResolved: t.eventResolved,
      ropeResolved: t.ropeResolved,
      forgeUsed: t.forgeUsed,
      echoHintCategory: t.echoHintCategory ?? null,
      darkEyesHint: !!t.darkEyesHint,
    })),
  )
  return {
    tilesRevealed: run.tilesRevealed,
    player: JSON.parse(JSON.stringify(run.player)),
    eventTile: run.eventTile ? { row: run.eventTile.row, col: run.eventTile.col } : null,
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
  run.eventTile = snap.eventTile
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
      t.enemyData = st.enemyData ? JSON.parse(JSON.stringify(st.enemyData)) : null
      t.itemData = st.itemData ? JSON.parse(JSON.stringify(st.itemData)) : null
      t.chestLoot = st.chestLoot ? JSON.parse(JSON.stringify(st.chestLoot)) : null
      t.chestReady = st.chestReady
      t.chestLooted = st.chestLooted
      t.magicChestReady = st.magicChestReady
      t.pendingLoot = st.pendingLoot ? JSON.parse(JSON.stringify(st.pendingLoot)) : null
      t.exitResolved = st.exitResolved
      t.eventResolved = st.eventResolved
      t.ropeResolved = st.ropeResolved
      t.forgeUsed = st.forgeUsed
      t.echoHintCategory = st.echoHintCategory ?? null
      t.darkEyesHint = !!st.darkEyesHint
      _normalizeTileFieldsForType(t)
    }
  }

  _refreshMainGridDomFromModel()
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.updateGold(run.player.gold)
  UI.updateGoldenKeys(run.player.goldenKeys ?? 0)
  _syncMagicChestKeyGlow()
  UI.setFreezingHit(run.player.freezingHitStacks ?? 0)
  UI.setBurnOverlay(run.player.burnStacks ?? 0)
  UI.setPlayerPoison(run.player.poisonStacks ?? 0)
  UI.setCorruption(run.player.corruptionStacks ?? 0)
  UI.updateXP(run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  TileEngine.refreshAllThreatClueDisplays()
}

/** Paladin Sense Evil — pick one random unrevealed enemy tile and mark it with the enemy echo hint.
 *  Uses a dedicated `senseEvilMarked` flag so re-picks reliably clear only the previous sensed tile,
 *  never touching marks from trinkets (echo-charm, resonance-core, abyssal-lens). */
function _paladinSenseEvilPick() {
  if (_charKey() !== 'warrior') return
  const grid = TileEngine.getGrid?.()
  if (!grid) return
  // Clear any existing sense-evil mark first (only our own — leave trinket marks alone)
  for (const row of grid) {
    for (const t of row) {
      if (t.senseEvilMarked) {
        t.senseEvilMarked = false
        t.echoHintCategory = null
        if (t.element) {
          t.element.classList.remove('echo-hint')
          delete t.element.dataset.echoHint
        }
      }
    }
  }
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && t.enemyData && !t.enemyData._slain &&
          (t.type === 'enemy' || t.type === 'enemy_fast' || t.type === 'boss')) {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) { run.senseEvilTile = null; return }
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  target.senseEvilMarked = true
  target.echoHintCategory = '⚔️'
  if (target.element) {
    target.element.classList.add('echo-hint')
    target.element.dataset.echoHint = '⚔️'
  }
  run.senseEvilTile = { row: target.row, col: target.col }
}

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
/** Last finalized run telemetry (clone) — survives `run = null` until the next run ends. */
let _lastRunTelemetrySnapshot = null

function _charKey() {
  return _save?.selectedCharacter ?? 'warrior'
}

/** True iff the active is meta-unlocked AND picked this run via level-up. */
function _isActiveUnlocked(abilityKey, charKey = _charKey()) {
  const list = charKey === 'ranger'   ? (_save.ranger?.upgrades   ?? [])
             : charKey === 'engineer' ? (_save.engineer?.upgrades ?? [])
             : charKey === 'mage'     ? (_save.mage?.upgrades     ?? [])
             :                          (_save.warrior?.upgrades  ?? [])
  if (!list.includes(abilityKey)) return false
  const runUnlocked = run?.player?.unlockedActives ?? []
  return runUnlocked.includes(abilityKey)
}

function _isMageActiveUnlocked(abilityKey) {
  return _isActiveUnlocked(abilityKey, 'mage')
}

function _mageActiveDamageMult(abilityKey) {
  const stacks = run?.player?.mageActiveStacks?.[abilityKey] ?? 0
  return 1 + 0.1 * stacks
}

/** Legacy alias used by ranger HUD/actions. Now delegates to the unified active-unlock check. */
function _isRangerActiveUnlocked(abilityKey) {
  if (_isActiveUnlocked(abilityKey, 'ranger')) return true
  // Mastery stacks granted before the active was officially unlocked still imply access (defensive — shouldn't happen with the new pool).
  const stacks = run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return stacks > 0 && (_save.ranger?.upgrades ?? []).includes(abilityKey)
}

function _rangerActiveDamageMult(abilityKey) {
  const stacks = run?.player?.rangerActiveStacks?.[abilityKey] ?? 0
  return 1 + 0.1 * stacks
}

function _refreshRangerActiveHud() {
  if (_charKey() !== 'ranger') return
  // Clear warrior/engineer slot bindings — otherwise Blinding Light (slot B) survives from a prior Warrior run.
  UI.setSlamBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
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
function _isDarkEyesEnemyTileType(type) {
  return type === 'enemy' || type === 'enemy_fast' || type === 'boss'
}

function _finalizeVampireDrainKill(t, damageDealt) {
  if (!run || !t?.enemyData || t.enemyData._slain) return
  const e = t.enemyData
  e.currentHP = 0
  if (e.enemyId === 'onion') _applyTearyEyes()
  const goldDrop = e.goldDrop ? _rand(...e.goldDrop) : 1
  const xpDrop = e.xpDrop ?? 0
  if (run.telemetry && damageDealt > 0) {
    run.telemetry.totalDamageDealtToEnemies += damageDealt
    _telemetryBumpDamageDealt(run.floor, damageDealt)
  }
  if (t.element) UI.spawnFloat(t.element, '🩸 Drained!', 'xp')
  _gainGold(goldDrop, t.element, true)
  _gainXP(xpDrop, t.element)
  _endCombatVictory(t)
}

/** Shake / strike VFX, then after 400ms resolve kill — mirrors fightAction’s fatal-blow delay (multi-kill skips long portrait hold so chains stay snappy). */
function _vampireDrainKillPresentationThenResolve(t, damageDealt, onDone) {
  const el = t.element
  if (el) {
    UI.shakeTile(el)
    if (_charKey() === 'ranger') UI.spawnArrow(el)
    else UI.spawnSlash(el)
  }
  const attackSfx = _charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })
  UI.setPortraitAnim('attack')
  setTimeout(() => {
    if (run && t?.enemyData && !t.enemyData._slain) {
      _finalizeVampireDrainKill(t, damageDealt)
    }
    UI.setPortraitAnim('idle')
    onDone?.()
  }, 400)
}

/** First “kill” on a splittable slime: same split branch as fightAction (telemetry + UI.splitSlime). */
function _vampireDrainSlimeSplitPresentation(t, hpBeforeDrain, onDone) {
  const el = t.element
  if (el) {
    UI.shakeTile(el)
    if (_charKey() === 'ranger') UI.spawnArrow(el)
    else UI.spawnSlash(el)
  }
  const attackSfx = _charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })
  UI.setPortraitAnim('attack')
  setTimeout(() => {
    if (!run || !t?.enemyData || t.enemyData._slain) {
      UI.setPortraitAnim('idle')
      onDone?.()
      return
    }
    const splitHP = Math.max(1, Math.floor(t.enemyData.hp / 2))
    if (run.telemetry) {
      const dealt = hpBeforeDrain - splitHP
      run.telemetry.totalDamageDealtToEnemies += dealt
      _telemetryBumpDamageDealt(run.floor, dealt)
    }
    t.enemyData.currentHP = splitHP
    t.enemyData.hasSplit = true
    if (t.element) {
      UI.spawnFloat(t.element, '🩸 1', 'damage')
      UI.spawnFloat(t.element, '🟢 Split!', 'damage')
      UI.splitSlime(t.element)
      UI.updateEnemyHP(t.element, splitHP)
    }
    UI.setMessage(`The slime splits in two! Each half still fights. (${splitHP} HP remaining)`)
    UI.setPortraitAnim('idle')
    onDone?.()
  }, 400)
}

function _runVampireDrainPresentationChain(entries, idx, hintTile) {
  if (idx >= entries.length) {
    _vampireDarkEyesRoll(hintTile)
    return
  }
  const e = entries[idx]
  if (e.type === 'split') {
    _vampireDrainSlimeSplitPresentation(e.tile, e.hpBeforeDrain, () => {
      _runVampireDrainPresentationChain(entries, idx + 1, hintTile)
    })
  } else {
    _vampireDrainKillPresentationThenResolve(e.tile, e.damageDealt, () => {
      _runVampireDrainPresentationChain(entries, idx + 1, hintTile)
    })
  }
}

function _vampireDarkEyesRoll(tile) {
  if (!run || GameState.is(States.DEATH) || _charKey() !== 'vampire') return
  if (Math.random() >= 0.5) return
  const grid = TileEngine.getGrid()
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed || t.reachable || t.locked || t.echoHintCategory) continue
      if (!_isDarkEyesEnemyTileType(t.type)) continue
      candidates.push(t)
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const n = Math.min(VAMPIRE_DARK_EYES_MAX_TILES, candidates.length)
  for (let i = 0; i < n; i++) {
    const t = candidates[i]
    if (!t.element) continue
    const cat = _echoCharmCategoryForTileType(t.type)
    t.echoHintCategory = cat
    t.darkEyesHint = true
    t.element.classList.add('echo-hint')
    t.element.dataset.echoHint = cat
  }
}

function _vampireCorruptedBloodAndDarkEyes(tile) {
  if (!run || GameState.is(States.DEATH) || _charKey() !== 'vampire') return
  const p = run.player
  const grid = TileEngine.getGrid()
  const drainTargets = []
  let monsterCount = 0
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
      monsterCount++
      drainTargets.push(t)
    }
  }
  // Constant −1 HP per flip; +1 per revealed living monster (net = −1 + M), counted before drain.
  const netHp = -1 + monsterCount
  const floatEl = tile.element ?? document.getElementById('hud-portrait')
  if (netHp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + netHp)
    UI.spawnFloat(floatEl, `🩸 +${netHp} HP`, 'heal')
  } else if (netHp < 0) {
    p.hp = Math.max(0, p.hp + netHp)
    UI.spawnFloat(floatEl, `🩸 ${netHp} HP`, 'damage')
  } else {
    UI.spawnFloat(floatEl, '🩸 0', 'xp')
  }
  UI.updateHP(p.hp, p.maxHp)
  if (p.hp <= 0) {
    _die(null)
    return
  }
  const pendingPresentations = []
  for (const t of drainTargets) {
    if (!t.enemyData || t.enemyData._slain) continue
    const e = t.enemyData
    const baseHp = Number(e.hp)
    const cur0 = Number(e.currentHP)
    const cur = Number.isFinite(cur0) ? cur0 : (Number.isFinite(baseHp) ? baseHp : 1)
    if (!Number.isFinite(e.currentHP)) e.currentHP = cur
    const hpBeforeDrain = e.currentHP
    const nextHp = hpBeforeDrain - 1
    const canSplit = nextHp <= 0
      && e.attributes?.includes('splits')
      && !e.hasSplit
    if (nextHp > 0) {
      e.currentHP = nextHp
      if (t.element) UI.updateEnemyHP(t.element, nextHp)
    } else if (canSplit) {
      pendingPresentations.push({ type: 'split', tile: t, hpBeforeDrain })
    } else {
      pendingPresentations.push({ type: 'kill', tile: t, damageDealt: hpBeforeDrain })
    }
  }
  if (pendingPresentations.length) {
    _runVampireDrainPresentationChain(pendingPresentations, 0, tile)
  } else {
    _vampireDarkEyesRoll(tile)
  }
}

function buildRunState() {
  const isRanger   = _charKey() === 'ranger'
  const isEngineer = _charKey() === 'engineer'
  const isMage     = _charKey() === 'mage'
  const isVampire  = _charKey() === 'vampire'
  const baseHP     = isMage ? MAGE_BASE.hp : isRanger ? RANGER_BASE.hp : isEngineer ? ENGINEER_BASE.hp : isVampire ? VAMPIRE_BASE.hp : CONFIG.player.baseHP
  const baseMana   = isMage ? MAGE_BASE.mana : isRanger ? RANGER_BASE.mana : isEngineer ? ENGINEER_BASE.mana : isVampire ? VAMPIRE_BASE.mana : CONFIG.player.baseMana

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
    /** Active-ability IDs unlocked this run via level-up picks (e.g. 'slam', 'ricochet', 'construct-turret'). */
    unlockedActives:    [],
    /** Engineer: highest turret level the player can build/upgrade to (Mastery I → 2, Mastery II → 3). */
    turretMaxLevel:     1,
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
    /** Mage: level-up picks for Chain Lightning / Telekinetic Throw — +10% damage per stack for that active. */
    mageActiveStacks: isMage
      ? { 'chain-lightning': 0, 'telekinetic-throw': 0 }
      : undefined,
    retreatPercent:     CONFIG.retreat.goldKeepPercent,
    extraAbilityChoice: false,
    damageTakenMult:    1,
    isRanger,
    isEngineer,
    isMage,
    isVampire,
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
  }

  MetaProgression.applyToPlayer(p, _save)

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
    /** Balance / bot: per-run stats (see js/balance/runTelemetry.js) */
    telemetry:        createInitialTelemetry(),
    /** While active: { row, col, active, mult } — buffs all enemies until banner tile is cleared */
    warBanner:        null,
  }
}

// ── Accessors ────────────────────────────────────────────────

function getActiveCombatTile() { return run?.activeCombatTile ?? null }

// ── Engineer turret ───────────────────────────────────────────

function _isEngineerUpgradeUnlocked(id) {
  return _isActiveUnlocked(id, 'engineer')
}

function _engineerTurretMaxHp(level) {
  return ENGINEER_TURRET.maxHpByLevel[Math.max(1, Math.min(3, level)) - 1]
}

function _engineerTurretDamage(level) {
  return ENGINEER_TURRET.damageByLevel[Math.max(1, Math.min(3, level)) - 1]
}

function _teslaManhattanRadius(level) {
  return ENGINEER_TURRET.teslaRadiusByLevel[Math.max(1, Math.min(3, level)) - 1]
}

function _inTeslaPerimeter(tr, tile) {
  if (!tr || tile == null) return false
  const d = Math.abs(tr.row - tile.row) + Math.abs(tr.col - tile.col)
  return d <= _teslaManhattanRadius(tr.level)
}

function _syncTurretVisual() {
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
  const tr = run.turret
  if (!tr) return
  const tile = TileEngine.getTile(tr.row, tr.col)
  if (!tile?.element) return

  tile.element.classList.add('engineer-turret')
  if (tr.mode === 'tesla') {
    tile.element.classList.add('engineer-turret-tesla')
    // Always show perimeter in Tesla mode
    const radius = _teslaManhattanRadius(tr.level)
    for (const row of grid) {
      for (const t of row) {
        if (!t.element) continue
        const d = Math.abs(tr.row - t.row) + Math.abs(tr.col - t.col)
        if (d > 0 && d <= radius) t.element.classList.add('turret-perimeter')
      }
    }
  }

  // Inject turret sprite + HP/DMG stats into the tile front
  const dmg = _engineerTurretDamage(tr.level)
  const overlay = document.createElement('div')
  overlay.className = 'turret-overlay'
  const spriteSrc = tr.mode === 'tesla'
    ? 'assets/sprites/Heroes/Engineer/turret-tesla.gif'
    : 'assets/sprites/Heroes/Engineer/turret-t1.gif'
  overlay.innerHTML = `
    <span class="turret-level-badge">T${tr.level}</span>
    <img class="turret-sprite" src="${spriteSrc}" alt="Turret">
    <div class="tile-enemy-stats">
      <span class="stat-hp">❤️ ${tr.hp}</span>
      <span class="stat-dmg">⚔️ ${dmg}</span>
    </div>`
  tile.element.appendChild(overlay)
}

function _destroyTurret() {
  run.turret = null
  _syncTurretVisual()
}

function _damageTurretFromEnemyHit(rawAmount, floatEl) {
  if (!run.turret || run.turret.hp <= 0) return
  const eff = _computeEffectiveDamageTaken(rawAmount)
  run.turret.hp -= eff
  UI.spawnFloat(floatEl ?? document.getElementById('hud-portrait'), `🛡️ Turret −${eff}`, 'damage')
  if (run.turret.hp <= 0) {
    UI.setMessage('Your turret is destroyed!')
    _destroyTurret()
  } else {
    _syncTurretVisual()
  }
}

function _engineerTurretAfterReveal(tile) {
  if (_charKey() !== 'engineer' || !run.turret?.hp) return
  if (!tile?.enemyData || tile.enemyData._slain) return
  const tr = run.turret
  if (tr.mode === 'tesla' && !_inTeslaPerimeter(tr, tile)) return
  const dmg = _engineerTurretDamage(tr.level)
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
    _gainGold(td.goldDrop ? _rand(...td.goldDrop) : 1, tile.element, true)
    _gainXP(td.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
    return
  }
  UI.updateEnemyHP(tile.element, td.currentHP)
  const [dmgMin, dmgMax] = td.dmg ?? CONFIG.enemy.damage
  const enemyCounter = typeof td.hitDamage === 'number'
    ? td.hitDamage
    : dmgMin + Math.floor(Math.random() * (dmgMax - dmgMin + 1))
  _damageTurretFromEnemyHit(enemyCounter, tile.element)
}

function _handleEngineerConstructTileTap(tile) {
  const cost = ENGINEER_UPGRADES['construct-turret'].manaCost
  const tr = run.turret
  if (tr && tr.row === tile.row && tr.col === tile.col) {
    const maxLevel = run.player.turretMaxLevel ?? 1
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
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana.', true)
      return true
    }
    run.player.mana -= cost
    UI.updateMana(run.player.mana, run.player.maxMana)
    tr.level++
    tr.maxHp = _engineerTurretMaxHp(tr.level)
    tr.hp = tr.maxHp
    _syncTurretVisual()
    _engineerConstructSelecting = false
    _engineerPendingTile = null
    UI.setEngineerPlaceMode(false)
    UI.setMessage(`Turret upgraded to level ${tr.level}!`)
    _saveActiveRun()
    return true
  }
  // Do not require tile.reachable: the start tile is revealed but never gets reachable=true
  // (markReachable only tags unrevealed neighbors). Any revealed empty is a valid build site.
  const canPlace = tile.revealed && tile.type === 'empty' && !tile.locked
  if (!canPlace) {
    UI.setMessage('Choose a revealed empty tile (not locked).', true)
    return true
  }
  const pending = _engineerPendingTile
  if (pending && (pending.row !== tile.row || pending.col !== tile.col)) {
    _engineerPendingTile = { row: tile.row, col: tile.col }
    UI.flashTile(tile.element)
    UI.setMessage('Tap again to confirm placement.')
    return true
  }
  if (pending && pending.row === tile.row && pending.col === tile.col) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana.', true)
      return true
    }
    run.player.mana -= cost
    UI.updateMana(run.player.mana, run.player.maxMana)
    run.turret = {
      row: tile.row,
      col: tile.col,
      level: 1,
      mode: 'ballistic',
      hp: _engineerTurretMaxHp(1),
      maxHp: _engineerTurretMaxHp(1),
    }
    _engineerPendingTile = null
    _engineerConstructSelecting = false
    UI.setEngineerPlaceMode(false)
    _syncTurretVisual()
    UI.setMessage('Turret constructed!')
    _saveActiveRun()
    return true
  }
  _engineerPendingTile = { row: tile.row, col: tile.col }
  UI.flashTile(tile.element)
  UI.setMessage('Tap again to confirm placement.')
  return true
}

function constructTurretAction() {
  if (!_isEngineerUpgradeUnlocked('construct-turret')) return
  if (_combatBusy) return
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  if (!GameState.is(States.FLOOR_EXPLORE)) return
  if (_engineerConstructSelecting) {
    _cancelEngineerConstructMode()
    UI.setMessage('Placement cancelled.')
    return
  }
  _cancelSpellLanternBlindingForRicochet()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  _cancelRicochetMode()
  _engineerConstructSelecting = true
  _engineerPendingTile = null
  UI.setEngineerPlaceMode(true)
  UI.setMessage('🛠️ Tap your turret to upgrade, or tap an empty tile twice to build or relocate.')
}

function teslaTowerAction() {
  if (!_isEngineerUpgradeUnlocked('tesla-tower')) return
  if (_combatBusy) return
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  if (!GameState.is(States.FLOOR_EXPLORE)) return
  if (!run.turret?.hp) {
    UI.setMessage('Build a turret first.', true)
    return
  }
  if (run.turret.mode === 'tesla') {
    UI.setMessage('Already a Tesla tower.', true)
    return
  }
  const cost = ENGINEER_UPGRADES['tesla-tower'].manaCost
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Tesla.', true)
    return
  }
  run.player.mana -= cost
  UI.updateMana(run.player.mana, run.player.maxMana)
  run.turret.mode = 'tesla'
  _syncTurretVisual()
  UI.setMessage('⚡ Tesla Tower online!')
  _saveActiveRun()
}

function _refreshEngineerHud() {
  const c = ENGINEER_UPGRADES['construct-turret'].manaCost
  const t = ENGINEER_UPGRADES['tesla-tower'].manaCost
  UI.setSlamBtn(false)
  UI.setRicochetBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setEngineerConstructBtn(_isEngineerUpgradeUnlocked('construct-turret'), c)
  UI.setEngineerTeslaBtn(_isEngineerUpgradeUnlocked('tesla-tower'), t, run.turret?.mode === 'tesla')
}

function _refreshMageHud() {
  if (_charKey() !== 'mage') return
  UI.setSlamBtn(false)
  UI.setRicochetBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setChainLightningBtn(
    _isMageActiveUnlocked('chain-lightning'),
    MAGE_UPGRADES['chain-lightning'].manaCost,
  )
  UI.setTelekineticThrowBtn(
    _isMageActiveUnlocked('telekinetic-throw'),
    MAGE_UPGRADES['telekinetic-throw'].manaCost,
  )
}

// ── Init ─────────────────────────────────────────────────────

function init(saveData) {
  _save = saveData
}

// ── New game ─────────────────────────────────────────────────

function newGame() {
  UI.hideRunSummary()
  _clearActiveRun()
  run = buildRunState()
  TileEngine.setDiagonalMovement((_save.selectedCharacter ?? 'warrior') === 'mage')
  UI.hideMainMenu()
  EventBus.emit('audio:crossfade', { track: 'dungeon', duration: 1500 })
  _startFloor()
}

// ── Run persistence ──────────────────────────────────────────

function _serializeGridSnapshot() {
  const grid = TileEngine.getGrid()
  if (!grid?.length) return null
  return grid.map(row =>
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
      eventResolved: t.eventResolved,
      ropeResolved: t.ropeResolved,
      forgeUsed: t.forgeUsed,
      echoHintCategory: t.echoHintCategory ?? null,
      darkEyesHint: !!t.darkEyesHint,
      bannerReady: t.bannerReady ?? null,
      warBannerFlying: t.warBannerFlying ?? null,
    })),
  )
}

function _saveActiveRun() {
  if (!run || !_save) return
  _save.activeRun = {
    player:          JSON.parse(JSON.stringify(run.player)),
    floor:           run.floor,
    atRest:          run.atRest,
    levelUpLog:      run.levelUpLog.slice(),
    floorKeyAwarded: !!run.floorKeyAwarded,
    turret:          run.turret ? JSON.parse(JSON.stringify(run.turret)) : null,
    telemetry:       run.telemetry ? JSON.parse(JSON.stringify(run.telemetry)) : undefined,
    tilesRevealed:   run.tilesRevealed,
    bossFloorExitPending: !!run.bossFloorExitPending,
    eventTile:       run.eventTile ? { row: run.eventTile.row, col: run.eventTile.col } : null,
    gridSnapshot:    _serializeGridSnapshot(),
    combatEngagement: _combatEngagementTile ? { ..._combatEngagementTile } : null,
    warBanner:       run.warBanner ? JSON.parse(JSON.stringify(run.warBanner)) : null,
  }
  SaveManager.save(_save).catch(() => {})
}

function _clearActiveRun() {
  UI.hideSubFloor()
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
    tilesRevealed:        saved.tilesRevealed ?? 0,
    activeCombatTile:     null,
    eventTile:            null,
    bossFloorExitPending: !!saved.bossFloorExitPending,
    turret:               saved.turret ?? null,
    _resumeGridSnapshot:  saved.gridSnapshot ?? null,
    _resumeEventTile:     saved.eventTile ?? null,
    _resumeCombatEngagement: saved.combatEngagement ?? null,
    telemetry:            (() => {
      if (!saved.telemetry) return createInitialTelemetry()
      const t = JSON.parse(JSON.stringify(saved.telemetry))
      if (t.runStartSnapshotDone == null) t.runStartSnapshotDone = true
      if (!t.damageByFloor) t.damageByFloor = {}
      if (!Array.isArray(t.floorSnapshots)) t.floorSnapshots = []
      return t
    })(),
    warBanner: saved.warBanner ?? null,
  }
  const ch = _save.selectedCharacter ?? 'warrior'
  run.player.isEngineer = ch === 'engineer'
  run.player.isRanger   = ch === 'ranger'
  run.player.isMage     = ch === 'mage'
  run.player.isVampire  = ch === 'vampire'
  TileEngine.setDiagonalMovement(ch === 'mage')
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
  run = null
  if (!GameState.transition(States.MENU)) GameState.set(States.MENU)
  if (autoSave) SaveManager.save(_save)
  const char = _charKey()
  const xp   = char === 'ranger'
    ? _save.ranger.totalXP
    : char === 'engineer'
      ? _save.engineer.totalXP
      : char === 'mage'
        ? (_save.mage?.totalXP ?? 0)
        : char === 'vampire'
          ? (_save.vampire?.totalXP ?? 0)
          : _save.warrior.totalXP
  UI.updateMenuStats(_save.persistentGold, xp, char, _save)
  UI.setActiveDifficulty(_save.settings.difficulty)
  UI.showMainMenu()
  UI.refreshSkipFloorButton(_save)
  EventBus.emit('audio:crossfade', { track: 'menu', duration: 1500 })
}

function _startFloor() {
  _spellTargeting         = false
  _combatBusy             = false
  _clearAllCombatEngagement()
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
  _cancelEngineerConstructMode()
  _cancelChainLightningMode()
  _cancelTelekineticThrowMode()
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0); run.player.freezingHitStacks = 0; UI.setFreezingHit(0); run.player.burnStacks = 0; UI.setBurnOverlay(0); run.player.poisonStacks = 0; UI.setPlayerPoison(0); run.player.corruptionStacks = 0; if (run.player.corruptionBaseMaxHp) { run.player.maxHp = run.player.corruptionBaseMaxHp; run.player.corruptionBaseMaxHp = 0 } if (run.player.corruptionBaseMaxMana) { run.player.maxMana = run.player.corruptionBaseMaxMana; run.player.corruptionBaseMaxMana = 0 } UI.setCorruption(0) }
  if (run) { run._hourglassSnapshot = null }
  _throwingKnifeTargeting  = false
  _rustyNailTargeting      = false
  _twinBladesTargeting     = false
  if (run?.player) run.player.navigatorsChartUsed = false
  const resumeSnapshot = !!(run?._resumeGridSnapshot)
  // Hunger Stone: costs 2 HP and grants +1 max damage each floor (skip sanctuary)
  if (!resumeSnapshot && !run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'hunger-stone')) {
    run.player.damageBonus = (run.player.damageBonus ?? 0) + 1
    run.player.hp = Math.max(1, run.player.hp - 2)
  }
  let gridRestored = false
  if (run?._resumeGridSnapshot) {
    gridRestored = TileEngine.importGridFromSnapshot(run._resumeGridSnapshot, run.floor, { rest: run.atRest })
    run._resumeGridSnapshot = null
    _syncWarBannerCoordsFromGrid()
  }
  if (!gridRestored) {
    TileEngine.generateGrid(run.floor, { rest: run.atRest })
  }
  if (!run.atRest) {
    TileEngine.ensureExitConnectivityFromGrid(run.floor)
  }
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  if (run.turret) _syncTurretVisual()
  if (run._resumeEventTile) {
    run.eventTile = TileEngine.getTile(run._resumeEventTile.row, run._resumeEventTile.col)
    run._resumeEventTile = null
  }
  if (gridRestored) {
    TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
    _syncGridDomClassesFromModel()
    _tickPoisonArrowDotOnGlobalTurn()
  } else {
    _revealStartTile()
  }
  // Cracked Compass: reveal exit tile from the start (skip rest floors)
  if (!gridRestored && !run.atRest && run.player.inventory.some(e => e.id === 'cracked-compass')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (t.type === 'exit' && !t.revealed) {
          t.revealed = true
          run.tilesRevealed++
          TileEngine.markReachable(t.row, t.col, _markReachableUi)
          if (t.element) {
            TileEngine.flipTile(t, UI)
            t.element.classList.add('compass-revealed')
          }
          break
        }
      }
    }
  }

  // Sub-floor spawn: always on floor 1, otherwise 5% chance on non-boss, non-sanctuary floors
  if ((_save.settings.subLevelsEnabled ?? true) && !gridRestored && !run.atRest && !CONFIG.bossFloors.includes(run.floor)
      && (run.floor === 1 || Math.random() < CONFIG.subFloor.spawnChance)) {
    _spawnSubFloorEntry()
  }

  // War banner: always on floor 1; otherwise 20% per non-boss dungeon floor — buffs all enemies until cleared
  if (!gridRestored && !run.atRest && !CONFIG.bossFloors.includes(run.floor)
      && (run.floor === 1 || Math.random() < CONFIG.warBanner.spawnChance)) {
    _spawnWarBannerEntry()
  } else if (!gridRestored && !run.atRest) {
    run.warBanner = null
  }

  // Archer Goblin: always floor 1, 20% chance on subsequent non-boss dungeon floors.
  // Immediately revealed; starts firing arrows each turn until killed.
  if (!gridRestored && !run.atRest && !CONFIG.bossFloors.includes(run.floor)
      && (run.floor === 1 || Math.random() < 0.20)) {
    _spawnArcherGoblin()
  }

  // Dungeon Mouse: always floor 1 (placeholder), otherwise CONFIG.mouse.spawnChance on non-boss dungeon floors.
  // Pre-revealed; each time the player flips a tile, 50% to unflip a random revealed empty tile.
  if (!gridRestored && !run.atRest && !CONFIG.bossFloors.includes(run.floor)
      && (run.floor === 1 || Math.random() < (CONFIG.mouse?.spawnChance ?? 0.10))) {
    _spawnMouse()
  }

  // Forsaken Idol: reveal all unrevealed enemy tiles from floor start
  if (!gridRestored && !run.atRest && run.player.inventory.some(e => e.id === 'forsaken-idol')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast' || t.type === 'boss')) {
          t.revealed = true
          run.tilesRevealed++
          TileEngine.markReachable(t.row, t.col, _markReachableUi)
          if (t.element) TileEngine.flipTile(t, UI)
          if (t.enemyData) TileEngine.rollEnemyHitDamage(t.enemyData)
          _resolveEffect(t)
        }
      }
    }
  }
  // Paladin Sense Evil: mark one random unrevealed enemy at floor start
  if (!gridRestored && !run.atRest && _charKey() === 'warrior') {
    _paladinSenseEvilPick()
  }
  // Mending Moss: restore 3 HP at start of each new floor (skip floor 1 and sanctuary)
  if (!gridRestored && !run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'mending-moss')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 3)
  }
  // Twin Fates: coin flip each floor (skip floor 1 and sanctuary)
  if (!gridRestored && !run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'twin-fates')) {
    if (Math.random() < 0.5) {
      run.player.maxHp += 4
      run.player.hp    += 4
    } else {
      run.player.maxHp = Math.max(1, run.player.maxHp - 2)
      run.player.hp    = Math.min(run.player.hp, run.player.maxHp)
    }
  }
  // Abyssal Lens: hint all tile categories on the back of unrevealed tiles
  if (!gridRestored && !run.atRest && run.player.inventory.some(e => e.id === 'abyssal-lens')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && t.element) {
          const cat = _echoCharmCategoryForTileType(t.type)
          t.echoHintCategory = cat
          t.element.classList.add('echo-hint')
          t.element.dataset.echoHint = cat
        }
      }
    }
  }

  GameState.set(States.FLOOR_EXPLORE)
  UI.updateFloor(run.floor, { rest: run.atRest })
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.updateGold(run.player.gold)
  UI.updateGoldenKeys(run.player.goldenKeys ?? 0)
  _syncMagicChestKeyGlow()
  UI.setFreezingHit(run.player.freezingHitStacks ?? 0)
  UI.setBurnOverlay(run.player.burnStacks ?? 0)
  UI.setPlayerPoison(run.player.poisonStacks ?? 0)
  UI.setCorruption(run.player.corruptionStacks ?? 0)
  UI.updateXP(run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setHudCharacter(_charKey())
  // Slot A — actives appear only after the player picks them at level-up (gated by meta unlock + run unlock)
  if (_charKey() === 'ranger') {
    _refreshRangerActiveHud()
  } else if (_charKey() === 'engineer') {
    _refreshEngineerHud()
  } else if (_charKey() === 'mage') {
    _refreshMageHud()
  } else if (_charKey() === 'vampire') {
    UI.setSlamBtn(false)
    UI.setArrowBarrageBtn(false)
    UI.setPoisonArrowShotBtn(false)
    UI.setDivineLightBtn(false)
    UI.setBlindingLightBtn(false)
  } else {
    UI.setSlamBtn(_isActiveUnlocked('slam', 'warrior'), WARRIOR_UPGRADES.slam.manaCost)
    UI.setArrowBarrageBtn(false)
    UI.setPoisonArrowShotBtn(false)
    UI.setDivineLightBtn(_isActiveUnlocked('divine-light', 'warrior'), WARRIOR_UPGRADES['divine-light'].manaCost)
  }
  // Blinding Light — warrior only, slot B (ranger uses B for Poison Arrow, C for Triple Volley)
  if (_charKey() === 'warrior') {
    UI.setBlindingLightBtn(_isActiveUnlocked('blinding-light', 'warrior'), WARRIOR_UPGRADES['blinding-light'].manaCost)
  }
  // Show spell button always — player can target any enemy at any time
  const effectiveCost = _previewSpellManaCostForUi()
  UI.showActionPanel(effectiveCost, run.player.mana >= effectiveCost)
  // Start tile is already revealed — player can flee; only close dialog if it was open.
  document.getElementById('retreat-confirm')?.classList.add('hidden')
  UI.showRetreat()
  UI.hideRunSummary()
  UI.hideEventOverlays()

  const isBoss = CONFIG.bossFloors.includes(run.floor) && !run.atRest
  const hasWarBanner = run.warBanner?.active && !run.atRest
  UI.setMessage(run.atRest
    ? 'A quiet sanctuary. The well restores you; the rope leads out with your gold; the stairs go deeper.'
    : isBoss
      ? `⚠️ Floor ${run.floor} — Boss floor! Tread carefully.`
      : hasWarBanner
        ? '🚩 A war banner flies over this floor — enemies hit harder until you tear it down!'
      : 'Tap a tile to reveal what lurks beneath...')

  if (run.telemetry && !run.telemetry.runStartSnapshotDone) {
    _appendLevelSnapshot('runStart')
    run.telemetry.runStartSnapshotDone = true
  }
  _appendFloorSnapshot('floorEnter')

  Logger.debug(`[GameController] Floor ${run.floor} started`)
  TileEngine.refreshAllThreatClueDisplays()
  UI.refreshSkipFloorButton(_save)
  if (run._resumeCombatEngagement) {
    const raw = run._resumeCombatEngagement
    const pos = Array.isArray(raw) ? raw[0] : raw
    if (pos && typeof pos.row === 'number' && typeof pos.col === 'number') {
      const t = TileEngine.getTile(pos.row, pos.col)
      if (t?.enemyData && !t.enemyData._slain) {
        _combatEngagementTile = { row: pos.row, col: pos.col }
        _syncCombatEngagementDom()
      }
    }
    run._resumeCombatEngagement = null
  }
  _saveActiveRun()
}

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
      } else {
        el.classList.remove('enemy-alive')
      }
    }
  }
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
  TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  TileEngine.flipTile(tile)

  // Turret carries over — deploy it on the starting tile of the new floor
  if (run.turret?.hp > 0 && !run.atRest) {
    run.turret.row = tile.row
    run.turret.col = tile.col
    _syncTurretVisual()
    UI.setMessage(`🛡️ Your turret followed you to floor ${run.floor}.`)
  }

  _tickPoisonArrowDotOnGlobalTurn()
  TileEngine.refreshAllThreatClueDisplays()
}

// ── Tile tap router ──────────────────────────────────────────

let _spellTargeting         = false
let _combatBusy             = false
let _combatBusySetAt        = 0   // timestamp when _combatBusy last became true
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
let _engineerConstructSelecting = false
/** First tile pick for double-tap place / relocate — { row, col } */
let _engineerPendingTile = null
let _throwingKnifeTargeting  = false
let _rustyNailTargeting      = false
let _twinBladesTargeting     = false
/** Mage Chain Lightning — true once the player has tapped the ability. */
let _chainLightningSelecting = false
/** Mage Telekinetic Throw step: 0 = idle, 1 = picking enemy, 2 = picking destination. */
let _telekineticThrowStep   = 0
/** Enemy tile captured at step 1 — { row, col } in the active grid. */
let _telekineticEnemyTile   = null

/** Single focused enemy for current combat — no swapping until this one is slain (ambush uses `force`). */
let _combatEngagementTile = null

// ── Active grid helpers (main dungeon OR sub-floor) ──────────
// When a sub-floor is active, abilities, target iteration, and kill
// handling should operate on its tiles — not the main dungeon grid.

function _isInSubFloor() {
  return !!run?.subFloor?.active
}

/** Flat list of tiles in the currently active grid (sub-floor if active, else main). */
function _getActiveTiles() {
  if (_isInSubFloor()) {
    const out = []
    for (const row of run.subFloor.tiles) for (const t of row) if (t) out.push(t)
    return out
  }
  const grid = TileEngine.getGrid()
  if (!grid?.length) return []
  const out = []
  for (const row of grid) for (const t of row) if (t) out.push(t)
  return out
}

/** 2D array for algorithms that need row/col indexing on the active grid. */
function _getActiveTileRows() {
  return _isInSubFloor() ? run.subFloor.tiles : TileEngine.getGrid()
}

/** Tile at (row, col) on the active grid — sub-floor when a sub-floor is open, else main dungeon. */
function _getActiveTileAt(row, col) {
  if (_isInSubFloor()) return run.subFloor.tiles[row]?.[col] ?? null
  return TileEngine.getTile(row, col)
}

/** Orthogonal neighbors in the active grid. */
function _getActiveOrthogonal(row, col) {
  const rows = _getActiveTileRows()
  if (!rows?.length) return []
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  return dirs
    .map(([dr, dc]) => rows[row + dr]?.[col + dc])
    .filter(Boolean)
}

/** Sync red border highlight on the engaged enemy tile (at most one). */
function _syncCombatEngagementDom() {
  const grid = TileEngine.getGrid()
  if (grid) {
    for (const row of grid) {
      for (const t of row) {
        if (!t.element) continue
        const engaged =
          !_isInSubFloor()
          && !!_combatEngagementTile
          && t.row === _combatEngagementTile.row
          && t.col === _combatEngagementTile.col
          && t.enemyData
          && !t.enemyData._slain
        UI.setTileCombatEngaged(t.element, engaged)
      }
    }
  }
  if (_isInSubFloor() && run.subFloor?.tiles) {
    for (const row of run.subFloor.tiles) {
      for (const t of row) {
        if (!t?.element) continue
        const engaged =
          !!_combatEngagementTile
          && t.row === _combatEngagementTile.row
          && t.col === _combatEngagementTile.col
          && t.enemyData
          && !t.enemyData._slain
        UI.setTileCombatEngaged(t.element, engaged)
      }
    }
  }
}

/**
 * @param {{ force?: boolean }} [opts] — `force: true` for ambush reveal (replaces prior focus).
 * @returns {boolean} whether this tile is now the engagement target
 */
function _setCombatEngagement(tile, { force = false } = {}) {
  if (!tile?.enemyData || tile.enemyData._slain) return false
  if (!_combatEngagementTile) {
    _combatEngagementTile = { row: tile.row, col: tile.col }
    _syncCombatEngagementDom()
    return true
  }
  if (_combatEngagementTile.row === tile.row && _combatEngagementTile.col === tile.col) return true
  const cur = _getActiveTileAt(_combatEngagementTile.row, _combatEngagementTile.col)
  if (!cur?.enemyData || cur.enemyData._slain) {
    _combatEngagementTile = { row: tile.row, col: tile.col }
    _syncCombatEngagementDom()
    return true
  }
  if (force) {
    _combatEngagementTile = { row: tile.row, col: tile.col }
    _syncCombatEngagementDom()
    return true
  }
  return false
}

function _clearCombatEngagementForTile(tile) {
  if (
    _combatEngagementTile
    && tile.row === _combatEngagementTile.row
    && tile.col === _combatEngagementTile.col
  ) {
    _combatEngagementTile = null
    _syncCombatEngagementDom()
  }
}

function _clearAllCombatEngagement() {
  _combatEngagementTile = null
  _syncCombatEngagementDom()
}

/** True while the focused enemy is still alive (clears stale refs). */
function _isCombatCommitmentLocked() {
  if (!_combatEngagementTile) return false
  const t = _getActiveTileAt(_combatEngagementTile.row, _combatEngagementTile.col)
  if (t?.enemyData && !t.enemyData._slain) return true
  _combatEngagementTile = null
  _syncCombatEngagementDom()
  return false
}

/** Melee / single-target attacks: only the engaged enemy, unless engagement is stale/cleared. */
function _canAttackEnemy(tile) {
  if (!_combatEngagementTile) return true
  const cur = _getActiveTileAt(_combatEngagementTile.row, _combatEngagementTile.col)
  if (!cur?.enemyData || cur.enemyData._slain) {
    _combatEngagementTile = null
    _syncCombatEngagementDom()
    return true
  }
  return tile.row === _combatEngagementTile.row && tile.col === _combatEngagementTile.col
}

/** Temporarily clear focus so Slam / Ricochet / Triple Volley can hit any targets; pair with restore after the ability finishes. */
function _suspendCombatEngagementForMultiTargetAbility() {
  const saved = _combatEngagementTile ? { ..._combatEngagementTile } : null
  _combatEngagementTile = null
  _syncCombatEngagementDom()
  return saved
}

function _restoreCombatEngagementAfterMultiTargetAbility(saved) {
  if (!saved) return
  const t = _getActiveTileAt(saved.row, saved.col)
  if (t?.enemyData && !t.enemyData._slain) {
    _combatEngagementTile = { row: saved.row, col: saved.col }
    _syncCombatEngagementDom()
  }
}

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

function _cancelEngineerConstructMode() {
  _engineerConstructSelecting = false
  _engineerPendingTile = null
  UI.setEngineerPlaceMode(false)
}

function _cancelChainLightningMode() {
  _chainLightningSelecting = false
  UI.setChainLightningActive(false)
  UI.setGridChainLightningMode(false)
}

function _cancelTelekineticThrowMode() {
  _telekineticThrowStep = 0
  _telekineticEnemyTile = null
  UI.setTelekineticThrowActive(false)
  UI.setGridTelekineticThrowMode(null)
  UI.clearTelekineticMarks()
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

// ── Sub-floor ────────────────────────────────────────────────

/** Pick a random unrevealed non-start tile and convert it to a sub_floor_entry. */
function _spawnSubFloorEntry() {
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

function _applyWarBannerBuffToEnemyGrid(mult) {
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

function _stripWarBannerBuff(mult) {
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

/**
 * After loading grid from snapshot, align run.warBanner row/col with the actual war_banner cell.
 * Stale saved coords can point at a different tile (e.g. chest at 1,3 while banner is at 1,4).
 */
function _syncWarBannerCoordsFromGrid() {
  if (!run?.warBanner?.active) return
  const { row, col } = run.warBanner
  const atSaved = TileEngine.getTile(row, col)
  if (atSaved?.type === 'war_banner') return

  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const r of grid) {
    for (const cell of r) {
      if (cell?.type === 'war_banner') {
        const mult = run.warBanner.mult ?? CONFIG.warBanner.statMult
        run.warBanner = { row: cell.row, col: cell.col, active: true, mult }
        Logger.debug(`[GameController] warBanner coords synced to (${cell.row},${cell.col})`)
        return
      }
    }
  }
  run.warBanner = null
  Logger.debug('[GameController] warBanner cleared — no war_banner tile in grid')
}

/** Pick a random unrevealed tile and place the war banner; buffs all living enemies on the floor. */
function _spawnWarBannerEntry() {
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
  // Replacing whatever was under this tile — drop loot-specific state so it cannot resurface after teardown.
  delete target.chestLoot
  delete target.chestReady
  delete target.chestLooted
  delete target.magicChestReady
  delete target.pendingLoot
  run.warBanner = { row: target.row, col: target.col, active: true, mult }
  _applyWarBannerBuffToEnemyGrid(mult)
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

function _spawnArcherGoblin() {
  const grid = TileEngine.getGrid()
  // Pick a random unrevealed enemy tile and replace it with an archer_goblin
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast') && t.enemyData) {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  // Replace enemy data with archer_goblin
  target.enemyData = TileEngine.createEnemy('archer_goblin', run.floor)
  TileEngine.rollEnemyHitDamage(target.enemyData)
  target.type = 'enemy'
  // Immediately reveal — archer is visible from floor start
  target.revealed = true
  run.tilesRevealed++
  // Do NOT markReachable — archer neighbors become reachable naturally as player explores toward them
  const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), onTileTap, onTileHold)
  if (!patched) _refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    _syncGridDomClassesFromModel()
  }
}

function _spawnMouse() {
  const grid = TileEngine.getGrid()
  // Same placement pattern as archer: steal a random unrevealed enemy tile
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast') && t.enemyData) {
        candidates.push(t)
      }
    }
  }
  if (!candidates.length) return
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  target.enemyData = TileEngine.createEnemy('mouse', run.floor)
  TileEngine.rollEnemyHitDamage(target.enemyData)
  target.type = 'enemy'
  target.revealed = true
  run.tilesRevealed++
  // Do NOT markReachable — mouse behaves like archer, player must path adjacent
  const patched = TileEngine.patchMainGridTileAt(target.row, target.col, UI.getGridEl(), onTileTap, onTileHold)
  if (!patched) _refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    _syncGridDomClassesFromModel()
  }
}

function _destroyWarBanner(tile) {
  if (!tile || tile.type !== 'war_banner' || !run.warBanner?.active) return
  const mult = run.warBanner.mult ?? CONFIG.warBanner.statMult
  const floatEl = tile.element
  const tr = tile.row
  const tc = tile.col
  if (run.warBanner.row !== tr || run.warBanner.col !== tc) {
    Logger.warn('[GameController] warBanner row/col !== tapped tile — replacing tapped cell', { warBanner: run.warBanner, tr, tc })
  }
  _stripWarBannerBuff(mult)
  run.warBanner = null
  // Always replace the tapped tile's cell — it is the war_banner the player destroyed (avoids stale run.warBanner coords).
  TileEngine.replaceTileWithEmptyPreserveState(tr, tc)
  EventBus.emit('audio:play', { sfx: 'hit' })
  if (floatEl) UI.spawnFloat(floatEl, 'Banner torn!', 'heal')
  UI.setMessage('The war banner falls! Enemies on this floor lose their fighting spirit.')
  // Do not full renderGrid here — that remounts every tile and replays slain spirit FX, chest/gold pulses, etc.
  const patched = TileEngine.patchMainGridTileAt(tr, tc, UI.getGridEl(), onTileTap, onTileHold)
  if (!patched) _refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    _syncGridDomClassesFromModel()
  }
  _saveActiveRun()
}

function _enterSubFloor(tile) {
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
        _loadSubFloor(tile, t)   // skip debug check — go straight to load
      })
      picker.appendChild(btn)
    })
    document.body.appendChild(picker)
    return
  }
  // ────────────────────────────────────────────────────────────

  _loadSubFloor(tile, tile.subFloorType ?? 'mob_den')
}

function _loadSubFloor(tile, type) {
  const sfData = TileEngine.generateSubFloor(type, run.floor)
  run.subFloor = {
    type,
    tiles: sfData.tiles,
    rows: sfData.rows,
    cols: sfData.cols,
    mobType: sfData.mobType ?? null,
    entryTile: { row: tile.row, col: tile.col },
    active: true,
  }
  UI.showSubFloor(run.subFloor, _onSubFloorTileTap, _onSubFloorTileHold)
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

function _exitSubFloor() {
  if (!run.subFloor) return
  const { entryTile } = run.subFloor
  run.subFloor.active = false
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
  run.subFloor = null
  UI.hideSubFloor()
  UI.setMessage('You climb back to the main floor.')
}

function _onSubFloorTileHold(row, col) {
  if (!run?.subFloor) return
  const tile = run.subFloor.tiles[row]?.[col]
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

/**
 * If any ability targeting mode is active, consume the tap on the given tile.
 * Returns true if the tap was handled (caller should stop).
 * Works for both main-grid and sub-floor tiles since targeting handlers operate
 * on `tile.element` / `tile.enemyData`, which both variants expose.
 */
function _tryConsumeTargetingTap(tile) {
  if (!tile) return false

  if (_spellTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) _castSpell(tile)
    return true
  }
  if (_blindingLightTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) _castBlindingLight(tile)
    return true
  }
  if (_arrowBarrageSelecting) {
    if (!tile.revealed) {
      UI.setMessage('Triple Volley — tap a revealed tile to place the 3×3 area.', true)
      return true
    }
    const cost = _stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + _tearyExtraCost())
    if (!_tripleVolleyCenter) {
      _tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — tap the same tile again to fire.')
      return true
    }
    if (tile.row !== _tripleVolleyCenter.row || tile.col !== _tripleVolleyCenter.col) {
      _tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — area moved. Tap the center tile again to confirm.')
      return true
    }
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return true
    }
    _executeTripleVolley(_tripleVolleyCenter)
    return true
  }
  if (_poisonArrowShotSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const cost = _stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + _tearyExtraCost())
      if (run.player.mana < cost) UI.setMessage('Not enough mana for Poison Arrow!', true)
      else _executePoisonArrowShot(tile)
    }
    return true
  }
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
      }
    }
    return true
  }
  if (_chainLightningSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) {
        UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
      } else {
        _executeChainLightning(tile)
      }
    }
    return true
  }
  if (_telekineticThrowStep > 0) {
    if (_telekineticThrowStep === 1) {
      if (_isTelekineticThrowEnemyTarget(tile)) {
        _telekineticEnemyTile = { row: tile.row, col: tile.col }
        _telekineticThrowStep = 2
        UI.clearTelekineticMarks()
        UI.markTelekineticOrigin(tile.element)
        UI.setGridTelekineticThrowMode('dest')
        UI.setMessage('🌀 Now tap a revealed empty tile to slam them down.')
      } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        if (tile.enemyData.behaviour === 'boss' || tile.type === 'boss') {
          UI.setMessage('🛡️ Bosses cannot be thrown.', true)
        } else if (tile.enemyData.spellImmune) {
          UI.setMessage('🛡️ That enemy is immune to Telekinetic Throw!', true)
        } else {
          UI.setMessage('Not a valid target.', true)
        }
      } else {
        UI.setMessage('Tap a revealed enemy to grab.', true)
      }
      return true
    }
    if (_telekineticThrowStep === 2) {
      const origin = _telekineticEnemyTile
        ? _getActiveTileAt(_telekineticEnemyTile.row, _telekineticEnemyTile.col)
        : null
      if (!origin || !_isTelekineticThrowEnemyTarget(origin)) {
        _cancelTelekineticThrowMode()
        UI.setMessage('Telekinetic Throw — target no longer valid.', true)
        return true
      }
      if (tile.row === origin.row && tile.col === origin.col) {
        UI.setMessage('Pick a different landing tile.', true)
        return true
      }
      if (!_isTelekineticThrowDestination(tile)) {
        UI.setMessage('Landing tile must be a revealed empty tile (no loot, chest, stairs, turret).', true)
        return true
      }
      _executeTelekineticThrow(origin, tile)
      return true
    }
  }
  return false
}

function _onSubFloorTileTap(row, col) {
  if (!run?.subFloor?.active) return
  const sf = run.subFloor
  const tile = sf.tiles[row]?.[col]
  if (!tile) return

  // Ability targeting — shared with main grid
  if (_tryConsumeTargetingTap(tile)) return

  // Stairs up — exit sub-floor
  if (tile.revealed && tile.type === 'stairs_up') {
    _exitSubFloor()
    return
  }

  // Shrine — open choice modal
  if (tile.revealed && tile.type === 'shrine' && !tile.shrineUsed) {
    _openShrine(tile)
    return
  }

  // Chest — open loot
  if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
    _openSubFloorChest(tile)
    return
  }

  // Living enemy — fight
  if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
    if (_combatBusy && Date.now() - _combatBusySetAt > 3000) {
      _combatBusy = false
    }
    if (!_combatBusy) _subFloorFight(tile)
    return
  }

  // Reveal unrevealed tile
  if (!tile.revealed && !tile.locked && tile.reachable) {
    EventBus.emit('audio:play', { sfx: 'flip' })
    _subFloorReveal(tile)
  }
}

function _openSubFloorChest(tile) {
  tile.chestReady = false
  tile.chestLooted = true
  tile.element?.classList.remove('chest-ready')
  EventBus.emit('audio:play', { sfx: 'chest' })

  const loot = tile.chestLoot ?? _rollChestLoot()
  const itemDef = ITEMS[loot.type]

  // Give the loot
  if (loot.type === 'gold') {
    _gainGold(loot.amount ?? 1, tile.element)
    UI.setSubFloorMessage(`You pry it open — +${loot.amount ?? 1} gold!`)
  } else if (loot.type === 'smiths-tools') {
    const amt = itemDef?.effect?.amount ?? 1
    run.player.damageBonus = (run.player.damageBonus ?? 0) + amt
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    UI.setSubFloorMessage(`You pry it open — ${itemDef?.name ?? "Smith's Tools"}! +${amt} attack.`)
  } else {
    _addToBackpack(loot.type)
    UI.setSubFloorMessage(`You pry it open — ${itemDef?.name ?? 'something useful'}!`)
  }

  // Float the item icon out of the chest — mirrors main _openChest
  if (itemDef) UI.spawnFloat(tile.element, `${itemDef.icon ?? '📦'} ${itemDef.name}`, 'xp')

  // Play chest-open gif, then fade icon out with collecting animation
  const chestImg = tile.element?.querySelector('.tile-icon-img')
  const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
  const GIF_DURATION = 750

  if (chestImg) _forcePlayChestGif(chestImg, ITEM_ICONS_BASE + 'chest.gif?t=' + Date.now())

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

/**
 * Reveal the exit tile on the main floor (map pickup reward).
 * Finds any unrevealed exit tile and flips it in place.
 */
function _sfRevealMainFloorExit() {
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

/** Fade out and clear the icon on a collected sub-floor tile (gold, heart). */
function _sfFadeOutTileIcon(tile) {
  const wrap = tile.element?.querySelector('.tile-icon-wrap')
  if (!wrap) return
  setTimeout(() => {
    wrap.style.transition = 'opacity 0.4s ease'
    wrap.style.opacity = '0'
    setTimeout(() => { wrap.innerHTML = ''; wrap.style.cssText = '' }, 420)
  }, 500)
}

function _subFloorReveal(tile) {
  if (!run?.subFloor) return
  const sf = run.subFloor
  tile.revealed = true
  UI.flipSubFloorTile(tile)
  // Resolve tile effect
  switch (tile.type) {
    case 'enemy':
    case 'boss': {
      // Lock orthogonal neighbors in sub-floor
      _sfLockAdjacent(tile)
      _gainXP(CONFIG.xp.perTileReveal, null)
      UI.setSubFloorMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
      break
    }
    case 'chest': {
      tile.chestLoot = _rollChestLoot()
      tile.chestReady = true
      tile.element?.classList.add('chest-ready')
      _gainXP(CONFIG.xp.perTileReveal, null)
      UI.setSubFloorMessage('A chest! Tap it to open.')
      break
    }
    case 'gold': {
      _gainGold(1, tile.element)
      _gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage('You pocket a coin. +1 gold.')
      _sfFadeOutTileIcon(tile)
      break
    }
    case 'heart': {
      const heal = CONFIG.heart.healAmount
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal)
      UI.updateHP(run.player.hp, run.player.maxHp)
      UI.spawnFloat(tile.element, `+${heal} HP`, 'heal')
      _gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage(`A healing sigil. +${heal} HP.`)
      _sfFadeOutTileIcon(tile)
      break
    }
    case 'trap': {
      const trapDmg = _rand(2, 5)
      _takeDamage(trapDmg, tile.element)
      _gainXP(CONFIG.xp.perTileReveal, tile.element)
      UI.setSubFloorMessage(`A trap! You take ${trapDmg} damage.`)
      break
    }
    case 'empty': {
      _gainXP(CONFIG.xp.perTileReveal, null)
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
      _gainXP(CONFIG.xp.perTileReveal, tile.element)
      // Reveal the main-floor exit tile
      _sfRevealMainFloorExit()
      UI.setSubFloorMessage('📜 You found a map! The exit on the main floor is now visible.')
      _sfFadeOutTileIcon(tile)
      break
    }
    case 'rubble': {
      // Toxic gas: deal damage each flip
      if (run.subFloor?.type === 'toxic_gas') {
        const dmg = CONFIG.subFloor.toxicGasDamagePerFlip
        _takeDamage(dmg, tile.element)
        UI.setSubFloorMessage(`☠️ Gas chokes you — ${dmg} damage! Keep searching for the exit.`)
      } else {
        UI.setSubFloorMessage('Just rubble and dust.')
      }
      _sfFadeOutTileIcon(tile)
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

function _sfLockAdjacent(tile) {
  if (!run?.subFloor) return
  const { tiles } = run.subFloor
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

function _sfUnlockAdjacent(tile) {
  if (!run?.subFloor) return
  const { tiles, rows, cols } = run.subFloor
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

function _subFloorFight(tile) {
  if (_combatBusy) return
  _combatBusy = true; _combatBusySetAt = Date.now()
  const result = CombatResolver.resolveFight(run.player, tile.enemyData)
  const playerDmg = result.playerDmg

  UI.setPortraitAnim('attack')
  EventBus.emit('audio:play', { sfx: 'hit' })
  UI.spawnSlash(tile.element)
  UI.shakeTile(tile.element)

  // Apply player damage to enemy
  const prevHP = tile.enemyData.currentHP ?? tile.enemyData.hp
  tile.enemyData.currentHP = Math.max(0, prevHP - playerDmg)
  const enemySlain = tile.enemyData.currentHP <= 0

  if (enemySlain) {
    tile.enemyData.currentHP = 0
    tile.enemyData._slain = true
    _gainGold(tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
    _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'damage')
    UI.setSubFloorMessage(`You slay the ${tile.enemyData.label} for ${playerDmg} damage!`)
    UI.markSubFloorTileSlain(tile)
    _sfUnlockAdjacent(tile)
    // Boss vault: unlock all rewards on boss death
    if (tile.isBossVaultBoss) {
      const sf = run.subFloor
      for (const row of sf.tiles) for (const t of row) {
        if (t && t.locked) {
          t.locked = false; t.reachable = true
          UI.unlockSubFloorTile(t); UI.markSubFloorTileReachable(t)
        }
      }
      UI.setSubFloorMessage('The boss falls! The vault trembles — riches await.')
    }
    setTimeout(() => { UI.setPortraitAnim('idle'); _combatBusy = false }, 400)
  } else {
    const taken = _computeEffectiveDamageTaken(result.enemyDmg)
    UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'damage')
    _takeDamage(taken, tile.element, false, tile.enemyData, { enemyAttack: true })
    UI.setSubFloorMessage(`You strike for ${playerDmg}. The ${tile.enemyData.label} hits back for ${taken}.`)
    UI.updateSubFloorEnemyHP(tile)
    setTimeout(() => { UI.setPortraitAnim('idle'); _combatBusy = false }, 500)
  }
}

function _openShrine(tile) {
  const cfg = CONFIG.subFloor.shrine
  const canAffordGold = run.player.gold >= cfg.goldOfferingCost
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
    const hpCost = Math.max(1, Math.floor(run.player.maxHp * cfg.bloodSacrificeHpPct))
    run.player.maxHp = Math.max(1, run.player.maxHp - hpCost)
    run.player.hp = Math.min(run.player.hp, run.player.maxHp)
    run.player.damageBonus = (run.player.damageBonus ?? 0) + cfg.bloodSacrificeDmgBonus
    UI.updateHP(run.player.hp, run.player.maxHp)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    tile.shrineUsed = true
    _closeShrineOverlay()
    UI.setSubFloorMessage(`You offer your blood. −${hpCost} max HP, +${cfg.bloodSacrificeDmgBonus} damage.`)
  }

  function onGold() {
    if (run.player.gold < cfg.goldOfferingCost) return
    run.player.gold -= cfg.goldOfferingCost
    run.player.maxHp += cfg.goldOfferingHpBonus
    run.player.hp = Math.min(run.player.hp + cfg.goldOfferingHpBonus, run.player.maxHp)
    UI.updateGold(run.player.gold)
    UI.updateHP(run.player.hp, run.player.maxHp)
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

function onTileTap(row, col) {
  const state = GameState.current()
  const tile  = TileEngine.getTile(row, col)
  if (!tile) return

  if (state === States.NPC_INTERACT) return

  _syncAllUnrevealedLockedDom()

  if (state === States.FLOOR_EXPLORE && _engineerConstructSelecting && _charKey() === 'engineer') {
    const isLivingEnemyTap = tile.revealed && tile.enemyData && !tile.enemyData._slain
    if (!isLivingEnemyTap) {
      if (_isCombatCommitmentLocked()) {
        const tr = run.turret
        const onTurret = tr && tile.row === tr.row && tile.col === tr.col
        const emptyBuild = tile.revealed && tile.type === 'empty' && !tile.locked
        if (!onTurret && !emptyBuild) {
          UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
          return
        }
      }
      if (_handleEngineerConstructTileTap(tile)) return
    }
  }

  // Spell targeting mode: only enemy taps fire; everything else ignored
  if (_spellTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _castSpell(tile)
    }
    return
  }

  // Throwing Knife targeting
  if (_throwingKnifeTargeting) {
    _throwingKnifeTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (!_canAttackEnemy(tile)) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      _setCombatEngagement(tile)
      const dmg = 3
      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
      UI.spawnFloat(tile.element, `🗡️ ${dmg}`, 'damage')
      EventBus.emit('audio:play', { sfx: 'hit' })
      if (tile.enemyData.currentHP <= 0) {
        _gainGold(tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
        _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        _endCombatVictory(tile)
        UI.setMessage(`🗡️ Knife flies true — enemy slain! No counter-attack.`)
      } else {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        UI.setMessage(`🗡️ Knife deals ${dmg} damage. Enemy has ${tile.enemyData.currentHP} HP left.`)
      }
    }
    return
  }

  // Twin Blades targeting
  if (_twinBladesTargeting) {
    _twinBladesTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (!_canAttackEnemy(tile)) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      _setCombatEngagement(tile)
      const dmg = 5
      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
      UI.spawnFloat(tile.element, `⚔️ ${dmg}`, 'damage')
      EventBus.emit('audio:play', { sfx: 'hit' })
      if (tile.enemyData.currentHP <= 0) {
        _gainGold(tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
        _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        _endCombatVictory(tile)
        UI.setMessage(`⚔️ Twin Blades — enemy slain! No counter-attack.`)
      } else {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        UI.setMessage(`⚔️ Twin Blades deal ${dmg} damage. Enemy has ${tile.enemyData.currentHP} HP left.`)
      }
    }
    return
  }

  // Rusty Nail targeting
  if (_rustyNailTargeting) {
    _rustyNailTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (!_canAttackEnemy(tile)) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      _setCombatEngagement(tile)
      tile.enemyData.poisonTurns = (tile.enemyData.poisonTurns ?? 0) + 5
      tile.enemyData.nailPoison  = true
      UI.spawnFloat(tile.element, '📌 Poisoned!', 'damage')
      UI.setMessage(`📌 Rusty nail lodges deep — ${tile.enemyData.label} will take 1 damage per turn for 5 turns.`)
      EventBus.emit('audio:play', { sfx: 'hit' })
    }
    return
  }

  // Lantern targeting: any unrevealed tile (ignores reachable restriction)
  if (_lanternTargeting) {
    if (!tile.revealed) {
      if (_isCombatCommitmentLocked()) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      _useLanternOn(tile)
      return
    }
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _lanternTargeting = false
      UI.setLanternTargeting(false)
      // Fall through — melee the enemy
    } else {
      return
    }
  }

  if (_spyglassTargeting) {
    if (!tile.revealed) {
      if (_isCombatCommitmentLocked()) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      _useSpyglassOn(tile)
      return
    }
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _spyglassTargeting = false
      UI.setLanternTargeting(false)
      // Fall through — melee the enemy
    } else {
      return
    }
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

  // Chain Lightning: tap a revealed living enemy — bolt zaps, then arcs to up to 2 more at random
  if (_chainLightningSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) {
        UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
      } else {
        _executeChainLightning(tile)
      }
    }
    return
  }

  // Telekinetic Throw: tap enemy (step 1), tap empty tile (step 2)
  if (_telekineticThrowStep > 0) {
    if (_telekineticThrowStep === 1) {
      if (_isTelekineticThrowEnemyTarget(tile)) {
        _telekineticEnemyTile = { row: tile.row, col: tile.col }
        _telekineticThrowStep = 2
        UI.clearTelekineticMarks()
        UI.markTelekineticOrigin(tile.element)
        UI.setGridTelekineticThrowMode('dest')
        UI.setMessage('🌀 Now tap a revealed empty tile to slam them down.')
      } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        if (tile.enemyData.behaviour === 'boss' || tile.type === 'boss') {
          UI.setMessage('🛡️ Bosses cannot be thrown.', true)
        } else if (tile.enemyData.spellImmune) {
          UI.setMessage('🛡️ That enemy is immune to Telekinetic Throw!', true)
        } else {
          UI.setMessage('Not a valid target.', true)
        }
      } else {
        UI.setMessage('Tap a revealed enemy to grab.', true)
      }
      return
    }
    if (_telekineticThrowStep === 2) {
      const origin = _telekineticEnemyTile
        ? _getActiveTileAt(_telekineticEnemyTile.row, _telekineticEnemyTile.col)
        : null
      if (!origin || !_isTelekineticThrowEnemyTarget(origin)) {
        _cancelTelekineticThrowMode()
        UI.setMessage('Telekinetic Throw — target no longer valid.', true)
        return
      }
      if (tile.row === origin.row && tile.col === origin.col) {
        UI.setMessage('Pick a different landing tile.', true)
        return
      }
      if (!_isTelekineticThrowDestination(tile)) {
        UI.setMessage('Landing tile must be a revealed empty tile (no loot, chest, stairs, turret).', true)
        return
      }
      _executeTelekineticThrow(origin, tile)
      return
    }
  }

  if (state === States.FLOOR_EXPLORE) {
    const floorCombatLocked = _isCombatCommitmentLocked()
    const tileIsLivingEnemy = tile.revealed && tile.enemyData && !tile.enemyData._slain

    if (floorCombatLocked && !tileIsLivingEnemy) {
      // Sub-floor entry is always accessible regardless of combat lock
      if (tile.revealed && tile.type === 'sub_floor_entry' && tile.entryReady && !tile.subFloorVisited) {
        _enterSubFloor(tile)
        return
      }
      if (tile.revealed && tile.type === 'war_banner' && tile.bannerReady && run.warBanner?.active) {
        _destroyWarBanner(tile)
        return
      }
      // Chests are world interactions (like the banner), not new exploration — allow while engaged.
      if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
        _openChest(tile)
        return
      }
      if (tile.revealed && tile.type === 'magic_chest' && tile.magicChestReady) {
        _openMagicChest(tile)
        return
      }
      if (!tile.revealed && !tile.locked && tile.reachable) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      if (tile.revealed) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      return
    }

    // Eagle Eye: one free flip to any unrevealed unlocked tile after a kill
    if (!_combatBusy && !tile.revealed && !tile.locked && run.player.eagleEyeFreeFlip) {
      run.player.eagleEyeFreeFlip = false
      revealTile(tile)
      return
    }
    if (!_combatBusy && !tile.revealed && !tile.locked && tile.reachable) {
      _hapticVibrate(15)
      revealTile(tile)
    } else if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
      _openChest(tile)
    } else if (tile.revealed && tile.type === 'magic_chest' && tile.magicChestReady) {
      _openMagicChest(tile)
    } else if (tile.revealed && tile.type === 'forge') {
      _openForge(tile)
    } else if (tile.revealed && tile.type === 'exit' && !tile.exitResolved) {
      _confirmExit(tile)
    } else if (tile.revealed && tile.type === 'rope' && !tile.ropeResolved) {
      _confirmRope(tile)
    } else if (tile.revealed && tile.type === 'event' && !tile.eventResolved) {
      _openEvent(tile)
    } else if (tile.revealed && tile.type === 'hole') {
      if (tile.deadlockEscape) _climbThroughHazard(tile)
      else UI.setMessage('A gaping pit blocks the way. You cannot pass.')
    } else if (tile.revealed && tile.type === 'blockage') {
      if (tile.deadlockEscape) _climbThroughHazard(tile)
      else UI.setMessage('A pile of rubble blocks the way. Find another path.')
    } else if (tile.revealed && tile.type === 'sub_floor_entry' && tile.entryReady && !tile.subFloorVisited) {
      _enterSubFloor(tile)
    } else if (tile.revealed && tile.type === 'war_banner' && tile.bannerReady && run.warBanner?.active) {
      _destroyWarBanner(tile)
    } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      // Archer / Mouse: only fightable once the player has revealed an adjacent tile
      if (tile.enemyData?.behaviour === 'archer' || tile.enemyData?.behaviour === 'mouse') {
        const neighbors = TileEngine.getOrthogonalTiles(tile.row, tile.col)
        if (!neighbors.some(n => n.revealed)) {
          const label = tile.enemyData.behaviour === 'mouse' ? 'The mouse scurries away — advance to engage.' : 'The archer is too far away — advance to engage.'
          UI.setMessage(label, true)
          return
        }
      }
      // Safety net: if _combatBusy has been stuck for >3s with no resolution, clear it
      if (_combatBusy && Date.now() - _combatBusySetAt > 3000) {
        console.warn('[GameController] _combatBusy stuck >3s — force-clearing')
        _combatBusy = false
      }
      if (!_combatBusy) fightAction(tile)
    }
  }
}

// ── Tile hold (info card) ────────────────────────────────────

function _showTurretPerimeter(tr) {
  const grid = TileEngine.getGrid()
  if (!grid || !tr) return
  const radius = tr.mode === 'tesla' ? _teslaManhattanRadius(tr.level) : null
  for (const row of grid) {
    for (const t of row) {
      if (!t.element) continue
      if (radius !== null) {
        const d = Math.abs(tr.row - t.row) + Math.abs(tr.col - t.col)
        t.element.classList.toggle('turret-perimeter', d > 0 && d <= radius)
      }
    }
  }
}

function _clearTurretPerimeter() {
  const grid = TileEngine.getGrid()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      t.element?.classList.remove('turret-perimeter')
    }
  }
}

function onTileHold(row, col) {
  const tile = TileEngine.getTile(row, col)
  if (!tile) return

  // Turret hold — check before empty guard since turret sits on empty tiles
  const tr = run?.turret
  if (tile.revealed && tr && tr.row === row && tr.col === col) {
    const dmg    = _engineerTurretDamage(tr.level)
    const radius = tr.mode === 'tesla' ? _teslaManhattanRadius(tr.level) : null
    const details = [
      { icon: '🛡️', label: 'Mode',   desc: tr.mode === 'tesla' ? 'Tesla — zaps enemies in perimeter' : 'Ballistic — fires at all revealed enemies' },
      { icon: '⬆️', label: 'Level',  desc: `T${tr.level}` },
      { icon: '❤️', label: 'HP',     desc: `${tr.hp} / ${tr.maxHp}` },
      { icon: '⚔️', label: 'Damage', desc: `${dmg} per hit` },
      ...(radius !== null ? [{ icon: '📡', label: 'Radius', desc: `${radius} tile${radius !== 1 ? 's' : ''} (Manhattan)` }] : []),
    ]
    _showTurretPerimeter(tr)
    const overlay = document.getElementById('info-card-overlay')
    const onClose = () => {
      _clearTurretPerimeter()
      overlay?.removeEventListener('click', onClose)
    }
    overlay?.addEventListener('click', onClose)
    UI.showInfoCard({
      name:      `Turret (T${tr.level})`,
      spriteSrc: tr.mode === 'tesla'
        ? 'assets/sprites/Heroes/Engineer/turret-tesla.gif'
        : 'assets/sprites/Heroes/Engineer/turret-t1.gif',
      blurb:     tr.mode === 'tesla'
        ? `⚡ Tesla Tower — zaps any enemy you attack within its ${radius}-tile perimeter.`
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
  // Freezing Hit debuff tick (1 stack falls off per global turn)
  if ((run.player.freezingHitStacks ?? 0) > 0) {
    run.player.freezingHitStacks--
    UI.setFreezingHit(run.player.freezingHitStacks)
  }
  // Corruption debuff tick: 1 stack falls off per global turn, restoring max HP/Mana proportionally
  if ((run.player.corruptionStacks ?? 0) > 0) {
    run.player.corruptionStacks--
    const stacks = run.player.corruptionStacks
    if (stacks === 0) {
      // Fully restore base max values
      if (run.player.corruptionBaseMaxHp)   run.player.maxHp   = run.player.corruptionBaseMaxHp
      if (run.player.corruptionBaseMaxMana) run.player.maxMana = run.player.corruptionBaseMaxMana
      run.player.corruptionBaseMaxHp   = 0
      run.player.corruptionBaseMaxMana = 0
    } else {
      // Partial restore — recompute from base
      run.player.maxHp   = Math.max(1, Math.round(run.player.corruptionBaseMaxHp   * (1 - stacks * 0.02)))
      run.player.maxMana = Math.max(1, Math.round(run.player.corruptionBaseMaxMana * (1 - stacks * 0.02)))
    }
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.setCorruption(stacks)
  }
  // Player Poison debuff tick: 1 HP damage per stack, then 1 stack falls off
  if ((run.player.poisonStacks ?? 0) > 0) {
    const dmg = run.player.poisonStacks
    run.player.hp = Math.max(1, run.player.hp - dmg)
    UI.updateHP(run.player.hp, run.player.maxHp)
    _hapticVibrate(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `☠️ Poison ${dmg}`, 'damage')
    run.player.poisonStacks--
    UI.setPlayerPoison(run.player.poisonStacks)
  }
  // Burn debuff tick: 1 HP damage per stack, then 1 stack falls off
  if ((run.player.burnStacks ?? 0) > 0) {
    const dmg = run.player.burnStacks
    run.player.hp = Math.max(1, run.player.hp - dmg)
    UI.updateHP(run.player.hp, run.player.maxHp)
    _hapticVibrate(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🔥 Burn ${dmg}`, 'damage')
    run.player.burnStacks--
    UI.setBurnOverlay(run.player.burnStacks)
    if (run.player.hp <= 1 && !GameState.is(States.DEATH)) {
      // Don't kill from burn — leave at 1 HP minimum
    }
  }
  const grid = TileEngine.getGrid()
  const plagueBonus = run.player.inventory?.some(e => e.id === 'plague-rat-skull') ? 1 : 0
  const pDmg = _scaleOutgoingDamageToEnemy(_poisonArrowUnitDamage()) + plagueBonus
  for (const tile of _getActiveTiles()) {
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
  if (!grid) return
  // Harass tick: each revealed living enemy with harassPlayer=true fires at player every global turn
  let totalHarassDmg = 0
  let archerCount = 0
  let batCount = 0
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
      if (!tile.enemyData.harassPlayer) continue
      const rawDmg = tile.enemyData.harassDmg ?? 1
      const dmg = _computeEffectiveDamageTaken(rawDmg)
      totalHarassDmg += dmg
      if (tile.enemyData.enemyId === 'archer_goblin') {
        archerCount++
        // Flash the attack sprite briefly
        const img = tile.element?.querySelector('.tile-icon-img')
        if (img) {
          img.src = MONSTER_ICONS_BASE + 'archer_goblin/archer-goblin-attack.gif?t=' + Date.now()
          setTimeout(() => {
            if (img.isConnected) img.src = MONSTER_ICONS_BASE + 'archer_goblin/archer-goblin-idle.gif?t=' + Date.now()
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
    _takeDamage(totalHarassDmg, document.getElementById('hud-portrait'), false, null, { enemyAttack: true })
    const parts = []
    if (archerCount > 0) parts.push(`🏹 Goblin Archer${archerCount > 1 ? 's fire' : ' fires'} for ${archerCount} dmg!`)
    if (batCount > 0) parts.push(`🦇 Shadow Bat${batCount > 1 ? 's attack' : ' attacks'}!`)
    UI.setMessage(parts.join(' ') + ` (${totalHarassDmg} total)`)
  }

  if (run.player.inventory?.some(e => e.id === 'still-water-amulet')) {
    run.player.turnsWithoutSpell = (run.player.turnsWithoutSpell ?? 0) + 1
  }
  // Bandage Roll HOT
  if ((run.player.regenTurns ?? 0) > 0) {
    const amt = run.player.regenPerTurn ?? 1
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + amt)
    run.player.regenTurns--
    UI.spawnFloat(document.getElementById('hud-portrait'), `🩹 +${amt} HP`, 'heal')
    UI.updateHP(run.player.hp, run.player.maxHp)
  }
}

async function revealTile(tile) {
  _syncAllUnrevealedLockedDom()
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
  if (!run) return  // run ended (retreat/death) during the flip animation
  if (tile.enemyData) {
    TileEngine.rollEnemyHitDamage(tile.enemyData)
    // Face text was built at grid render time — sync HP/⚔️ from model (e.g. war banner, auras)
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP ?? tile.enemyData.hp)
    TileEngine.refreshEnemyDamageOnTile(tile)
  }
  UI.setPortraitAnim('idle')
  _gainXP(CONFIG.xp.perTileReveal, tile.element)
  EventBus.emit('tile:revealed', { tile })
  // Deathmask: instant kill on first enemy reveal after a proc
  if (tile.enemyData && !tile.enemyData._slain && run.player.deathmaskPending) {
    run.player.deathmaskPending = false
    UI.spawnFloat(tile.element, '💀 Instant Kill!', 'xp')
    _gainGold(tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
    _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
    TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
    return
  }
  await _maybeBestiaryDiscovery(tile)
  _resolveEffect(tile)
  if (tile.type === 'war_banner') await _maybeWarBannerIntro()
  // Drowned Hulk aura: if the revealed tile IS the hulk, buff all current visible enemies.
  // If a hulk is already alive, buff this newly revealed enemy.
  if (tile.enemyData && !tile.enemyData._slain) {
    if (tile.enemyData.crewBuffAura) {
      _applyHulkBuffToAll()
    } else {
      const hulk = _findLiveHulk()
      if (hulk && hulk !== tile) _applyHulkBuffToTile(tile)
    }
    _engineerTurretAfterReveal(tile)
  }
  // Blockage / hole tiles do not extend reachability — player must path around them
  if (tile.type !== 'blockage' && tile.type !== 'hole') {
    TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  }
  // Ranger unique trait: 50% chance to sense the category of orthogonal neighbors
  if (_charKey() === 'ranger' && Math.random() < 0.5) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element && !adj.echoHintCategory) {
        const cat = _echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }
  if (_charKey() === 'vampire' && run && !GameState.is(States.DEATH)) {
    _vampireCorruptedBloodAndDarkEyes(tile)
  }
  // Abyssal Lens: randomly reveal one additional tile per flip (non-recursive)
  if (!tile._lensReveal && run.player.inventory.some(e => e.id === 'abyssal-lens')) {
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
      await revealTile(extra)
      delete extra._lensReveal
    }
  }
  _tickPoisonArrowDotOnGlobalTurn()
  TileEngine.refreshAllThreatClueDisplays()
  // Dungeon Mouse (and future tile-flipping creatures): roll after every player flip.
  // Skip on cascaded reveals (Abyssal Lens) so a single tap only triggers mice once.
  if (!tile._lensReveal) {
    await _maybeMouseUnflip(tile)
  }
  _maybeOfferDeadlockEscape()
}

async function _maybeWarBannerIntro() {
  if (_save.settings.warBannerIntroSeen) return
  try {
    await UI.showWarBannerIntro()
    _save.settings.warBannerIntroSeen = true
    await SaveManager.save(_save).catch(() => {})
  } catch (e) {
    Logger.debug('[GameController] war banner intro', e)
  }
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

async function _openChest(tile) {
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
      await _addToBackpack(loot.type)
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
      if (run.player.inventory.some(e => e.id === 'scavengers-bag') && Math.random() < 0.05) {
        _gainGold(1, tile.element)
        UI.setMessage("Your scavenger's bag catches a glint — +1 gold!")
      } else {
        UI.setMessage('Dust, silence, and the distant drip of water.')
      }
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
      if (p.trapImmune) {
        p.trapImmune = false
        EventBus.emit('audio:play', { sfx: 'trap' })
        UI.setMessage('🪢 The rope coil trips the snare harmlessly — you walk right through.')
        UI.spawnFloat(tile.element, '🪢 Blocked!', 'heal')
        UI.showRetreat()
        break
      }
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

    case 'forge': {
      const inv = run.player.inventory
      const hasMatch = FORGE_RECIPES.some(r => {
        const isDupe = r.ingredientA === r.ingredientB
        const count  = inv.filter(e => e.id === r.ingredientA).length
        const hasA   = isDupe ? count >= 2 : inv.some(e => e.id === r.ingredientA)
        const hasB   = isDupe ? true        : inv.some(e => e.id === r.ingredientB)
        return hasA && hasB
      })
      if (hasMatch) {
        _openForge(tile)
      } else {
        UI.setMessage('The forge awaits — bring two combinable trinkets to merge them.')
        UI.showRetreat()
      }
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

    case 'blockage':
      UI.setMessage('A pile of rubble blocks the way. Find another path.')
      break

    case 'hole':
      UI.setMessage('A gaping pit blocks the way. Find another path.')
      break

    case 'event':
      tile.eventResolved = false
      run.eventTile = tile
      if (tile.element) tile.element.classList.add('event-pending')
      UI.setMessage('Something stirs in the shadows. Tap to investigate.')
      UI.showRetreat()
      break

    case 'boss':
    case 'enemy_fast': {
      // Boss tiles: no free ambush hit or forced engagement — tap the boss to start the fight.
      const isBossTile = tile.type === 'boss'
      /** Vampire: no fast-tile ambush damage, shake, or forced engagement — reveal plays like a normal foe. */
      const skipFastAmbushForVampire = p.isVampire && !isBossTile
      let reflexDodge = false
      if (!isBossTile && !skipFastAmbushForVampire) {
        const { dmg } = CombatResolver.resolveFastReveal(tile.enemyData)
        const wardensBlock = p.inventory.some(e => e.id === 'wardens-brand')
        reflexDodge =
          !wardensBlock
          && !tile.enemyData?.isBoss
          && (p.reflexDodgeChance ?? 0) > 0
          && Math.random() < p.reflexDodgeChance
        if (!wardensBlock && !reflexDodge) {
          const baseDmg = dmg + (p.inventory.some(e => e.id === 'abyssal-lens') ? 1 : 0)
          const r = _applyRangerTrapfinderMitigation(baseDmg, p)
          _takeDamage(r.dmg, tile.element, false, null, { enemyAttack: true })
        }
        UI.shakeTile(tile.element)
      }
      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (rangerSkipLock) {
        tile.enemyData.rangerSkipAdjacentLock = true
      } else if (tile.enemyData?.behaviour !== 'archer') {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)
      if (!GameState.is(States.DEATH)) {
        if (isBossTile) {
          UI.setMessage(
            `⚠️ BOSS: ${tile.enemyData.label} — stands before you. Tap when ready to fight.`,
            true,
          )
        } else if (skipFastAmbushForVampire) {
          UI.setMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
        } else {
          const label = tile.enemyData?.isBoss ? `⚠️ BOSS: ${tile.enemyData.label}` : '⚡ Fast enemy'
          const dodgeNote = reflexDodge ? ' Your reflexes kick in — ambush dodged!' : ''
          UI.setMessage(`${label} strikes first!${dodgeNote} Tap it to fight.`, true)
          if (reflexDodge) UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
          _setCombatEngagement(tile, { force: true })
        }
        UI.showRetreat()
        EventBus.emit('tile:locked', {})
      }
      break
    }

    case 'enemy': {
      const rangerSkipLock = p.isRanger && Math.random() < RANGER_PASSIVE_SKIP_ADJ_LOCK
      if (rangerSkipLock) {
        tile.enemyData.rangerSkipAdjacentLock = true
      } else if (tile.enemyData?.behaviour !== 'archer') {
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

      // Fast enemies get a free strike the moment they're revealed (bosses never ambush)
      const hasWardenBrand = p.inventory.some(e => e.id === 'wardens-brand')
      const hasWarden = hasWardenBrand
      const hasLens   = p.inventory.some(e => e.id === 'abyssal-lens')
      if (tile.enemyData?.attributes?.includes('fast') && !tile.enemyData?.isBoss && !p.isVampire) {
        const d = tile.enemyData.dmg
        const ambushDmg  = tile.enemyData.hitDamage ?? (Array.isArray(d) ? d[0] : d)
        const reflexDodge = !hasWarden && (p.reflexDodgeChance ?? 0) > 0 && Math.random() < p.reflexDodgeChance
        if (hasWardenBrand) {
          UI.setMessage(`The ${tile.enemyData.label} lunges — but your brand holds. Tap to fight.`)
        } else if (reflexDodge) {
          UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
          UI.setMessage(`⚡ The ${tile.enemyData.label} lunges — your reflexes save you! Tap to fight.`)
        } else {
          const finalDmg = ambushDmg + (hasLens ? 1 : 0)
          const r = _applyRangerTrapfinderMitigation(finalDmg, p)
          _takeDamage(r.dmg, tile.element, false, tile.enemyData, { enemyAttack: true })
          const tf = r.proc ? ' Trapfinder!' : ''
          UI.setMessage(`⚡ The ${tile.enemyData.label} strikes first for ${r.dmg}!${tf} Tap to fight back.`)
        }
        if (!GameState.is(States.DEATH)) _setCombatEngagement(tile, { force: true })
      } else if (hasLens && !tile.enemyData?.isBoss && !p.isVampire) {
        // Abyssal Lens: normal enemies also deal 1 ambush damage
        _takeDamage(1, tile.element, false, tile.enemyData, { enemyAttack: true })
        if (!GameState.is(States.DEATH)) {
          UI.setMessage(`👁️ The ${tile.enemyData?.label ?? 'enemy'} senses your sight and strikes! Tap to fight.`)
          _setCombatEngagement(tile, { force: true })
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

function _confirmExit(tile) {
  if (tile.type !== 'exit' || tile.exitResolved) return
  tile.exitResolved = true
  tile.element?.classList.remove('exit-pending')
  _handleExit()
}

// ── Event tile ───────────────────────────────────────────────

function _openEvent(tile) {
  if (tile.eventResolved) return
  if (!GameState.transition(States.NPC_INTERACT)) return
  EventBus.emit('audio:play', { sfx: 'merchant' })

  // Roll event type once and cache on tile so resume works
  if (!tile.eventType) tile.eventType = rollEventType()

  switch (tile.eventType) {
    case 'merchant':    _openMerchantShop(tile);  break
    case 'gambler':     _openGamblerEvent(tile);   break
    case 'triple-chest':   _openTripleChestEvent(tile);  break
    case 'trinket-trader': _openTrinketTraderEvent(tile); break
    default:               _openStoryEvent(tile);         break
  }
}

function _closeEventSession(tile) {
  if (tile) {
    tile.eventResolved = true
    tile.element?.classList.remove('event-pending')
  }
  run.eventTile = null
  UI.hideEventOverlays()
  if (GameState.is(States.NPC_INTERACT)) GameState.transition(States.FLOOR_EXPLORE)
  _flushDeferredLevelUpXp()
}

/** Balance bot: leave merchant / event UI without simulating clicks (closes session + returns to explore). */
function balanceBotDismissNpcEvent() {
  if (!GameState.is(States.NPC_INTERACT)) return false
  if (run?.eventTile) {
    _closeEventSession(run.eventTile)
    return true
  }
  UI.hideEventOverlays()
  if (!GameState.transition(States.FLOOR_EXPLORE)) GameState.set(States.FLOOR_EXPLORE)
  _flushDeferredLevelUpXp()
  return true
}

// ── Merchant shop ─────────────────────────────────────────────

function _rollMerchantTrinket() {
  const pool = [...RARE_TRINKET_IDS, ...LEGENDARY_TRINKET_IDS]
  return _pickRandom(pool)
}

function _openMerchantShop(tile) {
  const trinketId = _rollMerchantTrinket()
  const items = MERCHANT_ITEMS.map(def => ({
    ...def,
    id: def.id === '__trinket__' ? trinketId : def.id,
    label: def.id === '__trinket__' ? (ITEMS[trinketId]?.name ?? 'Mystery Relic') : def.label,
  }))
  UI.showMerchantShop(run.player.gold, items, (itemId) => _doMerchantBuy(tile, itemId, items), () => {
    if (!GameState.is(States.DEATH)) UI.setMessage('The merchant watches you leave.')
    _closeEventSession(tile)
  })
}

async function _doMerchantBuy(tile, itemId, items) {
  const p = run.player
  const def = items.find(i => i.id === itemId)
  if (!def) return
  if (p.gold < def.price) { UI.setMessage('Not enough gold!', true); return }
  p.gold -= def.price
  UI.updateGold(p.gold)
  await _addToBackpack(itemId)
  EventBus.emit('inventory:changed')
  EventBus.emit('audio:play', { sfx: 'chest' })
  UI.setMessage(`You purchase the ${def.label}.`)
  // Refresh shop display with updated gold (no-op if backpack:full already closed it)
  UI.refreshMerchantShopGold(p.gold)
}

// ── Gambler event ─────────────────────────────────────────────

function _openGamblerEvent(tile) {
  const p = run.player
  UI.showGamblerEvent(
    p.gold,
    // onBetAndRoll
    (bet) => {
      // Deduct bet immediately; refund handled in outcome
      const actualBet = Math.min(bet, p.gold)
      p.gold -= actualBet
      UI.updateGold(p.gold)

      UI.gamblerShowRollPhase((r1, r2) => {
        const total = r1 + r2
        const won   = total >= 7

        if (won) {
          // Return bet + winnings
          _gainGold(actualBet * 2, document.getElementById('hud-portrait'))
        }

        UI.gamblerShowOutcome(actualBet, r1, r2, won)

        // Wire the Continue button
        const ov  = document.getElementById('gambler-overlay')
        const btn = ov?.querySelector('#gambler-outcome-ok')
        if (btn) {
          btn.onclick = () => {
            _closeEventSession(tile)
            if (won) {
              UI.setMessage(`You rolled ${r1 + r2}! You win ${actualBet}🪙 — the gambler tips his hat.`)
            } else {
              UI.setMessage(`You rolled ${r1 + r2}. The gambler pockets your gold with a grin.`)
            }
          }
        }
      })
    },
    // onWalkAway
    () => {
      _closeEventSession(tile)
      UI.setMessage('You walk away from the gambler\'s table.')
    },
  )
}

// ── Triple chest event ────────────────────────────────────────

async function _openTripleChestEvent(tile) {
  const chests = [
    { rarity: 'common',    loot: _rollCommonLoot() },
    { rarity: 'rare',      loot: { type: _pickRandom(RARE_TRINKET_IDS) } },
    { rarity: 'legendary', loot: { type: _pickRandom(LEGENDARY_TRINKET_IDS) } },
  ]
  // Shuffle so player can't always pick right
  chests.sort(() => Math.random() - 0.5)

  UI.showTripleChestEvent(chests, async (idx) => {
    try {
      const chosen = chests[idx]
      const loot = chosen.loot
      if (loot.type === 'gold') {
        _gainGold(loot.amount ?? 5, tile.element)
        UI.setMessage(`You open the chest — ${loot.amount ?? 5} gold spills out!`)
      } else {
        await _addToBackpack(loot.type)
        EventBus.emit('inventory:changed')
        UI.setMessage(`You open the chest and find: ${ITEMS[loot.type]?.name ?? loot.type}!`)
      }
      EventBus.emit('audio:play', { sfx: 'chest' })
    } finally {
      _closeEventSession(tile)
    }
  }, () => _closeEventSession(tile))
}

// ── Trinket Trader event ──────────────────────────────────────

function _openTrinketTraderEvent(tile) {
  UI.showTrinketTraderEvent(
    run.player.inventory,
    ITEMS,
    async (offeredId) => {
      // Drop the offered trinket
      const offeredName = ITEMS[offeredId]?.name ?? offeredId
      dropItem(offeredId)
      // Roll a replacement — same rarity as what was given, with a small upgrade chance
      const offeredRarity = ITEMS[offeredId]?.rarity ?? 'common'
      const newId = _rollTrinketTradeReward(offeredRarity)
      const newItem = ITEMS[newId]
      // Close event BEFORE adding so any backpack:full prompt appears cleanly
      _closeEventSession(tile)
      await _addToBackpack(newId)
      EventBus.emit('inventory:changed')
      UI.setMessage(`✨ You traded ${offeredName} for ${newItem?.name ?? newId}!`)
      EventBus.emit('audio:play', { sfx: 'chest' })
    },
    () => {
      _closeEventSession(tile)
      UI.setMessage('The trader nods and disappears into the shadows.')
    },
  )
}

/** Roll a trinket reward for the Trinket Trader, biased toward the offered rarity with a small upgrade chance. */
function _rollTrinketTradeReward(offeredRarity) {
  // 15% chance to upgrade one tier, 5% chance to downgrade, otherwise same
  const r = Math.random()
  let targetRarity = offeredRarity
  if (offeredRarity === 'common' && r < 0.15)       targetRarity = 'rare'
  else if (offeredRarity === 'rare' && r < 0.15)    targetRarity = 'legendary'
  else if (offeredRarity === 'rare' && r < 0.20)    targetRarity = 'common'
  else if (offeredRarity === 'legendary' && r < 0.15) targetRarity = 'rare'

  // Build pool from the matching rarity, excluding what player already has and what they just traded
  const owned = new Set(run.player.inventory.map(e => e.id))
  let pool = []
  if (targetRarity === 'common')    pool = COMMON_LOOT_IDS.filter(id => !owned.has(id) && ITEMS[id]?.rarity === 'common')
  if (targetRarity === 'rare')      pool = RARE_TRINKET_IDS.filter(id => !owned.has(id))
  if (targetRarity === 'legendary') pool = LEGENDARY_TRINKET_IDS.filter(id => !owned.has(id))

  // Fallback: allow duplicates if pool is exhausted
  if (pool.length === 0) {
    if (targetRarity === 'common')    pool = COMMON_LOOT_IDS.filter(id => ITEMS[id]?.rarity === 'common')
    if (targetRarity === 'rare')      pool = [...RARE_TRINKET_IDS]
    if (targetRarity === 'legendary') pool = [...LEGENDARY_TRINKET_IDS]
  }
  if (pool.length === 0) pool = RARE_TRINKET_IDS  // final fallback

  return pool[Math.floor(Math.random() * pool.length)]
}

// ── Story event ───────────────────────────────────────────────

function _openStoryEvent(tile) {
  const scenario = STORY_EVENTS[Math.floor(Math.random() * STORY_EVENTS.length)]
  UI.showStoryEvent(scenario, (choiceIdx, outcomeIdx) => {
    const outcome = scenario.choices[choiceIdx].outcomes[outcomeIdx]
    _applyStoryOutcome(outcome, tile)
    UI.showStoryOutcome(outcome.text, () => _closeEventSession(tile))
  })
}

function _applyStoryOutcome(outcome, tile) {
  const p = run.player
  switch (outcome.effect) {
    case 'damage':
      _takeDamage(outcome.effectValue, tile.element)
      break
    case 'heal':
      p.hp = Math.min(p.maxHp, p.hp + outcome.effectValue)
      UI.spawnFloat(tile.element, `+${outcome.effectValue} HP`, 'heal')
      UI.updateHP(p.hp, p.maxHp)
      break
    case 'gold':
      _gainGold(outcome.effectValue, tile.element)
      break
    case 'mana':
      p.mana = Math.min(p.maxMana, p.mana + outcome.effectValue)
      UI.spawnFloat(tile.element, `+${outcome.effectValue}🔵`, 'mana')
      UI.updateMana(p.mana, p.maxMana)
      break
    case 'golden-key':
      p.goldenKeys = (p.goldenKeys ?? 0) + outcome.effectValue
      UI.updateGoldenKeys(p.goldenKeys)
      UI.spawnFloat(tile.element, `🗝️ +${outcome.effectValue}`, 'xp')
      break
    case 'nothing':
    default:
      break
  }
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
  _combatBusy = true; _combatBusySetAt = Date.now()

  _tickPoisonArrowDotOnGlobalTurn()
  if (!tile?.enemyData || tile.enemyData._slain) {
    _combatBusy = false
    return
  }

  // Mushroom Harvester taunt: redirect melee to a random visible Harvester
  tile = _resolveTauntTarget(tile)
  if (!tile?.enemyData || tile.enemyData._slain) {
    _combatBusy = false
    return
  }
  if (!_canAttackEnemy(tile)) {
    _combatBusy = false
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  _setCombatEngagement(tile)

  const result = CombatResolver.resolveFight(run.player, tile.enemyData)

  let playerDmg = result.playerDmg
  if (_charKey() === 'engineer' && run.turret?.hp > 0) {
    const tr = run.turret
    const useTurret = tr.mode === 'ballistic' || (tr.mode === 'tesla' && _inTeslaPerimeter(tr, tile))
    if (useTurret) {
      playerDmg += _engineerTurretDamage(tr.level)
      const turretTileEl = TileEngine.getTile(tr.row, tr.col)?.element
      if (tr.mode === 'tesla') {
        setTimeout(() => UI.spawnTeslaArc(turretTileEl, tile.element), 80)
      } else {
        setTimeout(() => UI.spawnCannonShot(turretTileEl, tile.element), 80)
      }
    }
  }
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) playerDmg = Math.round(playerDmg * 2)
  if (run.player.beastBonus  && isBeast)  playerDmg = Math.round(playerDmg * 2)

  if (run.player.inventory.some(e => e.id === 'duelists-glove') && !tile.enemyData._duelistFirstMeleeDone) {
    playerDmg += 1
    tile.enemyData._duelistFirstMeleeDone = true
  }
  // Whetstone: +1 damage for next N hits
  if ((run.player.whettsoneHits ?? 0) > 0) {
    playerDmg += 1
    run.player.whettsoneHits--
  }
  // Mirror of Vanity: +20% of current HP as flat damage bonus
  if (run.player.inventory.some(e => e.id === 'mirror-of-vanity')) {
    playerDmg += Math.max(1, Math.floor(run.player.hp * 0.2))
  }
  // Ogre: 10% shield block — cancels entire melee attack
  if (_checkShieldBlock(tile)) { _combatBusy = false; return }

  playerDmg = _scaleOutgoingDamageToEnemy(playerDmg)
  _gainManaFromMeleeHit(tile.element)

  run.player.meleeHitCount = (run.player.meleeHitCount ?? 0) + 1
  const _stormProc = run.player.inventory.some(e => e.id === 'stormcallers-fist') && run.player.meleeHitCount % 5 === 0

  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast) ? ' (2×!)' : ''
  const curHp = Number(tile.enemyData.currentHP)
  const safeCurHp = Number.isFinite(curHp) ? curHp : Math.max(1, Number(tile.enemyData.hp) || 1)
  if (!Number.isFinite(curHp)) tile.enemyData.currentHP = safeCurHp
  const hpBeforeStrike = tile.enemyData.currentHP
  const pd = Number(playerDmg)
  const safePd = Number.isFinite(pd) ? pd : _scaleOutgoingDamageToEnemy(1)
  const newEnemyHP = _save.settings.cheats?.instantKill ? 0 : Math.max(0, safeCurHp - safePd)
  const killsEnemy = newEnemyHP <= 0

  // Fire Ring: 10% chance to ignite on hit
  const hasFireRing = run.player.inventory.some(e => e.id === 'fire-ring')
  const ignite = hasFireRing && !killsEnemy && Math.random() < 0.10

  // Infected Blade: every melee hit poisons the enemy (3 turns)
  if (!killsEnemy && run.player.inventory.some(e => e.id === 'infected-blade')) {
    tile.enemyData.poisonTurns = Math.max(tile.enemyData.poisonTurns ?? 0, 3)
  }

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

  const enemyGoldDrop = tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1

  // Slime split: first kill restores half HP and splits visually
  const canSplit = killsEnemy
    && tile.enemyData?.attributes?.includes('splits')
    && !tile.enemyData.hasSplit

  if (killsEnemy && !canSplit) {
    // Fatal blow — enemy never gets to counter
    setTimeout(() => {
      // Spell / Slam / boss exit can resolve this kill first; boss tile clears enemyData.
      if (!run || !tile?.enemyData || tile.enemyData._slain) {
        _combatBusy = false
        return
      }
      if (run.telemetry) {
        run.telemetry.totalDamageDealtToEnemies += hpBeforeStrike
        _telemetryBumpDamageDealt(run.floor, hpBeforeStrike)
      }
      tile.enemyData.currentHP = 0
      if (tile.enemyData?.enemyId === 'onion') _applyTearyEyes()
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls before they can strike back. +${enemyGoldDrop} gold.`)
      _gainGold(enemyGoldDrop, tile.element, true)
      _gainXP(result.xpDrop ?? 0, tile.element)
      _endCombatVictory(tile)
      if (_stormProc) _triggerStormcallerLightning(tile, playerDmg)
      afterAttackPortrait(() => {
        UI.setPortraitAnim('idle')
      })
      _combatBusy = false
    }, 400)
  } else if (canSplit) {
    setTimeout(() => {
      if (!run || !tile?.enemyData || tile.enemyData._slain) {
        _combatBusy = false
        return
      }
      const splitHP = Math.max(1, Math.floor(tile.enemyData.hp / 2))
      if (run.telemetry) {
        const dealt = hpBeforeStrike - splitHP
        run.telemetry.totalDamageDealtToEnemies += dealt
        _telemetryBumpDamageDealt(run.floor, dealt)
      }
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
      if (!run) { _combatBusy = false; return }
      if (!tile?.enemyData || tile.enemyData._slain) {
        _combatBusy = false
        return
      }
      if (run.telemetry) {
        const dealt = hpBeforeStrike - newEnemyHP
        run.telemetry.totalDamageDealtToEnemies += dealt
        _telemetryBumpDamageDealt(run.floor, dealt)
      }
      tile.enemyData.currentHP = newEnemyHP
      if (tile.enemyData?.enemyId === 'onion') { _applyTearyEyes(); _checkOnionLayer(tile) }

      if (ignite) {
        tile.enemyData.burnTurns = 3
        UI.spawnFloat(tile.element, '🔥 Ignited!', 'damage')
      }

      // Tick burn damage if active
      if ((tile.enemyData.burnTurns ?? 0) > 0) {
        const burnPlagueBonus = run.player.inventory.some(e => e.id === 'plague-rat-skull') ? 1 : 0
        const chp0 = Number(tile.enemyData.currentHP)
        const chp = Number.isFinite(chp0) ? chp0 : Number(tile.enemyData.hp ?? 0)
        const burnDmg = chp > 0
          ? Math.max(1, Math.floor(chp * 0.2)) + burnPlagueBonus
          : 1 + burnPlagueBonus
        tile.enemyData.currentHP = Math.max(0, (Number.isFinite(chp0) ? chp0 : chp) - burnDmg)
        tile.enemyData.burnTurns--
        UI.spawnFloat(tile.element, `🔥 ${burnDmg}`, 'damage')
        if (tile.enemyData.currentHP <= 0) {
          UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
          UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls to flames before they can strike back. +${enemyGoldDrop} gold.`)
          _gainGold(enemyGoldDrop, tile.element, true)
          _gainXP(result.xpDrop ?? 0, tile.element)
          _endCombatVictory(tile)
          afterAttackPortrait(() => {
            UI.setPortraitAnim('idle')
          })
          _combatBusy = false
          return
        }
      }

      // Spiked Collar: deal 1 self-damage on every melee hit
      if (run.player.inventory.some(e => e.id === 'spiked-collar')) {
        _takeDamage(1, tile.element, true)
        if (GameState.is(States.DEATH)) { _combatBusy = false; return }
      }

      // Decrement stun
      if (isStunned) tile.enemyData.stunTurns--

      // Enemy counter-attack (skipped if stunned)
      if (!isStunned) {
        _setEnemySprite(tile, 'attack')
        if (tile.enemyData?.freezingHit)    _applyFreezingHit()
        if (tile.enemyData?.burnHit)         _applyBurnHit(tile.enemyData.burnHitAmount ?? 2)
        if (tile.enemyData?.poisonHit)       _applyPlayerPoison(tile.enemyData.poisonHitAmount ?? 2)
        if (tile.enemyData?.corruptionHit)   _applyCorruption()
        if (tile.enemyData?.demonFlip)        _tryDemonFlip(tile)
        _takeDamage(result.enemyDmg, tile.element, true, tile.enemyData, { enemyAttack: true })
        UI.shakeTile(tile.element)
        if (GameState.is(States.DEATH)) { _combatBusy = false; return }
      }

      setTimeout(() => {
        if (!run || !tile.enemyData || tile.enemyData._slain) {
          _combatBusy = false
          return
        }
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
        if (_stormProc) _triggerStormcallerLightning(tile, playerDmg)

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

  // Collect all revealed living enemies on the ACTIVE grid (main or sub-floor)
  const targets = []
  let immuneSkipped = 0
  for (const tile of _getActiveTiles()) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) { immuneSkipped++; continue }
      targets.push(tile)
    }
  }

  if (targets.length === 0) {
    UI.setMessage(immuneSkipped ? 'No valid targets — Gnomes are immune to abilities!' : 'No enemies to Slam!', true)
    return
  }

  const savedEngagement = _suspendCombatEngagementForMultiTargetAbility()

  // Spend mana
  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true; _combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  const slamDmg = _scaleOutgoingDamageToEnemy(_slamDamagePerTarget())
  const immuneNote = immuneSkipped ? ` (${immuneSkipped} immune)` : ''
  UI.setMessage(`💥 Slam! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} struck for ${slamDmg} each!${immuneNote}`)

  // Stagger slash effects across targets
  targets.forEach((target, i) => {
    setTimeout(() => {
      UI.spawnSlash(target.element)
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - slamDmg)
      UI.spawnFloat(target.element, `💥 ${slamDmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        _gainGold(target.enemyData.goldDrop ? _rand(...target.enemyData.goldDrop) : 1, target.element, true)
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
    _restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, targets.length * 120 + 400)
}

function abilitySlotAAction() {
  if (_charKey() === 'ranger') ricochetAction()
  else if (_charKey() === 'engineer') constructTurretAction()
  else if (_charKey() === 'mage') chainLightningAction()
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

  const targets = ordered.filter(t => t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune)
  const immuneCount = ordered.filter(t => t.enemyData && !t.enemyData._slain && t.enemyData.spellImmune).length
  if (targets.length === 0) {
    _cancelRicochetMode()
    UI.setMessage(immuneCount > 0 ? '🛡️ All selected enemies are immune to Ricochet!' : 'Ricochet — no valid targets left.', true)
    return
  }

  const savedEngagement = _suspendCombatEngagementForMultiTargetAbility()
  _cancelRicochetMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true; _combatBusySetAt = Date.now()
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
        _gainGold(target.enemyData.goldDrop ? _rand(...target.enemyData.goldDrop) : 1, target.element, true)
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
    _restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, doneMs)
}

// ── Mage: Chain Lightning ─────────────────────────────────────

/** Per-zap damage for Chain Lightning: equal across bounces, scaled by mage mastery. */
function _chainLightningDamagePerZap() {
  const avg  = _avgMeleeDamage()
  const unit = Math.max(1, Math.round(avg * CONFIG.ability.ricochetUnitMult))
  const mult = _mageActiveDamageMult('chain-lightning')
  return Math.max(1, Math.round(unit * 1.5 * mult))
}

function getChainLightningBreakdown() {
  if (!run || !run.player?.isMage) return null
  const avg  = _avgMeleeDamage()
  const unit = Math.max(1, Math.round(avg * CONFIG.ability.ricochetUnitMult))
  const mult = _mageActiveDamageMult('chain-lightning')
  const perZap = Math.max(1, Math.round(unit * 1.5 * mult))
  const stacks = run.player.mageActiveStacks?.['chain-lightning'] ?? 0
  return { avgMelee: avg, unit, mult, stacks, perZap, maxZaps: 3 }
}

function chainLightningAction() {
  if (!_isMageActiveUnlocked('chain-lightning')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(MAGE_UPGRADES['chain-lightning'].manaCost + _tearyExtraCost())

  if (!_chainLightningSelecting) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Chain Lightning!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelTelekineticThrowMode()
    _chainLightningSelecting = true
    UI.setChainLightningActive(true)
    UI.setGridChainLightningMode(true)
    UI.setMessage('⚡ Chain Lightning — tap a revealed enemy. The bolt arcs to 2 more at random.')
    return
  }

  _cancelChainLightningMode()
  UI.setMessage('Chain Lightning cancelled.')
}

/** Pick `count` distinct random entries from `pool` (returns a new array). */
function _pickRandomDistinct(pool, count) {
  const a = pool.slice()
  const out = []
  while (a.length > 0 && out.length < count) {
    const idx = Math.floor(Math.random() * a.length)
    out.push(a.splice(idx, 1)[0])
  }
  return out
}

function _executeChainLightning(primary) {
  if (!primary?.enemyData || primary.enemyData._slain) {
    UI.setMessage('Chain Lightning — no valid primary target.', true)
    _cancelChainLightningMode()
    return
  }
  if (primary.enemyData.spellImmune) {
    UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
    return
  }
  const cost = _stillWaterManaCost(MAGE_UPGRADES['chain-lightning'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Chain Lightning!', true)
    return
  }

  // Gather random jump candidates — revealed living non-immune enemies other than the primary.
  const candidates = _getActiveTiles().filter(t =>
    t.revealed &&
    t.enemyData &&
    !t.enemyData._slain &&
    !t.enemyData.spellImmune &&
    !(t.row === primary.row && t.col === primary.col),
  )
  const jumps = _pickRandomDistinct(candidates, 2)
  const targets = [primary, ...jumps]

  const savedEngagement = _suspendCombatEngagementForMultiTargetAbility()
  _cancelChainLightningMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const perZap = _chainLightningDamagePerZap()
  _combatBusy = true; _combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  UI.setMessage(`⚡ Chain Lightning — ${targets.length} zap${targets.length > 1 ? 's' : ''} for ${perZap} each.`)

  targets.forEach((target, i) => {
    const dmg = _scaleOutgoingDamageToEnemy(perZap)
    setTimeout(() => {
      if (!target.enemyData || target.enemyData._slain) return
      const fromEl = i === 0
        ? document.getElementById('hud-portrait')
        : targets[i - 1]?.element
      UI.spawnZap(fromEl, target.element)
      EventBus.emit('audio:play', { sfx: 'zap' })
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - dmg)
      _checkOnionLayer(target)
      UI.spawnFloat(target.element, `⚡ ${dmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        _gainGold(target.enemyData.goldDrop ? _rand(...target.enemyData.goldDrop) : 1, target.element, true)
        _gainXP(target.enemyData.xpDrop ?? 0, target.element)
        _endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 140)
  })

  const doneMs = targets.length * 140 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
    _restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, doneMs)
}

// ── Mage: Telekinetic Throw ───────────────────────────────────

function _telekineticThrowDamage() {
  const avg  = _avgMeleeDamage()
  const mult = _mageActiveDamageMult('telekinetic-throw')
  return Math.max(1, Math.round(avg * 3 * mult))
}

function getTelekineticThrowBreakdown() {
  if (!run || !run.player?.isMage) return null
  const avg  = _avgMeleeDamage()
  const mult = _mageActiveDamageMult('telekinetic-throw')
  const dmg  = Math.max(1, Math.round(avg * 3 * mult))
  const stacks = run.player.mageActiveStacks?.['telekinetic-throw'] ?? 0
  return { avgMelee: avg, mult, stacks, damage: dmg }
}

/** True if `tile` is a safe destination for Telekinetic Throw — revealed empty, no content. */
function _isTelekineticThrowDestination(tile) {
  if (!tile) return false
  if (!tile.revealed) return false
  if (tile.locked) return false
  if (tile.type !== 'empty') return false
  if (tile.enemyData) return false
  if (tile.itemData) return false
  if (tile.chestReady || tile.chestLooted) return false
  // Turret tile: guard via run.turret coordinates on main grid only.
  if (!_isInSubFloor() && run?.turret && run.turret.hp > 0 &&
      run.turret.row === tile.row && run.turret.col === tile.col) return false
  return true
}

/** True if `tile` holds a valid TK Throw pickup target — revealed living non-boss non-immune. */
function _isTelekineticThrowEnemyTarget(tile) {
  if (!tile?.revealed) return false
  const e = tile.enemyData
  if (!e || e._slain) return false
  if (e.spellImmune) return false
  if (e.behaviour === 'boss' || tile.type === 'boss') return false
  return true
}

function telekineticThrowAction() {
  if (!_isMageActiveUnlocked('telekinetic-throw')) return
  if (_combatBusy) return
  const cost = _stillWaterManaCost(MAGE_UPGRADES['telekinetic-throw'].manaCost + _tearyExtraCost())

  if (_telekineticThrowStep === 0) {
    if (run.player.mana < cost) {
      UI.setMessage('Not enough mana for Telekinetic Throw!', true)
      return
    }
    _cancelSpellLanternBlindingForRicochet()
    _cancelChainLightningMode()
    _telekineticThrowStep = 1
    _telekineticEnemyTile = null
    UI.setTelekineticThrowActive(true)
    UI.setGridTelekineticThrowMode('enemy')
    UI.setMessage('🌀 Telekinetic Throw — tap an enemy to grab (bosses & spell-immune excluded).')
    return
  }

  _cancelTelekineticThrowMode()
  UI.setMessage('Telekinetic Throw cancelled.')
}

function _executeTelekineticThrow(originTile, destTile) {
  if (!_isTelekineticThrowEnemyTarget(originTile)) {
    UI.setMessage('🛡️ Not a valid target anymore.', true)
    _cancelTelekineticThrowMode()
    return
  }
  if (!_isTelekineticThrowDestination(destTile)) {
    UI.setMessage('That tile is no longer a valid landing spot.', true)
    return
  }
  if (originTile === destTile) {
    UI.setMessage('Pick a different landing tile.', true)
    return
  }

  const cost = _stillWaterManaCost(MAGE_UPGRADES['telekinetic-throw'].manaCost + _tearyExtraCost())
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Telekinetic Throw!', true)
    return
  }

  _cancelTelekineticThrowMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  // Lift animation on origin, then move + slam on destination.
  UI.spawnFloat(originTile.element, '🌀 Lifted!', 'mana')
  UI.shakeTile(originTile.element)

  const lifted = originTile.enemyData
  const liftedType = originTile.type

  // Clear origin so it renders as a plain revealed empty.
  originTile.enemyData = null
  originTile.type = 'empty'
  originTile.revealed = true
  originTile.locked = false
  originTile.chestReady = false
  originTile.chestLooted = false
  originTile.itemData = null

  // Put the enemy on the destination tile. Keep destination as revealed so
  // the next melee / spell interaction works like any revealed enemy tile.
  destTile.type = liftedType
  destTile.enemyData = lifted
  destTile.revealed = true
  destTile.locked = false

  _patchActiveTileDom(originTile.row, originTile.col)
  _patchActiveTileDom(destTile.row, destTile.col)

  // Recompute global locks — an adjacent tile may still be locked by another enemy,
  // so naive unlockAdjacent around the origin would be wrong (leaves stale red X's).
  if (!_isInSubFloor()) {
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  } else {
    // Sub-floor: clear locks for revealed tiles, then re-lock around living non-archer enemies.
    _recomputeSubFloorEnemyLocks()
  }

  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  _syncGridDomClassesFromModel()

  // Slam impact — shockwave + audio, then damage.
  _combatBusy = true; _combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  const dmg = _scaleOutgoingDamageToEnemy(_telekineticThrowDamage())
  UI.setMessage(`🌀 Telekinetic Throw — slammed for ${dmg} damage!`)
  setTimeout(() => {
    if (!destTile.enemyData || destTile.enemyData._slain) return
    EventBus.emit('audio:play', { sfx: 'telekineticSlam' })
    UI.spawnSlamRing(destTile.element)
    UI.shakeTile(destTile.element)
    destTile.enemyData.currentHP = Math.max(0, destTile.enemyData.currentHP - dmg)
    _checkOnionLayer(destTile)
    UI.spawnFloat(destTile.element, `🌀 ${dmg}`, 'damage')
    if (destTile.enemyData.currentHP <= 0) {
      _gainGold(destTile.enemyData.goldDrop ? _rand(...destTile.enemyData.goldDrop) : 1, destTile.element, true)
      _gainXP(destTile.enemyData.xpDrop ?? 0, destTile.element)
      _endCombatVictory(destTile)
      if (!_isInSubFloor()) {
        TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
      } else {
        _recomputeSubFloorEnemyLocks()
      }
    } else {
      UI.updateEnemyHP(destTile.element, destTile.enemyData.currentHP)
    }
  }, 160)

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    _combatBusy = false
  }, 600)
  _saveActiveRun()
}

/** Re-render a single tile's DOM in-place from its model. For sub-floors we re-render the whole grid. */
function _patchActiveTileDom(row, col) {
  if (_isInSubFloor()) {
    const sf = run?.subFloor
    if (!sf) return
    // Sub-floor tiles don't support a single-tile patch, so rebuild the whole grid.
    UI.showSubFloor(sf, _onSubFloorTileTap, _onSubFloorTileHold)
    return
  }
  const gridEl = UI.getGridEl?.() ?? document.getElementById('grid')
  if (!gridEl) return
  TileEngine.patchMainGridTileAt(row, col, gridEl, onTileTap, onTileHold)
}

/** Sub-floor local version of recomputeAllEnemyLocks — mirrors TileEngine behaviour for sf.tiles. */
function _recomputeSubFloorEnemyLocks() {
  const sf = run?.subFloor
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
  const grid = _getActiveTileRows()
  if (!grid?.length) return []
  const rows = grid.length
  const cols = grid[0].length
  const out = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = centerRow + dr
      const c = centerCol + dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      const t = grid[r]?.[c]
      if (t) out.push(t)
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

  const savedEngagement = _suspendCombatEngagementForMultiTargetAbility()

  _cancelArrowBarrageMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const dmg = _scaleOutgoingDamageToEnemy(_tripleVolleyDamagePerEnemy())
  _combatBusy = true; _combatBusySetAt = Date.now()
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
      const t = target
      if (!t?.enemyData || t.enemyData._slain) return
      UI.spawnArrow(t.element)
      UI.shakeTile(t.element)
      t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - dmg)
      _checkOnionLayer(t)
      UI.spawnFloat(t.element, `🏹 ${dmg}`, 'xp')
      if (t.enemyData.currentHP <= 0) {
        _gainGold(t.enemyData.goldDrop ? _rand(...t.enemyData.goldDrop) : 1, t.element, true)
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
    _restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
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

  if (!_canAttackEnemy(tile)) {
    _cancelPoisonArrowShotMode()
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

  const row = tile.row
  const col = tile.col
  _cancelPoisonArrowShotMode()

  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  const initial = _scaleOutgoingDamageToEnemy(_poisonArrowUnitDamage())
  _combatBusy = true; _combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')

  const t0 = _getActiveTileAt(row, col)
  if (!t0?.enemyData || t0.enemyData._slain) {
    UI.setPortraitAnim('idle')
    _combatBusy = false
    return
  }

  _setCombatEngagement(t0)

  UI.spawnArrow(t0.element)
  EventBus.emit('audio:play', { sfx: 'arrowShot' })
  UI.shakeTile(t0.element)
  t0.enemyData.currentHP = Math.max(0, t0.enemyData.currentHP - initial)
  UI.spawnFloat(t0.element, `☠️ ${initial}`, 'xp')

  if (t0.enemyData.currentHP <= 0) {
    _gainGold(t0.enemyData.goldDrop ? _rand(...t0.enemyData.goldDrop) : 1, t0.element, true)
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
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

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
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }

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
  if (_isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
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
    _die(null, { deathCause: 'hourglass' })
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

  if (!_canAttackEnemy(tile)) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  _setCombatEngagement(tile)

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

  if (!_canAttackEnemy(tile)) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  _setCombatEngagement(tile)

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

  // Mushroom Harvester taunt: redirect spell to a random visible Harvester
  tile = _resolveTauntTarget(tile)

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  // Ogre: 10% shield block — cancels spell entirely
  if (_checkShieldBlock(tile)) return

  if (!_canAttackEnemy(tile)) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  _setCombatEngagement(tile)

  const result = CombatResolver.resolveSpell(run.player, tile.enemyData)

  let spellDmg = result.damage
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) spellDmg = Math.round(spellDmg * 2)
  if (run.player.beastBonus  && isBeast)  spellDmg = Math.round(spellDmg * 2)
  // Mirror of Vanity: +20% current HP as flat bonus
  if (run.player.inventory.some(e => e.id === 'mirror-of-vanity')) {
    spellDmg += Math.max(1, Math.floor(run.player.hp * 0.2))
  }
  // The Traded Codex: spell scales with missing HP (1× full, ~3× near death)
  if (run.player.inventory.some(e => e.id === 'traded-codex') && run.player.maxHp > 0) {
    const missingRatio = 1 - (run.player.hp / run.player.maxHp)
    const codexMult = 1 + 2 * missingRatio
    spellDmg = Math.round(spellDmg * codexMult)
  }
  spellDmg = _scaleOutgoingDamageToEnemy(spellDmg)

  UI.setPortraitAnim('attack')
  run.player.mana -= effectiveCost
  // Witching Stone: each spell costs 1 additional HP
  if (run.player.inventory.some(e => e.id === 'witching-stone')) {
    run.player.hp = Math.max(0, run.player.hp - 1)
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🔮 -1 HP', 'damage')
    if (run.player.hp <= 0) { _die(null, { deathCause: 'witching_stone' }); return }
  }
  _markStillWaterAbilityUsed()
  if (run.player.inventory.some(e => e.id === 'surge-pearl') && Math.random() < 0.20) {
    const refund = Math.floor(effectiveCost / 2)
    if (refund > 0) {
      run.player.mana = Math.min(run.player.maxMana, run.player.mana + refund)
      UI.spawnFloat(document.getElementById('hud-portrait'), `⚪ +${refund} MP`, 'mana')
    }
  }
  if (run.player.inventory.some(e => e.id === 'resonance-core') && Math.random() < 0.30) {
    const refund = effectiveCost
    if (refund > 0) {
      run.player.mana = Math.min(run.player.maxMana, run.player.mana + refund)
      UI.spawnFloat(document.getElementById('hud-portrait'), `🔮 +${refund} MP`, 'mana')
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
    const spellGoldDrop = tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! +${spellGoldDrop} gold.`)
    _gainGold(spellGoldDrop, tile.element, true)
    _gainXP(result.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
  } else {
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! Enemy has ${tile.enemyData.currentHP} HP left.`)
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
  }
}

function _endCombatVictory(tile) {
  // Sub-floor kill path — bypass main-grid-specific cleanup (boss exit tile,
  // recompute adjacency locks on _grid, threat clue refresh, floor-cleared
  // check). Handle sub-floor-appropriate cleanup instead and still apply
  // on-kill trinket effects below by falling through? No — on-kill trinket
  // effects reference `TileEngine.getOrthogonalTiles`, which is main-grid.
  // For sub-floors we use a focused subset.
  if (_isInSubFloor()) {
    tile.enemyData._slain = true
    UI.markSubFloorTileSlain(tile)
    _sfUnlockAdjacent(tile)
    // Boss vault: unlock rewards on boss death
    if (tile.isBossVaultBoss) {
      const sf = run.subFloor
      for (const row of sf.tiles) for (const t of row) {
        if (t && t.locked) {
          t.locked = false; t.reachable = true
          UI.unlockSubFloorTile(t); UI.markSubFloorTileReachable(t)
        }
      }
      UI.setSubFloorMessage('The boss falls! The vault trembles — riches await.')
    }
    // On-kill heal / vampire-fang trinkets still apply in sub-floor
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
    EventBus.emit('audio:play', { sfx: 'gold' })
    EventBus.emit('combat:end', { outcome: 'victory' })
    return
  }

  tile.enemyData._slain = true
  _clearCombatEngagementForTile(tile)
  // Drowned Hulk: remove crew aura from all buffed enemies on death
  if (tile.enemyData.crewBuffAura) {
    UI.setMessage('⚓ The Drowned Hulk falls — its crew weakens!')
    _removeHulkBuffFromAll()
  }
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  // Paladin Sense Evil: if the slain enemy was the sensed tile, pick a new one
  if (_charKey() === 'warrior' && run.senseEvilTile && run.senseEvilTile.row === tile.row && run.senseEvilTile.col === tile.col) {
    run.senseEvilTile = null
    _paladinSenseEvilPick()
  }
  // Archer goblin spawns pre-revealed without markReachable (see _spawnArcherGoblin),
  // so its neighbors stay unreachable until the player paths adjacent. On defeat,
  // propagate reachability from the archer tile so surrounding tiles become tappable.
  if (tile.enemyData?.enemyId === 'archer_goblin') {
    TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  }
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
  if (run.player.inventory.some(e => e.id === 'sanguine-covenant')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 2)
    UI.spawnFloat(tile.element, '⚗️ +2 HP', 'heal')
    UI.updateHP(run.player.hp, run.player.maxHp)
  }
  if (run.player.inventory.some(e => e.id === 'soul-candle') && Math.random() < 0.20) {
    run.player.mana = Math.min(run.player.maxMana, run.player.mana + 1)
    UI.spawnFloat(tile.element, '🕯️ +1 MP', 'mana')
    UI.updateMana(run.player.mana, run.player.maxMana)
  }
  if (run.player.inventory.some(e => e.id === 'temporal-wick') && Math.random() < 0.30) {
    run.player.mana = Math.min(run.player.maxMana, run.player.mana + 1)
    UI.spawnFloat(tile.element, '⏳ +1 MP', 'mana')
    UI.updateMana(run.player.mana, run.player.maxMana)
  }
  if (run.player.inventory.some(e => e.id === 'resonance-core')) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element) {
        const cat = _echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }
  // Deathmask: 25% chance next reveal is an instant kill
  if (!run.player.deathmaskPending && run.player.inventory.some(e => e.id === 'deathmask') && Math.random() < 0.25) {
    run.player.deathmaskPending = true
    UI.spawnFloat(tile.element, '💀 Marked!', 'xp')
  }
  if (run.player.inventory.some(e => e.id === 'greed-tooth')) {
    _gainGold(1, tile.element, true)
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

  // Eagle Eye: grant free flip (any tile, ignores adjacency)
  if (run.player.inventory.some(e => e.id === 'eagle-eye')) {
    run.player.eagleEyeFreeFlip = true
    UI.spawnFloat(tile.element, '🦅 Free flip!', 'xp')
  }
  // Soulbound Blade: +0.1 permanent damage per kill
  if (run.player.inventory.some(e => e.id === 'soulbound-blade')) {
    run.player.soulboundBonus = (run.player.soulboundBonus ?? 0) + 0.1
    if (Math.floor(run.player.soulboundBonus) > Math.floor(run.player.soulboundBonus - 0.1)) {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
      UI.spawnFloat(tile.element, '⚔️ +1 dmg!', 'xp')
    }
  }

  EventBus.emit('audio:play', { sfx: 'gold' })
  EventBus.emit('combat:end', { outcome: 'victory' })
  TileEngine.refreshAllThreatClueDisplays()
  _checkFloorCleared()
  _maybeOfferDeadlockEscape()
}

// ── Hasty Retreat ────────────────────────────────────────────

function doRetreat(reason = 'player') {
  if (!run) return

  if (GameState.is(States.NPC_INTERACT) && run.eventTile) {
    _closeEventSession(run.eventTile)
  }

  const hpAtRetreat = run?.player?.hp ?? null
  const goldBeforeRetreat = run?.player?.gold ?? null
  const pct      = run.player.retreatPercent ?? CONFIG.retreat.goldKeepPercent
  const keptGold = Math.floor(run.player.gold * pct)
  run.player.gold = keptGold
  UI.updateGold(keptGold)
  UI.hideRetreat()
  UI.hideActionPanel()
  UI.hideEventOverlays()
  UI.setMessage(`You flee the dungeon, clutching ${keptGold} gold.`)
  EventBus.emit('run:retreat', { goldBanked: keptGold })

  const stats = _runStats()
  _finalizeRunTelemetry('retreat', {
    killerEnemyId: null,
    retreatReason: reason,
    hpAtRetreat,
    goldBeforeRetreat,
  })
  const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'retreat')

  // End run immediately so UI/bots do not see an active run while waiting for the summary overlay.
  _clearActiveRun()
  run = null
  GameState.set(States.BETWEEN_RUNS)

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
      if (!run) return
      GameState.set(States.BOOT)
      _startFloor()
    }, null)
    return
  }
  _nextFloor()
}

function _confirmRope(tile) {
  if (tile.type !== 'rope' || tile.ropeResolved) return
  UI.showRopeModal(
    () => {
      tile.ropeResolved = true
      tile.element?.classList.remove('rope-pending')
      const stats = _runStats()
      _finalizeRunTelemetry('escape', { killerEnemyId: null, retreatReason: 'rope' })
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
  if (!run) return rawAmount
  const scaled = Math.round(rawAmount * (run.player.damageTakenMult ?? 1))
  const maskReduction   = run.player.inventory.some(e => e.id === 'plague-mask')    ? 1 : 0
  const bladeReduction  = run.player.inventory.some(e => e.id === 'infected-blade') ? 1 : 0
  return Math.max(1, scaled - (run.player.damageReduction ?? 0) - maskReduction - bladeReduction)
}

function _takeDamage(amount, tileEl, skipPortraitAnim = false, killerData = null, opts = {}) {
  if (!run) return
  const enemyAttack = opts.enemyAttack === true
  if (enemyAttack && _charKey() === 'engineer' && run.turret?.hp > 0) {
    _damageTurretFromEnemyHit(amount, tileEl)
    return
  }
  if (_save.settings.cheats?.godMode) return
  // Shield Shard: absorb next hit entirely
  if (run?.player?.shieldShard) {
    run.player.shieldShard = false
    UI.spawnFloat(tileEl, '🛡️ Blocked!', 'heal')
    return
  }
  if (run?.player?.inventory?.some(e => e.id === 'devils-gambit') && Math.random() < 0.05) {
    UI.spawnFloat(tileEl, '🃏 Gambit!', 'heal')
    return
  }
  if (run?.player?.inventory?.some(e => e.id === 'lucky-rabbit-foot') && Math.random() < 0.02) {
    UI.spawnFloat(tileEl, '🐰 Lucky!', 'heal')
    return
  }
  const effective = _computeEffectiveDamageTaken(amount)
  // Pauper's Crown: drain gold before HP
  if (run.player.inventory?.some(e => e.id === 'paupers-crown')) {
    const goldDrained = Math.min(run.player.gold, effective)
    run.player.gold  -= goldDrained
    UI.updateGold(run.player.gold)
    if (goldDrained > 0) UI.spawnFloat(tileEl, `-${goldDrained}🪙`, 'damage')
    const hpDmg = effective - goldDrained
    if (hpDmg <= 0) return
    run.player.hp = Math.max(0, run.player.hp - hpDmg)
    if (run.telemetry && hpDmg > 0) {
      run.telemetry.totalDamageTaken += hpDmg
      _telemetryBumpDamageTaken(run.floor, hpDmg)
    }
    UI.spawnFloat(tileEl, `-${hpDmg} HP`, 'damage')
  } else {
    run.player.hp = Math.max(0, run.player.hp - effective)
    if (run.telemetry && effective > 0) {
      run.telemetry.totalDamageTaken += effective
      _telemetryBumpDamageTaken(run.floor, effective)
    }
    UI.spawnFloat(tileEl, `-${effective} HP`, 'damage')
  }
  UI.updateHP(run.player.hp, run.player.maxHp)
  _hapticVibrate([50, 40, 80])
  EventBus.emit('player:hpChange', { amount: -effective, newHP: run.player.hp })
  // Resurrection Stone: prevent death once, restore half max HP
  if (run.player.hp <= 0 && !run.player.resurrectionUsed &&
      run.player.inventory?.some(e => e.id === 'resurrection-stone')) {
    run.player.resurrectionUsed = true
    run.player.hp = Math.max(1, Math.floor(run.player.maxHp / 2))
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(tileEl, '💎 Resurrected!', 'heal')
    UI.setMessage('💎 The Resurrection Stone shatters — you cling to life!')
    // Remove the stone from inventory
    const inv = run.player.inventory
    const idx = inv.findIndex(e => e.id === 'resurrection-stone')
    if (idx !== -1) inv.splice(idx, 1)
    UI.renderBackpack(inv)
    return
  }
  if (run.player.hp <= 0) { _die(killerData); return }
  // Thorn Wrap / Inferno Barbs: reflect damage to attacker
  const hasThorn  = run.player.inventory.some(e => e.id === 'thorn-wrap')
  const hasInferno = run.player.inventory.some(e => e.id === 'inferno-barbs')
  if (killerData && !killerData._slain && (hasThorn || hasInferno)) {
    const reflectDmg = hasInferno ? 2 : 1
    killerData.currentHP = Math.max(0, killerData.currentHP - reflectDmg)
    UI.spawnFloat(tileEl, hasInferno ? `🌋 Barbs! −${reflectDmg}` : '🌿 Thorn!', 'heal')
    if (hasInferno) _applyBurnHit(1)   // Inferno Barbs also burns attacker
    if (killerData.currentHP <= 0) {
      const combatTile = run.activeCombatTile
      if (combatTile) {
        _gainGold(combatTile.enemyData?.goldDrop ? _rand(...combatTile.enemyData.goldDrop) : 1, combatTile.element, true)
        _gainXP(combatTile.enemyData?.xpDrop ?? 0, combatTile.element)
        _endCombatVictory(combatTile)
      }
    } else if (run.activeCombatTile) {
      UI.updateEnemyHP(run.activeCombatTile.element, killerData.currentHP)
    }
  }
  if (!skipPortraitAnim) {
    UI.setPortraitAnim('hit')
    setTimeout(() => UI.setPortraitAnim('idle'), 800)
  }
}

function _gainGold(amount, tileEl, fromEnemy = false) {
  if (!run) return
  let actual = amount
  if (fromEnemy) {
    if (run.player.inventory.some(e => e.id === 'misers-pouch')) actual += 1
    if (run.player.inventory.some(e => e.id === 'gamblers-mark')) actual = Math.random() < 0.5 ? 0 : actual * 2
    if (run.player.inventory.some(e => e.id === 'devils-gambit') && Math.random() < 0.20) actual *= 2
    if (run.player.inventory.some(e => e.id === 'vault-key')) actual += 2
    actual = Math.round(actual)
  }
  // Vault Key: auto-bank 15% of all earned gold to persistent gold
  if (run.player.inventory.some(e => e.id === 'vault-key') && actual > 0) {
    const bank = Math.floor(actual * 0.15)
    if (bank > 0) {
      _save.persistentGold = (_save.persistentGold ?? 0) + bank
      UI.spawnFloat(tileEl, `🗝️ +${bank} banked`, 'gold')
    }
  }
  // Philosopher's Coin: all gold × 5
  if (run.player.inventory.some(e => e.id === 'philosophers-coin')) actual *= 5
  if (actual <= 0) {
    UI.spawnFloat(tileEl, '♠️ No gold!', 'damage')
    return
  }
  run.player.gold += actual
  UI.spawnFloat(tileEl, `+${actual}🪙`, 'gold')
  UI.updateGold(run.player.gold)
  EventBus.emit('player:goldChange', { amount: actual, newTotal: run.player.gold })
}

/** +mana on successful melee strike (not on shield block — see fightAction). Mana ring: 10% double. */
function _gainManaFromMeleeHit(tileEl) {
  if (!run?.player) return
  const add = CONFIG.player.manaPerMeleeHit ?? 0
  if (add <= 0 || run.player.mana >= run.player.maxMana) return
  const hasManaRing = run.player.inventory.some(e => e.id === 'mana-ring')
  const gain = (hasManaRing && Math.random() < 0.10) ? add * 2 : add
  run.player.mana = Math.min(run.player.maxMana, run.player.mana + gain)
  if (hasManaRing && gain > add) {
    UI.spawnFloat(tileEl, `+${gain}🔵`, 'mana')
  }
  UI.updateMana(run.player.mana, run.player.maxMana)
}

function _gainXP(amount, tileEl) {
  if (!run) return
  run.player.xp += amount
  const needed = _xpNeeded()
  if (run.player.xp >= needed) {
    if (_shouldDeferLevelUpDueToNpc()) {
      UI.updateXP(run.player.xp, _xpNeeded())
      return
    }
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
  if (c === 'ranger') return _save.ranger?.upgrades ?? []
  if (c === 'engineer') return _save.engineer?.upgrades ?? []
  if (c === 'mage') return _save.mage?.upgrades ?? []
  if (c === 'vampire') return _save.vampire?.upgrades ?? []
  return _save.warrior?.upgrades ?? []
}

/** Ability-pick level-up uses GameState.LEVEL_UP, which is invalid during NPC events — defer until back on the floor. */
function _shouldDeferLevelUpDueToNpc() {
  if (!GameState.is(States.NPC_INTERACT)) return false
  const choices = ProgressionSystem.getChoices(run.player, _charKey(), _metaUnlockedForLevelUp())
  return choices.length > 0
}

/**
 * Apply deferred XP level-ups once we're in FLOOR_EXPLORE (e.g. after closing a story / merchant overlay).
 * Handles multiple stacked levels; stops when an ability-pick overlay is shown.
 */
function _flushDeferredLevelUpXp() {
  if (!run || GameState.is(States.NPC_INTERACT)) return
  const floatEl = () => document.getElementById('hud-portrait')
  while (run.player.xp >= _xpNeeded()) {
    if (_shouldDeferLevelUpDueToNpc()) break
    run.player.xp -= _xpNeeded()
    run.player.level++
    UI.spawnFloat(floatEl(), `⬆️ Lv ${run.player.level}!`, 'xp')
    EventBus.emit('player:levelup', { newLevel: run.player.level })
    EventBus.emit('audio:play', { sfx: 'levelup' })
    const choices = ProgressionSystem.getChoices(run.player, _charKey(), _metaUnlockedForLevelUp())
    if (choices.length === 0) {
      _triggerLevelUp()
      continue
    }
    _triggerLevelUp()
    break
  }
  UI.updateXP(run.player.xp, _xpNeeded())
}

function _triggerLevelUp() {
  const char     = _charKey()
  const count    = run.player.extraAbilityChoice ? 4 : 3
  const descs    = ProgressionSystem.getChoices(run.player, char, _metaUnlockedForLevelUp(), count)
  if (descs.length === 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 10)
    UI.updateHP(run.player.hp, run.player.maxHp)
    run.levelUpLog.push({
      level:     run.player.level,
      abilityId: null,
      name:      '+10 HP (all choices mastered)',
      icon:      '❤️',
    })
    _appendLevelSnapshot('levelUpMasteryHp')
    UI.setMessage(`Level ${run.player.level}! Fully mastered. (+10 HP)`)
    return
  }

  GameState.transition(States.LEVEL_UP)

  // First-pick mode: every choice is a `kind:'active'` and player.level just hit 2.
  const isFirstActivePick = run.player.level === 2 && descs.every(d => d.kind === 'active')
  const subtitle = isFirstActivePick
    ? 'Choose your first active ability!'
    : 'Choose an ability'

  const choiceData = descs.map(d => {
    const def = ProgressionSystem.getAbilityDef(d.id, char) ?? {}
    const data = { id: d.id, ...def }
    if (d.kind === 'coins') {
      data.name = 'Coin Pouch'
      data.desc = `+${run.floor} gold (filler — pool was empty).`
    }
    if (d.kind === 'active') data.tag = 'NEW ACTIVE'
    return data
  })

    UI.setLevelUpSubtitle(subtitle)
    UI.showLevelUpOverlay(choiceData, (abilityId) => {
      ProgressionSystem.applyAbility(abilityId, run.player, char, { floor: run.floor })
      const def = ProgressionSystem.getAbilityDef(abilityId, char)
      run.levelUpLog.push({
        level:     run.player.level,
        abilityId,
        name:      def?.name ?? abilityId,
        icon:      def?.icon ?? '✨',
      })
      _appendLevelSnapshot('levelUp')
      UI.hideLevelUpOverlay()
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.updateGold(run.player.gold)
    {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
    }
    UI.setMessage(`${def?.name ?? abilityId} acquired! Level ${run.player.level}.`)
    if (char === 'ranger')         _refreshRangerActiveHud()
    else if (char === 'engineer')  _refreshEngineerHud()
    else if (char === 'mage')      _refreshMageHud()
    else if (char === 'warrior')   {
      UI.setSlamBtn(_isActiveUnlocked('slam', 'warrior'), WARRIOR_UPGRADES.slam.manaCost)
      UI.setBlindingLightBtn(_isActiveUnlocked('blinding-light', 'warrior'), WARRIOR_UPGRADES['blinding-light'].manaCost)
      UI.setDivineLightBtn(_isActiveUnlocked('divine-light', 'warrior'), WARRIOR_UPGRADES['divine-light'].manaCost)
    }
    GameState.transition(States.FLOOR_EXPLORE)
    _flushDeferredLevelUpXp()
  })
}

function _xpNeeded() {
  return CONFIG.xp.levelUpAt * run.player.level
}

function _playerDamageRange(player) {
  const bonus       = player.damageBonus ?? 0
  const maskPenalty = player.inventory?.some(e => e.id === 'plague-mask')    ? 1 : 0
  const collarBonus = player.inventory?.some(e => e.id === 'spiked-collar')  ? 3 : 0
  const soulBonus   = Math.floor(player.soulboundBonus ?? 0)
  const hasRazor    = player.inventory?.some(e => e.id === 'razors-edge')
  if (player.isRanger) {
    const [lo, hi] = RANGER_BASE.damage
    const max = Math.max(1, hi + bonus + collarBonus + soulBonus - maskPenalty)
    return hasRazor
      ? [max, max]
      : [Math.max(1, lo + bonus + collarBonus + soulBonus - maskPenalty), max]
  }
  if (player.isVampire) {
    const b = VAMPIRE_BASE.damage + bonus + collarBonus + soulBonus - maskPenalty
    const max = Math.max(1, b)
    return hasRazor ? [max, max] : [max, max]
  }
  const base = CONFIG.player.baseDamage
  const b = Array.isArray(base) ? base[0] : base
  const max = Math.max(1, b + bonus + collarBonus + soulBonus - maskPenalty)
  return [max, max]   // warrior is always fixed (same lo/hi), razor's edge is a no-op here but kept for clarity
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

function _die(killerData = null, opts = {}) {
  const explicitCause = opts.deathCause
  let resolved = killerData
  let killerInferred = false
  if (!resolved?.enemyId && run?.activeCombatTile?.enemyData) {
    const e = run.activeCombatTile.enemyData
    if (!e._slain) {
      resolved = e
      killerInferred = true
    }
  }

  _spellTargeting         = false
  _combatBusy             = false
  _clearAllCombatEngagement()
  _lanternTargeting       = false
  _spyglassTargeting      = false
  _blindingLightTargeting = false
  _divineLightSelecting   = false
  UI.setDivineLightActive(false)
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0); run.player.freezingHitStacks = 0; UI.setFreezingHit(0); run.player.burnStacks = 0; UI.setBurnOverlay(0); run.player.poisonStacks = 0; UI.setPlayerPoison(0); run.player.corruptionStacks = 0; if (run.player.corruptionBaseMaxHp) { run.player.maxHp = run.player.corruptionBaseMaxHp; run.player.corruptionBaseMaxHp = 0 } if (run.player.corruptionBaseMaxMana) { run.player.maxMana = run.player.corruptionBaseMaxMana; run.player.corruptionBaseMaxMana = 0 } UI.setCorruption(0) }
  const deathExtras = {
    killerEnemyId: resolved?.enemyId ?? null,
    killerLabel:   resolved?.label ?? null,
    killerIsBoss:  !!(resolved?.isBoss),
    hpAtDeath:     run?.player?.hp ?? 0,
  }
  if (explicitCause === 'witching_stone' && resolved?.enemyId) {
    // HP death from Witching Stone during combat — attribute killer, not the item.
  } else if (explicitCause) {
    deathExtras.deathCause = explicitCause
  } else if (!resolved?.enemyId) {
    deathExtras.deathCause = 'unknown'
  }
  if (killerInferred && !killerData?.enemyId) deathExtras.killerInferred = true
  _finalizeRunTelemetry('death', deathExtras)
  _clearActiveRun()
  UI.setPortraitAnim('death')
  GameState.transition(States.DEATH)
  UI.hideActionPanel()
  UI.hideRetreat()
  UI.hideEventOverlays()
  UI.setMessage('💀 You have perished in the depths...', true)
  EventBus.emit('audio:play', { sfx: 'death' })

  const stats = _runStats()
  const { xpEarned, goldBanked } = MetaProgression.endRun(_save, stats, 'death')
  EventBus.emit('player:death', { runStats: stats })

  // Build killer card data for the summary screen
  const killer = resolved ? _buildKillerCard(resolved) : null

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

function _appendLevelSnapshot(trigger) {
  if (!run?.telemetry || !run.player) return
  const [d0, d1] = _playerDamageRange(run.player)
  run.telemetry.levelSnapshots.push(
    buildLevelSnapshotRecord({
      trigger,
      floor: run.floor,
      player: run.player,
      xpToNext: _xpNeeded(),
      meleeDamageRange: [d0, d1],
    }),
  )
}

function _telemetryBumpDamageTaken(floor, amount) {
  if (!run?.telemetry || amount <= 0) return
  const k = String(floor)
  if (!run.telemetry.damageByFloor[k]) run.telemetry.damageByFloor[k] = { taken: 0, dealt: 0 }
  run.telemetry.damageByFloor[k].taken += amount
}

function _telemetryBumpDamageDealt(floor, amount) {
  if (!run?.telemetry || amount <= 0) return
  const k = String(floor)
  if (!run.telemetry.damageByFloor[k]) run.telemetry.damageByFloor[k] = { taken: 0, dealt: 0 }
  run.telemetry.damageByFloor[k].dealt += amount
}

function _appendFloorSnapshot(trigger) {
  if (!run?.telemetry) return
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
  const isBossFloor = CONFIG.bossFloors.includes(run.floor) && !run.atRest
  run.telemetry.floorSnapshots.push({
    at: Date.now(),
    trigger,
    floor: run.floor,
    atRest: !!run.atRest,
    isBossFloor,
    level: run.player.level,
    hp: run.player.hp,
    gold: run.player.gold,
    tilesRevealed: run.tilesRevealed,
    grid: { locked, unrevealedUnlocked, revealed, livingEnemies },
  })
}

function _buildRunEndSummary(outcomeType, extras = {}) {
  const rs = _runStats()
  const tel = run.telemetry
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

function _finalizeRunTelemetry(outcomeType, extras = {}) {
  if (!run?.telemetry) return
  run.telemetry.outcome = {
    type: outcomeType,
    endedAt: Date.now(),
    runStats: _runStats(),
    runEndSummary: _buildRunEndSummary(outcomeType, extras),
    ...extras,
  }
  _lastRunTelemetrySnapshot = {
    telemetry: JSON.parse(JSON.stringify(run.telemetry)),
    levelUpLog: (run.levelUpLog ?? []).slice(),
    runStats: _runStats(),
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

async function _addToBackpack(id) {
  const inv   = run.player.inventory
  const item  = ITEMS[id]
  if (!item) return
  // Philosopher's Coin: potions become gold instead
  if ((id === 'potion-red' || id === 'potion-blue') && inv.some(e => e.id === 'philosophers-coin')) {
    const goldAmt = id === 'potion-red' ? 3 : 5
    run.player.gold += goldAmt
    UI.updateGold(run.player.gold)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🥇 +${goldAmt}🪙`, 'gold')
    return
  }
  if (item.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    const existing = inv.find(e => e.id === id && e.qty < maxS)
    if (existing) {
      existing.qty++
      return
    }
  }
  // Full backpack — let the UI handle replace/trash flow; do NOT add the item yet
  if (inv.length >= BACKPACK_MAX_SLOTS) {
    EventBus.emit('backpack:full', { id })
    return
  }
  inv.push({ id, qty: 1 })
  // Trinket Codex: show discovery card first time this trinket is seen
  if (TrinketCodex.registerIfNew(_save, id)) {
    await SaveManager.save(_save).catch(() => {})
    await UI.showTrinketDiscovery(id)
  }
  // Blood Pact: apply on equip
  if (id === 'blood-pact') {
    run.player.damageBonus = (run.player.damageBonus ?? 0) + 2
    run.player.maxHp = Math.max(1, run.player.maxHp - 3)
    run.player.hp = Math.min(run.player.hp, run.player.maxHp)
    UI.updateHP(run.player.hp, run.player.maxHp)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 Pact!', 'damage')
  }
  // Forsaken Idol: halve max HP on equip
  if (id === 'forsaken-idol') {
    const halved = Math.max(1, Math.floor(run.player.maxHp / 2))
    run.player.maxHp = halved
    run.player.hp = Math.min(run.player.hp, halved)
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🗿 Max HP halved!', 'damage')
  }
  // Hollowed Acorn: +10 max mana on equip
  if (id === 'hollowed-acorn') {
    run.player.maxMana = (run.player.maxMana ?? CONFIG.player.maxMana) + 10
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🌰 +10 Mana!', 'mana')
  }
  // Sanguine Covenant: +3 dmg, halve max HP on equip
  if (id === 'sanguine-covenant') {
    run.player.damageBonus = (run.player.damageBonus ?? 0) + 3
    const halved = Math.max(1, Math.floor(run.player.maxHp / 2))
    run.player.maxHp = halved
    run.player.hp    = Math.min(run.player.hp, halved)
    UI.updateHP(run.player.hp, run.player.maxHp)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚗️ Covenant!', 'damage')
  }
  // Razor's Edge: −10 max HP on equip
  if (id === 'razors-edge') {
    run.player.maxHp = Math.max(1, run.player.maxHp - 10)
    run.player.hp    = Math.min(run.player.hp, run.player.maxHp)
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '💠 −10 Max HP', 'damage')
  }
  // Honed Edge: +1 permanent attack damage
  if (id === 'honed-edge') {
    run.player.damageBonus = (run.player.damageBonus ?? 0) + 1
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚔️ +1 ATK', 'xp')
  }
}

function _canAddToBackpack(id) {
  const inv  = run.player.inventory
  const item = ITEMS[id]
  if (!item) return false
  if (item.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    if (inv.some(e => e.id === id && e.qty < maxS)) return true
  }
  return inv.length < BACKPACK_MAX_SLOTS
}

function _triggerStormcallerLightning(sourceTile, playerDmg) {
  const grid = TileEngine.getGrid()
  const lightningDmg = Math.max(1, Math.floor(playerDmg * 0.2))
  let victims = 0
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t !== sourceTile) {
        t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - lightningDmg)
        UI.spawnFloat(t.element, `⚡ ${lightningDmg}`, 'damage')
        UI.updateEnemyHP(t.element, t.enemyData.currentHP)
        victims++
        if (t.enemyData.currentHP <= 0) {
          _gainGold(t.enemyData.goldDrop ? _rand(...t.enemyData.goldDrop) : 1, t.element, true)
          _gainXP(t.enemyData.xpDrop ?? 0, t.element)
          _endCombatVictory(t)
        }
      }
    }
  }
  if (victims > 0) {
    UI.spawnFloat(sourceTile.element, '⚡ Storm!', 'xp')
    EventBus.emit('audio:play', { sfx: 'spell' })
  }
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
    const amt = loot.amount ?? _rand(...CONFIG.chest.goldDrop)
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
  if (effect.type === 'temporal-wick') {
    if (!run._hourglassSnapshot) { UI.setMessage('Nothing to rewind yet.', true); return }
    if (_combatBusy) { UI.setMessage('Not while combat is resolving.', true); return }
    if (_isCombatCommitmentLocked()) { UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true); return }
    if (GameState.is(States.LEVEL_UP)) { UI.setMessage('Cannot rewind during level-up.', true); return }
    const p = run.player
    if (p.gold < 1) { UI.setMessage('You need 1 gold to use Temporal Wick.', true); return }
    _restoreHourglassSnapshot(run._hourglassSnapshot)
    _spyglassTargeting = false; _lanternTargeting = false
    UI.setLanternTargeting(false)
    p.mana = 0; p.hp -= 1; p.gold -= 1
    const wickHeal = Math.max(1, Math.floor(p.maxHp * 0.15))
    p.hp = Math.min(p.maxHp, p.hp + wickHeal)
    UI.updateMana(p.mana, p.maxMana)
    UI.updateHP(p.hp, p.maxHp)
    UI.updateGold(p.gold)
    if (p.hp <= 0) { _die(null, { deathCause: 'temporal_wick' }); return }
    UI.setMessage(`⏳ The wick flickers — your last step is undone. +${wickHeal} HP restored.`)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'navigators-chart') {
    if (_isCombatCommitmentLocked()) {
      UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
      return
    }
    if (run.player.navigatorsChartUsed) {
      UI.setMessage("🗺️ Navigator's Chart — already used this floor. Renews on the next floor.", true); return
    }
    run.player.navigatorsChartUsed = true
    const grid = TileEngine.getGrid()
    const unrevealed = []
    for (const row of grid) { for (const t of row) { if (!t.revealed) unrevealed.push(t) } }
    unrevealed.forEach((t, i) => setTimeout(() => revealTile(t), i * 50))
    UI.setMessage("🗺️ Navigator's Chart — the entire floor is revealed!")
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'field-kit') {
    if (run.player.mana < 5) { UI.setMessage('Not enough mana! Field Kit costs 5 mana.', true); return }
    run.player.mana -= 5
    UI.updateMana(run.player.mana, run.player.maxMana)
    run.player.burnStacks = 0; UI.setBurnOverlay(0)
    run.player.poisonStacks = 0; UI.setPlayerPoison(0)
    run.player.tearyEyesTurns = 0; UI.setTearyEyes(0)
    run.player.freezingHitStacks = 0; UI.setFreezingHit(0)
    if (run.player.corruptionStacks > 0) {
      if (run.player.corruptionBaseMaxHp)   { run.player.maxHp  = run.player.corruptionBaseMaxHp;  run.player.corruptionBaseMaxHp  = 0 }
      if (run.player.corruptionBaseMaxMana) { run.player.maxMana = run.player.corruptionBaseMaxMana; run.player.corruptionBaseMaxMana = 0 }
      run.player.corruptionStacks = 0; UI.setCorruption(0)
    }
    const kitHeal = Math.min(5, run.player.maxHp - run.player.hp)
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + kitHeal)
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🧰 +${kitHeal} HP`, 'heal')
    UI.setMessage(`🧰 Field Kit — +${kitHeal} HP and all debuffs cleared. (5 mana)`)
    EventBus.emit('audio:play', { sfx: 'heal' })
    return
  }
  if (effect.type === 'twin-blades') {
    if (run.player.mana < 5) { UI.setMessage('Not enough mana! Twin Blades costs 5 mana.', true); return }
    run.player.mana -= 5
    UI.updateMana(run.player.mana, run.player.maxMana)
    _twinBladesTargeting = true
    UI.setMessage('⚔️ Twin Blades — tap any revealed living enemy to strike for 5 damage (no counter). (5 mana)')
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'smoke-bomb') {
    const combatTile = run.activeCombatTile
    if (!combatTile || !combatTile.enemyData || combatTile.enemyData._slain) {
      UI.setMessage('Smoke Bomb can only be used during combat.', true); return
    }
    if (run.player.mana < 5) { UI.setMessage('Not enough mana! Smoke Bomb costs 5 mana.', true); return }
    run.player.mana -= 5
    UI.updateMana(run.player.mana, run.player.maxMana)
    combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 3
    UI.spawnFloat(combatTile.element, '💨 Stunned 3!', 'xp')
    UI.setMessage('💨 Smoke Bomb — enemy stunned for 3 turns! (5 mana)')
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }

  // ── Common consumables ────────────────────────────────────────
  if (effect.type === 'rope-coil') {
    if (run.player.trapImmune) { UI.setMessage('Rope Coil already active — next trap is blocked.', true); return }
    run.player.trapImmune = true
    UI.spawnFloat(document.getElementById('hud-portrait'), '🪢 Ready!', 'heal')
    UI.setMessage('🪢 Rope Coil readied — the next trap you reveal will be completely negated.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'bandage-roll') {
    const immediate = 3
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + immediate)
    run.player.regenTurns   = 3
    run.player.regenPerTurn = 1
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🩹 +${immediate} HP`, 'heal')
    UI.setMessage(`🩹 Bandage applied — +${immediate} HP now, +1 HP per turn for 3 turns.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'heal' })
    return
  }
  if (effect.type === 'shield-shard') {
    if (run.player.shieldShard) { UI.setMessage('Shield Shard already active — next hit is blocked.', true); return }
    run.player.shieldShard = true
    UI.spawnFloat(document.getElementById('hud-portrait'), '🛡️ Raised!', 'heal')
    UI.setMessage('🛡️ Shield Shard raised — the very next enemy hit will be absorbed completely.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'smelling-salts') {
    run.player.tearyEyesTurns = 0
    UI.setTearyEyes(0)
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (t.enemyData && !t.enemyData._slain) {
          t.enemyData.burnTurns   = 0
          t.enemyData.poisonTurns = 0
        }
      }
    }
    UI.spawnFloat(document.getElementById('hud-portrait'), '💨 Cleared!', 'heal')
    UI.setMessage('💨 Smelling Salts — all debuffs cleared.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'heal' })
    return
  }
  if (effect.type === 'sonic-ear') {
    const grid = TileEngine.getGrid()
    let count = 0
    for (const row of grid) {
      for (const t of row) {
        if ((t.type === 'enemy' || t.type === 'enemy_fast' || t.type === 'boss') && !t.enemyData?._slain) count++
      }
    }
    UI.setMessage(`👂 Sonic Ear — ${count} living enem${count === 1 ? 'y' : 'ies'} remain on this floor.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'throwing-knife') {
    _throwingKnifeTargeting = true
    UI.setMessage('🗡️ Throwing Knife — tap any revealed living enemy to strike for 3 damage (no counter).')
    EventBus.emit('audio:play', { sfx: 'menu' })
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    return
  }
  if (effect.type === 'flash-powder') {
    const combatTile = run.activeCombatTile
    if (!combatTile || !combatTile.enemyData || combatTile.enemyData._slain) {
      UI.setMessage('Flash Powder can only be used during combat.', true)
      return
    }
    combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 2
    UI.spawnFloat(combatTile.element, '✨ Stunned!', 'xp')
    UI.setMessage('✨ Flash Powder — enemy stunned for 2 turns! No counter-attacks.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'rusty-nail') {
    _rustyNailTargeting = true
    UI.setMessage('📌 Rusty Nail — tap any revealed living enemy to poison them (1 dmg/turn × 5 turns).')
    EventBus.emit('audio:play', { sfx: 'menu' })
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    return
  }
  if (effect.type === 'loose-pouch') {
    const gold = _rand(3, 6)
    _gainGold(gold, document.getElementById('hud-portrait'), true)
    UI.setMessage(`💰 Loose Pouch — +${gold} gold spills out.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'gold' })
    return
  }
  if (effect.type === 'whetstone') {
    run.player.whettsoneHits = (run.player.whettsoneHits ?? 0) + 3
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚔️ +1 dmg ×3', 'xp')
    UI.setMessage(`🪨 Whetstone — your next 3 melee hits deal +1 damage.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'hit' })
    return
  }

  if (effect.type === 'bone-dice') {
    if (run.player.mana < 10) { UI.setMessage('Not enough mana! Bone Dice costs 10 mana.', true); return }
    run.player.mana -= 10
    UI.updateMana(run.player.mana, run.player.maxMana)
    const grid = TileEngine.getGrid()
    let count = 0
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed && t.enemyData && !t.enemyData._slain) {
          TileEngine.refreshEnemyDamageOnTile(t, run.floor)
          UI.updateEnemyHP(t.element, t.enemyData.currentHP)
          count++
        }
      }
    }
    UI.setMessage(`🎲 Bone Dice rerolled ${count} enem${count === 1 ? 'y' : 'ies'} — better or worse? (10 mana)`)
    EventBus.emit('audio:play', { sfx: 'menu' })
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
    const hasAcorn  = run.player.inventory.some(e => e.id === 'hollowed-acorn')
    const baseAmt   = hasAcorn ? Math.max(1, Math.floor(effect.amount / 2)) : effect.amount
    const restored  = Math.min(baseAmt, missing)
    run.player.mana += restored
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
    UI.setMessage(`🔵 You drink a ${item.name} and restore ${restored} mana.${hasAcorn ? ' (Hollowed Acorn halved)' : ''}`)
  }

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
}

function getInventory() { return run?.player.inventory ?? [] }

function getLevelUpLog() {
  return run?.levelUpLog ? [...run.levelUpLog] : []
}

/** Backpack items the balance bot may use without targeting toggles or special HUD flows. */
const _BOT_SAFE_USE_EFFECT_TYPES = new Set([
  'rope-coil', 'bandage-roll', 'shield-shard', 'smelling-salts', 'sonic-ear', 'loose-pouch',
  'whetstone', 'heal', 'mana', 'field-kit', 'bone-dice', 'navigators-chart',
])

function getBalanceBotUseItemCandidates() {
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return []
  if (_spellTargeting || _lanternTargeting || _spyglassTargeting) return []
  if (_engineerConstructSelecting) return []
  const inv = run.player.inventory ?? []
  const out = []
  for (const entry of inv) {
    if (!entry || entry.qty <= 0) continue
    const item = ITEMS[entry.id]
    if (!item?.effect) continue
    const { effect } = item
    if (effect.type.startsWith('passive-')) continue
    if (effect.type === 'smoke-bomb' || effect.type === 'flash-powder') {
      const ct = run.activeCombatTile
      if (!ct?.enemyData || ct.enemyData._slain) continue
    } else if (!_BOT_SAFE_USE_EFFECT_TYPES.has(effect.type)) {
      continue
    }
    if (effect.type === 'heal' && run.player.hp >= run.player.maxHp) continue
    if (effect.type === 'mana' && run.player.mana >= run.player.maxMana) continue
    if (effect.type === 'field-kit' && run.player.mana < 5) continue
    if (effect.type === 'bone-dice' && run.player.mana < 10) continue
    if (effect.type === 'navigators-chart' && run.player.navigatorsChartUsed) continue
    out.push(entry.id)
  }
  return out
}

/** Revealed living enemy that is not spell-immune (Slam / Spell / Blinding Light). */
function _balanceBotHasSpellableEnemy() {
  const grid = TileEngine.getGrid()
  if (!grid) return false
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune) return true
    }
  }
  return false
}

/** Any revealed, living enemy (knife / poison shot / twin blades). */
function _balanceBotHasAnyLivingEnemy() {
  const grid = TileEngine.getGrid()
  if (!grid) return false
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain) return true
    }
  }
  return false
}

/**
 * Spell / blinding / item targeting modes that require an enemy tile become orphans when no valid
 * targets exist (e.g. abilities policy toggled Spell at run start). Clear them so the bot can flip tiles.
 */
function _balanceBotUnstickOrphanTargeting() {
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return

  const hasSpellable = _balanceBotHasSpellableEnemy()
  const hasAnyEnemy = _balanceBotHasAnyLivingEnemy()

  if (_spellTargeting && !hasSpellable) {
    _spellTargeting = false
    const effectiveCost = _previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (_blindingLightTargeting && !hasSpellable) {
    _blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (_divineLightSelecting && !hasSpellable) {
    if (run.player.hp < run.player.maxHp) {
      const cost = _stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + _tearyExtraCost())
      if (run.player.mana >= cost) {
        divineLightHealAction()
      } else {
        _divineLightSelecting = false
        UI.setDivineLightActive(false)
      }
    } else {
      _divineLightSelecting = false
      UI.setDivineLightActive(false)
    }
  }
  if ((_throwingKnifeTargeting || _twinBladesTargeting || _rustyNailTargeting) && !hasAnyEnemy) {
    _throwingKnifeTargeting = false
    _twinBladesTargeting = false
    _rustyNailTargeting = false
    UI.setMessage('')
  }
  if (_poisonArrowShotSelecting && !hasAnyEnemy) {
    _cancelPoisonArrowShotMode()
  }
}

/**
 * While combat commitment is active, only the focused enemy tile produces progress on tap
 * (matches onTileTap + _canAttackEnemy). Returns null when not locked.
 */
function _balanceBotFocusedEnemyCandidatesIfCombatLocked() {
  if (!_isCombatCommitmentLocked()) return null
  const t = _combatEngagementTile && _getActiveTileAt(_combatEngagementTile.row, _combatEngagementTile.col)
  if (t?.revealed && t.enemyData && !t.enemyData._slain) {
    return [{ row: t.row, col: t.col }]
  }
  return []
}

/**
 * Balance bot: legal taps — targeting modes, chests, reachable tiles, enemies,
 * and progression tiles (exit / event / rope / forge) so a cleared floor still has candidates.
 * Spell / lantern / spyglass / ricochet / volley / engineer construct are handled here so the bot does not stall.
 */
function getBalanceBotTapCandidates() {
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return []
  _balanceBotUnstickOrphanTargeting()
  const grid = TileEngine.getGrid()
  if (!grid) return []

  const revealedEnemies = () => {
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed && t.enemyData && !t.enemyData._slain) {
          out.push({ row: t.row, col: t.col })
        }
      }
    }
    return out
  }

  if (_spellTargeting) {
    const foc = _balanceBotFocusedEnemyCandidatesIfCombatLocked()
    if (foc !== null) return foc
    return revealedEnemies()
  }

  if (_lanternTargeting || _spyglassTargeting) {
    if (_isCombatCommitmentLocked()) return []
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && !t.locked) out.push({ row: t.row, col: t.col })
      }
    }
    return out
  }

  if (_throwingKnifeTargeting || _twinBladesTargeting || _rustyNailTargeting ||
      _blindingLightTargeting || _divineLightSelecting || _poisonArrowShotSelecting) {
    const foc = _balanceBotFocusedEnemyCandidatesIfCombatLocked()
    if (foc !== null) return foc
    return revealedEnemies()
  }

  if (_ricochetSelecting) {
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
        const marked = _ricochetTiles.some(x => x.row === t.row && x.col === t.col)
        if (!marked && _ricochetTiles.length < 3) out.push({ row: t.row, col: t.col })
      }
    }
    return out.length ? out : revealedEnemies()
  }

  if (_arrowBarrageSelecting) {
    if (_tripleVolleyCenter) {
      return [{ row: _tripleVolleyCenter.row, col: _tripleVolleyCenter.col }]
    }
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed) out.push({ row: t.row, col: t.col })
      }
    }
    return out
  }

  if (_isCombatCommitmentLocked()) {
    const focusedOnly = _balanceBotFocusedEnemyCandidatesIfCombatLocked() ?? []
    if (_engineerConstructSelecting && _charKey() === 'engineer') {
      const merged = [...focusedOnly]
      const seen = new Set(merged.map((c) => `${c.row},${c.col}`))
      const tr = run.turret
      for (const row of grid) {
        for (const tile of row) {
          const onTurret = tr && tile.row === tr.row && tile.col === tr.col
          const emptyBuild = tile.revealed && tile.type === 'empty' && !tile.locked
          if (onTurret || emptyBuild) {
            const k = `${tile.row},${tile.col}`
            if (!seen.has(k)) {
              seen.add(k)
              merged.push({ row: tile.row, col: tile.col })
            }
          }
        }
      }
      if (merged.length) return merged
    }
    return focusedOnly
  }

  const out = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked && (t.reachable || run.player.eagleEyeFreeFlip)) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'chest' && t.chestReady && !t.chestLooted) {
        out.push({ row: t.row, col: t.col })
      }
      // Magic chest with 0 keys only shows UI message — no state change, so exclude or the bot loops forever.
      if (t.revealed && t.type === 'magic_chest' && t.magicChestReady && (run.player.goldenKeys ?? 0) > 0) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'exit' && !t.exitResolved) {
        // During sanctuary: hold off tapping exit until every other tile is revealed
        if (!run.atRest) {
          out.push({ row: t.row, col: t.col })
        }
      }
      if (t.revealed && t.type === 'event' && !t.eventResolved) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'rope' && !t.ropeResolved) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'forge' && !t.forgeUsed) {
        out.push({ row: t.row, col: t.col })
      }
    }
  }
  // Sanctuary exit: only add once all tiles are revealed (bot must explore every tile first)
  if (run.atRest) {
    let allRevealed = true
    let exitTile = null
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed) { allRevealed = false }
        if (t.revealed && t.type === 'exit' && !t.exitResolved) { exitTile = t }
      }
    }
    if (allRevealed && exitTile) {
      out.push({ row: exitTile.row, col: exitTile.col })
    }
  }
  return out
}

/**
 * When there are no tap candidates but hidden, non-locked tiles still exist, they may be unreachable by
 * normal adjacency — lantern/spyglass can target any such tile. Opens lantern (preferred) or spyglass mode.
 */
function balanceBotTryOpenRevealTool() {
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return false
  if (_isCombatCommitmentLocked()) return false
  if (_spellTargeting || _lanternTargeting || _spyglassTargeting) return false
  if (_ricochetSelecting || _arrowBarrageSelecting || _poisonArrowShotSelecting) return false
  if (_throwingKnifeTargeting || _twinBladesTargeting || _rustyNailTargeting) return false
  if (_blindingLightTargeting || _divineLightSelecting) return false
  if (_engineerConstructSelecting) return false

  const grid = TileEngine.getGrid()
  if (!grid) return false
  let hasHiddenUnlocked = false
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked) {
        hasHiddenUnlocked = true
        break
      }
    }
    if (hasHiddenUnlocked) break
  }
  if (!hasHiddenUnlocked) return false

  const inv = run.player.inventory ?? []
  const hasLantern = inv.some(e => e.id === 'lantern' && e.qty > 0)
  const hasSpy = inv.some(e => e.id === 'spyglass' && e.qty > 0)
  if (hasLantern) {
    lanternAction()
    return true
  }
  if (hasSpy) {
    spyglassAction()
    return true
  }
  return false
}

function getRunTelemetry() {
  if (run?.telemetry) {
    return {
      telemetry: JSON.parse(JSON.stringify(run.telemetry)),
      levelUpLog: (run.levelUpLog ?? []).slice(),
      runStats: _runStats(),
    }
  }
  if (_lastRunTelemetrySnapshot) {
    return {
      telemetry: JSON.parse(JSON.stringify(_lastRunTelemetrySnapshot.telemetry)),
      levelUpLog: _lastRunTelemetrySnapshot.levelUpLog.slice(),
      runStats: { ..._lastRunTelemetrySnapshot.runStats },
    }
  }
  return null
}

/** Live snapshot for balance-bot / Playwright — not persisted as run telemetry until the run ends. */
/** Current HP fraction (0–1) for test-bot-ongoing low-HP retreat; null if no run. */
function getPlayerHpRatio() {
  if (!run?.player?.maxHp) return null
  return run.player.hp / run.player.maxHp
}

function getBalanceBotDiagnostics() {
  const tap = getBalanceBotTapCandidates()
  const use = getBalanceBotUseItemCandidates()
  const targeting = []
  if (_spellTargeting) targeting.push('spell')
  if (_lanternTargeting) targeting.push('lantern')
  if (_spyglassTargeting) targeting.push('spyglass')
  if (_blindingLightTargeting) targeting.push('blindingLight')
  if (_divineLightSelecting) targeting.push('divineLight')
  if (_ricochetSelecting) targeting.push('ricochet')
  if (_arrowBarrageSelecting) targeting.push('arrowBarrage')
  if (_tripleVolleyCenter) targeting.push('volleyConfirm')
  if (_poisonArrowShotSelecting) targeting.push('poisonArrow')
  if (_engineerConstructSelecting) targeting.push('engineerConstruct')
  if (_throwingKnifeTargeting) targeting.push('throwingKnife')
  if (_twinBladesTargeting) targeting.push('twinBlades')
  if (_rustyNailTargeting) targeting.push('rustyNail')
  return {
    gameState: GameState.current(),
    combatBusy: _combatBusy,
    combatLocked: _isCombatCommitmentLocked(),
    combatEngagement: _combatEngagementTile ? { ..._combatEngagementTile } : null,
    runActive: !!run,
    floor: run?.floor ?? null,
    tilesRevealed: run?.tilesRevealed ?? null,
    tapCandidates: tap.length,
    useItemCandidates: use.length,
    targeting: targeting.length ? targeting.join('+') : null,
    hp: run?.player?.hp ?? null,
    maxHp: run?.player?.maxHp ?? null,
    meleeDmg: run?.player ? _playerDamageRange(run.player)[0] : null,
  }
}

/**
 * Player-facing deadlock detection: no unrevealed tile is reachable, no exit-pending tile waits to
 * be tapped, but unrevealed tiles still exist on the floor. Sub-floors and rest floors are skipped
 * (they have their own exits / sanctuary loop). Returns false during combat / overlays / animations.
 */
function _isPlayerDeadlocked() {
  if (!run || _isInSubFloor() || run.atRest) return false
  if (!GameState.is(States.FLOOR_EXPLORE)) return false
  if (_combatBusy) return false
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
function _maybeOfferDeadlockEscape() {
  if (!run || !_isPlayerDeadlocked()) return
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

function _climbThroughHazard(tile) {
  if (!run || !tile?.deadlockEscape) return
  tile.deadlockEscape = false
  tile.element?.classList.remove('deadlock-escape')
  TileEngine.replaceTileWithEmptyPreserveState(tile.row, tile.col)
  const fresh = TileEngine.getTile(tile.row, tile.col)
  fresh.revealed = true
  TileEngine.patchMainGridTileAt(tile.row, tile.col, UI.getGridEl(), onTileTap, onTileHold)
  TileEngine.markReachable(tile.row, tile.col, _markReachableUi)
  UI.setMessage('You clear the hazard and find a new path.')
}

/** Grid stats when the bot has zero tap candidates (deadlock analysis). */
function getBalanceBotDeadlockDiagnostics() {
  const grid = TileEngine.getGrid()
  if (!grid) return { error: 'no_grid' }
  let locked = 0
  let unrevealedUnlocked = 0
  let unrevealedReachable = 0
  let revealed = 0
  let livingEnemies = 0
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed) {
        revealed++
        if (t.enemyData && !t.enemyData._slain) livingEnemies++
      } else if (t.locked) {
        locked++
      } else {
        unrevealedUnlocked++
        if (t.reachable) unrevealedReachable++
      }
    }
  }
  return {
    floor: run?.floor ?? null,
    atRest: !!run?.atRest,
    tilesRevealed: run?.tilesRevealed ?? null,
    locked,
    unrevealedUnlocked,
    unrevealedReachable,
    revealed,
    livingEnemies,
    combatBusy: _combatBusy,
    gameState: GameState.current(),
  }
}

/** Force-recompute tile reachability from all currently-revealed tiles. Fixes stale flags. */
function balanceBotRepairReachability() {
  if (!run) return false
  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  return true
}

/**
 * Softlock recovery: clear ALL tile locks (red X's) not justified by a living enemy,
 * then rebuild reachability. Returns count of now-available unrevealed tiles.
 */
function balanceBotForceUnlockAll() {
  if (!run) return 0
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  TileEngine.recomputeReachabilityFromRevealed(_markReachableUi)
  const grid = TileEngine.getGrid()
  let unlocked = 0
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked) unlocked++
    }
  }
  return unlocked
}

function _weightedAbilityPick(weights, ids) {
  let sum = 0
  for (const id of ids) sum += Math.max(0, weights[id] ?? 0)
  if (sum <= 0) return null
  let r = Math.random() * sum
  for (const id of ids) {
    const w = Math.max(0, weights[id] ?? 0)
    r -= w
    if (r <= 0) return id
  }
  return ids[ids.length - 1]
}

function _balanceBotHasSlamTarget() {
  return _balanceBotHasSpellableEnemy()
}

/**
 * Balance bot: when policy uses abilities, try a weighted warrior action (Slam / Blinding / Spell / Divine).
 * Returns true if an action was started (including targeting toggles); false to fall back to tile taps.
 */
function balanceBotTryWarriorAbilities(abilityWeights = {}) {
  const w = {
    slam: 4,
    'blinding-light': 2,
    spell: 2,
    'divine-light': 1,
    ...abilityWeights,
  }
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return false
  if (_spellTargeting || _lanternTargeting || _spyglassTargeting) return false
  if (_blindingLightTargeting || _divineLightSelecting) return false
  if (_ricochetSelecting || _arrowBarrageSelecting || _poisonArrowShotSelecting) return false
  if (_throwingKnifeTargeting || _twinBladesTargeting || _rustyNailTargeting) return false
  if (_engineerConstructSelecting) return false
  if (_charKey() !== 'warrior') return false

  const upgrades = _save.warrior?.upgrades ?? []
  const candidates = []
  const push = (id) => {
    if ((w[id] ?? 0) <= 0) return
    candidates.push(id)
  }
  const hasSpellTgt = _balanceBotHasSpellableEnemy()
  const slamCost = _stillWaterManaCost(WARRIOR_UPGRADES.slam.manaCost)
  if (upgrades.includes('slam') && run.player.mana >= slamCost && hasSpellTgt) push('slam')
  const blindCost = _stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + _tearyExtraCost())
  if (upgrades.includes('blinding-light') && run.player.mana >= blindCost && hasSpellTgt) push('blinding-light')
  const spellCost = _previewSpellManaCostForUi()
  if (run.player.mana >= spellCost && hasSpellTgt) push('spell')
  const divineCost = _stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + _tearyExtraCost())
  if (upgrades.includes('divine-light') && run.player.mana >= divineCost) {
    if (hasSpellTgt || run.player.hp < run.player.maxHp) push('divine-light')
  }
  if (candidates.length === 0) return false

  const pick = _weightedAbilityPick(w, candidates)
  if (!pick) return false

  const mana0 = run.player.mana
  if (pick === 'slam') {
    slamAction()
    return run.player.mana < mana0 || _combatBusy
  }
  if (pick === 'blinding-light') {
    blindingLightAction()
    return _blindingLightTargeting
  }
  if (pick === 'spell') {
    spellAction()
    return _spellTargeting
  }
  if (pick === 'divine-light') {
    divineLightAction()
    return _divineLightSelecting
  }
  return false
}

/** Ranger / engineer: open spell targeting when mana allows (abilities policy fallback). */
function balanceBotTryGenericSpellAbility() {
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || _combatBusy) return false
  if (_spellTargeting || _lanternTargeting || _spyglassTargeting) return false
  if (_ricochetSelecting || _arrowBarrageSelecting || _poisonArrowShotSelecting) return false
  if (_throwingKnifeTargeting || _twinBladesTargeting || _rustyNailTargeting) return false
  if (_engineerConstructSelecting) return false
  if (run.player.mana < _previewSpellManaCostForUi()) return false
  if (!_balanceBotHasSpellableEnemy()) return false
  spellAction()
  return _spellTargeting
}

function balanceBotTryAbilitiesPolicy(abilityWeights = {}) {
  if (_charKey() === 'warrior') return balanceBotTryWarriorAbilities(abilityWeights)
  return balanceBotTryGenericSpellAbility()
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
  // Blood Pact: revert on drop
  if (id === 'blood-pact') {
    run.player.damageBonus = Math.max(0, (run.player.damageBonus ?? 0) - 2)
    run.player.maxHp += 3
    UI.updateHP(run.player.hp, run.player.maxHp)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 Pact broken', 'heal')
  }
  // Forsaken Idol: restore max HP on drop
  if (id === 'forsaken-idol') {
    run.player.maxHp = Math.max(1, run.player.maxHp * 2)
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🗿 Max HP restored', 'heal')
  }
  // Hollowed Acorn: revert max mana on drop
  if (id === 'hollowed-acorn') {
    run.player.maxMana = Math.max(1, (run.player.maxMana ?? CONFIG.player.maxMana) - 10)
    run.player.mana = Math.min(run.player.mana, run.player.maxMana)
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🌰 −10 Mana', 'damage')
  }
  // Sanguine Covenant: revert on drop
  if (id === 'sanguine-covenant') {
    run.player.damageBonus = Math.max(0, (run.player.damageBonus ?? 0) - 3)
    run.player.maxHp = Math.max(1, run.player.maxHp * 2)
    UI.updateHP(run.player.hp, run.player.maxHp)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  // Razor's Edge: restore max HP on drop
  if (id === 'razors-edge') {
    run.player.maxHp += 10
    UI.updateHP(run.player.hp, run.player.maxHp)
  }
  // Honed Edge: revert damage on drop
  if (id === 'honed-edge') {
    run.player.damageBonus = Math.max(0, (run.player.damageBonus ?? 0) - 1)
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setMessage(item ? `Dropped ${item.name}.` : 'Item removed.')
  EventBus.emit('audio:play', { sfx: 'menu' })
}

/** Trash the item currently sitting in the backpack:full pending slot (no-op if pack isn't full). */
async function forceReplaceItem(oldId, newId) {
  if (!run) return
  dropItem(oldId)
  await _addToBackpack(newId)
  EventBus.emit('inventory:changed')
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
  isMageActiveUnlocked:   _isMageActiveUnlocked,
  getSlamDamageBreakdown,
  getBlindingLightBreakdown,
  getDivineLightBreakdown,
  getRicochetBreakdown,
  getArrowBarrageBreakdown,
  getPoisonArrowShotBreakdown,
  getChainLightningBreakdown,
  getTelekineticThrowBreakdown,
  newGame,
  returnToMenu,
  onTileTap,
  spellAction,
  slamAction,
  abilitySlotAAction,
  constructTurretAction,
  teslaTowerAction,
  ricochetAction,
  arrowBarrageAction,
  poisonArrowShotAction,
  chainLightningAction,
  telekineticThrowAction,
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
  forceReplaceItem,
  getInventory,
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
    _combatBusy = false
    _clearAllCombatEngagement()
  },
  balanceBotTryWarriorAbilities,
  balanceBotTryAbilitiesPolicy,
  balanceBotDismissNpcEvent,
  getRunTelemetry,
  getTearyEyesTurns()    { return run?.player?.tearyEyesTurns ?? 0 },
  getFreezingHitStacks() { return run?.player?.freezingHitStacks ?? 0 },
  getBurnStacks()        { return run?.player?.burnStacks ?? 0 },
  hasActiveRun()      { return !!_save?.activeRun },
  getActiveRunInfo()  { return _save?.activeRun ?? null },
  resumeRun,
  abandonRun,
  persistActiveRun()  { _saveActiveRun() },
}
