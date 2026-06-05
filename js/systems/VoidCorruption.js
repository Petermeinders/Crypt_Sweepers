/**
 * Void trial corruption — curse triplet, stack modifiers, player cap recompute.
 */
import { CONFIG } from '../config.js'
import { isVoidTrialRun } from './VoidTrial.js'

export function getCorruptionPool() {
  return Object.keys(CONFIG.void?.corruption?.curses ?? {})
}

/** Fisher–Yates shuffle; draw `size` unique ids when pool is large enough. */
export function rollCorruptionTriplet(poolIds, size = 3) {
  const pool = [...poolIds]
  const n = Math.min(size, pool.length)
  const out = []
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
    out.push(pool[i])
  }
  return out
}

export function getCorruptionModifiers(run) {
  const stacks = run?.corruption?.stacks ?? {}
  const curses = CONFIG.void?.corruption?.curses ?? {}
  const out = {
    maxHpMult: 0,
    maxManaMult: 0,
    missStrike: 0,
    lootMult: 0,
    blockFail: 0,
    abilityFail: 0,
    enemyDmgMult: 0,
    enemyHpMult: 0,
  }
  for (const [id, count] of Object.entries(stacks)) {
    const n = Number(count) || 0
    if (n < 1) continue
    const def = curses[id]
    if (!def?.perPick) continue
    for (const [key, per] of Object.entries(def.perPick)) {
      out[key] = (out[key] ?? 0) + per * n
    }
  }
  return out
}

export function curseDisplay(id) {
  const def = CONFIG.void?.corruption?.curses?.[id]
  if (!def) return { id, label: id, description: '' }
  return { id, label: def.label ?? id, description: def.description ?? '' }
}

function _pctFromPerPick(perPick, key, stacks, { negate = false } = {}) {
  const v = perPick?.[key]
  if (typeof v !== 'number') return null
  const pct = Math.round(stacks * Math.abs(v) * 100)
  const sign = negate ? (v < 0 ? '−' : '+') : (v < 0 ? '−' : '+')
  return { pct, sign }
}

export function corruptionStackSummary(id, stacks) {
  const n = Number(stacks) || 0
  if (n < 1) return ''
  const def = CONFIG.void?.corruption?.curses?.[id]
  const per = def?.perPick
  if (!per) return def?.description ?? ''

  if (per.maxHpMult != null) {
    const { pct, sign } = _pctFromPerPick(per, 'maxHpMult', n, { negate: true })
    return `${sign}${pct}% max HP (total)`
  }
  if (per.maxManaMult != null) {
    const { pct, sign } = _pctFromPerPick(per, 'maxManaMult', n, { negate: true })
    return `${sign}${pct}% max MP (total)`
  }
  if (per.missStrike != null) {
    const { pct, sign } = _pctFromPerPick(per, 'missStrike', n)
    return `${sign}${pct}% miss on strikes (total)`
  }
  if (per.lootMult != null) {
    const { pct, sign } = _pctFromPerPick(per, 'lootMult', n, { negate: true })
    return `${sign}${pct}% loot drops (total)`
  }
  if (per.blockFail != null) {
    const { pct, sign } = _pctFromPerPick(per, 'blockFail', n)
    return `${sign}${pct}% block/parry fail (total)`
  }
  if (per.abilityFail != null) {
    const { pct, sign } = _pctFromPerPick(per, 'abilityFail', n)
    return `${sign}${pct}% ability fail (total)`
  }
  if (per.enemyDmgMult != null) {
    const { pct, sign } = _pctFromPerPick(per, 'enemyDmgMult', n)
    return `${sign}${pct}% enemy damage (total)`
  }
  if (per.enemyHpMult != null) {
    const { pct, sign } = _pctFromPerPick(per, 'enemyHpMult', n)
    return `${sign}${pct}% enemy HP (total)`
  }
  return def.description ?? ''
}

/** Net effect summary for HUD (one line per active curse). */
export function formatCorruptionHudLines(run) {
  const stacks = run?.corruption?.stacks ?? {}
  const curses = CONFIG.void?.corruption?.curses ?? {}
  const lines = []
  for (const [id, count] of Object.entries(stacks)) {
    const n = Number(count) || 0
    if (n < 1) continue
    const def = curses[id]
    if (!def) continue
    lines.push({
      id,
      label: def.label ?? id,
      count: n,
      net: corruptionStackSummary(id, n),
    })
  }
  return lines
}

/** Active curses for corruption dropdown (label, stacks, description, summary). */
export function getActiveCorruptionEntries(run) {
  const stacks = run?.corruption?.stacks ?? {}
  const entries = []
  for (const [id, count] of Object.entries(stacks)) {
    const n = Number(count) || 0
    if (n < 1) continue
    const { label, description } = curseDisplay(id)
    entries.push({
      id,
      label,
      stacks: n,
      description,
      summary: corruptionStackSummary(id, n),
    })
  }
  return entries
}

export function needsCorruptionPick(run) {
  if (!isVoidTrialRun(run) || run.atRest) return false
  const picked = run.corruption?.pickedFloors ?? []
  return !picked.includes(run.floor)
}

export function isVoidCorruptionBlocking(run) {
  return !!run?._voidCorruptionBlocking
}

export function applyCorruptionPick(run, curseId) {
  if (!run.corruption) run.corruption = { stacks: {}, pickedFloors: [] }
  run.corruption.stacks[curseId] = (run.corruption.stacks[curseId] ?? 0) + 1
  if (!run.corruption.pickedFloors.includes(run.floor)) {
    run.corruption.pickedFloors.push(run.floor)
  }
  run.corruption.pendingTriplet = null
  run._voidCorruptionBlocking = false
}

export function rollStrikeMiss(run) {
  if (!isVoidTrialRun(run)) return false
  const rate = getCorruptionModifiers(run).missStrike ?? 0
  return rate > 0 && Math.random() < rate
}

export function rollAbilityFizzle(run) {
  if (!isVoidTrialRun(run)) return false
  const corrupt = getCorruptionModifiers(run).abilityFail ?? 0
  const gaze = (run.player?.voidGazeStacks ?? 0) * (run.player?.voidGazeFizzlePerStack ?? 0.05)
  const rate = corrupt + gaze
  return rate > 0 && Math.random() < rate
}

export function rollParryFail(run) {
  if (!isVoidTrialRun(run)) return false
  const rate = getCorruptionModifiers(run).blockFail ?? 0
  return rate > 0 && Math.random() < rate
}

export function voidLootChanceMult(run) {
  if (!isVoidTrialRun(run)) return 1
  const loot = getCorruptionModifiers(run).lootMult ?? 0
  return Math.max(0, 1 + loot)
}

/** Clear per-run corruption cap snapshot (new void trial). */
export function resetVoidCorruptionBaseCaps(player) {
  delete player.voidCorruptionBaseMaxHp
  delete player.voidCorruptionBaseMaxMana
}

/**
 * Snapshot uncorrupted max HP/mana once per void run (gear-inclusive).
 * Must NOT use baseMaxHp/baseMaxMana — those are pre-gear and would slash caps on first pick.
 */
export function ensureVoidCorruptionBaseCaps(player) {
  if (player.voidCorruptionBaseMaxHp == null) {
    player.voidCorruptionBaseMaxHp = player.maxHp
  }
  if (player.voidCorruptionBaseMaxMana == null) {
    player.voidCorruptionBaseMaxMana = player.maxMana
  }
}

/** After in-run max HP/mana gains (vitality, arcane reserve), keep corruption base in sync. */
export function bumpVoidCorruptionBaseCaps(player, { maxHpDelta = 0, maxManaDelta = 0 } = {}) {
  if (maxHpDelta && player.voidCorruptionBaseMaxHp != null) {
    player.voidCorruptionBaseMaxHp += maxHpDelta
  }
  if (maxManaDelta && player.voidCorruptionBaseMaxMana != null) {
    player.voidCorruptionBaseMaxMana += maxManaDelta
  }
}

/** @deprecated Use ensureVoidCorruptionBaseCaps — kept for import stability. */
export function recomputePlayerCapsFromCorruption(player) {
  ensureVoidCorruptionBaseCaps(player)
}

export function applyCorruptionCapsToPlayer(run, player) {
  if (!isVoidTrialRun(run)) return
  ensureVoidCorruptionBaseCaps(player)
  const mods = getCorruptionModifiers(run)
  const baseHp = player.voidCorruptionBaseMaxHp
  const baseMana = player.voidCorruptionBaseMaxMana
  const hpMult = 1 + (mods.maxHpMult ?? 0)
  const manaMult = 1 + (mods.maxManaMult ?? 0)
  player.maxHp = Math.max(1, Math.floor(baseHp * hpMult))
  player.maxMana = Math.max(0, Math.floor(baseMana * manaMult))
  player.hp = Math.max(1, Math.min(player.hp, player.maxHp))
  player.mana = Math.max(0, Math.min(player.mana, player.maxMana))
}
