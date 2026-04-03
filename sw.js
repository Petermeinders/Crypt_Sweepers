// Crypt Sweepers — Service Worker
// Strategy: Cache-first for assets, network-first for HTML.
// Version bump CACHE_NAME to force cache refresh on deploy.

const CACHE_NAME = 'crypt-sweepers-v1'

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/tiles.css',
  './assets/sprites/tiles/dungeon-tile-back.webp',
  './assets/sprites/tiles/dungeon-tile-floor.png',
  './css/hud.css',
  './css/animations.css',
  './css/overlays.css',
  './js/main.js',
  './js/config.js',
  './js/core/GameState.js',
  './js/core/EventBus.js',
  './js/core/Logger.js',
  './js/core/GameController.js',
  './js/data/abilities.js',
  './js/data/enemies.js',
  './js/data/tileBlurbs.js',
  './js/data/ranger.js',
  './js/data/tileIcons.js',
  './js/data/tiles.js',
  './js/data/upgrades.js',
  './js/save/SaveManager.js',
  './js/systems/AudioManager.js',
  './js/systems/CombatResolver.js',
  './js/systems/MetaProgression.js',
  './js/systems/ProgressionSystem.js',
  './js/systems/TileEngine.js',
  './js/ui/UI.js',
  './assets/sprites/effects/FireSwordSlash.gif',
  './assets/sprites/effects/HammerSlam.gif',
  './assets/sprites/Items/potionRed.png',
  './assets/sprites/Items/potionBlue.png',
  './assets/sprites/Items/heart.png',
  './js/data/items.js',
  './assets/sprites/monsters/goblin/goblin-idle.gif',
  './assets/sprites/monsters/vine_witch/vine-witch-idle.gif',
  './assets/sprites/monsters/ogre/ogre-idle.gif',
  './assets/sprites/monsters/goblin/goblin-strike.gif',
  './assets/sprites/Heroes/Warrior/__Idle.gif',
  './assets/sprites/Heroes/Warrior/__AttackCombo2hit.gif',
  './assets/sprites/Heroes/Warrior/__Hit.gif',
  './assets/sprites/Heroes/Warrior/__Run.gif',
  './assets/sprites/Heroes/Warrior/__DeathNoMovement.gif',
]

// ── Install: precache all assets ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: cache-first for assets, network-first for HTML ─────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // HTML: network-first so updates are picked up immediately
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(c => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Everything else: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        return res
      })
    })
  )
})
