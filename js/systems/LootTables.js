import { CONFIG } from '../config.js'

export const COMMON_LOOT_IDS = [
  'potion-red', 'potion-blue', 'potion-mystery', 'lantern', 'dowsing-rod', 'smiths-tools', 'spyglass', 'scavengers-bag',
]

export const RARE_TRINKET_IDS = [
  'fire-ring', 'mana-ring', 'echo-charm', 'vampire-fang', 'glass-cannon-shard',
  'duelists-glove', 'surge-pearl', 'still-water-amulet', 'greed-tooth',
  'lucky-rabbit-foot', 'cursed-lockpick',
  'spiked-collar', 'eagle-eye', 'mending-moss', 'hollowed-acorn',
]

/** Rare trinkets available only from the magic chest */
export const MAGIC_CHEST_EXCLUSIVE_IDS = [
  'thorn-wrap', 'misers-pouch', 'cracked-compass', 'plague-mask', 'soul-candle',
  'blood-pact', 'bone-dice', 'hunger-stone', 'gamblers-mark', 'witching-stone',
  'plague-rat-skull',
]

export const LEGENDARY_TRINKET_IDS = [
  'hourglass-sand', 'forsaken-idol', 'stormcallers-fist', 'mirror-of-vanity',
  'deathmask', 'traded-codex', 'philosophers-coin',
  'paupers-crown', 'soulbound-blade', 'twin-fates', 'abyssal-lens',
  'resurrection-stone', 'wardens-brand',
]

export const BACKPACK_MAX_SLOTS = 9

export function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

/** @param {{ hasItem: (id: string) => boolean, rand: (min: number, max: number) => number }} ctx */
export function rollCommonLoot({ hasItem, rand }) {
  // Weighted: potions more likely than utility items (smiths-tools removed — ~1% via dedicated band in chest rolls)
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

/** Normal chest: 1% legendary, 2% rare, 1% Smith's Tools, 96% common (no smiths in common pool). */
export function rollChestLoot({ hasItem, rand }) {
  if (hasItem('misers-pouch')) {
    return { type: 'gold', amount: rand(...CONFIG.chest.goldDrop) }
  }
  // Delver's Kit: always rare or legendary
  if (hasItem('delvers-kit')) {
    return Math.random() < 0.15
      ? { type: pickRandom(LEGENDARY_TRINKET_IDS) }
      : { type: pickRandom(RARE_TRINKET_IDS) }
  }
  let r = Math.random()
  // Cursed lockpick: bias toward rare/legendary
  if (hasItem('cursed-lockpick') && r < 0.15) {
    r = Math.random() * 0.06  // forces into rare or legendary band
  }
  if (r < 0.01) return { type: pickRandom(LEGENDARY_TRINKET_IDS) }
  if (r < 0.03) return { type: pickRandom(RARE_TRINKET_IDS) }
  if (r < 0.04) return { type: 'smiths-tools' }
  return rollCommonLoot({ hasItem, rand })
}

/** Magic chest: 2% legendary, 5% rare (all rares + exclusives), 1% Smith's Tools, 92% common. */
export function rollMagicChestLoot({ hasItem, rand }) {
  const r = Math.random()
  if (r < 0.02) return { type: pickRandom(LEGENDARY_TRINKET_IDS) }
  if (r < 0.07) {
    const pool = [...RARE_TRINKET_IDS, ...MAGIC_CHEST_EXCLUSIVE_IDS]
    return { type: pickRandom(pool) }
  }
  if (r < 0.08) return { type: 'smiths-tools' }
  return rollCommonLoot({ hasItem, rand })
}
