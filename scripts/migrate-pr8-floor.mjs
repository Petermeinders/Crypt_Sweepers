/**
 * PR8b — extract FloorController from GameController.js
 */
import fs from 'fs'

const gcPath = 'js/core/GameController.js'
const outPath = 'js/controllers/FloorController.js'
const lines = fs.readFileSync(gcPath, 'utf8').split('\n')

const START_FLOOR_START = lines.findIndex(l => l.startsWith('function _startFloor()'))
const START_FLOOR_END = lines.findIndex(l => l.startsWith('/** Full main-grid rebuild'))
const HANDLE_EXIT_START = lines.findIndex(l => l.startsWith('function _handleExit()'))
const NEXT_FLOOR_END = lines.findIndex(l => l.includes('// ── Player stat helpers'))
const MOD_REVEAL_START = lines.findIndex(l => l.startsWith('function _checkFloorModifierOnReveal('))
const MOD_REVEAL_END = lines.findIndex(l => l.startsWith('/** +mana on successful melee'))

let body = [
  ...lines.slice(START_FLOOR_START, START_FLOOR_END),
  ...lines.slice(HANDLE_EXIT_START, NEXT_FLOOR_END),
  ...lines.slice(MOD_REVEAL_START, MOD_REVEAL_END),
].join('\n')

body = body
  .replace(/^function _startFloor\(\)/m, 'export function startFloor(ctx)')
  .replace(/^function _handleExit\(\)/m, 'export function handleExit(ctx)')
  .replace(/^function _confirmRope\(/m, 'export function confirmRope(ctx, ')
  .replace(/^function _nextFloor\(\)/m, 'export function nextFloor(ctx)')
  .replace(/^function _checkFloorModifierOnReveal\(/m, 'export function checkFloorModifierOnReveal(ctx, ')

const internal = [
  ['_startFloor()', 'startFloor(ctx)'],
  ['_handleExit()', 'handleExit(ctx)'],
  ['_confirmRope(', 'confirmRope(ctx, '],
  ['_nextFloor()', 'nextFloor(ctx)'],
  ['_checkFloorModifierOnReveal(', 'checkFloorModifierOnReveal(ctx, '],
]
for (const [from, to] of internal) {
  body = body.split(from).join(to)
}

const ctxMap = [
  [/\b_clearAllCombatEngagement\(\)/g, 'clearAllCombatEngagement()'],
  [/\b_cancelEngineerConstructMode\(\)/g, 'ctx.cancelEngineerConstructMode()'],
  [/\b_cancelChainLightningMode\(\)/g, 'ctx.cancelChainLightningMode()'],
  [/\b_cancelTelekineticThrowMode\(\)/g, 'ctx.cancelTelekineticThrowMode()'],
  [/\b_cancelStrengthenMinionMode\(\)/g, 'ctx.cancelStrengthenMinionMode()'],
  [/\b_cancelCorpseExplosionMode\(\)/g, 'ctx.cancelCorpseExplosionMode()'],
  [/\b_syncWarBannerCoordsFromGrid\(\)/g, 'ctx.syncWarBannerCoordsFromGrid()'],
  [/\b_syncTurretVisual\(\)/g, 'ctx.syncTurretVisual()'],
  [/\b_revealStartTile\(\)/g, 'ctx.revealStartTile()'],
  [/\b_tickPoisonArrowDotOnGlobalTurn\(\)/g, 'ctx.tickPoisonArrowDotOnGlobalTurn()'],
  [/\b_restoreTreasureGoblinAfterResume\(\)/g, 'ctx.restoreTreasureGoblinAfterResume()'],
  [/\b_spawnSubFloorEntry\(\)/g, 'ctx.spawnSubFloorEntry()'],
  [/\b_spawnWarBannerEntry\(\)/g, 'ctx.spawnWarBannerEntry()'],
  [/\b_spawnTreasureGoblin\(/g, 'ctx.spawnTreasureGoblin('],
  [/\b_spawnArcherGoblin\(/g, 'ctx.spawnArcherGoblin('],
  [/\b_spawnMouse\(/g, 'ctx.spawnMouse('],
  [/\b_maybeMouseIntro\(\)/g, 'ctx.maybeMouseIntro()'],
  [/\b_resolveEffect\(/g, 'ctx.resolveEffect('],
  [/\b_paladinKillEchoApplyMarks\(/g, 'ctx.paladinKillEchoApplyMarks('],
  [/\b_echoCharmCategoryForTileType\(/g, 'ctx.echoCharmCategoryForTileType('],
  [/\b_charKey\(\)/g, 'ctx.charKey()'],
  [/\b_syncMagicChestKeyGlow\(\)/g, 'ctx.syncMagicChestKeyGlow()'],
  [/\b_xpNeeded\(\)/g, 'ctx.xpNeeded()'],
  [/\b_playerDamageRange\(/g, 'ctx.playerDamageRange('],
  [/\b_refreshRangerActiveHud\(\)/g, 'ctx.refreshRangerActiveHud()'],
  [/\b_refreshEngineerHud\(\)/g, 'ctx.refreshEngineerHud()'],
  [/\b_refreshMageHud\(\)/g, 'ctx.refreshMageHud()'],
  [/\b_refreshVampireHud\(\)/g, 'ctx.refreshVampireHud()'],
  [/\b_refreshNecroActiveHud\(\)/g, 'ctx.refreshNecroActiveHud()'],
  [/\b_isActiveUnlocked\(/g, 'ctx.isActiveUnlocked('],
  [/\b_previewSpellManaCostForUi\(\)/g, 'ctx.previewSpellManaCostForUi()'],
  [/\b_appendLevelSnapshot\(/g, 'ctx.appendLevelSnapshot('],
  [/\b_appendFloorSnapshot\(/g, 'ctx.appendFloorSnapshot('],
  [/\b_syncCombatEngagementDom\(\)/g, 'syncCombatEngagementDom()'],
  [/\b_saveActiveRun\(\)/g, 'ctx.saveActiveRun()'],
  [/\b_markReachableUi\b/g, 'ctx.markReachableUi'],
  [/\b_syncGridDomClassesFromModel\(\)/g, 'ctx.syncGridDomClassesFromModel()'],
  [/\b_runMusicTrack\(\)/g, 'ctx.runMusicTrack()'],
  [/\b_takeDamage\(/g, 'ctx.takeDamage('],
  [/\bonTileTap,/g, 'ctx.onTileTap,'],
  [/\bonTileHold\)/g, 'ctx.onTileHold)'],
  [/\brevealTile\b/g, 'ctx.revealTile'],
]

for (const [pat, rep] of ctxMap) {
  body = body.replace(pat, rep)
}

const header = `import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { pickModifier } from '../systems/FloorModifiers.js'
import { session } from '../core/RunContext.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { clearAllCombatEngagement, syncCombatEngagementDom } from './TileTapRouter.js'

`

fs.writeFileSync(outPath, header + body + '\n')

const removeRanges = [
  [MOD_REVEAL_START, MOD_REVEAL_END],
  [HANDLE_EXIT_START, NEXT_FLOOR_END],
  [START_FLOOR_START, START_FLOOR_END],
].sort((a, b) => b[0] - a[0])

let gc = lines.join('\n')
for (const [start, end] of removeRanges) {
  const ls = gc.split('\n')
  gc = [...ls.slice(0, start), ...ls.slice(end)].join('\n')
}

if (!gc.includes("from '../controllers/FloorController.js'")) {
  gc = gc.replace(
    "import * as CombatController from '../controllers/CombatController.js'\n",
    "import * as CombatController from '../controllers/CombatController.js'\nimport * as FloorController from '../controllers/FloorController.js'\n",
  )
}

const floorBlock = `
// Floor progression (FloorController)
function _floorCtx() {
  return {
    ..._combatCtx(),
    cancelEngineerConstructMode: _cancelEngineerConstructMode,
    cancelChainLightningMode: _cancelChainLightningMode,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    cancelCorpseExplosionMode: _cancelCorpseExplosionMode,
    syncWarBannerCoordsFromGrid: _syncWarBannerCoordsFromGrid,
    syncTurretVisual: _syncTurretVisual,
    revealStartTile: _revealStartTile,
    restoreTreasureGoblinAfterResume: _restoreTreasureGoblinAfterResume,
    spawnSubFloorEntry: _spawnSubFloorEntry,
    spawnWarBannerEntry: _spawnWarBannerEntry,
    spawnTreasureGoblin: _spawnTreasureGoblin,
    spawnArcherGoblin: _spawnArcherGoblin,
    spawnMouse: _spawnMouse,
    maybeMouseIntro: _maybeMouseIntro,
    resolveEffect: _resolveEffect,
    paladinKillEchoApplyMarks: _paladinKillEchoApplyMarks,
    refreshRangerActiveHud: _refreshRangerActiveHud,
    refreshEngineerHud: _refreshEngineerHud,
    refreshMageHud: _refreshMageHud,
    refreshVampireHud: _refreshVampireHud,
    refreshNecroActiveHud: _refreshNecroActiveHud,
    isActiveUnlocked: _isActiveUnlocked,
    previewSpellManaCostForUi: _previewSpellManaCostForUi,
    appendLevelSnapshot: _appendLevelSnapshot,
    appendFloorSnapshot: _appendFloorSnapshot,
    saveActiveRun: _saveActiveRun,
    runMusicTrack: _runMusicTrack,
    xpNeeded: _xpNeeded,
  }
}

function _startFloor() { FloorController.startFloor(_floorCtx()) }
function _handleExit() { FloorController.handleExit(_floorCtx()) }
function _confirmRope(tile) { FloorController.confirmRope(_floorCtx(), tile) }
function _checkFloorModifierOnReveal(tile) { FloorController.checkFloorModifierOnReveal(_floorCtx(), tile) }

`

if (!gc.includes('function _floorCtx()')) {
  gc = gc.replace('function _combatCtx() {', floorBlock + 'function _combatCtx() {')
}

// _stateCtx startFloor reference
gc = gc.replace(
  /startFloor:\s*_startFloor,/,
  'startFloor: _startFloor,',
)

fs.writeFileSync(gcPath, gc)
console.log('PR8 floor migration done')
console.log('FloorController lines:', (header + body).split('\n').length)
console.log('GameController lines:', gc.split('\n').length)
