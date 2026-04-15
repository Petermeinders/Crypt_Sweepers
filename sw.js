// Crypt Sweepers — Service Worker
// Strategy: Cache-first for assets, network-first for HTML.
// Version bump CACHE_NAME to force cache refresh on deploy.

const CACHE_NAME = 'crypt-sweepers-v193'

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',

  // CSS
  './css/main.css',
  './css/tiles.css',
  './css/hud.css',
  './css/animations.css',
  './css/overlays.css',

  // JS
  './js/main.js',
  './js/lib/matter.min.js',
  './js/ui/DiceRoller.js',
  './js/config.js',
  './js/core/GameState.js',
  './js/core/EventBus.js',
  './js/core/Logger.js',
  './js/core/GameController.js',
  './js/data/abilities.js',
  './js/data/enemies.js',
  './js/data/items.js',
  './js/data/combinations.js',
  './js/data/events.js',
  './js/data/tileBlurbs.js',
  './js/data/tileIcons.js',
  './js/data/tiles.js',
  './js/data/upgrades.js',
  './js/data/ranger.js',
  './js/save/SaveManager.js',
  './js/systems/AudioManager.js',
  './js/systems/CombatResolver.js',
  './js/systems/MetaProgression.js',
  './js/systems/Bestiary.js',
  './js/systems/TrinketCodex.js',
  './js/systems/ProgressionSystem.js',
  './js/systems/TileEngine.js',
  './js/ui/UI.js',

  // Images
  './assets/sprites/abilities/blinding-light.jpg',
  './assets/sprites/abilities/divine-light-badge.jpg',
  './assets/sprites/abilities/slam.png',
  './assets/sprites/abilities/ricochet-bg.png',
  './assets/sprites/abilities/ricochet-badge.png',
  './assets/sprites/abilities/arrow-barrage-bg.png',
  './assets/sprites/abilities/arrow-barrage-badge.png',
  './assets/sprites/abilities/poison-arrow-bg.png',
  './assets/sprites/abilities/poison-arrow-badge.png',
  './assets/DungeonBackground.png',
  './assets/DungeonBackgroundJungle.png',
  './assets/DungeonBackgroundFrozen.png',
  './assets/DungeonBackgroundVolcanic.png',
  './assets/DungeonBackgroundCatacombs.png',
  './assets/DungeonBackgroundCorrupted.png',
  './assets/DungeonBackgroundSunken.png',
  './assets/DungeonBackgroundMushroom.png',
  './assets/DungeonBackgroundCrystal.png',
  './assets/DungeonBackgroundShadow.png',
  './assets/DungeonBackgroundInfernal.png',
  './assets/SanctuaryBackground.png',
  './assets/ui/subfloor-background.png',
  './assets/ui/subfloor-entry.png',
  './assets/ui/subfloor-stairs-up.png',
  './assets/ui/subfloor-tile-back-1.png',
  './assets/ui/subfloor-tile-back-2.png',
  './assets/ui/bestiary-scroll-bg.png',
  './assets/ui/freeze-effect.png',
  './assets/ui/fire-ice-frame.png',
  './assets/ui/blood-border.png',
  './assets/ui/event-merchant.png',
  './assets/ui/event-triple-chest.png',
  './assets/ui/event-story.png',
  './assets/ui/event-trinket-trader.png',
  './assets/ui/common-tile.png',
  './assets/ui/rare-tile.png',
  './assets/ui/legendary-tile.png',
  './assets/ui/play-qr.png',
  './assets/sprites/tiles/rubble.png',
  './assets/sprites/tiles/tile-unflipped2.1.png',
  './assets/sprites/tiles/tile-unflipped3.png',
  './assets/sprites/tiles/tile-flipped2.1.png',
  './assets/sprites/effects/ashes.png',
  './assets/sprites/effects/dead-spirit-release.png',
  './assets/sprites/effects/ranger-arrow-shot.gif',
  './assets/sprites/effects/arrow-rain.gif',
  './assets/sprites/effects/FireSwordSlash.gif',
  './assets/sprites/effects/HammerSlam.gif',
  './assets/sprites/Items/potionRed.png',
  './assets/sprites/Items/potionBlue.png',
  './assets/sprites/Items/heart.png',
  './assets/sprites/Items/chest.gif',
  './assets/sprites/Items/chest-closed.png',
  './assets/sprites/Items/magic-chest-closed.png',
  './assets/sprites/Items/magic-chest-open.gif',
  './assets/sprites/Items/backpack.png',
  './assets/sprites/Items/smiths-tools.png',
  './assets/sprites/Items/fire-ring.png',
  './assets/sprites/Items/lantern.png',
  './assets/sprites/Items/mana-ring.png',
  './assets/sprites/Items/spyglass.png',
  './assets/sprites/Items/echo-charm.png',
  './assets/sprites/Items/vampire-fang.png',
  './assets/sprites/Items/glass-cannon-shard.png',
  './assets/sprites/Items/duelists-glove.png',
  './assets/sprites/Items/surge-pearl.png',
  './assets/sprites/Items/still-water-amulet.png',
  './assets/sprites/Items/greed-tooth.png',
  './assets/sprites/Items/lucky-rabbit-foot.png',
  './assets/sprites/Items/cursed-lockpick.png',
  './assets/sprites/Items/hourglass-sand.png',
  './assets/sprites/Items/thorn-wrap.png',
  './assets/sprites/Items/misers-pouch.png',
  './assets/sprites/Items/cracked-compass.png',
  './assets/sprites/Items/plague-mask.png',
  './assets/sprites/Items/soul-candle.png',
  './assets/sprites/Items/blood-pact.png',
  './assets/sprites/Items/bone-dice.png',
  './assets/sprites/Items/witching-stone.png',
  './assets/sprites/Items/forsaken-idol.png',
  './assets/sprites/Items/stormcallers-fist.png',
  './assets/sprites/Items/mirror-of-vanity.png',
  './assets/sprites/Items/deathmask.png',
  './assets/sprites/Items/traded-codex.png',
  './assets/sprites/Items/philosophers-coin.png',
  './assets/sprites/Items/stairs-down.png',
  './assets/sprites/Items/rope-coil.png',
  './assets/sprites/Items/bandage-roll.png',
  './assets/sprites/Items/shield-shard.png',
  './assets/sprites/Items/smelling-salts.png',
  './assets/sprites/Items/sonic-ear.png',
  './assets/sprites/Items/throwing-knife.png',
  './assets/sprites/Items/flash-powder.png',
  './assets/sprites/Items/rusty-nail.png',
  './assets/sprites/Items/loose-pouch.png',
  './assets/sprites/Items/whetstone.png',
  './assets/sprites/Items/gamblers-mark.png',
  './assets/sprites/monsters/toad_beast/toad-beast-idle.gif',
  './assets/sprites/monsters/onion/onion-idle.gif',
  './assets/sprites/monsters/gnome/gnome-idle.gif',
  './assets/sprites/monsters/skeleton/skeleton-idle.gif',
  './assets/sprites/monsters/slime/slime-idle.gif',
  './assets/sprites/monsters/goblin/goblin-creature.gif',
  './assets/sprites/monsters/frost_giant/frost-giant-idle.gif',
  './assets/sprites/monsters/fire_goblin/fire-goblin-creature.gif',
  './assets/sprites/monsters/crystal_spider/crystal-spider-creature.gif',
  './assets/sprites/monsters/rock_golem/rock-golem-creature.gif',
  './assets/sprites/monsters/ogre/ogre-creature.gif',
  './assets/sprites/monsters/infected_goblin/infected-goblin-creature.gif',
  './assets/sprites/monsters/corrupted_cyclops/corrupted-cyclops.gif',
  './assets/sprites/monsters/corrupted_goblin/corrupted-goblin-creature.gif',
  './assets/sprites/monsters/corrupted_pirate/corrupted-pirate-creature.gif',
  './assets/sprites/monsters/molten_spiderling/molten-spiderling-creature.gif',
  './assets/sprites/monsters/fire_centipede/fire-centipede.gif',
  './assets/sprites/monsters/drowned_hulk_pirate/drowned-hulk-pirate-creature.gif',
  './assets/sprites/monsters/mushroom_harvester/mushroom-harvester-creature.gif',
  './assets/sprites/monsters/shadow_bat/shadow-bat-creature.gif',
  './assets/sprites/monsters/crystal_bone_demon/crystal-bone-demon-creature.gif',
  './assets/sprites/monsters/dark_bone_demon/dark-bone-demon-creature.gif',
  './assets/sprites/monsters/vine_witch/vine-witch-idle.gif',
  './assets/sprites/monsters/ogre/ogre-idle.gif',
  './assets/sprites/Heroes/Ranger/__Idle.gif',
  './assets/sprites/Heroes/Ranger/__Attack.gif',
  './assets/sprites/Heroes/Warrior/warrior-idle.gif',
  './assets/sprites/Heroes/Warrior/warrior-strike.gif',
  './assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
  './assets/sprites/Heroes/Necromancer/necromancer-hero-strike.gif',
  './assets/sprites/Heroes/Engineer/turret-t1.gif',
  './assets/sprites/Heroes/Engineer/turret-tesla.gif',
  './assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
  './assets/sprites/Heroes/Engineer/engineer-hero-idle2.gif',
  './assets/sprites/Heroes/Engineer/engineer-hero-strike.gif',

  // SFX
  './audio/sfx/flip.ogg',
  './audio/sfx/hit.mp3',
  './audio/sfx/hit2.mp3',
  './audio/sfx/arrow-shot.mp3',
  './audio/sfx/slam.mp3',
  './audio/sfx/spell.ogg',
  './audio/sfx/gold.ogg',
  './audio/sfx/levelup.ogg',
  './audio/sfx/death.ogg',
  './audio/sfx/merchant.ogg',
  './audio/sfx/retreat.ogg',
  './audio/sfx/chest.ogg',
  './audio/sfx/trap.ogg',
  './audio/sfx/heal.ogg',
  './assets/audio/divine-light.mp3',
  './audio/sfx/menu.ogg',
  './audio/sfx/footsteps.mp3',

  // Music
  './audio/music/main-menu-theme.mp3',
  './audio/music/dungeon.mp3',
  './audio/music/boss.mp3',
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

/** Match cached assets even when the browser adds ?t= cache-busting (UI adds Date.now() to GIFs). */
const CACHE_MATCH_IGNORE_SEARCH = { ignoreSearch: true }

function networkFirst(request) {
  return fetch(request)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const clone = res.clone()
      caches.open(CACHE_NAME).then(c => c.put(request, clone))
      return res
    })
    .catch(() => caches.match(request, CACHE_MATCH_IGNORE_SEARCH))
    .then(response => {
      if (response) return response
      const url = new URL(request.url)
      url.search = ''
      return fetch(url.toString())
    })
}

function cacheFirst(request) {
  return caches.match(request, CACHE_MATCH_IGNORE_SEARCH).then(cached => {
    if (cached) return cached
    return fetch(request)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        return res
      })
      .catch(() => caches.match(request, CACHE_MATCH_IGNORE_SEARCH))
  }).then(response => {
    if (response) return response
    const url = new URL(request.url)
    url.search = ''
    return fetch(url.toString())
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
