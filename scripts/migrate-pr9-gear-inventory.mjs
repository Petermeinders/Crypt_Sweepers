/**
 * PR9 — extract GearController + InventoryController from GameController.js
 */
import fs from 'fs'

const gcPath = 'js/core/GameController.js'
const lines = fs.readFileSync(gcPath, 'utf8').split('\n')

const idx = (pred) => lines.findIndex(pred)

const GEAR_START = idx(l => l.includes('// ── Gear stat helpers'))
const GEAR_END = idx(l => l.startsWith('function _clearActiveRun('))
const BLACKSMITH_START = idx(l => l.includes('// ── Blacksmith'))
const BLACKSMITH_END = idx(l => l.includes('// ── Death'))
const INV_SECTION = idx(l => l.includes('// ── Inventory / backpack'))
const CAN_ADD_END = idx(l => l.startsWith('function _checkFloorCleared('))
const USE_ITEM_START = idx(l => l.startsWith('function useItem('))
const USE_ITEM_END = idx(l => l.startsWith('function getInventory('))
const DROP_START = idx(l => l.startsWith('function dropItem('))
const DROP_END = idx(l => l.startsWith('// ── Balance bot bridge'))

function transformGear(body) {
  let b = body
    .replace(/^function _adjustPlayerStat\(/m, 'export function adjustPlayerStat(')
    .replace(/^function _applyGearStats\(/m, 'function applyGearStats(ctx, ')
    .replace(/^function _removeGearStats\(/m, 'function removeGearStats(ctx, ')
    .replace(/^function _applyEquippedGear\(/m, 'export function applyEquippedGear(ctx, ')
    .replace(/^function _equipGear\(/m, 'export function equipGear(ctx, ')
    .replace(/^function _unequipGear\(/m, 'export function unequipGear(ctx, ')
    .replace(/^function _handleGearPickup\(/m, 'export function handleGearPickup(ctx, ')
    .replace(/^function _tryGearDrop\(/m, 'export function tryGearDrop(ctx, ')
    .replace(/^function _adjustScrap\(/m, 'function adjustScrap(')
    .replace(/^function _applyGearUpgrade\(/m, 'function applyGearUpgrade(')
    .replace(/^function _upgradeGear\(/m, 'export function upgradeGear(ctx, ')
    .replace(/^function _disassembleGear\(/m, 'export function disassembleGear(ctx, ')
    .replace(/^function _reduceDetriment\(/m, 'export function reduceDetriment(ctx, ')

  const subs = [
    ['_adjustPlayerStat(', 'adjustPlayerStat('],
    ['_applyGearStats(', 'applyGearStats(ctx, '],
    ['_removeGearStats(', 'removeGearStats(ctx, '],
    ['_handleGearPickup(', 'handleGearPickup(ctx, '],
    ['_adjustScrap(', 'adjustScrap('],
    ['_applyGearUpgrade(', 'applyGearUpgrade('],
    ['_rand(', 'ctx.rand('],
    ['_playerDamageRange(', 'ctx.playerDamageRange('],
    ['_gearModule', 'gearModule'],
  ]
  for (const [from, to] of subs) b = b.split(from).join(to)

  // Remove duplicate BACKPACK constant inside handleGearPickup — use import
  b = b.replace(
    /  const BACKPACK_MAX_SLOTS = 9\n  const usedSlots = inv\.filter\(e => e !== null\)\.length\n  if \(usedSlots < BACKPACK_MAX_SLOTS\)/,
    '  const usedSlots = inv.filter(e => e !== null).length\n  if (usedSlots < BACKPACK_MAX_SLOTS)',
  )

  return b
}

function transformInventory(body) {
  let b = body
    .replace(/^async function _addToBackpack\(/m, 'export async function addToBackpack(ctx, ')
    .replace(/^function _canAddToBackpack\(/m, 'export function canAddToBackpack(ctx, ')
    .replace(/^function useItem\(/m, 'export function useItem(ctx, ')
    .replace(/^function dropItem\(/m, 'export function dropItem(ctx, ')
    .replace(/^async function forceReplaceItem\(/m, 'export async function forceReplaceItem(ctx, ')

  const subs = [
    ['_addToBackpack(', 'addToBackpack(ctx, '],
    ['_canAddToBackpack(', 'canAddToBackpack(ctx, '],
    ['_playerDamageRange(', 'ctx.playerDamageRange('],
    ['_rand(', 'ctx.rand('],
    ['_gainGold(', 'ctx.gainGold('],
    ['_die(', 'ctx.die('],
    ['_restoreHourglassSnapshot(', 'ctx.restoreHourglassSnapshot('],
    ['_isCombatCommitmentLocked()', 'isCombatCommitmentLocked()'],
    ['revealTile(', 'ctx.revealTile('],
    ['lanternAction()', 'ctx.lanternAction()'],
    ['dowsingRodAction()', 'ctx.dowsingRodAction()'],
    ['spyglassAction()', 'ctx.spyglassAction()'],
    ['hourglassAction()', 'ctx.hourglassAction()'],
  ]
  for (const [from, to] of subs) b = b.split(from).join(to)

  return b
}

const gearBody = transformGear([
  ...lines.slice(GEAR_START + 1, GEAR_END),
  '',
  ...lines.slice(BLACKSMITH_START + 1, BLACKSMITH_END),
].join('\n'))

const invBody = transformInventory([
  ...lines.slice(INV_SECTION + 1, CAN_ADD_END),
  '',
  ...lines.slice(USE_ITEM_START, USE_ITEM_END),
  '',
  ...lines.slice(DROP_START, DROP_END),
].join('\n'))

const gearHeader = `import { CONFIG } from '../config.js'
import EventBus from '../core/EventBus.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import { session } from '../core/RunContext.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'
import * as gearModule from '../data/gear.js'

`

const invHeader = `import { CONFIG } from '../config.js'
import GameState, { States } from '../core/GameState.js'
import EventBus from '../core/EventBus.js'
import Logger from '../core/Logger.js'
import TileEngine from '../systems/TileEngine.js'
import SaveManager from '../save/SaveManager.js'
import UI from '../ui/UI.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { session } from '../core/RunContext.js'
import { ITEMS } from '../data/items.js'
import { BACKPACK_MAX_SLOTS } from '../systems/LootTables.js'
import { isCombatCommitmentLocked } from './TileTapRouter.js'

const MSG_COMBAT_ACTION_BLOCKED = 'Cannot perform action when in combat with enemy'

`

fs.writeFileSync('js/controllers/GearController.js', gearHeader + gearBody + '\n')
fs.writeFileSync('js/controllers/InventoryController.js', invHeader + invBody + '\n')

// Remove from GC (bottom-up)
const removeRanges = [
  [DROP_START, DROP_END],
  [USE_ITEM_START, USE_ITEM_END],
  [INV_SECTION, CAN_ADD_END],
  [BLACKSMITH_START, BLACKSMITH_END],
  [GEAR_START, GEAR_END],
].sort((a, b) => b[0] - a[0])

let gc = lines.join('\n')
for (const [start, end] of removeRanges) {
  const ls = gc.split('\n')
  gc = [...ls.slice(0, start), ...ls.slice(end)].join('\n')
}

if (!gc.includes("from '../controllers/GearController.js'")) {
  gc = gc.replace(
    "import * as FloorController from '../controllers/FloorController.js'\n",
    "import * as FloorController from '../controllers/FloorController.js'\nimport * as GearController from '../controllers/GearController.js'\nimport * as InventoryController from '../controllers/InventoryController.js'\n",
  )
}

const gearBlock = `
// Gear + blacksmith (GearController)
function _adjustPlayerStat(stat, delta) { GearController.adjustPlayerStat(stat, delta) }

function _gearCtx() {
  return {
    rand: _rand,
    playerDamageRange: _playerDamageRange,
  }
}

function _applyEquippedGear(p) { GearController.applyEquippedGear(_gearCtx(), p) }
function _equipGear(inventoryIndex) { GearController.equipGear(_gearCtx(), inventoryIndex) }
function _unequipGear(slot, inventoryIndex) { GearController.unequipGear(_gearCtx(), slot, inventoryIndex) }
function _handleGearPickup(piece) { GearController.handleGearPickup(_gearCtx(), piece) }
function _tryGearDrop(floor, chance) { return GearController.tryGearDrop(_gearCtx(), floor, chance) }
function _upgradeGear(slot) { return GearController.upgradeGear(_gearCtx(), slot) }
function _disassembleGear(slot) { return GearController.disassembleGear(_gearCtx(), slot) }
function _reduceDetriment(slot, statKey) { return GearController.reduceDetriment(_gearCtx(), slot, statKey) }

`

const invBlock = `
// Inventory / backpack (InventoryController)
function _inventoryCtx() {
  return {
    ..._revealCtx(),
    die: _die,
    restoreHourglassSnapshot: _restoreHourglassSnapshot,
    lanternAction,
    dowsingRodAction,
    spyglassAction,
    hourglassAction,
  }
}

async function _addToBackpack(id) { return InventoryController.addToBackpack(_inventoryCtx(), id) }
function _canAddToBackpack(id) { return InventoryController.canAddToBackpack(_inventoryCtx(), id) }
function useItem(id) { InventoryController.useItem(_inventoryCtx(), id) }
function dropItem(id) { InventoryController.dropItem(_inventoryCtx(), id) }
async function forceReplaceItem(oldId, newId) { return InventoryController.forceReplaceItem(_inventoryCtx(), oldId, newId) }

`

if (!gc.includes('function _gearCtx()')) {
  gc = gc.replace('function _saveActiveRun()', gearBlock + 'function _saveActiveRun()')
}

if (!gc.includes('function _inventoryCtx()')) {
  gc = gc.replace('function _rand(min, max)', invBlock + 'function _rand(min, max)')
}

fs.writeFileSync(gcPath, gc)

console.log('PR9 migration done')
console.log('GearController lines:', (gearHeader + gearBody).split('\n').length)
console.log('InventoryController lines:', (invHeader + invBody).split('\n').length)
console.log('GameController lines:', gc.split('\n').length)
