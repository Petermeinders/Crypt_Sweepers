// gsap loaded as UMD global via <script src="node_modules/gsap/dist/gsap.min.js">
const gsap = window.gsap

import EventBus from '../../core/EventBus.js'
const _sfx = key => EventBus.emit('audio:play', { sfx: key })

// Symbols per tier — emoji + label
const SYMBOLS = [
  { tier: 'common',    emoji: '🪙', label: 'Common'    },
  { tier: 'rare',      emoji: '💎', label: 'Rare'      },
  { tier: 'epic',      emoji: '⚡', label: 'Epic'      },
  { tier: 'legendary', emoji: '🌑', label: 'Legendary' },
]

const SYMBOL_H = 80  // px — must match CSS .casino-reel-symbol height
const STRIP_REPEATS = 6  // how many full symbol sets per strip (enough for spin distance)

// Build a shuffled strip ending on targetTier
function _buildStrip(targetTier) {
  const pool = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS]
  // Shuffle middle portion
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  // Ensure last visible symbol is the target
  const last = pool.findIndex(s => s.tier === targetTier)
  if (last !== -1) pool.splice(last, 1)
  const target = SYMBOLS.find(s => s.tier === targetTier)
  pool.push(target)
  return pool
}

function _renderStrip(stripEl, symbols) {
  stripEl.innerHTML = ''
  symbols.forEach(sym => {
    const div = document.createElement('div')
    div.className = `casino-reel-symbol casino-reel-symbol--${sym.tier}`
    div.innerHTML = `<span class="casino-sym-emoji">${sym.emoji}</span><span class="casino-sym-label">${sym.label}</span>`
    stripEl.appendChild(div)
  })
}

// Animate one reel. Returns a Promise that resolves when done.
function _spinReel(stripEl, symbols, delay) {
  const totalH    = symbols.length * SYMBOL_H
  const targetY   = -((symbols.length - 1) * SYMBOL_H)  // land on last symbol

  // Start from top
  gsap.set(stripEl, { y: 0 })

  return new Promise(resolve => {
    gsap.to(stripEl, {
      y: targetY,
      duration: 2.2 + delay * 0.4,
      delay,
      ease: 'back.out(0.6)',
      onComplete: resolve,
    })
  })
}

// Flash the winning reel symbol
function _flashSymbol(stripEl, tier) {
  const last = stripEl.lastElementChild
  if (!last) return
  gsap.fromTo(last,
    { scale: 1 },
    { scale: 1.18, duration: 0.18, yoyo: true, repeat: 3, ease: 'power2.inOut',
      onComplete: () => gsap.set(last, { scale: 1 }) }
  )
}

/**
 * Run the slot machine animation.
 * @param {string} tier  — 'common' | 'rare' | 'epic' | 'legendary'
 * @returns {Promise<void>} resolves when all reels have stopped
 */
export async function runSlotAnimation(tier) {
  const strips = [
    document.getElementById('casino-strip-0'),
    document.getElementById('casino-strip-1'),
    document.getElementById('casino-strip-2'),
  ]
  if (!strips[0]) return

  // Build & render strips (all land on same tier)
  const symbolSets = strips.map(() => _buildStrip(tier))
  strips.forEach((el, i) => _renderStrip(el, symbolSets[i]))

  // Spin sound fires once at the start
  _sfx('slotSpin')

  // Spin with staggered stops — tick sound fires as each reel lands
  await Promise.all(strips.map((el, i) =>
    _spinReel(el, symbolSets[i], i * 0.35).then(() => _sfx('slotTick'))
  ))

  // Tada fanfare + flash after all reels are locked
  _sfx('slotWin')
  strips.forEach((el, i) => {
    setTimeout(() => _flashSymbol(el, tier), i * 80)
  })

  // Small settle pause so flash is visible before result UI appears
  await new Promise(r => setTimeout(r, 500))
}

/** Reset all strips to blank (between spins) */
export function resetSlots() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`casino-strip-${i}`)
    if (el) {
      gsap.set(el, { y: 0 })
      el.innerHTML = SYMBOLS.map(s =>
        `<div class="casino-reel-symbol casino-reel-symbol--${s.tier}">
           <span class="casino-sym-emoji">${s.emoji}</span>
           <span class="casino-sym-label">${s.label}</span>
         </div>`
      ).join('')
    }
  }
}
