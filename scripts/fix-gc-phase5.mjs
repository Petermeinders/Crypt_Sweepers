import fs from 'node:fs'
import path from 'node:path'

const p = path.join(import.meta.dirname, '../js/core/GameController.js')
let s = fs.readFileSync(p, 'utf8')

s = s.replace(/^async\s*$/gm, '')

s = s.replace(
  /\/\/ ── Event tile ─[\s\S]*?(?=function abilitySlotAAction)/,
  '',
)

s = s.replace(
  /\/\/ ── Sub-floor ─[\s\S]*?(?=function _pickSpecialSpawnEnemyTile)/,
  '',
)

s = s.replace(
  /\}\n\n[\s\S]*?\/\*\* Fade out and clear the icon[\s\S]*?(?=function onTileTap)/,
  '}\n\n',
)

if (!s.includes('function doRetreat')) {
  s = s.replace(
    '// ── Player stat helpers ─',
    `// ── Hasty Retreat ────────────────────────────────────────────

function doRetreat(reason = 'player') { GSH.doRetreat(_stateCtx(), reason) }

// ── Floor progression ────────────────────────────────────────

// ── Player stat helpers ─`,
  )
}

s = s.replace(/\n{4,}/g, '\n\n\n')

fs.writeFileSync(p, s)
console.log('Cleaned. doRetreat:', s.includes('function doRetreat'))
console.log('_takeDamage:', s.includes('function _takeDamage'))
