/**
 * Main-menu “Latest Updates” feed — newest entries first.
 * Append new releases at the top when you ship.
 */
export const CHANGELOG = [
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-21',
    version:   'v252',
    title:     'HUD layout tune — bigger ability & key slots',
    summary:
      'The bottom HUD gets bigger, easier-to-tap targets. Six ability slots sit in a 3×2 grid so each cell is noticeably larger without making the HUD any taller, the backpack and golden-key tiles are bigger, and the unused “helmet” slot is gone.',
    items: [
      {
        tag:  'UI',
        text: 'Ability slots — switched from 2×3 to a 3×2 grid so each of the six cells is larger at the same HUD height; ability art fills more of the button.',
      },
      {
        tag:  'UI',
        text: 'Key column — removed the decorative locked helmet slot; the remaining backpack and golden-key tiles use the extra room to grow into larger squares.',
      },
      {
        tag:  'Fix',
        text: 'Prevented a layout cycle where unlocking an active ability (e.g. Slam) could blow up the HUD height — the actions grid now has a stable 3:2 aspect and a max height, so HP/mana numbers stay readable.',
      },
      {
        tag:  'Systems',
        text: 'Service worker cache bumped so the updated HUD loads cleanly for returning players.',
      },
    ],
  },
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-20',
    version:   'v251',
    title:     'Hero select refresh & Engineer Seismic Ping',
    summary:
      'The character screen gets a cinematic altar layout with clearer actions, and the Engineer’s turret now pings nearby tiles for intel.',
    items: [
      {
        tag:  'Hero',
        text: 'Paladin — **Sense Evil** is replaced by **Kill Echo**: the first mark each floor is the closest hidden enemy to the entrance; each kill of a marked foe widens the pulse (1 → 2 → 3 simultaneous echo hints) anchored on that kill, favoring aggressive pathing.',
      },
      {
        tag:  'UI',
        text: 'Hero select — “Choose Your Hero” header, centered Back under the subtitle, per-hero colors, carousel dots, circular Select / Selected / Unlock / Coming Soon button, ability slots around the portrait, and subtle rising particles on the active hero.',
      },
      {
        tag:  'UI',
        text: 'Mobile — hero art scales to the altar stage (container-based max height, safer viewport height, gentler float) so tall sprites like the Paladin aren’t clipped at the top.',
      },
      {
        tag:  'Hero',
        text: 'Engineer — Seismic Ping (innate passive, L1): when you finish placing or moving your turret (or it follows you to a new floor), it scans the 8 adjacent hidden tiles for category hints and flashes them briefly; future masteries can widen reach.',
      },
      {
        tag:  'Systems',
        text: 'Service worker cache bumped so menus and stylesheets refresh for returning players.',
      },
    ],
  },
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-18',
    version:   'v250',
    title:     'Necromancer HUD portrait fix',
    summary:
      'The in-run hero portrait now matches the hero you picked — Necromancer no longer shows the Soldier’s animations.',
    items: [
      {
        tag:  'Fix',
        text: 'Necromancer: HUD idle and strike GIFs use the Necromancer assets instead of falling back to the Warrior portrait.',
      },
      {
        tag:  'Systems',
        text: 'Service worker cache bumped so the update loads reliably for returning players.',
      },
    ],
  },
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-18',
    version:   'v249',
    title:     'Active abilities, deadlock escape & UI refresh',
    summary:   'Hero actives now enter the level-up pool, soft-locks get a climb-out, and the main menu gets a visual overhaul.',
    items: [
      {
        tag:  'Systems',
        text: 'Active abilities are no longer auto-granted — they appear in the level-up pool. First level-up always offers your unlocked actives; later picks add mastery and stat options.',
      },
      {
        tag:  'Systems',
        text: 'Deadlock detector: when no reachable tiles remain, an adjacent pit pulses amber — tap it to climb through and continue.',
      },
      {
        tag:  'UI',
        text: 'Settings button (⚙️) added to the in-run header so sound and options can be changed without quitting.',
      },
      {
        tag:  'UI',
        text: 'New stone-tablet logo, updated New Run and Void button art, and new parchment QR code on the main menu.',
      },
      {
        tag:  'Systems',
        text: 'Fix: reachability no longer incorrectly spreads from holes, blockages, or archer goblins after a page refresh.',
      },
    ],
  },
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-17',
    version:   'v233',
    title:     'Treasure Goblin & dungeon polish',
    summary:
      'A new optional encounter, necromancer tuning, and presentation upgrades.',
    items: [
      {
        tag:  'New',
        text: 'Treasure Goblin — rarely appears revealed with a turn timer; path to him for a rare trinket or he slips away.',
      },
      {
        tag:  'Hero',
        text: 'Necromancer: one minion per corpse — when it falls, the ash is cleared and cannot be raised again.',
      },
      {
        tag:  'Mage',
        text: 'Chain Lightning: jagged SVG bolt and a sharper electrical sound.',
      },
      {
        tag:  'Balance',
        text: 'Easy mode: stronger trade-off on XP & gold versus Normal (see difficulty row).',
      },
    ],
  },
  {
    dateLabel: 'Apr 2026',
    dateIso:   '2026-04-17',
    version:   '',
    title:     'Necromancer joins the expedition',
    summary:   'Dark arts, disposable allies, and new build choices.',
    items: [
      {
        tag:  'Hero',
        text: 'Necromancer — Master\'s Sight hints and Raise Minion from slain foes (mana cost, emoji minions for now).',
      },
      {
        tag:  'Progress',
        text: 'Minion Mastery picks on level-up improve raised minion HP and damage.',
      },
    ],
  },
  {
    dateLabel: 'Mar 2026',
    dateIso:   '2026-03-22',
    version:   '',
    title:     'Vampire — night in the crypts',
    summary:   'A new hero who trades max HP for speed, lifesteal, and shadowy actives.',
    items: [
      {
        tag:  'Hero',
        text: 'Vampire hero — Dark Eyes marking, slam-style attacks, and sustain tuned around risk.',
      },
      {
        tag:  'Combat',
        text: 'Melee flow updated so actives and passives interact cleanly with the new kit.',
      },
    ],
  },
  {
    dateLabel: 'Mar 2026',
    dateIso:   '2026-03-08',
    version:   '',
    title:     'Engineer deploys',
    summary:   'Ballistic and Tesla turrets join the fight — place, upgrade, and protect your tile.',
    items: [
      {
        tag:  'Hero',
        text: 'Engineer — construct a turret on eligible tiles; spend mana to level it up mid-run.',
      },
      {
        tag:  'New',
        text: 'Tesla perimeter zaps or ballistic volleys — two modes, one stubborn companion.',
      },
    ],
  },
  {
    dateLabel: 'Feb 2026',
    dateIso:   '2026-02-18',
    version:   '',
    title:     'Ranger volleys & poison',
    summary:   'The ranged hero gets a full active bar: barrages, poison shots, and triple volleys.',
    items: [
      {
        tag:  'Hero',
        text: 'Ranger — Arrow Barrage, Poison Arrow, Triple Volley with grid targeting previews.',
      },
      {
        tag:  'Balance',
        text: 'Trapfinder and ranged pacing tuned so kiting and traps stay fair.',
      },
    ],
  },
  {
    dateLabel: 'Feb 2026',
    dateIso:   '2026-02-01',
    version:   '',
    title:     'Arcane foundations — Mage',
    summary:   'Spells, mana economy, and screen-wide lightning enter the dungeon.',
    items: [
      {
        tag:  'Mage',
        text: 'Mage — Chain Lightning, Telekinetic Throw, Blinding Light; diagonal movement option.',
      },
      {
        tag:  'New',
        text: 'Spell mana costs and HUD slots aligned with the tile-flip loop.',
      },
    ],
  },
  {
    dateLabel: 'Jan 2026',
    dateIso:   '2026-01-12',
    version:   '',
    title:     'Pressure & side chambers',
    summary:   'The dungeon gains a war banner threat and hidden sub-floors off the main grid.',
    items: [
      {
        tag:  'World',
        text: 'War banner — a floor buff until you tear the standard down; worth racing before fights snowball.',
      },
      {
        tag:  'New',
        text: 'Sub-floor entries — vaults, shrines, ambushes, tunnels, and more in self-contained grids.',
      },
    ],
  },
  {
    dateLabel: 'Dec 2025',
    dateIso:   '2025-12-05',
    version:   '',
    title:     'Ten biomes, ten moods',
    summary:   'Every five floors the theme shifts — new enemy pools and backdrop art.',
    items: [
      {
        tag:  'World',
        text: 'Biome rotation — dungeon, jungle, frozen, volcanic, and beyond; music and visuals follow.',
      },
      {
        tag:  'Balance',
        text: 'Threat clues and spawn tables reweighted so depth stays readable.',
      },
    ],
  },
  {
    dateLabel: 'Nov 2025',
    dateIso:   '2025-11-14',
    version:   '',
    title:     'Codex, shop, and between-run growth',
    summary:   'Discovery UI, trinket catalog, and gold-funded prep for the next descent.',
    items: [
      {
        tag:  'Meta',
        text: 'Bestiary & Trinket Codex — track what you have seen and read full effect text.',
      },
      {
        tag:  'UI',
        text: 'Gold Shop consumables and account-wide Passive Upgrades on the main menu.',
      },
    ],
  },
  {
    dateLabel: 'Oct 2025',
    dateIso:   '2025-10-01',
    version:   '',
    title:     'Paladin baseline & PWA shell',
    summary:   'First playable loop: flip tiles, fight, die, spend gold, try again — wrapped as an app.',
    items: [
      {
        tag:  'Systems',
        text: 'IndexedDB saves, export/import JSON, and offline-friendly service worker caching.',
      },
      {
        tag:  'Audio',
        text: 'Event-driven music crossfades and SFX hooks for combat, chests, and floor changes.',
      },
    ],
  },
]
