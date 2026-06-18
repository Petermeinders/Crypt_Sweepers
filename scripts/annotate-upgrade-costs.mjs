import fs from 'fs'
import { resolveUpgradeUseCost, parseTierIndexFromId } from '../js/data/upgradeUseCost.js'
import { WARRIOR_UPGRADES } from '../js/data/upgrades.js'
import { RANGER_UPGRADES } from '../js/data/ranger.js'
import { MAGE_UPGRADES } from '../js/data/mage.js'
import { ENGINEER_UPGRADES } from '../js/data/engineer.js'
import { VAMPIRE_UPGRADES } from '../js/data/vampire.js'
import { NECROMANCER_UPGRADES } from '../js/data/necromancer.js'
import { NINJA_UPGRADES } from '../js/data/ninja.js'

const FILE_MAP = {
  warrior: ['js/data/upgrades.js', 'WARRIOR_UPGRADES', WARRIOR_UPGRADES],
  ranger: ['js/data/ranger.js', 'RANGER_UPGRADES', RANGER_UPGRADES],
  mage: ['js/data/mage.js', 'MAGE_UPGRADES', MAGE_UPGRADES],
  engineer: ['js/data/engineer.js', 'ENGINEER_UPGRADES', ENGINEER_UPGRADES],
  vampire: ['js/data/vampire.js', 'VAMPIRE_UPGRADES', VAMPIRE_UPGRADES],
  necromancer: ['js/data/necromancer.js', 'NECROMANCER_UPGRADES', NECROMANCER_UPGRADES],
  ninja: ['js/data/ninja.js', 'NINJA_UPGRADES', NINJA_UPGRADES],
}

const COST_LINE = /^\s*(manaCost|hpCost|useCostNone):.*,\s*\n/gm

function tierIndexInTab(id, def, map) {
  const parentId = def.masteryOf
  const branch = def.branch ?? null
  const siblings = Object.entries(map)
    .filter(([, d]) => d.masteryOf === parentId && (d.branch ?? null) === branch)
    .sort((a, b) => a[0].localeCompare(b[0]))
  return siblings.findIndex(([sid]) => sid === id)
}

function tierIndexForEntry(id, def, map) {
  const fromId = parseTierIndexFromId(id)
  if (fromId != null) return fromId
  if (def.effect?.type === 'ricochet-arc-mastery') return null
  return tierIndexInTab(id, def, map)
}

function costField(def, parent, tierIndex) {
  const cost = resolveUpgradeUseCost(def, parent, tierIndex)
  if (!cost) return null
  if (cost.kind === 'hp') return `hpCost: ${cost.value},`
  return `manaCost: ${cost.value},`
}

for (const [hero, [file, exportName, map]] of Object.entries(FILE_MAP)) {
  let text = fs.readFileSync(file, 'utf8')
  const marker = `export const ${exportName} = {`
  const upgradesStart = text.indexOf(marker)
  if (upgradesStart < 0) {
    console.warn('missing export', hero, exportName)
    continue
  }

  const before = text.slice(0, upgradesStart)
  let upgrades = text.slice(upgradesStart)
  upgrades = upgrades.replace(COST_LINE, '')

  let patches = 0
  for (const [id, def] of Object.entries(map)) {
    const parent = def.masteryOf ? map[def.masteryOf] : def
    const tierIndex = def.masteryOf ? tierIndexForEntry(id, def, map) : null
    const bareDef = { ...def, id }
    delete bareDef.manaCost
    delete bareDef.hpCost
    delete bareDef.useCostNone
    const field = def.useCostNone
      ? 'useCostNone: true,'
      : costField(bareDef, parent, tierIndex != null && tierIndex >= 0 ? tierIndex : null)
    if (!field && !def.useCostNone) continue

    const key = `'${id}':`
    const blockStart = upgrades.indexOf(key)
    if (blockStart < 0) {
      console.warn('missing key in upgrades', hero, id)
      continue
    }
    const slice = upgrades.slice(blockStart, blockStart + 700)
    if (slice.includes('manaCost') || slice.includes('hpCost') || slice.includes('useCostNone')) continue

    const xpMatch = slice.match(/\n\s*xpCost:\s*\d+,/)
    if (xpMatch) {
      const insertAt = blockStart + xpMatch.index + xpMatch[0].length
      upgrades = upgrades.slice(0, insertAt) + `\n    ${field}` + upgrades.slice(insertAt)
      patches++
      continue
    }

    const afterName = slice.match(/\n(\s*)(requires:|innate:|isPassive:|effect:|hpCost:|manaGain:)/)
    if (afterName) {
      const insertAt = blockStart + afterName.index
      const indent = afterName[1]
      upgrades = upgrades.slice(0, insertAt) + `\n${indent}${field}` + upgrades.slice(insertAt)
      patches++
    }
  }

  // Strip accidental cost lines from pre-UPGRADES sections (level-up pools)
  const cleanedBefore = before.replace(COST_LINE, '')
  fs.writeFileSync(file, cleanedBefore + upgrades)
  console.log(hero, patches, 'upgrades patched')
}
