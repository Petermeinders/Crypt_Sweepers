import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import { applyShocked, tryConsumeShocked } from '../systems/Thunderstruck.js'
import UI from '../ui/UI.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { session, charKey } from '../core/RunContext.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

export function spellAction(ctx) {
  if (ctx.isSilenced()) return
  const effectiveCost = previewSpellManaCostForUi(ctx)
  if (session.run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }
  // Toggle targeting mode
  session.tap.spellTargeting = !session.tap.spellTargeting
  UI.setSpellTargeting(session.tap.spellTargeting, effectiveCost)
  if (session.tap.spellTargeting) {
    ctx.cancelRicochetMode()
    ctx.cancelArrowBarrageMode()
    ctx.cancelPoisonArrowShotMode()
    session.tap.spyglassTargeting = false
    session.tap.lanternTargeting = false
    UI.setLanternTargeting(false)
    UI.setMessage('✨ Choose an enemy to target.')
  } else {
    UI.setMessage('Spell cancelled.')
  }
}

export function castSpell(ctx, tile) {
  if (ctx.voidAbilityFizzle?.()) return
  session.tap.spellTargeting = false
  const effectiveCost = ctx.stillWaterManaCost(
    Math.max(1, CONFIG.spell.manaCost - (session.run.player.spellCostReduction ?? 0)) + ctx.tearyExtraCost(),
  )
  UI.setSpellTargeting(false, effectiveCost)

  if (session.run.player.mana < effectiveCost) {
    UI.setMessage('Not enough mana!', true)
    return
  }

  // Mushroom Harvester taunt: redirect spell to a random visible Harvester
  tile = ctx.resolveTauntTarget(tile)

  if (tile.enemyData?.spellImmune) {
    UI.setMessage(`🛡️ ${tile.enemyData.label} is immune to spells!`, true)
    return
  }

  // Ogre: 10% shield block — cancels spell entirely
  if (ctx.checkShieldBlock(tile)) return

  const result = CombatResolver.resolveSpell(session.run.player, tile.enemyData)

  let spellDmg = result.damage
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (session.run.player.undeadBonus && isUndead) spellDmg = Math.round(spellDmg * 2)
  if (session.run.player.beastBonus  && isBeast)  spellDmg = Math.round(spellDmg * 2)
  // Mirror of Vanity: +5% current HP as flat bonus
  if (session.run.player.inventory.some(e => e?.id === 'mirror-of-vanity')) {
    spellDmg += Math.max(1, Math.floor(session.run.player.hp * 0.05))
  }
  // The Traded Codex: spell scales with missing HP (1× full, ~3× near death)
  if (session.run.player.inventory.some(e => e?.id === 'traded-codex') && session.run.player.maxHp > 0) {
    const missingRatio = 1 - (session.run.player.hp / session.run.player.maxHp)
    const codexMult = 1 + 2 * missingRatio
    spellDmg = Math.round(spellDmg * codexMult)
  }
  const shock = tryConsumeShocked(ctx, tile, { source: 'ability' })
  spellDmg = ctx.scaleOutgoingDamageToEnemy(spellDmg) + shock.bonus

  UI.setPortraitAnim('attack')
  session.run.player.mana -= effectiveCost
  // Witching Stone: each spell costs 1 additional HP
  if (session.run.player.inventory.some(e => e?.id === 'witching-stone')) {
    session.run.player.hp = Math.max(0, session.run.player.hp - 1)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🔮 -1 HP', 'damage')
    if (session.run.player.hp <= 0) { ctx.die(null, { deathCause: 'witching_stone' }); return }
  }
  // Spell Siphon: each spell costs +2 HP; 40% chance to restore 3 HP
  if (session.run.player.inventory.some(e => e?.id === 'spell-siphon')) {
    session.run.player.hp = Math.max(0, session.run.player.hp - 2)
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 -2 HP', 'damage')
    if (session.run.player.hp <= 0) { ctx.die(null, { deathCause: 'spell_siphon' }); return }
    if (Math.random() < 0.40) {
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 3)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(document.getElementById('hud-portrait'), '🩸 +3 HP', 'heal')
    }
  }
  ctx.markStillWaterAbilityUsed()
  if (session.run.player.inventory.some(e => e?.id === 'surge-pearl') && Math.random() < 0.20) {
    const refund = Math.floor(effectiveCost / 2)
    if (refund > 0) {
      session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + refund)
      UI.spawnFloat(document.getElementById('hud-portrait'), `⚪ +${refund} MP`, 'mana')
    }
  }
  if (session.run.player.inventory.some(e => e?.id === 'resonance-core') && Math.random() < 0.30) {
    const refund = effectiveCost
    if (refund > 0) {
      session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + refund)
      UI.spawnFloat(document.getElementById('hud-portrait'), `🔮 +${refund} MP`, 'mana')
    }
  }
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  UI.spawnFloat(tile.element, `✨ ${spellDmg}`, 'mana')
  if (shock.consumed && tile.element) UI.spawnFloat(tile.element, `⚡ +${shock.bonus}`, 'xp')
  const bonusSuffix = (session.run.player.undeadBonus && isUndead) || (session.run.player.beastBonus && isBeast)
    ? ' (2×!)' : ''
  tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - spellDmg)
  ctx.checkOnionLayer(tile)
  EventBus.emit('audio:play', { sfx: 'spell' })
  EventBus.emit('combat:spell', { manaCost: effectiveCost })
  setTimeout(() => UI.setPortraitAnim('idle'), 600)
  if (tile.enemyData.currentHP <= 0) {
    const spellGoldDrop = tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! +${spellGoldDrop} gold.`)
    ctx.gainGold(spellGoldDrop, tile.element, true)
    ctx.gainXP(result.xpDrop ?? 0, tile.element)
    ctx.endCombatVictory(tile)
  } else {
    UI.setMessage(`Spell blasts for ${spellDmg}${bonusSuffix}! Enemy has ${tile.enemyData.currentHP} HP left.`)
    UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
  }
}

export function chainLightningAction(ctx) {
  if (!isMageActiveUnlocked(ctx, 'chain-lightning')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(MAGE_UPGRADES['chain-lightning'].manaCost + ctx.tearyExtraCost())

  if (!session.tap.chainLightningSelecting) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Chain Lightning!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelTelekineticThrowMode()
    session.tap.chainLightningSelecting = true
    UI.setChainLightningActive(true)
    UI.setGridChainLightningMode(true)
    UI.setMessage('⚡ Chain Lightning — tap a revealed enemy. The bolt arcs to 2 more at random.')
    return
  }

  ctx.cancelChainLightningMode()
  UI.setMessage('Chain Lightning cancelled.')
}

export function chainLightningDamagePerZap(ctx) {
  const avg  = ctx.avgMeleeDamage()
  const unit = Math.max(1, Math.round(avg * CONFIG.ability.ricochetUnitMult))
  const mult = mageActiveDamageMult('chain-lightning')
  return Math.max(CombatResolver.abilityDmgFloor(session.run.floor), Math.round(unit * 1.5 * mult))
}

export function getChainLightningBreakdown(ctx) {
  if (!session.run || !session.run.player?.isMage) return null
  const avg  = ctx.avgMeleeDamage()
  const unit = Math.max(1, Math.round(avg * CONFIG.ability.ricochetUnitMult))
  const mult = mageActiveDamageMult('chain-lightning')
  const perZap = Math.max(1, Math.round(unit * 1.5 * mult))
  const stacks = session.run.player.mageActiveStacks?.['chain-lightning'] ?? 0
  return { avgMelee: avg, unit, mult, stacks, perZap, maxZaps: 3 }
}

export function executeChainLightning(ctx, primary) {
  if (!primary?.enemyData || primary.enemyData._slain) {
    UI.setMessage('Chain Lightning — no valid primary target.', true)
    ctx.cancelChainLightningMode()
    return
  }
  if (primary.enemyData.spellImmune) {
    UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
    return
  }
  const cost = ctx.stillWaterManaCost(MAGE_UPGRADES['chain-lightning'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Chain Lightning!', true)
    return
  }

  // Gather random jump candidates — revealed living non-immune enemies other than the primary.
  const candidates = ctx.getActiveTiles().filter(t =>
    t.revealed &&
    t.enemyData &&
    !t.enemyData._slain &&
    !t.enemyData.spellImmune &&
    !(t.row === primary.row && t.col === primary.col),
  )
  const overloadTier = session.run.player.chainLightningOverloadTier ?? 0
  const jumpCount = overloadTier >= 2 ? 4 : overloadTier >= 1 ? 3 : 2
  const jumps = overloadTier >= 2
    ? Array.from({ length: jumpCount }, () => {
        if (!candidates.length) return null
        return candidates[Math.floor(Math.random() * candidates.length)]
      }).filter(Boolean)
    : pickRandomDistinct(candidates, jumpCount)
  let targets = [primary, ...jumps]
  if (overloadTier >= 3) {
    const unique = new Set(targets.map(t => `${t.row},${t.col}`))
    if (unique.size >= 4) targets = [...targets, primary]
  }
  const shockedTier = session.run.player.chainLightningShockedTier ?? 0

  const savedEngagement = ctx.suspendCombatEngagementForMultiTargetAbility()
  ctx.cancelChainLightningMode()

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  const perZap = chainLightningDamagePerZap(ctx)
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  UI.setMessage(`⚡ Chain Lightning — ${targets.length} zap${targets.length > 1 ? 's' : ''} for ${perZap} each.`)

  targets.forEach((target, i) => {
    const isOverloadBounce = overloadTier >= 3 && i === targets.length - 1 && target === primary && targets.length > 1
    setTimeout(() => {
      if (!target.enemyData || target.enemyData._slain) return
      let dmg = ctx.scaleOutgoingDamageToEnemy(perZap)
      if (isOverloadBounce) dmg = Math.max(1, Math.round(dmg * 1.5))
      const fromEl = i === 0
        ? document.getElementById('hud-portrait')
        : targets[i - 1]?.element
      UI.spawnZap(fromEl, target.element)
      EventBus.emit('audio:play', { sfx: 'zap' })
      UI.shakeTile(target.element)
      target.enemyData.currentHP = Math.max(0, target.enemyData.currentHP - dmg)
      ctx.checkOnionLayer(target)
      UI.spawnFloat(target.element, `⚡ ${dmg}`, 'xp')
      if (shockedTier) {
        applyShocked(target.enemyData, shockedTier)
        if (target.element) UI.updateEnemyStatus(target.element, target.enemyData)
      }
      if (target.enemyData.currentHP <= 0) {
        ctx.gainGold(target.enemyData.goldDrop ? ctx.rand(...target.enemyData.goldDrop) : 1, target.element, true)
        ctx.gainXP(target.enemyData.xpDrop ?? 0, target.element)
        ctx.endCombatVictory(target)
      } else {
        UI.updateEnemyHP(target.element, target.enemyData.currentHP)
      }
    }, i * 140)
  })

  const doneMs = targets.length * 140 + 400
  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
    ctx.restoreCombatEngagementAfterMultiTargetAbility(savedEngagement)
  }, doneMs)
}

export function pickRandomDistinct(pool, count) {
  const a = pool.slice()
  const out = []
  while (a.length > 0 && out.length < count) {
    const idx = Math.floor(Math.random() * a.length)
    out.push(a.splice(idx, 1)[0])
  }
  return out
}

export function telekineticThrowAction(ctx) {
  if (!isMageActiveUnlocked(ctx, 'telekinetic-throw')) return
  if (session.tap.combatBusy) return
  const cost = ctx.stillWaterManaCost(MAGE_UPGRADES['telekinetic-throw'].manaCost + ctx.tearyExtraCost())

  if (session.tap.telekineticThrowStep === 0) {
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Telekinetic Throw!', true)
      return
    }
    ctx.cancelSpellLanternBlindingForRicochet()
    ctx.cancelChainLightningMode()
    session.tap.telekineticThrowStep = 1
    session.tap.telekineticEnemyTile = null
    UI.setTelekineticThrowActive(true)
    UI.setGridTelekineticThrowMode('enemy')
    UI.setMessage('🌀 Telekinetic Throw — tap an enemy to grab (bosses & spell-immune excluded).')
    return
  }

  ctx.cancelTelekineticThrowMode()
  UI.setMessage('Telekinetic Throw cancelled.')
}

export function getTelekineticThrowBreakdown(ctx) {
  if (!session.run || !session.run.player?.isMage) return null
  const avg  = ctx.avgMeleeDamage()
  const mult = mageActiveDamageMult('telekinetic-throw')
  const dmg  = Math.max(1, Math.round(avg * 3 * mult))
  const stacks = session.run.player.mageActiveStacks?.['telekinetic-throw'] ?? 0
  return { avgMelee: avg, mult, stacks, damage: dmg }
}

export function telekineticThrowDamage(ctx) {
  const avg  = ctx.avgMeleeDamage()
  const mult = mageActiveDamageMult('telekinetic-throw')
  return Math.max(CombatResolver.abilityDmgFloor(session.run.floor), Math.round(avg * 3 * mult))
}

export function isTelekineticThrowDestination(ctx, tile) {
  if (!tile) return false
  if (!tile.revealed) return false
  if (tile.locked) return false
  if (tile.type !== 'empty') return false
  if (tile.enemyData) return false
  if (tile.itemData) return false
  if (tile.chestReady || tile.chestLooted) return false
  // Turret tile: guard via session.run.turret coordinates on main grid only.
  if (!ctx.isInSubFloor() && session.run?.turret && session.run.turret.hp > 0 &&
      session.run.turret.row === tile.row && session.run.turret.col === tile.col) return false
  return true
}

export function isTelekineticThrowEnemyTarget(tile) {
  if (!tile?.revealed) return false
  const e = tile.enemyData
  if (!e || e._slain) return false
  if (e.spellImmune) return false
  if (e.behaviour === 'boss' || tile.type === 'boss') return false
  return true
}

export function executeTelekineticThrow(ctx, originTile, destTile) {
  if (!isTelekineticThrowEnemyTarget(originTile)) {
    UI.setMessage('🛡️ Not a valid target anymore.', true)
    ctx.cancelTelekineticThrowMode()
    return
  }
  if (!isTelekineticThrowDestination(ctx, destTile)) {
    UI.setMessage('That tile is no longer a valid landing spot.', true)
    return
  }
  if (originTile === destTile) {
    UI.setMessage('Pick a different landing tile.', true)
    return
  }

  const cost = ctx.stillWaterManaCost(MAGE_UPGRADES['telekinetic-throw'].manaCost + ctx.tearyExtraCost())
  if (session.run.player.mana < cost) {
    UI.setMessage('Not enough mana for Telekinetic Throw!', true)
    return
  }

  ctx.cancelTelekineticThrowMode()

  session.run.player.mana = Math.max(0, session.run.player.mana - cost)
  ctx.markStillWaterAbilityUsed()
  UI.updateMana(session.run.player.mana, session.run.player.maxMana)

  // Lift animation on origin, then move + slam on destination.
  UI.spawnFloat(originTile.element, '🌀 Lifted!', 'mana')
  UI.shakeTile(originTile.element)

  const lifted = originTile.enemyData
  const liftedType = originTile.type

  // Clear origin so it renders as a plain revealed empty.
  originTile.enemyData = null
  originTile.type = 'empty'
  originTile.revealed = true
  originTile.locked = false
  originTile.chestReady = false
  originTile.chestLooted = false
  originTile.itemData = null

  // Put the enemy on the destination tile. Keep destination as revealed so
  // the next melee / spell interaction works like any revealed enemy tile.
  destTile.type = liftedType
  destTile.enemyData = lifted
  destTile.revealed = true
  destTile.locked = false

  ctx.patchActiveTileDom(originTile.row, originTile.col)
  ctx.patchActiveTileDom(destTile.row, destTile.col)

  // Recompute global locks — an adjacent tile may still be locked by another enemy,
  // so naive unlockAdjacent around the origin would be wrong (leaves stale red X's).
  if (!ctx.isInSubFloor()) {
    TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  } else {
    // Sub-floor: clear locks for revealed tiles, then re-lock around living non-archer enemies.
    ctx.recomputeSubFloorEnemyLocks()
  }

  TileEngine.recomputeReachabilityFromRevealed(ctx.markReachableUi)
  ctx.syncGridDomClassesFromModel()

  // Slam impact — shockwave + audio, then damage.
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()
  UI.setPortraitAnim('attack')
  const shock = tryConsumeShocked(ctx, destTile, { source: 'ability' })
  let dmg = ctx.scaleOutgoingDamageToEnemy(telekineticThrowDamage(ctx)) + shock.bonus
  UI.setMessage(`🌀 Telekinetic Throw — slammed for ${dmg} damage!`)
  setTimeout(() => {
    if (!destTile.enemyData || destTile.enemyData._slain) return
    EventBus.emit('audio:play', { sfx: 'telekineticSlam' })
    UI.spawnSlamRing(destTile.element)
    UI.shakeTile(destTile.element)
    destTile.enemyData.currentHP = Math.max(0, destTile.enemyData.currentHP - dmg)
    ctx.checkOnionLayer(destTile)
    UI.spawnFloat(destTile.element, `🌀 ${dmg}`, 'damage')
    if (destTile.enemyData.currentHP <= 0) {
      ctx.gainGold(destTile.enemyData.goldDrop ? ctx.rand(...destTile.enemyData.goldDrop) : 1, destTile.element, true)
      ctx.gainXP(destTile.enemyData.xpDrop ?? 0, destTile.element)
      ctx.endCombatVictory(destTile)
      if (!ctx.isInSubFloor()) {
        TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
      } else {
        ctx.recomputeSubFloorEnemyLocks()
      }
    } else {
      UI.updateEnemyHP(destTile.element, destTile.enemyData.currentHP)
    }
  }, 160)

  setTimeout(() => {
    UI.setPortraitAnim('idle')
    session.tap.combatBusy = false
  }, 600)
  ctx.saveActiveRun()
}

export function manaShieldAction(ctx) {
  if (!isMageActiveUnlocked(ctx, 'mana-shield')) return
  if (session.tap.combatBusy) return
  if (ctx.isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  const ACTIVATION_COST = MAGE_UPGRADES['mana-shield'].manaCost
  const enabling = !session.run.player.manaShieldActive
  if (enabling) {
    if (session.run.player.mana < ACTIVATION_COST) {
      UI.setMessage(`🔵 Not enough mana (need ${ACTIVATION_COST}).`, true)
      return
    }
    session.run.player.mana -= ACTIVATION_COST
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  }
  session.run.player.manaShieldActive = enabling
  refreshMageHud(ctx)
  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  UI.setMessage(enabling ? '🔵 Mana Shield active!' : '🔵 Mana Shield deactivated.')
  ctx.saveActiveRun()
}

export function lifeTapAction(ctx) {
  if (!isMageActiveUnlocked(ctx, 'life-tap')) return
  if (session.tap.combatBusy) return
  if (ctx.isCombatCommitmentLocked()) {
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  const enabling = !session.run.player.lifeTapActive
  if (enabling) {
    const hpCost = lifeTapHpCost()
    if (session.run.player.hp <= hpCost) {
      UI.setMessage('🔴 Not enough HP to activate Life Tap.', true)
      return
    }
    if (session.run.player.mana >= session.run.player.maxMana) {
      UI.setMessage('🔴 Mana already full.', true)
      return
    }
  }
  session.run.player.lifeTapActive = enabling
  refreshMageHud(ctx)
  EventBus.emit('audio:play', { sfx: 'confirmClick' })
  UI.setMessage(enabling ? '🔴 Life Tap active!' : '🔴 Life Tap deactivated.')
  ctx.saveActiveRun()
}

export function mageLifeTapOnFlip(ctx, tileEl) {
  if (!session.run || !session.run.player.lifeTapActive || charKey() !== 'mage') return
  const p = session.run.player
  const hpCost = lifeTapHpCost()
  const mpGain = lifeTapMpGain()
  // Auto-disable if mana is full — M3 keeps active and heals instead
  const ltStacks = p.mageActiveStacks?.['life-tap'] ?? 0
  if (p.mana >= p.maxMana) {
    if (ltStacks >= 3) {
      if (Math.random() < 0.5) {
        p.hp = Math.min(p.maxHp, p.hp + 1)
        UI.updateHP(p.hp, p.maxHp)
        UI.spawnFloat(tileEl, '+1 HP', 'xp')
      }
      return
    }
    p.lifeTapActive = false
    refreshMageHud(ctx)
    UI.setMessage('🔴 Life Tap: mana full — deactivated.')
    return
  }
  if (p.hp <= hpCost) {
    p.lifeTapActive = false
    refreshMageHud(ctx)
    UI.setMessage('🔴 Life Tap: not enough HP — deactivated.')
    return
  }
  p.hp   = Math.max(1, p.hp - hpCost)
  p.mana = Math.min(p.maxMana, p.mana + mpGain)
  UI.updateHP(p.hp, p.maxHp)
  UI.updateMana(p.mana, p.maxMana)
  UI.spawnFloat(tileEl, `-${hpCost} HP`, 'damage')
  UI.spawnFloat(tileEl, `+${mpGain} MP`, 'xp')
}

export function isMageActiveUnlocked(ctx, abilityKey) {
  return ctx.isActiveUnlocked(abilityKey, 'mage')
}

export function mageActiveDamageMult(abilityKey) {
  const stacks = session.run?.player?.mageActiveStacks?.[abilityKey] ?? 0
  return 1 + 0.1 * stacks
}

export function manaShieldAbsorptionRate() {
  const stacks = session.run?.player?.mageActiveStacks?.['mana-shield'] ?? 0
  return [0.30, 0.45, 0.60][Math.min(stacks, 2)]
}

export function manaShieldDrainRatio() {
  const stacks = session.run?.player?.mageActiveStacks?.['mana-shield'] ?? 0
  return [1.0, 0.85, 0.70][Math.min(stacks, 2)]
}

export function lifeTapHpCost() {
  const stacks = session.run?.player?.mageActiveStacks?.['life-tap'] ?? 0
  return stacks >= 1 ? 2 : 1
}

export function lifeTapMpGain() {
  const stacks = session.run?.player?.mageActiveStacks?.['life-tap'] ?? 0
  return [1, 3, 4][Math.min(stacks, 2)]
}

export function refreshMageHud(ctx) {
  if (charKey() !== 'mage') return
  UI.setSlamBtn(false)
  UI.setRicochetBtn(false)
  UI.setArrowBarrageBtn(false)
  UI.setPoisonArrowShotBtn(false)
  UI.setBlindingLightBtn(false)
  UI.setDivineLightBtn(false)
  UI.setEngineerConstructBtn(false)
  UI.setEngineerManaGeneratorBtn(false)
  UI.setEngineerTeslaBtn(false, 10, false)
  UI.setChainLightningBtn(
    isMageActiveUnlocked(ctx, 'chain-lightning'),
    MAGE_UPGRADES['chain-lightning'].manaCost,
  )
  UI.setTelekineticThrowBtn(
    isMageActiveUnlocked(ctx, 'telekinetic-throw'),
    MAGE_UPGRADES['telekinetic-throw'].manaCost,
  )
  UI.setManaShieldBtn(
    isMageActiveUnlocked(ctx, 'mana-shield'),
    MAGE_UPGRADES['mana-shield'].manaCost,
    session.run?.player?.manaShieldActive ?? false,
  )
  UI.setLifeTapBtn(
    isMageActiveUnlocked(ctx, 'life-tap'),
    session.run?.player?.lifeTapActive ?? false,
  )
}

export function previewSpellManaCostForUi(ctx) {
  if (!session.run?.player) return Math.max(1, CONFIG.spell.manaCost)
  return ctx.stillWaterManaCost(
    Math.max(1, CONFIG.spell.manaCost - (session.run.player.spellCostReduction ?? 0)) + ctx.tearyExtraCost(),
  )
}

export function getLifeTapStacks() {
  return session.run?.player?.mageActiveStacks?.['life-tap'] ?? 0
}

export function getManaShieldStacks() {
  return session.run?.player?.mageActiveStacks?.['mana-shield'] ?? 0
}
