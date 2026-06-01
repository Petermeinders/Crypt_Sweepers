import { CONFIG } from '../config.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import UI from '../ui/UI.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { session, charKey } from '../core/RunContext.js'

export function isKillEchoHiddenEnemyTile(t) {
  return !!(
    t &&
    !t.revealed &&
    t.enemyData &&
    !t.enemyData._slain &&
    (t.type === 'enemy' || t.type === 'enemy_fast' || t.type === 'boss')
  )
}

export function paladinKillEchoClearMarks() {
  const grid = TileEngine.getGrid?.()
  if (!grid) return
  for (const row of grid) {
    for (const t of row) {
      if (!t.killEchoMarked && !t.senseEvilMarked) continue
      t.killEchoMarked = false
      t.senseEvilMarked = false
      t.echoHintCategory = null
      if (t.element) {
        t.element.classList.remove('echo-hint')
        delete t.element.dataset.echoHint
      }
    }
  }
}

export function paladinKillEchoStripMarkFromTile(t) {
  if (!t || (!t.killEchoMarked && !t.senseEvilMarked)) return
  t.killEchoMarked = false
  t.senseEvilMarked = false
  t.echoHintCategory = null
  if (t.element) {
    t.element.classList.remove('echo-hint')
    delete t.element.dataset.echoHint
  }
}

export function paladinKillEchoMarkedHiddenCount() {
  const grid = TileEngine.getGrid?.()
  if (!grid) return 0
  let n = 0
  for (const row of grid) {
    for (const t of row) {
      if (!isKillEchoHiddenEnemyTile(t)) continue
      if (t.killEchoMarked || t.senseEvilMarked) n++
    }
  }
  return n
}

export function paladinKillEchoMarkNewClosest(anchorRow, anchorCol, pickCount) {
  if (charKey() !== 'warrior') return
  const grid = TileEngine.getGrid?.()
  if (!grid || anchorRow == null || anchorCol == null || pickCount <= 0) return
  const scored = []
  for (const row of grid) {
    for (const t of row) {
      if (!isKillEchoHiddenEnemyTile(t)) continue
      if (t.killEchoMarked || t.senseEvilMarked) continue
      const d = Math.abs(t.row - anchorRow) + Math.abs(t.col - anchorCol)
      scored.push({ t, d })
    }
  }
  scored.sort((a, b) => a.d - b.d || a.t.row - b.t.row || a.t.col - b.t.col)
  const n = Math.min(pickCount, scored.length)
  for (let i = 0; i < n; i++) {
    const t = scored[i].t
    t.killEchoMarked = true
    t.echoHintCategory = '⚔️'
    if (t.element) {
      t.element.classList.add('echo-hint')
      t.element.dataset.echoHint = '⚔️'
    }
  }
}

export function paladinKillEchoApplyMarks(anchorRow, anchorCol, count) {
  if (charKey() !== 'warrior') return
  if (count <= 0) return
  paladinKillEchoClearMarks()
  paladinKillEchoMarkNewClosest(anchorRow, anchorCol, count)
}

export function paladinKillEchoAddMarksAfterKill(tile) {
  if (charKey() !== 'warrior' || !tile) return
  paladinKillEchoStripMarkFromTile(tile)
  const q = session.run.killEchoQuota ?? 1
  const need = Math.max(0, q - paladinKillEchoMarkedHiddenCount())
  paladinKillEchoMarkNewClosest(tile.row, tile.col, need)
}

export function slamAction(ctx) {
  if (ctx.isSilenced()) return
  if (!(session.save.warrior?.upgrades ?? []).includes('slam')) return
  if (session.tap.combatBusy) return

  // Reverberation III: consume free-cast flag before mana check
  const isFree = session.run.player.slamFreeNextCast === true
  if (isFree) session.run.player.slamFreeNextCast = false
  const cost = isFree ? 0 : ctx.stillWaterManaCost(WARRIOR_UPGRADES.slam.manaCost)
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Slam!', true)
    return
  }

  UI.playSlam()
  EventBus.emit('audio:play', { sfx: 'slam' })

  // Collect all revealed living enemies on the ACTIVE grid (main or sub-floor)
  const targets = []
  let immuneSkipped = 0
  for (const tile of ctx.getActiveTiles()) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) { immuneSkipped++; continue }
      targets.push(tile)
    }
  }

  if (targets.length === 0) {
    UI.setMessage(immuneSkipped ? 'No valid targets — Gnomes are immune to abilities!' : 'No enemies to Slam!', true)
    return
  }

  const savedEngagement = ctx.suspendCombatEngagementForMultiTargetAbility()

  // Spend mana
  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  const slamDmg = ctx.scaleOutgoingDamageToEnemy(slamDamagePerTarget(ctx))
  const immuneNote = immuneSkipped ? ` (${immuneSkipped} immune)` : ''
  const freeNote   = isFree ? ' (free!)' : ''
  UI.setMessage(`💥 Slam! ${targets.length} enem${targets.length > 1 ? 'ies' : 'y'} struck for ${slamDmg} each!${immuneNote}${freeNote}`)

  // Stagger slash effects across targets
  let slamKillCount = 0
  targets.forEach((target, i) => {
    setTimeout(() => {
      UI.spawnSlash(target.element)
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - slamDmg)
      UI.spawnFloat(target.element, `💥 ${slamDmg}`, 'xp')
      if (target.enemyData.currentHP <= 0) {
        slamKillCount++
        ctx.gainGold(target.enemyData.goldDrop ? ctx.rand(...target.enemyData.goldDrop) : 1, target.element, true)
        ctx.gainXP(target.enemyData.xpDrop ?? 0, target.element)
        ctx.endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 120)
  })

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
    ctx.restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
    slamBranchAftereffect(ctx, targets, slamDmg, slamKillCount)
  }, targets.length * 120 + 400)
}

export function slamBranchAftereffect(ctx, targets, slamDmg, killCount) {
  if (!session.run?.player?.slamBranch) return
  const { name, tier } = session.run.player.slamBranch

  if (name === 'hemorrhage') {
    const [bleedTurns, bleedDmg] = tier >= 2 ? [3, 3] : [2, 2]
    const burstOnDeath = tier >= 3
    const survivors = targets.filter(t => t.enemyData && !t.enemyData._slain && t.enemyData.currentHP > 0)
    for (const t of survivors) {
      t.enemyData.bleedTurns = (t.enemyData.bleedTurns ?? 0) + bleedTurns
      t.enemyData.bleedDmg   = bleedDmg
      t.enemyData.bleedBurst = burstOnDeath
      if (t.element) UI.spawnFloat(t.element, `🩸 ${bleedTurns}t`, 'damage')
    }
    if (survivors.length > 0) UI.setMessage(`🩸 Hemorrhage — ${survivors.length} enem${survivors.length > 1 ? 'ies' : 'y'} bleeding!`)
    refreshAllEnemyStatusDisplays(ctx)
  } else if (name === 'seismic') {
    slamSeismicReveal(ctx, targets, tier)
  } else if (name === 'reverberation') {
    const manaPerKill = tier >= 2 ? 2 : 1
    if (killCount > 0) {
      const gained = Math.min(killCount * manaPerKill, session.run.player.maxMana - session.run.player.mana)
      if (gained > 0) {
        session.run.player.mana += gained
        UI.updateMana(session.run.player.mana, session.run.player.maxMana)
        UI.spawnFloat(document.getElementById('hud-portrait'), `🔮 +${gained}`, 'mana')
      }
    }
    if (tier >= 3 && killCount >= 2) {
      session.run.player.slamFreeNextCast = true
      UI.setMessage(`⚡ Reverberation — ${killCount} kills! Next Slam costs no mana.`)
    }
  }
}

export function slamSeismicReveal(ctx, targets, tier) {
  const revealCount = tier >= 3 ? 3 : tier >= 2 ? 2 : 1
  const dealExtraDmg = tier >= 3

  // Collect unrevealed tiles adjacent (Chebyshev ≤1) to any hit target
  const seen = new Set()
  const candidates = []
  for (const t of targets) {
    for (const tile of ctx.getActiveTiles()) {
      const key = `${tile.row},${tile.col}`
      if (seen.has(key) || tile.revealed || tile.locked) continue
      if (Math.abs(tile.row - t.row) <= 1 && Math.abs(tile.col - t.col) <= 1) {
        seen.add(key)
        candidates.push(tile)
      }
    }
  }

  candidates.sort(() => Math.random() - 0.5)
  const toReveal = candidates.slice(0, revealCount)
  if (toReveal.length === 0) return

  let extraKills = 0
  for (const tile of toReveal) {
    tile.revealed = true
    session.run.tilesRevealed++
    TileEngine.markReachable(tile.row, tile.col, ctx.markReachableUi)
    if (tile.element) TileEngine.flipTile(tile)
    ctx.applyRevealOutcome(tile)

    if (dealExtraDmg && tile.enemyData && !tile.enemyData._slain && !tile.enemyData.spellImmune) {
      const dmg = ctx.scaleOutgoingDamageToEnemy(slamDamagePerTarget(ctx))
      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
      if (tile.element) {
        UI.spawnFloat(tile.element, `💥 ${dmg}`, 'xp')
        UI.shakeTile(tile.element)
      }
      if (tile.enemyData.currentHP <= 0) {
        ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
        ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        ctx.endCombatVictory(tile)
        extraKills++
      } else if (tile.element) {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
      }
    }
  }

  ctx.syncGridDomClassesFromModel()
  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
  const killNote = extraKills > 0 ? ` (${extraKills} enem${extraKills > 1 ? 'ies' : 'y'} hit!)` : ''
  UI.setMessage(`🌊 Seismic — shockwave reveals ${toReveal.length} tile${toReveal.length > 1 ? 's' : ''}!${killNote}`)
}

export function refreshAllEnemyStatusDisplays(ctx) {
  for (const tile of ctx.getActiveTiles()) {
    if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
    UI.updateEnemyStatus(tile.element, tile.enemyData)
  }
}

export function hemorrhageBurst(ctx, sourceTile) {
  const burstDmg = 2
  for (const tile of ctx.getActiveTiles()) {
    if (!tile.revealed || !tile.enemyData || tile.enemyData._slain) continue
    if (tile === sourceTile) continue
    tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - burstDmg)
    if (tile.element) {
      UI.spawnFloat(tile.element, `🩸💥 ${burstDmg}`, 'damage')
      UI.shakeTile(tile.element)
    }
    if (tile.enemyData.currentHP <= 0) {
      ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element)
      ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
      ctx.endCombatVictory(tile)
    } else if (tile.element) {
      UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
    }
  }
}

export function blindingLightAction(ctx) {
  if (ctx.isSilenced()) return
  if (!(session.save.warrior?.upgrades ?? []).includes('blinding-light')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Blinding Light!', true)
    return
  }

  session.tap.blindingLightTargeting = !session.tap.blindingLightTargeting
  UI.setBlindingLightActive(session.tap.blindingLightTargeting)
  if (session.tap.blindingLightTargeting) {
    session.tap.spyglassTargeting = false
    session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
    ctx.cancelRicochetMode()
    ctx.cancelArrowBarrageMode()
    ctx.cancelPoisonArrowShotMode()
    UI.setMessage('✨ Choose an enemy to blind.')
  } else {
    UI.setMessage('Blinding Light cancelled.')
  }
}

export function castBlindingLight(ctx, tile) {
  session.tap.blindingLightTargeting = false
  UI.setBlindingLightActive(false)

  const cost = ctx.stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  let stun = blindingLightStunTurns(ctx)
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (session.run.player.undeadBonus && isUndead) stun = Math.round(stun * 2)
  if (session.run.player.beastBonus  && isBeast)  stun = Math.round(stun * 2)
  stun = Math.max(2, stun)
  const bonusSuffix = (session.run.player.undeadBonus && isUndead) || (session.run.player.beastBonus && isBeast)
    ? ' (2× stun!)' : ''

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  UI.setPortraitAnim('attack')
  UI.spawnFloat(tile.element, `⏱️ +${stun}`, 'mana')
  UI.flashTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'spell' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)

  tile.enemyData.stunTurns = (tile.enemyData.stunTurns ?? 0) + stun
  UI.updateEnemyStatus(tile.element, tile.enemyData)

  UI.setMessage(
    `✨ Blinding Light${bonusSuffix} — +${stun} stun turn${stun === 1 ? '' : 's'}! ${tile.enemyData.label} cannot counter-attack (${tile.enemyData.currentHP} HP).`,
  )

  blindingBranchAftereffect(ctx, tile, stun, cost)
}

export function blindingBranchAftereffect(ctx, primaryTile, stun, cost) {
  if (!session.run?.player?.blindingBranch) return
  const { name, tier } = session.run.player.blindingBranch

  if (name === 'solarflare') {
    const aoeMult = tier >= 2 ? 2 / 3 : 0.5
    const aoeStun = Math.max(1, Math.round(stun * aoeMult))
    const others = ctx.getActiveTiles().filter(t =>
      t !== primaryTile &&
      t.revealed && t.enemyData && !t.enemyData._slain &&
      !t.enemyData.spellImmune,
    )
    for (const t of others) {
      t.enemyData.stunTurns = (t.enemyData.stunTurns ?? 0) + aoeStun
      if (tier >= 3) t.enemyData.solarflareVulnerable = true
      if (t.element) UI.spawnFloat(t.element, `⏱️ +${aoeStun}`, 'mana')
      UI.updateEnemyStatus(t.element, t.enemyData)
    }
    if (tier >= 3) primaryTile.enemyData.solarflareVulnerable = true
    if (others.length > 0) {
      UI.setMessage(`✨ Solarflare — ${others.length} other enem${others.length > 1 ? 'ies' : 'y'} blinded (+${aoeStun} turns)!`)
    }
  } else if (name === 'revelation') {
    blindingRevelationReveal(ctx, primaryTile, tier, cost)
  }
}

export function blindingRevelationReveal(ctx, tile, tier, cost) {
  const revealCount = tier >= 2 ? 3 : 2

  const seen = new Set()
  const candidates = []
  for (const t of ctx.getActiveTiles()) {
    const key = `${t.row},${t.col}`
    if (seen.has(key) || t.revealed) continue
    if (Math.abs(t.row - tile.row) <= 1 && Math.abs(t.col - tile.col) <= 1) {
      seen.add(key)
      candidates.push(t)
    }
  }

  candidates.sort(() => Math.random() - 0.5)
  const toReveal = candidates.slice(0, revealCount)
  if (toReveal.length === 0) return

  let enemyFound = false
  for (const t of toReveal) {
    t.revealed = true
    session.run.tilesRevealed++
    TileEngine.markReachable(t.row, t.col, ctx.markReachableUi)
    if (t.element) TileEngine.flipTile(t)
    ctx.applyRevealOutcome(t)

    if (tier >= 3 && t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune) {
      t.enemyData.stunTurns = (t.enemyData.stunTurns ?? 0) + 1
      if (t.element) UI.spawnFloat(t.element, '⏱️ +1', 'mana')
      UI.updateEnemyStatus(t.element, t.enemyData)
      enemyFound = true
    }
  }

  ctx.syncGridDomClassesFromModel()
  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)

  if (tier >= 3 && enemyFound) {
    const refund = Math.floor(cost / 2)
    session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + refund)
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    UI.spawnFloat(document.getElementById('hud-portrait'), `🔮 +${refund}`, 'mana')
    UI.setMessage(`👁️ Revelation — ${toReveal.length} tile${toReveal.length > 1 ? 's' : ''} revealed! +${refund} mana refunded.`)
  } else {
    UI.setMessage(`👁️ Revelation — ${toReveal.length} tile${toReveal.length > 1 ? 's' : ''} illuminated!`)
  }
}

export function divineLightAction(ctx) {
  if (ctx.isSilenced()) return
  if (charKey() !== 'warrior') return
  const warriorUpgrades = session.save.warrior?.upgrades ?? []
  if (!warriorUpgrades.includes('divine-light')) return
  if (session.tap.combatBusy) return

  const cost = ctx.stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + ctx.tearyExtraCost())
  if (!session.tap.divineLightSelecting) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Divine Light!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelRicochetMode()
    ctx.cancelArrowBarrageMode()
    ctx.cancelPoisonArrowShotMode()
    session.tap.spyglassTargeting = false
    session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
    session.tap.divineLightSelecting = true
    UI.setDivineLightActive(true)
    UI.setMessage('🌟 Divine Light — tap an enemy to smite it, or tap your portrait to heal HP.')
  } else {
    session.tap.divineLightSelecting = false
    UI.setDivineLightActive(false)
    UI.setMessage('Divine Light cancelled.')
  }
}

export function divineLightHealAction(ctx) {
  if (!session.tap.divineLightSelecting) return
  const cost = ctx.stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }
  session.tap.divineLightSelecting = false
  UI.setDivineLightActive(false)
  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  const dlStacks = session.run.player.warriorActiveStacks?.['divine-light'] ?? 0
  const dlRate   = dlStacks >= 3 ? 0.15 : dlStacks >= 2 ? 0.10 : dlStacks >= 1 ? 0.05 : 0.03
  const heal = Math.max(1, Math.floor(session.run.player.maxHp * dlRate))
  session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + heal)
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.setPortraitAnim('attack')
  EventBus.emit('audio:play', { sfx: 'divineLight' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)
  UI.setMessage(`🌟 Divine Light — restored ${heal} HP! (${session.run.player.hp}/${session.run.player.maxHp})`)
}

export function castDivineLightSmite(ctx, tile) {
  session.tap.divineLightSelecting = false
  UI.setDivineLightActive(false)

  const cost = ctx.stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  const dmg = ctx.scaleOutgoingDamageToEnemy(Math.max(1, Math.round(avgMeleeDamage(ctx))))
  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
  UI.setPortraitAnim('attack')
  UI.spawnFloat(tile.element, `🌟 ${dmg}`, 'mana')
  UI.flashTile(tile.element)
  EventBus.emit('audio:play', { sfx: 'divineLight' })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)

  if (tile.enemyData.currentHP <= 0) {
    UI.setMessage(`🌟 Divine Light smites for ${dmg}! The enemy is destroyed. +${tile.enemyData.goldDrop ? 1 : 0} gold.`)
    ctx.gainGold(1, tile.element)
    ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
    ctx.endCombatVictory(tile)
  } else {
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
    UI.setMessage(`🌟 Divine Light smites for ${dmg}! ${tile.enemyData.label} has ${tile.enemyData.currentHP} HP left.`)
  }
}

export function getSlamDamageBreakdown(ctx) {
  if (!session.run || session.run.player?.isRanger) return null
  const avg = avgMeleeDamage(ctx)
  const baseTenths = Math.round(CONFIG.ability.slamPerTargetMult * 10)
  const stacks = session.run.player.slamMasteryStacks ?? 0
  const m = slamMultFromStacks(stacks)
  const final = Math.max(1, Math.round(avg * m))
  return { avgMelee: avg, baseTenths, stacks, mult: m, final }
}

export function getDivineLightBreakdown(ctx) {
  if (!session.run || session.run.player?.isRanger) return null
  const avg  = avgMeleeDamage(ctx)
  const smite = Math.max(1, Math.round(avg))
  const heal  = Math.max(1, Math.floor(session.run.player.maxHp * 0.10))
  return { avgMelee: avg, smite, heal, maxHp: session.run.player.maxHp }
}

export function getBlindingLightBreakdown(ctx) {
  if (!session.run || session.run.player?.isRanger) return null
  const avg = avgMeleeDamage(ctx)
  const baseTenths = Math.round(CONFIG.ability.blindingLightStunMult * 10)
  const stacks = session.run.player.blindingLightMasteryStacks ?? 0
  const m = blindingLightMultFromStacks(stacks)
  const stunTurns = Math.max(2, Math.round(avg * m))
  return { avgMelee: avg, baseTenths, stacks, mult: m, stunTurns, final: stunTurns }
}

export function avgMeleeDamage(ctx) {
  const [lo, hi] = ctx.playerDamageRange(session.run.player)
  return (lo + hi) / 2
}

export function slamMultFromStacks(stacks) {
  const baseTenths = Math.round(CONFIG.ability.slamPerTargetMult * 10)
  return (baseTenths + stacks) / 10
}

export function blindingLightMultFromStacks(stacks) {
  const baseTenths = Math.round(CONFIG.ability.blindingLightStunMult * 10)
  return (baseTenths + stacks) / 10
}

export function blindingLightStunTurns(ctx) {
  const avg = avgMeleeDamage(ctx)
  const m = blindingLightMultFromStacks(session.run.player.blindingLightMasteryStacks ?? 0)
  return Math.max(2, Math.round(avg * m))
}

export function slamDamagePerTarget(ctx) {
  const avg    = avgMeleeDamage(ctx)
  const stacks = session.run.player.slamMasteryStacks ?? 0
  const m      = slamMultFromStacks(stacks)
  return Math.max(CombatResolver.abilityDmgFloor(session.run.floor), Math.round(avg * m))
}
