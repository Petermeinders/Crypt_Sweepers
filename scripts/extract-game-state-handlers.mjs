import fs from 'fs'

const gc = fs.readFileSync('js/core/GameController.js', 'utf8')
const lines = gc.split('\n')

function slice(startPat, endPat) {
  const start = lines.findIndex(l => l.includes(startPat))
  const end = lines.findIndex((l, i) => i > start && l.includes(endPat))
  return lines.slice(start, end).join('\n')
}

function xform(body) {
  return body
    .replace(/\b_save\b/g, 'session.save')
    .replace(/\b_lastRunTelemetrySnapshot\b/g, 'session.lastRunTelemetrySnapshot')
    .replace(/\brun\b/g, 'session.run')
    .replace(/function buildRunState\(\)/, 'export function buildRunState(ctx)')
    .replace(/function init\(saveData\)/, 'export function init(ctx, saveData)')
    .replace(/function newGame\(\)/, 'export function newGame(ctx)')
    .replace(/function _serializeGridSnapshot\(\)/, 'function serializeGridSnapshot(ctx)')
    .replace(/function _saveActiveRun\(\)/, 'export function saveActiveRun(ctx)')
    .replace(/function _clearActiveRun\(\)/, 'export function clearActiveRun(ctx)')
    .replace(/function _runMusicTrack\(\)/, 'function runMusicTrack(ctx)')
    .replace(/function resumeRun\(\)/, 'export function resumeRun(ctx)')
    .replace(/function abandonRun\(\)/, 'export function abandonRun(ctx)')
    .replace(/function returnToMenu\(autoSave = false\)/, 'export function returnToMenu(ctx, autoSave = false)')
    .replace(/function doRetreat\(reason = 'player'\)/, 'export function doRetreat(ctx, reason = \'player\')')
    .replace(/function _die\(killerData = null, opts = \{\}\)/, 'export function die(ctx, killerData = null, opts = {})')
    .replace(/function _buildKillerCard\(e\)/, 'export function buildKillerCard(e)')
    .replace(/function _runStats\(\)/, 'export function runStats(ctx)')
    .replace(/function _buildRunEndSummary\(outcomeType, extras = \{\}\)/, 'function buildRunEndSummary(ctx, outcomeType, extras = {})')
    .replace(/function _finalizeRunTelemetry\(outcomeType, extras = \{\}\)/, 'export function finalizeRunTelemetry(ctx, outcomeType, extras = {})')
    .replace(/function _wireRunSummaryBtn\(\)/, 'export function wireRunSummaryBtn(ctx)')
    .replace(/_charKey\(\)/g, 'ctx.charKey()')
    .replace(/_applyEquippedGear\(/g, 'ctx.applyEquippedGear(')
    .replace(/_startFloor\(\)/g, 'ctx.startFloor()')
    .replace(/_serializeGridSnapshot\(\)/g, 'serializeGridSnapshot(ctx)')
    .replace(/_combatEngagementTile/g, 'ctx.getCombatEngagementTile()')
    .replace(/_computeEffectiveDamageTaken/g, 'ctx.computeEffectiveDamageTaken')
    .replace(/_clearActiveRun\(\)/g, 'clearActiveRun(ctx)')
    .replace(/_runMusicTrack\(\)/g, 'runMusicTrack(ctx)')
    .replace(/returnToMenu\(/g, 'returnToMenu(ctx, ')
    .replace(/returnToMenu\(ctx, true\)/g, 'returnToMenu(ctx, true)')
    .replace(/returnToMenu\(ctx, false\)/g, 'returnToMenu(ctx, false)')
    .replace(/returnToMenu\(ctx, \)/g, 'returnToMenu(ctx)')
    .replace(/buildRunState\(\)/g, 'buildRunState(ctx)')
    .replace(/_runStats\(\)/g, 'runStats(ctx)')
    .replace(/_buildRunEndSummary\(/g, 'buildRunEndSummary(ctx, ')
    .replace(/_finalizeRunTelemetry\(/g, 'finalizeRunTelemetry(ctx, ')
    .replace(/_wireRunSummaryBtn\(\)/g, 'wireRunSummaryBtn(ctx)')
    .replace(/_buildKillerCard\(/g, 'buildKillerCard(')
    .replace(/_closeEventSession\(/g, 'ctx.closeEventSession(')
    .replace(/_runStats\(\)/g, 'runStats(ctx)')
    .replace(/ctx\.resetCombatOnDeath\(\)/g, 'ctx.resetCombatOnDeath()')
}

const buildRun = xform(slice('function buildRunState()', '// ── Accessors'))
const initBlock = xform(slice('// ── Init', '// ── Gear stat helpers'))
const persistBlock = xform(slice('function _serializeGridSnapshot()', 'function _adjustPlayerStat'))
const menuBlock = xform(slice('function _clearActiveRun()', '// ── Return to menu'))
const returnMenu = xform(slice('function returnToMenu(autoSave = false)', 'function _startFloor()'))

// death + telemetry — extract manually from file
const dieStart = lines.findIndex(l => l.includes('// ── Death'))
const dieEnd = lines.findIndex((l, i) => i > dieStart && l.includes('// ── Inventory / backpack'))
const dieBlock = xform(lines.slice(dieStart + 1, dieEnd).join('\n'))

const retreatStart = lines.findIndex(l => l.includes('// ── Hasty Retreat'))
const retreatEnd = lines.findIndex((l, i) => i > retreatStart && l.includes('// ── Floor progression'))
const retreatBlock = xform(lines.slice(retreatStart + 1, retreatEnd).join('\n'))

// Fix double ctx in returnToMenu calls inside die
let all = [buildRun, initBlock, persistBlock, menuBlock, returnMenu, retreatBlock, dieBlock].join('\n\n')
all = all.replace(/returnToMenu\(ctx, ctx,/g, 'returnToMenu(ctx,')
all = all.replace(/ctx\.getCombatEngagementTile\(\) \? \{ \.\.\.ctx\.getCombatEngagementTile\(\) \}/g, 'ctx.getCombatEngagementTile() ? { ...ctx.getCombatEngagementTile() }')
all = all.replace(/combatEngagement: ctx\.getCombatEngagementTile\(\) \? \{ \.\.\.ctx\.getCombatEngagementTile\(\) \} : null/g,
  'combatEngagement: ctx.getCombatEngagementTile() ? { ...ctx.getCombatEngagementTile() } : null')

// die needs resetCombatOnDeath instead of inline resets
const dieResetPattern = /  _spellTargeting[\s\S]*?UI\.setCorruption\(0\) \}/
if (dieResetPattern.test(all)) {
  all = all.replace(dieResetPattern, '  ctx.resetCombatOnDeath()')
}

const header = `import { CONFIG } from '../config.js'
import GameState, { States } from './GameState.js'
import EventBus from './EventBus.js'
import Logger from './Logger.js'
import TileEngine from '../systems/TileEngine.js'
import MetaProgression from '../systems/MetaProgression.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import * as Haptics from '../systems/Haptics.js'
import { session, initSession, charKey } from './RunContext.js'
import { RANGER_BASE } from '../data/ranger.js'
import { ENGINEER_BASE, ENGINEER_SEISMIC_PING } from '../data/engineer.js'
import { MAGE_BASE } from '../data/mage.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { NECROMANCER_BASE } from '../data/necromancer.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { createInitialTelemetry } from '../balance/runTelemetry.js'

`

fs.writeFileSync('js/core/GameStateHandlers.js', header + all)
console.log('GameStateHandlers.js lines:', (header + all).split('\n').length)
