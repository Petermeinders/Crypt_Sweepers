import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { session } from '../core/RunContext.js'
import { ITEMS } from '../data/items.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'
import { isCombatCommitmentLocked } from './TileTapRouter.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'


export async function addToBackpack(ctx, id) {
  const inv   = session.run.player.inventory
  const item  = ITEMS[id]
  if (!item) return
  // Philosopher's Coin: potions become gold instead
  if ((id === 'potion-red' || id === 'potion-blue') && inv.some(e => e?.id === 'philosophers-coin')) {
    const goldAmt = id === 'potion-red' ? 3 : 5
    session.run.player.gold += goldAmt
    UI.updateGold(session.run.player.gold)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🥇 +${goldAmt}🪙`, 'gold')
    return
  }
  if (item.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    const existing = inv.find(e => e?.id === id && e.qty < maxS)
    if (existing) {
      existing.qty++
      return
    }
  }
  // Count only real items (nulls are empty slots left by gear swaps)
  const usedSlots = inv.filter(e => e !== null).length
  if (usedSlots >= BACKPACK_MAX_SLOTS) {
    EventBus.emit('backpack:full', { id })
    return
  }
  // Fill a vacated null slot before growing the array
  const nullIdx = inv.indexOf(null)
  if (nullIdx >= 0) {
    inv[nullIdx] = { id, qty: 1 }
  } else {
    inv.push({ id, qty: 1 })
  }
  // Trinket Codex: show discovery card first time this trinket is seen
  if (TrinketCodex.registerIfNew(session.save, id)) {
    Logger.info(`[GameController] New trinket discovered: ${id} (floor ${session.run?.floor})`)
    await SaveManager.save(session.save).catch(() => {})
    await UI.showTrinketDiscovery(id)
  }
  // Blood Pact: apply on equip
  if (id === 'blood-pact') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 2
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp - 3)
    session.run.player.hp = Math.min(session.run.player.hp, session.run.player.maxHp)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 Pact!', 'damage')
  }
  // Forsaken Idol: halve max HP on equip
  if (id === 'forsaken-idol') {
    const halved = Math.max(1, Math.floor(session.run.player.maxHp / 2))
    session.run.player.maxHp = halved
    session.run.player.hp = Math.min(session.run.player.hp, halved)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🗿 Max HP halved!', 'damage')
  }
  // Hollowed Acorn: +10 max mana on equip
  if (id === 'hollowed-acorn') {
    session.run.player.maxMana = (session.run.player.maxMana ?? CONFIG.player.maxMana) + 10
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🌰 +10 Mana!', 'mana')
  }
  // Mana Crucible: +15 max mana on equip
  if (id === 'mana-crucible') {
    session.run.player.maxMana = (session.run.player.maxMana ?? CONFIG.player.maxMana) + 15
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🫙 +15 Mana!', 'mana')
  }
  // Sanguine Covenant: +3 dmg, halve max HP on equip
  if (id === 'sanguine-covenant') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 3
    const halved = Math.max(1, Math.floor(session.run.player.maxHp / 2))
    session.run.player.maxHp = halved
    session.run.player.hp    = Math.min(session.run.player.hp, halved)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚗️ Covenant!', 'damage')
  }
  // Razor's Edge: −10 max HP on equip
  if (id === 'razors-edge') {
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp - 10)
    session.run.player.hp    = Math.min(session.run.player.hp, session.run.player.maxHp)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '💠 −10 Max HP', 'damage')
  }
  // Honed Edge: +1 permanent attack damage
  if (id === 'honed-edge') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 1
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚔️ +1 ATK', 'xp')
  }
}

export function canAddToBackpack(ctx, id) {
  const inv  = session.run.player.inventory
  const item = ITEMS[id]
  if (!item) return false
  if (item.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    if (inv.some(e => e?.id === id && e.qty < maxS)) return true
  }
  return inv.filter(e => e !== null).length < BACKPACK_MAX_SLOTS
}


export function useItem(ctx, id) {
  const inv   = session.run.player.inventory
  const entry = inv.find(e => e?.id === id)
  if (!entry) return
  const item = ITEMS[id]
  if (!item) return

  const { effect } = item

  if (effect.type.startsWith('passive-')) {
    UI.setMessage(`${item.name} is a passive item — it's always active in your bag.`, true)
    return
  }

  if (effect.type === 'lantern') {
    ctx.lanternAction()
    return
  }
  if (effect.type === 'dowsing-rod') {
    ctx.dowsingRodAction()
    return
  }
  if (effect.type === 'spyglass') {
    ctx.spyglassAction()
    return
  }
  if (effect.type === 'hourglass-sand') {
    ctx.hourglassAction()
    return
  }
  if (effect.type === 'temporal-wick') {
    if (!session.run._hourglassSnapshot) { UI.setMessage('Nothing to rewind yet.', true); return }
    if (session.tap.combatBusy) { UI.setMessage('Not while combat is resolving.', true); return }
    if (isCombatCommitmentLocked()) { UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true); return }
    if (GameState.is(States.LEVEL_UP)) { UI.setMessage('Cannot rewind during level-up.', true); return }
    const p = session.run.player
    if (p.gold < 1) { UI.setMessage('You need 1 gold to use Temporal Wick.', true); return }
    ctx.restoreHourglassSnapshot(session.run._hourglassSnapshot)
    session.tap.spyglassTargeting = false; session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
    p.mana = 0; p.hp -= 1; p.gold -= 1
    const wickHeal = Math.max(1, Math.floor(p.maxHp * 0.15))
    p.hp = Math.min(p.maxHp, p.hp + wickHeal)
    UI.updateMana(p.mana, p.maxMana)
    UI.updateHP(p.hp, p.maxHp)
    UI.updateGold(p.gold)
    if (p.hp <= 0) { ctx.die(null, { deathCause: 'temporal_wick' }); return }
    UI.setMessage(`⏳ The wick flickers — your last step is undone. +${wickHeal} HP restored.`)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'navigators-chart') {
    if (isCombatCommitmentLocked()) {
      UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
      return
    }
    if (session.run.player.navigatorsChartUsed) {
      UI.setMessage("🗺️ Navigator's Chart — already used this floor. Renews on the next floor.", true); return
    }
    session.run.player.navigatorsChartUsed = true
    const grid = TileEngine.getGrid()
    const unrevealed = []
    for (const row of grid) { for (const t of row) { if (!t.revealed) unrevealed.push(t) } }
    unrevealed.forEach((t, i) => setTimeout(() => ctx.revealTile(t), i * 50))
    UI.setMessage("🗺️ Navigator's Chart — the entire floor is revealed!")
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'field-kit') {
    if (session.run.player.mana < 5) { UI.setMessage('Not enough mana! Field Kit costs 5 mana.', true); return }
    session.run.player.mana -= 5
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    session.run.player.burnStacks = 0; UI.setBurnOverlay(0)
    session.run.player.poisonStacks = 0; UI.setPlayerPoison(0)
    session.run.player.tearyEyesTurns = 0; UI.setTearyEyes(0)
    session.run.player.freezingHitStacks = 0; UI.setFreezingHit(0)
    if (session.run.player.corruptionStacks > 0) {
      if (session.run.player.corruptionBaseMaxHp)   { session.run.player.maxHp  = session.run.player.corruptionBaseMaxHp;  session.run.player.corruptionBaseMaxHp  = 0 }
      if (session.run.player.corruptionBaseMaxMana) { session.run.player.maxMana = session.run.player.corruptionBaseMaxMana; session.run.player.corruptionBaseMaxMana = 0 }
      session.run.player.corruptionStacks = 0; UI.setCorruption(0)
    }
    const kitHeal = Math.min(5, session.run.player.maxHp - session.run.player.hp)
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + kitHeal)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🧰 +${kitHeal} HP`, 'heal')
    UI.setMessage(`🧰 Field Kit — +${kitHeal} HP and all debuffs cleared. (5 mana)`)
    EventBus.emit('audio:play', { sfx: 'heal' })
    return
  }
  if (effect.type === 'twin-blades') {
    if (session.run.player.mana < 5) { UI.setMessage('Not enough mana! Twin Blades costs 5 mana.', true); return }
    session.run.player.mana -= 5
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    session.tap.twinBladesTargeting = true
    UI.setMessage('⚔️ Twin Blades — tap any revealed living enemy to strike for 5 damage (no counter). (5 mana)')
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'smoke-bomb') {
    const combatTile = session.run.activeCombatTile
    if (!combatTile || !combatTile.enemyData || combatTile.enemyData._slain) {
      UI.setMessage('Smoke Bomb can only be used during combat.', true); return
    }
    if (session.run.player.mana < 5) { UI.setMessage('Not enough mana! Smoke Bomb costs 5 mana.', true); return }
    session.run.player.mana -= 5
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 3
    UI.spawnFloat(combatTile.element, '💨 Stunned 3!', 'xp')
    UI.setMessage('💨 Smoke Bomb — enemy stunned for 3 turns! (5 mana)')
    UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }

  // ── Common consumables ────────────────────────────────────────
  if (effect.type === 'rope-coil') {
    if (session.run.player.trapImmune) { UI.setMessage('Rope Coil already active — next trap is blocked.', true); return }
    session.run.player.trapImmune = true
    UI.spawnFloat(document.getElementById('hud-portrait'), '🪢 Ready!', 'heal')
    UI.setMessage('🪢 Rope Coil readied — the next trap you reveal will be completely negated.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'bandage-roll') {
    const immediate = 3
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + immediate)
    session.run.player.regenTurns   = 3
    session.run.player.regenPerTurn = 1
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🩹 +${immediate} HP`, 'heal')
    UI.setMessage(`🩹 Bandage applied — +${immediate} HP now, +1 HP per turn for 3 turns.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'heal' })
    return
  }
  if (effect.type === 'shield-shard') {
    if (session.run.player.shieldShard) { UI.setMessage('Shield Shard already active — next hit is blocked.', true); return }
    session.run.player.shieldShard = true
    UI.spawnFloat(document.getElementById('hud-portrait'), '🛡️ Raised!', 'heal')
    UI.setMessage('🛡️ Shield Shard raised — the very next enemy hit will be absorbed completely.')
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }
  if (effect.type === 'smelling-salts') {
    session.run.player.tearyEyesTurns = 0
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
    session.tap.throwingKnifeTargeting = true
    UI.setMessage('🗡️ Throwing Knife — tap any revealed living enemy to strike for 3 damage (no counter).')
    EventBus.emit('audio:play', { sfx: 'menu' })
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    return
  }
  if (effect.type === 'flash-powder') {
    const combatTile = session.run.activeCombatTile
    if (!combatTile || !combatTile.enemyData || combatTile.enemyData._slain) {
      UI.setMessage('Flash Powder can only be used during combat.', true)
      return
    }
    combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 2
    UI.spawnFloat(combatTile.element, '✨ Stunned!', 'xp')
    UI.setMessage('✨ Flash Powder — enemy stunned for 2 turns! No counter-attacks.')
    UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }
  if (effect.type === 'rusty-nail') {
    session.tap.rustyNailTargeting = true
    UI.setMessage('📌 Rusty Nail — tap any revealed living enemy to poison them (1 dmg/turn × 5 turns).')
    EventBus.emit('audio:play', { sfx: 'menu' })
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    return
  }
  if (effect.type === 'loose-pouch') {
    const gold = ctx.rand(3, 6)
    ctx.gainGold(gold, document.getElementById('hud-portrait'), true)
    UI.setMessage(`💰 Loose Pouch — +${gold} gold spills out.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'gold' })
    return
  }
  if (effect.type === 'whetstone') {
    session.run.player.whettsoneHits = (session.run.player.whettsoneHits ?? 0) + 3
    UI.spawnFloat(document.getElementById('hud-portrait'), '⚔️ +1 dmg ×3', 'xp')
    UI.setMessage(`🪨 Whetstone — your next 3 melee hits deal +1 damage.`)
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('audio:play', { sfx: 'hit' })
    return
  }

  if (effect.type === 'bone-dice') {
    if (session.run.player.mana < 10) { UI.setMessage('Not enough mana! Bone Dice costs 10 mana.', true); return }
    session.run.player.mana -= 10
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    const grid = TileEngine.getGrid()
    let count = 0
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed && t.enemyData && !t.enemyData._slain) {
          TileEngine.refreshEnemyDamageOnTile(t, session.run.floor)
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
    const missing = session.run.player.maxHp - session.run.player.hp
    if (missing <= 0) { UI.setMessage('Already at full health!', true); return }
    const healed = Math.min(effect.amount, missing)
    session.run.player.hp += healed
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${healed} HP`, 'heal')
    UI.setMessage(`❤️ You drink a ${item.name} and restore ${healed} HP.`)
  } else if (effect.type === 'mana') {
    const missing = session.run.player.maxMana - session.run.player.mana
    if (missing <= 0) { UI.setMessage('Already at full mana!', true); return }
    const hasAcorn  = session.run.player.inventory.some(e => e?.id === 'hollowed-acorn')
    const baseAmt   = hasAcorn ? Math.max(1, Math.floor(effect.amount / 2)) : effect.amount
    const restored  = Math.min(baseAmt, missing)
    session.run.player.mana += restored
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
    UI.setMessage(`🔵 You drink a ${item.name} and restore ${restored} mana.${hasAcorn ? ' (Hollowed Acorn halved)' : ''}`)
  } else if (effect.type === 'mystery-potion') {
    const roll = Math.random()
    entry.qty--
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    if (roll < 1 / 3) {
      // Heal (same as red potion)
      const missing = session.run.player.maxHp - session.run.player.hp
      if (missing <= 0) {
        UI.setMessage("🤍 The mystery potion fizzes... but you're already at full health.")
      } else {
        const healed = Math.min(5, missing)
        session.run.player.hp += healed
        UI.updateHP(session.run.player.hp, session.run.player.maxHp)
        UI.spawnFloat(document.getElementById('hud-portrait'), `+${healed} HP`, 'heal')
        UI.setMessage(`🤍 The mystery potion tastes sweet — it heals ${healed} HP.`)
      }
    } else if (roll < 2 / 3) {
      // Mana (same as blue potion)
      const missing = session.run.player.maxMana - session.run.player.mana
      if (missing <= 0) {
        UI.setMessage("🤍 The mystery potion crackles... but your mana is already full.")
      } else {
        const hasAcorn = session.run.player.inventory.some(e => e?.id === 'hollowed-acorn')
        const baseAmt  = hasAcorn ? Math.max(1, Math.floor(20 / 2)) : 20
        const restored = Math.min(baseAmt, missing)
        session.run.player.mana += restored
        UI.updateMana(session.run.player.mana, session.run.player.maxMana)
        UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
        UI.setMessage(`🤍 The mystery potion hums with energy — restores ${restored} mana.${hasAcorn ? ' (Hollowed Acorn halved)' : ''}`)
      }
    } else {
      // Damage — same magnitude as the heal case
      const dmg = 5
      session.run.player.hp = Math.max(0, session.run.player.hp - dmg)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(document.getElementById('hud-portrait'), `-${dmg} HP`, 'damage')
      UI.setMessage(`🤍 The mystery potion turns bitter — it burns for ${dmg} damage!`, true)
      if (session.run.player.hp <= 0) { ctx.die(null, { deathCause: 'mystery_potion' }); return }
    }
    return  // qty already decremented above
  }

  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
}


export function dropItem(ctx, id) {
  if (!session.run) return
  const inv = session.run.player.inventory
  const entry = inv.find(e => e?.id === id)
  if (!entry) return
  const item = ITEMS[id]
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
  // Blood Pact: revert on drop
  if (id === 'blood-pact') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 2)
    session.run.player.maxHp += 3
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 Pact broken', 'heal')
  }
  // Forsaken Idol: restore max HP on drop
  if (id === 'forsaken-idol') {
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp * 2)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🗿 Max HP restored', 'heal')
  }
  // Hollowed Acorn: revert max mana on drop
  if (id === 'hollowed-acorn') {
    session.run.player.maxMana = Math.max(1, (session.run.player.maxMana ?? CONFIG.player.maxMana) - 10)
    session.run.player.mana = Math.min(session.run.player.mana, session.run.player.maxMana)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🌰 −10 Mana', 'damage')
  }
  // Mana Crucible: revert max mana on drop
  if (id === 'mana-crucible') {
    session.run.player.maxMana = Math.max(1, (session.run.player.maxMana ?? CONFIG.player.maxMana) - 15)
    session.run.player.mana = Math.min(session.run.player.mana, session.run.player.maxMana)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🫙 −15 Mana', 'damage')
  }
  // Sanguine Covenant: revert on drop
  if (id === 'sanguine-covenant') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 3)
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp * 2)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  // Razor's Edge: restore max HP on drop
  if (id === 'razors-edge') {
    session.run.player.maxHp += 10
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }
  // Honed Edge: revert damage on drop
  if (id === 'honed-edge') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 1)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  UI.setMessage(item ? `Dropped ${item.name}.` : 'Item removed.')
  EventBus.emit('audio:play', { sfx: 'menu' })
}

/** Trash the item currently sitting in the backpack:full pending slot (no-op if pack isn't full). */
export async function forceReplaceItem(ctx, oldId, newId) {
  if (!session.run) return
  dropItem(oldId)
  await addToBackpack(ctx, newId)
  EventBus.emit('inventory:changed')
}

