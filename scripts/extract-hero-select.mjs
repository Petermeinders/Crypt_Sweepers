import fs from 'fs'

const main = fs.readFileSync('js/main.js', 'utf8').split(/\n/)
const start = main.findIndex(l => l.includes('// ── Hero Select'))
const end = main.findIndex(l => l.includes('// ── Gold shop panel'))
let body = main.slice(start + 1, end).join('\n')

// Strip module-level state (we add our own header)
body = body.replace(/^let _heroIdx[\s\S]*?let _heroScrollSkip\s*= false\n\n/m, '')

// Rename helpers (longest first to avoid partial matches)
const renames = [
  ['_wireHeroSelectScroll', 'wireHeroSelectScroll'],
  ['_onHeroScrollSettled', 'onHeroScrollSettled'],
  ['_ensureHeroSelectSlides', 'ensureHeroSelectSlides'],
  ['_renderHeroUpgradeSimpleSlot', 'renderHeroUpgradeSimpleSlot'],
  ['_renderHeroUpgradeGrid', 'renderHeroUpgradeGrid'],
  ['_syncHeroUpgradeDetail', 'syncHeroUpgradeDetail'],
  ['_renderUpgradeDetail', 'renderUpgradeDetail'],
  ['_buyUpgradeForChar', 'buyUpgradeForChar'],
  ['_renderHeroSelect', 'renderHeroSelect'],
  ['_onHeroPortraitClick', 'onHeroPortraitClick'],
  ['_updateMenuHeroPreview', 'updateMenuHeroPreview'],
  ['_renderHeroDots', 'renderHeroDots'],
  ['_openHeroSelect', 'openHeroSelect'],
  ['_navHeroSelect', 'navHeroSelect'],
  ['_heroSlideGrid', 'heroSlideGrid'],
  ['_heroIdx', 'heroIdx'],
  ['_selectedUpgradeId', 'selectedUpgradeId'],
  ['_heroAttackTimer', 'heroAttackTimer'],
  ['_heroScrollSkip', 'heroScrollSkip'],
  ['_metaCharSave', 'metaCharSave'],
  ['_heroIsGoldLocked', 'heroIsGoldLocked'],
]

for (const [from, to] of renames) {
  body = body.split(from).join(to)
}

// GameController / SaveManager / MetaProgression -> ctx.*
body = body.replace(/\bGameController\./g, 'ctx.GameController.')
body = body.replace(/\bSaveManager\./g, 'ctx.SaveManager.')
body = body.replace(/\bMetaProgression\./g, 'ctx.MetaProgression.')

// Functions that need ctx as first param
const needCtx = [
  'ensureHeroSelectSlides', 'wireHeroSelectScroll', 'onHeroScrollSettled',
  'openHeroSelect', 'renderHeroSelect', 'syncHeroUpgradeDetail',
  'renderHeroUpgradeSimpleSlot', 'renderHeroUpgradeGrid', 'renderUpgradeDetail',
  'updateMenuHeroPreview', 'buyUpgradeForChar',
]
for (const fn of needCtx) {
  body = body.replace(new RegExp(`function ${fn}\\(`, 'g'), `function ${fn}(ctx, `)
  body = body.replace(new RegExp(`function ${fn}\\(ctx, ctx,`, 'g'), `function ${fn}(ctx,`)
  body = body.replace(new RegExp(`function ${fn}\\(ctx, \\)`, 'g'), `function ${fn}(ctx)`)
}

// buyUpgradeForChar(ctx, s, ...) — MetaProgression calls already use ctx.
body = body.replace(/function buyUpgradeForChar\(ctx, s,/g, 'function buyUpgradeForChar(ctx, s,')

// Internal calls missing ctx
body = body.replace(/ensureHeroSelectSlides\(\)/g, 'ensureHeroSelectSlides(ctx)')
body = body.replace(/wireHeroSelectScroll\(\)/g, 'wireHeroSelectScroll(ctx)')
body = body.replace(/onHeroScrollSettled\(\)/g, 'onHeroScrollSettled(ctx)')
body = body.replace(/renderHeroSelect\(\{/g, 'renderHeroSelect(ctx, {')
body = body.replace(/renderHeroSelect\(\)/g, 'renderHeroSelect(ctx)')
body = body.replace(/updateMenuHeroPreview\(\)/g, 'updateMenuHeroPreview(ctx)')
body = body.replace(/openHeroSelect\(\)/g, 'openHeroSelect(ctx)')
body = body.replace(/renderHeroUpgradeGrid\(/g, 'renderHeroUpgradeGrid(ctx, ')
body = body.replace(/renderHeroUpgradeSimpleSlot\(/g, 'renderHeroUpgradeSimpleSlot(ctx, ')
body = body.replace(/renderUpgradeDetail\(/g, 'renderUpgradeDetail(ctx, ')
body = body.replace(/syncHeroUpgradeDetail\(/g, 'syncHeroUpgradeDetail(ctx, ')
body = body.replace(/buyUpgradeForChar\(s,/g, 'buyUpgradeForChar(ctx, s,')

// Remove showResumePrompt if present
body = body.replace(/\nfunction showResumePrompt\(\)[\s\S]*?\n\}/, '')

const header = `import { CHARACTERS } from '../../data/characters.js'
import { WARRIOR_UPGRADES } from '../../data/upgrades.js'
import { RANGER_UPGRADES } from '../../data/ranger.js'
import { ENGINEER_UPGRADES } from '../../data/engineer.js'
import { MAGE_UPGRADES } from '../../data/mage.js'
import { NECROMANCER_UPGRADES } from '../../data/necromancer.js'
import { VAMPIRE_UPGRADES } from '../../data/vampire.js'
import { metaCharSave, heroIsGoldLocked } from './shared.js'

let heroIdx = 0
let selectedUpgradeId = null
let heroAttackTimer = null
let heroScrollSkip = false

`

const footer = `
export function wireHeroSelect(ctx) {
  document.getElementById('hero-select-open-btn').addEventListener('click', () => openHeroSelect(ctx))
  document.getElementById('hero-select-back').addEventListener('click', () => {
    document.getElementById('hero-select-overlay').classList.add('hidden')
    updateMenuHeroPreview(ctx)
  })
  document.getElementById('hero-prev').addEventListener('click', () => navHeroSelect(-1))
  document.getElementById('hero-next').addEventListener('click', () => navHeroSelect(1))
  ensureHeroSelectSlides(ctx)
  document.getElementById('hero-select-scroll')?.addEventListener('click', onHeroPortraitClick)
  document.getElementById('hero-select-btn').addEventListener('click', () => {
    const s = ctx.GameController.getSave()
    const char = CHARACTERS[heroIdx]
    const btn = document.getElementById('hero-select-btn')
    if (btn.dataset.mode === 'unlock') {
      if (ctx.MetaProgression.unlockHero(s, char.id)) {
        ctx.SaveManager.save(s)
        renderHeroSelect(ctx)
      }
    } else {
      s.selectedCharacter = char.id
      ctx.SaveManager.save(s)
      renderHeroSelect(ctx)
    }
  })
  document.getElementById('hero-upgrade-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('hero-upgrade-backdrop')) {
      selectedUpgradeId = null
      document.getElementById('hero-upgrade-backdrop').classList.add('hidden')
      const s = ctx.GameController.getSave()
      const char = CHARACTERS[heroIdx]
      const charSave = char.comingSoon ? { totalXP: 0, upgrades: [] } : metaCharSave(s, char.id)
      const grid = heroSlideGrid(heroIdx)
      renderHeroUpgradeGrid(ctx, grid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, !char.comingSoon && heroIsGoldLocked(s, char))
    }
  })
  document.getElementById('hero-select-scroll')?.addEventListener('click', e => {
    const t = e.target.closest('.hero-passive-accordion-toggle')
    if (!t) return
    const acc = t.closest('.hero-passive-accordion')
    if (!acc) return
    const open = acc.classList.toggle('open')
    t.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
}

export { openHeroSelect, renderHeroSelect, updateMenuHeroPreview, ensureHeroSelectSlides }
`

fs.writeFileSync('js/ui/menus/HeroSelect.js', header + body + footer)
console.log('HeroSelect.js lines:', (header + body + footer).split('\n').length)
