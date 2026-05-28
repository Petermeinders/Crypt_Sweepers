import fs from 'fs'

const mainLines = fs.readFileSync('js/main.js', 'utf8').split(/\n/)

// Find boot() body
const bootStart = mainLines.findIndex(l => l.trim() === 'async function boot() {')
const bootEnd = mainLines.findIndex((l, i) => i > bootStart && l.trim() === '}')
// boot ends at first `}` at column 0 after boot start - actually line 837 is `}`

// Extract HUD-relevant lines from boot (by line numbers in current main.js)
// Resume: 111-118, teary: 120-123, info-card: 125-127, skip: 149-151, cheat: 152-162,
// ability hold helper + slots: 178-528, retreat: 549-560
// Exclude: persistence (68-85), backpack/equipment (128-148), hero accordion (170-177), settings (529-547)

function extractBlock(startMarker, endMarker) {
  const start = mainLines.findIndex(l => l.includes(startMarker))
  const end = mainLines.findIndex((l, i) => i > start && l.includes(endMarker))
  return mainLines.slice(start, end).join('\n')
}

const resumeBlock = mainLines.slice(110, 118).join('\n')
const tearyBlock = mainLines.slice(119, 123).join('\n')
const infoCardBlock = mainLines.slice(124, 127).join('\n')
const skipBlock = mainLines.slice(148, 151).join('\n')
const cheatBlock = mainLines.slice(151, 162).join('\n')
const abilityBlock = mainLines.slice(177, 528).join('\n')
const retreatBlock = mainLines.slice(548, 560).join('\n')

let body = [
  resumeBlock,
  tearyBlock,
  infoCardBlock,
  skipBlock,
  cheatBlock,
  abilityBlock,
  retreatBlock,
].join('\n\n')

body = body.replace(/\bGameController\./g, 'ctx.GameController.')
body = body.replace(/\bUI\./g, 'ctx.UI.')
body = body.replace(/_wireAbilityHold/g, 'wireAbilityHold')

const header = `import { CONFIG } from '../config.js'
import { WARRIOR_UPGRADES } from '../data/upgrades.js'
import { RANGER_UPGRADES } from '../data/ranger.js'
import { ENGINEER_UPGRADES } from '../data/engineer.js'
import { MAGE_UPGRADES } from '../data/mage.js'
import { VAMPIRE_UPGRADES } from '../data/vampire.js'

/** In-run HUD buttons: resume prompt, abilities (hold-to-inspect), retreat, cheats. */
export function wireHud(ctx) {
  const { GameController, UI } = ctx

`

const footer = `
}
`

// Move wireAbilityHold outside wireHud
const abilityHoldFn = `
function wireAbilityHold(btn, onTap, onHold) {
  let _timer   = null
  let _didHold = false
  let _startX  = 0
  let _startY  = 0

  btn.addEventListener('pointerdown', e => {
    _didHold = false
    _startX  = e.clientX
    _startY  = e.clientY
    _timer = setTimeout(() => {
      _didHold = true
      onHold()
    }, 380)
  })

  btn.addEventListener('pointermove', e => {
    if (!_timer) return
    const dx = e.clientX - _startX
    const dy = e.clientY - _startY
    if (Math.hypot(dx, dy) > 8) { clearTimeout(_timer); _timer = null }
  })

  const _cancel = () => { clearTimeout(_timer); _timer = null }
  btn.addEventListener('pointerup',     _cancel)
  btn.addEventListener('pointercancel', _cancel)
  btn.addEventListener('contextmenu', e => e.preventDefault())

  btn.addEventListener('click', () => { if (!_didHold) onTap() })
}

`

// Remove duplicate wireAbilityHold from body (lines 1888-1920 in main become part of ability block)
body = body.replace(/\/\/ ── Ability button hold-to-inspect[\s\S]*?function wireAbilityHold\(btn, onTap, onHold\) \{[\s\S]*?\n\}\n\n/m, '')

fs.writeFileSync('js/main/wireHud.js', header + body + footer + abilityHoldFn)
console.log('wireHud.js lines:', (header + body + footer + abilityHoldFn).split('\n').length)
