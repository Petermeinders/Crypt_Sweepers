/**
 * Void trial helpers — boss/sanctuary floor rules, tier CONFIG lookup.
 */
import { CONFIG } from '../config.js'

/** @param {import('../core/RunContext.js').Run | null | undefined} run */
export function isVoidTrialRun(run) {
  return !!run?.isVoidTrial && run.voidTier >= 1 && run.voidTier <= 3
}

export function getVoidTierConfig(tier) {
  return CONFIG.void?.trials?.[tier] ?? null
}

const VOID_TIER_ROMAN = { 1: 'I', 2: 'II', 3: 'III' }

/** Display percent for banner copy: mult 1.5 → 50. */
export function voidTrialBonusPct(mult) {
  const m = Number(mult)
  if (!Number.isFinite(m) || m <= 1) return 0
  return Math.round((m - 1) * 100)
}

export function voidTierRoman(tier) {
  return VOID_TIER_ROMAN[tier] ?? String(tier)
}

/** Labels for void trial selection banners — sourced from CONFIG.void.trials. */
export function voidTrialBannerDisplay(tier) {
  const cfg = getVoidTierConfig(tier)
  if (!cfg) return null
  return {
    name: cfg.name ?? `Tier ${tier}`,
    roman: voidTierRoman(tier),
    tierLabel: `TIER ${voidTierRoman(tier)}`,
    enemyPct: voidTrialBonusPct(cfg.enemyStatMult),
    lootPct: voidTrialBonusPct(cfg.lootMult),
    flavor: cfg.flavor ?? '',
    maxFloor: cfg.maxFloor ?? 20,
  }
}

/** @param {import('../core/RunContext.js').Run} run */
export function voidMaxFloor(run) {
  return run.voidMaxFloor ?? getVoidTierConfig(run.voidTier)?.maxFloor ?? 20
}

/** Boss only on trial finale (not every 5 floors). */
export function isVoidBossFloor(run, floor) {
  if (!isVoidTrialRun(run)) return false
  return floor === voidMaxFloor(run) && !run.atRest
}

/** Sanctuary rest immediately before the finale boss floor. */
export function isVoidPreBossSanctuaryFloor(run, floor) {
  if (!isVoidTrialRun(run)) return false
  return floor === voidMaxFloor(run) - 1
}

/**
 * @param {import('../core/RunContext.js').Run | null | undefined} run
 * @param {number} floor
 */
export function isBossFloorForRun(run, floor) {
  if (!run) return CONFIG.bossFloors.includes(floor)
  if (isVoidTrialRun(run)) return isVoidBossFloor(run, floor)
  if (run.checkpointStart && CONFIG.bossFloors.includes(floor)) return false
  return CONFIG.bossFloors.includes(floor) && !run.atRest
}

/** Non-void boss cadence check (spawns, keys, etc.). */
export function isStandardBossCadenceFloor(floor) {
  return CONFIG.bossFloors.includes(floor)
}

export function voidEnemyStatMult(tier) {
  return getVoidTierConfig(tier)?.enemyStatMult ?? 1
}

/** Main-game floor index used for void trial enemy scaling (void floor 1 → base, +1 per void floor). */
export function voidEffectiveEnemyFloor(run, trialFloor = run?.floor ?? 1) {
  if (!isVoidTrialRun(run)) return trialFloor
  const base = CONFIG.void?.enemyBaseFloor ?? 50
  return base + Math.max(0, Math.floor(trialFloor) - 1)
}

export function voidLootMult(tier) {
  return getVoidTierConfig(tier)?.lootMult ?? 1
}

export function voidCompletionVoidChance(tier) {
  const t = CONFIG.void?.completionVoidChance
  if (!t) return 0.2
  return t[tier] ?? t[1] ?? 0.2
}

export function voidCompletionStatMult(tier) {
  const t = CONFIG.void?.completionPositiveStatMult
  if (!t) return 1
  return t[tier] ?? 1
}
