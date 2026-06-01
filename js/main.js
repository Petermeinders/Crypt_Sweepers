import Logger from './core/Logger.js'
import { boot } from './boot/boot.js'

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

// ── Service worker registration ───────────────────────────────
// Keep SW_CACHE_VERSION in sync with CACHE_NAME in sw.js (digits after "v").
const SW_CACHE_VERSION = '470'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    navigator.serviceWorker.register(`./sw.js?v=${SW_CACHE_VERSION}`)
      .then(reg => {
        Logger.debug('[SW] registered', reg.scope)
        reg.update()
      })
      .catch(err => Logger.error('[SW] registration failed', err))
  })
}
