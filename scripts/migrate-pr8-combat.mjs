/**
 * PR8 — extract CombatController from GameController.js
 */
import fs from 'fs'

const gcPath = 'js/core/GameController.js'
const outPath = 'js/controllers/CombatController.js'
const lines = fs.readFileSync(gcPath, 'utf8').split('\n')

const COMBAT_HELPER_START = lines.findIndex(l => l.startsWith('function _checkShieldBlock('))
const COMBAT_HELPER_END = lines.findIndex(l => l.startsWith('/** Returns the live, revealed Drowned Hulk'))

const SPRITE_START = lines.findIndex(l => l.startsWith('function _setEnemySprite('))
const FIGHT_END = lines.findIndex(l => l.includes('// ── Spell'))
const VICTORY_START = lines.findIndex(l => l.startsWith('function _endCombatVictory('))
const VICTORY_END = lines.findIndex(l => l.includes('// ── Hasty Retreat'))
const STORM_START = lines.findIndex(l => l.startsWith('function _triggerStormcallerLightning('))
const STORM_END = lines.findIndex(l => l.startsWith('function _checkFloorCleared('))

let body = [
  ...lines.slice(COMBAT_HELPER_START, COMBAT_HELPER_END),
  ...lines.slice(SPRITE_START, FIGHT_END),
  ...lines.slice(VICTORY_START, VICTORY_END),
  ...lines.slice(STORM_START, STORM_END),
].join('\n')

body = body
  .replace(/^function _checkShieldBlock\(/m, 'function checkShieldBlock(ctx, ')
  .replace(/^function _shouldShowParryWindow\(/m, 'export function shouldShowParryWindow(')
  .replace(/^function _resolveTauntTarget\(/m, 'function resolveTauntTarget(ctx, ')
  .replace(/^function _setEnemySprite\(/m, 'function setEnemySprite(')
  .replace(/^function fightAction\(/m, 'export function fightAction(ctx, ')
  .replace(/^function _endCombatVictory\(/m, 'export function endCombatVictory(ctx, ')
  .replace(/^function _triggerStormcallerLightning\(/m, 'function triggerStormcallerLightning(ctx, ')

const internal = [
  ['_checkShieldBlock(', 'checkShieldBlock(ctx, '],
  ['_shouldShowParryWindow(', 'shouldShowParryWindow('],
  ['_resolveTauntTarget(', 'resolveTauntTarget(ctx, '],
  ['_setEnemySprite(', 'setEnemySprite('],
  ['_endCombatVictory(', 'endCombatVictory(ctx, '],
  ['_triggerStormcallerLightning(', 'triggerStormcallerLightning(ctx, '],
]

for (const [from, to] of internal) {
  body = body.split(from).join(to)
}

const ctxMap = [
  [/\b_tickPoisonArrowDotOnGlobalTurn\(/g, 'ctx.tickPoisonArrowDotOnGlobalTurn('],
  [/\b_canAttackEnemy\(/g, 'ctx.canAttackEnemy('],
  [/\b_setCombatEngagement\(/g, 'setCombatEngagement('],
  [/\b_clearCombatEngagementForTile\(/g, 'clearCombatEngagementForTile('],
  [/\b_charKey\(\)/g, 'ctx.charKey()'],
  [/\b_inTeslaPerimeter\(/g, 'ctx.inTeslaPerimeter('],
  [/\b_engineerTurretDamage\(/g, 'ctx.engineerTurretDamage('],
  [/\b_necroMinionTotalDmg\(\)/g, 'ctx.necroMinionTotalDmg()'],
  [/\b_scaleOutgoingDamageToEnemy\(/g, 'ctx.scaleOutgoingDamageToEnemy('],
  [/\b_gainManaFromMeleeHit\(/g, 'ctx.gainManaFromMeleeHit('],
  [/\b_rand\(/g, 'ctx.rand('],
  [/\b_gainGold\(/g, 'ctx.gainGold('],
  [/\b_gainXP\(/g, 'ctx.gainXP('],
  [/\b_applyTearyEyes\(\)/g, 'ctx.applyTearyEyes()'],
  [/\b_checkOnionLayer\(/g, 'ctx.checkOnionLayer('],
  [/\b_vibrationRequiresSyncUserActivation\(\)/g, 'ctx.vibrationRequiresSyncUserActivation()'],
  [/\b_hapticFromUserGesture\(/g, 'ctx.hapticFromUserGesture('],
  [/\b_telemetryBumpDamageDealt\(/g, 'ctx.telemetryBumpDamageDealt('],
  [/\b_takeDamage\(/g, 'ctx.takeDamage('],
  [/\b_applyFreezingHit\(\)/g, 'ctx.applyFreezingHit()'],
  [/\b_applyBurnHit\(/g, 'ctx.applyBurnHit('],
  [/\b_applyPlayerPoison\(/g, 'ctx.applyPlayerPoison('],
  [/\b_applyCorruption\(\)/g, 'ctx.applyCorruption()'],
  [/\b_tryDemonFlip\(/g, 'ctx.tryDemonFlip('],
  [/\b_computeEffectiveDamageTaken\(/g, 'ctx.computeEffectiveDamageTaken('],
  [/\b_isInSubFloor\(\)/g, 'isInSubFloor()'],
  [/\b_sfUnlockAdjacent\(/g, 'ctx.sfUnlockAdjacent('],
  [/\b_finishTreasureGoblinReward\(/g, 'ctx.finishTreasureGoblinReward('],
  [/\b_telemetryBumpKill\(/g, 'ctx.telemetryBumpKill('],
  [/\b_removeHulkBuffFromAll\(\)/g, 'ctx.removeHulkBuffFromAll()'],
  [/\b_paladinKillEchoAddMarksAfterKill\(/g, 'ctx.paladinKillEchoAddMarksAfterKill('],
  [/\b_markReachableUi\b/g, 'ctx.markReachableUi'],
  [/\b_echoCharmCategoryForTileType\(/g, 'ctx.echoCharmCategoryForTileType('],
  [/\b_playerDamageRange\(/g, 'ctx.playerDamageRange('],
  [/\b_tryGearDrop\(/g, 'ctx.tryGearDrop('],
  [/\b_checkFloorCleared\(\)/g, 'ctx.checkFloorCleared()'],
  [/\b_maybeOfferDeadlockEscape\(\)/g, 'ctx.maybeOfferDeadlockEscape()'],
  [/\bsession\.tap\./g, 'session.tap.'],
]

for (const [pat, rep] of ctxMap) {
  body = body.replace(pat, rep)
}

const header = `import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import {
  setCombatEngagement,
  clearCombatEngagementForTile,
  isInSubFloor,
} from './TileTapRouter.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'
const RANGER_FIGHT_ATTACK_PORTRAIT_MS = 4000
const WARRIOR_FIGHT_ATTACK_PORTRAIT_MS = 2000

`

// Check if constants exist in GC - grep them
fs.writeFileSync(outPath, header + body + '\n')

// Remove from GC (bottom-up)
const removeRanges = [
  [STORM_START, STORM_END],
  [VICTORY_START, VICTORY_END],
  [SPRITE_START, FIGHT_END],
  [COMBAT_HELPER_START, COMBAT_HELPER_END],
].sort((a, b) => b[0] - a[0])

let gc = lines.join('\n')
for (const [start, end] of removeRanges) {
  const ls = gc.split('\n')
  gc = [...ls.slice(0, start), ...ls.slice(end)].join('\n')
}

if (!gc.includes("from '../controllers/CombatController.js'")) {
  gc = gc.replace(
    "import * as RevealController from '../controllers/TileRevealController.js'\n",
    "import * as RevealController from '../controllers/TileRevealController.js'\nimport * as CombatController from '../controllers/CombatController.js'\n",
  )
}

const combatBlock = `
// Combat (CombatController)
const _shouldShowParryWindow = CombatController.shouldShowParryWindow

function _combatCtx() {
  return {
    ..._revealCtx(),
    canAttackEnemy: _canAttackEnemy,
    tickPoisonArrowDotOnGlobalTurn: _tickPoisonArrowDotOnGlobalTurn,
    engineerTurretDamage: _engineerTurretDamage,
    necroMinionTotalDmg: _necroMinionTotalDmg,
    scaleOutgoingDamageToEnemy: _scaleOutgoingDamageToEnemy,
    gainManaFromMeleeHit: _gainManaFromMeleeHit,
    applyTearyEyes: _applyTearyEyes,
    checkOnionLayer: _checkOnionLayer,
    vibrationRequiresSyncUserActivation: _vibrationRequiresSyncUserActivation,
    telemetryBumpDamageDealt: _telemetryBumpDamageDealt,
    takeDamage: _takeDamage,
    applyFreezingHit: _applyFreezingHit,
    applyBurnHit: _applyBurnHit,
    applyPlayerPoison: _applyPlayerPoison,
    applyCorruption: _applyCorruption,
    tryDemonFlip: _tryDemonFlip,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    sfUnlockAdjacent: _sfUnlockAdjacent,
    finishTreasureGoblinReward: _finishTreasureGoblinReward,
    telemetryBumpKill: _telemetryBumpKill,
    removeHulkBuffFromAll: _removeHulkBuffFromAll,
    paladinKillEchoAddMarksAfterKill: _paladinKillEchoAddMarksAfterKill,
    checkFloorCleared: _checkFloorCleared,
    maybeOfferDeadlockEscape: _maybeOfferDeadlockEscape,
  }
}

function fightAction(tile) { CombatController.fightAction(_combatCtx(), tile) }
function _endCombatVictory(tile) { CombatController.endCombatVictory(_combatCtx(), tile) }

`

if (!gc.includes('function _combatCtx()')) {
  gc = gc.replace('function _revealCtx() {', combatBlock + 'function _revealCtx() {')
}

// Update _tapCtx fightAction reference - already fightAction wrapper OK

fs.writeFileSync(gcPath, gc)
console.log('PR8 combat migration done')
console.log('CombatController lines:', (header + body).split('\n').length)
console.log('GameController lines:', gc.split('\n').length)
