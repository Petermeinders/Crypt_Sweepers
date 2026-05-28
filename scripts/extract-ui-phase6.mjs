/**
 * Phase 6: split js/ui/UI.js — robust method extractor + module writer.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
// UI.original.js must be UTF-8 (emojis). Regenerate from git if needed:
//   node -e "require('fs').writeFileSync('js/ui/UI.original.js', require('child_process').execSync('git show HEAD:js/ui/UI.js',{encoding:'utf8'}))"
const uiPath = path.join(root, 'js/ui/UI.original.js')
const src = fs.readFileSync(uiPath, 'utf8')
if (src.includes('`????') || src.includes('??????')) {
  console.warn('WARNING: UI.original.js may have corrupted emoji — restore from git before extracting.')
}

const uiStart = src.indexOf('const UI = {')
const preamble = src.slice(0, uiStart)
const uiBodyStart = uiStart + 'const UI = {'.length
const uiEnd = src.lastIndexOf('\n}\n\nexport default UI')
const uiBody = src.slice(uiBodyStart, uiEnd)

function closeBraceIndex(code, openIdx) {
  let depth = 0
  let inStr = null
  let tmpl = 0
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i]
    if (inStr === '`') {
      if (c === '\\') { i++; continue }
      if (c === '$' && code[i + 1] === '{') { tmpl++; i++; continue }
      if (c === '}' && tmpl > 0) { tmpl--; continue }
      if (c === '`' && tmpl === 0) { inStr = null; continue }
      continue
    }
    if (inStr && inStr !== '`') {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (!inStr && (c === "'" || c === '"' || c === '`')) { inStr = c; continue }
    if (tmpl > 0) {
      if (c === '{') tmpl++
      else if (c === '}') tmpl--
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return code.length
}

function findBodyOpen(code, sigStart) {
  let depth = 0
  let inStr = null
  const parenStart = code.indexOf('(', sigStart)
  if (parenStart < 0) return code.indexOf('{', sigStart)
  for (let i = parenStart; i < code.length; i++) {
    const c = code[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) {
        for (let j = i + 1; j < code.length; j++) {
          if (code[j] === '{') return j
          if (!/\s/.test(code[j])) break
        }
        break
      }
    }
  }
  return code.indexOf('{', sigStart)
}

function trimMethodChunk(text) {
  const sig = text.match(/^(\s*(?:\/\*\*[\s\S]*?\*\/\s*\n|\/\/[^\n]*\n)*)\s*(  [a-zA-Z_][\w]*\()/m)
  if (!sig) return text.trimEnd()
  const start = sig.index ?? 0
  const open = findBodyOpen(text, start)
  if (open < 0) return text.trimEnd()
  return text.slice(start, closeBraceIndex(text, open)).trimEnd()
}

function extractMethodChunk(bodyLines, startIdx, nextStartIdx) {
  const raw = bodyLines.slice(startIdx, nextStartIdx).join('\n')
  let text = trimMethodChunk(raw)
  if (text.endsWith(',')) text = text.slice(0, -1).trimEnd()
  return text
}

function cleanMethodsExport(exportStr) {
  return exportStr
    .replace(/,\s*\r?\n(?:[ \t]*\/\/[^\n]*\r?\n|[ \t]*\/\*\*[\s\S]*?\*\/[ \t]*,?\s*\r?\n)+(?=[ \t]*[a-zA-Z_])/g, ',\n\n')
}

function parseMethodsFromLines(src) {
  const lines = src.split('\n')
  const uiStart = lines.findIndex(l => l.startsWith('const UI = {'))
  const uiEnd = lines.findIndex((l, i) => i > uiStart && l === '}')
  const bodyLines = lines.slice(uiStart + 1, uiEnd)

  const starts = []
  for (let i = 0; i < bodyLines.length; i++) {
    const m = bodyLines[i].match(/^  ([a-zA-Z_][a-zA-Z0-9_]*)\(/)
    if (m) starts.push({ idx: i, name: m[1] })
  }

  const methods = new Map()
  for (let s = 0; s < starts.length; s++) {
    methods.set(
      starts[s].name,
      extractMethodChunk(bodyLines, starts[s].idx, starts[s + 1]?.idx),
    )
  }
  return methods
}

const methods = parseMethodsFromLines(src)
console.log(`Parsed ${methods.size} methods:`, [...methods.keys()].join(', '))

const HUD = new Set([
  'updateHP', 'updateMana', 'updateDamageRange', 'updateArmor',
  'setSlamBtn', 'setSlamActive', 'setRicochetBtn', 'setRicochetActive',
  'setArrowBarrageBtn', 'setArrowBarrageActive',
  'setPoisonArrowShotBtn', 'setPoisonArrowShotActive',
  'setBlindingLightBtn', 'setBlindingLightActive',
  'setEngineerManaGeneratorBtn', 'setEngineerConstructBtn', 'setEngineerTeslaBtn',
  'setChainLightningBtn', 'setChainLightningActive',
  'setStrengthenMinionBtn', 'setStrengthenMinionActive',
  'setBloodTitheBtn', 'setMistFormBtn', 'setMistFormActive', 'setBloodPactBtn',
  'setCorpseExplosionBtn', 'setCorpseExplosionActive',
  'setTelekineticThrowBtn', 'setTelekineticThrowActive',
  'setManaShieldBtn', 'setManaShieldActive', 'setLifeTapBtn', 'setLifeTapActive',
  'setDivineLightBtn', 'setDivineLightActive',
  'setTearyEyes', 'setFreezingHit', 'setPlayerPoison', 'setCorruption', 'setBurnOverlay',
  'setBloodOverlay', 'setLanternTargeting',
  'setHudCharacter', 'setPortraitAnim',
  'updateGold', 'updateScrap', 'updateGoldenKeys', 'updateXP', 'refreshSkipFloorButton',
  'setFloorModifier', 'clearFloorModifier', 'updateFloor', 'applyFloorTheme', 'resetFloorTheme',
  'setMessage', 'clearLog', 'showActionPanel', 'hideActionPanel', 'setSpellTargeting',
  'showRetreat', 'hideRetreat', 'getHudCharacterId', 'runFloorTransition',
])

const GRID = new Set([
  'clearRicochetMarks', 'refreshRicochetMarks', 'setGridRicochetMode',
  'setGridArrowBarrageMode', 'clearTripleVolleyAoePreview', 'setTripleVolleyAoePreview',
  'setGridPoisonArrowShotMode', 'setEngineerPlaceMode',
  'setGridChainLightningMode', 'setGridCorpseExplosionMode',
  'setGridTelekineticThrowMode', 'clearTelekineticMarks', 'markTelekineticOrigin',
  'getGridEl', 'spawnFloat', 'flashTile', 'splitSlime',
  'markBossTileAsExit', 'markTileSlain', 'markTileEnemyAlive',
  'setTileActiveCombat', 'setTileCombatEngaged', 'setTileCombatBlocked',
  'markTileReachable', 'lockTile', 'unlockTile',
])

const COMBAT = new Set([
  'spawnZap', 'spawnSlamRing', 'spawnArrow', 'spawnArrowRain',
  'updateEnemyStatus', 'updateEnemyHP', 'shakeTile', 'shakeScreenDamage',
  'playSlam', 'spawnCannonShot', 'spawnTeslaArc',
  'spawnSlash', 'spawnMageAttack', 'spawnVampireAttack', 'spawnNecromancerAttack',
  'showParryOnboarding', 'showParryTutorial', 'showParryWindow',
])

const MODALS = new Set([...methods.keys()].filter(k => k !== 'init' && !HUD.has(k) && !GRID.has(k) && !COMBAT.has(k)))

function orderMethods(set) {
  return [...methods.keys()].filter(k => set.has(k))
}

function fixCrossRefs(code) {
  return code.replace(/\bUI\.(\w+)\s*\(/g, 'this.$1(')
}

function buildExport(set) {
  return cleanMethodsExport(orderMethods(set).map(n => fixCrossRefs(methods.get(n))).join(',\n\n'))
}

// ── uiShared.js ──────────────────────────────────────────────────────────────
const sharedStart = preamble.indexOf('const el = {}')
if (sharedStart < 0) throw new Error('uiShared anchor not found: const el = {}')
const sharedSlice = preamble.slice(sharedStart)
const sharedBody = sharedSlice
  .replace(/^const el = \{\}[^\n]*\n\n?/, '')
  .replace(/^async function _loadHeroParryGif/m, 'export async function loadHeroParryGif')
  .replace(/^function _fillBestiaryCreatureParts/m, 'export function fillBestiaryCreatureParts')
  .replace(/^function _fillTrinketCard/m, 'export function fillTrinketCard')
  .replace(/^function _drawSettledDice/m, 'export function drawSettledDice')
  .replace(/^const _logHistory/m, 'export const logHistory')
  .replace(/^const PORTRAIT_ANIM/m, 'export const PORTRAIT_ANIM')
  .replace(/^const _HERO_ATTACK_GIFS/m, 'const HERO_ATTACK_GIFS')
  .replace(/^const _heroGifCache/m, 'const heroGifCache')
  .replace(/^const _heroGifPending/m, 'const heroGifPending')
  .replace(/\b_HERO_ATTACK_GIFS\b/g, 'HERO_ATTACK_GIFS')
  .replace(/\b_heroGifCache\b/g, 'heroGifCache')
  .replace(/\b_heroGifPending\b/g, 'heroGifPending')

fs.writeFileSync(path.join(root, 'js/ui/uiShared.js'),
`// Shared UI element cache and cross-cutting helpers.
import { ENEMY_DEFS } from '../data/enemies.js'
import { ITEMS } from '../data/items.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'

export const el = {}

${sharedBody}
`)

// ── init() split ───────────────────────────────────────────────────────────────
const initBody = methods.get('init')
const initInner = initBody.replace(/^init\(\)\s*\{/, '').replace(/\}\s*$/, '')

const hudElKeys = [
  'hpBar','hpValue','manaBar','manaValue','dmgValue','goldValue','scrapValue',
  'keyDisplay','keyValue','keySlotPlaceholder','hudPortraitWrap','hudPortrait','hudPortraitImg',
  'xpBar','floorInfo','floorModifierBadge','messageBox','actionBtns','spellBtn','fleeBtn',
  'retreatBtn','hudSettingsBtn','hudHowToPlayBtn','skipFloorBtn','floorBanner','floorBannerText',
  'armorValue','hudSlotA','hudSlotB','hudSlotC','hudSlotD','msgLogWrap','msgLogExpanded','msgLogScroll','hudCharacterId',
]
const gridElKeys = ['grid']
const combatElKeys = [
  'parryOverlay','parryEnemyDisplay','parryEnemyIcon','parryEnemyName','parryPracticeLabel',
  'parryTutorialOverlay','parryTutorialBody','parryTutorialPips','parryTutorialNext','parryTutorialSkip',
  'parryRingArena','parryHeroCanvas','parryRingOuter','parryRingTarget',
  'parryCompassN','parryCompassE','parryCompassS','parryCompassW','parryArcCanvas','parryFlashOverlay',
]
const modalElKeys = [
  'levelUpOverlay','abilityChoices','runSummary','mainMenu','menuGoldVal','menuXpVal','menuXpBar',
  'goldShopOverlay','shopGoldVal','shopCartInfo','shopList',
  'subFloorOverlay','subFloorGrid','subFloorMessage','shrineOverlay',
  'merchantShopOverlay','gamblerOverlay','tripleChestOverlay','storyEventOverlay','trinketTraderOverlay',
  'infoCardOverlay','infoCard','bestiaryOverlay','bestiaryList',
  'bestiaryDiscoveryOverlay','bestiaryDiscoveryBackdrop','bestiaryDiscoveryGif','bestiaryDiscoveryEmoji',
  'bestiaryDiscoveryName','bestiaryDiscoveryType','bestiaryDiscoveryBlurb','bestiaryDiscoveryOk',
  'bestiaryDetailOverlay','bestiaryDetailBackdrop','bestiaryDetailGif','bestiaryDetailEmoji',
  'bestiaryDetailName','bestiaryDetailType','bestiaryDetailBlurb','bestiaryDetailBack',
  'forgeOverlay','forgeRecipeList','trinketCodexOverlay','trinketCodexList',
  'trinketDiscoveryOverlay','trinketDiscoveryBackdrop','trinketDiscoveryImg','trinketDiscoveryEmoji',
  'trinketDiscoveryRarity','trinketDiscoveryName','trinketDiscoveryBlurb','trinketDiscoveryEffects','trinketDiscoveryOk',
  'trinketDetailOverlay','trinketDetailBackdrop','trinketDetailImg','trinketDetailEmoji',
  'trinketDetailRarity','trinketDetailName','trinketDetailBlurb','trinketDetailEffects','trinketDetailBack',
  'trapModalOverlay','trapModalBackdrop','trapModalBody','trapModalTitle','trapModalOk',
  'ropeModalOverlay','ropeModalBody','equipmentOverlay','gearCompareModal',
]

function pickElAssignments(keys) {
  return initInner.split('\n').filter(line => {
    const t = line.trim()
    return keys.some(k => t.startsWith(`el.${k} `) || t.startsWith(`el.${k}=`))
  }).join('\n')
}

const msgLogBlock = initInner.match(/\/\/ Toggle log on message-box[\s\S]*?document\.addEventListener\('click', e => \{[\s\S]*?\}\)\s*\)/)?.[0] ?? ''
const msgLogFixed = msgLogBlock.replace(/\b_logHistory\b/g, 'logHistory')

const bestiaryWire = initInner.match(/const closeBestiaryDetail[\s\S]*$/)?.[0] ?? ''

const hudExport = buildExport(HUD).replace(/\b_logHistory\b/g, 'logHistory')

fs.writeFileSync(path.join(root, 'js/ui/Hud.js'),
`import { CONFIG } from '../config.js'
import { el, logHistory, PORTRAIT_ANIM } from './uiShared.js'

export function cacheHudElements() {
${pickElAssignments(hudElKeys)}
}

export function wireHudListeners() {
${msgLogFixed}
}

export const HudMethods = {
${hudExport}
}
`)

fs.writeFileSync(path.join(root, 'js/ui/Grid.js'),
`import TileEngine from '../systems/TileEngine.js'
import { ITEM_ICONS_BASE, TILE_SLAIN_ICON, TILE_SPIRIT_RELEASE, TILE_TYPE_ICON_FILES } from '../data/tileIcons.js'
import { el } from './uiShared.js'

export function cacheGridElements() {
${pickElAssignments(gridElKeys)}
}

export const GridMethods = {
${buildExport(GRID)}
}
`)

let combatExport = buildExport(COMBAT)
  .replace(/\b_loadHeroParryGif\b/g, 'loadHeroParryGif')

fs.writeFileSync(path.join(root, 'js/ui/CombatUi.js'),
`import TileEngine from '../systems/TileEngine.js'
import EventBus from '../core/EventBus.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { el, loadHeroParryGif } from './uiShared.js'

export function cacheCombatElements() {
${pickElAssignments(combatElKeys)}
}

export const CombatUiMethods = {
${combatExport}
}
`)

let modalsExport = buildExport(MODALS)
  .replace(/\b_fillBestiaryCreatureParts\b/g, 'fillBestiaryCreatureParts')
  .replace(/\b_fillTrinketCard\b/g, 'fillTrinketCard')
  .replace(/\b_drawSettledDice\b/g, 'drawSettledDice')

const modalsContent = `import { CONFIG } from '../config.js'
import TileEngine from '../systems/TileEngine.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ENEMY_DEFS } from '../data/enemies.js'
import Bestiary from '../systems/Bestiary.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import EventBus from '../core/EventBus.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { el, fillBestiaryCreatureParts, fillTrinketCard, drawSettledDice, PORTRAIT_ANIM } from './uiShared.js'

export function cacheModalElements() {
${pickElAssignments(modalElKeys)}
}

export function wireModalListeners() {
${bestiaryWire}
}

export const ModalsMethods = {
${modalsExport}
}
`
fs.writeFileSync(path.join(root, 'js/ui/Modals.js'), modalsContent)

fs.writeFileSync(path.join(root, 'js/ui/UI.js'), `// UI facade — single public import path; delegates to surface-area modules.
import { cacheHudElements, wireHudListeners, HudMethods } from './Hud.js'
import { cacheGridElements, GridMethods } from './Grid.js'
import { cacheCombatElements, CombatUiMethods } from './CombatUi.js'
import { cacheModalElements, wireModalListeners, ModalsMethods } from './Modals.js'

const UI = {
  init() {
    cacheHudElements()
    cacheGridElements()
    cacheCombatElements()
    cacheModalElements()
    wireHudListeners()
    wireModalListeners()
  },

  ...HudMethods,
  ...GridMethods,
  ...CombatUiMethods,
  ...ModalsMethods,
}

export default UI
`)

console.log('Hud:', HUD.size, 'Grid:', GRID.size, 'Combat:', COMBAT.size, 'Modals:', MODALS.size)
for (const s of [HUD, GRID, COMBAT, MODALS]) {
  for (const k of s) if (!methods.has(k)) console.warn('missing', k)
}
