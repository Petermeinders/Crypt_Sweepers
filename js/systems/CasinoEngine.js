// Pure Casino logic — no DOM, no save mutation, no GameController imports.
import { CASINO_CONFIG } from '../data/casinoConfig.js'
import { generateGear, GEAR_SLOT_DEFS } from '../data/gear.js'

const TIERS = ['common', 'rare', 'epic', 'legendary']
const SLOTS = Object.keys(GEAR_SLOT_DEFS)

// ── Risk score ────────────────────────────────────────────────────────────────

/** Returns R in [0, 1]: how much the player's wager shifts odds toward better loot. */
export function computeRiskScore(gold, scrap) {
  const { goldCap, scrapCap, goldWeight, scrapWeight } = CASINO_CONFIG
  const g = Math.sqrt(Math.min(Math.max(gold, 0), goldCap) / goldCap)
  const s = Math.sqrt(Math.min(Math.max(scrap, 0), scrapCap) / scrapCap)
  return goldWeight * g + scrapWeight * s
}

// ── Tier weights ──────────────────────────────────────────────────────────────

/** Returns tier weights interpolated between base and max by riskScore. */
export function computeTierWeights(riskScore) {
  const { baseTierWeights: base, maxTierWeights: max } = CASINO_CONFIG
  const r = Math.min(Math.max(riskScore, 0), 1)
  const weights = {}
  for (const tier of TIERS) {
    weights[tier] = base[tier] + (max[tier] - base[tier]) * r
  }
  return weights
}

// ── Roll tier ─────────────────────────────────────────────────────────────────

/** Picks a tier string based on the given weight map. */
export function rollTier(weights) {
  const total = TIERS.reduce((sum, t) => sum + weights[t], 0)
  let roll = Math.random() * total
  for (const tier of TIERS) {
    roll -= weights[tier]
    if (roll <= 0) return tier
  }
  return TIERS[TIERS.length - 1]
}

// ── Reward resolution ─────────────────────────────────────────────────────────

/** Rolls a reward type ('gear' | 'voidFragment' | 'currencyEcho') for the given tier. */
function rollRewardType(tier) {
  const w = CASINO_CONFIG.rewardTypeWeights[tier]
  const total = w.gear + w.voidFragment + w.currencyEcho
  let roll = Math.random() * total
  if ((roll -= w.gear) <= 0) return 'gear'
  if ((roll -= w.voidFragment) <= 0) return 'voidFragment'
  return 'currencyEcho'
}

/**
 * Resolves what the player actually wins for a rolled tier.
 * @param {string} tier
 * @param {{ gold: number, scrap: number }} wager — used only for echo calculation
 * @returns {{ type: string, gear?: object, fragments?: number, gold?: number, scrap?: number }}
 */
export function resolveReward(tier, wager = { gold: 0, scrap: 0 }, gearFloor = 1) {
  const type = rollRewardType(tier)

  if (type === 'gear') {
    const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)]
    return { type: 'gear', gear: generateGear(slot, tier, gearFloor) }
  }

  if (type === 'voidFragment') {
    const fragments = Math.floor(Math.random() * 2) + 1 // 1 or 2
    return { type: 'voidFragment', fragments }
  }

  // currencyEcho — partial refund of the wager
  const [gLo, gHi] = CASINO_CONFIG.echoGoldPct
  const [sLo, sHi] = CASINO_CONFIG.echoScrapPct
  const gPct = gLo + Math.random() * (gHi - gLo)
  const sPct = sLo + Math.random() * (sHi - sLo)
  return {
    type: 'currencyEcho',
    gold:  Math.max(1, Math.round(wager.gold  * gPct)),
    scrap: Math.max(1, Math.round(wager.scrap * sPct)),
  }
}

// ── canAffordSpin ─────────────────────────────────────────────────────────────

/** Returns true if the save has enough gold and scrap for the given wager. */
export function canAffordSpin(gold, scrap, save) {
  return (save.persistentGold ?? 0) >= gold && (save.scrap ?? 0) >= scrap
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

/**
 * Full spin: compute risk, roll tier, resolve reward.
 * Returns { tier, riskScore, weights, reward }.
 */
export function spin(gold, scrap, wager, gearFloor = 1) {
  const riskScore = computeRiskScore(gold, scrap)
  const weights   = computeTierWeights(riskScore)
  const tier      = rollTier(weights)
  const reward    = resolveReward(tier, wager ?? { gold, scrap }, gearFloor)
  return { tier, riskScore, weights, reward }
}
