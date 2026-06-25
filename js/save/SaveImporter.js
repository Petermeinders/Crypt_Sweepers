import Logger from '../core/Logger.js'
import MetaProgression from '../systems/MetaProgression.js'
import { migrateSave } from '../boot/SaveMigrator.js'

const HERO_KEYS = ['warrior', 'ranger', 'engineer', 'mage', 'vampire', 'necromancer']

function safeNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, n) : fallback
}

/** @returns {object | null} */
export function parseSaveJson(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (
      v && typeof v === 'object' && !Array.isArray(v)
      && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
    ) {
      out[k] = deepMerge({ ...base[k] }, v)
    } else {
      out[k] = v
    }
  }
  return out
}

export function mergeSaveOntoDefaults(source) {
  return deepMerge(MetaProgression.defaultSave(), source ?? {})
}

function applyTierCurrencies(target, source) {
  if (source.persistentGold != null) target.persistentGold = safeNum(source.persistentGold)
  if (source.scrap != null) target.scrap = safeNum(source.scrap)
  for (const hero of HERO_KEYS) {
    const xp = source[hero]?.totalXP
    if (xp != null) {
      target[hero] ??= MetaProgression.defaultSave()[hero] ?? { totalXP: 0, upgrades: [] }
      target[hero].totalXP = safeNum(xp)
    }
  }
}

function applyTierHeroes(target, source) {
  for (const hero of HERO_KEYS) {
    const src = source[hero]
    if (!src || typeof src !== 'object') continue
    const base = MetaProgression.defaultSave()[hero] ?? { totalXP: 0, upgrades: [] }
    target[hero] = { ...base, ...target[hero] }
    if (src.totalXP != null) target[hero].totalXP = safeNum(src.totalXP)
    if (Array.isArray(src.upgrades)) target[hero].upgrades = [...src.upgrades]
    if (hero === 'warrior' && Array.isArray(src.shopCart)) target.warrior.shopCart = [...src.shopCart]
    if (hero === 'ranger' && src.unlocked != null) target.ranger.unlocked = !!src.unlocked
  }
}

function applyTierUnlocks(target, source) {
  if (Array.isArray(source.unlockedHeroes)) {
    target.unlockedHeroes = [...new Set(['warrior', ...source.unlockedHeroes.filter(h => typeof h === 'string')])]
  }
  if (typeof source.selectedCharacter === 'string') target.selectedCharacter = source.selectedCharacter
  if (source.ranger?.unlocked != null) {
    target.ranger ??= { unlocked: false, totalXP: 0, upgrades: [] }
    target.ranger.unlocked = !!source.ranger.unlocked
  }
}

function applyTierOtherUnlocks(target, source) {
  if (Array.isArray(source.globalPassives)) target.globalPassives = [...source.globalPassives]
  if (Array.isArray(source.bestiarySeen)) target.bestiarySeen = [...source.bestiarySeen]
  if (Array.isArray(source.trinketsSeen)) target.trinketsSeen = [...source.trinketsSeen]
}

function applyTierRemainder(target, source) {
  if (source.version != null) target.version = String(source.version)
  if (source.equippedGear != null) target.equippedGear = source.equippedGear
  if (source.equippedGems != null) target.equippedGems = source.equippedGems
  if (source.safePocketTrinket !== undefined) target.safePocketTrinket = source.safePocketTrinket
  if (source.settings && typeof source.settings === 'object') {
    target.settings = { ...target.settings, ...source.settings }
  }
  if (source.activeRun != null) target.activeRun = source.activeRun
}

const SALVAGE_TIERS = [
  { name: 'currencies', apply: applyTierCurrencies },
  { name: 'heroes', apply: applyTierHeroes },
  { name: 'character-unlocks', apply: applyTierUnlocks },
  { name: 'other-unlocks', apply: applyTierOtherUnlocks },
  { name: 'remainder', apply: applyTierRemainder },
]

/**
 * Best-effort recovery when a full import fails. Applies tiers in priority order;
 * stops at the first tier that throws and returns whatever was recovered.
 * @returns {{ save: object, partial: true, recoveredTiers: string[] } | null}
 */
export function salvageSaveImport(raw) {
  const source = parseSaveJson(raw)
  if (!source) return null

  const target = MetaProgression.defaultSave()
  const recoveredTiers = []

  for (const tier of SALVAGE_TIERS) {
    try {
      tier.apply(target, source)
      recoveredTiers.push(tier.name)
    } catch (err) {
      Logger.warn(`[SaveImporter] Salvage stopped at tier "${tier.name}"`, err)
      break
    }
  }

  if (!recoveredTiers.length) return null

  try {
    const { save } = migrateSave(target)
    return { save, partial: true, recoveredTiers }
  } catch (err) {
    Logger.warn('[SaveImporter] migrateSave failed on salvaged save — using pre-migrate copy', err)
    return { save: target, partial: true, recoveredTiers }
  }
}

/** Normal import: merge onto defaults, migrate, return save. */
export function importSaveData(raw) {
  const source = parseSaveJson(raw)
  if (!source) throw new Error('Invalid JSON — not a save file')
  if (!source.version) throw new Error('Missing version field — not a valid save file')
  const { save } = migrateSave(mergeSaveOntoDefaults(source))
  return { save, partial: false, recoveredTiers: [] }
}
