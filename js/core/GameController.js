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
import { STORY_EVENTS, MERCHANT_ITEMS, rollEventType } from '../data/events.js'
import Bestiary              from '../systems/Bestiary.js'
import TrinketCodex          from '../systems/TrinketCodex.js'
import { FORGE_RECIPES }     from '../data/combinations.js'

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

function _pickRandom(pool) { return pool[Math.floor(Math.random() * pool.length)] }

function _rollCommonLoot() {
  // Weighted: potions more likely than lantern/tools/spyglass
  const r = Math.random()
  if (r < 0.32) return { type: 'potion-red' }
  if (r < 0.58) return { type: 'potion-blue' }
  if (r < 0.74) return { type: 'lantern' }
  if (r < 0.87) return { type: 'smiths-tools' }
  if (r < 0.95) return { type: 'spyglass' }
  return { type: 'gold', amount: _rand(...CONFIG.chest.goldDrop) }
}

/** Normal chest: 97% common, 2% rare, 1% legendary */
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
  return _rollCommonLoot()
}

const BACKPACK_MAX_SLOTS = 9

/** Magic chest: 93% common, 5% rare (all rares + exclusives), 2% legendary */
function _rollMagicChestLoot() {
  const r = Math.random()
  if (r < 0.02) return { type: _pickRandom(LEGENDARY_TRINKET_IDS) }
  if (r < 0.07) {
    const pool = [...RARE_TRINKET_IDS, ...MAGIC_CHEST_EXCLUSIVE_IDS]
    return { type: _pickRandom(pool) }
  }
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
  const scaled = Math.max(1, Math.round(dmg * _playerOutgoingDamageMult()))
  // Corruption: -1 flat damage per stack (min 1)
  const corruptionPenalty = run?.player?.corruptionStacks ?? 0
  return Math.max(1, scaled - corruptionPenalty)
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
  t.enemyData.currentHP += CREW_BUFF_HP
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
      t.enemyData.currentHP = Math.max(1, t.enemyData.currentHP - CREW_BUFF_HP)
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
      echoHintCategory: t.echoHintCategory ?? null,
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
      t.eventResolved = st.eventResolved
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
      if (t.type === 'event') {
        t.element.classList.toggle('event-pending', !t.eventResolved)
      }
      if (t.type === 'chest') {
        t.element.classList.toggle('chest-ready', !!(t.chestReady && !t.chestLooted))
      }
      if (t.type === 'magic_chest') {
        t.element.classList.toggle('chest-ready', !!t.magicChestReady)
      }
      if (t.type === 'forge') {
        t.element.classList.toggle('forge-used', !!t.forgeUsed)
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
  UI.setFreezingHit(run.player.freezingHitStacks ?? 0)
  UI.setBurnOverlay(run.player.burnStacks ?? 0)
  UI.setPlayerPoison(run.player.poisonStacks ?? 0)
  UI.setCorruption(run.player.corruptionStacks ?? 0)
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
  if (type === 'event' || type === 'checkpoint') return '✨'
  if (type === 'exit') return '🚪'
  if (type === 'empty') return '·'
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
    eventTile:            null,
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
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0); run.player.freezingHitStacks = 0; UI.setFreezingHit(0); run.player.burnStacks = 0; UI.setBurnOverlay(0); run.player.poisonStacks = 0; UI.setPlayerPoison(0); run.player.corruptionStacks = 0; if (run.player.corruptionBaseMaxHp) { run.player.maxHp = run.player.corruptionBaseMaxHp; run.player.corruptionBaseMaxHp = 0 } if (run.player.corruptionBaseMaxMana) { run.player.maxMana = run.player.corruptionBaseMaxMana; run.player.corruptionBaseMaxMana = 0 } UI.setCorruption(0) }
  if (run) { run._hourglassSnapshot = null }
  _throwingKnifeTargeting  = false
  _rustyNailTargeting      = false
  _twinBladesTargeting     = false
  if (run?.player) run.player.navigatorsChartUsed = false
  // Hunger Stone: costs 2 HP and grants +1 max damage each floor (skip sanctuary)
  if (!run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'hunger-stone')) {
    run.player.damageBonus = (run.player.damageBonus ?? 0) + 1
    run.player.hp = Math.max(1, run.player.hp - 2)
  }
  _saveActiveRun()
  TileEngine.generateGrid(run.floor, { rest: run.atRest })
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  _revealStartTile()
  // Cracked Compass: reveal exit tile from the start (skip rest floors)
  if (!run.atRest && run.player.inventory.some(e => e.id === 'cracked-compass')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (t.type === 'exit' && !t.revealed) {
          t.revealed = true
          run.tilesRevealed++
          TileEngine.markReachable(t.row, t.col, UI.markTileReachable.bind(UI))
          if (t.element) {
            TileEngine.flipTile(t, UI)
            t.element.classList.add('compass-revealed')
          }
          break
        }
      }
    }
  }
  // Forsaken Idol: reveal all unrevealed enemy tiles from floor start
  if (!run.atRest && run.player.inventory.some(e => e.id === 'forsaken-idol')) {
    const grid = TileEngine.getGrid()
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && (t.type === 'enemy' || t.type === 'enemy_fast' || t.type === 'boss')) {
          t.revealed = true
          run.tilesRevealed++
          TileEngine.markReachable(t.row, t.col, UI.markTileReachable.bind(UI))
          if (t.element) TileEngine.flipTile(t, UI)
        }
      }
    }
  }
  // Mending Moss: restore 3 HP at start of each new floor (skip floor 1 and sanctuary)
  if (!run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'mending-moss')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 3)
  }
  // Twin Fates: coin flip each floor (skip floor 1 and sanctuary)
  if (!run.atRest && run.floor > 1 && run.player.inventory.some(e => e.id === 'twin-fates')) {
    if (Math.random() < 0.5) {
      run.player.maxHp += 4
      run.player.hp    += 4
    } else {
      run.player.maxHp = Math.max(1, run.player.maxHp - 2)
      run.player.hp    = Math.min(run.player.hp, run.player.maxHp)
    }
  }
  // Abyssal Lens: hint all tile categories on the back of unrevealed tiles
  if (!run.atRest && run.player.inventory.some(e => e.id === 'abyssal-lens')) {
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
  UI.hideEventOverlays()

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
let _throwingKnifeTargeting  = false
let _rustyNailTargeting      = false
let _twinBladesTargeting     = false

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

  // Throwing Knife targeting
  if (_throwingKnifeTargeting) {
    _throwingKnifeTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
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
    // Eagle Eye: one free flip to any unrevealed unlocked tile after a kill
    if (!tile.revealed && !tile.locked && run.player.eagleEyeFreeFlip) {
      run.player.eagleEyeFreeFlip = false
      revealTile(tile)
      return
    }
    if (!tile.revealed && !tile.locked && tile.reachable) {
      // Haptic feedback on tile flip (if supported and enabled)
      if (navigator.vibrate && (_save?.settings?.hapticFeedback ?? true)) {
        navigator.vibrate(15)
      }
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
    if (navigator.vibrate && (_save?.settings?.hapticFeedback ?? true)) navigator.vibrate(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `☠️ Poison ${dmg}`, 'damage')
    run.player.poisonStacks--
    UI.setPlayerPoison(run.player.poisonStacks)
  }
  // Burn debuff tick: 1 HP damage per stack, then 1 stack falls off
  if ((run.player.burnStacks ?? 0) > 0) {
    const dmg = run.player.burnStacks
    run.player.hp = Math.max(1, run.player.hp - dmg)
    UI.updateHP(run.player.hp, run.player.maxHp)
    if (navigator.vibrate && (_save?.settings?.hapticFeedback ?? true)) navigator.vibrate(20)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🔥 Burn ${dmg}`, 'damage')
    run.player.burnStacks--
    UI.setBurnOverlay(run.player.burnStacks)
    if (run.player.hp <= 1 && !GameState.is(States.DEATH)) {
      // Don't kill from burn — leave at 1 HP minimum
    }
  }
  const grid = TileEngine.getGrid()
  if (!grid) return
  const plagueBonus = run.player.inventory?.some(e => e.id === 'plague-rat-skull') ? 1 : 0
  const pDmg = _scaleOutgoingDamageToEnemy(_poisonArrowUnitDamage()) + plagueBonus
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
  // Shadow Bat harass: each revealed living bat deals its dmg to the player every global turn
  let totalHarassDmg = 0
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
      if (!tile.enemyData.harassPlayer) continue
      const dmg = tile.enemyData.harassDmg ?? 1
      totalHarassDmg += dmg
      UI.spawnFloat(tile.element, `🦇 ${dmg}`, 'damage')
    }
  }
  if (totalHarassDmg > 0 && !GameState.is(States.DEATH)) {
    _applyPlayerDamage(totalHarassDmg, document.getElementById('hud-portrait'))
    UI.setMessage(`🦇 Shadow Bat${totalHarassDmg > 1 ? 's attack' : ' attacks'} for ${totalHarassDmg} damage!`)
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
  // Deathmask: instant kill on first enemy reveal after a proc
  if (tile.enemyData && !tile.enemyData._slain && run.player.deathmaskPending) {
    run.player.deathmaskPending = false
    UI.spawnFloat(tile.element, '💀 Instant Kill!', 'xp')
    _gainGold(tile.enemyData.goldDrop ? _rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
    _gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
    TileEngine.markReachable(tile.row, tile.col, UI.markTileReachable.bind(UI))
    return
  }
  await _maybeBestiaryDiscovery(tile)
  _resolveEffect(tile)
  // Drowned Hulk aura: if the revealed tile IS the hulk, buff all current visible enemies.
  // If a hulk is already alive, buff this newly revealed enemy.
  if (tile.enemyData && !tile.enemyData._slain) {
    if (tile.enemyData.crewBuffAura) {
      _applyHulkBuffToAll()
    } else {
      const hulk = _findLiveHulk()
      if (hulk && hulk !== tile) _applyHulkBuffToTile(tile)
    }
  }
  // Blockage tiles do not extend reachability — player must path around them
  if (tile.type !== 'blockage') {
    TileEngine.markReachable(tile.row, tile.col, UI.markTileReachable.bind(UI))
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

    case 'event':
      tile.eventResolved = false
      run.eventTile = tile
      if (tile.element) tile.element.classList.add('event-pending')
      UI.setMessage('Something stirs in the shadows. Tap to investigate.')
      UI.showRetreat()
      break

    case 'boss':
    case 'enemy_fast': {
      const { dmg } = CombatResolver.resolveFastReveal(tile.enemyData)
      const wardensBlock  = p.inventory.some(e => e.id === 'wardens-brand')
      const reflexDodge   = !wardensBlock && !tile.enemyData?.isBoss && (p.reflexDodgeChance ?? 0) > 0 && Math.random() < p.reflexDodgeChance
      if (!wardensBlock && !reflexDodge) {
        const baseDmg = dmg + (p.inventory.some(e => e.id === 'abyssal-lens') ? 1 : 0)
        const r = _applyRangerTrapfinderMitigation(baseDmg, p)
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
      const hasWarden = p.inventory.some(e => e.id === 'wardens-brand')
      const hasLens   = p.inventory.some(e => e.id === 'abyssal-lens')
      if (tile.enemyData?.attributes?.includes('fast')) {
        const d = tile.enemyData.dmg
        const ambushDmg  = tile.enemyData.hitDamage ?? (Array.isArray(d) ? d[0] : d)
        const reflexDodge = !hasWarden && (p.reflexDodgeChance ?? 0) > 0 && Math.random() < p.reflexDodgeChance
        if (hasWarden) {
          UI.setMessage(`The ${tile.enemyData.label} lunges — but your brand holds. Tap to fight.`)
        } else if (reflexDodge) {
          UI.spawnFloat(tile.element, '⚡ Dodged!', 'heal')
          UI.setMessage(`⚡ The ${tile.enemyData.label} lunges — your reflexes save you! Tap to fight.`)
        } else {
          const finalDmg = ambushDmg + (hasLens ? 1 : 0)
          const r = _applyRangerTrapfinderMitigation(finalDmg, p)
          _takeDamage(r.dmg, tile.element, false, tile.enemyData)
          const tf = r.proc ? ' Trapfinder!' : ''
          UI.setMessage(`⚡ The ${tile.enemyData.label} strikes first for ${r.dmg}!${tf} Tap to fight back.`)
        }
      } else if (hasLens) {
        // Abyssal Lens: normal enemies also deal 1 ambush damage
        _takeDamage(1, tile.element, false, tile.enemyData)
        if (!GameState.is(States.DEATH)) UI.setMessage(`👁️ The ${tile.enemyData?.label ?? 'enemy'} senses your sight and strikes! Tap to fight.`)
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
  _combatBusy = true

  _tickPoisonArrowDotOnGlobalTurn()
  if (!tile?.enemyData || tile.enemyData._slain) {
    _combatBusy = false
    return
  }

  // Mushroom Harvester taunt: redirect melee to a random visible Harvester
  tile = _resolveTauntTarget(tile)

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

  run.player.meleeHitCount = (run.player.meleeHitCount ?? 0) + 1
  const _stormProc = run.player.inventory.some(e => e.id === 'stormcallers-fist') && run.player.meleeHitCount % 5 === 0

  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast) ? ' (2×!)' : ''
  const newEnemyHP = _save.settings.cheats?.instantKill ? 0 : Math.max(0, tile.enemyData.currentHP - playerDmg)
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
      _gainGold(result.goldDrop, tile.element, true)
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
        const burnPlagueBonus = run.player.inventory.some(e => e.id === 'plague-rat-skull') ? 1 : 0
        const burnDmg = Math.max(1, Math.floor(tile.enemyData.currentHP * 0.2)) + burnPlagueBonus
        tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - burnDmg)
        tile.enemyData.burnTurns--
        UI.spawnFloat(tile.element, `🔥 ${burnDmg}`, 'damage')
        if (tile.enemyData.currentHP <= 0) {
          UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
          UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls to flames before they can strike back. +${result.goldDrop} gold.`)
          _gainGold(result.goldDrop, tile.element, true)
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

  // Collect all revealed living enemies — skip ability-immune (e.g. Gnome)
  const grid = TileEngine.getGrid()
  const targets = []
  let immuneSkipped = 0
  for (const row of grid) {
    for (const tile of row) {
      if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        if (tile.enemyData.spellImmune) { immuneSkipped++; continue }
        targets.push(tile)
      }
    }
  }

  if (targets.length === 0) {
    UI.setMessage(immuneSkipped ? 'No valid targets — Gnomes are immune to abilities!' : 'No enemies to Slam!', true)
    return
  }

  // Spend mana
  run.player.mana = Math.max(0, run.player.mana - cost)
  _markStillWaterAbilityUsed()
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true
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

  // Mushroom Harvester taunt: redirect spell to a random visible Harvester
  tile = _resolveTauntTarget(tile)

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  // Ogre: 10% shield block — cancels spell entirely
  if (_checkShieldBlock(tile)) return

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
    if (run.player.hp <= 0) { _die(null); return }
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
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! +${result.goldDrop} gold.`)
    _gainGold(result.goldDrop, tile.element, true)
    _gainXP(result.xpDrop ?? 0, tile.element)
    _endCombatVictory(tile)
  } else {
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! Enemy has ${tile.enemyData.currentHP} HP left.`)
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
  }
}

function _endCombatVictory(tile) {
  tile.enemyData._slain = true
  // Drowned Hulk: remove crew aura from all buffed enemies on death
  if (tile.enemyData.crewBuffAura) {
    UI.setMessage('⚓ The Drowned Hulk falls — its crew weakens!')
    _removeHulkBuffFromAll()
  }
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
  _checkFloorCleared()
}

// ── Hasty Retreat ────────────────────────────────────────────

function doRetreat() {
  if (GameState.is(States.NPC_INTERACT) && run.eventTile) {
    _closeEventSession(run.eventTile)
  }

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
  _nextFloor()
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
  const maskReduction   = run.player.inventory.some(e => e.id === 'plague-mask')    ? 1 : 0
  const bladeReduction  = run.player.inventory.some(e => e.id === 'infected-blade') ? 1 : 0
  return Math.max(1, scaled - (run.player.damageReduction ?? 0) - maskReduction - bladeReduction)
}

function _takeDamage(amount, tileEl, skipPortraitAnim = false, killerData = null) {
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
    UI.spawnFloat(tileEl, `-${hpDmg} HP`, 'damage')
  } else {
    run.player.hp = Math.max(0, run.player.hp - effective)
    UI.spawnFloat(tileEl, `-${effective} HP`, 'damage')
  }
  UI.updateHP(run.player.hp, run.player.maxHp)
  if (navigator.vibrate && (_save?.settings?.hapticFeedback ?? true)) {
    navigator.vibrate([50, 40, 80])
  }
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
  if (run?.player) { run.player.tearyEyesTurns = 0; UI.setTearyEyes(0); run.player.freezingHitStacks = 0; UI.setFreezingHit(0); run.player.burnStacks = 0; UI.setBurnOverlay(0); run.player.poisonStacks = 0; UI.setPlayerPoison(0); run.player.corruptionStacks = 0; if (run.player.corruptionBaseMaxHp) { run.player.maxHp = run.player.corruptionBaseMaxHp; run.player.corruptionBaseMaxHp = 0 } if (run.player.corruptionBaseMaxMana) { run.player.maxMana = run.player.corruptionBaseMaxMana; run.player.corruptionBaseMaxMana = 0 } UI.setCorruption(0) }
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
    const existing = inv.find(e => e.id === id)
    if (existing && (!item.maxStack || existing.qty < item.maxStack)) {
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
    const existing = inv.find(e => e.id === id)
    if (existing && (!item.maxStack || existing.qty < item.maxStack)) return true
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
  if (effect.type === 'temporal-wick') {
    if (!run._hourglassSnapshot) { UI.setMessage('Nothing to rewind yet.', true); return }
    if (_combatBusy) { UI.setMessage('Not while combat is resolving.', true); return }
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
    if (p.hp <= 0) { _die(); return }
    UI.setMessage(`⏳ The wick flickers — your last step is undone. +${wickHeal} HP restored.`)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'navigators-chart') {
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
  forceReplaceItem,
  getInventory,
  openForge: _openForge,
  getLevelUpLog,
  getTearyEyesTurns()    { return run?.player?.tearyEyesTurns ?? 0 },
  getFreezingHitStacks() { return run?.player?.freezingHitStacks ?? 0 },
  getBurnStacks()        { return run?.player?.burnStacks ?? 0 },
  hasActiveRun()      { return !!_save?.activeRun },
  getActiveRunInfo()  { return _save?.activeRun ?? null },
  resumeRun,
  abandonRun,
}
