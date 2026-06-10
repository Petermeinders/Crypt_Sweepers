import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { session } from '../core/RunContext.js'

export function playerOutgoingDamageMult(ctx) {
  let mult = 1
  // Glass Cannon Shard
  if (ctx.hasItem('glass-cannon-shard')) {
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

// Returns { effective, parts } — kept for legacy callers.
export function computeEffectiveDamageTakenBreakdown(rawAmount) {
  const n = buildEnemyHitNarrative({ rawAmount })
  return { effective: n.effectiveBeforeArmor, parts: [] }
}

/**
 * Builds a full narrative string explaining exactly how incoming enemy damage
 * was resolved through each layer: DEF (gear vs passive), armor, HP.
 *
 * @param {{ rawAmount: number, armorBefore?: number, armorAfter?: number,
 *           hpBefore?: number, hpAfter?: number,
 *           negated?: boolean, negationPct?: number,
 *           armorAbsorbed?: number }} opts
 * @returns {{ narrative: string, effectiveBeforeArmor: number }}
 */
export function buildEnemyHitNarrative(opts) {
  const { rawAmount, armorBefore = 0, armorAfter = null,
          hpBefore = null, hpAfter = null,
          negated = false, negationPct = 0,
          armorAbsorbed = 0 } = opts

  if (!session.run) return { narrative: `Enemy strikes for ${rawAmount} damage.`, effectiveBeforeArmor: rawAmount }

  const p = session.run.player
  const mult = p.damageTakenMult ?? 1
  const scaled = Math.round(rawAmount * mult)

  // Split DEF into gear vs passive
  const equippedGear = p.equippedGear ?? {}
  const gearDef = Object.values(equippedGear).reduce((sum, piece) => {
    return sum + (piece?.stats?.damageReduction ?? 0)
  }, 0)
  const totalDef = p.damageReduction ?? 0
  const passiveDef = Math.max(0, totalDef - gearDef)

  const maskReduction  = p.inventory.some(e => e?.id === 'plague-mask')    ? 1 : 0
  const bladeReduction = p.inventory.some(e => e?.id === 'infected-blade') ? 1 : 0
  const totalReduction = totalDef + maskReduction + bladeReduction
  const effectiveBeforeArmor = Math.max(1, scaled - totalReduction)

  // ── Block negation ──
  if (negated) {
    const pct = Math.round(negationPct * 100)
    return {
      narrative: `Your ${pct}% block chance activated and negated the hit completely!`,
      effectiveBeforeArmor,
    }
  }

  const parts = []

  // Opening: enemy raw hit
  parts.push(`The enemy strikes for ${rawAmount} damage.`)

  // Damage mult (e.g. curse)
  if (mult !== 1 && scaled !== rawAmount) {
    parts.push(`A damage modifier scaled it to ${scaled}.`)
  }

  // DEF absorption
  if (totalReduction > 0 && scaled > 1) {
    const actualAbsorbed = Math.min(totalReduction, scaled - 1)
    if (actualAbsorbed > 0) {
      const defParts = []
      if (gearDef > 0)    defParts.push(`${gearDef} from gear`)
      if (passiveDef > 0) defParts.push(`${passiveDef} from passive upgrades`)
      if (maskReduction > 0)  defParts.push(`${maskReduction} from plague mask`)
      if (bladeReduction > 0) defParts.push(`${bladeReduction} from infected blade`)
      const defLabel = defParts.length > 1 ? ` (${defParts.join(', ')})` : ''
      parts.push(`Your Defense absorbed ${actualAbsorbed}${defLabel}, leaving ${effectiveBeforeArmor} to get through.`)
    }
  }

  // Armor
  if (armorBefore > 0 && armorAbsorbed > 0) {
    const hpSpill = effectiveBeforeArmor - armorAbsorbed
    if (armorAfter !== null && armorAfter <= 0) {
      if (hpSpill > 0) {
        parts.push(`Your armor shattered (absorbed ${armorAbsorbed}), and ${hpSpill} damage spilled through to HP.`)
      } else {
        parts.push(`Your armor shattered absorbing all ${armorAbsorbed} damage.`)
      }
    } else {
      if (hpSpill > 0) {
        parts.push(`Armor absorbed ${armorAbsorbed} (${armorAfter} remaining), and ${hpSpill} damage reached HP.`)
      } else {
        parts.push(`Armor absorbed ${armorAbsorbed} (${armorAfter} remaining), blocking the rest.`)
      }
    }
  }

  // HP result
  if (hpBefore !== null && hpAfter !== null) {
    const hpLost = hpBefore - hpAfter
    if (hpLost > 0) {
      parts.push(`You lost ${hpLost} HP, leaving you at ${hpAfter}.`)
    } else if (armorAbsorbed > 0) {
      parts.push(`No HP was lost.`)
    }
  }

  return { narrative: parts.join(' '), effectiveBeforeArmor }
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
