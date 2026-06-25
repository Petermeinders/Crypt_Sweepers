// Crypt Sweepers — Service Worker
// Strategy: Cache-first for assets, network-first for HTML.
// Version bump CACHE_NAME to force cache refresh on deploy.
// Keep in sync with APP_VERSION in js/appVersion.js and version.json.

const CACHE_NAME = 'crypt-sweepers-v530'

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
  './node_modules/gsap/dist/gsap.min.js',
  './js/ui/DiceRoller.js',
  './js/config.js',
  './js/data/balance/loadFloorDifficulty.js',
  './js/data/balance/floor-difficulty.json',
  './js/data/balance/loadVoidCorruption.js',
  './js/data/balance/void-corruption.json',
  './js/core/GameState.js',
  './js/core/EventBus.js',
  './js/core/Logger.js',
  './js/core/GameController.js',
  './js/core/RunContext.js',
  './js/core/tapState.js',
  './js/core/GameStateHandlers.js',
  './js/data/abilities.js',
  './js/data/enemies.js',
  './js/data/items.js',
  './js/data/combinations.js',
  './js/data/transmutation.js',
  './js/data/gems.js',
  './js/data/events.js',
  './js/data/tileBlurbs.js',
  './js/data/tileIcons.js',
  './js/data/tiles.js',
  './js/data/upgrades.js',
  './js/data/ranger.js',
  './js/data/mage.js',
  './js/data/changelog.js',
  './js/data/credits.js',
  './js/data/characters.js',
  './js/data/gear.js',
  './js/boot/SaveMigrator.js',
  './js/boot/DevToolsLoader.js',
  './js/boot/boot.js',
  './js/boot/persistenceListeners.js',
  './js/main/wireHud.js',
  './js/main/wireMenus.js',
  './js/main/wireKeyboard.js',
  './js/ui/menus/shared.js',
  './js/ui/menus/HeroSelect.js',
  './js/ui/menus/GoldShopPanel.js',
  './js/ui/menus/BlacksmithPanel.js',
  './js/ui/menus/CasinoPanel.js',
  './js/ui/menus/CreditsPanel.js',
  './js/ui/menus/CheckpointPanel.js',
  './js/ui/menus/BackpackPanel.js',
  './js/ui/menus/EquipmentOverlay.js',
  './js/ui/menus/SettingsPanel.js',
  './js/ui/menus/saveTransfer.js',
  './js/controllers/BalanceBotBridge.js',
  './js/controllers/CheatController.js',
  './js/controllers/TileTapRouter.js',
  './js/controllers/TargetingController.js',
  './js/controllers/SpecialSpawnController.js',
  './js/controllers/TileRevealController.js',
  './js/controllers/CombatController.js',
  './js/controllers/FloorController.js',
  './js/controllers/GearController.js',
  './js/controllers/InventoryController.js',
  './js/controllers/SafePocketController.js',
  './js/controllers/ForgeController.js',
  './js/controllers/TransmutationController.js',
  './js/controllers/GemController.js',
  './js/controllers/BackpackTabs.js',
  './js/controllers/MaterialsController.js',
  './js/controllers/EventTileController.js',
  './js/controllers/SubFloorController.js',
  './js/heroes/warrior.js',
  './js/heroes/ranger.js',
  './js/heroes/mage.js',
  './js/heroes/engineer.js',
  './js/heroes/necromancer.js',
  './js/heroes/vampire.js',
  './js/heroes/HeroAbilityRegistry.js',
  './js/systems/LootTables.js',
  './js/systems/PlayerStats.js',
  './js/systems/EnemyMechanics.js',
  './js/systems/VoidEnemyMechanics.js',
  './js/systems/VoidTrial.js',
  './js/systems/Haptics.js',
  './js/ui/menus/Changelog.js',
  './js/save/SaveManager.js',
  './js/save/SaveImporter.js',
  './js/systems/AudioManager.js',
  './js/systems/CombatResolver.js',
  './js/systems/MetaProgression.js',
  './js/systems/CasinoEngine.js',
  './js/data/casinoConfig.js',
  './js/systems/Bestiary.js',
  './js/systems/TrinketCodex.js',
  './js/systems/ProgressionSystem.js',
  './js/systems/TileEngine.js',
  './js/ui/uiShared.js',
  './js/ui/Hud.js',
  './js/ui/Grid.js',
  './js/ui/CombatUi.js',
  './js/ui/Modals.js',
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
  './assets/sprites/abilities/raise-minion.png',
  './assets/sprites/abilities/strengthen-minion.png',
  './assets/sprites/abilities/corpse-explosion.png',
  './assets/sprites/abilities/bone-armor.png',
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
  './assets/ui/htp-hud.png',
  './assets/ui/htp-equipment.png',
  './assets/ui/htp-backpack.png',
  './assets/ui/menu-panel-wood-frame.png',
  './assets/ui/menu-btn-wood-bars.png',
  './assets/ui/credits-background.png',
  './assets/ui/menu-btn-wood-plaque.png',
  './assets/ui/menu-btn-crystal.png',
  './assets/ui/btn-void.png',
  './assets/ui/void/void-floor-background.png',
  './assets/sprites/tiles/void-tile-back-1.png',
  './assets/sprites/tiles/void-tile-back-2.png',
  './assets/sprites/tiles/void-tile-back-3.png',
  './assets/sprites/tiles/void-tile-back-4.png',
  './assets/ui/void/void-selection-background.png',
  './assets/ui/void/void-banner-tier-1.png',
  './assets/ui/void/void-banner-tier-2.png',
  './assets/ui/void/void-banner-tier-3.png',
  './assets/ui/title-logo.gif',
  './assets/ui/diff-shelf.png',
  './assets/ui/rune-ring.png',
  './assets/ui/rune-ring2.png',
  './assets/sprites/effects/VampireAttack.gif',
  './js/lib/omggif.js',
  './test-parry-ranger.html',
  './assets/ui/save-seal.png',
  './assets/ui/skull.png',
  './assets/ui/menu-btn-slate.png',
  './assets/ui/menu-btn-stone-speckled.png',
  './assets/ui/menu-btn-stone-plate.png',
  './assets/ui/menu-btn-stone-rivets.png',
  './assets/ui/menu-btn-stone-rivets-wide.png',
  './assets/ui/btn-back-stone.png',
  './assets/ui/cmp-panel-bg.png',
  './assets/ui/cmp-btn-stone.png',
  './assets/ui/cmp-btn-paper.png',
  './assets/ui/cmp-stat-bg.png',
  './assets/ui/menu-btn-stone-red.png',
  './assets/sprites/tiles/rubble.png',
  './assets/sprites/tiles/tile-hole.png',
  './assets/sprites/tiles/tile-unflipped2.1.png',
  './assets/sprites/tiles/tile-unflipped3.png',
  './assets/sprites/tiles/jungle-tile-back-1.png',
  './assets/sprites/tiles/jungle-tile-back-2.png',
  './assets/sprites/tiles/frozen-tile-back-1.png',
  './assets/sprites/tiles/frozen-tile-back-2.png',
  './assets/sprites/tiles/volcanic-tile-back-1.png',
  './assets/sprites/tiles/volcanic-tile-back-2.png',
  './assets/sprites/tiles/catacombs-tile-back-1.png',
  './assets/sprites/tiles/catacombs-tile-back-2.png',
  './assets/sprites/tiles/corrupted-forest-tile-back-1.png',
  './assets/sprites/tiles/corrupted-forest-tile-back-2.png',
  './assets/sprites/tiles/sunken-temple-tile-back-1.png',
  './assets/sprites/tiles/sunken-temple-tile-back-2.png',
  './assets/sprites/tiles/sunken-temple-tile-back-3.png',
  './assets/sprites/tiles/mushroom-grotto-tile-back-1.png',
  './assets/sprites/tiles/mushroom-grotto-tile-back-2.png',
  './assets/sprites/tiles/crystal-tile-back-1.png',
  './assets/sprites/tiles/crystal-tile-back-2.png',
  './assets/sprites/tiles/crystal-tile-back-3.png',
  './assets/sprites/tiles/shadow-tile-back-1.png',
  './assets/sprites/tiles/shadow-tile-back-2.png',
  './assets/sprites/tiles/infernal-pit-tile-back-1.png',
  './assets/sprites/tiles/infernal-pit-tile-back-2.png',
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
  './assets/sprites/Items/armor.png',
  './assets/sprites/Items/sword.png',
  './assets/sprites/Items/shield.png',
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
  './assets/sprites/Items/abyssal-lens.png',
  './assets/sprites/Items/barbed-mantle.png',
  './assets/sprites/Items/delvers-kit.png',
  './assets/sprites/Items/devils-gambit.png',
  './assets/sprites/Items/eagle-eye.png',
  './assets/sprites/Items/festering-wound.png',
  './assets/sprites/Items/field-kit.png',
  './assets/sprites/Items/fortunes-fool.png',
  './assets/sprites/Items/hollowed-acorn.png',
  './assets/sprites/Items/honed-edge.png',
  './assets/sprites/Items/hunger-stone.png',
  './assets/sprites/Items/hunters-instinct.png',
  './assets/sprites/Items/infected-blade.png',
  './assets/sprites/Items/inferno-barbs.png',
  './assets/sprites/Items/living-bramble.png',
  './assets/sprites/Items/mana-crucible.png',
  './assets/sprites/Items/mending-moss.png',
  './assets/sprites/Items/navigators-chart.png',
  './assets/sprites/Items/paupers-crown.png',
  './assets/sprites/Items/plague-rat-skull.png',
  './assets/sprites/Items/predators-edge.png',
  './assets/sprites/Items/razors-edge.png',
  './assets/sprites/Items/resonance-core.png',
  './assets/sprites/Items/resurrection-stone.png',
  './assets/sprites/Items/sanguine-covenant.png',
  './assets/sprites/Items/scavengers-bag.png',
  './assets/sprites/Items/smoke-bomb.png',
  './assets/sprites/Items/soulbound-blade.png',
  './assets/sprites/Items/spell-siphon.png',
  './assets/sprites/Items/spiked-collar.png',
  './assets/sprites/Items/temporal-wick.png',
  './assets/sprites/Items/tomb-tithe.png',
  './assets/sprites/Items/twin-blades.png',
  './assets/sprites/Items/twin-fates.png',
  './assets/sprites/Items/vault-key.png',
  './assets/sprites/Items/wardens-brand.png',
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
  './assets/sprites/monsters/troll/troll-creature.png',
  './assets/sprites/monsters/wraith/wraith-creature.png',
  './assets/sprites/monsters/zombie/zombie-creature.png',
  './assets/sprites/monsters/goblin_king/goblin-king-creature.png',
  './assets/sprites/monsters/skeleton_lord/skeleton-lord-creature.png',
  './assets/sprites/monsters/troll_warlord/troll-warlord-creature.png',
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
  './assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
  './assets/sprites/Heroes/Mage/blue-mage-hero-attack-small-speed.gif',
  './assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
  './assets/sprites/monsters/archer_goblin/archer-goblin-idle.gif',
  './assets/sprites/monsters/archer_goblin/archer-goblin-attack.gif',
  './assets/sprites/monsters/treasure_goblin/treasure-goblin.png',
  './assets/sprites/monsters/mouse/mouse-idle.gif',
  './assets/sprites/monsters/void/void-maw.png',
  './assets/sprites/monsters/void/void-ghast.png',
  './assets/sprites/monsters/void/hook-crawler.png',
  './assets/sprites/monsters/void/shard-ravager.png',
  './assets/sprites/monsters/void/void-behemoth.png',
  './assets/sprites/monsters/void/rift-lich.png',
  './assets/sprites/monsters/void/void-overseer.png',
  './assets/sprites/monsters/child_mode/cat.png',
  './assets/sprites/monsters/child_mode/bee.png',
  './assets/sprites/monsters/child_mode/cow.png',
  './assets/sprites/monsters/child_mode/butterfly.png',
  './assets/sprites/monsters/child_mode/corgi.png',
  './assets/sprites/monsters/child_mode/kitten-purple.png',
  './assets/sprites/monsters/child_mode/owl.png',
  './assets/sprites/monsters/child_mode/rabbit.png',
  './assets/sprites/monsters/child_mode/turtle.png',
  './assets/sprites/monsters/child_mode/bluey.png',
  './assets/sprites/monsters/child_mode/parrot.png',
  './assets/sprites/monsters/child_mode/fluffy-cat.png',
  './assets/sprites/monsters/child_mode/fluff-ball.png',
  './assets/sprites/monsters/child_mode/bee-3d.png',
  './assets/sprites/monsters/child_mode/cow-3d.png',
  './assets/sprites/monsters/child_mode/fish.png',
  './assets/sprites/monsters/child_mode/frog.png',
  './assets/sprites/monsters/child_mode/octopus.png',
  './assets/sprites/monsters/child_mode/starfish.png',
  './assets/sprites/monsters/child_mode/elephant.png',
  './assets/sprites/monsters/child_mode/snake.png',
  './assets/sprites/monsters/child_mode/bluebird.png',
  './assets/sprites/monsters/child_mode/dolphin.png',
  './assets/sprites/monsters/child_mode/tuxedo-cat.png',
  './assets/sprites/monsters/child_mode/whale.png',
  './assets/sprites/monsters/child_mode/bubble.png',
  './assets/sprites/monsters/child_mode/pig-cowbell.png',
  './assets/sprites/monsters/child_mode/cow-plush.png',
  './assets/sprites/monsters/child_mode/deer.png',
  './assets/sprites/monsters/child_mode/duck-star.png',
  './assets/sprites/monsters/child_mode/mouse-star.png',
  './assets/sprites/monsters/child_mode/ladybug.png',
  './assets/sprites/gear/weapon/common.webp',
  './assets/sprites/gear/weapon/rare.webp',
  './assets/sprites/gear/weapon/epic.webp',
  './assets/sprites/gear/weapon/legendary.webp',
  './assets/sprites/gear/breastplate/common.webp',
  './assets/sprites/gear/breastplate/rare.webp',
  './assets/sprites/gear/breastplate/epic.webp',
  './assets/sprites/gear/breastplate/legendary.webp',
  './assets/sprites/gear/offhand/common.webp',
  './assets/sprites/gear/offhand/rare.webp',
  './assets/sprites/gear/offhand/epic.webp',
  './assets/sprites/gear/offhand/legendary.webp',

  // SFX
  './audio/sfx/flip.ogg',
  './audio/sfx/hit.mp3',
  './audio/sfx/hit2.mp3',
  './audio/sfx/arrow-shot.mp3',
  './audio/sfx/archer-shot.mp3',
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
  './audio/sfx/confirm-click.mp3',
  './audio/sfx/turret-destroyed.mp3',
  './audio/sfx/parry-block.ogg',
  './audio/sfx/parry-counter.ogg',
  './audio/sfx/parry-miss.ogg',

  // Music
  './audio/music/main-menu-theme.mp3',
  './audio/music/dungeon.mp3',
  './audio/music/echoes-celestial-sanctuary.mp3',

  // TD Minigame
  './js/data/tdPieces.js',
  './js/systems/TDPathfinder.js',
  './js/systems/TDCombat.js',
]

// ── Install: precache all assets ──────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

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

/** Match cached assets when the browser adds ?t= cache-busting (UI adds Date.now() to GIFs). */
const CACHE_MATCH_IGNORE_SEARCH = { ignoreSearch: true }

function cacheMatchOpts(request) {
  const path = new URL(request.url).pathname
  if (/\.(png|webp|gif|jpg|jpeg|svg|ogg|mp3|wav)$/i.test(path)) {
    return CACHE_MATCH_IGNORE_SEARCH
  }
  return undefined
}

function networkFirst(request) {
  const matchOpts = cacheMatchOpts(request)
  return fetch(request)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const clone = res.clone()
      caches.open(CACHE_NAME).then(c => c.put(request, clone))
      return res
    })
    .catch(() => caches.match(request, matchOpts))
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
        if (res.status === 206) return res
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

  // Never cache version manifest — clients use it to detect stale builds
  if (path.endsWith('/version.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }))
    return
  }

  // Cache-first only for images and audio (static assets)
  if (/\.(png|webp|gif|jpg|jpeg|svg|ogg|mp3|wav)$/i.test(path)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Network-first for everything else (HTML, JS, CSS, JSON)
  event.respondWith(networkFirst(request))
})
