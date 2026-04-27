/**
 * In-browser balance bot: random legal taps, chests (priority), backpack items (safe consumables),
 * optional abilities policy (warrior: Slam / Blinding / Spell / Divine; others: spell), weighted level-ups.
 * Enable with URL: ?balanceBot=1&runs=20&policy=abilities&levelUpWeights=...&abilityWeights=...
 * Results: window.__balanceBotRuns, window.__balanceBotReport (when complete), auto-download JSON.
 *
 * Logging tags (console):
 *   [bot:tick]      — per-tick branch (verbose, only at key transitions)
 *   [bot:tap]       — tile chosen to tap (type, row, col)
 *   [bot:levelup]   — ability chosen at level-up
 *   [bot:stuck]     — stuckNoTapTicks milestones and repair attempts
 *   [bot:run]       — run start / end summaries
 */
import GameController from '../core/GameController.js'
import GameState, { States } from '../core/GameState.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { applyTestBotOngoingMetaPurchases } from './testBotOngoingMeta.js'

let intervalId = null
let runsTarget = 1
let runsCompleted = 0
const runRecords = []
let handledSummary = false

/** Ticks (×80ms) with floor-explore, no combat, and zero tap candidates — map deadlock escape. */
let stuckNoTapTicks = 0
/** Whether we've already tried a reachability repair on this stuck streak. */
let reachabilityRepaired = false
/** Run-summary visible but telemetry not finalized (stale overlay) — recover instead of spinning forever. */
let invalidSummaryTicks = 0
/** Consecutive ticks stuck in modal_wait — force-nuke all overlays after threshold. */
let modalWaitTicks = 0
/** Consecutive ticks where combatBusy=true with no candidates — force-clear after threshold. */
let combatBusyTicks = 0
/** While run-summary is visible after we already clicked try-once — retry if the menu did not open (headless flake). */
let summaryStuckTicks = 0
/** Tracks the last floor we logged a floor-enter for (avoids duplicate logs). */
let _loggedFloor = -1
/**
 * Set true when the bot deliberately opens the retreat menu (deadlock exit).
 * Prevents _tryDismissFloorExploreBlockingUi from cancelling our own retreat.
 */
let _botRetreatPending = false

/** @type {{ policy?: string, preset?: string, levelUpWeights?: Record<string, number>, abilityWeights?: Record<string, number>, testBotOngoing?: boolean }} */
let autopilotOpts = {}

function _tryClickRetreatConfirm() {
  const confirm = document.getElementById('retreat-confirm')
  if (!confirm || confirm.classList.contains('hidden')) return false
  document.getElementById('retreat-confirm-yes')?.click()
  return true
}

function _tryClickRetreatButton() {
  const btn = document.getElementById('retreat-btn')
  if (!btn || btn.classList.contains('hidden')) return false
  btn.click()
  return true
}

/**
 * Storyteller events use #story-event-overlay.panel-overlay. _blockingModalOpen() treats any
 * visible .panel-overlay as blocking, so we must click choices / Continue here before modal_wait
 * or the bot stalls forever during npc-interact.
 */
function _tryStoryEventBot() {
  const ov = document.getElementById('story-event-overlay')
  if (!ov || ov.classList.contains('hidden')) return false
  const choiceBtns = ov.querySelectorAll('#story-event-choices .story-choice-btn')
  if (choiceBtns.length > 0) {
    choiceBtns[Math.floor(Math.random() * choiceBtns.length)].click()
    return true
  }
  const cont = document.getElementById('story-event-continue')
  if (cont && !cont.classList.contains('hidden')) {
    cont.click()
    return true
  }
  return false
}

/**
 * Trinket / creature codex "first find" cards (#trinket-discovery-ok, #bestiary-discovery-ok).
 * Must run before the LEVEL_UP branch: XP can transition to LEVEL_UP while this overlay is still open,
 * and the old tick order never called _tryDismissFloorExploreBlockingUi() in that case.
 */
function _tryDismissDiscoveryCards() {
  const trinketDiscover = document.getElementById('trinket-discovery-overlay')
  if (
    trinketDiscover &&
    (!trinketDiscover.classList.contains('hidden') ||
      document.body.classList.contains('trinket-discovery-open'))
  ) {
    document.getElementById('trinket-discovery-ok')?.click()
    return true
  }
  const bestiaryDiscover = document.getElementById('bestiary-discovery-overlay')
  if (
    bestiaryDiscover &&
    (!bestiaryDiscover.classList.contains('hidden') ||
      document.body.classList.contains('bestiary-discovery-open'))
  ) {
    document.getElementById('bestiary-discovery-ok')?.click()
    return true
  }
  return false
}

/**
 * Modals that block the bot while GameState is still floor-explore (retreat banner, trap/rope dialogs).
 * Without this we hit modal_wait forever with tap>0 because stuckNoTapTicks only runs when cands=0.
 */
function _tryDismissFloorExploreBlockingUi() {
  // If the bot deliberately opened the retreat menu, do NOT cancel it.
  // The tick loop will confirm it via _tryClickRetreatConfirm() instead.
  if (!_botRetreatPending) {
    const rc = document.getElementById('retreat-confirm')
    if (rc && !rc.classList.contains('hidden')) {
      document.getElementById('retreat-confirm-no')?.click()
      console.log('[bot:tick] dismissed accidental retreat-confirm')
      return true
    }
  }
  const trap = document.getElementById('trap-modal-overlay')
  if (trap && !trap.classList.contains('hidden')) {
    document.getElementById('trap-modal-ok')?.click()
    return true
  }
  const introOverlay = document.getElementById('first-run-intro-overlay')
  if (introOverlay && !introOverlay.classList.contains('hidden')) {
    document.getElementById('first-run-intro-ok')?.click()
    return true
  }
  const rope = document.getElementById('rope-modal-overlay')
  if (rope && !rope.classList.contains('hidden')) {
    document.getElementById('rope-modal-cancel')?.click()
    return true
  }

  if (_tryDismissDiscoveryCards()) return true

  if (document.getElementById('info-card-overlay')?.classList.contains('visible')) {
    UI.hideInfoCard()
    return true
  }

  const forge = document.getElementById('forge-overlay')
  if (forge && !forge.classList.contains('hidden')) {
    ;(document.getElementById('forge-leave-btn') || document.getElementById('forge-leave-btn-top'))?.click()
    return true
  }

  const lv = document.getElementById('level-up-overlay')
  if (lv?.classList.contains('visible') && GameState.current() !== States.LEVEL_UP) {
    UI.hideLevelUpOverlay()
    return true
  }

  const bp = document.getElementById('backpack-overlay')
  if (bp?.classList.contains('is-open')) {
    bp.classList.remove('is-open')
    bp.setAttribute('aria-hidden', 'true')
    document.getElementById('hud-backpack-btn')?.setAttribute('aria-expanded', 'false')
    return true
  }

  const slam = document.getElementById('slam-overlay')
  if (slam && !slam.classList.contains('hidden')) {
    slam.classList.add('hidden')
    return true
  }

  // Story / merchant / etc.: prefer real clicks when possible
  if (_tryStoryEventBot()) return true

  // Merchant: just leave
  const merchant = document.getElementById('merchant-shop-overlay')
  if (merchant && !merchant.classList.contains('hidden')) {
    document.getElementById('merchant-shop-leave')?.click()
    return true
  }

  // Gambler: walk away / roll / continue depending on phase
  const gambler = document.getElementById('gambler-overlay')
  if (gambler && !gambler.classList.contains('hidden')) {
    const outcomeOk = document.getElementById('gambler-outcome-ok')
    if (outcomeOk && !outcomeOk.closest('.gambler-phase')?.classList.contains('hidden')) {
      outcomeOk.click(); return true
    }
    const rollBtn = document.getElementById('gambler-roll-btn')
    if (rollBtn && !rollBtn.closest('.gambler-phase')?.classList.contains('hidden')) {
      rollBtn.click(); return true
    }
    document.getElementById('gambler-walk-away')?.click()
    return true
  }

  // Triple chest / trinket trader: leave
  const tripleChest = document.getElementById('triple-chest-overlay')
  if (tripleChest && !tripleChest.classList.contains('hidden')) {
    document.getElementById('triple-chest-leave')?.click()
    return true
  }
  const trinketTrader = document.getElementById('trinket-trader-overlay')
  if (trinketTrader && !trinketTrader.classList.contains('hidden')) {
    trinketTrader.querySelector('.menu-btn.secondary')?.click()
    return true
  }

  // Backpack full — item pending replace/trash: always trash so the bot doesn't stall
  const pendingBar = document.getElementById('backpack-pending-bar')
  if (pendingBar && !pendingBar.classList.contains('hidden')) {
    console.log('[bot:dismiss] trashing pending backpack item')
    document.getElementById('backpack-pending-trash')?.click()
    return true
  }

  // Bestiary / trinket detail overlays (tapped from codex): close them
  const bestiaryDetail = document.getElementById('bestiary-detail-overlay')
  if (bestiaryDetail && !bestiaryDetail.classList.contains('hidden')) {
    bestiaryDetail.querySelector('.close-btn, .overlay-close, [data-close]')?.click()
    bestiaryDetail.classList.add('hidden')
    return true
  }
  const trinketDetail = document.getElementById('trinket-detail-overlay')
  if (trinketDetail && !trinketDetail.classList.contains('hidden')) {
    trinketDetail.querySelector('.close-btn, .overlay-close, [data-close]')?.click()
    trinketDetail.classList.add('hidden')
    return true
  }

  // Remaining menus / forge / NPC panels (headless can leave DOM up without matching GameState)
  for (const el of document.querySelectorAll('.panel-overlay:not(.hidden)')) {
    el.classList.add('hidden')
    return true
  }
  for (const el of document.querySelectorAll('.event-overlay:not(.hidden)')) {
    el.classList.add('hidden')
    return true
  }

  return false
}

function _mean(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function _pickWeightedLevelUp() {
  const weights = autopilotOpts.levelUpWeights
  const cards = document.querySelectorAll('#level-up-overlay .ability-card')
  if (!cards.length) return false
  const entries = [...cards].map(el => {
    const id = el.dataset.abilityId || ''
    return { el, id, w: Math.max(0, weights?.[id] ?? 1) }
  })
  let sum = entries.reduce((s, e) => s + e.w, 0)
  let chosen
  if (sum <= 0) {
    chosen = entries[0]
  } else {
    let r = Math.random() * sum
    chosen = entries[entries.length - 1]
    for (const e of entries) {
      r -= e.w
      if (r <= 0) { chosen = e; break }
    }
  }
  const offered = entries.map(e => `${e.id}(w=${e.w})`).join(', ')
  console.log(`[bot:levelup] picked=${chosen.id} weight=${chosen.w} | offered: ${offered}`)
  chosen.el.click()
  return true
}

function _finalizeAggregateReport() {
  const byOutcome = {}
  const floors = []
  const levels = []
  const tiles = []
  for (const r of runRecords) {
    const o = r.telemetry?.outcome?.type ?? 'unknown'
    byOutcome[o] = (byOutcome[o] ?? 0) + 1
    const rs = r.telemetry?.outcome?.runStats ?? r.runStats
    if (rs) {
      floors.push(rs.floor)
      levels.push(rs.level)
      tiles.push(rs.tilesRevealed)
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    runsTarget,
    runsRecorded: runRecords.length,
    byOutcome,
    aggregate: {
      floorAtEnd: floors.length
        ? { min: Math.min(...floors), max: Math.max(...floors), mean: _mean(floors) }
        : null,
      levelAtEnd: levels.length
        ? { min: Math.min(...levels), max: Math.max(...levels), mean: _mean(levels) }
        : null,
      tilesRevealed: tiles.length
        ? { min: Math.min(...tiles), max: Math.max(...tiles), mean: _mean(tiles) }
        : null,
    },
    runsDetail: runRecords,
  }
  if (autopilotOpts.testBotOngoing) {
    const s = GameController.getSave()
    if (s) {
      report.metaAfterRuns = {
        persistentGold: s.persistentGold,
        selectedCharacter: s.selectedCharacter,
        globalPassives: [...(s.globalPassives ?? [])],
        warrior: { totalXP: s.warrior?.totalXP ?? 0, upgrades: [...(s.warrior?.upgrades ?? [])] },
        ranger: {
          unlocked: !!s.ranger?.unlocked,
          totalXP: s.ranger?.totalXP ?? 0,
          upgrades: [...(s.ranger?.upgrades ?? [])],
        },
        engineer: { totalXP: s.engineer?.totalXP ?? 0, upgrades: [...(s.engineer?.upgrades ?? [])] },
        vampire: { totalXP: s.vampire?.totalXP ?? 0, upgrades: [...(s.vampire?.upgrades ?? [])] },
      }
    }
  }
  window.__balanceBotReport = report
  console.log('[bot:run] ALL RUNS COMPLETE', report.byOutcome, report.aggregate)

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `balance-bot-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

function _tileTypeLabel(t) {
  if (!t) return 'unknown'
  if (!t.revealed) return `unrevealed(${t.type})`
  if (t.enemyData && !t.enemyData._slain) return `enemy(${t.enemyData.enemyId ?? t.type})`
  return t.type
}

/**
 * Hero-aware tap selection. Priority order:
 *  1. Archers (all heroes) — silence them first to stop the harass chip
 *  2. Chests
 *  3. Kill-Echo-marked hidden tiles (Paladin)
 *  4. Dark-Eyes-hinted hidden tiles (Vampire — known enemy positions to reveal as "batteries")
 *  5. Everything else
 *
 * Vampire special: when HP > 25%, avoid tapping revealed living enemies (keep them as battery).
 * Prefer revealing new enemies instead so Corrupted Blood heals more per flip.
 */
function _performRandomTapFromCandidates(cands, floor, logTag = '[bot:tap]', heroOverride = null) {
  const diag = GameController.getBalanceBotDiagnostics()
  const hero = heroOverride ?? diag.hero ?? null
  const hpRatio = (diag.hp ?? 1) / (diag.maxHp ?? 1)
  // When commitment-locked to a fight, skip all special priorities — just resolve the combat
  const locked = diag.combatLocked

  const archerPicks   = []
  const chestPicks    = []
  const echoPicks     = []
  const darkEyePicks  = []
  const enemyPicks    = []

  for (const c of cands) {
    const t = TileEngine.getTile(c.row, c.col)
    if (!t) continue

    if (t.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.behaviour === 'archer') {
      // Only prioritize archers that can actually be engaged (have at least one revealed neighbor)
      const nbrs = TileEngine.getOrthogonalTiles(t.row, t.col)
      if (nbrs.some(n => n.revealed)) {
        archerPicks.push(c)
      } else {
        enemyPicks.push(c)  // treat as a regular enemy — will be reached organically
      }
    } else if ((t.type === 'chest' && t.chestReady && !t.chestLooted) || (t.type === 'magic_chest' && t.magicChestReady)) {
      chestPicks.push(c)
    } else if (!t.revealed && (t.killEchoMarked || t.senseEvilMarked)) {
      echoPicks.push(c)
    } else if (!t.revealed && t.darkEyesHint) {
      darkEyePicks.push(c)
    } else if (t.revealed && t.enemyData && !t.enemyData._slain) {
      enemyPicks.push(c)
    }
  }

  // Vampire: when HP is stable, filter out direct combat tiles — revealed enemies are "batteries"
  let pool
  if (locked) {
    // Commitment-locked: only fight revealed enemies (resolve the current engagement)
    pool = enemyPicks.length > 0 ? enemyPicks : cands
  } else if (hero === 'vampire' && hpRatio > 0.25) {
    const nonCombat = cands.filter(c => {
      const t = TileEngine.getTile(c.row, c.col)
      return !(t?.revealed && t.enemyData && !t.enemyData._slain && t.enemyData.behaviour !== 'archer')
    })
    pool = archerPicks.length > 0 ? archerPicks
         : chestPicks.length  > 0 ? chestPicks
         : darkEyePicks.length > 0 ? darkEyePicks
         : nonCombat.length   > 0 ? nonCombat
         : cands
  } else {
    pool = archerPicks.length  > 0 ? archerPicks
         : chestPicks.length   > 0 ? chestPicks
         : hero === 'warrior' && echoPicks.length > 0 ? echoPicks
         : cands
  }

  const pick = pool[Math.floor(Math.random() * pool.length)]
  const t = TileEngine.getTile(pick.row, pick.col)
  const poolLabel = pool === archerPicks  ? 'archer'
                  : pool === chestPicks   ? 'chest'
                  : pool === echoPicks    ? 'echo'
                  : pool === darkEyePicks ? 'darkEye'
                  : 'all'
  console.log(`${logTag} floor=${floor} tapping ${_tileTypeLabel(t)} at [${pick.row},${pick.col}] (pool=${poolLabel}, cands=${cands.length}, enemies=${enemyPicks.length})`)
  GameController.onTileTap(pick.row, pick.col)
}

/** True while a blocking popover/modal is open — wait for the player (or tap outside) to dismiss. */
function _blockingModalOpen() {
  const shown = (el) => el && !el.classList.contains('hidden')

  if (document.getElementById('info-card-overlay')?.classList.contains('visible')) {
    console.log('[bot:modal] blocked by info-card-overlay')
    return true
  }
  if (shown(document.getElementById('trap-modal-overlay'))) {
    console.log('[bot:modal] blocked by trap-modal-overlay')
    return true
  }
  if (shown(document.getElementById('rope-modal-overlay'))) {
    console.log('[bot:modal] blocked by rope-modal-overlay')
    return true
  }

  // If the bot itself opened retreat, the retreat-confirm is intentional — don't block on it.
  if (!_botRetreatPending && shown(document.getElementById('retreat-confirm'))) {
    console.log('[bot:modal] blocked by retreat-confirm (unexpected)')
    return true
  }

  for (const el of document.querySelectorAll('.panel-overlay')) {
    if (!el.classList.contains('hidden')) {
      console.log(`[bot:modal] blocked by panel-overlay id=${el.id || '(no-id)'} classes="${el.className}"`)
      return true
    }
  }
  for (const el of document.querySelectorAll('.event-overlay')) {
    if (!el.classList.contains('hidden')) {
      console.log(`[bot:modal] blocked by event-overlay id=${el.id || '(no-id)'}`)
      return true
    }
  }

  for (const id of [
    'bestiary-discovery-overlay',
    'bestiary-detail-overlay',
    'trinket-discovery-overlay',
    'trinket-detail-overlay',
  ]) {
    if (shown(document.getElementById(id))) {
      console.log(`[bot:modal] blocked by ${id}`)
      return true
    }
  }

  const bp = document.getElementById('backpack-overlay')
  if (bp?.classList.contains('is-open')) {
    console.log('[bot:modal] blocked by backpack-overlay')
    return true
  }
  const pending = document.getElementById('backpack-pending-bar')
  if (pending && !pending.classList.contains('hidden')) {
    console.log('[bot:modal] blocked by backpack-pending-bar')
    return true
  }

  const heroSel = document.getElementById('hero-select-overlay')
  if (heroSel && !heroSel.classList.contains('hidden')) {
    console.log('[bot:modal] blocked by hero-select-overlay')
    return true
  }

  const slam = document.getElementById('slam-overlay')
  if (slam && !slam.classList.contains('hidden')) {
    console.log('[bot:modal] blocked by slam-overlay')
    return true
  }

  const lv = document.getElementById('level-up-overlay')
  if (lv?.classList.contains('visible') && GameState.current() !== States.LEVEL_UP) {
    console.log('[bot:modal] blocked by level-up-overlay (state mismatch)')
    return true
  }

  return false
}

function tick() {
  /** Which autopilot branch ran this tick — set before every return; flushed in `finally` so debug matches reality. */
  let lastBranch = 'init'
  try {
    // External command from the Playwright batch script (e.g. stuck recovery)
    if (window.__balanceBotCommand) {
      const cmd = window.__balanceBotCommand
      window.__balanceBotCommand = null
      if (cmd === 'retreat') {
        console.warn('[bot:tick] external retreat command received — force-retreating run')
        GameController.doRetreat('balance-bot-stuck')
        lastBranch = 'external_retreat'
        return
      }
    }

    const ro = document.getElementById('resume-overlay')
    if (ro && !ro.classList.contains('hidden')) {
      lastBranch = 'resume'
      document.getElementById('resume-no-btn')?.click()
      return
    }

    // If we deliberately opened retreat, confirm it as soon as the dialog appears.
    if (_botRetreatPending && _tryClickRetreatConfirm()) {
      lastBranch = 'retreat_confirm_yes'
      stuckNoTapTicks = 0
      return
    }

    const state = GameState.current()

    if (_tryDismissDiscoveryCards()) {
      lastBranch = 'modal_dismiss'
      return
    }

    if (state === States.LEVEL_UP) {
      lastBranch = 'level_up'
      _pickWeightedLevelUp()
      return
    }

    const summary = document.getElementById('run-summary')
    if (summary?.classList.contains('visible')) {
      if (!handledSummary) {
        const snap = GameController.getRunTelemetry()
        const outcomeType = snap?.telemetry?.outcome?.type
        // Avoid recording a fresh run (outcome null) when the overlay is stale or the race lost to newGame().
        if (!outcomeType) {
          const runActive = GameController.getBalanceBotDiagnostics().runActive
          // Stale #run-summary.visible while a run is in progress — never legitimate; hide or we starve the tick loop.
          if (runActive) {
            invalidSummaryTicks = 0
            lastBranch = 'summary_stale_hide'
            UI.hideRunSummary()
            return
          }
          invalidSummaryTicks++
          lastBranch = 'summary_invalid_wait'
          if (invalidSummaryTicks > 100) {
            invalidSummaryTicks = 0
            UI.hideRunSummary()
          }
          return
        }
        invalidSummaryTicks = 0
        handledSummary = true
        _botRetreatPending = false
        lastBranch = 'summary_record'
        runRecords.push(snap)
        runsCompleted++
        const rs = snap?.telemetry?.outcome?.runEndSummary ?? snap?.runStats
        console.log(`[bot:run] RUN ${runsCompleted}/${runsTarget} ended — outcome=${rs?.outcome} floor=${rs?.floor} level=${rs?.level} tilesRevealed=${rs?.tilesRevealed} hp=${rs?.hpAtRetreat ?? rs?.hpAtDeath ?? '?'} killer=${rs?.killerLabel ?? '—'}`)
        document.getElementById('try-again-btn')?.click()
        if (runsCompleted >= runsTarget) {
          if (intervalId) clearInterval(intervalId)
          intervalId = null
          _finalizeAggregateReport()
        }
        summaryStuckTicks = 0
      } else {
        lastBranch = 'summary_waiting'
        summaryStuckTicks++
        if (summaryStuckTicks >= 40) {
          summaryStuckTicks = 0
          document.getElementById('try-again-btn')?.click()
        }
      }
      return
    }
    handledSummary = false
    invalidSummaryTicks = 0
    summaryStuckTicks = 0

    // NPC (Storyteller, etc.): must run before _blockingModalOpen — story overlay is .panel-overlay.
    if (state === States.NPC_INTERACT) {
      if (_tryStoryEventBot()) {
        lastBranch = 'story_event'
        return
      }
      if (GameController.balanceBotDismissNpcEvent()) {
        lastBranch = 'npc_dismiss'
        return
      }
      // Neither handler succeeded — force-dismiss any open overlays and return without tapping.
      // Without this fallback the bot falls through to tap, re-opens the event, and loops forever.
      _tryDismissFloorExploreBlockingUi()
      lastBranch = 'npc_force_dismiss'
      return
    }

    if (_tryDismissFloorExploreBlockingUi()) {
      lastBranch = 'modal_dismiss'
      return
    }

    // Discovery / trap / info card / menu panels / backpack — don't advance until dismissed.
    if (_blockingModalOpen()) {
      modalWaitTicks++
      lastBranch = 'modal_wait'
      // After 10 ticks (~800ms) force-nuke every overlay and keep going
      if (modalWaitTicks >= 10) {
        console.warn(`[bot:modal] stuck in modal_wait for ${modalWaitTicks} ticks — force-closing all overlays`)
        document.querySelectorAll('.panel-overlay:not(.hidden)').forEach(el => { el.classList.add('hidden'); console.warn(`[bot:modal] force-hid panel-overlay #${el.id}`) })
        document.querySelectorAll('.event-overlay:not(.hidden)').forEach(el => { el.classList.add('hidden'); console.warn(`[bot:modal] force-hid event-overlay #${el.id}`) })
        // Trash pending backpack item if blocking
        const pb = document.getElementById('backpack-pending-bar')
        if (pb && !pb.classList.contains('hidden')) { document.getElementById('backpack-pending-trash')?.click(); console.warn('[bot:modal] force-trashed pending backpack item') }
        UI.hideInfoCard()
        modalWaitTicks = 0
      }
      return
    }
    modalWaitTicks = 0

    if (autopilotOpts.testBotOngoing) {
      const ratio = GameController.getPlayerHpRatio?.()
      if (
        ratio != null &&
        ratio > 0 &&
        ratio < 0.1 &&
        (state === States.FLOOR_EXPLORE || state === States.COMBAT)
      ) {
        const diag = GameController.getBalanceBotDiagnostics()
        if (diag.runActive) {
          console.log('[test-bot-ongoing] low HP retreat', { ratio, state: GameState.current() })
          GameController.doRetreat('test-bot-ongoing-low-hp')
          lastBranch = 'test_bot_low_hp_retreat'
          return
        }
      }
    }

    const menu = document.getElementById('main-menu')
    if (menu && !menu.classList.contains('hidden') && runsCompleted < runsTarget) {
      lastBranch = 'main_menu'
      if (autopilotOpts.testBotOngoing) {
        applyTestBotOngoingMetaPurchases(GameController.getSave())
      }
      document.getElementById('new-run-btn')?.click()
      return
    }

    // Abandon / boot race: GameState still "floor-explore" but run=null → no tap candidates forever
    const diag = GameController.getBalanceBotDiagnostics()
    if (!diag.runActive && state === States.FLOOR_EXPLORE && runsCompleted < runsTarget) {
      lastBranch = 'recover_menu'
      if (GameState.transition(States.MENU)) {
        UI.showMainMenu()
      } else {
        GameState.set(States.MENU)
        UI.showMainMenu()
      }
      console.warn('[bot:tick] recovered stale floor-explore with no active run — showing menu')
      return
    }

    if (state !== States.FLOOR_EXPLORE) {
      lastBranch = 'not_floor_explore'
      return
    }

    // Log floor entry once per floor
    if (diag.floor !== _loggedFloor && diag.runActive) {
      _loggedFloor = diag.floor
      console.log(`[bot:run] floor=${diag.floor} tilesRevealed=${diag.tilesRevealed} tapCandidates=${diag.tapCandidates}`)
    }

    const useIds = GameController.getBalanceBotUseItemCandidates()
    if (useIds.length > 0 && Math.random() < 0.125) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'use_item'
      const id = useIds[Math.floor(Math.random() * useIds.length)]
      GameController.useItem(id)
      return
    }

    const policy = autopilotOpts.policy === 'abilities' ? 'abilities' : 'random'
    if (policy === 'abilities') {
      if (GameController.balanceBotTryAbilitiesPolicy(autopilotOpts.abilityWeights ?? {})) {
        stuckNoTapTicks = 0
        reachabilityRepaired = false
        lastBranch = 'abilities'
        return
      }
    }

    let cands = GameController.getBalanceBotTapCandidates()
    if (cands.length === 0 && GameController.balanceBotTryOpenRevealTool()) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'reveal_tool'
      return
    }
    cands = GameController.getBalanceBotTapCandidates()
    if (cands.length > 0) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'tap'
      _performRandomTapFromCandidates(cands, diag.floor, '[bot:tap]', diag.hero)
      return
    }

    // No taps: combat animation, or genuine deadlock (e.g. last tiles locked with no enemies)
    const d = GameController.getBalanceBotDiagnostics()
    if (d.combatBusy || !d.runActive) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      if (d.combatBusy) {
        combatBusyTicks++
        if (combatBusyTicks >= 30) {
          console.warn(`[bot:stuck] combatBusy for ${combatBusyTicks} ticks — force-clearing _combatBusy`)
          GameController.balanceBotClearCombatBusy()
          combatBusyTicks = 0
        }
        lastBranch = 'stuck_combat_busy'
      } else {
        combatBusyTicks = 0
        lastBranch = 'stuck_no_run'
      }
      return
    }
    combatBusyTicks = 0

    stuckNoTapTicks++

    // ── At 20 ticks (~1.6s): attempt a reachability repair before giving up ──
    // Stale reachable flags (e.g. after hourglass or rapid floor transitions) are the most common
    // cause of the bot seeing 0 candidates despite unlocked tiles existing on the grid.
    if (stuckNoTapTicks === 20 && !reachabilityRepaired) {
      reachabilityRepaired = true
      lastBranch = 'stuck_repair_reachability'
      const deadlock = GameController.getBalanceBotDeadlockDiagnostics()
      console.warn(`[bot:stuck] tick=20 — attempting reachability repair. grid=${JSON.stringify(deadlock)}`)
      GameController.balanceBotRepairReachability()
      return
    }

    // ── At 40 ticks (~3.2s): try a forced item use ──
    if (stuckNoTapTicks < 40) {
      lastBranch = 'stuck_no_tap'
      return
    }

    if (useIds.length > 0) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'stuck_use_item'
      const id = useIds[Math.floor(Math.random() * useIds.length)]
      GameController.useItem(id)
      console.warn(`[bot:stuck] tick=40 — forced item use: ${id}`)
      return
    }

    // ── Deadlock: retreat ──
    // Last resort: repair reachability and re-query taps (stale flags are common); try reveal tool once.
    GameController.balanceBotRepairReachability()
    let lastChance = GameController.getBalanceBotTapCandidates()
    if (lastChance.length === 0 && GameController.balanceBotTryOpenRevealTool()) {
      lastChance = GameController.getBalanceBotTapCandidates()
    }
    if (lastChance.length > 0) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'stuck_last_chance_tap'
      console.warn(`[bot:stuck] last-chance recheck found ${lastChance.length} tap(s) — skipping retreat`)
      _performRandomTapFromCandidates(lastChance, diag.floor, '[bot:tap:last-chance]', diag.hero)
      return
    }

    const unlockedCount = GameController.balanceBotForceUnlockAll()
    console.warn(`[bot:stuck] force-unlocked all tiles — ${unlockedCount} now available`)
    const afterUnlock = GameController.getBalanceBotTapCandidates()
    if (afterUnlock.length > 0) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'stuck_force_unlock_tap'
      _performRandomTapFromCandidates(afterUnlock, diag.floor, '[bot:tap:force-unlock]', diag.hero)
      return
    }

    const deadlock = GameController.getBalanceBotDeadlockDiagnostics()
    console.warn(`[bot:stuck] DEADLOCK tick=${stuckNoTapTicks} floor=${deadlock.floor} grid=${JSON.stringify(deadlock)}`)
    window.__balanceBotRetreatReason = 'balance_bot_deadlock'
    _botRetreatPending = true
    if (_tryClickRetreatConfirm()) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'stuck_retreat_confirm'
      return
    }
    if (_tryClickRetreatButton()) {
      stuckNoTapTicks = 0
      reachabilityRepaired = false
      lastBranch = 'stuck_retreat_open'
    } else {
      _botRetreatPending = false  // couldn't open retreat either, give up for this tick
      lastBranch = 'stuck_deadlock'
    }
  } finally {
    window.__balanceBotDebug = {
      ...GameController.getBalanceBotDiagnostics(),
      runsCompleted,
      runsTarget,
      policy: autopilotOpts.policy ?? 'random',
      preset: autopilotOpts.preset ?? null,
      testBotOngoing: !!autopilotOpts.testBotOngoing,
      lastBranch,
      stuckNoTapTicks,
    }
  }
}

export function startBalanceBotAutopilot(opts = {}) {
  autopilotOpts = { policy: 'random', ...opts }
  runsTarget = Math.max(1, Number(opts.runs) || 1)
  runsCompleted = 0
  runRecords.length = 0
  handledSummary = false
  stuckNoTapTicks = 0
  reachabilityRepaired = false
  combatBusyTicks = 0
  _botRetreatPending = false
  summaryStuckTicks = 0
  _loggedFloor = -1
  if (intervalId) clearInterval(intervalId)
  intervalId = setInterval(tick, 80)
  window.__balanceBotRuns = runRecords
  window.__balanceBotRunsTarget = runsTarget
  window.__balanceBotReport = undefined
  console.log(`[bot:run] balance bot started — runs=${runsTarget} policy=${autopilotOpts.policy ?? 'random'} preset=${autopilotOpts.preset ?? 'none'}`)
}

export function stopBalanceBotAutopilot() {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
  console.log('[bot:run] balance bot stopped')
}
