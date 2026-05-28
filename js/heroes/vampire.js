import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { VAMPIRE_BASE, VAMPIRE_DARK_EYES_MAX_TILES, VAMPIRE_UPGRADES } from '../data/vampire.js'
import { session, charKey } from '../core/RunContext.js'

export function refreshVampireHud(ctx) {
  if (charKey() !== 'vampire') return
  UI.setRicochetBtn(false, 0)
  UI.setPoisonArrowShotBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setDivineLightBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setSlamBtn(false)
  UI.setChainLightningBtn?.(false)
  UI.setStrengthenMinionBtn(false)
  UI.setLifeTapBtn(false)
  // Slot A: Blood Tithe
  UI.setBloodTitheBtn(
    ctx.isActiveUnlocked('blood-tithe', 'vampire'),
    bloodTitheHpCost(),
  )
  // Slot B: Mist Form
  if (ctx.isActiveUnlocked('mist-form', 'vampire')) {
    UI.setMistFormBtn(true, VAMPIRE_UPGRADES['mist-form'].manaCost, session.tap.mistFormFlipsRemaining)
    UI.setMistFormActive(session.tap.mistFormFlipsRemaining > 0)
  } else {
    UI.setMistFormBtn(false)
  }
  // Slot C: Blood Pact
  if (ctx.isActiveUnlocked('blood-pact', 'vampire')) {
    UI.setBloodPactBtn(true, bloodPactManaCost())
  } else {
    UI.setBloodPactBtn(false)
  }
}

export function isDarkEyesEnemyTileType(type) {
  return type === 'enemy' || type === 'enemy_fast' || type === 'boss'
}

export function vampireDrainKillPresentationThenResolve(ctx, t, damageDealt, onDone) {
  const el = t.element
  if (el) {
    UI.shakeTile(el)
    if (charKey() === 'ranger') UI.spawnArrow(el)
    else if (charKey() === 'mage') UI.spawnMageAttack(el)
    else if (charKey() === 'vampire') UI.spawnVampireAttack(el)
    else if (charKey() === 'necromancer') UI.spawnNecromancerAttack(el)
    else UI.spawnSlash(el)
  }
  const attackSfx = charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })
  UI.setPortraitAnim('attack')
  setTimeout(() => {
    if (session.run && t?.enemyData && !t.enemyData._slain) {
      finalizeVampireDrainKill(ctx, t, damageDealt)
    }
    UI.setPortraitAnim('idle')
    onDone?.()
  }, 400)
}

export function vampireDrainSlimeSplitPresentation(ctx, t, hpBeforeDrain, onDone) {
  const el = t.element
  if (el) {
    UI.shakeTile(el)
    if (charKey() === 'ranger') UI.spawnArrow(el)
    else if (charKey() === 'mage') UI.spawnMageAttack(el)
    else if (charKey() === 'vampire') UI.spawnVampireAttack(el)
    else if (charKey() === 'necromancer') UI.spawnNecromancerAttack(el)
    else UI.spawnSlash(el)
  }
  const attackSfx = charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })
  UI.setPortraitAnim('attack')
  setTimeout(() => {
    if (!session.run || !t?.enemyData || t.enemyData._slain) {
      UI.setPortraitAnim('idle')
      onDone?.()
      return
    }
    const splitHP = Math.max(1, Math.floor(t.enemyData.hp / 2))
    if (session.run.telemetry) {
      const dealt = hpBeforeDrain - splitHP
      session.run.telemetry.totalDamageDealtToEnemies += dealt
      ctx.telemetryBumpDamageDealt(session.run.floor, dealt)
    }
    t.enemyData.currentHP = splitHP
    t.enemyData.hasSplit = true
    if (t.element) {
      UI.spawnFloat(t.element, '🩸 1', 'damage')
      UI.spawnFloat(t.element, '🟢 Split!', 'damage')
      UI.splitSlime(t.element)
      UI.updateEnemyHP(t.element, splitHP)
    }
    UI.setMessage(`The slime splits in two! Each half still fights. (${splitHP} HP remaining)`)
    UI.setPortraitAnim('idle')
    onDone?.()
  }, 400)
}

export function runVampireDrainPresentationChain(ctx, entries, idx, hintTile) {
  if (idx >= entries.length) {
    vampireDarkEyesRoll(ctx, hintTile)
    return
  }
  const e = entries[idx]
  if (e.type === 'split') {
    vampireDrainSlimeSplitPresentation(ctx, e.tile, e.hpBeforeDrain, () => {
      runVampireDrainPresentationChain(ctx, entries, idx + 1, hintTile)
    })
  } else {
    vampireDrainKillPresentationThenResolve(ctx, e.tile, e.damageDealt, () => {
      runVampireDrainPresentationChain(ctx, entries, idx + 1, hintTile)
    })
  }
}

export function vampireDarkEyesRoll(ctx, tile) {
  if (!session.run || GameState.is(States.DEATH) || charKey() !== 'vampire') return
  if (Math.random() >= 0.5) return
  const grid = TileEngine.getGrid()
  const candidates = []
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed || t.reachable || t.locked || t.echoHintCategory) continue
      if (!isDarkEyesEnemyTileType(t.type)) continue
      candidates.push(t)
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const n = Math.min(VAMPIRE_DARK_EYES_MAX_TILES, candidates.length)
  for (let i = 0; i < n; i++) {
    const t = candidates[i]
    if (!t.element) continue
    const cat = ctx.echoCharmCategoryForTileType(t.type)
    t.echoHintCategory = cat
    t.darkEyesHint = true
    t.element.classList.add('echo-hint')
    t.element.dataset.echoHint = cat
  }
}

export function vampireCorruptedBloodAndDarkEyes(ctx, tile) {
  if (!session.run || GameState.is(States.DEATH) || charKey() !== 'vampire') return

  // Mist Form: skip HP drain/gain, decrement counter, still allow Dark Eyes roll
  if (session.tap.mistFormFlipsRemaining > 0) {
    session.tap.mistFormFlipsRemaining--
    const floatEl = tile.element ?? document.getElementById('hud-portrait')
    // M3: heal 3% max HP (min 1) per flip while active
    const mfStacks = session.run.player.vampireActiveStacks?.['mist-form'] ?? 0
    if (mfStacks >= 3) {
      const mfHeal = Math.max(1, Math.floor(session.run.player.maxHp * 0.03))
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + mfHeal)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(floatEl, `💚 +${mfHeal}`, 'xp')
    }
    if (session.tap.mistFormFlipsRemaining > 0) {
      UI.spawnFloat(floatEl, `🌫️ ${session.tap.mistFormFlipsRemaining} left`, 'xp')
      UI.setMistFormBtn(true, VAMPIRE_UPGRADES['mist-form'].manaCost, session.tap.mistFormFlipsRemaining)
    } else {
      UI.spawnFloat(floatEl, '🌫️ Mist faded', 'xp')
      UI.setMistFormActive(false)
      UI.setMistFormBtn(true, VAMPIRE_UPGRADES['mist-form'].manaCost, 0)
    }
    vampireDarkEyesRoll(ctx, tile)
    return
  }

  const p = session.run.player
  const grid = TileEngine.getGrid()
  const drainTargets = []
  let monsterCount = 0
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
      monsterCount++
      drainTargets.push(t)
    }
  }
  // −1 HP per flip always; +1 per revealed monster beyond the first (need 2 monsters to break even).
  const netHp = -1 + Math.max(0, monsterCount - 1)
  const floatEl = tile.element ?? document.getElementById('hud-portrait')
  if (netHp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + netHp)
    UI.spawnFloat(floatEl, `🩸 +${netHp} HP`, 'heal')
  } else if (netHp < 0) {
    p.hp = Math.max(0, p.hp + netHp)
    const dmgTaken = -netHp
    if (session.run.telemetry) {
      session.run.telemetry.totalDamageTaken += dmgTaken
      ctx.telemetryBumpDamageTaken(session.run.floor, dmgTaken)
      ctx.telemetryBumpDamageSource('corrupted_blood', dmgTaken)
    }
    UI.spawnFloat(floatEl, `🩸 ${netHp} HP`, 'damage')
  } else {
    UI.spawnFloat(floatEl, '🩸 0', 'xp')
  }
  UI.updateHP(p.hp, p.maxHp)
  if (p.hp <= 0) {
    ctx.die(null, { deathCause: 'corrupted_blood' })
    return
  }
  const pendingPresentations = []
  for (const t of drainTargets) {
    if (!t.enemyData || t.enemyData._slain) continue
    const e = t.enemyData
    const baseHp = Number(e.hp)
    const cur0 = Number(e.currentHP)
    const cur = Number.isFinite(cur0) ? cur0 : (Number.isFinite(baseHp) ? baseHp : 1)
    if (!Number.isFinite(e.currentHP)) e.currentHP = cur
    const hpBeforeDrain = e.currentHP
    const nextHp = hpBeforeDrain - 1
    const canSplit = nextHp <= 0
      && e.attributes?.includes('splits')
      && !e.hasSplit
    if (nextHp > 0) {
      e.currentHP = nextHp
      if (t.element) UI.updateEnemyHP(t.element, nextHp)
    } else if (canSplit) {
      pendingPresentations.push({ type: 'split', tile: t, hpBeforeDrain })
    } else {
      pendingPresentations.push({ type: 'kill', tile: t, damageDealt: hpBeforeDrain })
    }
  }
  if (pendingPresentations.length) {
    runVampireDrainPresentationChain(ctx, pendingPresentations, 0, tile)
  } else {
    vampireDarkEyesRoll(ctx, tile)
  }
}

export function finalizeVampireDrainKill(ctx, t, damageDealt) {
  if (!session.run || !t?.enemyData || t.enemyData._slain) return
  const e = t.enemyData
  e.currentHP = 0
  if (e.enemyId === 'onion') ctx.applyTearyEyes()
  const goldDrop = e.goldDrop ? ctx.rand(...e.goldDrop) : 1
  const xpDrop = e.xpDrop ?? 0
  if (session.run.telemetry && damageDealt > 0) {
    session.run.telemetry.totalDamageDealtToEnemies += damageDealt
    ctx.telemetryBumpDamageDealt(session.run.floor, damageDealt)
  }
  if (t.element) UI.spawnFloat(t.element, '🩸 Drained!', 'xp')
  ctx.gainGold(goldDrop, t.element, true)
  ctx.gainXP(xpDrop, t.element)
  ctx.endCombatVictory(t)
}

export function bloodTitheHpCost() {
  const tier = session.run?.player?.bloodTitheMasteryTier ?? 1
  if (tier >= 4) return 7
  if (tier >= 3) return 8
  if (tier >= 2) return 9
  return 10
}

export function bloodTitheManaGain() {
  const tier = session.run?.player?.bloodTitheMasteryTier ?? 1
  if (tier >= 4) return 13
  if (tier >= 3) return 12
  if (tier >= 2) return 11
  return 10
}

export function bloodTitheAction(ctx) {
  if (ctx.isSilenced()) return
  if (!ctx.isActiveUnlocked('blood-tithe', 'vampire')) return
  if (session.tap.combatBusy) return
  const hpCost  = bloodTitheHpCost()
  const manaGain = bloodTitheManaGain()
  const btTier   = session.run?.player?.bloodTitheMasteryTier ?? 1
  const btSafety = btTier >= 4
  if (!btSafety && session.run.player.hp <= hpCost) {
    UI.setMessage('Not enough HP — Blood Tithe would be lethal!', true)
    return
  }
  if (btSafety && session.run.player.hp <= 1) {
    UI.setMessage('Cannot Blood Tithe at 1 HP!', true)
    return
  }
  if (session.run.player.mana >= session.run.player.maxMana) {
    UI.setMessage('Mana is already full!', true)
    return
  }
  session.run.player.hp = btSafety ? Math.max(1, session.run.player.hp - hpCost) : session.run.player.hp - hpCost
  UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🩸 −${hpCost} HP`, 'damage')
  const gained = Math.min(manaGain, session.run.player.maxMana - session.run.player.mana)
  session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + manaGain)
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.spawnFloat(document.getElementById('hud-portrait'), `🔵 +${gained}`, 'xp')
  UI.setMessage(`🩸 Blood Tithe — spent ${hpCost} HP, gained ${gained} mana.`)
  EventBus.emit('audio:play', { sfx: 'spell' })
}

export function mistFormAction(ctx) {
  if (!ctx.isActiveUnlocked('mist-form', 'vampire')) return
  if (session.tap.combatBusy) return
  if (session.tap.mistFormFlipsRemaining > 0) {
    UI.setMessage('Mist Form is already active!', true)
    return
  }
  const cost = ctx.stillWaterManaCost(VAMPIRE_UPGRADES['mist-form'].manaCost)
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Mist Form!', true)
    return
  }
  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  const mfStacks = session.run.player.vampireActiveStacks?.['mist-form'] ?? 0
  session.tap.mistFormFlipsRemaining = mfStacks >= 2 ? 8 : mfStacks >= 1 ? 5 : 3
  UI.setMistFormBtn(true, VAMPIRE_UPGRADES['mist-form'].manaCost, session.tap.mistFormFlipsRemaining)
  UI.setMistFormActive(true)
  UI.setMessage(`🌫️ Mist Form — next ${session.tap.mistFormFlipsRemaining} flips protected from blood drain.`)
  EventBus.emit('audio:play', { sfx: 'spell' })
}

export function bloodPactManaCost() {
  const stacks = session.run?.player?.vampireActiveStacks?.['blood-pact'] ?? 0
  if (stacks >= 2) return 10
  if (stacks >= 1) return 13
  return 15
}

export function bloodPactAction(ctx) {
  if (!ctx.isActiveUnlocked('blood-pact', 'vampire')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(bloodPactManaCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Blood Pact!', true)
    return
  }

  const targets = []
  for (const tile of ctx.getActiveTiles()) {
    if (
      tile.revealed && tile.enemyData && !tile.enemyData._slain &&
      tile.enemyData.behaviour !== 'boss' && tile.type !== 'boss'
    ) {
      targets.push(tile)
    }
  }

  if (targets.length === 0) {
    UI.setMessage('No eligible enemies — bosses are immune to Blood Pact!', true)
    return
  }

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  // Ensure currentHP is initialized, add 1 to each, then equalize at rounded average
  for (const tile of targets) {
    const e = tile.enemyData
    if (!Number.isFinite(e.currentHP)) e.currentHP = Number(e.hp) || 1
    e.currentHP = Math.max(1, e.currentHP + 1)
  }
  const total = targets.reduce((sum, tile) => sum + tile.enemyData.currentHP, 0)
  const avgHp = Math.max(1, Math.round(total / targets.length))

  for (const tile of targets) {
    tile.enemyData.currentHP = avgHp
    if (tile.element) UI.updateEnemyHP(tile.element, avgHp)
    UI.spawnFloat(tile.element, `⚖️ ${avgHp}`, 'xp')
  }

  // M3: heal 1 HP per enemy affected
  const bpStacks = session.run.player.vampireActiveStacks?.['blood-pact'] ?? 0
  if (bpStacks >= 3) {
    const healAmt = targets.length
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + healAmt)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), `💚 +${healAmt}`, 'xp')
  }

  UI.setMessage(`⚖️ Blood Pact — ${targets.length} enem${targets.length !== 1 ? 'ies' : 'y'} equalized to ${avgHp} HP.`)
  EventBus.emit('audio:play', { sfx: 'spell' })
}

export function getBloodPactBreakdown(ctx) {
  if (!session.run || charKey() !== 'vampire') return null
  const targets = []
  for (const tile of ctx.getActiveTiles()) {
    if (
      tile.revealed && tile.enemyData && !tile.enemyData._slain &&
      tile.enemyData.behaviour !== 'boss' && tile.type !== 'boss'
    ) {
      const cur = Number.isFinite(tile.enemyData.currentHP)
        ? tile.enemyData.currentHP
        : (Number(tile.enemyData.hp) || 1)
      targets.push(cur)
    }
  }
  if (targets.length === 0) return { count: 0, avgHp: null }
  const total = targets.reduce((sum, hp) => sum + hp + 1, 0)
  const avgHp = Math.max(1, Math.round(total / targets.length))
  return { count: targets.length, avgHp }
}

export function getBloodTitheBreakdown() {
  if (!session.run || charKey() !== 'vampire') return null
  return {
    hpCost:   bloodTitheHpCost(),
    manaGain: bloodTitheManaGain(),
    tier:     session.run.player.bloodTitheMasteryTier ?? 1,
  }
}
