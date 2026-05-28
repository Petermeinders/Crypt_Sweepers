import fs from 'fs'

const gcPath = 'js/core/GameController.js'
let gc = fs.readFileSync(gcPath, 'utf8')
const lines = gc.split('\n')

// ── 1. Replace tap flags with session.tap.* ──
const flagMap = [
  ['_combatEngagementTile', 'session.tap.combatEngagementTile'],
  ['_combatBusySetAt', 'session.tap.combatBusySetAt'],
  ['_combatBusy', 'session.tap.combatBusy'],
  ['_spellTargeting', 'session.tap.spellTargeting'],
  ['_lanternTargeting', 'session.tap.lanternTargeting'],
  ['_mistFormFlipsRemaining', 'session.tap.mistFormFlipsRemaining'],
  ['_spyglassTargeting', 'session.tap.spyglassTargeting'],
  ['_blindingLightTargeting', 'session.tap.blindingLightTargeting'],
  ['_divineLightSelecting', 'session.tap.divineLightSelecting'],
  ['_ricochetSelecting', 'session.tap.ricochetSelecting'],
  ['_ricochetTiles', 'session.tap.ricochetTiles'],
  ['_arrowBarrageSelecting', 'session.tap.arrowBarrageSelecting'],
  ['_tripleVolleyCenter', 'session.tap.tripleVolleyCenter'],
  ['_poisonArrowShotSelecting', 'session.tap.poisonArrowShotSelecting'],
  ['_engineerPendingTile', 'session.tap.engineerPendingTile'],
  ['_throwingKnifeTargeting', 'session.tap.throwingKnifeTargeting'],
  ['_rustyNailTargeting', 'session.tap.rustyNailTargeting'],
  ['_twinBladesTargeting', 'session.tap.twinBladesTargeting'],
  ['_chainLightningSelecting', 'session.tap.chainLightningSelecting'],
  ['_telekineticThrowStep', 'session.tap.telekineticThrowStep'],
  ['_telekineticEnemyTile', 'session.tap.telekineticEnemyTile'],
  ['_strengthenMinionSelecting', 'session.tap.strengthenMinionSelecting'],
  ['_corpseExplosionSelecting', 'session.tap.corpseExplosionSelecting'],
]

for (const [from, to] of flagMap) {
  gc = gc.split(from).join(to)
}

// ── 2. Extract active grid section (after flag block removal) ──
const activeStart = lines.findIndex(l => l.includes('// ── Active grid helpers'))
const activeEnd = lines.findIndex((l, i) => i > activeStart && l.includes('// ── Angry Onion helpers'))
let activeBody = lines.slice(activeStart + 1, activeEnd).join('\n')

activeBody = activeBody
  .replace(/function _isInSubFloor\(\)/, 'export function isInSubFloor()')
  .replace(/function _getActiveTiles\(\)/, 'export function getActiveTiles()')
  .replace(/function _getActiveTileRows\(\)/, 'export function getActiveTileRows()')
  .replace(/function _getActiveTileAt\(/, 'export function getActiveTileAt(')
  .replace(/function _getActiveOrthogonal\(/, 'export function getActiveOrthogonal(')
  .replace(/function _syncCombatEngagementDom\(\)/, 'export function syncCombatEngagementDom()')
  .replace(/function _setCombatEngagement\(/, 'export function setCombatEngagement(')
  .replace(/function _clearCombatEngagementForTile\(/, 'export function clearCombatEngagementForTile(')
  .replace(/function _clearAllCombatEngagement\(\)/, 'export function clearAllCombatEngagement()')
  .replace(/function _isCombatCommitmentLocked\(\)/, 'export function isCombatCommitmentLocked()')
  .replace(/function _canAttackEnemy\(/, 'export function canAttackEnemy(')
  .replace(/function _suspendCombatEngagementForMultiTargetAbility\(\)/, 'export function suspendCombatEngagementForMultiTargetAbility()')
  .replace(/function _restoreCombatEngagementAfterMultiTargetAbility\(/, 'export function restoreCombatEngagementAfterMultiTargetAbility(')
  .replace(/_isInSubFloor\(\)/g, 'isInSubFloor()')
  .replace(/_getActiveTiles\(\)/g, 'getActiveTiles()')
  .replace(/_getActiveTileRows\(\)/g, 'getActiveTileRows()')
  .replace(/_getActiveTileAt\(/g, 'getActiveTileAt(')
  .replace(/_syncCombatEngagementDom\(\)/g, 'syncCombatEngagementDom()')

// ── 3. Extract onTileTap ──
const tapStart = lines.findIndex(l => l.startsWith('function onTileTap('))
const tapEnd = lines.findIndex((l, i) => i > tapStart && l.includes('// ── Tile hold'))
let tapBody = lines.slice(tapStart, tapEnd).join('\n')

tapBody = tapBody
  .replace(/^function onTileTap\(row, col\)/, 'export function onTileTap(ctx, row, col)')

// ctx replacements for GameController helpers called from onTileTap
const ctxReplacements = [
  [/\b_syncAllUnrevealedLockedDom\(\)/g, 'ctx.syncAllUnrevealedLockedDom()'],
  [/\b_charKey\(\)/g, 'ctx.charKey()'],
  [/\b_handleEngineerConstructTileTap\(/g, 'ctx.handleEngineerConstructTileTap('],
  [/\b_isCombatCommitmentLocked\(\)/g, 'ctx.isCombatCommitmentLocked()'],
  [/\b_cancelStrengthenMinionMode\(\)/g, 'ctx.cancelStrengthenMinionMode()'],
  [/\b_syncMinionVisual\(/g, 'ctx.syncMinionVisual('],
  [/\b_saveActiveRun\(\)/g, 'ctx.saveActiveRun()'],
  [/\b_executeCorpseExplosion\(/g, 'ctx.executeCorpseExplosion('],
  [/\b_castSpell\(/g, 'ctx.castSpell('],
  [/\b_rand\(/g, 'ctx.rand('],
  [/\b_gainGold\(/g, 'ctx.gainGold('],
  [/\b_gainXP\(/g, 'ctx.gainXP('],
  [/\b_endCombatVictory\(/g, 'ctx.endCombatVictory('],
  [/\b_useLanternOn\(/g, 'ctx.useLanternOn('],
  [/\b_useSpyglassOn\(/g, 'ctx.useSpyglassOn('],
  [/\b_castBlindingLight\(/g, 'ctx.castBlindingLight('],
  [/\b_castDivineLightSmite\(/g, 'ctx.castDivineLightSmite('],
  [/\b_stillWaterManaCost\(/g, 'ctx.stillWaterManaCost('],
  [/\b_tearyExtraCost\(\)/g, 'ctx.tearyExtraCost()'],
  [/\b_executeTripleVolley\(/g, 'ctx.executeTripleVolley('],
  [/\b_executePoisonArrowShot\(/g, 'ctx.executePoisonArrowShot('],
  [/\b_executeRicochet\(\)/g, 'ctx.executeRicochet()'],
  [/\b_executeChainLightning\(/g, 'ctx.executeChainLightning('],
  [/\b_isTelekineticThrowEnemyTarget\(/g, 'ctx.isTelekineticThrowEnemyTarget('],
  [/\b_cancelTelekineticThrowMode\(\)/g, 'ctx.cancelTelekineticThrowMode()'],
  [/\b_isTelekineticThrowDestination\(/g, 'ctx.isTelekineticThrowDestination('],
  [/\b_executeTelekineticThrow\(/g, 'ctx.executeTelekineticThrow('],
  [/\b_getActiveTileAt\(/g, 'ctx.getActiveTileAt('],
  [/\b_enterSubFloor\(/g, 'ctx.enterSubFloor('],
  [/\b_destroyWarBanner\(/g, 'ctx.destroyWarBanner('],
  [/\b_openChest\(/g, 'ctx.openChest('],
  [/\b_openMagicChest\(/g, 'ctx.openMagicChest('],
  [/\brevealTile\(/g, 'ctx.revealTile('],
  [/\b_openForge\(/g, 'ctx.openForge('],
  [/\b_confirmExit\(/g, 'ctx.confirmExit('],
  [/\b_confirmRope\(/g, 'ctx.confirmRope('],
  [/\b_openEvent\(/g, 'ctx.openEvent('],
  [/\b_climbThroughHazard\(/g, 'ctx.climbThroughHazard('],
  [/\b_necroRaiseMinion\(/g, 'ctx.necroRaiseMinion('],
  [/\bfightAction\(/g, 'ctx.fightAction('],
  [/\b_hapticFromUserGesture\(/g, 'ctx.hapticFromUserGesture('],
  [/\b_hasNecroMetaUpgrade\(/g, 'ctx.hasNecroMetaUpgrade('],
]

for (const [pat, rep] of ctxReplacements) {
  tapBody = tapBody.replace(pat, rep)
}

// Apply flag map to tap body too
for (const [from, to] of flagMap) {
  tapBody = tapBody.split(from).join(to)
}

const header = `import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import TileEngine from '../systems/TileEngine.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { STRENGTHEN_MINION_COST } from '../data/necromancer.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

`

fs.writeFileSync('js/controllers/TileTapRouter.js', header + activeBody + '\n\n' + tapBody + '\n')

// ── 4. Patch GameController: remove flag block, active grid, onTileTap ──
gc = fs.readFileSync(gcPath, 'utf8')
// re-apply flags since we read fresh... actually gc was modified in memory, write flags first
fs.writeFileSync(gcPath, gc)

gc = fs.readFileSync(gcPath, 'utf8')

// Remove flag declarations block
gc = gc.replace(
  /\/\/ ── Tile tap router ─+\n\n(?:let session\.tap\.\w+[\s\S]*?\n)*\n\/\*\* Single focused enemy[\s\S]*?let session\.tap\.combatEngagementTile = null\n\n/,
  '// ── Tile tap router (flags in RunContext.session.tap; logic in TileTapRouter) ──\n\n',
)

// Remove active grid section
gc = gc.replace(
  /\/\/ ── Active grid helpers[\s\S]*?function _restoreCombatEngagementAfterMultiTargetAbility\(saved\) \{[\s\S]*?\n\}\n\n/,
  '',
)

// Remove onTileTap body - replace with wrapper
gc = gc.replace(
  /function onTileTap\(row, col\) \{[\s\S]*?\n\}\n\n\/\/ ── Tile hold/,
  `function onTileTap(row, col) { TapRouter.onTileTap(_tapCtx(), row, col) }\n\n// ── Tile hold`,
)

// Add import if missing
if (!gc.includes("from '../controllers/TileTapRouter.js'")) {
  gc = gc.replace(
    "import * as GSH from './GameStateHandlers.js'\n",
    "import * as GSH from './GameStateHandlers.js'\nimport * as TapRouter from '../controllers/TileTapRouter.js'\n",
  )
}

// Add tap aliases + _tapCtx before Init section (after _resetCombatOnDeath)
const tapAliases = `
// Active grid + combat engagement (TileTapRouter)
const _isInSubFloor = TapRouter.isInSubFloor
const _getActiveTiles = TapRouter.getActiveTiles
const _getActiveTileRows = TapRouter.getActiveTileRows
const _getActiveTileAt = TapRouter.getActiveTileAt
const _getActiveOrthogonal = TapRouter.getActiveOrthogonal
const _syncCombatEngagementDom = TapRouter.syncCombatEngagementDom
const _setCombatEngagement = TapRouter.setCombatEngagement
const _clearCombatEngagementForTile = TapRouter.clearCombatEngagementForTile
const _clearAllCombatEngagement = TapRouter.clearAllCombatEngagement
const _isCombatCommitmentLocked = TapRouter.isCombatCommitmentLocked
const _canAttackEnemy = TapRouter.canAttackEnemy
const _suspendCombatEngagementForMultiTargetAbility = TapRouter.suspendCombatEngagementForMultiTargetAbility
const _restoreCombatEngagementAfterMultiTargetAbility = TapRouter.restoreCombatEngagementAfterMultiTargetAbility

function _tapCtx() {
  return {
    ..._stateCtx(),
    charKey: _charKey,
    syncAllUnrevealedLockedDom: _syncAllUnrevealedLockedDom,
    handleEngineerConstructTileTap: _handleEngineerConstructTileTap,
    isCombatCommitmentLocked: _isCombatCommitmentLocked,
    cancelStrengthenMinionMode: _cancelStrengthenMinionMode,
    syncMinionVisual: _syncMinionVisual,
    saveActiveRun: _saveActiveRun,
    executeCorpseExplosion: _executeCorpseExplosion,
    castSpell: _castSpell,
    rand: _rand,
    gainGold: _gainGold,
    gainXP: _gainXP,
    endCombatVictory: _endCombatVictory,
    useLanternOn: _useLanternOn,
    useSpyglassOn: _useSpyglassOn,
    castBlindingLight: _castBlindingLight,
    castDivineLightSmite: _castDivineLightSmite,
    stillWaterManaCost: _stillWaterManaCost,
    tearyExtraCost: _tearyExtraCost,
    executeTripleVolley: _executeTripleVolley,
    executePoisonArrowShot: _executePoisonArrowShot,
    executeRicochet: _executeRicochet,
    executeChainLightning: _executeChainLightning,
    isTelekineticThrowEnemyTarget: _isTelekineticThrowEnemyTarget,
    cancelTelekineticThrowMode: _cancelTelekineticThrowMode,
    isTelekineticThrowDestination: _isTelekineticThrowDestination,
    executeTelekineticThrow: _executeTelekineticThrow,
    getActiveTileAt: _getActiveTileAt,
    enterSubFloor: _enterSubFloor,
    destroyWarBanner: _destroyWarBanner,
    openChest: _openChest,
    openMagicChest: _openMagicChest,
    revealTile,
    openForge: _openForge,
    confirmExit: _confirmExit,
    confirmRope: _confirmRope,
    openEvent: _openEvent,
    climbThroughHazard: _climbThroughHazard,
    necroRaiseMinion: _necroRaiseMinion,
    fightAction,
    hapticFromUserGesture: _hapticFromUserGesture,
    hasNecroMetaUpgrade: _hasNecroMetaUpgrade,
  }
}

`

if (!gc.includes('function _tapCtx()')) {
  gc = gc.replace('function _resetCombatOnDeath() {', tapAliases + 'function _resetCombatOnDeath() {')
}

fs.writeFileSync(gcPath, gc)
console.log('PR6 migration done')
console.log('TileTapRouter lines:', (header + activeBody + tapBody).split('\n').length)
console.log('GameController lines:', gc.split('\n').length)
