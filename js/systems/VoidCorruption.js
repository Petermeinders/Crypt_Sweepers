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

export function corruptionStackSummary(id, stacks) {
  const n = Number(stacks) || 0
  if (n < 1) return ''
  if (id === 'hp_pct') return `−${Math.round(n * 1)}% max HP (total)`
  if (id === 'mp_pct') return `−${Math.round(n * 1)}% max MP (total)`
  if (id === 'miss_strike') return `+${Math.round(n * 2)}% miss on strikes (total)`
  if (id === 'loot_drop') return `−${Math.round(n * 5)}% loot drops (total)`
  if (id === 'block_fail') return `+${Math.round(n * 5)}% block/parry fail (total)`
  if (id === 'ability_fail') return `+${Math.round(n * 5)}% ability fail (total)`
  if (id === 'enemy_dmg') return `+${Math.round(n * 5)}% enemy damage (total)`
  if (id === 'enemy_hp') return `+${Math.round(n * 5)}% enemy HP (total)`
  const def = CONFIG.void?.corruption?.curses?.[id]
  return def?.description ?? ''
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
  const rate = getCorruptionModifiers(run).abilityFail ?? 0
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

/** Reapply max HP/mana after gear + corruption (multiplicative hp/mp curses). */
export function recomputePlayerCapsFromCorruption(player) {
  const baseHp = player.baseMaxHp ?? player.maxHp
  const baseMana = player.baseMaxMana ?? player.maxMana
  player.voidCorruptionBaseMaxHp = baseHp
  player.voidCorruptionBaseMaxMana = baseMana
}

export function applyCorruptionCapsToPlayer(run, player) {
  if (!isVoidTrialRun(run)) return
  const mods = getCorruptionModifiers(run)
  const baseHp = player.voidCorruptionBaseMaxHp ?? player.baseMaxHp ?? player.maxHp
  const baseMana = player.voidCorruptionBaseMaxMana ?? player.baseMaxMana ?? player.maxMana
  const hpMult = 1 + (mods.maxHpMult ?? 0)
  const manaMult = 1 + (mods.maxManaMult ?? 0)
  player.maxHp = Math.max(1, Math.floor(baseHp * hpMult))
  player.maxMana = Math.max(0, Math.floor(baseMana * manaMult))
  player.hp = Math.max(1, Math.min(player.hp, player.maxHp))
  player.mana = Math.max(0, Math.min(player.mana, player.maxMana))
}
