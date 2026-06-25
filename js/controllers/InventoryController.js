import { CONFIG } from '../config.js'
import { isFoeTileType } from '../data/tiles.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { session } from '../core/RunContext.js'
import { ITEMS } from '../data/items.js'
import { GEMS } from '../data/gems.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'

function _backpackMaxSlots() {
  return BACKPACK_MAX_SLOTS + (session.save?.meta?.backpackBonusSlots ?? 0)
}
import { isCombatCommitmentLocked } from './TileTapRouter.js'
import { adjustScrap, gemTrashScrapYield, trinketTrashScrapYield, trinketTrashGoldYield, adjustPlayerStat } from './GearController.js'

const HOLLOWED_ACORN_MANA_PCT = 10

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

/** One-shot stat changes when a trinket enters the player's owned set. */
export function applyTrinketEquipEffects(ctx, id, { silent = false } = {}) {
  if (!session.run) return
  const float = (text, kind) => {
    if (!silent) UI.spawnFloat(document.getElementById('hud-portrait'), text, kind)
  }
  if (id === 'blood-pact') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 2
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp - 3)
    session.run.player.hp = Math.min(session.run.player.hp, session.run.player.maxHp)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    float('🩸 Pact!', 'damage')
  }
  if (id === 'forsaken-idol') {
    const halved = Math.max(1, Math.floor(session.run.player.maxHp / 2))
    session.run.player.maxHp = halved
    session.run.player.hp = Math.min(session.run.player.hp, halved)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    float('🗿 Max HP halved!', 'damage')
  }
  if (id === 'hollowed-acorn') {
    adjustPlayerStat('maxManaPct', HOLLOWED_ACORN_MANA_PCT)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    float('🌰 +10% Mana!', 'mana')
  }
  if (id === 'mana-crucible') {
    session.run.player.maxMana = (session.run.player.maxMana ?? CONFIG.player.maxMana) + 15
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    float('🫙 +15 Mana!', 'mana')
  }
  if (id === 'sanguine-covenant') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 3
    const halved = Math.max(1, Math.floor(session.run.player.maxHp / 2))
    session.run.player.maxHp = halved
    session.run.player.hp    = Math.min(session.run.player.hp, halved)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    float('⚗️ Covenant!', 'damage')
  }
  if (id === 'razors-edge') {
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp - 10)
    session.run.player.hp    = Math.min(session.run.player.hp, session.run.player.maxHp)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    float('💠 −10 Max HP', 'damage')
  }
  if (id === 'honed-edge') {
    session.run.player.damageBonus = (session.run.player.damageBonus ?? 0) + 1
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    float('⚔️ +1 ATK', 'xp')
  }
}

/** Undo one-shot stat changes when a trinket leaves the player's owned set. */
export function revertTrinketEquipEffects(ctx, id, { silent = false } = {}) {
  if (!session.run) return
  const float = (text, kind) => {
    if (!silent) UI.spawnFloat(document.getElementById('hud-portrait'), text, kind)
  }
  if (id === 'blood-pact') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 2)
    session.run.player.maxHp += 3
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
    float('🩸 Pact broken', 'heal')
  }
  if (id === 'forsaken-idol') {
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp * 2)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    float('🗿 Max HP restored', 'heal')
  }
  if (id === 'hollowed-acorn') {
    adjustPlayerStat('maxManaPct', -HOLLOWED_ACORN_MANA_PCT)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    float('🌰 −10% Mana', 'damage')
  }
  if (id === 'mana-crucible') {
    session.run.player.maxMana = Math.max(1, (session.run.player.maxMana ?? CONFIG.player.maxMana) - 15)
    session.run.player.mana = Math.min(session.run.player.mana, session.run.player.maxMana)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    float('🫙 −15 Mana', 'damage')
  }
  if (id === 'sanguine-covenant') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 3)
    session.run.player.maxHp = Math.max(1, session.run.player.maxHp * 2)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
  if (id === 'razors-edge') {
    session.run.player.maxHp += 10
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }
  if (id === 'honed-edge') {
    session.run.player.damageBonus = Math.max(0, (session.run.player.damageBonus ?? 0) - 1)
    const [d0, d1] = ctx.playerDamageRange(session.run.player)
    UI.updateDamageRange(d0, d1)
  }
}


export async function addToBackpack(ctx, id) {
  const inv   = session.run.player.inventory
  const item  = ITEMS[id]
  const gem   = !item ? GEMS[id] : null
  if (!item && !gem) return
  // Philosopher's Coin: potions become gold instead
  if (item && (id === 'potion-red' || id === 'potion-blue') && (session.run.player.safePocketTrinket?.id === 'philosophers-coin' || inv.some(e => e?.id === 'philosophers-coin'))) {
    const goldAmt = id === 'potion-red' ? 3 : 5
    session.run.player.gold += goldAmt
    UI.updateGold(session.run.player.gold)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🥇 +${goldAmt}🪙`, 'gold')
    return
  }
  // Potion Flask: route HP/mana potions to the orb instead of backpack
  if (item && (id === 'potion-red' || id === 'potion-blue')) {
    const p = session.run.player
    const isHp = id === 'potion-red'
    const field = isHp ? 'hpPotions' : 'manaPotions'
    const MAX_FLASK = 5
    if ((p[field] ?? 0) >= MAX_FLASK) {
      p.gold = (p.gold ?? 0) + 1
      UI.updateGold(p.gold)
      UI.setMessage(`${isHp ? '❤️' : '🔵'} Flask full — potion auto-trashed for +1🪙.`)
      UI.spawnFloat(document.getElementById('hud-portrait'), '+1🪙', 'gold')
      return
    }
    p[field] = (p[field] ?? 0) + 1
    UI.updateOrbPotions(p.hpPotions ?? 0, p.manaPotions ?? 0)
    UI.setMessage(`${isHp ? '❤️' : '🔵'} ${isHp ? 'HP' : 'Mana'} Potion stored in flask (${p[field]}/5).`)
    return
  }
  if (item?.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    const existing = inv.find(e => e?.id === id && e.qty < maxS)
    if (existing) {
      existing.qty++
      return
    }
  }
  // Count only real items (nulls are empty slots left by gear swaps)
  const usedSlots = inv.filter(e => e !== null).length
  if (usedSlots >= _backpackMaxSlots()) {
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
  if (item) {
    // Telemetry: count trinkets (non-potion, non-tool consumables)
    const isTrinket = item.rarity && !id.startsWith('potion') && !['rope-coil','bandage-roll','shield-shard','smelling-salts','sonic-ear','loose-pouch','whetstone','field-kit','bone-dice','navigators-chart','lantern','spyglass','smith-tools','scavengers-bag','dowsing-rod','throwing-knife','flash-powder','rusty-nail','twin-blades','smoke-bomb'].includes(id)
    if (isTrinket && session.run?.telemetry) {
      session.run.telemetry.trinketsFound = (session.run.telemetry.trinketsFound ?? 0) + 1
    }
    // Trinket Codex: show discovery card first time this trinket is seen
    if (TrinketCodex.registerIfNew(session.save, id)) {
      Logger.info(`[GameController] New trinket discovered: ${id} (floor ${session.run?.floor})`)
      await SaveManager.save(session.save).catch(() => {})
      await UI.showTrinketDiscovery(id)
    }
    applyTrinketEquipEffects(ctx, id)
  }
}

export function canAddToBackpack(ctx, id) {
  const inv  = session.run.player.inventory
  const item = ITEMS[id]
  if (!item && !GEMS[id]) return false
  if (item?.stackable) {
    const maxS = item.maxStack ?? Number.POSITIVE_INFINITY
    if (inv.some(e => e?.id === id && e.qty < maxS)) return true
  }
  return inv.filter(e => e !== null).length < _backpackMaxSlots()
}


function _inventoryEntry(inv, id, inventoryIndex = null) {
  if (inventoryIndex != null) {
    const entry = inv[inventoryIndex]
    return entry?.id === id ? entry : null
  }
  return inv.find(e => e?.id === id) ?? null
}

/** Merge duplicate stackable slots — smaller stacks drain into larger. Mutates inventory array. */
export function mergeDuplicateStacks(inventory) {
  const inv = inventory
  let changed = false

  const byId = new Map()
  for (let i = 0; i < inv.length; i++) {
    const e = inv[i]
    if (!e?.id) continue
    const item = ITEMS[e.id]
    if (!item?.stackable) continue
    if (!byId.has(e.id)) byId.set(e.id, [])
    byId.get(e.id).push(i)
  }

  for (const id of byId.keys()) {
    const maxS = ITEMS[id].maxStack ?? Number.POSITIVE_INFINITY
    const indices = byId.get(id)
    while (true) {
      const live = indices.filter(i => inv[i]?.qty > 0)
      if (live.length < 2) break
      live.sort((a, b) => inv[a].qty - inv[b].qty)
      const srcIdx = live[0]
      const destinations = [...live].sort((a, b) => inv[b].qty - inv[a].qty)
      let merged = false
      for (const dstIdx of destinations) {
        if (dstIdx === srcIdx) continue
        const room = maxS - inv[dstIdx].qty
        if (room <= 0) continue
        const move = Math.min(inv[srcIdx].qty, room)
        inv[dstIdx].qty += move
        inv[srcIdx].qty -= move
        changed = true
        merged = true
        if (inv[srcIdx].qty <= 0) {
          inv[srcIdx] = null
          break
        }
      }
      if (!merged) break
    }
  }

  return changed
}

export function consolidateStackables(ctx) {
  if (!session.run) return false
  const changed = mergeDuplicateStacks(session.run.player.inventory)
  if (changed) EventBus.emit('inventory:changed')
  return changed
}

export function useItemAtIndex(ctx, index) {
  const id = session.run?.player?.inventory[index]?.id
  if (!id) return
  useItem(ctx, id, index)
}

export function dropItemAtIndex(ctx, index) {
  const id = session.run?.player?.inventory[index]?.id
  if (!id) return
  dropItem(ctx, id, index)
}

/** Use an ingredient directly from the materials stash (bypasses backpack). */
export function useIngredientFromStash(ctx, save, id) {
  const inv = session.run.player.inventory
  // Push a temporary single-qty entry so the existing effect handlers can consume it
  const tempEntry = { id, qty: 1 }
  inv.push(tempEntry)
  const tempIndex = inv.length - 1
  useItem(ctx, id, tempIndex)
  // If the handler didn't consume the temp entry (e.g. not in combat), clean up
  if (inv[tempIndex] === tempEntry) inv.splice(tempIndex, 1)
  // Consume from materials stash
  const { removeFromMaterials } = _materialsBridge
  removeFromMaterials?.(save, id, 1)
}
// Late-bound bridge to avoid circular import (set by MaterialsController after load)
export const _materialsBridge = {}

export function useItem(ctx, id, inventoryIndex = null) {
  const inv   = session.run.player.inventory
  const entry = _inventoryEntry(inv, id, inventoryIndex)
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
    if (session.run.player.mana < 5) { UI.setMessage('Not enough mana! Smoke Bomb costs 5 mana.', true); return }
    const combatTile = session.run.activeCombatTile
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      session.run.player.mana -= 5
      UI.updateMana(session.run.player.mana, session.run.player.maxMana)
      combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 3
      UI.spawnFloat(combatTile.element, '💨 Stunned 3!', 'xp')
      UI.setMessage('💨 Smoke Bomb — enemy stunned for 3 turns! (5 mana)')
      UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    } else {
      session.run.player.mana -= 5
      UI.updateMana(session.run.player.mana, session.run.player.maxMana)
      session.run.player.preStunTurns = Math.max(session.run.player.preStunTurns ?? 0, 3)
      UI.setMessage('💨 Smoke Bomb ready — next enemy you engage will be stunned for 3 turns! (5 mana)')
    }
    EventBus.emit('audio:play', { sfx: 'spell' })
    return
  }

  // ── Transmutation crafted consumables — floor buffs ──────────
  if (item.buffType === 'floor') {
    const run = session.run
    if (!run) return
    if (!Array.isArray(run.floorBuffs)) run.floorBuffs = []
    const existing = run.floorBuffs.find(b => b.type === effect.type)
    const MAX_STACKS = 3
    if (existing) {
      if (existing.stackCount >= MAX_STACKS) {
        UI.setMessage(`${item.name} — already at max stacks (${MAX_STACKS}).`, true)
        return
      }
      existing.stackCount++
    } else {
      run.floorBuffs.push({
        type:        effect.type,
        effectType:  effect.effectType,
        effectValue: effect.effectValue,
        stackCount:  1,
        floors:      effect.floors ?? null,
        floorsLeft:  effect.floors ?? null,
        name:        item.name,
        icon:        item.icon,
        spriteSrc:   item.spriteSrc,
      })
    }
    UI.updateFloorBuffs?.(run.floorBuffs)
    UI.spawnFloat(document.getElementById('hud-portrait'), `${item.icon} Floor buff!`, 'heal')
    UI.setMessage(`${item.icon} ${item.name} — floor buff applied!`)
    EventBus.emit('audio:play', { sfx: 'spell' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }

  // ── Transmutation crafted consumables — instant use ──────────
  if (effect.type === 'choking-cloud') {
    const combatTile = session.run.activeCombatTile
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 3
      UI.spawnFloat(combatTile.element, '💨 Stunned 3!', 'xp')
      UI.setMessage('💨 Choking Cloud — enemy stunned for 3 turns!')
      UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    } else {
      session.run.player.preStunTurns = Math.max(session.run.player.preStunTurns ?? 0, 3)
      UI.setMessage('💨 Choking Cloud ready — next enemy you engage will be stunned for 3 turns!')
    }
    EventBus.emit('audio:play', { sfx: 'spell' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'dual-strike') {
    const combatTile = session.run.activeCombatTile
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      const dmg = Math.max(1, Math.floor(session.run.player.attack * 0.15))
      for (let i = 0; i < 2; i++) {
        combatTile.enemyData.hp -= dmg
        UI.spawnFloat(combatTile.element, `-${dmg}`, 'xp')
      }
      if (combatTile.enemyData.hp <= 0) ctx.resolveEnemyDeath?.(combatTile)
      UI.setMessage(`⚔️ Dual Strike — 2 × ${dmg} damage dealt (no counter)!`)
    } else {
      session.tap.dualStrikeTargeting = true
      document.getElementById('backpack-overlay')?.classList.add('hidden')
      UI.setMessage('⚔️ Dual Strike — tap a revealed enemy to strike twice (no counter).')
    }
    EventBus.emit('audio:play', { sfx: 'attack' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'festering-vial') {
    const combatTile = session.run.activeCombatTile
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      combatTile.enemyData.poisonTurns  = (combatTile.enemyData.poisonTurns  ?? 0) + 8
      combatTile.enemyData.poisonPctDmg = 8
      UI.spawnFloat(combatTile.element, '☠️ Poisoned!', 'xp')
      UI.setMessage('🧪 Festering Vial — enemy poisoned for 8 turns at 8% damage/turn!')
      UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    } else {
      session.tap.festeringVialTargeting = true
      document.getElementById('backpack-overlay')?.classList.add('hidden')
      UI.setMessage('🧪 Festering Vial — tap a revealed enemy to poison them (8 turns, 8%/turn).')
    }
    EventBus.emit('audio:play', { sfx: 'spell' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'medics-kit') {
    const p = session.run.player
    const healAmt = Math.max(1, Math.floor(p.maxHp * 0.20))
    p.hp = Math.min(p.maxHp, p.hp + healAmt)
    p.burnStacks = 0; UI.setBurnOverlay?.(0)
    p.poisonStacks = 0; UI.setPlayerPoison?.(0)
    p.tearyEyesTurns = 0; UI.setTearyEyes?.(0)
    p.freezingHitStacks = 0; UI.setFreezingHit?.(0)
    UI.updateHP(p.hp, p.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🧰 +${healAmt} HP`, 'heal')
    UI.setMessage(`🧰 Medic's Kit — +${healAmt} HP and all debuffs cleared!`)
    EventBus.emit('audio:play', { sfx: 'heal' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'plague-grenade') {
    const grid = ctx.getGrid?.() ?? []
    let hit = 0
    for (const row of grid) {
      for (const tile of row) {
        if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
          tile.enemyData.poisonTurns  = (tile.enemyData.poisonTurns ?? 0) + 4
          tile.enemyData.poisonPctDmg = 6
          UI.spawnFloat(tile.element, '☠️ Poisoned!', 'xp')
          hit++
        }
      }
    }
    UI.setMessage(`💣 Plague Grenade — ${hit} enem${hit === 1 ? 'y' : 'ies'} poisoned for 4 turns!`)
    EventBus.emit('audio:play', { sfx: 'spell' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'serrated-blade') {
    const combatTile = session.run.activeCombatTile
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      const dmg = Math.max(1, Math.floor(session.run.player.attack * 0.25))
      combatTile.enemyData.hp -= dmg
      combatTile.enemyData.bleedTurns = (combatTile.enemyData.bleedTurns ?? 0) + 3
      combatTile.enemyData.bleedPctDmg = 5
      UI.spawnFloat(combatTile.element, `-${dmg} + bleed`, 'xp')
      UI.setMessage(`🗡️ Serrated Blade — ${dmg} damage + bleeding (5%/turn × 3 turns)!`)
      UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
      if (combatTile.enemyData.hp <= 0) ctx.resolveEnemyDeath?.(combatTile)
    } else {
      session.tap.serratedBladeTargeting = true
      document.getElementById('backpack-overlay')?.classList.add('hidden')
      UI.setMessage('🗡️ Serrated Blade — tap a revealed enemy to deal damage and apply bleed.')
    }
    EventBus.emit('audio:play', { sfx: 'attack' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'fortifying-wrap') {
    const p = session.run.player
    const healAmt = Math.max(1, Math.floor(p.maxHp * 0.10))
    p.hp = Math.min(p.maxHp, p.hp + healAmt)
    p.nextHitAbsorb = true
    UI.updateHP(p.hp, p.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🩹 +${healAmt} HP + shield`, 'heal')
    UI.setMessage(`🩹 Fortifying Wrap — +${healAmt} HP and the next hit is absorbed entirely!`)
    EventBus.emit('audio:play', { sfx: 'heal' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
    return
  }
  if (effect.type === 'counter-shard') {
    session.run.player.counterShardReady = true
    UI.spawnFloat(document.getElementById('hud-portrait'), '🔷 Ready!', 'heal')
    UI.setMessage('🔷 Counter Shard — the next time you are hit, you counter for 20% damage!')
    EventBus.emit('audio:play', { sfx: 'spell' })
    entry.qty = (entry.qty ?? 1) - 1
    if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
    EventBus.emit('inventory:changed')
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
    session.run.player.tearyEyesTurns = 0; UI.setTearyEyes(0)
    session.run.player.burnStacks = 0; UI.setBurnOverlay(0)
    session.run.player.poisonStacks = 0; UI.setPlayerPoison(0)
    session.run.player.freezingHitStacks = 0; UI.setFreezingHit(0)
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
        if (isFoeTileType(t.type) && !t.enemyData?._slain) count++
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
    if (combatTile && combatTile.enemyData && !combatTile.enemyData._slain) {
      combatTile.enemyData.stunTurns = (combatTile.enemyData.stunTurns ?? 0) + 2
      UI.spawnFloat(combatTile.element, '✨ Stunned!', 'xp')
      UI.setMessage('✨ Flash Powder — enemy stunned for 2 turns! No counter-attacks.')
      UI.updateEnemyStatus(combatTile.element, combatTile.enemyData)
    } else {
      session.run.player.preStunTurns = Math.max(session.run.player.preStunTurns ?? 0, 2)
      UI.setMessage('✨ Flash Powder ready — next enemy you engage will be stunned for 2 turns!')
    }
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
          const newHP = TileEngine.rerollEnemyOnTile(t, session.run.floor)
          if (newHP !== null) { UI.updateEnemyHP(t.element, newHP); count++ }
        }
      }
    }
    UI.setMessage(`🎲 Bone Dice rerolled ${count} enem${count === 1 ? 'y' : 'ies'} — better or worse? (10 mana)`)
    EventBus.emit('audio:play', { sfx: 'menu' })
    return
  }

  EventBus.emit('audio:play', { sfx: 'heal' })
  if (effect.type === 'heal' || effect.type === 'mana' || effect.type === 'mystery-potion') {
    if (session.run?.telemetry) session.run.telemetry.potionsUsed = (session.run.telemetry.potionsUsed ?? 0) + 1
  }
  if (effect.type === 'heal') {
    const missing = session.run.player.maxHp - session.run.player.hp
    if (missing <= 0) { UI.setMessage('Already at full health!', true); return }
    const baseAmt = effect.pct ? Math.max(1, Math.floor(session.run.player.maxHp * effect.pct)) : effect.amount
    const healed = Math.min(baseAmt, missing)
    session.run.player.hp += healed
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${healed} HP`, 'heal')
    UI.setMessage(`❤️ You drink a ${item.name} and restore ${healed} HP.`)
  } else if (effect.type === 'mana') {
    const missing = session.run.player.maxMana - session.run.player.mana
    if (missing <= 0) { UI.setMessage('Already at full mana!', true); return }
    const hasAcorn  = session.run.player.inventory.some(e => e?.id === 'hollowed-acorn')
    const pctAmt    = effect.pct ? Math.max(1, Math.floor(session.run.player.maxMana * effect.pct)) : effect.amount
    const baseAmt   = hasAcorn ? Math.max(1, Math.floor(pctAmt / 2)) : pctAmt
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


export function dropItem(ctx, id, inventoryIndex = null) {
  if (!session.run) return
  const inv = session.run.player.inventory
  const entry = _inventoryEntry(inv, id, inventoryIndex)
  if (!entry) return
  const item = ITEMS[id]
  const gem  = GEMS[id]
  entry.qty--
  if (entry.qty <= 0) inv.splice(inv.indexOf(entry), 1)
  revertTrinketEquipEffects(ctx, id)
  const goldGain = trinketTrashGoldYield(item)
  const scrapGain = item ? trinketTrashScrapYield(item) : gemTrashScrapYield(id)
  if (goldGain) ctx.gainGold(goldGain, document.getElementById('hud-portrait'), true)
  if (scrapGain) adjustScrap(scrapGain)
  const rewards = []
  if (goldGain) rewards.push(`${goldGain} gold`)
  if (scrapGain) rewards.push(`${scrapGain} scrap`)
  const rewardNote = rewards.length ? ` (+${rewards.join(', ')})` : ''
  const name = item?.name ?? gem?.name
  UI.setMessage(name ? `Dropped ${name}.${rewardNote}` : 'Item removed.')
  EventBus.emit('audio:play', { sfx: 'menu' })
}

/** Drop all items in a stack at index (e.g. dispose of an entire potion stack). */
export function dropStackAtIndex(ctx, index) {
  if (!session.run) return
  const inv = session.run.player.inventory
  const entry = inv[index]
  if (!entry?.id) return
  const id = entry.id
  const qty = entry.qty ?? 1
  const item = ITEMS[id]
  revertTrinketEquipEffects(ctx, id)
  const goldGain = (trinketTrashGoldYield(item) ?? 0) * qty
  const scrapGain = (trinketTrashScrapYield(item) ?? 0) * qty
  inv.splice(inv.indexOf(entry), 1)
  if (goldGain) ctx.gainGold(goldGain, document.getElementById('hud-portrait'), true)
  if (scrapGain) adjustScrap(scrapGain)
  const rewards = []
  if (goldGain) rewards.push(`${goldGain} gold`)
  if (scrapGain) rewards.push(`${scrapGain} scrap`)
  const rewardNote = rewards.length ? ` (+${rewards.join(', ')})` : ''
  UI.setMessage(item ? `Dropped all ${qty}× ${item.name}.${rewardNote}` : 'Stack removed.')
  EventBus.emit('audio:play', { sfx: 'menu' })
  EventBus.emit('inventory:changed')
}

/** Swap any backpack slot for a gear piece (full-backpack gear pickup; any slot type). */
export function forceReplaceSlotWithGear(ctx, index, piece) {
  if (!session.run || !piece) return
  const inv = session.run.player.inventory
  const old = inv[index]
  if (!old) return

  if (old.slot) {
    // Old item is gear — give scrap for trashing it
    if (old.uid) adjustScrap(CONFIG.blacksmith?.trashScrapYield?.[old.tier] ?? 1)
  } else if (old.id) {
    // Old item is trinket/potion — revert passive effects, give any trash rewards
    revertTrinketEquipEffects(ctx, old.id)
    const goldGain = trinketTrashGoldYield(ITEMS[old.id])
    const scrapGain = trinketTrashScrapYield(ITEMS[old.id])
    if (goldGain) ctx.gainGold(goldGain, document.getElementById('hud-portrait'), true)
    if (scrapGain) adjustScrap(scrapGain)
  }

  inv[index] = piece
  EventBus.emit('inventory:changed')
  EventBus.emit('gear:pickedUp')
  UI.setMessage(`${piece.name} placed in backpack.`)
}

/** Swap a backpack slot for a new pickup (full-backpack replace flow). Handles both trinkets and gear. */
export async function forceReplaceItemAtIndex(ctx, index, newId) {
  if (!session.run) return
  const inv = session.run.player.inventory
  const old = inv[index]
  if (!old) return
  const item = ITEMS[newId]
  if (!item) return

  if (old.slot) {
    // Old item is gear — give scrap for trashing it
    if (old.uid) adjustScrap(CONFIG.blacksmith?.trashScrapYield?.[old.tier] ?? 1)
  } else {
    revertTrinketEquipEffects(ctx, old.id)
    const scrapGain = trinketTrashScrapYield(ITEMS[old.id])
    if (scrapGain) adjustScrap(scrapGain)
  }

  inv[index] = { id: newId, qty: 1 }

  if (TrinketCodex.registerIfNew(session.save, newId)) {
    Logger.info(`[GameController] New trinket discovered: ${newId} (floor ${session.run?.floor})`)
    await SaveManager.save(session.save).catch(() => {})
    await UI.showTrinketDiscovery(newId)
  }
  applyTrinketEquipEffects(ctx, newId)
  UI.setMessage(`Swapped in ${item.name}.`)
  EventBus.emit('inventory:changed')
}

/** @deprecated Prefer forceReplaceItemAtIndex — id lookup fails when qty > 1 on stackables. */
export async function forceReplaceItem(ctx, oldId, newId) {
  if (!session.run) return
  const idx = session.run.player.inventory.findIndex(e => e?.id === oldId)
  if (idx < 0) return
  await forceReplaceItemAtIndex(ctx, idx, newId)
}

export function useOrbPotion(ctx, type) {
  if (!session.run) return
  const p = session.run.player
  if (type === 'hp') {
    if ((p.hpPotions ?? 0) <= 0) { UI.setMessage('No HP potions in flask.', true); return }
    const missing = p.maxHp - p.hp
    if (missing <= 0) { UI.setMessage("Already at full health.", true); return }
    const healed = Math.min(5, missing)
    p.hp += healed
    p.hpPotions--
    if (session.run?.telemetry) session.run.telemetry.potionsUsed = (session.run.telemetry.potionsUsed ?? 0) + 1
    UI.updateHP(p.hp, p.maxHp)
    UI.updateOrbPotions(p.hpPotions, p.manaPotions ?? 0)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${healed} HP`, 'heal')
    UI.setMessage(`❤️ HP Potion — +${healed} HP.`)
    EventBus.emit('audio:play', { sfx: 'heal' })
  } else if (type === 'mana') {
    if ((p.manaPotions ?? 0) <= 0) { UI.setMessage('No mana potions in flask.', true); return }
    const missing = p.maxMana - p.mana
    if (missing <= 0) { UI.setMessage("Already at full mana.", true); return }
    const hasAcorn = p.inventory.some(e => e?.id === 'hollowed-acorn')
    const baseAmt  = hasAcorn ? Math.max(1, Math.floor(20 / 2)) : 20
    const restored = Math.min(baseAmt, missing)
    p.mana += restored
    p.manaPotions--
    if (session.run?.telemetry) session.run.telemetry.potionsUsed = (session.run.telemetry.potionsUsed ?? 0) + 1
    UI.updateMana(p.mana, p.maxMana)
    UI.updateOrbPotions(p.hpPotions ?? 0, p.manaPotions)
    UI.spawnFloat(document.getElementById('hud-portrait'), `+${restored} MP`, 'mana')
    UI.setMessage(`🔵 Mana Potion — +${restored} mana.${hasAcorn ? ' (Hollowed Acorn halved)' : ''}`)
    EventBus.emit('audio:play', { sfx: 'heal' })
  }
}

