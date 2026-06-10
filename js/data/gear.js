// Gear system — schema, name generation, stat rolling, tier/slot picking.
// Pure data helpers — no DOM, no state mutation.

import { CONFIG } from '../config.js'

// ── Name pools ────────────────────────────────────────────────────────────────

const GEAR_ADJECTIVES = {
  common:    ['Crude', 'Worn', 'Simple', 'Battered', 'Scuffed', 'Rusty', 'Frayed'],
  rare:      ['Sturdy', 'Tempered', 'Balanced', 'Reinforced', 'Engraved', 'Polished'],
  epic:      ['Masterwork', 'Enchanted', 'Shadowed', 'Arcane', 'Runed', 'Forged'],
  legendary: ['Ancient', 'Infernal', 'Celestial', 'Void-touched', 'Eternal', 'Abyssal'],
  void:      ['Unmade', 'Hollow', 'Abyssal', 'Null', 'Eclipsed', 'Unbound'],
}

const GEAR_NOUNS = {
  weapon:     ['Blade', 'Sword', 'Axe', 'Maul', 'Dagger', 'Cleaver', 'Falchion'],
  breastplate:['Chestplate', 'Cuirass', 'Hauberk', 'Vest', 'Breastplate', 'Mail'],
  offhand:    ['Buckler', 'Targe', 'Aegis', 'Ward', 'Parrying Shield', 'Deflector'],
}

// ── Slot definitions ──────────────────────────────────────────────────────────

export const GEAR_SLOT_DEFS = {
  weapon: {
    primaryStat: 'damageBonus',
    secondaryPool: ['maxManaPct', 'damageReduction', 'abilityPower'],
    detrimentPool: ['barbedGear', 'manaDrain'],
  },
  breastplate: {
    primaryStat: 'maxHpPct',
    secondaryPool: ['maxManaPct', 'damageReduction', 'abilityPower'],
    detrimentPool: ['brittleArmor', 'manaDrain'],
  },
  offhand: {
    primaryStat: 'negation',
    secondaryPool: ['maxHpPct', 'maxManaPct', 'abilityPower'],
    detrimentPool: ['brittleArmor', 'barbedGear'],
  },
}

export const GEAR_UPGRADE_MAX = { common: 3, rare: 3, epic: 3, legendary: 3, void: 3 }

// Detriment stats are stored in piece.stats with negative sign applied at roll time.
// These keys map to the CONFIG.gear.statRanges keys used for rolling.
const DETRIMENT_STAT_MAP = {
  brittleArmor: 'brittleArmor',
  barbedGear:   'barbedGear',
  manaDrain:    'manaDrain',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _uidCounter = Date.now()
export function generateGearUID() {
  return `gear_${_uidCounter++}_${Math.random().toString(36).slice(2, 7)}`
}

export function generateGearName(slot, tier) {
  const adjTier = tier === 'void' ? 'void' : tier
  const adjs  = GEAR_ADJECTIVES[adjTier] ?? GEAR_ADJECTIVES.common
  const nouns = GEAR_NOUNS[slot]
  const adj  = adjs[Math.floor(Math.random() * adjs.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

/** Floor-depth multiplier for stat bands at drop time. */
export function gearFloorMult(floor) {
  return CONFIG.gear.floorMult(floor)
}

function _scaledBand(lo, hi, mult, statKey) {
  if (statKey === 'negation') {
    const slo = Math.max(0.01, Math.round(lo * mult * 100) / 100)
    const shi = Math.max(slo, Math.round(hi * mult * 100) / 100)
    return [slo, shi]
  }
  const slo = Math.max(1, Math.round(lo * mult))
  const shi = Math.max(slo, Math.round(hi * mult))
  return [slo, shi]
}

function _rollStat(statKey, tier, floorMult = 1) {
  const band = CONFIG.gear.statRanges[statKey]?.[tier]
  if (!band) return null
  let [lo, hi] = band
  if (floorMult !== 1) [lo, hi] = _scaledBand(lo, hi, floorMult, statKey)
  if (lo === hi) return lo
  // negation is a float (0.05–0.30); all other stats are integers
  if (statKey === 'negation') return Math.round((lo + Math.random() * (hi - lo)) * 100) / 100
  return Math.round(lo + Math.random() * (hi - lo))
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * generateGear(slot, tier, floor?) → gear piece object
 *   { uid, slot, tier, name, stats, upgradeCount, dropFloor }
 *
 * stats is a flat object of { statKey: value }.
 * Stat bands scale with floor (all tiers + detriments). Blacksmith +25% upgrades
 * multiply the rolled values, so deeper drops upgrade into stronger pieces.
 * Detriment values are stored as NEGATIVE numbers so callers can add them directly.
 * damageReduction only appears on Epic/Legendary.
 */
export function generateGear(slot, tier, floor = 1) {
  const dropFloor = Math.max(1, Math.floor(Number(floor) || 1))
  const floorMult = gearFloorMult(dropFloor)
  const slotDef = GEAR_SLOT_DEFS[slot]
  const stats   = {}

  // Primary stat — always present
  const primaryVal = _rollStat(slotDef.primaryStat, tier, floorMult)
  if (primaryVal !== null) stats[slotDef.primaryStat] = primaryVal

  // Secondaries — 0 to 2, no duplicates
  const secondaryCount = tier === 'common' ? 0 : tier === 'rare' ? 1 : 2
  const availableSecondary = [...slotDef.secondaryPool]
  for (let i = 0; i < secondaryCount && availableSecondary.length > 0; i++) {
    const idx  = Math.floor(Math.random() * availableSecondary.length)
    const stat = availableSecondary.splice(idx, 1)[0]
    if (stat === 'damageReduction' && tier !== 'epic' && tier !== 'legendary') continue
    const val = _rollStat(stat, tier, floorMult)
    if (val !== null) stats[stat] = val
  }

  // Detriment — lower tiers more likely; legendary rare; bands scale with floor
  const detrimentChance = { common: 0.60, rare: 0.35, epic: 0.20, legendary: 0.10 }[tier]
  if (Math.random() < detrimentChance) {
    const pool = slotDef.detrimentPool
    const detKey = pool[Math.floor(Math.random() * pool.length)]
    const detVal = _rollStat(DETRIMENT_STAT_MAP[detKey], tier, floorMult)
    if (detVal !== null) stats[detKey] = -detVal
  }

  return {
    uid:          generateGearUID(),
    slot,
    tier,
    name:         generateGearName(slot, tier),
    stats,
    upgradeCount: 0,
    dropFloor,
  }
}

// ── Drop tier picker ──────────────────────────────────────────────────────────

/**
 * pickDropTier(floor) → 'common' | 'rare' | 'epic' | 'legendary'
 * Uses CONFIG.gear.levelDropTables for floor-depth weighted selection.
 */
export function pickDropTier(floor) {
  const tables = CONFIG.gear.levelDropTables
  let row
  if (floor <= 20)       row = tables['1-20']
  else if (floor <= 40)  row = tables['21-40']
  else if (floor <= 60)  row = tables['41-60']
  else                   row = tables['61-100']

  const roll = Math.random() * 100
  let cum = 0
  for (const tier of ['common', 'rare', 'epic', 'legendary']) {
    cum += (row[tier] ?? 0)
    if (roll < cum) return tier
  }
  return 'common'
}

// ── Drop slot picker ──────────────────────────────────────────────────────────

const SLOTS = ['weapon', 'breastplate', 'offhand']

/** pickDropSlot() → random gear slot */
export function pickDropSlot() {
  return SLOTS[Math.floor(Math.random() * SLOTS.length)]
}
