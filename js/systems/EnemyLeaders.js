import { CONFIG } from '../config.js'
import { ENEMY_DEFS } from '../data/enemies.js'
import UI from '../ui/UI.js'

const SKIP_AURA_TAGS = new Set(['telegraphs', 'fast', 'boss', 'ranged'])
const CREW_BUFF_HP = 3

/** Tags we apply to follower enemyData (combat + display). */
const IMPLEMENTED_AURA_TAGS = new Set([
  'shield-block',
  'spell-immune',
  'freezing-hit',
  'corruption',
  'burn',
  'poison',
  'plague-bite',
  'harass',
  'crew-aura',
  'demon-flip',
  'crystal-aura',
])

export function rollLeaderSlotCount() {
  const { floorChanceOne, floorChanceTwo } = CONFIG.enemy.leader
  const r = Math.random()
  if (r < floorChanceTwo) return 2
  if (r < floorChanceTwo + floorChanceOne) return 1
  return 0
}

/** Primary gimmick tags a leader spreads (excludes telegraphs / fast / boss / ranged). */
export function getSpreadTagsForEnemy(enemyId) {
  const def = ENEMY_DEFS[enemyId]
  if (!def) return []
  return [...new Set((def.attributes ?? []).filter(t => !SKIP_AURA_TAGS.has(t) && IMPLEMENTED_AURA_TAGS.has(t)))]
}

function _mergeTagsFromLeaders(leaderEnemyDatas) {
  const seen = new Set()
  const out = []
  for (const ed of leaderEnemyDatas) {
    for (const tag of getSpreadTagsForEnemy(ed.enemyId)) {
      if (seen.has(tag)) continue
      seen.add(tag)
      out.push(tag)
    }
  }
  return out
}

function _stripLeaderAuras(ed) {
  if (!ed) return
  const applied = ed._leaderApplied
  if (applied?.crewAuraHp) {
    const cur = Number(ed.currentHP)
    const safe = Number.isFinite(cur) ? cur : Number(ed.hp ?? 1)
    ed.currentHP = Math.max(1, safe - CREW_BUFF_HP)
  }
  if (applied) {
    for (const key of Object.keys(applied)) {
      if (key === 'crewAuraHp') continue
      delete ed[key]
    }
  }
  delete ed._leaderApplied
  delete ed._leaderAuraTags
  delete ed._leaderCrewHpApplied
  if (ed._baseAttributes) {
    ed.attributes = [...ed._baseAttributes]
    delete ed._baseAttributes
  }
}

function _applyAuraTags(ed, tags, sourceDef) {
  ed._leaderApplied = {}
  for (const tag of tags) {
    switch (tag) {
      case 'shield-block':
        ed.shieldBlock = true
        ed._leaderApplied.shieldBlock = true
        break
      case 'spell-immune':
        ed.spellImmune = true
        ed._leaderApplied.spellImmune = true
        break
      case 'freezing-hit':
        ed.freezingHit = true
        ed._leaderApplied.freezingHit = true
        break
      case 'corruption':
        ed.corruptionHit = true
        ed._leaderApplied.corruptionHit = true
        break
      case 'burn':
        ed.burnHit = true
        ed.burnHitAmount = sourceDef?.burnHitAmount ?? ed.burnHitAmount ?? 1
        ed._leaderApplied.burnHit = true
        break
      case 'poison':
      case 'plague-bite':
        ed.poisonHit = true
        ed.poisonHitAmount = sourceDef?.poisonHitAmount ?? ed.poisonHitAmount ?? 1
        ed._leaderApplied.poisonHit = true
        break
      case 'harass':
        ed.harassPlayer = true
        ed.harassDmg = sourceDef?.harassDmg ?? 1
        ed._leaderApplied.harassPlayer = true
        break
      case 'demon-flip':
        ed.demonFlip = true
        if (sourceDef?.demonFlipChance != null) ed.demonFlipChance = sourceDef.demonFlipChance
        ed._leaderApplied.demonFlip = true
        break
      case 'crystal-aura':
        ed.crystalAura = sourceDef?.crystalAura ?? 0.20
        ed._leaderApplied.crystalAura = true
        break
      case 'crew-aura':
        ed._leaderApplied.crewAuraHp = true
        break
      default:
        break
    }
  }
  ed._leaderAuraTags = [...tags]
  if (!ed._baseAttributes) ed._baseAttributes = [...(ed.attributes ?? [])]
  const display = new Set(ed._baseAttributes)
  for (const t of tags) display.add(t)
  ed.attributes = [...display]
}

function _visibleLeaders(grid) {
  const leaders = []
  for (const row of grid) {
    for (const t of row) {
      if (!t?.revealed || !t.enemyData || t.enemyData._slain || !t.enemyData.isLeader) continue
      leaders.push(t)
    }
  }
  const max = CONFIG.enemy.leader.maxVisible ?? 2
  return leaders.slice(0, max)
}

function _applyCrewHpBuff(tile) {
  const ed = tile.enemyData
  if (!ed || ed._slain || ed.isLeader) return
  if (ed._leaderApplied?.crewAuraHp && ed._leaderCrewHpApplied) return
  const cur = Number(ed.currentHP)
  const base = Number.isFinite(cur) ? cur : Number(ed.hp ?? 1)
  ed.currentHP = (Number.isFinite(base) ? base : 1) + CREW_BUFF_HP
  ed._leaderCrewHpApplied = true
  if (tile.element) {
    UI.updateEnemyHP(tile.element, ed.currentHP)
    UI.spawnFloat(tile.element, `⚓ +${CREW_BUFF_HP} HP`, 'heal')
  }
}

/**
 * Recompute leader auras for all revealed enemies from currently visible leaders (max 2).
 */
export function recomputeLeaderAuras(grid) {
  if (!grid) return
  const leaders = _visibleLeaders(grid)
  const mergedTags = _mergeTagsFromLeaders(leaders.map(t => t.enemyData))
  const sourceDef = leaders[0] ? ENEMY_DEFS[leaders[0].enemyData.enemyId] : null

  for (const row of grid) {
    for (const t of row) {
      if (!t?.revealed || !t.enemyData || t.enemyData._slain) continue
      const ed = t.enemyData
      if (ed.isLeader) continue
      _stripLeaderAuras(ed)
      if (leaders.length && mergedTags.length) {
        _applyAuraTags(ed, mergedTags, sourceDef)
        if (mergedTags.includes('crew-aura')) _applyCrewHpBuff(t)
      } else if (t.element) {
        UI.updateEnemyHP(t.element, ed.currentHP)
      }
    }
  }
}

/** Promote up to `slotCount` eligible hidden enemies on a freshly generated floor. */
export function assignFloorLeaders(grid, slotCount) {
  if (!grid || slotCount <= 0) return
  const max = CONFIG.enemy.leader.maxVisible ?? 2
  const cap = Math.min(slotCount, max)
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (!t?.enemyData || t.enemyData._slain) continue
      const id = t.enemyData.enemyId
      if (!ENEMY_DEFS[id]?.leaderEligible) continue
      candidates.push(t)
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  let promoted = 0
  for (const t of candidates) {
    if (promoted >= cap) break
    t.enemyData.isLeader = true
    if (!t.enemyData.attributes?.includes('leader')) {
      t.enemyData.attributes = [...(t.enemyData.attributes ?? []), 'leader']
    }
    promoted++
  }
}

export function onEnemyRevealed(grid, tile) {
  if (!grid || !tile?.enemyData || tile.enemyData._slain) return
  if (tile.enemyData.isLeader) {
    UI.setMessage('🚩 A leader emerges — its power spreads to the pack!')
  }
  recomputeLeaderAuras(grid)
}

export function onLeaderSlain(grid, tile) {
  if (!grid || !tile?.enemyData?.isLeader) return
  UI.setMessage('🚩 The leader falls — its aura fades from the pack.')
  recomputeLeaderAuras(grid)
}

export function leaderFlagHTML(tile) {
  return tile?.enemyData?.isLeader
    ? '<span class="tile-leader-flag" title="Leader">🚩</span>'
    : ''
}

export default {
  rollLeaderSlotCount,
  getSpreadTagsForEnemy,
  assignFloorLeaders,
  recomputeLeaderAuras,
  onEnemyRevealed,
  onLeaderSlain,
  leaderFlagHTML,
}
