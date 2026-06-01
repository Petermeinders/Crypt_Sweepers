import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import { resolveEnemySpriteSrc } from '../data/tileIcons.js'
import {
  setCombatEngagement,
  clearCombatEngagementForTile,
  isInSubFloor,
} from './TileTapRouter.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'
const RANGER_FIGHT_ATTACK_PORTRAIT_MS = 4000
const WARRIOR_FIGHT_ATTACK_PORTRAIT_MS = 2000

export function checkShieldBlock(ctx, tile) {
  if (!tile.enemyData?.shieldBlock) return false
  if (Math.random() >= 0.10) return false
  UI.spawnFloat(tile.element, '🛡️ Blocked!', 'damage')
  UI.setMessage(`The Ogre raises its shield — your attack is deflected!`)
  EventBus.emit('audio:play', { sfx: 'hit2' })
  return true
}

/** Returns true if the enemy telegraphs its counter-attack and the parry window should show. */
export function shouldShowParryWindow(tile) {
  if (session.save?.settings?.cheats?.godMode) return false
  if (!(session.save?.settings?.parryEnabled ?? true)) return false
  const attrs = tile.enemyData?.attributes ?? []
  return attrs.includes('telegraphs') && !attrs.includes('fast') && tile.enemyData?.behaviour !== 'fast'
}

/** Mushroom Harvester taunt: if a live, visible Harvester exists and the target is NOT one,
 *  redirect the attack to a random Harvester. Returns the new target tile (or original if no taunt). */
export function resolveTauntTarget(ctx, tile) {
  if (tile.enemyData?.taunt) return tile  // already targeting a harvester — no redirect
  const grid = TileEngine.getGrid()
  if (!grid) return tile
  const harvesters = []
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.taunt) harvesters.push(t)
    }
  }
  if (harvesters.length === 0) return tile
  const tauntTarget = harvesters[Math.floor(Math.random() * harvesters.length)]
  UI.spawnFloat(tile.element, '🍄 Taunted!', 'damage')
  UI.spawnFloat(tauntTarget.element, '🛡️', 'xp')
  return tauntTarget
}

function setEnemySprite(tile, state) {
  const enemyId = tile.enemyData?.enemyId
  if (!enemyId) return
  const childMode = session.save?.settings?.childMode ?? false
  const src = resolveEnemySpriteSrc(enemyId, { state, childMode })
  if (!src) return
  const img = tile.element?.querySelector('.tile-icon-img')
  if (!img) return
  img.src = src
}

// ── Combat ───────────────────────────────────────────────────

export function fightAction(ctx, tile) {
  session.tap.combatBusy = true; session.tap.combatBusySetAt = Date.now()

  ctx.tickPoisonArrowDotOnGlobalTurn({ hapticChannel: 'gesture' })
  if (!tile?.enemyData || tile.enemyData._slain) {
    session.tap.combatBusy = false
    return
  }

  // Mushroom Harvester taunt: redirect melee to a random visible Harvester
  tile = resolveTauntTarget(ctx, tile)
  if (!tile?.enemyData || tile.enemyData._slain) {
    session.tap.combatBusy = false
    return
  }
  if (!ctx.canAttackEnemy(tile)) {
    session.tap.combatBusy = false
    UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
    return
  }
  setCombatEngagement(tile)

  const result = CombatResolver.resolveFight(session.run.player, tile.enemyData)

  let playerDmg = result.playerDmg
  if (ctx.charKey() === 'engineer' && session.run.turret?.hp > 0) {
    const tr = session.run.turret
    const useTurret = !tr.manaGeneratorActive && (tr.mode === 'ballistic' || (tr.mode === 'tesla' && ctx.inTeslaPerimeter(tr, tile)))
    if (useTurret) {
      playerDmg += ctx.engineerTurretDamage(tr.level)
      const turretTileEl = TileEngine.getTile(tr.row, tr.col)?.element
      if (tr.mode === 'tesla') {
        setTimeout(() => UI.spawnTeslaArc(turretTileEl, tile.element), 80)
      } else {
        setTimeout(() => UI.spawnCannonShot(turretTileEl, tile.element), 80)
      }
    }
  }
  if (ctx.charKey() === 'necromancer') {
    const minionDmg = ctx.necroMinionTotalDmg()
    if (minionDmg > 0) playerDmg += minionDmg
  }
  const isUndead = tile.enemyData?.type === 'undead'
  const isBeast  = tile.enemyData?.type === 'beast'
  if (session.run.player.undeadBonus && isUndead) playerDmg = Math.round(playerDmg * 2)
  if (session.run.player.beastBonus  && isBeast)  playerDmg = Math.round(playerDmg * 2)

  if (session.run.player.inventory.some(e => e?.id === 'duelists-glove') && !tile.enemyData._duelistFirstMeleeDone) {
    playerDmg += 1
    tile.enemyData._duelistFirstMeleeDone = true
  }
  // Predator's Edge: first hit on each enemy deals double damage
  if (session.run.player.inventory.some(e => e?.id === 'predators-edge') && !tile.enemyData._predatorFirstHitDone) {
    playerDmg = playerDmg * 2
    tile.enemyData._predatorFirstHitDone = true
  }
  // Whetstone: +1 damage for next N hits
  if ((session.run.player.whettsoneHits ?? 0) > 0) {
    playerDmg += 1
    session.run.player.whettsoneHits--
  }
  // Mirror of Vanity: +5% of current HP as flat damage bonus
  if (session.run.player.inventory.some(e => e?.id === 'mirror-of-vanity')) {
    playerDmg += Math.max(1, Math.floor(session.run.player.hp * 0.05))
  }
  // Ogre: 10% shield block — cancels entire melee attack
  if (checkShieldBlock(ctx, tile)) { session.tap.combatBusy = false; return }

  playerDmg = ctx.scaleOutgoingDamageToEnemy(playerDmg)

  // Solarflare III: +50% melee damage vs stunned blinded enemies
  if (tile.enemyData.solarflareVulnerable && (tile.enemyData.stunTurns ?? 0) > 0) {
    playerDmg = Math.round(playerDmg * 1.5)
  }

  ctx.gainManaFromMeleeHit(tile.element)

  session.run.player.meleeHitCount = (session.run.player.meleeHitCount ?? 0) + 1
  const _stormProc = session.run.player.inventory.some(e => e?.id === 'stormcallers-fist') && session.run.player.meleeHitCount % 5 === 0

  const bonusSuffix = (session.run.player.undeadBonus && isUndead) || (session.run.player.beastBonus && isBeast) ? ' (2×!)' : ''
  const curHp = Number(tile.enemyData.currentHP)
  const safeCurHp = Number.isFinite(curHp) ? curHp : Math.max(1, Number(tile.enemyData.hp) || 1)
  if (!Number.isFinite(curHp)) tile.enemyData.currentHP = safeCurHp
  const hpBeforeStrike = tile.enemyData.currentHP
  const pd = Number(playerDmg)
  const safePd = Number.isFinite(pd) ? pd : ctx.scaleOutgoingDamageToEnemy(1)
  const newEnemyHP = session.save.settings.cheats?.instantKill ? 0 : Math.max(0, safeCurHp - safePd)
  const killsEnemy = newEnemyHP <= 0

  // Fire Ring: 10% chance to ignite on hit
  const hasFireRing = session.run.player.inventory.some(e => e?.id === 'fire-ring')
  const ignite = hasFireRing && !killsEnemy && Math.random() < 0.10

  // Infected Blade: every melee hit poisons the enemy (3 turns)
  if (!killsEnemy && session.run.player.inventory.some(e => e?.id === 'infected-blade')) {
    tile.enemyData.poisonTurns = Math.max(tile.enemyData.poisonTurns ?? 0, 3)
    UI.updateEnemyStatus(tile.element, tile.enemyData)
  }
  // Festering Wound: every melee hit poisons the enemy (8 turns)
  if (!killsEnemy && session.run.player.inventory.some(e => e?.id === 'festering-wound')) {
    tile.enemyData.poisonTurns = Math.max(tile.enemyData.poisonTurns ?? 0, 8)
    UI.updateEnemyStatus(tile.element, tile.enemyData)
  }

  // Stun: enemy is stunned if stunTurns > 0
  const isStunned = (tile.enemyData.stunTurns ?? 0) > 0

  UI.setPortraitAnim('attack')
  if (ctx.charKey() === 'ranger') UI.spawnArrow(tile.element)
  else if (ctx.charKey() === 'mage') UI.spawnMageAttack(tile.element)
  else if (ctx.charKey() === 'vampire') UI.spawnVampireAttack(tile.element)
  else if (ctx.charKey() === 'necromancer') UI.spawnNecromancerAttack(tile.element)
  else UI.spawnSlash(tile.element)
  const attackSfx = ctx.charKey() === 'ranger'
    ? 'arrowShot'
    : (Math.random() < 0.5 ? 'hit' : 'hit2')
  EventBus.emit('audio:play', { sfx: attackSfx })

  const attackPortraitT0 = performance.now()
  const isRanger = ctx.charKey() === 'ranger'
  const afterAttackPortrait = (fn) => {
    const holdMs = isRanger ? RANGER_FIGHT_ATTACK_PORTRAIT_MS : WARRIOR_FIGHT_ATTACK_PORTRAIT_MS
    const elapsed = performance.now() - attackPortraitT0
    setTimeout(fn, Math.max(0, holdMs - elapsed))
  }

  const enemyGoldDrop = tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1

  // Slime split: first kill restores half HP and splits visually
  const canSplit = killsEnemy
    && tile.enemyData?.attributes?.includes('splits')
    && !tile.enemyData.hasSplit

  // Firefox: counter-attack and spiked-collar damage session.run inside setTimeout — vibrate must happen now, in the gesture turn.
  if (ctx.vibrationRequiresSyncUserActivation() && !killsEnemy && !canSplit) {
    let ms = 0
    if (session.run.player.inventory.some(e => e?.id === 'spiked-collar')) ms += 18
    if (!isStunned && result.enemyDmg > 0) ms += 48
    if (ms > 0) ctx.hapticFromUserGesture(Math.min(90, ms))
  }

  if (killsEnemy && !canSplit) {
    // Fatal blow — enemy never gets to counter
    setTimeout(() => {
      // Spell / Slam / boss exit can resolve this kill first; boss tile clears enemyData.
      if (!session.run || !tile?.enemyData || tile.enemyData._slain) {
        session.tap.combatBusy = false
        return
      }
      if (session.run.telemetry) {
        session.run.telemetry.totalDamageDealtToEnemies += hpBeforeStrike
        ctx.telemetryBumpDamageDealt(session.run.floor, hpBeforeStrike)
      }
      tile.enemyData.currentHP = 0
      if (tile.enemyData?.enemyId === 'onion') ctx.applyTearyEyes()
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls before they can strike back. +${enemyGoldDrop} gold.`)
      ctx.gainGold(enemyGoldDrop, tile.element, true)
      ctx.gainXP(result.xpDrop ?? 0, tile.element)
      endCombatVictory(ctx, tile)
      if (_stormProc) triggerStormcallerLightning(ctx, tile, playerDmg)
      afterAttackPortrait(() => {
        UI.setPortraitAnim('idle')
      })
      session.tap.combatBusy = false
    }, 400)
  } else if (canSplit) {
    setTimeout(() => {
      if (!session.run || !tile?.enemyData || tile.enemyData._slain) {
        session.tap.combatBusy = false
        return
      }
      const splitHP = Math.max(1, Math.floor(tile.enemyData.hp / 2))
      if (session.run.telemetry) {
        const dealt = hpBeforeStrike - splitHP
        session.run.telemetry.totalDamageDealtToEnemies += dealt
        ctx.telemetryBumpDamageDealt(session.run.floor, dealt)
      }
      tile.enemyData.currentHP = splitHP
      tile.enemyData.hasSplit  = true
      UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
      UI.spawnFloat(tile.element, '🟢 Split!', 'damage')
      UI.splitSlime(tile.element)
      UI.updateEnemyHP(tile.element, splitHP)
      UI.setMessage(`The slime splits in two! Each half still fights. (${splitHP} HP remaining)`)
      afterAttackPortrait(() => {
        UI.setPortraitAnim('idle')
      })
      session.tap.combatBusy = false
    }, 400)
  } else {
    setTimeout(() => {
      if (!session.run) { session.tap.combatBusy = false; return }
      if (!tile?.enemyData || tile.enemyData._slain) {
        session.tap.combatBusy = false
        return
      }
      if (session.run.telemetry) {
        const dealt = hpBeforeStrike - newEnemyHP
        session.run.telemetry.totalDamageDealtToEnemies += dealt
        ctx.telemetryBumpDamageDealt(session.run.floor, dealt)
      }
      tile.enemyData.currentHP = newEnemyHP
      if (tile.enemyData?.enemyId === 'onion') { ctx.applyTearyEyes(); ctx.checkOnionLayer(tile) }

      if (ignite) {
        tile.enemyData.burnTurns = 3
        UI.spawnFloat(tile.element, '🔥 Ignited!', 'damage')
      }

      // Tick burn damage if active
      if ((tile.enemyData.burnTurns ?? 0) > 0) {
        const burnPlagueBonus = session.run.player.inventory.some(e => e?.id === 'plague-rat-skull') ? 1 : 0
        const chp0 = Number(tile.enemyData.currentHP)
        const chp = Number.isFinite(chp0) ? chp0 : Number(tile.enemyData.hp ?? 0)
        const burnDmg = chp > 0
          ? Math.max(1, Math.floor(chp * 0.2)) + burnPlagueBonus
          : 1 + burnPlagueBonus
        tile.enemyData.currentHP = Math.max(0, (Number.isFinite(chp0) ? chp0 : chp) - burnDmg)
        tile.enemyData.burnTurns--
        UI.spawnFloat(tile.element, `🔥 ${burnDmg}`, 'damage')
        if (tile.enemyData.currentHP <= 0) {
          UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
          UI.setMessage(`You strike for ${playerDmg}${bonusSuffix}! The enemy falls to flames before they can strike back. +${enemyGoldDrop} gold.`)
          ctx.gainGold(enemyGoldDrop, tile.element, true)
          ctx.gainXP(result.xpDrop ?? 0, tile.element)
          endCombatVictory(ctx, tile)
          afterAttackPortrait(() => {
            UI.setPortraitAnim('idle')
          })
          session.tap.combatBusy = false
          return
        }
      }

      // Spiked Collar: deal 1 self-damage on every melee hit
      if (session.run.player.inventory.some(e => e?.id === 'spiked-collar')) {
        ctx.takeDamage(1, tile.element, true, null, { deathCause: 'spiked_collar' })
        if (GameState.is(States.DEATH)) { session.tap.combatBusy = false; return }
      }

      // Decrement stun
      if (isStunned) tile.enemyData.stunTurns--

      // Enemy counter-attack — telegraphing enemies show a parry window first
      if (!isStunned && shouldShowParryWindow(tile)) {
        const _isBot = new URLSearchParams(location.search).has('balanceBot')
          || new URLSearchParams(location.search).has('testBotOngoing')
          || new URLSearchParams(location.search).has('testHarness')
        const _doParryWindow = () => {
        UI.showParryWindow(tile.enemyData, (parryResult) => {
          if (!session.run || !tile.enemyData || tile.enemyData._slain) { session.tap.combatBusy = false; return }

          let finalEnemyDmg = result.enemyDmg
          let parrySuccessType = null

          if (parryResult === 'block') {
            // Successful block: free, half damage
            finalEnemyDmg = Math.floor(result.enemyDmg / 2)
            parrySuccessType = 'block'
          } else if (parryResult === 'counter') {
            // Successful parry: +1 mana, no damage
            session.run.player.mana = Math.min(session.run.player.maxMana, (session.run.player.mana ?? 0) + 1)
            UI.updateMana(session.run.player.mana, session.run.player.maxMana)
            finalEnemyDmg = 0
            parrySuccessType = 'counter'
          } else if (parryResult === 'miss-block') {
            // Failed block attempt: -1 mana, full damage
            session.run.player.mana = Math.max(0, (session.run.player.mana ?? 0) - 1)
            UI.updateMana(session.run.player.mana, session.run.player.maxMana)
          } else if (parryResult === 'miss-parry') {
            // Failed parry attempt: -2 mana, double damage
            session.run.player.mana = Math.max(0, (session.run.player.mana ?? 0) - 2)
            UI.updateMana(session.run.player.mana, session.run.player.maxMana)
            finalEnemyDmg = result.enemyDmg * 2
          }
          // 'ignore': ring expired untouched — full damage, no mana change

          setEnemySprite(tile, 'attack')
          if (tile.enemyData?.freezingHit)   ctx.applyFreezingHit()
          if (tile.enemyData?.burnHit)        ctx.applyBurnHit(tile.enemyData.burnHitAmount ?? 2)
          if (tile.enemyData?.poisonHit)      ctx.applyPlayerPoison(tile.enemyData.poisonHitAmount ?? 2)
          if (tile.enemyData?.corruptionHit)  ctx.applyCorruption()
          if (tile.enemyData?.demonFlip)      ctx.tryDemonFlip(tile)
          if (finalEnemyDmg > 0) {
            ctx.takeDamage(finalEnemyDmg, tile.element, true, tile.enemyData, { enemyAttack: true })
            UI.shakeTile(tile.element)
          }
          if (GameState.is(States.DEATH)) { session.tap.combatBusy = false; return }

          if (parrySuccessType === 'counter') {
            const bonusHitDmg = Math.max(1, Math.ceil(playerDmg * 0.5))
            tile.enemyData.currentHP = Math.max(0, (tile.enemyData.currentHP ?? 0) - bonusHitDmg)
            UI.spawnFloat(tile.element, `⚡ ${bonusHitDmg}`, 'xp')
            UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
            if (tile.enemyData.currentHP <= 0) {
              ctx.gainGold(enemyGoldDrop, tile.element, true)
              ctx.gainXP(result.xpDrop ?? 0, tile.element)
              endCombatVictory(ctx, tile)
              afterAttackPortrait(() => UI.setPortraitAnim('idle'))
              session.tap.combatBusy = false
              return
            }
          }

          setTimeout(() => {
            if (!session.run || !tile.enemyData || tile.enemyData._slain) { session.tap.combatBusy = false; return }
            setEnemySprite(tile, 'idle')
            UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
            EventBus.emit('combat:damage', { amount: playerDmg, target: 'enemy' })
            let tradeMsg
            if (parrySuccessType === 'counter') {
              tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Counter! You deflect the blow and land a bonus hit.`
            } else if (parrySuccessType === 'block') {
              if (finalEnemyDmg === 0) {
                tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Perfect block! You take no damage.`
              } else {
                const taken = ctx.computeEffectiveDamageTaken(finalEnemyDmg)
                tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Blocked! You absorb the hit for only ${taken} damage.`
              }
            } else {
              const taken = ctx.computeEffectiveDamageTaken(result.enemyDmg)
              tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! You miss the window — enemy strikes for ${taken} damage.`
            }
            UI.setMessage(tradeMsg)
            UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
            if (_stormProc) triggerStormcallerLightning(ctx, tile, playerDmg)
            afterAttackPortrait(() => {
              if (finalEnemyDmg > 0) UI.setPortraitAnim('hit')
              setTimeout(() => UI.setPortraitAnim('idle'), finalEnemyDmg > 0 ? 500 : 0)
            })
            session.tap.combatBusy = false
          }, 500)
        }, ctx.charKey())
        } // end _doParryWindow
        if (!_isBot && !(session.save.settings?.parryTutorialSeen)) {
          session.save.settings.parryTutorialSeen = true
          SaveManager.save(session.save).catch(() => {})
          UI.showParryTutorial(ctx.charKey(), _doParryWindow)
        } else {
          _doParryWindow()
        }
        return
      }

      // Enemy counter-attack (skipped if stunned)
      if (!isStunned) {
        setEnemySprite(tile, 'attack')
        if (tile.enemyData?.freezingHit)    ctx.applyFreezingHit()
        if (tile.enemyData?.burnHit)         ctx.applyBurnHit(tile.enemyData.burnHitAmount ?? 2)
        if (tile.enemyData?.poisonHit)       ctx.applyPlayerPoison(tile.enemyData.poisonHitAmount ?? 2)
        if (tile.enemyData?.corruptionHit)   ctx.applyCorruption()
        if (tile.enemyData?.demonFlip)        ctx.tryDemonFlip(tile)
        ctx.takeDamage(result.enemyDmg, tile.element, true, tile.enemyData, { enemyAttack: true })
        UI.shakeTile(tile.element)
        if (GameState.is(States.DEATH)) { session.tap.combatBusy = false; return }
      }

      setTimeout(() => {
        if (!session.run || !tile.enemyData || tile.enemyData._slain) {
          session.tap.combatBusy = false
          return
        }
        setEnemySprite(tile, 'idle')
        UI.spawnFloat(tile.element, `⚔️ ${playerDmg}`, 'xp')
        EventBus.emit('combat:damage', { amount: playerDmg, target: 'enemy' })
        let tradeMsg
        if (isStunned) {
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy is stunned — no counter-attack.`
        } else if (session.save.settings.cheats?.godMode) {
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy strikes back — you take no damage.`
        } else {
          const taken = ctx.computeEffectiveDamageTaken(result.enemyDmg)
          tradeMsg = `You strike for ${playerDmg}${bonusSuffix}! Enemy strikes back for ${taken} damage.`
        }
        UI.setMessage(tradeMsg)
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        if (_stormProc) triggerStormcallerLightning(ctx, tile, playerDmg)

        afterAttackPortrait(() => {
          if (!isStunned) UI.setPortraitAnim('hit')
          setTimeout(() => {
            UI.setPortraitAnim('idle')
          }, isStunned ? 0 : 500)
        })
        session.tap.combatBusy = false
      }, isStunned ? 200 : 500)
    }, 400)
  }
}

export function endCombatVictory(ctx, tile) {
  // Sub-floor kill path — bypass main-grid-specific cleanup (boss exit tile,
  // recompute adjacency locks on _grid, threat clue refresh, floor-cleared
  // check). Handle sub-floor-appropriate cleanup instead and still apply
  // on-kill trinket effects below by falling through? No — on-kill trinket
  // effects reference `TileEngine.getOrthogonalTiles`, which is main-grid.
  // For sub-floors we use a focused subset.
  if (isInSubFloor()) {
    tile.enemyData._slain = true
    UI.markSubFloorTileSlain(tile)
    ctx.sfUnlockAdjacent(tile)
    // Boss vault: unlock rewards on boss death
    if (tile.isBossVaultBoss) {
      const sf = session.run.subFloor
      for (const row of sf.tiles) for (const t of row) {
        if (t && t.locked) {
          t.locked = false; t.reachable = true
          UI.unlockSubFloorTile(t); UI.markSubFloorTileReachable(t)
        }
      }
      UI.setSubFloorMessage('The boss falls! The vault trembles — riches await.')
    }
    // On-kill heal / vampire-fang trinkets still apply in sub-floor
    if (session.run.player.onKillHeal > 0) {
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + session.run.player.onKillHeal)
      UI.spawnFloat(tile.element, `+${session.run.player.onKillHeal} HP`, 'heal')
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    }
    if (session.run.player.inventory.some(e => e?.id === 'vampire-fang')) {
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 1)
      UI.spawnFloat(tile.element, '+1 HP', 'heal')
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
    }
    EventBus.emit('audio:play', { sfx: 'gold' })
    ctx.telemetryBumpKill(session.run.floor)
    EventBus.emit('combat:end', { outcome: 'victory' })
    return
  }

  ctx.telemetryBumpKill(session.run.floor)
  const wasBoss = !!tile.enemyData?.isBoss
  const killEchoKill = ctx.charKey() === 'warrior' && !!(tile.killEchoMarked || tile.senseEvilMarked)
  tile.enemyData._slain = true
  clearCombatEngagementForTile(tile)
  // Drowned Hulk: remove crew aura from all buffed enemies on death
  if (tile.enemyData.crewBuffAura) {
    UI.setMessage('⚓ The Drowned Hulk falls — its crew weakens!')
    ctx.removeHulkBuffFromAll()
  }
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  // Paladin Kill Echo: widen quota; add new marks from this kill without stripping other marked foes
  if (killEchoKill) {
    session.run.killEchoQuota = Math.min((session.run.killEchoQuota ?? 1) + 1, 3)
    ctx.paladinKillEchoAddMarksAfterKill(tile)
  }
  // Archer / Treasure Goblin spawn pre-revealed without markReachable (see _spawnArcherGoblin),
  // so neighbors stay unreachable until the player paths adjacent. On defeat,
  // propagate reachability from the tile so surrounding tiles become tappable.
  if (tile.enemyData?.enemyId === 'archer_goblin' || tile.enemyData?.enemyId === 'treasure_goblin') {
    TileEngine.markReachable(tile.row, tile.col, ctx.markReachableUi)
  }
  if (tile.enemyData?.isBoss) {
    session.run.bossFloorExitPending = true
    tile.type = 'exit'
    tile.enemyData = null
    UI.markBossTileAsExit(tile.element)
    tile.exitResolved = false
    tile.element?.classList.add('exit-pending')
    UI.setMessage('🚪 The way forward opens. Tap the stairs when you are ready.')
  } else {
    UI.markTileSlain(tile.element)
    // Necromancer: slain tiles become ash piles — re-enable pointer events for Raise Minion
    if (ctx.charKey() === 'necromancer') {
      tile.element?.classList.add('enemy-alive')
      UI.setMessage('💀 The enemy falls to ashes. Tap to raise a minion (10 mana).')
    }
  }

  // Tongue Snatch: return stolen gold on kill
  if ((tile.enemyData?.snatched ?? 0) > 0) {
    ctx.gainGold(tile.enemyData.snatched, tile.element)
    UI.spawnFloat(tile.element, `👅 +${tile.enemyData.snatched}💰 returned!`, 'heal')
  }

  if (session.run.player.onKillHeal > 0) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + session.run.player.onKillHeal)
    UI.spawnFloat(tile.element, `+${session.run.player.onKillHeal} HP`, 'heal')
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }

  // Engineer Turret Mastery III: heal 3% (min 1) on any kill while turret is active at level 3
  if (ctx.charKey() === 'engineer' && session.run.player.turretKillHeal) {
    const tr = session.run.turret
    if (tr?.hp > 0 && tr.level >= 3) {
      const tkHeal = Math.max(1, Math.floor(session.run.player.maxHp * 0.03))
      session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + tkHeal)
      UI.updateHP(session.run.player.hp, session.run.player.maxHp)
      UI.spawnFloat(tile.element, `💚 +${tkHeal}`, 'xp')
    }
  }

  if (session.run.player.inventory.some(e => e?.id === 'vampire-fang')) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 1)
    UI.spawnFloat(tile.element, '+1 HP', 'heal')
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }
  if (session.run.player.inventory.some(e => e?.id === 'sanguine-covenant')) {
    session.run.player.hp = Math.min(session.run.player.maxHp, session.run.player.hp + 2)
    UI.spawnFloat(tile.element, '⚗️ +2 HP', 'heal')
    UI.updateHP(session.run.player.hp, session.run.player.maxHp)
  }
  if (session.run.player.inventory.some(e => e?.id === 'soul-candle') && Math.random() < 0.20) {
    session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + 1)
    UI.spawnFloat(tile.element, '🕯️ +1 MP', 'mana')
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  }
  if (session.run.player.inventory.some(e => e?.id === 'temporal-wick') && Math.random() < 0.30) {
    session.run.player.mana = Math.min(session.run.player.maxMana, session.run.player.mana + 1)
    UI.spawnFloat(tile.element, '⏳ +1 MP', 'mana')
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  }
  if (session.run.player.inventory.some(e => e?.id === 'resonance-core')) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element) {
        const cat = ctx.echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }
  // Deathmask: 25% chance next reveal is an instant kill
  if (!session.run.player.deathmaskPending && session.run.player.inventory.some(e => e?.id === 'deathmask') && Math.random() < 0.25) {
    session.run.player.deathmaskPending = true
    UI.spawnFloat(tile.element, '💀 Marked!', 'xp')
  }
  if (session.run.player.inventory.some(e => e?.id === 'greed-tooth')) {
    ctx.gainGold(1, tile.element, true)
  }
  if (session.run.player.inventory.some(e => e?.id === 'echo-charm')) {
    for (const adj of TileEngine.getOrthogonalTiles(tile.row, tile.col)) {
      if (!adj.revealed && adj.element) {
        const cat = ctx.echoCharmCategoryForTileType(adj.type)
        adj.echoHintCategory = cat
        adj.element.classList.add('echo-hint')
        adj.element.dataset.echoHint = cat
      }
    }
  }

  // Eagle Eye: grant free flip (any tile, ignores adjacency)
  if (session.run.player.inventory.some(e => e?.id === 'eagle-eye')) {
    session.run.player.eagleEyeFreeFlip = true
    UI.spawnFloat(tile.element, '🦅 Free flip!', 'xp')
  }
  // Hunter's Instinct: reveal nearest adjacent hidden tile + echo hint all other adjacent tiles
  if (session.run.player.inventory.some(e => e?.id === 'hunters-instinct')) {
    const adjs = TileEngine.getOrthogonalTiles(tile.row, tile.col).filter(t => !t.revealed)
    if (adjs.length > 0) {
      const nearest = adjs[0]
      nearest.revealed = true
      session.run.tilesRevealed++
      TileEngine.markReachable(nearest.row, nearest.col, ctx.markReachableUi)
      if (nearest.element) TileEngine.flipTile(nearest)
      ctx.applyRevealOutcome(nearest)
      for (const adj of adjs.slice(1)) {
        if (!adj.revealed && adj.element) {
          const cat = ctx.echoCharmCategoryForTileType(adj.type)
          adj.echoHintCategory = cat
          adj.element.classList.add('echo-hint')
          adj.element.dataset.echoHint = cat
        }
      }
      UI.spawnFloat(tile.element, '🐾 Instinct!', 'xp')
    }
  }
  // Soulbound Blade: +0.1 permanent damage per kill
  if (session.run.player.inventory.some(e => e?.id === 'soulbound-blade')) {
    session.run.player.soulboundBonus = (session.run.player.soulboundBonus ?? 0) + 0.1
    if (Math.floor(session.run.player.soulboundBonus) > Math.floor(session.run.player.soulboundBonus - 0.1)) {
      const [d0, d1] = ctx.playerDamageRange(session.run.player)
      UI.updateDamageRange(d0, d1)
      UI.spawnFloat(tile.element, '⚔️ +1 dmg!', 'xp')
    }
  }

  if (tile.enemyData?.enemyId === 'treasure_goblin') {
    void ctx.finishTreasureGoblinReward(tile).catch(() => {})
  }

  // Mana Spring modifier: +2 mana per kill
  if (session.run.floorModifier?.id === 'mana-spring' && session.run.player.mana < session.run.player.maxMana) {
    const gained = Math.min(2, session.run.player.maxMana - session.run.player.mana)
    session.run.player.mana += gained
    UI.spawnFloat(tile.element, `🔮 +${gained} MP`, 'mana')
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
  }

  // Gear drop: boss = guaranteed, normal enemy = 5% chance
  ctx.tryGearDrop(session.run.floor, wasBoss ? 1.0 : 0.05)

  EventBus.emit('audio:play', { sfx: 'gold' })
  EventBus.emit('combat:end', { outcome: 'victory' })
  TileEngine.refreshAllThreatClueDisplays()

  if (wasBoss && session.run.floor === 100 && ctx.tryGameCompletion?.()) return

  ctx.checkFloorCleared()
  ctx.maybeOfferDeadlockEscape()
}

function triggerStormcallerLightning(ctx, sourceTile, playerDmg) {
  const grid = TileEngine.getGrid()
  const lightningDmg = Math.max(1, Math.floor(playerDmg * 0.2))
  let victims = 0
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && t !== sourceTile) {
        t.enemyData.currentHP = Math.max(0, t.enemyData.currentHP - lightningDmg)
        UI.spawnFloat(t.element, `⚡ ${lightningDmg}`, 'damage')
        UI.updateEnemyHP(t.element, t.enemyData.currentHP)
        victims++
        if (t.enemyData.currentHP <= 0) {
          ctx.gainGold(t.enemyData.goldDrop ? ctx.rand(...t.enemyData.goldDrop) : 1, t.element, true)
          ctx.gainXP(t.enemyData.xpDrop ?? 0, t.element)
          endCombatVictory(ctx, t)
        }
      }
    }
  }
  if (victims > 0) {
    UI.spawnFloat(sourceTile.element, '⚡ Storm!', 'xp')
    EventBus.emit('audio:play', { sfx: 'spell' })
  }
}

