/**
 * PR7 — extract TileRevealController from GameController.js
 */
import fs from 'fs'

const gcPath = 'js/core/GameController.js'
const outPath = 'js/controllers/TileRevealController.js'
let lines = fs.readFileSync(gcPath, 'utf8').split('\n')

// Ranges (0-based, end exclusive)
const MOUSE_START = lines.findIndex(l => l.includes('async function _maybeMouseUnflip'))
const MOUSE_END = lines.findIndex((l, i) => i > MOUSE_START && l.startsWith('/** Crystal Bone Demon'))
const HOLD_START = lines.findIndex(l => l.includes('// ── Tile hold'))
const RESOLVE_END = lines.findIndex(l => l.startsWith('function _confirmExit('))
const DEADLOCK_START = lines.findIndex(l => l.includes('function _maybeOfferDeadlockEscape()'))
const DEADLOCK_END = lines.findIndex((l, i) => i > DEADLOCK_START && l.startsWith('function _climbThroughHazard('))

let body = [
  ...lines.slice(MOUSE_START, MOUSE_END),
  '',
  ...lines.slice(HOLD_START, RESOLVE_END),
  '',
  ...lines.slice(DEADLOCK_START, DEADLOCK_END),
].join('\n')

// Export public entry points
body = body
  .replace(/^async function _maybeMouseUnflip\(/m, 'async function maybeMouseUnflip(ctx, ')
  .replace(/^function _showTurretPerimeter\(/m, 'function showTurretPerimeter(ctx, ')
  .replace(/^function _clearTurretPerimeter\(/m, 'function clearTurretPerimeter(')
  .replace(/^function onTileHold\(/m, 'export function onTileHold(ctx, ')
  .replace(/^function _applyRangerTrapfinderMitigation\(/m, 'export function applyRangerTrapfinderMitigation(')
  .replace(/^function _tickPoisonArrowDotOnGlobalTurn\(/m, 'export function tickPoisonArrowDotOnGlobalTurn(ctx, ')
  .replace(/^async function revealTile\(/m, 'export async function revealTile(ctx, ')
  .replace(/^async function _maybeWarBannerIntro\(/m, 'async function maybeWarBannerIntro(')
  .replace(/^async function _maybeMouseIntro\(/m, 'async function maybeMouseIntro(')
  .replace(/^async function _maybeBestiaryDiscovery\(/m, 'async function maybeBestiaryDiscovery(')
  .replace(/^function _forcePlayChestGif\(/m, 'function forcePlayChestGif(')
  .replace(/^async function _openChest\(/m, 'export async function openChest(ctx, ')
  .replace(/^function _resolveEffect\(/m, 'export function resolveEffect(ctx, ')
  .replace(/^function _maybeOfferDeadlockEscape\(/m, 'export function maybeOfferDeadlockEscape(ctx)')

// Internal renames within module
const internalMap = [
  ['_maybeMouseUnflip(', 'maybeMouseUnflip(ctx, '],
  ['_showTurretPerimeter(', 'showTurretPerimeter(ctx, '],
  ['_clearTurretPerimeter(', 'clearTurretPerimeter('],
  ['_applyRangerTrapfinderMitigation(', 'applyRangerTrapfinderMitigation('],
  ['_tickPoisonArrowDotOnGlobalTurn(', 'tickPoisonArrowDotOnGlobalTurn(ctx, '],
  ['_maybeWarBannerIntro(', 'maybeWarBannerIntro('],
  ['_maybeMouseIntro(', 'maybeMouseIntro('],
  ['_maybeBestiaryDiscovery(', 'maybeBestiaryDiscovery('],
  ['_forcePlayChestGif(', 'forcePlayChestGif('],
  ['_openChest(', 'openChest(ctx, '],
  ['_resolveEffect(', 'resolveEffect(ctx, '],
  ['_maybeOfferDeadlockEscape(', 'maybeOfferDeadlockEscape(ctx)'],
  ['await revealTile(', 'await revealTile(ctx, '],
]

for (const [from, to] of internalMap) {
  body = body.split(from).join(to)
}

// ctx replacements for GameController helpers
const ctxMap = [
  [/\b_getActiveTiles\(\)/g, 'getActiveTiles()'],
  [/\b_setCombatEngagement\(/g, 'setCombatEngagement('],
  [/\b_turretDeployedOnTile\(/g, 'ctx.turretDeployedOnTile('],
  [/\b_syncAllUnrevealedLockedDom\(\)/g, 'ctx.syncAllUnrevealedLockedDom()'],
  [/\b_serializeHourglassSnapshot\(\)/g, 'ctx.serializeHourglassSnapshot()'],
  [/\b_firefoxPreFlipHapticsIfNeeded\(/g, 'ctx.firefoxPreFlipHapticsIfNeeded('],
  [/\b_gainXP\(/g, 'ctx.gainXP('],
  [/\b_engineerManaGeneratorOnReveal\(/g, 'ctx.engineerManaGeneratorOnReveal('],
  [/\b_checkFloorModifierOnReveal\(/g, 'ctx.checkFloorModifierOnReveal('],
  [/\b_rand\(/g, 'ctx.rand('],
  [/\b_gainGold\(/g, 'ctx.gainGold('],
  [/\b_endCombatVictory\(/g, 'ctx.endCombatVictory('],
  [/\b_markReachableUi\b/g, 'ctx.markReachableUi'],
  [/\b_applyHulkBuffToAll\(\)/g, 'ctx.applyHulkBuffToAll()'],
  [/\b_findLiveHulk\(\)/g, 'ctx.findLiveHulk()'],
  [/\b_applyHulkBuffToTile\(/g, 'ctx.applyHulkBuffToTile('],
  [/\b_engineerTurretAfterReveal\(/g, 'ctx.engineerTurretAfterReveal('],
  [/\b_charKey\(\)/g, 'ctx.charKey()'],
  [/\b_echoCharmCategoryForTileType\(/g, 'ctx.echoCharmCategoryForTileType('],
  [/\b_vampireCorruptedBloodAndDarkEyes\(/g, 'ctx.vampireCorruptedBloodAndDarkEyes('],
  [/\b_mageLifeTapOnFlip\(/g, 'ctx.mageLifeTapOnFlip('],
  [/\b_hapticFromUserGesture\b/g, 'ctx.hapticFromUserGesture'],
  [/\b_hapticFromAsyncTask\b/g, 'ctx.hapticFromAsyncTask'],
  [/\b_tickTreasureGoblinCountdown\(\)/g, 'ctx.tickTreasureGoblinCountdown()'],
  [/\b_scaleOutgoingDamageToEnemy\(/g, 'ctx.scaleOutgoingDamageToEnemy('],
  [/\b_poisonArrowUnitDamage\(\)/g, 'ctx.poisonArrowUnitDamage()'],
  [/\b_hemorrhageBurst\(/g, 'ctx.hemorrhageBurst('],
  [/\b_computeEffectiveDamageTaken\(/g, 'ctx.computeEffectiveDamageTaken('],
  [/\b_takeDamage\(/g, 'ctx.takeDamage('],
  [/\b_refreshAllEnemyStatusDisplays\(\)/g, 'ctx.refreshAllEnemyStatusDisplays()'],
  [/\b_playerDamageRange\(/g, 'ctx.playerDamageRange('],
  [/\b_addToBackpack\(/g, 'ctx.addToBackpack('],
  [/\b_rollChestLoot\(\)/g, 'ctx.rollChestLoot()'],
  [/\b_tryGearDrop\(/g, 'ctx.tryGearDrop('],
  [/\b_openForge\(/g, 'ctx.openForge('],
  [/\b_syncMagicChestKeyGlow\(\)/g, 'ctx.syncMagicChestKeyGlow()'],
  [/\b_engineerTurretDamage\(/g, 'ctx.engineerTurretDamage('],
  [/\b_inTeslaPerimeter\(/g, 'ctx.inTeslaPerimeter('],
  [/\bonTileTap,/g, 'ctx.onTileTap,'],
  [/\bonTileHold\)/g, 'ctx.onTileHold)'],
  [/\b_refreshMainGridDomFromModel\(\)/g, 'ctx.refreshMainGridDomFromModel()'],
  [/\b_syncGridDomClassesFromModel\(\)/g, 'ctx.syncGridDomClassesFromModel()'],
  [/\b_isPlayerDeadlocked\(\)/g, 'ctx.isPlayerDeadlocked()'],
]

for (const [pat, rep] of ctxMap) {
  body = body.replace(pat, rep)
}

const header = `import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import Bestiary from '../systems/Bestiary.js'
import { session } from '../core/RunContext.js'
import { RANGER_PASSIVE_SKIP_ADJ_LOCK } from '../data/ranger.js'
import { ITEMS } from '../data/items.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE, TILE_TYPE_ICON_FILES } from '../data/tileIcons.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import {
  getActiveTiles,
  setCombatEngagement,
} from './TileTapRouter.js'

`

fs.writeFileSync(outPath, header + body + '\n')

// Remove extracted sections from GameController (bottom-up)
const removeRanges = [
  [DEADLOCK_START, DEADLOCK_END],
  [HOLD_START, RESOLVE_END],
  [MOUSE_START, MOUSE_END],
].sort((a, b) => b[0] - a[0])

let gc = lines.join('\n')
for (const [start, end] of removeRanges) {
  const before = gc.split('\n').slice(0, start).join('\n')
  const after = gc.split('\n').slice(end).join('\n')
  gc = before + '\n' + after
}

// Add import
if (!gc.includes("from '../controllers/TileRevealController.js'")) {
  gc = gc.replace(
    "import * as TapRouter from '../controllers/TileTapRouter.js'\n",
    "import * as TapRouter from '../controllers/TileTapRouter.js'\nimport * as RevealController from '../controllers/TileRevealController.js'\n",
  )
}

// Aliases + _revealCtx
const revealBlock = `
// Tile reveal / hold / chest (TileRevealController)
const _applyRangerTrapfinderMitigation = RevealController.applyRangerTrapfinderMitigation
const _tickPoisonArrowDotOnGlobalTurn = (opts) => RevealController.tickPoisonArrowDotOnGlobalTurn(_revealCtx(), opts)
const _maybeOfferDeadlockEscape = () => RevealController.maybeOfferDeadlockEscape(_revealCtx())

function _revealCtx() {
  return {
    ..._tapCtx(),
    onTileTap,
    onTileHold,
    turretDeployedOnTile: _turretDeployedOnTile,
    syncAllUnrevealedLockedDom: _syncAllUnrevealedLockedDom,
    serializeHourglassSnapshot: _serializeHourglassSnapshot,
    firefoxPreFlipHapticsIfNeeded: _firefoxPreFlipHapticsIfNeeded,
    gainXP: _gainXP,
    engineerManaGeneratorOnReveal: _engineerManaGeneratorOnReveal,
    checkFloorModifierOnReveal: _checkFloorModifierOnReveal,
    rand: _rand,
    gainGold: _gainGold,
    endCombatVictory: _endCombatVictory,
    markReachableUi: _markReachableUi,
    applyHulkBuffToAll: _applyHulkBuffToAll,
    findLiveHulk: _findLiveHulk,
    applyHulkBuffToTile: _applyHulkBuffToTile,
    engineerTurretAfterReveal: _engineerTurretAfterReveal,
    charKey: _charKey,
    echoCharmCategoryForTileType: _echoCharmCategoryForTileType,
    vampireCorruptedBloodAndDarkEyes: _vampireCorruptedBloodAndDarkEyes,
    mageLifeTapOnFlip: _mageLifeTapOnFlip,
    hapticFromUserGesture: _hapticFromUserGesture,
    hapticFromAsyncTask: _hapticFromAsyncTask,
    tickTreasureGoblinCountdown: _tickTreasureGoblinCountdown,
    scaleOutgoingDamageToEnemy: _scaleOutgoingDamageToEnemy,
    poisonArrowUnitDamage: _poisonArrowUnitDamage,
    hemorrhageBurst: _hemorrhageBurst,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    takeDamage: _takeDamage,
    refreshAllEnemyStatusDisplays: _refreshAllEnemyStatusDisplays,
    playerDamageRange: _playerDamageRange,
    addToBackpack: _addToBackpack,
    rollChestLoot: _rollChestLoot,
    tryGearDrop: _tryGearDrop,
    openForge: _openForge,
    syncMagicChestKeyGlow: _syncMagicChestKeyGlow,
    engineerTurretDamage: _engineerTurretDamage,
    inTeslaPerimeter: _inTeslaPerimeter,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    isPlayerDeadlocked: _isPlayerDeadlocked,
  }
}

async function revealTile(tile) { return RevealController.revealTile(_revealCtx(), tile) }
function onTileHold(row, col) { RevealController.onTileHold(_revealCtx(), row, col) }
async function _openChest(tile) { return RevealController.openChest(_revealCtx(), tile) }
function _resolveEffect(tile) { RevealController.resolveEffect(_revealCtx(), tile) }

`

if (!gc.includes('function _revealCtx()')) {
  gc = gc.replace(
    'function _tapCtx() {',
    revealBlock + 'function _tapCtx() {',
  )
}

// Fix _tryDemonFlip revealTile call - already uses revealTile wrapper OK

fs.writeFileSync(gcPath, gc)
console.log('PR7 migration done')
console.log('TileRevealController lines:', (header + body).split('\n').length)
console.log('GameController lines:', gc.split('\n').length)
