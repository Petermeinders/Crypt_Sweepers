/**
 * Void trial boss completion — roll three gear candidates for reward modal.
 */
import { CONFIG } from '../config.js'
import {
  generateGear,
  pickDropSlot,
  pickDropTier,
  generateGearName,
} from '../data/gear.js'
import {
  voidCompletionVoidChance,
  voidCompletionStatMult,
} from './VoidTrial.js'

const COMPLETION_FLOOR = () => CONFIG.void?.completionStatFloor ?? 95

function bumpPositiveStats(piece, mult) {
  if (!piece?.stats || mult <= 1) return
  for (const [key, val] of Object.entries(piece.stats)) {
    if (val <= 0) continue
    if (key === 'negation') {
      piece.stats[key] = Math.round(val * mult * 1000) / 1000
    } else {
      piece.stats[key] = Math.round(val * mult)
    }
  }
}

/** One completion reward card. */
export function rollVoidCompletionCard(voidTier) {
  const voidChance = voidCompletionVoidChance(voidTier)
  const slot = pickDropSlot()
  let tier
  if (Math.random() < voidChance) {
    tier = 'void'
  } else {
    tier = pickDropTier(COMPLETION_FLOOR())
  }
  const statTier = tier === 'void' ? 'legendary' : tier
  const piece = generateGear(slot, statTier, COMPLETION_FLOOR())
  piece.tier = tier
  if (tier === 'void') {
    piece.name = generateGearName(slot, 'void')
  }
  bumpPositiveStats(piece, voidCompletionStatMult(voidTier))
  piece.voidCompletionReward = true
  return piece
}

export function rollVoidCompletionChoices(voidTier, count = 3) {
  const cards = []
  for (let i = 0; i < count; i++) cards.push(rollVoidCompletionCard(voidTier))
  return cards
}
