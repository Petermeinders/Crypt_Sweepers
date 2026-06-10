/** Balance bot / test-bot bridge — wired from GameController with injected deps. */

/** Backpack items the balance bot may use without targeting toggles or special HUD flows. */
const BOT_SAFE_USE_EFFECT_TYPES = new Set([
  'rope-coil', 'bandage-roll', 'shield-shard', 'smelling-salts', 'sonic-ear', 'loose-pouch',
  'whetstone', 'heal', 'mana', 'field-kit', 'bone-dice', 'navigators-chart',
])

/** Balance bot: leave merchant / event UI without simulating clicks (closes session + returns to explore). */
export function balanceBotDismissNpcEvent(deps) {
  const { getRun, GameState, States, UI, TileEngine, closeEventSession, flushDeferredLevelUpXp } = deps
  const run = getRun()
  if (!GameState.is(States.NPC_INTERACT)) return false
  if (run?.eventTile) {
    closeEventSession(run.eventTile)
    return true
  }
  // No eventTile on run — mark any unresolved event tile on the grid so the bot doesn't re-tap it
  const grid = TileEngine.getGrid()
  if (grid) {
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed && t.type === 'event' && !t.eventResolved) {
          t.eventResolved = true
          t.element?.classList.remove('event-pending')
        }
      }
    }
  }
  UI.hideEventOverlays()
  if (!GameState.transition(States.FLOOR_EXPLORE)) GameState.set(States.FLOOR_EXPLORE)
  flushDeferredLevelUpXp()
  return true
}

export function getBalanceBotUseItemCandidates(deps) {
  const { getRun, GameState, States, ITEMS, getCombatBusy, flags } = deps
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return []
  if (flags.spellTargeting || flags.lanternTargeting || flags.spyglassTargeting) return []
  if (flags.engineerPendingTile) return []
  const inv = run.player.inventory ?? []
  const out = []
  for (const entry of inv) {
    if (!entry || entry.qty <= 0) continue
    const item = ITEMS[entry.id]
    if (!item?.effect) continue
    const { effect } = item
    if (effect.type.startsWith('passive-')) continue
    if (effect.type === 'smoke-bomb' || effect.type === 'flash-powder') {
      const ct = run.activeCombatTile
      if (!ct?.enemyData || ct.enemyData._slain) continue
    } else if (!BOT_SAFE_USE_EFFECT_TYPES.has(effect.type)) {
      continue
    }
    if (effect.type === 'heal' && run.player.hp >= run.player.maxHp) continue
    if (effect.type === 'mana' && run.player.mana >= run.player.maxMana) continue
    if (effect.type === 'field-kit' && run.player.mana < 5) continue
    if (effect.type === 'bone-dice' && run.player.mana < 10) continue
    if (effect.type === 'navigators-chart' && run.player.navigatorsChartUsed) continue
    out.push(entry.id)
  }
  return out
}

/** Revealed living enemy that is not spell-immune (Slam / Spell / Blinding Light). */
function _balanceBotHasSpellableEnemy(deps) {
  const { TileEngine } = deps
  const grid = TileEngine.getGrid()
  if (!grid) return false
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain && !t.enemyData.spellImmune) return true
    }
  }
  return false
}

/** Any revealed, living enemy (knife / poison shot / twin blades). */
function _balanceBotHasAnyLivingEnemy(deps) {
  const { TileEngine } = deps
  const grid = TileEngine.getGrid()
  if (!grid) return false
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed && t.enemyData && !t.enemyData._slain) return true
    }
  }
  return false
}

/**
 * Spell / blinding / item targeting modes that require an enemy tile become orphans when no valid
 * targets exist (e.g. abilities policy toggled Spell at run start). Clear them so the bot can flip tiles.
 */
function _balanceBotUnstickOrphanTargeting(deps) {
  const {
    getRun, GameState, States, UI, WARRIOR_UPGRADES, getCombatBusy, flags,
    previewSpellManaCostForUi, stillWaterManaCost, tearyExtraCost,
    divineLightHealAction, cancelPoisonArrowShotMode,
  } = deps
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return

  const hasSpellable = _balanceBotHasSpellableEnemy(deps)
  const hasAnyEnemy = _balanceBotHasAnyLivingEnemy(deps)

  if (flags.spellTargeting && !hasSpellable) {
    flags.spellTargeting = false
    const effectiveCost = previewSpellManaCostForUi()
    UI.setSpellTargeting(false, effectiveCost)
  }
  if (flags.blindingLightTargeting && !hasSpellable) {
    flags.blindingLightTargeting = false
    UI.setBlindingLightActive(false)
  }
  if (flags.divineLightSelecting && !hasSpellable) {
    if (run.player.hp < run.player.maxHp) {
      const cost = stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + tearyExtraCost())
      if (run.player.mana >= cost) {
        divineLightHealAction()
      } else {
        flags.divineLightSelecting = false
        UI.setDivineLightActive(false)
      }
    } else {
      flags.divineLightSelecting = false
      UI.setDivineLightActive(false)
    }
  }
  if ((flags.throwingKnifeTargeting || flags.twinBladesTargeting || flags.rustyNailTargeting) && !hasAnyEnemy) {
    flags.throwingKnifeTargeting = false
    flags.twinBladesTargeting = false
    flags.rustyNailTargeting = false
    UI.setMessage('')
  }
  if (flags.poisonArrowShotSelecting && !hasAnyEnemy) {
    cancelPoisonArrowShotMode()
  }
}

/**
 * While combat commitment is active, only the focused enemy tile produces progress on tap
 * (matches onTileTap + _canAttackEnemy). Returns null when not locked.
 */
function _balanceBotFocusedEnemyCandidatesIfCombatLocked(deps) {
  const { getActiveTileAt, getCombatEngagementTile, isCombatCommitmentLocked } = deps
  if (!isCombatCommitmentLocked()) return null
  const engagement = getCombatEngagementTile()
  const t = engagement && getActiveTileAt(engagement.row, engagement.col)
  if (t?.revealed && t.enemyData && !t.enemyData._slain) {
    return [{ row: t.row, col: t.col }]
  }
  return []
}

/**
 * Balance bot: legal taps — targeting modes, chests, reachable tiles, enemies,
 * and progression tiles (exit / event / rope / forge) so a cleared floor still has candidates.
 * Spell / lantern / spyglass / ricochet / volley / engineer construct are handled here so the bot does not stall.
 */
export function getBalanceBotTapCandidates(deps) {
  const {
    getRun, GameState, States, TileEngine, getCombatBusy, flags, charKey,
    isCombatCommitmentLocked, getRicochetTiles, getTripleVolleyCenter,
  } = deps
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return []
  _balanceBotUnstickOrphanTargeting(deps)
  const grid = TileEngine.getGrid()
  if (!grid) return []

  const revealedEnemies = () => {
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed && t.enemyData && !t.enemyData._slain) {
          out.push({ row: t.row, col: t.col })
        }
      }
    }
    return out
  }

  if (flags.spellTargeting) {
    const foc = _balanceBotFocusedEnemyCandidatesIfCombatLocked(deps)
    if (foc !== null) return foc
    return revealedEnemies()
  }

  if (flags.lanternTargeting || flags.spyglassTargeting) {
    if (isCombatCommitmentLocked()) return []
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed && !t.locked) out.push({ row: t.row, col: t.col })
      }
    }
    return out
  }

  if (flags.throwingKnifeTargeting || flags.twinBladesTargeting || flags.rustyNailTargeting ||
      flags.blindingLightTargeting || flags.divineLightSelecting || flags.poisonArrowShotSelecting) {
    const foc = _balanceBotFocusedEnemyCandidatesIfCombatLocked(deps)
    if (foc !== null) return foc
    return revealedEnemies()
  }

  if (flags.ricochetSelecting) {
    const ricochetTiles = getRicochetTiles()
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed || !t.enemyData || t.enemyData._slain) continue
        const marked = ricochetTiles.some(x => x.row === t.row && x.col === t.col)
        if (!marked && ricochetTiles.length < 3) out.push({ row: t.row, col: t.col })
      }
    }
    return out.length ? out : revealedEnemies()
  }

  if (flags.arrowBarrageSelecting) {
    const tripleVolleyCenter = getTripleVolleyCenter()
    if (tripleVolleyCenter) {
      return [{ row: tripleVolleyCenter.row, col: tripleVolleyCenter.col }]
    }
    const out = []
    for (const row of grid) {
      for (const t of row) {
        if (t.revealed) out.push({ row: t.row, col: t.col })
      }
    }
    return out
  }

  if (isCombatCommitmentLocked()) {
    const focusedOnly = _balanceBotFocusedEnemyCandidatesIfCombatLocked(deps) ?? []
    if (charKey() === 'engineer') {
      const merged = [...focusedOnly]
      const seen = new Set(merged.map((c) => `${c.row},${c.col}`))
      const tr = run.turret
      for (const row of grid) {
        for (const tile of row) {
          const onTurret = tr && tile.row === tr.row && tile.col === tr.col
          const emptyBuild = tile.revealed && tile.type === 'empty' && !tile.locked
          if (onTurret || emptyBuild) {
            const k = `${tile.row},${tile.col}`
            if (!seen.has(k)) {
              seen.add(k)
              merged.push({ row: tile.row, col: tile.col })
            }
          }
        }
      }
      if (merged.length) return merged
    }
    return focusedOnly
  }

  const out = []
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked && (t.reachable || run.player.eagleEyeFreeFlip)) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.enemyData && !t.enemyData._slain) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'chest' && t.chestReady && !t.chestLooted) {
        out.push({ row: t.row, col: t.col })
      }
      // Magic chest with 0 keys only shows UI message — no state change, so exclude or the bot loops forever.
      if (t.revealed && t.type === 'magic_chest' && t.magicChestReady && (run.player.goldenKeys ?? 0) > 0) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'exit' && !t.exitResolved) {
        // During sanctuary: hold off tapping exit until every other tile is revealed
        if (!run.atRest) {
          out.push({ row: t.row, col: t.col })
        }
      }
      if (t.revealed && t.type === 'event' && !t.eventResolved) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'rope' && !t.ropeResolved) {
        out.push({ row: t.row, col: t.col })
      }
      if (t.revealed && t.type === 'forge' && !t.forgeUsed) {
        out.push({ row: t.row, col: t.col })
      }
    }
  }
  // Sanctuary exit: only add once all tiles are revealed (bot must explore every tile first)
  if (run.atRest) {
    let allRevealed = true
    let exitTile = null
    for (const row of grid) {
      for (const t of row) {
        if (!t.revealed) { allRevealed = false }
        if (t.revealed && t.type === 'exit' && !t.exitResolved) { exitTile = t }
      }
    }
    if (allRevealed && exitTile) {
      out.push({ row: exitTile.row, col: exitTile.col })
    }
  }
  return out
}

/**
 * When there are no tap candidates but hidden, non-locked tiles still exist, they may be unreachable by
 * normal adjacency — lantern/spyglass can target any such tile. Opens lantern (preferred) or spyglass mode.
 */
export function balanceBotTryOpenRevealTool(deps) {
  const {
    getRun, GameState, States, TileEngine, getCombatBusy, flags,
    isCombatCommitmentLocked, lanternAction, spyglassAction,
  } = deps
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return false
  if (isCombatCommitmentLocked()) return false
  if (flags.spellTargeting || flags.lanternTargeting || flags.spyglassTargeting) return false
  if (flags.ricochetSelecting || flags.arrowBarrageSelecting || flags.poisonArrowShotSelecting) return false
  if (flags.throwingKnifeTargeting || flags.twinBladesTargeting || flags.rustyNailTargeting) return false
  if (flags.blindingLightTargeting || flags.divineLightSelecting) return false
  if (flags.engineerPendingTile) return false

  const grid = TileEngine.getGrid()
  if (!grid) return false
  let hasHiddenUnlocked = false
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked) {
        hasHiddenUnlocked = true
        break
      }
    }
    if (hasHiddenUnlocked) break
  }
  if (!hasHiddenUnlocked) return false

  const inv = run.player.inventory ?? []
  const hasLantern = inv.some(e => e?.id === 'lantern' && e.qty > 0)
  const hasSpy = inv.some(e => e?.id === 'spyglass' && e.qty > 0)
  if (hasLantern) {
    lanternAction()
    return true
  }
  if (hasSpy) {
    spyglassAction()
    return true
  }
  return false
}

export function getBalanceBotDiagnostics(deps) {
  const {
    getRun, GameState, getCombatBusy, flags, charKey, playerDamageRange,
    isCombatCommitmentLocked, getCombatEngagementTile,
  } = deps
  const run = getRun()
  const tap = getBalanceBotTapCandidates(deps)
  const use = getBalanceBotUseItemCandidates(deps)
  const targeting = []
  if (flags.spellTargeting) targeting.push('spell')
  if (flags.lanternTargeting) targeting.push('lantern')
  if (flags.spyglassTargeting) targeting.push('spyglass')
  if (flags.blindingLightTargeting) targeting.push('blindingLight')
  if (flags.divineLightSelecting) targeting.push('divineLight')
  if (flags.ricochetSelecting) targeting.push('ricochet')
  if (flags.arrowBarrageSelecting) targeting.push('arrowBarrage')
  if (flags.tripleVolleyCenter) targeting.push('volleyConfirm')
  if (flags.poisonArrowShotSelecting) targeting.push('poisonArrow')
  if (flags.engineerPendingTile) targeting.push('engineerConstruct')
  if (flags.throwingKnifeTargeting) targeting.push('throwingKnife')
  if (flags.twinBladesTargeting) targeting.push('twinBlades')
  if (flags.rustyNailTargeting) targeting.push('rustyNail')
  return {
    gameState: GameState.current(),
    combatBusy: getCombatBusy(),
    combatLocked: isCombatCommitmentLocked(),
    combatEngagement: getCombatEngagementTile() ? { ...getCombatEngagementTile() } : null,
    runActive: !!run,
    floor: run?.floor ?? null,
    tilesRevealed: run?.tilesRevealed ?? null,
    tapCandidates: tap.length,
    useItemCandidates: use.length,
    targeting: targeting.length ? targeting.join('+') : null,
    hp: run?.player?.hp ?? null,
    maxHp: run?.player?.maxHp ?? null,
    mana: run?.player?.mana ?? null,
    maxMana: run?.player?.maxMana ?? null,
    meleeDmg: run?.player ? playerDamageRange(run.player)[0] : null,
    hero: charKey() ?? null,
  }
}

/** Grid stats when the bot has zero tap candidates (deadlock analysis). */
export function getBalanceBotDeadlockDiagnostics(deps) {
  const { getRun, GameState, TileEngine, getCombatBusy } = deps
  const run = getRun()
  const grid = TileEngine.getGrid()
  if (!grid) return { error: 'no_grid' }
  let locked = 0
  let unrevealedUnlocked = 0
  let unrevealedReachable = 0
  let revealed = 0
  let livingEnemies = 0
  for (const row of grid) {
    for (const t of row) {
      if (t.revealed) {
        revealed++
        if (t.enemyData && !t.enemyData._slain) livingEnemies++
      } else if (t.locked) {
        locked++
      } else {
        unrevealedUnlocked++
        if (t.reachable) unrevealedReachable++
      }
    }
  }
  return {
    floor: run?.floor ?? null,
    atRest: !!run?.atRest,
    tilesRevealed: run?.tilesRevealed ?? null,
    locked,
    unrevealedUnlocked,
    unrevealedReachable,
    revealed,
    livingEnemies,
    combatBusy: getCombatBusy(),
    gameState: GameState.current(),
  }
}

/** Force-recompute tile reachability from all currently-revealed tiles. Fixes stale flags. */
export function balanceBotRepairReachability(deps) {
  const { getRun, TileEngine, markReachableUi } = deps
  if (!getRun()) return false
  TileEngine.recomputeReachabilityFromRevealed(markReachableUi)
  return true
}

/**
 * Softlock recovery: clear ALL tile locks (red X's) not justified by a living enemy,
 * then rebuild reachability. Returns count of now-available unrevealed tiles.
 */
export function balanceBotForceUnlockAll(deps) {
  const { getRun, TileEngine, UI, markReachableUi } = deps
  if (!getRun()) return 0
  TileEngine.recomputeAllEnemyLocks(UI.lockTile.bind(UI), UI.unlockTile.bind(UI))
  TileEngine.recomputeReachabilityFromRevealed(markReachableUi)
  const grid = TileEngine.getGrid()
  let unlocked = 0
  for (const row of grid) {
    for (const t of row) {
      if (!t.revealed && !t.locked) unlocked++
    }
  }
  return unlocked
}

function _weightedAbilityPick(weights, ids) {
  let sum = 0
  for (const id of ids) sum += Math.max(0, weights[id] ?? 0)
  if (sum <= 0) return null
  let r = Math.random() * sum
  for (const id of ids) {
    const w = Math.max(0, weights[id] ?? 0)
    r -= w
    if (r <= 0) return id
  }
  return ids[ids.length - 1]
}

/**
 * Balance bot: when policy uses abilities, try a weighted warrior action (Slam / Blinding / Spell / Divine).
 * Returns true if an action was started (including targeting toggles); false to fall back to tile taps.
 */
export function balanceBotTryWarriorAbilities(deps, abilityWeights = {}) {
  const {
    getRun, getSave, GameState, States, WARRIOR_UPGRADES, getCombatBusy, flags, charKey,
    stillWaterManaCost, tearyExtraCost, previewSpellManaCostForUi,
    slamAction, blindingLightAction, spellAction, divineLightAction,
  } = deps
  const w = {
    slam: 4,
    'blinding-light': 2,
    spell: 2,
    'divine-light': 1,
    ...abilityWeights,
  }
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return false
  if (flags.spellTargeting || flags.lanternTargeting || flags.spyglassTargeting) return false
  if (flags.blindingLightTargeting || flags.divineLightSelecting) return false
  if (flags.ricochetSelecting || flags.arrowBarrageSelecting || flags.poisonArrowShotSelecting) return false
  if (flags.throwingKnifeTargeting || flags.twinBladesTargeting || flags.rustyNailTargeting) return false
  if (flags.engineerPendingTile) return false
  if (charKey() !== 'warrior') return false

  const upgrades = getSave().warrior?.upgrades ?? []
  const candidates = []
  const push = (id) => {
    if ((w[id] ?? 0) <= 0) return
    candidates.push(id)
  }
  const hasSpellTgt = _balanceBotHasSpellableEnemy(deps)
  const slamCost = stillWaterManaCost(WARRIOR_UPGRADES.slam.manaCost)
  if (upgrades.includes('slam') && run.player.mana >= slamCost && hasSpellTgt) push('slam')
  const blindCost = stillWaterManaCost(WARRIOR_UPGRADES['blinding-light'].manaCost + tearyExtraCost())
  if (upgrades.includes('blinding-light') && run.player.mana >= blindCost && hasSpellTgt) push('blinding-light')
  const spellCost = previewSpellManaCostForUi()
  if (run.player.mana >= spellCost && hasSpellTgt) push('spell')
  const divineCost = stillWaterManaCost(WARRIOR_UPGRADES['divine-light'].manaCost + tearyExtraCost())
  if (upgrades.includes('divine-light') && run.player.mana >= divineCost) {
    if (hasSpellTgt || run.player.hp < run.player.maxHp) push('divine-light')
  }
  if (candidates.length === 0) return false

  const pick = _weightedAbilityPick(w, candidates)
  if (!pick) return false

  const mana0 = run.player.mana
  if (pick === 'slam') {
    slamAction()
    return run.player.mana < mana0 || getCombatBusy()
  }
  if (pick === 'blinding-light') {
    blindingLightAction()
    return flags.blindingLightTargeting
  }
  if (pick === 'spell') {
    spellAction()
    return flags.spellTargeting
  }
  if (pick === 'divine-light') {
    divineLightAction()
    return flags.divineLightSelecting
  }
  return false
}

/** Ranger / engineer: open spell targeting when mana allows (abilities policy fallback). */
export function balanceBotTryGenericSpellAbility(deps) {
  const {
    getRun, GameState, States, getCombatBusy, flags,
    previewSpellManaCostForUi, spellAction,
  } = deps
  const run = getRun()
  if (!run || !GameState.is(States.FLOOR_EXPLORE) || getCombatBusy()) return false
  if (flags.spellTargeting || flags.lanternTargeting || flags.spyglassTargeting) return false
  if (flags.ricochetSelecting || flags.arrowBarrageSelecting || flags.poisonArrowShotSelecting) return false
  if (flags.throwingKnifeTargeting || flags.twinBladesTargeting || flags.rustyNailTargeting) return false
  if (flags.engineerPendingTile) return false
  if (run.player.mana < previewSpellManaCostForUi()) return false
  if (!_balanceBotHasSpellableEnemy(deps)) return false
  spellAction()
  return flags.spellTargeting
}

export function balanceBotTryAbilitiesPolicy(deps, abilityWeights = {}) {
  if (deps.charKey() === 'warrior') return balanceBotTryWarriorAbilities(deps, abilityWeights)
  return balanceBotTryGenericSpellAbility(deps)
}
