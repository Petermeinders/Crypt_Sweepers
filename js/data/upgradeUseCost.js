/** Resolve per-use resource cost for hero-select badges (meta tier → in-run cost at that tier). */

const FLAT_MANA_ABILITIES = new Set(['raise-minion', 'strengthen-minion', 'corpse-explosion', 'bone-armor'])
const FREE_TOGGLE_ABILITIES = new Set(['life-tap', 'tesla-tower', 'mana-generator'])

const BLOOD_TITHE_HP = [10, 9, 8, 7]
const BLOOD_PACT_MANA = [15, 13, 10, 10]
const STRENGTHEN_MANA = [10, 15, 20, 30]
const BONE_ARMOR_MANA = [10, 15, 20]

function parentAbilityId(parentDef) {
  return parentDef?.effect?.ability ?? null
}

function tierNumber(tierIndex) {
  return tierIndex == null ? 0 : tierIndex + 1
}

/** Parse Roman-numeral tier from upgrade id suffix (e.g. slam-mastery-2 → 1). */
export function parseTierIndexFromId(tierId) {
  const m = String(tierId).match(/-(\d+)$/)
  return m ? Number(m[1]) - 1 : null
}

/**
 * @returns {{ kind: 'mana'|'hp', value: number } | null}
 */
export function resolveUpgradeUseCost(def, parentDef, tierIndex = null) {
  if (def?.useCostNone) return null
  if (def?.manaCost != null) return { kind: 'mana', value: def.manaCost }
  if (def?.hpCost != null) return { kind: 'hp', value: def.hpCost }

  const parent = parentDef ?? def
  const abilityId = parentAbilityId(parent) ?? parentAbilityId(def)
  const tier = tierNumber(tierIndex)

  if (abilityId === 'blood-tithe' || def?.masteryOf === 'blood-tithe') {
    return { kind: 'hp', value: BLOOD_TITHE_HP[tier] ?? BLOOD_TITHE_HP[0] }
  }

  if (abilityId === 'blood-pact' || def?.masteryOf === 'blood-pact') {
    return { kind: 'mana', value: BLOOD_PACT_MANA[tier] ?? BLOOD_PACT_MANA[0] }
  }

  if (def?.masteryOf === 'strengthen-minion' && tierIndex != null) {
    return { kind: 'mana', value: STRENGTHEN_MANA[tier] ?? STRENGTHEN_MANA[0] }
  }
  if (abilityId === 'strengthen-minion') {
    return { kind: 'mana', value: STRENGTHEN_MANA[tier] ?? STRENGTHEN_MANA[0] }
  }

  if (def?.masteryOf === 'bone-armor' && tierIndex != null) {
    return { kind: 'mana', value: BONE_ARMOR_MANA[tierIndex] ?? BONE_ARMOR_MANA[0] }
  }
  if (abilityId === 'bone-armor') {
    return { kind: 'mana', value: BONE_ARMOR_MANA[0] }
  }

  if (def?.id === 'shadowstrike-mastery-3' || (def?.masteryOf === 'shadowstrike' && tierIndex === 2)) {
    return { kind: 'mana', value: 0 }
  }

  if (def?.masteryOf === 'smoke-bomb' && tierIndex === 1) {
    return { kind: 'mana', value: 8 }
  }

  if (def?.effect?.type === 'ricochet-arc-mastery') {
    return { kind: 'mana', value: parent.manaCost ?? 10 }
  }

  if (FREE_TOGGLE_ABILITIES.has(abilityId) || FREE_TOGGLE_ABILITIES.has(def?.masteryOf)) {
    return { kind: 'mana', value: 0 }
  }

  if (def?.id?.startsWith('turret-mastery-mastery')) {
    return { kind: 'mana', value: 10 }
  }

  if (FLAT_MANA_ABILITIES.has(abilityId) || FLAT_MANA_ABILITIES.has(def?.masteryOf)) {
    const base = parent.manaCost ?? 10
    return { kind: 'mana', value: base }
  }

  if (parent.innate && parent.manaCost != null) {
    return { kind: 'mana', value: parent.manaCost }
  }

  if (parent.manaCost != null) {
    return { kind: 'mana', value: parent.manaCost + 2 * tier }
  }

  if (parent.hpCost != null) {
    return { kind: 'hp', value: parent.hpCost }
  }

  return null
}

export function formatUseCostLabel(cost) {
  if (!cost) return ''
  if (cost.kind === 'mana' && cost.value === 0) return 'Free'
  if (cost.kind === 'mana') return `${cost.value} MP`
  if (cost.kind === 'hp') return `${cost.value} HP`
  return ''
}

export function useCostHtml(cost) {
  if (!cost) return ''
  const label = formatUseCostLabel(cost)
  const cls = cost.kind === 'hp'
    ? 'upgrade-tier-cost is-hp'
    : (cost.value === 0 ? 'upgrade-tier-cost is-free' : 'upgrade-tier-cost')
  return `<span class="${cls}">${label}</span>`
}
