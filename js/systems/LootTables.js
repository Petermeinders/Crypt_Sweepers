import { CONFIG } from '../config.js'
import { ITEMS } from '../data/items.js'

export const LEGENDARY_MIN_FLOOR = 10

export const COMMON_LOOT_IDS = [
  'potion-red', 'potion-blue', 'potion-mystery', 'lantern', 'dowsing-rod', 'smiths-tools', 'spyglass', 'scavengers-bag',
]

export const RARE_TRINKET_IDS = [
  'fire-ring', 'mana-ring', 'echo-charm', 'vampire-fang',
  'duelists-glove', 'surge-pearl', 'still-water-amulet', 'greed-tooth',
  'lucky-rabbit-foot', 'mending-moss', 'hollowed-acorn',
]

/** Epic trinkets — stronger passives between rare and legendary */
export const EPIC_TRINKET_IDS = [
  'glass-cannon-shard', 'spiked-collar', 'eagle-eye', 'cursed-lockpick',
  'blood-pact', 'cracked-compass', 'hunger-stone', 'bone-dice',
]

/** Rare trinkets available only from the magic chest */
export const MAGIC_CHEST_EXCLUSIVE_IDS = [
  'thorn-wrap', 'misers-pouch', 'plague-mask', 'soul-candle',
  'gamblers-mark', 'witching-stone', 'plague-rat-skull',
]

export const LEGENDARY_TRINKET_IDS = [
  'hourglass-sand', 'forsaken-idol', 'stormcallers-fist', 'mirror-of-vanity',
  'deathmask', 'traded-codex', 'philosophers-coin',
  'paupers-crown', 'soulbound-blade', 'twin-fates', 'abyssal-lens',
  'resurrection-stone', 'wardens-brand',
]

export const BACKPACK_MAX_SLOTS = 9

/** Cumulative chest roll thresholds (normal / magic). */
const CHEST_THRESHOLDS = {
  normal: { legendary: 0.005, epic: 0.015, rare: 0.035, smiths: 0.040 },
  magic:  { legendary: 0.010, epic: 0.030, rare: 0.080, smiths: 0.085 },
}

export function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickRareTrinketId() {
  return pickRandom([...RARE_TRINKET_IDS, ...MAGIC_CHEST_EXCLUSIVE_IDS])
}

function pickTrinketByRarity(rarity) {
  if (rarity === 'legendary') return pickRandom(LEGENDARY_TRINKET_IDS)
  if (rarity === 'epic') return pickRandom(EPIC_TRINKET_IDS)
  if (rarity === 'rare') return pickRareTrinketId()
  const commonPool = Object.keys(ITEMS).filter(id => {
    const it = ITEMS[id]
    return it?.rarity === 'common' && !it.stackable && it.effect
  })
  if (commonPool.length) return pickRandom(commonPool)
  return pickRandom(COMMON_LOOT_IDS)
}

/** Trinket id for sanctuary/chest tier bands. */
export function pickTrinketIdForDropTier(tier) {
  return pickTrinketByRarity(tier)
}

function rollPremiumTrinket(floor, band) {
  if (band === 'legendary' && floor < LEGENDARY_MIN_FLOOR) band = 'epic'
  return { type: pickTrinketByRarity(band) }
}

function rollDelversKitTrinket(floor) {
  const r = Math.random()
  if (floor >= LEGENDARY_MIN_FLOOR && r < 0.12) {
    return { type: pickRandom(LEGENDARY_TRINKET_IDS) }
  }
  if (r < 0.40) return { type: pickRandom(EPIC_TRINKET_IDS) }
  return { type: pickRareTrinketId() }
}

/** @param {{ hasItem: (id: string) => boolean, rand: (min: number, max: number) => number, floor?: number }} ctx */
export function rollCommonLoot({ hasItem, rand }) {
  // Weighted: potions more likely than utility items (smiths-tools removed — 0.5% via dedicated band in chest rolls)
  const r = Math.random()
  if (r < 0.28) return { type: 'potion-red' }
  if (r < 0.50) return { type: 'potion-blue' }
  if (r < 0.58) return { type: 'potion-mystery' }
  if (r < 0.70) return { type: 'lantern' }
  if (r < 0.80) return { type: 'dowsing-rod' }
  if (r < 0.88) return { type: 'spyglass' }
  if (r < 0.95) return { type: 'scavengers-bag' }
  return { type: 'gold', amount: rand(...CONFIG.chest.goldDrop) }
}

function rollChestTrinketBand(r, floor, thresholds) {
  if (r < thresholds.legendary) return rollPremiumTrinket(floor, 'legendary')
  if (r < thresholds.epic) return rollPremiumTrinket(floor, 'epic')
  if (r < thresholds.rare) return { type: pickRareTrinketId() }
  if (r < thresholds.smiths) return { type: 'smiths-tools' }
  return null
}

/** Normal chest: 0.5% legendary (floor 10+), 1% epic, 2% rare, 0.5% Smith's Tools, 96% common. */
export function rollChestLoot({ hasItem, rand, floor = 1 }) {
  if (hasItem('misers-pouch')) {
    return { type: 'gold', amount: rand(...CONFIG.chest.goldDrop) }
  }
  if (hasItem('delvers-kit')) {
    return rollDelversKitTrinket(floor)
  }
  let r = Math.random()
  // Cursed lockpick: bias toward rare/epic/legendary
  if (hasItem('cursed-lockpick') && r < 0.15) {
    r = Math.random() * CHEST_THRESHOLDS.normal.rare
  }
  const trinket = rollChestTrinketBand(r, floor, CHEST_THRESHOLDS.normal)
  if (trinket) return trinket
  return rollCommonLoot({ hasItem, rand })
}

/** Magic chest: 1% legendary (floor 10+), 2% epic, 5% rare, 0.5% Smith's Tools, 91.5% common. */
export function rollMagicChestLoot({ hasItem, rand, floor = 1 }) {
  const r = Math.random()
  const trinket = rollChestTrinketBand(r, floor, CHEST_THRESHOLDS.magic)
  if (trinket) return trinket
  return rollCommonLoot({ hasItem, rand })
}
