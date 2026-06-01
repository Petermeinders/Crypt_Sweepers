import Logger from './core/Logger.js'
import { boot } from './boot/boot.js'
import { initServiceWorker } from './boot/serviceWorker.js'

async function safeBoot() {
  try {
    await boot()
  } catch (err) {
    Logger.error('[Boot] Fatal init error', err)
    document.body.innerHTML = '<p style="color:white;padding:2rem;font-family:sans-serif">Failed to start. Try clearing site data and reloading.</p>'
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeBoot)
} else {
  safeBoot()
}

// ── Hero carousel ────────────────────────────────────────────
;(function initHeroCarousel() {
  const heroes = Array.from(document.querySelectorAll('.carousel-hero'))
  if (heroes.length < 2) return
  let current = 0
  const DISPLAY_MS = 5000
  const next = () => {
    heroes[current].classList.remove('active')
    current = (current + 1) % heroes.length
    heroes[current].classList.add('active')
  }
  setInterval(next, DISPLAY_MS)
})()

initServiceWorker()
