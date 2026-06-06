import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { STRENGTHEN_MINION_COST } from '../data/necromancer.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

// When a sub-floor is active, abilities, target iteration, and kill
// handling should operate on its tiles — not the main dungeon grid.

export function isInSubFloor() {
  return !!session.run?.subFloor?.active
}

/** Flat list of tiles in the currently active grid (sub-floor if active, else main). */
export function getActiveTiles() {
  if (isInSubFloor()) {
    const out = []
    for (const row of session.run.subFloor.tiles) for (const t of row) if (t) out.push(t)
    return out
  }
  const grid = TileEngine.getGrid()
  if (!grid?.length) return []
  const out = []
  for (const row of grid) for (const t of row) if (t) out.push(t)
  return out
}

/** 2D array for algorithms that need row/col indexing on the active grid. */
export function getActiveTileRows() {
  return isInSubFloor() ? session.run.subFloor.tiles : TileEngine.getGrid()
}

/** Tile at (row, col) on the active grid — sub-floor when a sub-floor is open, else main dungeon. */
export function getActiveTileAt(row, col) {
  if (isInSubFloor()) return session.run.subFloor.tiles[row]?.[col] ?? null
  return TileEngine.getTile(row, col)
}

/** Orthogonal neighbors in the active grid. */
export function getActiveOrthogonal(row, col) {
  const rows = getActiveTileRows()
  if (!rows?.length) return []
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  return dirs
    .map(([dr, dc]) => rows[row + dr]?.[col + dc])
    .filter(Boolean)
}

/** Sync red border highlight on the engaged enemy tile (at most one). */
export function syncCombatEngagementDom() {
  const grid = TileEngine.getGrid()
  if (grid) {
    const hasEngagement = !isInSubFloor() && !!session.tap.combatEngagementTile
    for (const row of grid) {
      for (const t of row) {
        if (!t.element) continue
        const engaged =
          hasEngagement
          && t.row === session.tap.combatEngagementTile.row
          && t.col === session.tap.combatEngagementTile.col
          && t.enemyData
          && !t.enemyData._slain
        UI.setTileCombatEngaged(t.element, engaged)
        UI.setTileCombatBlocked(t.element, hasEngagement && !engaged)
      }
    }
  }
  if (isInSubFloor() && session.run.subFloor?.tiles) {
    const hasEngagement = !!session.tap.combatEngagementTile
    for (const row of session.run.subFloor.tiles) {
      for (const t of row) {
        if (!t?.element) continue
        const engaged =
          hasEngagement
          && t.row === session.tap.combatEngagementTile.row
          && t.col === session.tap.combatEngagementTile.col
          && t.enemyData
          && !t.enemyData._slain
        UI.setTileCombatEngaged(t.element, engaged)
        UI.setTileCombatBlocked(t.element, hasEngagement && !engaged)
      }
    }
  }
}

/**
 * @param {{ force?: boolean }} [opts] — `force: true` for ambush reveal (replaces prior focus).
 * @returns {boolean} whether this tile is now the engagement target
 */
export function setCombatEngagement(tile, { force = false } = {}) {
  if (!tile?.enemyData || tile.enemyData._slain) return false
  if (!session.tap.combatEngagementTile) {
    session.tap.combatEngagementTile = { row: tile.row, col: tile.col }
    syncCombatEngagementDom()
    return true
  }
  if (session.tap.combatEngagementTile.row === tile.row && session.tap.combatEngagementTile.col === tile.col) return true
  const cur = getActiveTileAt(session.tap.combatEngagementTile.row, session.tap.combatEngagementTile.col)
  if (!cur?.enemyData || cur.enemyData._slain) {
    session.tap.combatEngagementTile = { row: tile.row, col: tile.col }
    syncCombatEngagementDom()
    return true
  }
  if (force) {
    session.tap.combatEngagementTile = { row: tile.row, col: tile.col }
    syncCombatEngagementDom()
    return true
  }
  return false
}

export function clearCombatEngagementForTile(tile) {
  if (
    session.tap.combatEngagementTile
    && tile.row === session.tap.combatEngagementTile.row
    && tile.col === session.tap.combatEngagementTile.col
  ) {
    session.tap.combatEngagementTile = null
    syncCombatEngagementDom()
  }
}

export function clearAllCombatEngagement() {
  session.tap.combatEngagementTile = null
  syncCombatEngagementDom()
}

/** True while the focused enemy is still alive (clears stale refs). */
export function isCombatCommitmentLocked() {
  if (!session.tap.combatEngagementTile) return false
  const t = getActiveTileAt(session.tap.combatEngagementTile.row, session.tap.combatEngagementTile.col)
  if (t?.enemyData && !t.enemyData._slain) return true
  session.tap.combatEngagementTile = null
  syncCombatEngagementDom()
  return false
}

/** Melee / single-target attacks: only the engaged enemy, unless engagement is stale/cleared. */
export function canAttackEnemy(tile) {
  if (!session.tap.combatEngagementTile) return true
  const cur = getActiveTileAt(session.tap.combatEngagementTile.row, session.tap.combatEngagementTile.col)
  if (!cur?.enemyData || cur.enemyData._slain) {
    session.tap.combatEngagementTile = null
    syncCombatEngagementDom()
    return true
  }
  return tile.row === session.tap.combatEngagementTile.row && tile.col === session.tap.combatEngagementTile.col
}

/** Temporarily clear focus so Slam / Ricochet / Triple Volley can hit any targets; pair with restore after the ability finishes. */
export function suspendCombatEngagementForMultiTargetAbility() {
  const saved = session.tap.combatEngagementTile ? { ...session.tap.combatEngagementTile } : null
  session.tap.combatEngagementTile = null
  syncCombatEngagementDom()
  return saved
}

export function restoreCombatEngagementAfterMultiTargetAbility(saved) {
  if (!saved) return
  const t = getActiveTileAt(saved.row, saved.col)
  if (t?.enemyData && !t.enemyData._slain) {
    session.tap.combatEngagementTile = { row: saved.row, col: saved.col }
    syncCombatEngagementDom()
  }
}


export function onTileTap(ctx, row, col) {
  const state = GameState.current()
  const tile  = TileEngine.getTile(row, col)
  if (!tile) return

  if (session.run?._voidCorruptionBlocking) {
    UI.setMessage('Choose a Void corruption curse before exploring.', true)
    return
  }

  if (state === States.NPC_INTERACT) return

  ctx.syncAllUnrevealedLockedDom()

  if (state === States.FLOOR_EXPLORE && ctx.charKey() === 'engineer') {
    const tr = session.run.turret
    const isTurretTile = tr?.hp > 0 && tr.row === tile.row && tr.col === tile.col
    const isRevealedEmpty = tile.revealed && tile.type === 'empty' && !tile.locked
    const isLivingEnemyTap = tile.revealed && tile.enemyData && !tile.enemyData._slain
    if ((isTurretTile || isRevealedEmpty || session.tap.engineerPendingTile) && !isLivingEnemyTap) {
      if (ctx.isCombatCommitmentLocked()) {
        if (!isTurretTile && !isRevealedEmpty) {
          UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
          return
        }
      }
      if (ctx.handleEngineerConstructTileTap(tile)) return
    }
  }

  // Necromancer: Strengthen Minion — tap a minion tile to reinforce it
  if (session.tap.strengthenMinionSelecting) {
    const minion = (session.run.minions ?? []).find(m => m.row === tile.row && m.col === tile.col && m.hp > 0)
    if (!minion) {
      UI.setMessage('Tap one of your minions to strengthen it.', true)
      return
    }
    if (session.run.player.mana < STRENGTHEN_MINION_COST) {
      UI.setMessage('Not enough mana for Strengthen Minion!', true)
      ctx.cancelStrengthenMinionMode()
      return
    }
    const smStacks = session.run.player.strengthenMinionStacks ?? 0
    const smHpGain = smStacks >= 1 ? 10 : 5
    const smManaCost = ctx.hasNecroMetaUpgrade('strengthen-minion-mastery-3') ? 6 : STRENGTHEN_MINION_COST
    session.run.player.mana -= smManaCost
    UI.updateMana(session.run.player.mana, session.run.player.maxMana)
    minion.maxHp += smHpGain
    minion.hp    += smHpGain
    if (smStacks >= 2) {
      minion.damage = (minion.damage ?? 1) + 1
    }
    ctx.syncMinionVisual(minion)
    UI.spawnFloat(tile.element, `❤️ +${smHpGain}`, 'xp')
    UI.setMessage(`Your minion grows stronger! (❤️ ${minion.hp}/${minion.maxHp})`)
    ctx.cancelStrengthenMinionMode()
    ctx.saveActiveRun()
    return
  }

  // Necromancer: Corpse Explosion — tap a corpse (ash pile) or minion to detonate
  if (session.tap.corpseExplosionSelecting) {
    const isCorpse = tile.revealed && tile.enemyData && tile.enemyData._slain && !tile.corpseExploded
    const isMinion = !!(session.run.minions ?? []).find(m => m.row === tile.row && m.col === tile.col && m.hp > 0)
    if (!isCorpse && !isMinion) {
      UI.setMessage('Tap a corpse or one of your minions to detonate.', true)
      return
    }
    ctx.executeCorpseExplosion(tile)
    return
  }

  // Spell targeting mode: only enemy taps fire; everything else ignored
  if (session.tap.spellTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      ctx.castSpell(tile)
    }
    return
  }

  // Throwing Knife targeting
  if (session.tap.throwingKnifeTargeting) {
    session.tap.throwingKnifeTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const dmg = 3
      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
      UI.spawnFloat(tile.element, `🗡️ ${dmg}`, 'damage')
      EventBus.emit('audio:play', { sfx: 'hit' })
      if (tile.enemyData.currentHP <= 0) {
        ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
        ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        ctx.endCombatVictory(tile)
        UI.setMessage(`🗡️ Knife flies true — enemy slain! No counter-attack.`)
      } else {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        UI.setMessage(`🗡️ Knife deals ${dmg} damage. Enemy has ${tile.enemyData.currentHP} HP left.`)
      }
    }
    return
  }

  // Twin Blades targeting
  if (session.tap.twinBladesTargeting) {
    session.tap.twinBladesTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const dmg = 5
      tile.enemyData.currentHP = Math.max(0, tile.enemyData.currentHP - dmg)
      UI.spawnFloat(tile.element, `⚔️ ${dmg}`, 'damage')
      EventBus.emit('audio:play', { sfx: 'hit' })
      if (tile.enemyData.currentHP <= 0) {
        ctx.gainGold(tile.enemyData.goldDrop ? ctx.rand(...tile.enemyData.goldDrop) : 1, tile.element, true)
        ctx.gainXP(tile.enemyData.xpDrop ?? 0, tile.element)
        ctx.endCombatVictory(tile)
        UI.setMessage(`⚔️ Twin Blades — enemy slain! No counter-attack.`)
      } else {
        UI.updateEnemyHP(tile.element, tile.enemyData.currentHP)
        UI.setMessage(`⚔️ Twin Blades deal ${dmg} damage. Enemy has ${tile.enemyData.currentHP} HP left.`)
      }
    }
    return
  }

  // Rusty Nail targeting
  if (session.tap.rustyNailTargeting) {
    session.tap.rustyNailTargeting = false
    UI.setMessage('')
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      tile.enemyData.poisonTurns = (tile.enemyData.poisonTurns ?? 0) + 5
      tile.enemyData.nailPoison  = true
      UI.updateEnemyStatus(tile.element, tile.enemyData)
      UI.spawnFloat(tile.element, '📌 Poisoned!', 'damage')
      UI.setMessage(`📌 Rusty nail lodges deep — ${tile.enemyData.label} will take 1 damage per turn for 5 turns.`)
      EventBus.emit('audio:play', { sfx: 'hit' })
    }
    return
  }

  // Lantern targeting: any unrevealed tile (ignores reachable restriction)
  if (session.tap.lanternTargeting) {
    if (!tile.revealed) {
      if (ctx.isCombatCommitmentLocked()) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      ctx.useLanternOn(tile)
      return
    }
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      session.tap.lanternTargeting = false
      UI.setLanternTargeting(false)
      // Fall through — melee the enemy
    } else {
      return
    }
  }

  if (session.tap.spyglassTargeting) {
    if (!tile.revealed) {
      if (ctx.isCombatCommitmentLocked()) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      ctx.useSpyglassOn(tile)
      return
    }
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      session.tap.spyglassTargeting = false
      UI.setLanternTargeting(false)
      // Fall through — melee the enemy
    } else {
      return
    }
  }

  // Blinding Light targeting: revealed living enemy
  if (session.tap.blindingLightTargeting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      ctx.castBlindingLight(tile)
    }
    return
  }

  // Divine Light targeting: revealed living enemy → smite
  if (session.tap.divineLightSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      ctx.castDivineLightSmite(tile)
    }
    return
  }

  // Triple Volley: first tap sets 3×3 center (preview); second tap same tile confirms
  if (session.tap.arrowBarrageSelecting) {
    if (!tile.revealed) {
      UI.setMessage('Triple Volley — tap a revealed tile to place the 3×3 area.', true)
      return
    }
    const cost = ctx.stillWaterManaCost(RANGER_UPGRADES['arrow-barrage'].manaCost + ctx.tearyExtraCost())
    if (!session.tap.tripleVolleyCenter) {
      session.tap.tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage(
        'Triple Volley — blinking tiles show the blast. Tap the same tile again to fire (or tap the ability to cancel).',
      )
      return
    }
    if (tile.row !== session.tap.tripleVolleyCenter.row || tile.col !== session.tap.tripleVolleyCenter.col) {
      session.tap.tripleVolleyCenter = { row: tile.row, col: tile.col }
      UI.setTripleVolleyAoePreview(tile.row, tile.col)
      UI.setMessage('Triple Volley — area moved. Tap the center tile again to confirm.')
      return
    }
    if (session.run.player.mana < cost) {
      UI.setMessage('Not enough mana for Triple Volley!', true)
      return
    }
    ctx.executeTripleVolley(session.tap.tripleVolleyCenter)
    return
  }

  // Poison Arrow (active): single living enemy — initial hit + 3 poison ticks (global turns)
  if (session.tap.poisonArrowShotSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const cost = ctx.stillWaterManaCost(RANGER_UPGRADES['poison-arrow-shot'].manaCost + ctx.tearyExtraCost())
      if (session.run.player.mana < cost) {
        UI.setMessage('Not enough mana for Poison Arrow!', true)
      } else {
        ctx.executePoisonArrowShot(tile)
      }
    }
    return
  }

  // Ricochet: mark up to 3 enemies in tap order; 3rd pick fires immediately
  if (session.tap.ricochetSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      const idx = session.tap.ricochetTiles.findIndex(t => t.row === tile.row && t.col === tile.col)
      if (idx >= 0) {
        session.tap.ricochetTiles.splice(idx, 1)
        UI.refreshRicochetMarks(session.tap.ricochetTiles)
      } else if (session.tap.ricochetTiles.length < 3) {
        session.tap.ricochetTiles.push(tile)
        UI.refreshRicochetMarks(session.tap.ricochetTiles)
        if (session.tap.ricochetTiles.length === 3) {
          const cost = ctx.stillWaterManaCost(RANGER_UPGRADES.ricochet.manaCost + ctx.tearyExtraCost())
          if (session.run.player.mana < cost) {
            session.tap.ricochetTiles.pop()
            UI.refreshRicochetMarks(session.tap.ricochetTiles)
            UI.setMessage('Not enough mana for Ricochet!', true)
          } else {
            ctx.executeRicochet()
          }
        }
      } else {
        UI.setMessage('Ricochet — max 3 targets.', true)
      }
    }
    return
  }

  // Chain Lightning: tap a revealed living enemy — bolt zaps, then arcs to up to 2 more at random
  if (session.tap.chainLightningSelecting) {
    if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      if (tile.enemyData.spellImmune) {
        UI.setMessage('🛡️ That enemy is immune to Chain Lightning!', true)
      } else {
        ctx.executeChainLightning(tile)
      }
    }
    return
  }

  // Telekinetic Throw: tap enemy (step 1), tap empty tile (step 2)
  if (session.tap.telekineticThrowStep > 0) {
    if (session.tap.telekineticThrowStep === 1) {
      if (ctx.isTelekineticThrowEnemyTarget(tile)) {
        session.tap.telekineticEnemyTile = { row: tile.row, col: tile.col }
        session.tap.telekineticThrowStep = 2
        UI.clearTelekineticMarks()
        UI.markTelekineticOrigin(tile.element)
        UI.setGridTelekineticThrowMode('dest')
        UI.setMessage('🌀 Now tap a revealed empty tile to slam them down.')
      } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
        if (tile.enemyData.behaviour === 'boss' || tile.type === 'boss') {
          UI.setMessage('🛡️ Bosses cannot be thrown.', true)
        } else if (tile.enemyData.spellImmune) {
          UI.setMessage('🛡️ That enemy is immune to Telekinetic Throw!', true)
        } else {
          UI.setMessage('Not a valid target.', true)
        }
      } else {
        UI.setMessage('Tap a revealed enemy to grab.', true)
      }
      return
    }
    if (session.tap.telekineticThrowStep === 2) {
      const origin = session.tap.telekineticEnemyTile
        ? ctx.getActiveTileAt(session.tap.telekineticEnemyTile.row, session.tap.telekineticEnemyTile.col)
        : null
      if (!origin || !ctx.isTelekineticThrowEnemyTarget(origin)) {
        ctx.cancelTelekineticThrowMode()
        UI.setMessage('Telekinetic Throw — target no longer valid.', true)
        return
      }
      if (tile.row === origin.row && tile.col === origin.col) {
        UI.setMessage('Pick a different landing tile.', true)
        return
      }
      if (!ctx.isTelekineticThrowDestination(tile)) {
        UI.setMessage('Landing tile must be a revealed empty tile (no loot, chest, stairs, turret).', true)
        return
      }
      ctx.executeTelekineticThrow(origin, tile)
      return
    }
  }

  if (state === States.FLOOR_EXPLORE) {
    const floorCombatLocked = ctx.isCombatCommitmentLocked()
    const tileIsLivingEnemy = tile.revealed && tile.enemyData && !tile.enemyData._slain

    if (floorCombatLocked && !tileIsLivingEnemy) {
      // Sub-floor entry is always accessible regardless of combat lock
      if (tile.revealed && tile.type === 'sub_floor_entry' && tile.entryReady && !tile.subFloorVisited) {
        ctx.enterSubFloor(tile)
        return
      }
      if (tile.revealed && tile.type === 'war_banner' && tile.bannerReady && session.run.warBanner?.active) {
        ctx.destroyWarBanner(tile)
        return
      }
      // Chests and manuscripts are world interactions — allow while engaged.
      if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
        ctx.openChest(tile)
        return
      }
      if (tile.revealed && tile.type === 'manuscript' && tile.manuscriptReady && !tile.manuscriptCollected) {
        ctx.collectManuscript(tile)
        return
      }
      if (tile.revealed && tile.type === 'magic_chest' && tile.magicChestReady) {
        ctx.openMagicChest(tile)
        return
      }
      if (!tile.revealed && !tile.locked && tile.reachable) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      if (tile.revealed) {
        UI.setMessage(MSG_COMBAT_ACTION_BLOCKED, true)
        return
      }
      return
    }

    // Eagle Eye: one free flip to any unrevealed unlocked tile after a kill
    if (!session.tap.combatBusy && !tile.revealed && !tile.locked && session.run.player.eagleEyeFreeFlip) {
      session.run.player.eagleEyeFreeFlip = false
      ctx.revealTile(tile)
      return
    }
    if (!session.tap.combatBusy && !tile.revealed && !tile.locked && tile.reachable) {
      ctx.hapticFromUserGesture(15)
      ctx.revealTile(tile)
    } else if (tile.revealed && tile.type === 'chest' && tile.chestReady && !tile.chestLooted) {
      ctx.openChest(tile)
    } else if (tile.revealed && tile.type === 'magic_chest' && tile.magicChestReady) {
      ctx.openMagicChest(tile)
    } else if (tile.revealed && tile.type === 'forge') {
      ctx.openForge(tile)
    } else if (tile.revealed && tile.type === 'exit' && !tile.exitResolved) {
      ctx.confirmExit(tile)
    } else if (tile.revealed && tile.type === 'rope' && !tile.ropeResolved) {
      ctx.confirmRope(tile)
    } else if (tile.revealed && tile.type === 'merchant') {
      ctx.openSanctuaryMerchant(tile)
    } else if (tile.revealed && tile.type === 'manuscript' && tile.manuscriptReady && !tile.manuscriptCollected) {
      ctx.collectManuscript(tile)
    } else if (tile.revealed && tile.type === 'event' && !tile.eventResolved) {
      ctx.openEvent(tile)
    } else if (tile.revealed && tile.type === 'hole') {
      if (tile.deadlockEscape) ctx.climbThroughHazard(tile)
      else UI.setMessage('A gaping pit blocks the way. You cannot pass.')
    } else if (tile.revealed && tile.type === 'blockage') {
      if (tile.deadlockEscape) ctx.climbThroughHazard(tile)
      else UI.setMessage('A pile of rubble blocks the way. Find another path.')
    } else if (tile.revealed && tile.type === 'sub_floor_entry' && tile.entryReady && !tile.subFloorVisited) {
      ctx.enterSubFloor(tile)
    } else if (tile.revealed && tile.type === 'war_banner' && tile.bannerReady && session.run.warBanner?.active) {
      ctx.destroyWarBanner(tile)
    } else if (tile.revealed && tile.enemyData && tile.enemyData._slain && ctx.charKey() === 'necromancer') {
      // Necromancer: tap ash pile to raise a minion
      ctx.necroRaiseMinion(tile)
    } else if (tile.revealed && tile.enemyData && !tile.enemyData._slain) {
      // Archer / Mouse: only fightable once the player has revealed an adjacent tile
      if (tile.enemyData?.behaviour === 'archer' || tile.enemyData?.behaviour === 'mouse') {
        const neighbors = TileEngine.getOrthogonalTiles(tile.row, tile.col)
        if (!neighbors.some(n => n.revealed)) {
          const label = tile.enemyData.behaviour === 'mouse' ? 'The mouse scurries away — advance to engage.' : 'The archer is too far away — advance to engage.'
          UI.setMessage(label, true)
          return
        }
      }
      // Safety net: if session.tap.combatBusy has been stuck for >3s with no resolution, clear it
      if (session.tap.combatBusy && Date.now() - session.tap.combatBusySetAt > 3000) {
        console.warn('[GameController] session.tap.combatBusy stuck >3s — force-clearing')
        session.tap.combatBusy = false
      }
      if (!session.tap.combatBusy) ctx.fightAction(tile)
    }
  }
}

