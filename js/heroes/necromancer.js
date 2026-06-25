import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import CombatResolver from '../systems/CombatResolver.js'
import {
  NECROMANCER_MINION,
  NECROMANCER_SCALING,
  RAISE_MINION_COST,
  STRENGTHEN_MINION_COST,
  STRENGTHEN_MINION,
  CORPSE_EXPLOSION_COST,
  CORPSE_EXPLOSION,
  BONE_ARMOR,
  BONE_ARMOR_COST,
  LEGION_II_MELEE_BONUS_PCT,
  GARGANTUAN,
  NECROMANCER_UPGRADES,
} from '../data/necromancer.js'
import { session, charKey } from '../core/RunContext.js'

let _nextMinionId = 1

/** After resume/import, avoid reusing minion ids from the saved run. */
export function restoreMinionIdCounter(minions) {
  let maxId = 0
  for (const m of minions ?? []) {
    if (typeof m.id === 'number' && m.id > maxId) maxId = m.id
  }
  if (maxId >= _nextMinionId) _nextMinionId = maxId + 1
}

const MINION_MASTERY_MAX = NECROMANCER_MINION.hpPctByLevel.length

function minionMasteryLevel() {
  return Math.min(MINION_MASTERY_MAX, Math.max(1, session.run?.player?.minionMasteryLevel ?? 1))
}

function minionMasteryIndex() {
  return minionMasteryLevel() - 1
}

function floorDepthBonus(perFloor) {
  const floor = session.run?.floor ?? 1
  return Math.floor(floor / perFloor)
}

export function getMinionMaxHp() {
  const pct   = NECROMANCER_MINION.hpPctByLevel[minionMasteryIndex()]
  const maxHp = session.run?.player?.maxHp ?? 35
  return Math.max(1, Math.round(maxHp * pct))
}

export function getMinionDmg(ctx) {
  const pct    = NECROMANCER_MINION.dmgPctByLevel[minionMasteryIndex()]
  const avg    = ctx?.avgMeleeDamage?.() ?? 1
  const apMult = CombatResolver.abilityPowerMult(session.run?.player)
  return Math.max(1, Math.round(avg * pct * apMult))
}

/** Raised minion stats — mastery tier % of hero max HP / melee slice + floor depth. */
export function computeRaisedMinionStats(ctx) {
  const baseHp  = getMinionMaxHp()
  const baseDmg = getMinionDmg(ctx)
  const floorHp = floorDepthBonus(NECROMANCER_SCALING.minionHpPerFloor)
  const floor   = session.run?.floor ?? 1
  const floorDmg = Math.max(0, CombatResolver.abilityDmgFloor(floor) - 1)
  return {
    maxHp: baseHp + floorHp,
    dmg:   Math.max(1, baseDmg + floorDmg),
  }
}

export function strengthenMinionStacks() {
  return session.run?.player?.strengthenMinionStacks ?? 0
}

export function computeStrengthenManaCost() {
  const stacks = strengthenMinionStacks()
  if (stacks >= 3) return STRENGTHEN_MINION.manaByMastery[2]
  if (stacks >= 2) return STRENGTHEN_MINION.manaByMastery[1]
  if (stacks >= 1) return STRENGTHEN_MINION.manaByMastery[0]
  return STRENGTHEN_MINION_COST
}

function totalLivingMinionDamage() {
  let total = 0
  for (const m of session.run?.minions ?? []) {
    if (m.hp > 0) total += m.dmg ?? 0
  }
  return total
}

export function computeStrengthenHpGain() {
  const stacks = strengthenMinionStacks()
  const maxHp  = session.run?.player?.maxHp ?? 35
  let hp = stacks >= 1
    ? Math.round(maxHp * STRENGTHEN_MINION.mastery1HpPct)
    : Math.round(maxHp * STRENGTHEN_MINION.baseHpPct)
  if (stacks >= 3) {
    hp += totalLivingMinionDamage()
  }
  return Math.max(1, hp)
}

export function computeStrengthenDmgGain(ctx) {
  if (strengthenMinionStacks() < 2) return 0
  const avg = ctx?.avgMeleeDamage?.() ?? 1
  return Math.max(1, Math.round(avg * STRENGTHEN_MINION.dmgPctMastery2))
}

export function boneArmorStacks() {
  return session.run?.player?.boneArmorStacks ?? 0
}

export function boneArmorTier() {
  return Math.min(3, 1 + boneArmorStacks())
}

export function computeBoneArmorManaCost() {
  return BONE_ARMOR.manaByTier[boneArmorTier() - 1] ?? BONE_ARMOR_COST
}

export function computeCorpseExplosionDamage(ctx, dmgMult = 1) {
  const avg    = ctx.avgMeleeDamage?.() ?? 1
  const apMult = CombatResolver.abilityPowerMult(session.run?.player)
  const raw    = Math.round(avg * CORPSE_EXPLOSION.meleePct * apMult * dmgMult)
  return Math.max(1, raw)
}

function corpseExplosionAbyssalTier() {
  return session.run?.player?.corpseExplosionAbyssalTier ?? 0
}

function corpseExplosionDetonationTier() {
  return session.run?.player?.corpseExplosionDetonationTier ?? 0
}

function corpseExplosionEssenceDrainTier() {
  return session.run?.player?.corpseExplosionEssenceDrainTier ?? 0
}

function enemyStrikePower(enemyData) {
  if (!enemyData) return 1
  if (enemyData.hitDamage != null) return enemyData.hitDamage
  const d = enemyData.dmg
  if (Array.isArray(d)) return Math.round((d[0] + d[1]) / 2)
  return enemyData.dmg ?? 1
}

export function gargantuanTier() {
  return session.run?.player?.minionGargantuanTier ?? 0
}

function getFloorCorpseTiles() {
  const grid = TileEngine.getGrid()
  if (!grid) return []
  const out = []
  for (const row of grid) {
    for (const t of row) {
      if (t?.revealed && t.enemyData?._slain && !t.corpseExploded) out.push(t)
    }
  }
  return out
}

export function computeGargantuanStats(baseHp, baseDmg, corpseCount) {
  const extra = Math.max(0, corpseCount - 1)
  return {
    maxHp: Math.round(baseHp * (1 + GARGANTUAN.hpMultPerExtraCorpse * extra)),
    dmg:   baseDmg + Math.ceil(extra / 2) * GARGANTUAN.dmgPerTwoExtraCorpses,
  }
}

export function cancelGargantuanMergeMode() {
  session.tap.gargantuanMergeMinionId = null
}

export function syncMinionVisual(minion) {
  const tile = TileEngine.getTile(minion.row, minion.col)
  if (!tile?.element) return
  const existing = tile.element.querySelector('.minion-overlay')
  if (existing) existing.remove()
  if (minion.hp <= 0) return
  const overlay = document.createElement('div')
  overlay.className = minion.isGargantuan ? 'minion-overlay gargantuan' : 'minion-overlay'
  const icon = minion.isGargantuan ? '👹' : '🧟'
  overlay.innerHTML = `<span class="minion-icon">${icon}</span>
    <div class="minion-stats">
      <span class="stat-hp">❤️ ${minion.hp}</span>
      <span class="stat-dmg">⚔️ ${minion.dmg}</span>
    </div>`
  tile.element.appendChild(overlay)
}

export function syncAllMinionVisuals() {
  if (!session.run?.minions) return
  for (const m of session.run.minions) {
    if (m.hp <= 0) continue
    syncMinionVisual(m)
    TileEngine.getTile(m.row, m.col)?.element?.classList.add('enemy-alive')
  }
}

export function clearMinionVisuals() {
  if (!session.run?.minions) return
  for (const m of session.run.minions) {
    const tile = TileEngine.getTile(m.row, m.col)
    tile?.element?.querySelector('.minion-overlay')?.remove()
  }
}

export function necroClearAshAfterMinionDeath(ctx, row, col) {
  if (!session.run || charKey() !== 'necromancer') return
  const t = TileEngine.getTile(row, col)
  if (!t?.enemyData?._slain) return
  TileEngine.replaceTileWithEmptyPreserveState(row, col)
  const fresh = TileEngine.getTile(row, col)
  fresh.revealed = true
  const patched = TileEngine.patchMainGridTileAt(row, col, UI.getGridEl(), ctx.onTileTap, ctx.onTileHold)
  if (!patched) ctx.refreshMainGridDomFromModel()
  else {
    TileEngine.refreshAllThreatClueDisplays()
    ctx.syncGridDomClassesFromModel()
  }
  ctx.saveActiveRun()
}

export function necroRaiseMinion(ctx, tile) {
  if (!session.run || !tile?.enemyData?._slain) return
  if (charKey() !== 'necromancer') return
  if (session.run.player.mana < RAISE_MINION_COST) {
    UI.setMessage(`Not enough mana to raise a minion! (need ${RAISE_MINION_COST})`, true)
    return
  }

  const existing = (session.run.minions ?? []).find(m => m.row === tile.row && m.col === tile.col)
  if (existing) {
    UI.setMessage('A minion already guards this tile.', true)
    return
  }

  cancelGargantuanMergeMode()

  const corpses     = getFloorCorpseTiles()
  const corpseCount = corpses.length
  const fuseGarg    = gargantuanTier() >= 1 && corpseCount >= 2

  session.run.player.mana -= RAISE_MINION_COST
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
    if (!adj.revealed && adj.element && !adj.echoHintCategory) {
      const cat = ctx.echoCharmCategoryForTileType(adj.type)
      adj.echoHintCategory = cat
      adj.element.classList.add('echo-hint')
      adj.element.dataset.echoHint = cat
    }
  }

  const baseStats = computeRaisedMinionStats(ctx)
  let maxHp = baseStats.maxHp
  let dmg   = baseStats.dmg
  if (fuseGarg) {
    const scaled = computeGargantuanStats(baseStats.maxHp, baseStats.dmg, corpseCount)
    maxHp = scaled.maxHp
    dmg   = scaled.dmg
    for (const c of corpses) {
      if (c.row === tile.row && c.col === tile.col) continue
      necroClearAshAfterMinionDeath(ctx, c.row, c.col)
    }
  }

  const minion = {
    row:           tile.row,
    col:           tile.col,
    hp:            maxHp,
    maxHp,
    dmg,
    id:            _nextMinionId++,
    isGargantuan:  fuseGarg,
    corpsesMerged: fuseGarg ? corpseCount : 1,
  }
  if (!session.run.minions) session.run.minions = []
  session.run.minions.push(minion)
  syncMinionVisual(minion)
  tile.element.classList.add('enemy-alive')
  if (fuseGarg) {
    UI.spawnFloat(tile.element, '👹 Gargantuan!', 'xp')
    UI.setMessage(`Corpses fuse into a Gargantuan! (${corpseCount} ashes → ❤️ ${maxHp}, ⚔️ ${dmg}) Mana: ${session.run.player.mana}/${session.run.player.maxMana}`)
  } else {
    UI.spawnFloat(tile.element, '🧟 Risen!', 'xp')
    UI.setMessage(`You raise a minion from the ashes! (❤️ ${maxHp}, ⚔️ ${dmg}) Mana: ${session.run.player.mana}/${session.run.player.maxMana}`)
  }
  ctx.saveActiveRun()
}

function _absorbCorpseIntoGargantuan(ctx, garg, corpse) {
  const hpBoost = Math.max(1, Math.round(garg.maxHp * GARGANTUAN.hpMultPerExtraCorpse))
  garg.corpsesMerged = (garg.corpsesMerged ?? 1) + 1
  const dmgBoost = garg.corpsesMerged % 2 === 0 ? GARGANTUAN.dmgPerTwoExtraCorpses : 0
  garg.maxHp += hpBoost
  garg.hp    += hpBoost
  garg.dmg   += dmgBoost
  necroClearAshAfterMinionDeath(ctx, corpse.row, corpse.col)
}

/**
 * If a Gargantuan is alive:
 * - Tapping an enemy ash pile causes the Gargantuan to absorb it (gain HP/dmg).
 * - Tapping the Gargantuan's own tile absorbs ALL ash piles on the floor.
 * Returns true if the tap was consumed.
 */
export function tryGargantuanCorpseAbsorb(ctx, tile) {
  if (charKey() !== 'necromancer') return false
  const garg = (session.run?.minions ?? []).find(m => m.hp > 0 && m.isGargantuan)
  if (!garg) return false

  const isTappingGargantuan = garg.row === tile.row && garg.col === tile.col
  const isTappingCorpse = tile.revealed && tile.enemyData?._slain && !tile.corpseExploded

  if (isTappingGargantuan) {
    const corpses = getFloorCorpseTiles().filter(c => c.row !== garg.row || c.col !== garg.col)
    if (!corpses.length) return false
    for (const corpse of corpses) _absorbCorpseIntoGargantuan(ctx, garg, corpse)
    syncMinionVisual(garg)
    const gTile = TileEngine.getTile(garg.row, garg.col)
    if (gTile?.element) UI.spawnFloat(gTile.element, `👹 +${corpses.length} absorbed!`, 'xp')
    UI.setMessage(`Gargantuan devours ${corpses.length} ash pile${corpses.length > 1 ? 's' : ''}! → ❤️ ${garg.hp}/${garg.maxHp}, ⚔️ ${garg.dmg}`)
    ctx.saveActiveRun()
    return true
  }

  if (isTappingCorpse) {
    _absorbCorpseIntoGargantuan(ctx, garg, tile)
    syncMinionVisual(garg)
    const gTile = TileEngine.getTile(garg.row, garg.col)
    if (gTile?.element) UI.spawnFloat(gTile.element, '👹 Absorbed!', 'xp')
    UI.setMessage(`Gargantuan absorbs the ashes! → ❤️ ${garg.hp}/${garg.maxHp}, ⚔️ ${garg.dmg}`)
    ctx.saveActiveRun()
    return true
  }

  return false
}

export function tryGargantuanMergeTap(ctx, tile) {
  if (charKey() !== 'necromancer') return false
  if ((session.run?.player?.minionGargantuanTier ?? 0) < 3) return false
  if (session.tap.combatBusy || session.tap.strengthenMinionSelecting || session.tap.corpseExplosionSelecting || session.tap.boneArmorSelecting) return false

  const minionOnTile = (session.run.minions ?? []).find(m => m.row === tile.row && m.col === tile.col && m.hp > 0)

  if (session.tap.gargantuanMergeMinionId != null) {
    const source = session.run.minions.find(m => m.id === session.tap.gargantuanMergeMinionId)
    if (!minionOnTile?.isGargantuan) {
      UI.setMessage('Tap your Gargantuan to absorb the selected minion.', true)
      return true
    }
    if (!source || source.hp <= 0 || source.isGargantuan) {
      cancelGargantuanMergeMode()
      UI.setMessage('Mass Ascension cancelled.', true)
      return true
    }
    necroMassAscensionMerge(ctx, source, minionOnTile)
    return true
  }

  if (minionOnTile && !minionOnTile.isGargantuan) {
    const hasGarg = (session.run.minions ?? []).some(m => m.hp > 0 && m.isGargantuan)
    if (!hasGarg) return false
    session.tap.gargantuanMergeMinionId = minionOnTile.id
    UI.setMessage(`Mass Ascension — tap your Gargantuan to absorb this minion (❤️ ${minionOnTile.hp}, ⚔️ ${minionOnTile.dmg}).`)
    return true
  }

  return false
}

function removeMinionFromTile(ctx, minion) {
  session.run.minions = (session.run.minions ?? []).filter(m => m.id !== minion.id)
  const tile = TileEngine.getTile(minion.row, minion.col)
  tile?.element?.querySelector('.minion-overlay')?.remove()
  tile?.element?.classList.remove('enemy-alive')
  necroClearAshAfterMinionDeath(ctx, minion.row, minion.col)
}

export function necroMassAscensionMerge(ctx, source, gargantuan) {
  const hpBoost  = Math.max(1, Math.ceil(gargantuan.maxHp * GARGANTUAN.massAscensionHpPct))
  const dmgBoost = Math.max(1, Math.ceil(gargantuan.dmg * GARGANTUAN.massAscensionDmgPct))
  gargantuan.maxHp += hpBoost
  gargantuan.hp    += hpBoost
  gargantuan.dmg   += dmgBoost
  removeMinionFromTile(ctx, source)
  syncMinionVisual(gargantuan)
  cancelGargantuanMergeMode()
  const gTile = TileEngine.getTile(gargantuan.row, gargantuan.col)
  if (gTile?.element) UI.spawnFloat(gTile.element, '👹 Ascended!', 'xp')
  UI.setMessage(`Mass Ascension! Gargantuan grows (+${hpBoost} HP, +${dmgBoost} dmg) → ❤️ ${gargantuan.hp}/${gargantuan.maxHp}, ⚔️ ${gargantuan.dmg}`)
  ctx.saveActiveRun()
}

export function applyMinionBonusDamage(ctx, targetTile, rawDmg) {
  if (!targetTile?.enemyData || targetTile.enemyData._slain || !targetTile.revealed) return
  const dmg = ctx.scaleOutgoingDamageToEnemy(rawDmg)
  if (dmg <= 0) return
  const ed = targetTile.enemyData
  ed.currentHP = Math.max(0, (ed.currentHP ?? ed.hp ?? 0) - dmg)
  if (targetTile.element) UI.spawnFloat(targetTile.element, `👹 ${dmg}`, 'damage')
  if (ed.currentHP <= 0) {
    ctx.gainGold(ed.goldDrop ? ctx.rand(...ed.goldDrop) : 1, targetTile.element, true)
    ctx.gainXP(ed.xpDrop ?? 0, targetTile.element)
    ctx.endCombatVictory(targetTile)
  } else if (targetTile.element) {
    UI.updateEnemyHP(targetTile.element, ed.currentHP)
  }
}

export function necroTitansReachCleave(ctx, primaryTile) {
  if ((session.run?.player?.minionGargantuanTier ?? 0) < 3) return
  const garg = (session.run?.minions ?? []).find(m => m.hp > 0 && m.isGargantuan)
  if (!garg) return
  const rawCleave = Math.ceil((garg.dmg ?? 0) * GARGANTUAN.titansReachFrac)
  if (rawCleave <= 0) return

  let best = null
  let bestDist = Infinity
  for (const t of ctx.getActiveTiles()) {
    if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
    const dist = Math.abs(t.row - garg.row) + Math.abs(t.col - garg.col)
    if (dist < bestDist) { best = t; bestDist = dist }
  }
  if (!best || bestDist <= 0) return

  applyMinionBonusDamage(ctx, best, rawCleave)
  if (best !== primaryTile && best.element) {
    UI.setMessage(`Titan's Reach — your Gargantuan cleaves ${best.enemyData?.label ?? 'a foe'} for ${rawCleave}!`)
  }
}

export function necroLegionMeleeBonus(heroMeleeDmg) {
  if ((session.run?.player?.minionLegionTier ?? 0) < 2) return 0
  const alive = (session.run?.minions ?? []).filter(m => m.hp > 0).length
  if (alive < 3) return 0
  const base = Math.max(0, Math.round(Number(heroMeleeDmg) || 0))
  return Math.round(base * LEGION_II_MELEE_BONUS_PCT)
}

/** Minion damage on hero melee: strongest minion always; Legion III adds half of supporting minions (rounded up). */
export function necroMinionMeleeBonus() {
  if (!session.run?.minions?.length) return 0
  let best = 0
  let total = 0
  for (const m of session.run.minions) {
    if (m.hp <= 0) continue
    const d = m.dmg ?? 0
    best = Math.max(best, d)
    total += d
  }
  if (best === 0) return 0
  const legionTier = session.run?.player?.minionLegionTier ?? 0
  if (legionTier >= 3) {
    const supporting = total - best
    return best + Math.ceil(supporting / 2)
  }
  return best
}

export function necroMinionAbsorbDamage(ctx, rawAmount, floatEl, enemyTile) {
  if (!session.run?.minions?.length) return false
  let closest = null
  let closestDist = Infinity
  for (const m of session.run.minions) {
    if (m.hp <= 0) continue
    const dist = enemyTile
      ? Math.abs(m.row - enemyTile.row) + Math.abs(m.col - enemyTile.col)
      : 0
    if (dist < closestDist) { closest = m; closestDist = dist }
  }
  if (!closest) return false

  const effRaw = ctx.computeEffectiveDamageTaken(rawAmount)
  const aliveCount = (session.run.minions ?? []).filter(m => m.hp > 0).length
  const monolith = gargantuanTier() >= 2 && aliveCount === 1
  const eff = monolith
    ? Math.max(1, Math.round(effRaw * (1 - GARGANTUAN.monolithReduction)))
    : effRaw
  closest.hp -= eff
  const tile = TileEngine.getTile(closest.row, closest.col)
  const refEl = tile?.element ?? floatEl ?? document.getElementById('hud-portrait')
  UI.spawnFloat(refEl, `🧟 −${eff}`, 'damage')
  if (closest.hp <= 0) {
    closest.hp = 0
    session.run.minions = session.run.minions.filter(m => m.id !== closest.id)
    if (tile?.element) tile.element.querySelector('.minion-overlay')?.remove()
    necroClearAshAfterMinionDeath(ctx, closest.row, closest.col)
    UI.setMessage('Your minion falls protecting you! The ashes scatter — only one minion may rise from each corpse.')
  } else {
    syncMinionVisual(closest)
    UI.setMessage(`Your minion absorbs the blow! (❤️ ${closest.hp}/${closest.maxHp})`)
  }
  return true
}

export function isNecroActiveUnlocked(ctx, abilityKey) {
  return ctx.isActiveUnlocked(abilityKey, 'necromancer')
}

export function hasNecroMetaUpgrade(id) {
  return (session.save.necromancer?.upgrades ?? []).includes(id)
}

export function strengthenMinionAction(ctx) {
  if (charKey() !== 'necromancer') return
  if (!isNecroActiveUnlocked(ctx, 'strengthen-minion')) return
  if (session.tap.combatBusy) return
  if (session.tap.strengthenMinionSelecting) {
    ctx.cancelStrengthenMinionMode()
    UI.setMessage('Strengthen Minion cancelled.')
    return
  }
  const smCost = computeStrengthenManaCost()
  if (session.run.player.mana < smCost) {
    UI.setMessage('Not enough mana for Strengthen Minion!', true)
    return
  }
  const aliveMinions = (session.run.minions ?? []).filter(m => m.hp > 0)
  if (!aliveMinions.length) {
    UI.setMessage('You have no minions to strengthen.', true)
    return
  }
  ctx.cancelCorpseExplosionMode()
  ctx.cancelBoneArmorMode?.()
  cancelGargantuanMergeMode()
  session.tap.strengthenMinionSelecting = true
  UI.setStrengthenMinionActive?.(true)
  const stacks = strengthenMinionStacks()
  const hpHint = stacks >= 3
    ? `+${computeStrengthenHpGain()} HP (40% + horde)`
    : stacks >= 1
      ? `+${computeStrengthenHpGain()} max HP (40%)`
      : `+${computeStrengthenHpGain()} max HP (20%)`
  UI.setMessage(`💪 Strengthen Minion — tap a minion to reinforce it (${hpHint}, ${smCost} mana)`)
}

export function corpseExplosionAction(ctx) {
  if (ctx.isSilenced()) return
  if (charKey() !== 'necromancer') return
  if (!isNecroActiveUnlocked(ctx, 'corpse-explosion')) return
  if (session.tap.combatBusy) return
  if (session.tap.corpseExplosionSelecting) {
    ctx.cancelCorpseExplosionMode()
    UI.setMessage('Corpse Explosion cancelled.')
    return
  }
  if (session.run.player.mana < CORPSE_EXPLOSION_COST) {
    UI.setMessage('Not enough mana for Corpse Explosion!', true)
    return
  }
  ctx.cancelStrengthenMinionMode()
  ctx.cancelBoneArmorMode?.()
  cancelGargantuanMergeMode()
  session.tap.corpseExplosionSelecting = true
  UI.setCorpseExplosionActive?.(true)
  UI.setGridCorpseExplosionMode?.(true)
  UI.setMessage(`💥 Corpse Explosion — tap a corpse or minion to detonate. (${CORPSE_EXPLOSION_COST} mana)`)
}

export function boneArmorAction(ctx) {
  if (ctx.isSilenced()) return
  if (charKey() !== 'necromancer') return
  if (!isNecroActiveUnlocked(ctx, 'bone-armor')) return
  if (session.tap.combatBusy) return
  if (session.tap.boneArmorSelecting) {
    ctx.cancelBoneArmorMode()
    UI.setMessage('Bone Armor cancelled.')
    return
  }
  const cost = computeBoneArmorManaCost()
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Bone Armor!', true)
    return
  }
  ctx.cancelStrengthenMinionMode()
  ctx.cancelCorpseExplosionMode()
  cancelGargantuanMergeMode()
  session.tap.boneArmorSelecting = true
  UI.setBoneArmorActive?.(true)
  const tier = boneArmorTier()
  const hints = [`+${Math.max(1, Math.ceil((session.run.player.maxHp ?? 35) * BONE_ARMOR.armorPct))} armor`]
  if (tier >= 2) hints.push(`heal ${Math.round(BONE_ARMOR.healPct * 100)}% HP`)
  if (tier >= 3) hints.push(`recover ${Math.round(BONE_ARMOR.manaRecoverPct * 100)}% mana`)
  UI.setMessage(`🦴 Bone Armor — tap an enemy corpse pile (${hints.join(', ')}, ${cost} mana)`)
}

export function executeBoneArmor(ctx, tile) {
  const cost = computeBoneArmorManaCost()
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Bone Armor!', true)
    ctx.cancelBoneArmorMode()
    return
  }
  const p = session.run.player
  const tier = boneArmorTier()
  const armorGain = Math.max(1, Math.ceil(p.maxHp * BONE_ARMOR.armorPct))

  p.mana -= cost
  p.armor = (p.armor ?? 0) + armorGain
  UI.updateMana(p.mana, p.maxMana)
  UI.updateArmor(p.armor)
  if (tile.element) UI.spawnFloat(tile.element, `🛡️ +${armorGain}`, 'xp')

  const parts = [`Bone Armor +${armorGain} armor`]

  if (tier >= 2) {
    const healAmt = Math.max(1, Math.ceil(p.maxHp * BONE_ARMOR.healPct))
    p.hp = Math.min(p.maxHp, p.hp + healAmt)
    UI.updateHP(p.hp, p.maxHp)
    if (tile.element) UI.spawnFloat(tile.element, `❤️ +${healAmt}`, 'xp')
    parts.push(`+${healAmt} HP`)
  }

  if (tier >= 3) {
    const manaRecover = Math.max(1, Math.ceil(p.maxMana * BONE_ARMOR.manaRecoverPct))
    p.mana = Math.min(p.maxMana, p.mana + manaRecover)
    UI.updateMana(p.mana, p.maxMana)
    parts.push(`+${manaRecover} mana`)
  }

  necroClearAshAfterMinionDeath(ctx, tile.row, tile.col)
  EventBus.emit('audio:play', { sfx: 'heal' })
  ctx.cancelBoneArmorMode()
  UI.setMessage(`${parts.join(', ')}. Mana: ${p.mana}/${p.maxMana}`)
  ctx.saveActiveRun()
}

export function corpseExplosionRingTiles(row, col, dist) {
  const grid = TileEngine.getGrid()
  if (!grid || dist < 1) return []
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const out = []
  for (let dr = -dist; dr <= dist; dr++) {
    for (let dc = -dist; dc <= dist; dc++) {
      if (Math.max(Math.abs(dr), Math.abs(dc)) !== dist) continue
      const r = row + dr
      const c = col + dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      out.push(grid[r][c])
    }
  }
  return out
}

/** @deprecated use corpseExplosionRingTiles(row, col, 2) */
export function corpseExplosionOuterRingTiles(row, col) {
  return corpseExplosionRingTiles(row, col, 2)
}

function buildCorpseExplosionTargets(center, isRootBlast) {
  const inner = corpseExplosionRingTiles(center.row, center.col, 1)
  const targets = inner.map(t => ({ tile: t, falloff: CORPSE_EXPLOSION.ringFalloff[0] }))

  if (!isRootBlast) return targets

  const abyssal = corpseExplosionAbyssalTier()
  if (abyssal <= 0) return targets

  const roll = Math.random()
  const includeRing2 = abyssal >= 2 || roll < CORPSE_EXPLOSION.abyssalOuterChance[0]
  if (includeRing2) {
    for (const t of corpseExplosionRingTiles(center.row, center.col, 2)) {
      targets.push({ tile: t, falloff: CORPSE_EXPLOSION.ringFalloff[1] })
    }
  }
  if (abyssal >= 3) {
    for (const t of corpseExplosionRingTiles(center.row, center.col, 3)) {
      targets.push({ tile: t, falloff: CORPSE_EXPLOSION.ringFalloff[2] })
    }
  }
  return targets
}

function findClosestLivingEnemy(fromRow, fromCol) {
  const grid = TileEngine.getGrid()
  if (!grid) return null
  let best = null
  let bestDist = Infinity
  for (const row of grid) {
    for (const t of row) {
      if (!t?.revealed || !t.enemyData || t.enemyData._slain) continue
      const dist = Math.abs(t.row - fromRow) + Math.abs(t.col - fromCol)
      if (dist < bestDist) {
        bestDist = dist
        best = t
      }
    }
  }
  return best
}

export function damageEnemyFromCorpseExplosion(ctx, targetTile, dmg, hitTracker = null) {
  if (!targetTile?.enemyData || targetTile.enemyData._slain) return null
  if (!targetTile.revealed) return null
  const ed = targetTile.enemyData
  const strikePower = enemyStrikePower(ed)
  if (hitTracker) hitTracker.add(`${targetTile.row},${targetTile.col}`)
  ed.currentHP = Math.max(0, (ed.currentHP ?? ed.hp ?? 0) - dmg)
  if (targetTile.element) UI.spawnFloat(targetTile.element, `💥 ${dmg}`, 'damage')
  if (ed.currentHP <= 0) {
    ctx.gainGold(ed.goldDrop ? ctx.rand(...ed.goldDrop) : 1, targetTile.element, true)
    ctx.gainXP(ed.xpDrop ?? 0, targetTile.element)
    ctx.endCombatVictory(targetTile)
    return { killed: true, strikePower, row: targetTile.row, col: targetTile.col }
  }
  if (targetTile.element) UI.updateEnemyHP(targetTile.element, ed.currentHP)
  return { killed: false }
}

function applyEssenceDrain(enemyHitCount) {
  const tier = corpseExplosionEssenceDrainTier()
  if (tier <= 0 || enemyHitCount <= 0) return

  const player = session.run.player
  const manaPct = CORPSE_EXPLOSION.essenceManaPct[tier - 1] ?? 0
  let manaGain = 0
  for (let i = 0; i < enemyHitCount; i++) {
    manaGain += Math.ceil(player.maxMana * manaPct)
  }
  const manaCap = Math.ceil(player.maxMana * CORPSE_EXPLOSION.essenceManaCap)
  manaGain = Math.min(manaGain, manaCap)
  if (manaGain > 0) {
    player.mana = Math.min(player.maxMana, player.mana + manaGain)
    UI.updateMana(player.mana, player.maxMana)
  }

  if (tier >= 3) {
    let hpGain = 0
    for (let i = 0; i < enemyHitCount; i++) {
      hpGain += Math.ceil(player.maxHp * CORPSE_EXPLOSION.essenceHpPct)
    }
    const hpCap = Math.ceil(player.maxHp * CORPSE_EXPLOSION.essenceHpCap)
    hpGain = Math.min(hpGain, hpCap)
    if (hpGain > 0) {
      player.hp = Math.min(player.maxHp, player.hp + hpGain)
      UI.updateHP(player.hp, player.maxHp)
    }
  }
}

function resolveOverkillRipples(ctx, initialKillOrigins, hitTracker) {
  const queue = [...initialKillOrigins]
  const rippled = new Set()

  while (queue.length) {
    const origin = queue.shift()
    const originKey = `${origin.row},${origin.col}`
    if (rippled.has(originKey)) continue
    rippled.add(originKey)

    const target = findClosestLivingEnemy(origin.row, origin.col)
    if (!target) continue

    const rippleDmg = Math.max(1, origin.strikePower)
    const result = damageEnemyFromCorpseExplosion(ctx, target, rippleDmg, hitTracker)
    if (result?.killed) {
      queue.push({ row: target.row, col: target.col, strikePower: result.strikePower })
    }
  }
}

export function executeCorpseExplosion(ctx, rootTile) {
  const cost = CORPSE_EXPLOSION_COST
  if (session.run.player.mana < cost) {
    UI.setMessage(`Not enough mana for Corpse Explosion! (needs ${cost})`, true)
    ctx.cancelCorpseExplosionMode()
    return
  }

  session.run.player.mana -= cost
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  EventBus.emit('audio:play', { sfx: 'hit' })

  const detTier   = corpseExplosionDetonationTier()
  const hasChain  = detTier >= 1
  const rootMult  = detTier >= 2 ? CORPSE_EXPLOSION.detonationInitialMult : 1
  const baseDmg   = computeCorpseExplosionDamage(ctx)
  const rootDmg   = computeCorpseExplosionDamage(ctx, rootMult)

  const visited = new Set()
  const queue = [rootTile]
  const keyOf = (t) => `${t.row},${t.col}`
  visited.add(keyOf(rootTile))

  const enemiesDamaged = new Set()
  const initialKillOrigins = []

  while (queue.length) {
    const center = queue.shift()
    const isRoot = center === rootTile
    if (center.element) UI.spawnFloat(center.element, '💥 BOOM', 'damage')

    const dmgForCenter = isRoot ? rootDmg : baseDmg
    for (const { tile: t, falloff } of buildCorpseExplosionTargets(center, isRoot)) {
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        const dmg = Math.max(1, Math.round(dmgForCenter * falloff))
        const result = damageEnemyFromCorpseExplosion(ctx, t, dmg, enemiesDamaged)
        if (result?.killed && isRoot) {
          initialKillOrigins.push({
            row: t.row,
            col: t.col,
            strikePower: result.strikePower,
          })
        }
      }
      if (hasChain && t.revealed && t.enemyData?._slain && !t.corpseExploded) {
        const k = keyOf(t)
        if (!visited.has(k)) {
          visited.add(k)
          queue.push(t)
        }
      }
    }

    consumeCorpseExplosionSource(ctx, center)
  }

  if (detTier >= 3 && initialKillOrigins.length) {
    resolveOverkillRipples(ctx, initialKillOrigins, enemiesDamaged)
  }

  applyEssenceDrain(enemiesDamaged.size)

  ctx.cancelCorpseExplosionMode()

  const branchTag = corpseExplosionAbyssalTier() ? ' Abyssal Reach'
    : detTier ? ' Detonation Chain'
      : corpseExplosionEssenceDrainTier() ? ' Essence Drain' : ''
  UI.setMessage(`💥 Corpse Explosion${branchTag}! (${cost} mana)`)

  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  ctx.saveActiveRun()
}

export function consumeCorpseExplosionSource(ctx, tile) {
  tile.corpseExploded = true
  // If a minion sat on this tile, destroy it.
  const minionIdx = (session.run.minions ?? []).findIndex(m => m.row === tile.row && m.col === tile.col)
  if (minionIdx >= 0) {
    const minion = session.run.minions[minionIdx]
    session.run.minions.splice(minionIdx, 1)
    if (tile.element) tile.element.querySelector('.minion-overlay')?.remove()
    if (minion) necroClearAshAfterMinionDeath(ctx, minion.row, minion.col)
  } else {
    necroClearAshAfterMinionDeath(ctx, tile.row, tile.col)
  }
}

export function refreshNecroActiveHud(ctx) {
  if (charKey() !== 'necromancer') return
  // Clear other-hero slot bindings so they don't leak from a prior session.run
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setDivineLightBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setRicochetBtn(false, 0)
  UI.setSlamBtn(false)
  UI.setChainLightningBtn?.(false)
  UI.setLifeTapBtn(false)
  UI.setBloodPactBtn(false)
  UI.setStrengthenMinionBtn(
    isNecroActiveUnlocked(ctx, 'strengthen-minion'),
    computeStrengthenManaCost(),
  )
  UI.setCorpseExplosionBtn(
    isNecroActiveUnlocked(ctx, 'corpse-explosion'),
    NECROMANCER_UPGRADES['corpse-explosion']?.manaCost ?? CORPSE_EXPLOSION_COST,
  )
  UI.setBoneArmorBtn(
    isNecroActiveUnlocked(ctx, 'bone-armor'),
    computeBoneArmorManaCost(),
  )
}
