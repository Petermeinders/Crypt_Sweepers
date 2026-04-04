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
import { RANGER_BASE }       from '../data/ranger.js'
import { WARRIOR_UPGRADES }  from '../data/upgrades.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { TILE_BLURBS }       from '../data/tileBlurbs.js'
import { ITEMS }             from '../data/items.js'

// ── Persistent save + run state ──────────────────────────────
let _save = null
let run   = null

function _charKey() {
  return _save?.selectedCharacter ?? 'warrior'
}

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
    abilities:          [],
    damageBonus:        0,
    damageReduction:    0,
    spellCostReduction: 0,
    onKillHeal:         0,
    fleeMaxCost:        null,
    undeadBonus:        false,
    beastBonus:         false,
    trapReduction:      0,
    retreatPercent:     CONFIG.retreat.goldKeepPercent,
    extraAbilityChoice: false,
    damageTakenMult:    1,
    isRanger,
    // Ranger unique: enemy reveals don't lock adjacent tiles
    noLockOnReveal:     isRanger,
    inventory:          [],   // [{ id, qty }]
  }

  MetaProgression.applyToPlayer(p, _save)

  return {
    player:           p,
    floor:            1,
    tilesRevealed:    0,
    activeCombatTile: null,
    merchantTile:     null,
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

// ── Return to menu ───────────────────────────────────────────

function returnToMenu(autoSave = false) {
  if (autoSave) SaveManager.save(_save)
  const char = _charKey()
  const xp   = char === 'ranger' ? _save.ranger.totalXP : _save.warrior.totalXP
  UI.updateMenuStats(_save.persistentGold, xp, char, _save)
  UI.setActiveDifficulty(_save.settings.difficulty)
  UI.showMainMenu()
  EventBus.emit('audio:crossfade', { track: 'menu', duration: 1500 })
}

function _startFloor() {
  _spellTargeting         = false
  _combatBusy             = false
  _lanternTargeting       = false
  _blindingLightTargeting = false
  TileEngine.generateGrid(run.floor)
  TileEngine.renderGrid(UI.getGridEl(), onTileTap, onTileHold)
  _revealStartTile()

  GameState.set(States.FLOOR_EXPLORE)
  UI.updateFloor(run.floor)
  UI.updateHP(run.player.hp, run.player.maxHp)
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.updateGold(run.player.gold)
  UI.updateXP(run.player.xp, _xpNeeded())
  {
    const [d0, d1] = _playerDamageRange(run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setHudCharacter(_charKey())
  // Slam button — warrior only, and only if unlocked in the skill tree
  const warriorUpgrades = _save.warrior?.upgrades ?? []
  const slamUnlocked = _charKey() === 'warrior' && warriorUpgrades.includes('slam')
  UI.setSlamBtn(slamUnlocked, WARRIOR_UPGRADES.slam.manaCost)
  // Blinding Light button — warrior only, slot-b
  const blindingUnlocked = _charKey() === 'warrior' && warriorUpgrades.includes('blinding-light')
  UI.setBlindingLightBtn(blindingUnlocked, WARRIOR_UPGRADES['blinding-light'].manaCost)
  // Show spell button always — player can target any enemy at any time
  const effectiveCost = Math.max(1, CONFIG.spell.manaCost - (run.player.spellCostReduction ?? 0))
  UI.showActionPanel(effectiveCost, run.player.mana >= effectiveCost)
  UI.hideRetreat()
  UI.hideRunSummary()
  UI.hideMerchant()

  const isBoss = CONFIG.bossFloors.includes(run.floor)
  UI.setMessage(isBoss
    ? `⚠️ Floor ${run.floor} — Boss floor! Tread carefully.`
    : 'Tap a tile to reveal what lurks beneath...')

  Logger.debug(`[GameController] Floor ${run.floor} started`)
}

// ── Starting tile ────────────────────────────────────────────

function _revealStartTile() {
  const grid = TileEngine.getGrid()
  const { cols, rows } = CONFIG.gridSize(run.floor)

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
}

// ── Tile tap router ──────────────────────────────────────────

let _spellTargeting         = false
let _combatBusy             = false
let _lanternTargeting       = false
let _blindingLightTargeting = false

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

  // Blinding Light targeting: revealed living enemy
  if (_blindingLightTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      _castBlindingLight(tile)
    }
    return
  }

  if (state === States.FLOOR_EXPLORE) {
    if (!tile.revealed && !tile.locked && tile.reachable) {
      revealTile(tile)
    } else if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
      _openChest(tile)
    } else if (tile.revealed && tile.type === 'exit' && !tile.exitResolved) {
      _confirmExit(tile)
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
      dmg:        Array.isArray(e.dmg) ? e.dmg[0] : e.dmg,
      type:       e.type,
      blurb:      e.blurb ?? '',
      attributes: e.attributes ?? [],
    }
  } else if (tile.revealed) {
    const info = TILE_BLURBS[tile.type]
    if (!info) return
    cardData = {
      name:       info.label,
      emoji:      info.emoji,
      spriteSrc:  null,
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

async function revealTile(tile) {
  tile.revealed = true
  run.tilesRevealed++
  UI.setPortraitAnim('run')
  EventBus.emit('audio:play', { sfx: 'flip' })
  await TileEngine.flipTile(tile)
  UI.setPortraitAnim('idle')
  _gainXP(CONFIG.xp.perTileReveal, tile.element)
  EventBus.emit('tile:revealed', { tile })
  TileEngine.markReachable(tile.row, tile.col, UI.markTileReachable.bind(UI))
  _resolveEffect(tile)
}

// ── Chest open ───────────────────────────────────────────────

function _openChest(tile) {
  tile.chestReady = false
  tile.element?.classList.remove('chest-ready')
  const loot = tile.chestLoot

  EventBus.emit('audio:play', { sfx: 'chest' })
  if (loot.type === 'potion-red') {
    _addToBackpack('potion-red')
    UI.spawnFloat(tile.element, '🧪 Red Potion', 'heal')
    UI.setMessage('You pry it open — a Red Potion inside!')
  } else if (loot.type === 'potion-blue') {
    _addToBackpack('potion-blue')
    UI.spawnFloat(tile.element, '🔵 Mana Potion', 'mana')
    UI.setMessage('You pry it open — a Mana Potion inside!')
  } else if (loot.type === 'fire-ring') {
    _addToBackpack('fire-ring')
    UI.spawnFloat(tile.element, '🔥 Fire Ring', 'xp')
    UI.setMessage('You pry it open — a Fire Ring! Passive: 10% chance to ignite on hit.')
  } else if (loot.type === 'lantern') {
    _addToBackpack('lantern')
    UI.spawnFloat(tile.element, '🏮 Lantern', 'xp')
    UI.setMessage('You pry it open — a Lantern! Use it to reveal any hidden tile.')
  } else if (loot.type === 'mana-ring') {
    _addToBackpack('mana-ring')
    UI.spawnFloat(tile.element, '💍 Mana Ring', 'mana')
    UI.setMessage('You pry it open — a Mana Ring! Passive: 10% chance for double mana on tile flips.')
  } else {
    _gainGold(loot.amount, tile.element)
    UI.setMessage(`You pry it open — +${loot.amount} gold!`)
  }

  // Swap static chest image to animated gif, wait for it to finish, then collect
  const chestImg = tile.element?.querySelector('.tile-icon-img')
  const iconWrap = tile.element?.querySelector('.tile-icon-wrap')
  const GIF_DURATION = 750 // ms — one play-through of chest.gif

  if (chestImg) chestImg.src = 'assets/sprites/Items/chest.gif?t=' + Date.now()

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
      // Pre-roll the loot so it's fixed when the player taps to open
      const roll = Math.random()
      tile.chestLoot = roll < 0.02
        ? { type: 'fire-ring' }
        : roll < 0.04
          ? { type: 'mana-ring' }
          : roll < 0.14
            ? { type: 'lantern' }
            : roll < 0.42
              ? { type: 'potion-red' }
              : roll < 0.65
                ? { type: 'potion-blue' }
                : { type: 'gold', amount: _rand(...CONFIG.chest.goldDrop) }
      tile.chestReady = true
      if (tile.element) tile.element.classList.add('chest-ready')
      UI.setMessage('A locked chest — tap again to pry it open.')
      UI.showRetreat()
      break
    }

    case 'trap': {
      const rawDmg = _rand(...CONFIG.trap.damage)
      const dmg    = Math.max(1, rawDmg - (p.trapReduction ?? 0))
      EventBus.emit('audio:play', { sfx: 'trap' })
      _takeDamage(dmg, tile.element)
      const reduced = rawDmg !== dmg ? ` (reduced from ${rawDmg})` : ''
      UI.setMessage(`A trap snaps shut! You take ${dmg} damage${reduced}.`)
      if (!GameState.is(States.DEATH)) UI.showRetreat()
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
      _takeDamage(dmg, tile.element)
      UI.shakeTile(tile.element)
      if (!GameState.is(States.DEATH)) {
        if (!p.noLockOnReveal) {
          TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
        }
        UI.markTileEnemyAlive(tile.element)
        const label = tile.enemyData?.isBoss ? `⚠️ BOSS: ${tile.enemyData.label}` : '⚡ Fast enemy'
        UI.setMessage(`${label} strikes first! (-${dmg} HP) Tap it to fight.`, true)
        UI.showRetreat()
        EventBus.emit('tile:locked', {})
      }
      break
    }

    case 'enemy':
      if (!p.noLockOnReveal) {
        TileEngine.lockAdjacent(tile.row, tile.col, UI.lockTile.bind(UI))
      }
      UI.markTileEnemyAlive(tile.element)
      // Fast enemies get a free strike the moment they're revealed
      if (tile.enemyData?.attributes?.includes('fast')) {
        const ambushDmg = Array.isArray(tile.enemyData.dmg) ? tile.enemyData.dmg[0] : tile.enemyData.dmg
        _takeDamage(ambushDmg, tile.element, false, tile.enemyData)
        UI.setMessage(`⚡ The ${tile.enemyData.label} strikes first for ${ambushDmg}! Tap to fight back.`)
      } else {
        UI.setMessage(`A ${tile.enemyData?.label ?? 'enemy'} lurks. Tap it to fight.`)
      }
      UI.showRetreat()
      EventBus.emit('tile:locked', {})
      break

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

  const result = CombatResolver.resolveFight(run.player, tile.enemyData)

  let playerDmg = result.playerDmg + (run.player.damageBonus ?? 0)
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) playerDmg = Math.round(playerDmg * 2)
  if (run.player.beastBonus  && isBeast)  playerDmg = Math.round(playerDmg * 2)

  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast) ? ' (2×!)' : ''
  const newEnemyHP = _save.settings.cheats?.instantKill ? 0 : Math.max(0, tile.enemyData.currentHP - playerDmg)
  const killsEnemy = newEnemyHP <= 0

  // Fire Ring: 10% chance to ignite on hit
  const hasFireRing = run.player.inventory.some(e => e.id === 'fire-ring')
  const ignite = hasFireRing && !killsEnemy && Math.random() < 0.10

  // Stun: enemy is stunned if stunTurns > 0
  const isStunned = (tile.enemyData.stunTurns ?? 0) > 0

  UI.setPortraitAnim('attack')
  UI.spawnSlash(tile.element)
  EventBus.emit('audio:play', { sfx: Math.random() < 0.5 ? 'hit' : 'hit2' })

  // Slime split: first kill restores half HP and splits visually
  const canSplit = killsEnemy
    && tile.enemyData?.attributes?.includes('splits')
    && !tile.enemyData.hasSplit

  if (killsEnemy && !canSplit) {
    // Fatal blow — enemy never gets to counter
    setTimeout(() => {
      tile.enemyData.currentHP = 0
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! +${result.goldDrop} gold.`)
      _gainGold(result.goldDrop, tile.element)
      _gainXP(result.xpDrop ?? 0, tile.element)
      UI.setPortraitAnim('idle')
      _combatBusy = false
      _endCombatVictory(tile)
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
      UI.setPortraitAnim('idle')
      _combatBusy = false
    }, 400)
  } else {
    setTimeout(() => {
      tile.enemyData.currentHP = newEnemyHP

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
          _gainGold(result.goldDrop, tile.element)
          _gainXP(result.xpDrop ?? 0, tile.element)
          UI.setPortraitAnim('idle')
          _combatBusy = false
          _endCombatVictory(tile)
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
        UI.setPortraitAnim('hit')
      }

      setTimeout(() => {
        _setEnemySprite(tile, 'idle')
        UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
        EventBus.emit('combat:damage', { amount: playerDmg, target: 'enemy' })
        UI.setPortraitAnim('idle')
        const stunMsg = isStunned ? ' (stunned — no counter!)' : ''
        UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}${stunMsg}! Enemy has ${tile.enemyData.currentHP} HP left.`)
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        _combatBusy = false
      }, isStunned ? 200 : 500)
    }, 400)
  }
}

// ── Spell ─────────────────────────────────────────────────────

function slamAction() {
  if (!(_save.warrior?.upgrades ?? []).includes('slam')) return
  if (_combatBusy) return
  const cost = WARRIOR_UPGRADES.slam.manaCost
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
  UI.updateMana(run.player.mana, run.player.maxMana)

  _combatBusy = true
  UI.setPortraitAnim('attack')
  UI.setMessage(`💥 Slam! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} struck!`)

  // Stagger slash effects across targets
  targets.forEach((target, i) => {
    setTimeout(() => {
      UI.spawnSlash(target.element)
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - 1)
      UI.spawnFloat(target.element, '💥 1', 'xp')
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

function spellAction() {
  const effectiveCost = Math.max(1, CONFIG.spell.manaCost - (run.player.spellCostReduction ?? 0))
  if (run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }
  // Toggle targeting mode
  _spellTargeting = !_spellTargeting
  UI.setSpellTargeting(_spellTargeting, effectiveCost)
  if (_spellTargeting) {
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

  _lanternTargeting = !_lanternTargeting
  UI.setLanternTargeting(_lanternTargeting)
  if (_lanternTargeting) {
    UI.setMessage('🏮 Lantern lit — tap any hidden tile to reveal it.')
  } else {
    UI.setMessage('Lantern extinguished.')
  }
}

function _useLanternOn(tile) {
  _lanternTargeting = false
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

function blindingLightAction() {
  if (!(_save.warrior?.upgrades ?? []).includes('blinding-light')) return
  if (_combatBusy) return
  const cost = WARRIOR_UPGRADES['blinding-light'].manaCost
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana for Blinding Light!', true)
    return
  }

  _blindingLightTargeting = !_blindingLightTargeting
  UI.setBlindingLightActive(_blindingLightTargeting)
  if (_blindingLightTargeting) {
    UI.setMessage('✨ Choose an enemy to blind.')
  } else {
    UI.setMessage('Blinding Light cancelled.')
  }
}

function _castBlindingLight(tile) {
  _blindingLightTargeting = false
  UI.setBlindingLightActive(false)

  const cost = WARRIOR_UPGRADES['blinding-light'].manaCost
  if (run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  run.player.mana = Math.max(0, run.player.mana - cost)
  UI.updateMana(run.player.mana, run.player.maxMana)

  tile.enemyData.stunTurns = (tile.enemyData.stunTurns ?? 0) + 2
  UI.spawnFloat(tile.element, '✨ Stunned!', 'mana')
  UI.flashTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'spell' })
  UI.setMessage(`✨ Blinding Light! ${tile.enemyData.label} is stunned for 2 turns.`)
}

function _castSpell(tile) {
  _spellTargeting = false
  const effectiveCost = Math.max(1, CONFIG.spell.manaCost - (run.player.spellCostReduction ?? 0))
  UI.setSpellTargeting(false, effectiveCost)

  if (run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  const result = CombatResolver.resolveSpell(run.player, tile.enemyData)

  let spellDmg = result.damage
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (run.player.undeadBonus && isUndead) spellDmg = Math.round(spellDmg * 2)
  if (run.player.beastBonus  && isBeast)  spellDmg = Math.round(spellDmg * 2)

  UI.setPortraitAnim('attack')
  run.player.mana -= effectiveCost
  UI.updateMana(run.player.mana, run.player.maxMana)
  UI.spawnFloat(tile.element, `✨ ${spellDmg}`, 'mana')
  const bonusSuffix = (run.player.undeadBonus && isUndead) || (run.player.beastBonus && isBeast)
    ? ' (2×!)' : ''
  tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - spellDmg)
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
  UI.markTileSlain(tile.element)

  if (run.player.onKillHeal > 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.onKillHeal)
    UI.spawnFloat(tile.element, `+${run.player.onKillHeal} HP`, 'heal')
    UI.updateHP(run.player.hp, run.player.maxHp)
  }

  EventBus.emit('audio:play', { sfx: 'gold' })
  EventBus.emit('combat:end', { outcome: 'victory' })
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

function _nextFloor() {
  run.floor++
  UI.setMessage(`🚪 Descending to floor ${run.floor}...`)
  EventBus.emit('run:floorAdvance', { newFloor: run.floor })
  setTimeout(() => {
    GameState.set(States.BOOT)
    _startFloor()
  }, 800)
}

// ── Player stat helpers ──────────────────────────────────────

function _takeDamage(amount, tileEl, skipPortraitAnim = false, killerData = null) {
  if (_save.settings.cheats?.godMode) return
  const scaled    = Math.round(amount * (run.player.damageTakenMult ?? 1))
  const effective = Math.max(1, scaled - (run.player.damageReduction ?? 0))
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

function _triggerLevelUp() {
  const char    = _charKey()
  const choices = ProgressionSystem.getChoices(run.player.abilities, char)
  if (choices.length === 0) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 10)
    UI.updateHP(run.player.hp, run.player.maxHp)
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
    UI.hideLevelUpOverlay()
    UI.updateHP(run.player.hp, run.player.maxHp)
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.updateGold(run.player.gold)
    {
      const [d0, d1] = _playerDamageRange(run.player)
      UI.updateDamageRange(d0, d1)
    }
    const def = ProgressionSystem.getAbilityDef(abilityId, char)
    UI.setMessage(`${def?.name ?? abilityId} acquired! Level ${run.player.level}.`)
    GameState.transition(States.FLOOR_EXPLORE)
  })
}

function _xpNeeded() {
  return CONFIG.xp.levelUpAt * run.player.level
}

function _playerDamageRange(player) {
  const base = player.isRanger ? RANGER_BASE.damage : CONFIG.player.baseDamage
  const bonus = player.damageBonus ?? 0
  const b = Array.isArray(base) ? base[0] : base
  return [b + bonus, b + bonus]
}

// ── Death ────────────────────────────────────────────────────

function _die(killerData = null) {
  _spellTargeting         = false
  _combatBusy             = false
  _lanternTargeting       = false
  _blindingLightTargeting = false
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

function useItem(id) {
  const inv   = run.player.inventory
  const entry = inv.find(e => e.id === id)
  if (!entry) return
  const item = ITEMS[id]
  if (!item) return

  const { effect } = item

  // Passive items: just show a message explaining they're always active
  if (effect.type === 'passive-fire-ring' || effect.type === 'passive-mana-ring') {
    UI.setMessage(`${item.name} is a passive item — it's always active in your bag.`, true)
    return
  }

  // Lantern: delegate to dedicated action
  if (effect.type === 'lantern') {
    lanternAction()
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
  } else if (effect.type === 'mana') {
    const missing = run.player.maxMana - run.player.mana
    if (missing <= 0) { UI.setMessage('Already at full mana!', true); return }
    const restored = Math.min(effect.amount, missing)
    run.player.mana += restored
    UI.updateMana(run.player.mana, run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
  }

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
}

function getInventory() { return run?.player.inventory ?? [] }

// ── Cheat helpers ─────────────────────────────────────────────

function applyCheat(key, enabled) {
  if (!_save.settings.cheats) _save.settings.cheats = {}
  _save.settings.cheats[key] = enabled

  if (!run) return
  if (key === 'gold999' && enabled) {
    run.player.gold = 999
    UI.updateGold(run.player.gold)
  }
  if (key === 'xp999' && enabled) {
    run.player.xp = 999
    UI.updateXP(run.player.xp, 1)
  }
}

export default {
  init,
  getSave() { return _save },
  newGame,
  returnToMenu,
  onTileTap,
  spellAction,
  slamAction,
  blindingLightAction,
  lanternAction,
  doRetreat,
  applyCheat,
  useItem,
  getInventory,
}
