// Crypt Sweepers — Service Worker
// Strategy: Cache-first for assets, network-first for HTML.
// Version bump CACHE_NAME to force cache refresh on deploy.

const CACHE_NAME = 'crypt-sweepers-v3'

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/tiles.css',
  './assets/DungeonBackground.png',
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
  './assets/sprites/Items/chest.gif',
  './js/data/items.js',
  './audio/sfx/flip.ogg',
  './audio/sfx/hit.ogg',
  './audio/sfx/spell.ogg',
  './audio/sfx/gold.ogg',
  './audio/sfx/levelup.ogg',
  './audio/sfx/death.ogg',
  './audio/sfx/merchant.ogg',
  './audio/sfx/retreat.ogg',
  './audio/sfx/chest.ogg',
  './audio/sfx/trap.ogg',
  './audio/sfx/slam.ogg',
  './audio/sfx/heal.ogg',
  './audio/sfx/menu.ogg',
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

// ── Fetch ─────────────────────────────────────────────────────
// Network-first for HTML/JS/CSS so code changes are immediate.
// Cache-first for images and audio (large, rarely change).

function networkFirst(request) {
  return fetch(request)
    .then(res => {
      const clone = res.clone()
      caches.open(CACHE_NAME).then(c => c.put(request, clone))
      return res
    })
    .catch(() => caches.match(request))
}

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached
    return fetch(request).then(res => {
      const clone = res.clone()
      caches.open(CACHE_NAME).then(c => c.put(request, clone))
      return res
    })
  })
}

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return

  const path = url.pathname

  // Cache-first only for images and audio (static assets)
  if (/\.(png|webp|gif|jpg|jpeg|svg|ogg|mp3|wav)$/i.test(path)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Network-first for everything else (HTML, JS, CSS, JSON)
  event.respondWith(networkFirst(request))
})
