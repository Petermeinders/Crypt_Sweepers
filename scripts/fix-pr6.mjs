import fs from 'fs'

const gcPath = 'js/core/GameController.js'
const tapPath = 'js/controllers/TileTapRouter.js'

// Fix TileTapRouter combat engagement refs
let tap = fs.readFileSync(tapPath, 'utf8')
tap = tap.replace(/_combatEngagementTile/g, 'session.tap.combatEngagementTile')
fs.writeFileSync(tapPath, tap)

let gc = fs.readFileSync(gcPath, 'utf8')
const lines = gc.split('\n')

// Remove flag declaration block
const flagStart = lines.findIndex(l => l.includes('// ── Tile tap router'))
const activeStart = lines.findIndex(l => l.includes('// ── Active grid helpers'))
if (flagStart >= 0 && activeStart > flagStart) {
  lines.splice(flagStart + 1, activeStart - flagStart - 1)
}

gc = lines.join('\n')

// Remove active grid section
const lines2 = gc.split('\n')
const agStart = lines2.findIndex(l => l.includes('// ── Active grid helpers'))
const agEnd = lines2.findIndex(l => l.includes('// ── Angry Onion helpers'))
if (agStart >= 0 && agEnd > agStart) {
  lines2.splice(agStart, agEnd - agStart)
}
gc = lines2.join('\n')

// Remove onTileTap body
const lines3 = gc.split('\n')
const tapFnStart = lines3.findIndex(l => l.startsWith('function onTileTap(row, col)'))
const tapHoldStart = lines3.findIndex(l => l.includes('// ── Tile hold'))
if (tapFnStart >= 0 && tapHoldStart > tapFnStart) {
  lines3.splice(tapFnStart, tapHoldStart - tapFnStart,
    'function onTileTap(row, col) { TapRouter.onTileTap(_tapCtx(), row, col) }',
    '')
}
gc = lines3.join('\n')

// Flag replacements (longest first)
const flagMap = [
  ['_combatEngagementTile', 'session.tap.combatEngagementTile'],
  ['_combatBusySetAt', 'session.tap.combatBusySetAt'],
  ['_combatBusy', 'session.tap.combatBusy'],
  ['_strengthenMinionSelecting', 'session.tap.strengthenMinionSelecting'],
  ['_corpseExplosionSelecting', 'session.tap.corpseExplosionSelecting'],
  ['_blindingLightTargeting', 'session.tap.blindingLightTargeting'],
  ['_poisonArrowShotSelecting', 'session.tap.poisonArrowShotSelecting'],
  ['_arrowBarrageSelecting', 'session.tap.arrowBarrageSelecting'],
  ['_chainLightningSelecting', 'session.tap.chainLightningSelecting'],
  ['_telekineticEnemyTile', 'session.tap.telekineticEnemyTile'],
  ['_telekineticThrowStep', 'session.tap.telekineticThrowStep'],
  ['_throwingKnifeTargeting', 'session.tap.throwingKnifeTargeting'],
  ['_twinBladesTargeting', 'session.tap.twinBladesTargeting'],
  ['_rustyNailTargeting', 'session.tap.rustyNailTargeting'],
  ['_mistFormFlipsRemaining', 'session.tap.mistFormFlipsRemaining'],
  ['_divineLightSelecting', 'session.tap.divineLightSelecting'],
  ['_engineerPendingTile', 'session.tap.engineerPendingTile'],
  ['_tripleVolleyCenter', 'session.tap.tripleVolleyCenter'],
  ['_ricochetSelecting', 'session.tap.ricochetSelecting'],
  ['_ricochetTiles', 'session.tap.ricochetTiles'],
  ['_lanternTargeting', 'session.tap.lanternTargeting'],
  ['_spyglassTargeting', 'session.tap.spyglassTargeting'],
  ['_spellTargeting', 'session.tap.spellTargeting'],
]

for (const [from, to] of flagMap) {
  gc = gc.split(from).join(to)
}

// Add TapRouter import
if (!gc.includes("from '../controllers/TileTapRouter.js'")) {
  gc = gc.replace(
    "import * as GSH from './GameStateHandlers.js'\n",
    "import * as GSH from './GameStateHandlers.js'\nimport * as TapRouter from '../controllers/TileTapRouter.js'\n",
  )
}

// Fix tile tap router comment if duplicate section removed awkwardly
gc = gc.replace(
  /\/\/ ── Tile tap router ─+\n\n\/\/ ── Angry Onion/,
  '// ── Tile tap router (session.tap flags; TileTapRouter) ──\n\n// ── Angry Onion',
)

fs.writeFileSync(gcPath, gc)
console.log('fix-pr6 done')
console.log('GameController lines:', gc.split('\n').length)
