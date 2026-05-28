import fs from 'fs'

const path = 'js/core/GameController.js'
let gc = fs.readFileSync(path, 'utf8')

// ── 1. Add imports ──
if (!gc.includes("from './RunContext.js'")) {
  gc = gc.replace(
    "import * as BalanceBotBridge from '../controllers/BalanceBotBridge.js'\n",
    "import * as BalanceBotBridge from '../controllers/BalanceBotBridge.js'\nimport { session, charKey as runCharKey } from './RunContext.js'\nimport * as GSH from './GameStateHandlers.js'\n",
  )
}

// ── 2. Replace module-level session vars ──
gc = gc.replace(
  /\/\/ ── Persistent save \+ run state ─+\nlet _save = null\nlet run\s+= null\n\/\*\* Last finalized run telemetry[\s\S]*?let _lastRunTelemetrySnapshot = null\n\nfunction _charKey\(\) \{\n  return _save\?\.selectedCharacter \?\? 'warrior'\n\}\n\n/,
  'function _charKey() { return runCharKey() }\n\n',
)

// ── 3. Protect strings / identifiers before run replacement ──
const placeholders = [
  ["'run:retreat'", '__EVT_RUN_RETREAT__'],
  ["'run:floorAdvance'", '__EVT_RUN_FLOOR__'],
  ['UI.runFloorTransition', '__UI_RUN_FLOOR_TRANSITION__'],
  ['UI.showRunSummary', '__UI_SHOW_RUN_SUMMARY__'],
  ['UI.hideRunSummary', '__UI_HIDE_RUN_SUMMARY__'],
  ['createInitialTelemetry', '__CREATE_INITIAL_TELEMETRY__'],
  ['getRunTelemetry', '__GET_RUN_TELEMETRY__'],
  ['resumeRun', '__FN_RESUME_RUN__'],
  ['abandonRun', '__FN_ABANDON_RUN__'],
  ['returnToMenu', '__FN_RETURN_TO_MENU__'],
  ['newGame', '__FN_NEW_GAME__'],
  ['buildRunState', '__FN_BUILD_RUN_STATE__'],
  ['runStartSnapshotDone', '__RUN_START_SNAPSHOT_DONE__'],
  ['runEndSummary', '__RUN_END_SUMMARY__'],
  ['runStats:', '__RUN_STATS_COLON__'],
  ['runStats,', '__RUN_STATS_COMMA__'],
  ['runStats }', '__RUN_STATS_BRACE__'],
  ['runStats)', '__RUN_STATS_PAREN__'],
  ['runStats(', '__RUN_STATS_CALL__'],
  ['runStats`', '__RUN_STATS_TICK__'],
  ["runStats'", '__RUN_STATS_SQ__'],
  ['runStats.', '__RUN_STATS_DOT__'],
  ['runStats?', '__RUN_STATS_Q__'],
  ['runStats\n', '__RUN_STATS_NL__'],
  ['runStats ', '__RUN_STATS_SP__'],
  ['runStats]', '__RUN_STATS_BRACKET__'],
  ['runTelemetry', '__RUN_TELEMETRY__'],
  ['run-level', '__RUN_LEVEL__'],
  ['run-bot', '__RUN_BOT__'],
  ['runHarness', '__RUN_HARNESS__'],
  ['runMusicTrack', '__RUN_MUSIC_TRACK__'],
  ['runEndSummary', '__RUN_END_SUMMARY2__'],
]
for (const [from, to] of placeholders) gc = gc.split(from).join(to)

gc = gc.replace(/\b_lastRunTelemetrySnapshot\b/g, 'session.lastRunTelemetrySnapshot')
gc = gc.replace(/\b_save\b/g, 'session.save')
gc = gc.replace(/\brun\b/g, 'session.run')

for (const [from, to] of placeholders) gc = gc.split(to).join(from)

// ── 4. Insert _stateCtx + _resetCombatOnDeath before Init section ──
const stateCtxBlock = `
function _stateCtx() {
  return {
    charKey: _charKey,
    applyEquippedGear: _applyEquippedGear,
    startFloor: _startFloor,
    getCombatEngagementTile: () => _combatEngagementTile,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    closeEventSession: _closeEventSession,
    resetCombatOnDeath: _resetCombatOnDeath,
  }
}

function _resetCombatOnDeath() {
  _spellTargeting         = false
  _combatBusy             = false
  _clearAllCombatEngagement()
  _lanternTargeting       = false
  _spyglassTargeting      = false
  _blindingLightTargeting = false
  _divineLightSelecting   = false
  UI.setDivineLightActive(false)
  _cancelRicochetMode()
  _cancelArrowBarrageMode()
  _cancelPoisonArrowShotMode()
  if (session.run?.player) {
    session.run.player.tearyEyesTurns = 0
    UI.setTearyEyes(0)
    session.run.player.freezingHitStacks = 0
    UI.setFreezingHit(0)
    session.run.player.burnStacks = 0
    UI.setBurnOverlay(0)
    session.run.player.poisonStacks = 0
    UI.setPlayerPoison(0)
    session.run.player.corruptionStacks = 0
    if (session.run.player.corruptionBaseMaxHp) {
      session.run.player.maxHp = session.run.player.corruptionBaseMaxHp
      session.run.player.corruptionBaseMaxHp = 0
    }
    if (session.run.player.corruptionBaseMaxMana) {
      session.run.player.maxMana = session.run.player.corruptionBaseMaxMana
      session.run.player.corruptionBaseMaxMana = 0
    }
    UI.setCorruption(0)
  }
}

`

if (!gc.includes('function _stateCtx()')) {
  gc = gc.replace('// ── Init ─────────────────────────────────────────────────────', stateCtxBlock + '// ── Init ─────────────────────────────────────────────────────')
}

// ── 5. Replace extracted function bodies with GSH delegates ──
const replacements = [
  [/function buildRunState\(\) \{[\s\S]*?\n\}\n\n\/\/ ── Accessors/, 'function buildRunState() { return GSH.buildRunState(_stateCtx()) }\n\n// ── Accessors'],
  [/function init\(saveData\) \{[\s\S]*?\n\}\n\n\/\/ ── New game/, 'function init(saveData) { GSH.init(_stateCtx(), saveData) }\n\n// ── New game'],
  [/function newGame\(\) \{[\s\S]*?\n\}\n\n\/\/ ── Run persistence/, 'function newGame() { GSH.newGame(_stateCtx()) }\n\n// ── Run persistence'],
  [/function _serializeGridSnapshot\(\) \{[\s\S]*?\n\}\n\nfunction _saveActiveRun\(\) \{[\s\S]*?\n\}\n\n\/\/ ── Gear stat helpers/, '// ── Gear stat helpers'],
  [/function _clearActiveRun\(\) \{[\s\S]*?\n\}\n\n\/\*\* In-run background music[\s\S]*?\n\}\n\nfunction resumeRun\(\) \{[\s\S]*?\n\}\n\nfunction abandonRun\(\) \{[\s\S]*?\n\}\n\n\/\/ ── Return to menu/, '// ── Return to menu'],
  [/function returnToMenu\(autoSave = false\) \{[\s\S]*?\n\}\n\nfunction _startFloor\(\)/, 'function returnToMenu(autoSave = false) { GSH.returnToMenu(_stateCtx(), autoSave) }\n\nfunction resumeRun() { GSH.resumeRun(_stateCtx()) }\n\nfunction abandonRun() { GSH.abandonRun(_stateCtx()) }\n\nfunction _saveActiveRun() { GSH.saveActiveRun(_stateCtx()) }\n\nfunction _clearActiveRun() { GSH.clearActiveRun(_stateCtx()) }\n\nfunction _startFloor()'],
  [/function doRetreat\(reason = 'player'\) \{[\s\S]*?\n\}\n\n\/\/ ── Floor progression/, "function doRetreat(reason = 'player') { GSH.doRetreat(_stateCtx(), reason) }\n\n// ── Floor progression"],
  [/function _die\(killerData = null, opts = \{\}\) \{[\s\S]*?\n\}\n\nfunction _buildKillerCard\(e\) \{[\s\S]*?\n\}\n\nfunction _runStats\(\) \{[\s\S]*?\n\}\n\nfunction _appendLevelSnapshot/, 'function _die(killerData = null, opts = {}) { GSH.die(_stateCtx(), killerData, opts) }\n\nfunction _runStats() { return GSH.runStats(_stateCtx()) }\n\nfunction _finalizeRunTelemetry(outcomeType, extras = {}) { GSH.finalizeRunTelemetry(_stateCtx(), outcomeType, extras) }\n\nfunction _wireRunSummaryBtn() { GSH.wireRunSummaryBtn(_stateCtx()) }\n\nfunction _appendLevelSnapshot'],
  [/function _buildRunEndSummary\(outcomeType, extras = \{\}\) \{[\s\S]*?\n\}\n\nfunction _finalizeRunTelemetry\(outcomeType, extras = \{\}\) \{[\s\S]*?\n\}\n\nfunction _wireRunSummaryBtn\(\) \{[\s\S]*?\n\}\n\nfunction _rand\(min, max\)/, 'function _rand(min, max)'],
]

for (const [pat, rep] of replacements) {
  if (pat.test(gc)) gc = gc.replace(pat, rep)
  else console.warn('Pattern not found:', pat.toString().slice(0, 60))
}

// Fix export object getSave
gc = gc.replace('getSave() { return _save }', 'getSave() { return session.save }')
gc = gc.replace('getSave() { return session.save }', 'getSave() { return session.save }')

fs.writeFileSync(path, gc)
console.log('GameController patched, lines:', gc.split('\n').length)
