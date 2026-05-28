import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { session } from '../core/RunContext.js'

export function playerOutgoingDamageMult(ctx) {
  let mult = 1
  // Glass Cannon Shard
  if (ctx.hasItem('')) {
    const p = session.run.player
    const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 0
    mult *= ratio > 0.5 ? 1.5 : 0.5
  }
  // Freezing Hit: -20% per stack, max 5 stacks
  const freezeStacks = session.run?.player?.freezingHitStacks ?? 0
  if (freezeStacks > 0) {
    mult *= Math.max(0.05, 1 - freezeStacks * 0.20)
  }
  return mult
}

export function scaleOutgoingDamageToEnemy(ctx, dmg) {
  const raw = Number(dmg)
  const base = Number.isFinite(raw) ? raw : 1
  const mult = playerOutgoingDamageMult(ctx)
  const m = Number.isFinite(mult) ? mult : 1
  const scaled = Math.max(1, Math.round(base * m))
  // Corruption: -1 flat damage per stack (min 1)
  const corruptionPenalty = session.run?.player?.corruptionStacks ?? 0
  const out = Math.max(1, scaled - corruptionPenalty)
  return Number.isFinite(out) ? out : 1
}

export function xpNeeded() {
  return CONFIG.xp.levelUpAt * session.run.player.level
}

export function computeEffectiveDamageTaken(rawAmount) {
  if (!session.run) return rawAmount
  const scaled = Math.round(rawAmount * (session.run.player.damageTakenMult ?? 1))
  const maskReduction   = session.run.player.inventory.some(e => e?.id === 'plague-mask')    ? 1 : 0
  const bladeReduction  = session.run.player.inventory.some(e => e?.id === 'infected-blade') ? 1 : 0
  return Math.max(1, scaled - (session.run.player.damageReduction ?? 0) - maskReduction - bladeReduction)
}

export function playerDamageRange(player) {
  const bonus       = player.damageBonus ?? 0
  const maskPenalty = player.inventory?.some(e => e?.id === 'plague-mask')    ? 1 : 0
  const collarBonus = player.inventory?.some(e => e?.id === 'spiked-collar')  ? 3 : 0
  const soulBonus   = Math.floor(player.soulboundBonus ?? 0)
  const hasRazor    = player.inventory?.some(e => e?.id === 'razors-edge')
  if (player.isRanger) {
    const [lo, hi] = RANGER_BASE.damage
    const max = Math.max(1, hi + bonus + collarBonus + soulBonus - maskPenalty)
    return hasRazor
      ? [max, max]
      : [Math.max(1, lo + bonus + collarBonus + soulBonus - maskPenalty), max]
  }
  if (player.isVampire) {
    const b = VAMPIRE_BASE.damage + bonus + collarBonus + soulBonus - maskPenalty
    const max = Math.max(1, b)
    return hasRazor ? [max, max] : [max, max]
  }
  const base = CONFIG.player.baseDamage
  const b = Array.isArray(base) ? base[0] : base
  const max = Math.max(1, b + bonus + collarBonus + soulBonus - maskPenalty)
  return [max, max]   // warrior is always fixed (same lo/hi), razor's edge is a no-op here but kept for clarity
}
