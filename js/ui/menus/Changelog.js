import { CHANGELOG } from '../../data/changelog.js' // keep import; used by legacy consumers

/* ─────────────────────────────────────────────────────────────────
   Feature-panel data — ordered newest → oldest
   dateGroup: display label for the section divider
───────────────────────────────────────────────────────────────────*/
const FEATURE_PANELS = [
  // ══════════════ Jun 2026 ══════════════
  {
    dateGroup: 'Jun 2026',
    accent: '#d46060',
    icon: '🏃',
    label: 'Combat',
    title: 'Combat Flee',
    bullets: [
      'Tap 🏃 Flee during any active fight to disengage at the cost of 10% max HP',
      'The enemy survives — adjacent tiles stay locked until it is slain',
      'Enables tactical retreating: lure enemies, kite across the grid, juggle multiple threats',
    ],
    images: [
      { src: 'assets/sprites/Items/bandage-roll.png', alt: 'Bandage' },
    ],
  },
  {
    dateGroup: 'Jun 2026',
    accent: '#50aacc',
    icon: '✨',
    label: 'Quality of Life',
    title: 'HUD & Quality of Life',
    bullets: [
      'Animated HP and Mana orbs show current/max — tap an orb to use a potion directly',
      'In-run Settings button lets you change sound and options without quitting',
      'Tap the combat log to expand and scroll the full battle history',
      'Game auto-updates in the background — no manual cache clearing needed',
    ],
    images: [
      { src: 'assets/ui/htp-hud.png',     alt: 'HUD diagram' },
      { src: 'assets/ui/hud-diagram.png', alt: 'HUD' },
    ],
  },
  {
    dateGroup: 'Jun 2026',
    accent: '#4a9ed6',
    icon: '🥷',
    label: 'New Hero',
    title: 'Ninja Hero',
    bullets: [
      'The seventh hero — built around timing, stealth, and exploiting the parry system',
      'Shadowstrike (burst from stealth), Smoke Bomb (reposition + disrupt), Shuriken (ranged)',
      'Shadow Step passives suppress enemy tile locks; manipulate the counter window',
      'Unlock for 600 gold',
    ],
    images: [
      { src: 'assets/sprites/Items/dagger.png', alt: 'Dagger' },
      { src: 'assets/ui/rune-ring.png',          alt: 'Rune ring' },
    ],
  },
  {
    dateGroup: 'Jun 2026',
    accent: '#5daa6e',
    icon: '💀',
    label: 'Necromancer',
    title: "The Necromancer's Army",
    bullets: [
      'Raise fallen enemies as minions — HP and damage now scale with your own stats',
      'Gargantuan branch fuses ALL floor corpses into a single colossus; grow it with Mass Ascension',
      'Bone Armor converts a corpse into a temporary HP-absorbing shield',
      'Corpse Explosion blasts a damage ring scaled to your melee; pick Reach, Chain, or Drain mastery',
    ],
    images: [
      { src: 'assets/sprites/abilities/bone-armor.png',          alt: 'Bone Armor' },
      { src: 'assets/sprites/abilities/corpse-explosion.png',    alt: 'Corpse Explosion' },
      { src: 'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif', alt: 'Necromancer' },
    ],
  },

  // ══════════════ May 2026 ══════════════
  {
    dateGroup: 'May 2026',
    accent: '#8855cc',
    icon: '🌀',
    label: 'Endgame',
    title: 'The Void',
    bullets: [
      'Defeat floor 100 to unlock The Void and earn your first Void Pearls',
      'Three Void Trial tiers — Achan Passage (+50%), Hallow Threshold (+100%), Unmaking Void (+150%)',
      'Guaranteed Legendary gear rewards; six void-exclusive enemies with unique mechanics',
      'Unique Void Overseer boss on every tier finale; purple void tile art and atmosphere',
    ],
    images: [
      { src: 'assets/sprites/tiles/void-tile-back-1.png',         alt: 'Void tile' },
      { src: 'assets/sprites/enemies/void/void-overseer.png',     alt: 'Void Overseer' },
      { src: 'assets/sprites/enemies/void/rift-lich.png',         alt: 'Rift Lich' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#3a9e6f',
    icon: '🗺',
    label: 'World',
    title: 'Ten Biomes',
    bullets: [
      'Every 5 floors the world shifts — new enemies, tile art, backdrop, and music',
      'Dungeon → Jungle → Frozen → Volcanic → Catacombs → Corrupted → Sunken → Mushroom → Crystal → Shadow',
      'Each floor rolls its own grid width & height independently (5–7 tiles per axis)',
      'Custom unrevealed tile backs per biome with random art variants each floor',
    ],
    images: [
      { src: 'assets/sprites/tiles/jungle-tile-back-1.png',    alt: 'Jungle' },
      { src: 'assets/sprites/tiles/frozen-tile-back-1.png',    alt: 'Frozen' },
      { src: 'assets/sprites/tiles/volcanic-tile-back-1.png',  alt: 'Volcanic' },
      { src: 'assets/sprites/tiles/catacombs-tile-back-1.png', alt: 'Catacombs' },
      { src: 'assets/sprites/tiles/crystal-tile-back-1.png',   alt: 'Crystal' },
    ],
    tileImages: true,
  },
  {
    dateGroup: 'May 2026',
    accent: '#c9a050',
    icon: '🎲',
    label: 'Economy',
    title: 'Merchant, Casino & Crafting',
    bullets: [
      'Travelling Merchant (sanctuary) stocks potions, scrap, gear & Mystery Relics',
      'Casino dice event — physics dice roll with big upside and real risk',
      'Blacksmith upgrades and Forge craft new gear from scrap and disassembled drops',
      'Full recipe list in How to Play so you can plan crafts mid-run',
    ],
    images: [
      { src: 'assets/ui/event-merchant.png',            alt: 'Merchant' },
      { src: 'assets/sprites/Items/bone-dice.png',      alt: 'Dice' },
      { src: 'assets/sprites/Items/magic-chest-open.gif', alt: 'Magic chest' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#c9a050',
    icon: '⚒',
    label: 'Equipment',
    title: 'Gear, Equipment & the Blacksmith',
    bullets: [
      'Three gear slots (Weapon / Breastplate / Offhand) + Safe Pocket — survives death',
      'Stat comparison modal before every gear swap',
      'Blacksmith upgrades stats +25%, disassembles for scrap, reduces detriments',
      'Floor-scaled gear — a floor-80 common often beats a floor-15 epic',
    ],
    images: [
      { src: 'assets/sprites/Items/armor.png',       alt: 'Armor' },
      { src: 'assets/sprites/Items/axe.png',         alt: 'Weapon' },
      { src: 'assets/ui/gear-card-frame.png',        alt: 'Gear card' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#a060c0',
    icon: '📖',
    label: 'Collection',
    title: 'Trinkets, Codex & Bestiary',
    bullets: [
      'New Epic trinket tier sits between Rare and Legendary — eight trinkets promoted at launch',
      'Safe Pocket slot persists your favourite passive trinket through death and retreat',
      'Bestiary tracks every enemy encountered with full stats and mechanics',
      'Trinket Codex logs all discovered trinkets with complete effect descriptions',
    ],
    images: [
      { src: 'assets/sprites/Items/lucky-rabbit-foot.png',  alt: 'Rabbit Foot' },
      { src: 'assets/sprites/Items/glass-cannon-shard.png', alt: 'Glass Cannon' },
      { src: 'assets/sprites/Items/abyssal-lens.png',       alt: 'Abyssal Lens' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#e05050',
    icon: '🛡',
    label: 'Combat',
    title: 'Block & Parry',
    bullets: [
      'A shrinking rune ring appears when a telegraphing enemy attacks',
      'Tap the golden zone → Block (half damage, mana neutral)',
      'Swipe the direction arrow → Counter (no damage, +1 mana)',
      'Miss the window → amplified damage and mana penalty',
    ],
    images: [
      { src: 'assets/ui/rune-ring.png',                              alt: 'Rune ring' },
      { src: 'assets/sprites/Heroes/Warrior/warrior-strike.gif',     alt: 'Warrior strike' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#7b5ea7',
    icon: '🌿',
    label: 'Progression',
    title: 'Branching Mastery Trees',
    bullets: [
      'Every hero ability forks into exclusive specialisation paths',
      'Slam splits into Hemorrhage / Seismic / Reverberation branches',
      'Corpse Explosion picks one of Reach, Chain, or Drain per run',
      'Raise Minion forks into Undying Legion swarm vs. Gargantuan colossus',
    ],
    images: [
      { src: 'assets/sprites/abilities/slam.png',              alt: 'Slam' },
      { src: 'assets/sprites/abilities/corpse-explosion.png',  alt: 'Corpse Explosion' },
      { src: 'assets/sprites/abilities/raise-minion.png',      alt: 'Raise Minion' },
    ],
  },
  {
    dateGroup: 'May 2026',
    accent: '#c04b4b',
    icon: '🌙',
    label: 'World',
    title: 'Floor Modifiers & Banking Stakes',
    bullets: [
      'From floor 6 every floor rolls a random curse or boon — Bloodmoon, Mana Spring, Silence, and more',
      'Gold Vault: after each boss bank 50%, 75%, or 100% of gold; unbanked gold is lost on death',
      'Hasty Retreat saves 20% of gold for an early exit instead of losing it all',
      'Death XP penalty scales with difficulty — Easy 100% / Normal 50% / Hard 10%',
    ],
    images: [
      { src: 'assets/ui/skull.png',          alt: 'Skull' },
      { src: 'assets/sprites/Items/coin.png', alt: 'Coin' },
      { src: 'assets/ui/save-seal.png',      alt: 'Save seal' },
    ],
  },

  // ══════════════ Jan – Apr 2026 ══════════════
  {
    dateGroup: 'Jan – Apr 2026',
    accent: '#b87a30',
    icon: '🚪',
    label: 'Exploration',
    title: 'Sub-Floors & Special Encounters',
    bullets: [
      'Hidden side chambers branch off the main grid — vaults, shrines, ambushes, tunnels',
      'War Banners buff all enemies on the floor until you tear them down',
      'Treasure Goblin appears revealed with a countdown — catch it for rare loot',
      'Event tiles spawn Merchants, Story events, Triple Chests, and Trinket Traders',
    ],
    images: [
      { src: 'assets/ui/subfloor-entry.png',        alt: 'Sub-floor' },
      { src: 'assets/ui/event-triple-chest.png',    alt: 'Triple chest' },
      { src: 'assets/sprites/Items/chest.gif',      alt: 'Chest' },
    ],
  },
  {
    dateGroup: 'Jan – Apr 2026',
    accent: '#c9a050',
    icon: '⚔',
    label: 'Heroes',
    title: 'Seven Heroes, Seven Playstyles',
    bullets: [
      'Paladin marks nearby enemies with Kill Echo — aggressive pathing rewarded',
      'Ranger kites with Poison Arrow & Triple Volley; Mage chains lightning screen-wide',
      'Engineer deploys Ballistic/Tesla turrets that ping adjacent tiles for intel',
      'Vampire runs lifesteal-sustain risk; Necromancer builds a full undead army',
    ],
    images: [
      { src: 'assets/sprites/Heroes/Warrior/warrior-idle.gif',                alt: 'Paladin' },
      { src: 'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',           alt: 'Mage' },
      { src: 'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',   alt: 'Necromancer' },
      { src: 'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',         alt: 'Engineer' },
    ],
  },
]

/* ─────────────────────────────────────────────────────────────────
   Renderer
───────────────────────────────────────────────────────────────────*/
export function renderChangelogEntries() {
  const root = document.getElementById('changelog-entries')
  if (!root || root.dataset.rendered === '3') return
  root.dataset.rendered = '3'

  root.style.cssText =
    'overflow-y:auto;padding:16px 12px 32px;display:flex;flex-direction:column;gap:14px;'

  // ── Hero header ──
  const heroHeader = document.createElement('div')
  heroHeader.className = 'fp-hero-header'
  heroHeader.innerHTML = `
    <div class="fp-hero-header__runes">✦ ✦ ✦</div>
    <h1 class="fp-hero-header__title">Latest Updates</h1>
    <p class="fp-hero-header__sub">What's new in the crypts</p>
  `
  root.appendChild(heroHeader)

  // ── Panels with date-group dividers ──
  let currentGroup = null
  let panelIndex = 0

  FEATURE_PANELS.forEach(panel => {
    // Inject divider when the group changes
    if (panel.dateGroup !== currentGroup) {
      currentGroup = panel.dateGroup
      const divider = document.createElement('div')
      divider.className = 'fp-date-divider'
      divider.innerHTML = `<span class="fp-date-divider__label">${currentGroup}</span>`
      root.appendChild(divider)
    }

    const imagesHtml = panel.images.map(img =>
      `<img class="fp-img" src="${img.src}" alt="${img.alt}" loading="lazy">`
    ).join('')

    const bulletsHtml = panel.bullets.map(b =>
      `<li class="fp-bullet"><span class="fp-bullet__gem">◆</span>${b}</li>`
    ).join('')

    const imgContainerClass = panel.tileImages
      ? 'fp-panel__images fp-panel__images--tiles'
      : 'fp-panel__images'

    const el = document.createElement('article')
    el.className = 'fp-panel fp-panel--hidden'
    el.style.setProperty('--fp-accent', panel.accent)
    el.dataset.panelIndex = panelIndex++
    el.innerHTML = `
      <div class="fp-panel__header">
        <span class="fp-panel__icon">${panel.icon}</span>
        <span class="fp-panel__label">${panel.label}</span>
        <h2 class="fp-panel__title">${panel.title}</h2>
      </div>
      <div class="fp-panel__body">
        <ul class="fp-panel__bullets">${bulletsHtml}</ul>
        <div class="${imgContainerClass}">${imagesHtml}</div>
      </div>
    `
    root.appendChild(el)
  })

  // ── Footnote ──
  const footnote = document.createElement('p')
  footnote.className = 'fp-footnote'
  footnote.textContent = '✦  More content arrives with every update  ✦'
  root.appendChild(footnote)

  _initAnimations(root)
}

function _initAnimations(root) {
  if (typeof gsap === 'undefined') return

  const panels = root.querySelectorAll('.fp-panel')
  gsap.set(panels, { opacity: 0, y: 36 })

  // Also animate dividers
  const dividers = root.querySelectorAll('.fp-date-divider')
  gsap.set(dividers, { opacity: 0, x: -16 })

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      const el = entry.target

      if (el.classList.contains('fp-panel')) {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 0.55, delay: 0.05, ease: 'power2.out',
          onStart() { el.classList.remove('fp-panel--hidden') },
        })
        const imgs = el.querySelectorAll('.fp-img')
        gsap.from(imgs, { opacity: 0, scale: 0.7, duration: 0.4, delay: 0.25, stagger: 0.08, ease: 'back.out(1.4)' })
      } else {
        // date divider
        gsap.to(el, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' })
      }

      observer.unobserve(el)
    })
  }, { threshold: 0.12, root })

  panels.forEach(p => observer.observe(p))
  dividers.forEach(d => observer.observe(d))

  const header = root.querySelector('.fp-hero-header')
  if (header) gsap.from(header, { opacity: 0, y: -20, duration: 0.6, ease: 'power3.out' })
}
