import { CONFIG } from '../config.js'
import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'
import * as gearModule from '../data/gear.js'


export function adjustPlayerStat(stat, delta) {
  const p = session.run.player
  if (stat === 'maxHpPct') {
    const flatDelta = Math.round((p.baseMaxHp ?? p.maxHp) * delta / 100)
    p.maxHp = Math.max(1, p.maxHp + flatDelta)
    p.hp    = Math.max(1, Math.min(p.hp + flatDelta, p.maxHp))
  } else if (stat === 'maxManaPct') {
    const flatDelta = Math.round((p.baseMaxMana ?? p.maxMana) * delta / 100)
    p.maxMana = Math.max(0, p.maxMana + flatDelta)
    p.mana    = Math.max(0, Math.min(p.mana + flatDelta, p.maxMana))
  } else if (stat === 'barbedGear') {
    // Detriment: reduces maxHp by N% of base max HP (delta is negative e.g. -5)
    const flatDelta = Math.round((p.baseMaxHp ?? p.maxHp) * delta / 100)
    p.maxHp = Math.max(1, p.maxHp + flatDelta)
    p.hp    = Math.min(p.hp, p.maxHp)
  } else if (stat === 'manaDrain') {
    // Detriment: reduces maxMana by N% of base max mana (delta is negative)
    const flatDelta = Math.round((p.baseMaxMana ?? p.maxMana) * delta / 100)
    p.maxMana = Math.max(0, p.maxMana + flatDelta)
    p.mana    = Math.min(p.mana, p.maxMana)
  } else if (stat === 'damageBonus') {
    p.damageBonus = (p.damageBonus ?? 0) + delta
  } else if (stat === 'negation') {
    p.negation = (p.negation ?? 0) + delta
  } else if (stat === 'damageReduction') {
    p.damageReduction = (p.damageReduction ?? 0) + delta
  } else if (stat === 'brittleArmor') {
    p.negation = Math.max(0, (p.negation ?? 0) + delta / 100)
  } else if (stat === 'maxHp') {
    // Legacy flat stat — kept for backward-compat with pre-rename saves
    p.maxHp += delta; p.hp += delta
  } else if (stat === 'maxMana') {
    p.maxMana += delta; p.mana += delta
  }
}

function applyGearStats(ctx, piece) {
  for (const [stat, value] of Object.entries(piece.stats)) {
    adjustPlayerStat(stat, value)
  }
}

function removeGearStats(ctx, piece) {
  for (const [stat, value] of Object.entries(piece.stats)) {
    adjustPlayerStat(stat, -value)
  }
}

/** Load persisted equippedGear onto player at session.run start. */
export function applyEquippedGear(ctx, p) {
  const saved = session.save?.equippedGear
  if (!saved) return
  const baseHp   = p.baseMaxHp   ?? p.maxHp
  const baseMana = p.baseMaxMana ?? p.maxMana
  for (const slot of ['weapon', 'breastplate', 'offhand']) {
    const piece = saved[slot]
    if (!piece) continue
    p.equippedGear[slot] = piece
    for (const [stat, value] of Object.entries(piece.stats)) {
      if (stat === 'maxHpPct') {
        const d = Math.round(baseHp * value / 100)
        p.maxHp = Math.max(1, p.maxHp + d); p.hp = Math.max(1, Math.min(p.hp + d, p.maxHp))
      } else if (stat === 'maxManaPct') {
        const d = Math.round(baseMana * value / 100)
        p.maxMana = Math.max(0, p.maxMana + d); p.mana = Math.max(0, Math.min(p.mana + d, p.maxMana))
      } else if (stat === 'barbedGear') {
        const d = Math.round(baseHp * value / 100)
        p.maxHp = Math.max(1, p.maxHp + d); p.hp = Math.min(p.hp, p.maxHp)
      } else if (stat === 'manaDrain') {
        const d = Math.round(baseMana * value / 100)
        p.maxMana = Math.max(0, p.maxMana + d); p.mana = Math.min(p.mana, p.maxMana)
      } else if (stat === 'damageBonus') {
        p.damageBonus = (p.damageBonus ?? 0) + value
      } else if (stat === 'negation') {
        p.negation = (p.negation ?? 0) + value
      } else if (stat === 'damageReduction') {
        p.damageReduction = (p.damageReduction ?? 0) + value
      } else if (stat === 'brittleArmor') {
        p.negation = Math.max(0, (p.negation ?? 0) + value / 100)
      } else if (stat === 'maxHp') {
        // Legacy flat stat — backward-compat for pre-rename saves
        p.maxHp += value; p.hp += value
      } else if (stat === 'maxMana') {
        p.maxMana += value; p.mana += value
      }
    }
  }
}

export function equipGear(ctx, inventoryIndex) {
  const inventory = session.run.player.inventory
  const candidate = inventory[inventoryIndex]
  if (!candidate || !candidate.slot) return

  const slot = candidate.slot
  const prev = session.run.player.equippedGear[slot] ?? null

  inventory[inventoryIndex] = prev

  session.run.player.equippedGear[slot] = candidate

  if (prev) removeGearStats(ctx, prev)
  applyGearStats(ctx, candidate)

  session.run.player.hp   = Math.max(1, Math.min(session.run.player.hp,   session.run.player.maxHp))
  session.run.player.mana = Math.max(0, Math.min(session.run.player.mana, session.run.player.maxMana))

  const [d0, d1] = ctx.playerDamageRange(session.run.player)
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateDamageRange(d0, d1)
  EventBus.emit('inventory:changed')
}

export function unequipGear(ctx, slot, inventoryIndex) {
  if (!session.run) return
  const piece = session.run.player.equippedGear[slot]
  if (!piece) return
  session.run.player.inventory[inventoryIndex] = piece
  session.run.player.equippedGear[slot] = null
  removeGearStats(ctx, piece)
  session.run.player.hp   = Math.max(1, Math.min(session.run.player.hp,   session.run.player.maxHp))
  session.run.player.mana = Math.max(0, Math.min(session.run.player.mana, session.run.player.maxMana))
  const [d0, d1] = ctx.playerDamageRange(session.run.player)
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.updateDamageRange(d0, d1)
  EventBus.emit('inventory:changed')
}

/** In-run: destroy backpack gear and grant scrap (stored on session.save). */
export function trashGear(ctx, inventoryIndex) {
  if (!session.run) return
  const piece = session.run.player.inventory[inventoryIndex]
  if (piece?.uid) {
    adjustScrap(CONFIG.blacksmith.trashScrapYield[piece.tier] ?? 1)
  }
  session.run.player.inventory[inventoryIndex] = null
  EventBus.emit('inventory:changed')
}

/** Push a gear piece into the backpack, or emit backpack:full if no room. */
export function handleGearPickup(ctx, piece) {
  const inv = session.run.player.inventory
  const BACKPACK_MAX_SLOTS = 9
  const usedSlots = inv.filter(e => e !== null).length
  if (usedSlots < BACKPACK_MAX_SLOTS) {
    const nullIdx = inv.indexOf(null)
    if (nullIdx >= 0) { inv[nullIdx] = piece } else { inv.push(piece) }
    EventBus.emit('inventory:changed')
    EventBus.emit('gear:pickedUp')
    UI.showGearFoundToast(piece)
  } else {
    EventBus.emit('backpack:full', { type: 'gear', piece })
  }
}

/** Try to drop a gear piece; returns true if a piece was added to backpack. */
export function tryGearDrop(ctx, floor, chance) {
  if (Math.random() >= chance) return false
  const { generateGear, pickDropTier, pickDropSlot } = gearModule
  const tier  = pickDropTier(floor)
  const slot  = pickDropSlot()
  const piece = generateGear(slot, tier)
  handleGearPickup(ctx, piece)
  return true
}



function adjustScrap(delta) {
  session.save.scrap = Math.max(0, (session.save.scrap ?? 0) + delta)
}

function applyGearUpgrade(piece) {
  for (const key of Object.keys(piece.stats)) {
    const val = piece.stats[key]
    if (val <= 0) continue
    if (key === 'negation') {
      piece.stats[key] = Math.round(val * 1.25 * 1000) / 1000
    } else {
      piece.stats[key] = Math.round(val * 1.25)
    }
  }
  piece.upgradeCount++
}

/** Between-runs only. Upgrades the gear in the given slot. Returns { success, failed, noGear, maxed, cantAfford }. */
export function upgradeGear(ctx, slot) {
  const gear = session.save.equippedGear
  if (!gear) return { noGear: true }
  const piece = gear[slot]
  if (!piece) return { noGear: true }
  if (piece.upgradeCount >= 3) return { maxed: true }

  const upgradeNum = piece.upgradeCount + 1
  const cost = CONFIG.blacksmith.upgradeCosts[piece.tier]?.[upgradeNum]
  if (!cost) return { noGear: true }

  if ((session.save.persistentGold ?? 0) < cost.gold || (session.save.scrap ?? 0) < cost.scrap) return { cantAfford: true }

  session.save.persistentGold -= cost.gold
  adjustScrap(-cost.scrap)

  if (true) { // always succeeds — success rate temporarily set to 100%
    applyGearUpgrade(piece)
    SaveManager.save(session.save).catch(() => {})
    return { success: true, piece }
  }

  SaveManager.save(session.save).catch(() => {})
  return { failed: true, piece }
}

/** Between-runs only. Destroys the gear in the given slot and yields scrap. */
export function disassembleGear(ctx, slot) {
  const gear = session.save.equippedGear
  if (!gear) return { noGear: true }
  const piece = gear[slot]
  if (!piece) return { noGear: true }

  const [lo, hi] = CONFIG.blacksmith.scrapYield[piece.tier] ?? [2, 4]
  const yield_ = ctx.rand(lo, hi)
  adjustScrap(yield_)
  gear[slot] = null
  SaveManager.save(session.save).catch(() => {})
  return { success: true, scrapGained: yield_, piece }
}

/** Between-runs only. Reduces a detriment stat on the piece by 25%, floored at -1. */
export function reduceDetriment(ctx, slot, statKey) {
  const gear = session.save.equippedGear
  if (!gear) return { noGear: true }
  const piece = gear[slot]
  if (!piece) return { noGear: true }
  if (piece.upgradeCount < 3) return { notUnlocked: true }

  const val = piece.stats[statKey]
  if (val === undefined || val >= 0) return { notDetriment: true }
  if (val === -1) return { atFloor: true }

  const cost = CONFIG.blacksmith.detrimentReduceCost[piece.tier]
  if (!cost) return { noGear: true }
  if ((session.save.persistentGold ?? 0) < cost.gold || (session.save.scrap ?? 0) < cost.scrap) return { cantAfford: true }

  session.save.persistentGold -= cost.gold
  adjustScrap(-cost.scrap)

  const newVal = Math.min(-1, Math.ceil(val * 0.75))  // min keeps value ≤ -1 (stays a detriment)
  piece.stats[statKey] = newVal
  SaveManager.save(session.save).catch(() => {})
  return { success: true, piece, statKey, newVal }
}

