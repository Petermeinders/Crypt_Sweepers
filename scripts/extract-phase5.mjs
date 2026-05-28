/**
 * Phase 5: Extract EventTile, SubFloor, Forge, EnemyMechanics, PlayerStats from GameController.
 * Run: node scripts/extract-phase5.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const gcPath = path.join(ROOT, 'js/core/GameController.js')
let src = fs.readFileSync(gcPath, 'utf8')

function extractFn(source, name) {
  const re = new RegExp(`function ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\([^)]*\\)\\s*\\{`, 'm')
  const m = re.exec(source)
  if (!m) {
    console.warn(`WARN: function ${name} not found`)
    return null
  }
  let i = m.index + m[0].length
  let depth = 1
  while (i < source.length && depth > 0) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    i++
  }
  return source.slice(m.index, i)
}

function extractConst(source, name) {
  const re = new RegExp(`const ${name}\\s*=`, 'm')
  const m = re.exec(source)
  if (!m) return null
  const start = m.index
  let i = start
  while (i < source.length && source[i] !== '\n') i++
  return source.slice(start, i + 1)
}

function removeFromSource(source, chunk) {
  if (!chunk) return source
  return source.replace(chunk + '\n', '').replace(chunk, '')
}

function stripUnderscoreExport(body, publicNames) {
  return body.replace(/^function (_?[a-zA-Z][a-zA-Z0-9]*)\(/gm, (match, fnName) => {
    const bare = fnName.startsWith('_') ? fnName.slice(1) : fnName
    const isPublic = !fnName.startsWith('_') || publicNames.includes(bare)
    return isPublic ? `export function ${bare}(` : `function ${bare}(`
  })
}

/** Replace _helper( with ctx.helper( except listed local names */
function ctxify(body, localNames, extraSkip = []) {
  const skip = new Set([...localNames, ...extraSkip])
  return body.replace(/_([a-zA-Z][a-zA-Z0-9]*)\(/g, (match, name) => {
    if (skip.has(name)) return match.replace('_', '')
    return `ctx.${name}(`
  })
}

// ── PlayerStats ──────────────────────────────────────────────
const PS_FNS = ['playerOutgoingDamageMult', 'scaleOutgoingDamageToEnemy', 'xpNeeded', 'computeEffectiveDamageTaken', 'playerDamageRange']
let psChunks = PS_FNS.map(n => extractFn(src, `_${n}`)).filter(Boolean)
const psBody = psChunks.map(c => stripUnderscoreExport(c, PS_FNS)).join('\n\n')
  .replace(/hasItem\(/g, 'ctx.hasItem(')

const playerStatsFile = `import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { session } from '../core/RunContext.js'

${psBody.replace(/^export function playerOutgoingDamageMult\(/m, 'export function playerOutgoingDamageMult(ctx) {\n  const hasItem = ctx.hasItem\n  return playerOutgoingDamageMultImpl()\n}\nfunction playerOutgoingDamageMultImpl() {').replace(/^export function scaleOutgoingDamageToEnemy\(/m, 'export function scaleOutgoingDamageToEnemy(ctx, dmg) {\n  const hasItem = ctx.hasItem\n  return scaleOutgoingDamageToEnemyImpl(dmg)\n}\nfunction scaleOutgoingDamageToEnemyImpl(dmg) {')}
`

// Simpler approach: pass hasItem via ctx in each function
const psSimple = psChunks.map(c => {
  let b = stripUnderscoreExport(c, PS_FNS)
  b = b.replace(/hasItem\(/g, 'ctx.hasItem(')
  return b
}).join('\n\n')

const playerStatsFinal = `import { CONFIG } from '../config.js'
import { RANGER_BASE } from '../data/ranger.js'
import { VAMPIRE_BASE } from '../data/vampire.js'
import { session } from '../core/RunContext.js'

${psSimple}
`

for (const c of psChunks) src = removeFromSource(src, c)

// ── EnemyMechanics ───────────────────────────────────────────
const EM_FNS = ['applyFreezingHit', 'applyCorruption', 'applyBurnHit', 'applyPlayerPoison', 'findLiveHulk', 'applyHulkBuffToTile', 'removeHulkBuffFromAll', 'applyHulkBuffToAll']
let emChunks = EM_FNS.map(n => extractFn(src, `_${n}`)).filter(Boolean)
const crewConst = extractConst(src, 'CREW_BUFF_HP')
if (crewConst) {
  emChunks.unshift(crewConst)
  src = removeFromSource(src, crewConst)
}
const emBody = emChunks.map(c => {
  if (c.startsWith('const')) return c
  return stripUnderscoreExport(c, EM_FNS)
}).join('\n\n')

const enemyMechFinal = `import UI from '../ui/UI.js'
import TileEngine from './TileEngine.js'
import { session } from '../core/RunContext.js'

${emBody}
`

for (const c of emChunks.filter(c => !c.startsWith('const'))) src = removeFromSource(src, c)

// ── ForgeController ──────────────────────────────────────────
const FORGE_FNS = ['openForge', 'doForge']
let forgeChunks = FORGE_FNS.map(n => extractFn(src, `_${n}`)).filter(Boolean)
const forgeBody = forgeChunks.map(c => stripUnderscoreExport(c, FORGE_FNS)
  .replace(/dropItem\(/g, 'ctx.dropItem(')
  .replace(/_canAddToBackpack\(/g, 'ctx.canAddToBackpack(')
  .replace(/_addToBackpack\(/g, 'ctx.addToBackpack(')
).join('\n\n')

const forgeFinal = `import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from './TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { session } from '../core/RunContext.js'

${forgeBody}
`

for (const c of forgeChunks) src = removeFromSource(src, c)
// Remove forge section header
src = src.replace(/\n\/\/ ── Forge ─[^\n]*\n\n/, '\n')

// ── EventTileController ─────────────────────────────────────
const EVT_FNS = ['openEvent', 'closeEventSession', 'rollMerchantTrinket', 'openMerchantShop', 'doMerchantBuy',
  'openGamblerEvent', 'openTripleChestEvent', 'openTrinketTraderEvent', 'rollTrinketTradeReward', 'openStoryEvent', 'applyStoryOutcome']
let evtChunks = EVT_FNS.map(n => extractFn(src, `_${n}`)).filter(Boolean)
const evtLocal = new Set(['rollMerchantTrinket', 'openMerchantShop', 'doMerchantBuy', 'openGamblerEvent', 'openTripleChestEvent',
  'openTrinketTraderEvent', 'rollTrinketTradeReward', 'openStoryEvent', 'applyStoryOutcome'])
const evtBody = evtChunks.map(c => {
  let b = stripUnderscoreExport(c, ['openEvent', 'closeEventSession'])
  b = ctxify(b, [...evtLocal], ['charKey', 'rand', 'pickRandom'])
  b = b.replace(/dropItem\(/g, 'ctx.dropItem(')
  b = b.replace(/_pickRandom\(/g, 'ctx.pickRandom(')
  b = b.replace(/_rollCommonLoot\(/g, 'ctx.rollCommonLoot(')
  b = b.replace(/_addToBackpack\(/g, 'ctx.addToBackpack(')
  b = b.replace(/_canAddToBackpack\(/g, 'ctx.canAddToBackpack(')
  b = b.replace(/_gainGold\(/g, 'ctx.gainGold(')
  b = b.replace(/_takeDamage\(/g, 'ctx.takeDamage(')
  b = b.replace(/_closeEventSession\(/g, 'closeEventSession(ctx, ')
  b = b.replace(/_openMerchantShop\(/g, 'openMerchantShop(ctx, ')
  b = b.replace(/_openGamblerEvent\(/g, 'openGamblerEvent(ctx, ')
  b = b.replace(/_openTripleChestEvent\(/g, 'openTripleChestEvent(ctx, ')
  b = b.replace(/_openTrinketTraderEvent\(/g, 'openTrinketTraderEvent(ctx, ')
  b = b.replace(/_openStoryEvent\(/g, 'openStoryEvent(ctx, ')
  b = b.replace(/_doMerchantBuy\(/g, 'doMerchantBuy(ctx, ')
  b = b.replace(/_applyStoryOutcome\(/g, 'applyStoryOutcome(ctx, ')
  b = b.replace(/_rollMerchantTrinket\(/g, 'rollMerchantTrinket(ctx')
  b = b.replace(/_rollTrinketTradeReward\(/g, 'rollTrinketTradeReward(ctx')
  b = b.replace(/_flushDeferredLevelUpXp\(/g, 'ctx.flushDeferredLevelUpXp(')
  return b
}).join('\n\n')

const eventFinal = `import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import UI from '../ui/UI.js'
import { ITEMS } from '../data/items.js'
import { STORY_EVENTS, MERCHANT_ITEMS, rollEventType } from '../data/events.js'
import {
  COMMON_LOOT_IDS,
  RARE_TRINKET_IDS,
  LEGENDARY_TRINKET_IDS,
} from './LootTables.js'
import { session } from '../core/RunContext.js'

${evtBody}
`

for (const c of evtChunks) src = removeFromSource(src, c)
src = src.replace(/\n\/\/ ── Event tile ─[^\n]*\n\n/, '\n')
src = src.replace(/\n\/\/ ── Merchant shop ─[^\n]*\n\n/, '\n')
src = src.replace(/\n\/\/ ── Gambler event ─[^\n]*\n\n/, '\n')
src = src.replace(/\n\/\/ ── Triple chest event ─[^\n]*\n\n/, '\n')
src = src.replace(/\n\/\/ ── Trinket Trader event ─[^\n]*\n\n/, '\n')
src = src.replace(/\n\/\/ ── Story event ─[^\n]*\n\n/, '\n')

// ── SubFloorController ─────────────────────────────────────
const SF_FNS = [
  'spawnSubFloorEntry', 'applyWarBannerBuffToEnemyGrid', 'stripWarBannerBuff', 'syncWarBannerCoordsFromGrid',
  'spawnWarBannerEntry', 'destroyWarBanner', 'enterSubFloor', 'loadSubFloor', 'exitSubFloor',
  'onSubFloorTileHold', 'onSubFloorTileTap', 'openSubFloorChest', 'sfRevealMainFloorExit', 'sfFadeOutTileIcon',
  'subFloorReveal', 'sfLockAdjacent', 'sfUnlockAdjacent', 'subFloorFight', 'openShrine', 'recomputeSubFloorEnemyLocks',
  'patchActiveTileDom',
]
let sfChunks = SF_FNS.map(n => extractFn(src, `_${n}`)).filter(Boolean)
const sfLocal = new Set([
  'spawnSubFloorEntry', 'applyWarBannerBuffToEnemyGrid', 'stripWarBannerBuff', 'syncWarBannerCoordsFromGrid',
  'spawnWarBannerEntry', 'loadSubFloor', 'exitSubFloor', 'openSubFloorChest', 'sfRevealMainFloorExit', 'sfFadeOutTileIcon',
  'subFloorReveal', 'sfLockAdjacent', 'sfUnlockAdjacent', 'openShrine', 'onSubFloorTileHold',
])
const sfExport = new Set(['spawnSubFloorEntry', 'spawnWarBannerEntry', 'syncWarBannerCoordsFromGrid', 'destroyWarBanner',
  'enterSubFloor', 'exitSubFloor', 'onSubFloorTileTap', 'onSubFloorTileHold', 'recomputeSubFloorEnemyLocks', 'patchActiveTileDom'])
const sfBody = sfChunks.map(c => {
  let b = stripUnderscoreExport(c, [...sfExport])
  b = b.replace(/_loadSubFloor\(/g, 'loadSubFloor(ctx, ')
  b = b.replace(/_exitSubFloor\(/g, 'exitSubFloor(ctx')
  b = b.replace(/_openSubFloorChest\(/g, 'openSubFloorChest(ctx, ')
  b = b.replace(/_openShrine\(/g, 'openShrine(ctx, ')
  b = b.replace(/_subFloorReveal\(/g, 'subFloorReveal(ctx, ')
  b = b.replace(/_subFloorFight\(/g, 'subFloorFight(ctx, ')
  b = b.replace(/_tryConsumeTargetingTap\(/g, 'ctx.tryConsumeTargetingTap(')
  b = b.replace(/_onSubFloorTileTap/g, 'onSubFloorTileTap')
  b = b.replace(/_onSubFloorTileHold/g, 'onSubFloorTileHold')
  b = b.replace(/onTileTap/g, 'ctx.onTileTap')
  b = b.replace(/onTileHold/g, 'ctx.onTileHold')
  b = b.replace(/_isInSubFloor\(/g, 'ctx.isInSubFloor(')
  b = b.replace(/_charKey\(/g, 'ctx.charKey(')
  b = b.replace(/_rand\(/g, 'ctx.rand(')
  b = b.replace(/_gainGold\(/g, 'ctx.gainGold(')
  b = b.replace(/_gainXP\(/g, 'ctx.gainXP(')
  b = b.replace(/_takeDamage\(/g, 'ctx.takeDamage(')
  b = b.replace(/_computeEffectiveDamageTaken\(/g, 'ctx.computeEffectiveDamageTaken(')
  b = b.replace(/_playerDamageRange\(/g, 'ctx.playerDamageRange(')
  b = b.replace(/_rollChestLoot\(/g, 'ctx.rollChestLoot(')
  b = b.replace(/_addToBackpack\(/g, 'ctx.addToBackpack(')
  b = b.replace(/_forcePlayChestGif\(/g, 'ctx.forcePlayChestGif(')
  b = b.replace(/_saveActiveRun\(/g, 'ctx.saveActiveRun(')
  b = b.replace(/_refreshMainGridDomFromModel\(/g, 'ctx.refreshMainGridDomFromModel(')
  b = b.replace(/_syncGridDomClassesFromModel\(/g, 'ctx.syncGridDomClassesFromModel(')
  b = b.replace(/_applyWarBannerBuffToEnemyGrid\(/g, 'applyWarBannerBuffToEnemyGrid(')
  b = b.replace(/_stripWarBannerBuff\(/g, 'stripWarBannerBuff(')
  return b
}).join('\n\n')

const subFloorFinal = `import { CONFIG } from '../config.js'
import GameState from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import CombatResolver from '../systems/CombatResolver.js'
import UI from '../ui/UI.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE, ITEM_ICONS_BASE } from '../data/tileIcons.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ITEMS } from '../data/items.js'
import { session } from '../core/RunContext.js'

${sfBody}
`

for (const c of sfChunks) src = removeFromSource(src, c)
src = src.replace(/\n\/\/ ── Sub-floor ─[^\n]*\n\n/, '\n')

// Write modules
fs.mkdirSync(path.join(ROOT, 'js/systems'), { recursive: true })
fs.mkdirSync(path.join(ROOT, 'js/controllers'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'js/systems/PlayerStats.js'), playerStatsFinal)
fs.writeFileSync(path.join(ROOT, 'js/systems/EnemyMechanics.js'), enemyMechFinal)
fs.writeFileSync(path.join(ROOT, 'js/controllers/ForgeController.js'), forgeFinal)
fs.writeFileSync(path.join(ROOT, 'js/controllers/EventTileController.js'), eventFinal)
fs.writeFileSync(path.join(ROOT, 'js/controllers/SubFloorController.js'), subFloorFinal)

// Patch GameController imports
const importBlock = `import * as PlayerStats from '../systems/PlayerStats.js'
import * as EnemyMechanics from '../systems/EnemyMechanics.js'
import * as ForgeController from '../controllers/ForgeController.js'
import * as EventTileController from '../controllers/EventTileController.js'
import * as SubFloorController from '../controllers/SubFloorController.js'
`
if (!src.includes('PlayerStats.js')) {
  src = src.replace(
    'import * as Vampire from \'../heroes/vampire.js\'',
    `import * as Vampire from '../heroes/vampire.js'\n${importBlock}`,
  )
}

// Insert wrappers after hasItem function
const wrappers = `
// ── Player stats + enemy mechanics (extracted) ───────────────
const _playerOutgoingDamageMult = () => PlayerStats.playerOutgoingDamageMult({ hasItem })
const _scaleOutgoingDamageToEnemy = (dmg) => PlayerStats.scaleOutgoingDamageToEnemy({ hasItem }, dmg)
const _xpNeeded = () => PlayerStats.xpNeeded()
const _computeEffectiveDamageTaken = (raw) => PlayerStats.computeEffectiveDamageTaken(raw)
const _playerDamageRange = (p) => PlayerStats.playerDamageRange(p, hasItem)
const _applyFreezingHit = () => EnemyMechanics.applyFreezingHit()
const _applyCorruption = () => EnemyMechanics.applyCorruption()
const _applyBurnHit = (amt) => EnemyMechanics.applyBurnHit(amt)
const _applyPlayerPoison = (amt) => EnemyMechanics.applyPlayerPoison(amt)
const _findLiveHulk = () => EnemyMechanics.findLiveHulk()
const _applyHulkBuffToTile = (t) => EnemyMechanics.applyHulkBuffToTile(t)
const _removeHulkBuffFromAll = () => EnemyMechanics.removeHulkBuffFromAll()
const _applyHulkBuffToAll = () => EnemyMechanics.applyHulkBuffToAll()

function _forgeCtx() {
  return {
    dropItem,
    canAddToBackpack: _canAddToBackpack,
    addToBackpack: _addToBackpack,
  }
}
const _openForge = (tile) => ForgeController.openForge(_forgeCtx(), tile)

function _eventCtx() {
  return {
    pickRandom: _pickRandom,
    rollCommonLoot: _rollCommonLoot,
    addToBackpack: _addToBackpack,
    canAddToBackpack: _canAddToBackpack,
    dropItem,
    gainGold: _gainGold,
    takeDamage: _takeDamage,
    flushDeferredLevelUpXp: _flushDeferredLevelUpXp,
  }
}
const _openEvent = (tile) => EventTileController.openEvent(_eventCtx(), tile)
const _closeEventSession = (tile) => EventTileController.closeEventSession(_eventCtx(), tile)

function _subFloorCtx() {
  return {
    charKey: _charKey,
    rand: _rand,
    gainGold: _gainGold,
    gainXP: _gainXP,
    takeDamage: _takeDamage,
    computeEffectiveDamageTaken: _computeEffectiveDamageTaken,
    playerDamageRange: _playerDamageRange,
    rollChestLoot: _rollChestLoot,
    addToBackpack: _addToBackpack,
    forcePlayChestGif: _forcePlayChestGif,
    saveActiveRun: _saveActiveRun,
    refreshMainGridDomFromModel: _refreshMainGridDomFromModel,
    syncGridDomClassesFromModel: _syncGridDomClassesFromModel,
    tryConsumeTargetingTap: _tryConsumeTargetingTap,
    isInSubFloor: _isInSubFloor,
    onTileTap,
    onTileHold,
  }
}
const _spawnSubFloorEntry = () => SubFloorController.spawnSubFloorEntry()
const _applyWarBannerBuffToEnemyGrid = (m) => SubFloorController.applyWarBannerBuffToEnemyGrid(m)
const _stripWarBannerBuff = (m) => SubFloorController.stripWarBannerBuff(m)
const _syncWarBannerCoordsFromGrid = () => SubFloorController.syncWarBannerCoordsFromGrid()
const _spawnWarBannerEntry = () => SubFloorController.spawnWarBannerEntry()
const _destroyWarBanner = (t) => SubFloorController.destroyWarBanner(_subFloorCtx(), t)
const _enterSubFloor = (t) => SubFloorController.enterSubFloor(_subFloorCtx(), t)
const _exitSubFloor = () => SubFloorController.exitSubFloor()
const _onSubFloorTileTap = (r, c) => SubFloorController.onSubFloorTileTap(_subFloorCtx(), r, c)
const _onSubFloorTileHold = (r, c) => SubFloorController.onSubFloorTileHold(r, c)
const _recomputeSubFloorEnemyLocks = () => SubFloorController.recomputeSubFloorEnemyLocks()
const _patchActiveTileDom = (r, c) => SubFloorController.patchActiveTileDom(_subFloorCtx(), r, c)
const _sfUnlockAdjacent = (t) => SubFloorController.sfUnlockAdjacent(t)
`

if (!src.includes('Player stats + enemy mechanics')) {
  src = src.replace(
    'function hasItem(id) { return session.run?.player?.inventory?.some(e => e?.id === id) ?? false }',
    `function hasItem(id) { return session.run?.player?.inventory?.some(e => e?.id === id) ?? false }\n${wrappers}`,
  )
}

// Remove duplicate function definitions if script re-run left any - also remove old xpNeeded at bottom
const dupFns = ['function _xpNeeded()', 'function _computeEffectiveDamageTaken(', 'function _playerDamageRange(']
for (const sig of dupFns) {
  const chunk = extractFn(src, sig.match(/function (_?\w+)/)[1])
  if (chunk && src.indexOf('PlayerStats') > -1) {
    src = removeFromSource(src, chunk)
  }
}

// Remove player stat helpers section header if orphaned
src = src.replace(/\n\/\/ ── Player stat helpers ─[^\n]*\n\nfunction _computeEffectiveDamageTaken[\s\S]*?function _playerDamageRange[\s\S]*?\n\}\n\n+/m, '\n')

fs.writeFileSync(gcPath, src)
console.log('Phase 5 extraction complete.')
console.log('PlayerStats:', psChunks.length, 'functions')
console.log('EnemyMechanics:', emChunks.length, 'chunks')
console.log('Forge:', forgeChunks.length, 'functions')
console.log('Event:', evtChunks.length, 'functions')
console.log('SubFloor:', sfChunks.length, 'functions')
