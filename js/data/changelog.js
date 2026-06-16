/**
 * Main-menu “Latest Updates” feed — newest entries first.
 * Append new releases at the top when you ship.
 */
export const CHANGELOG = [
  {
    dateLabel: 'Jun 2026',
    dateIso:   '2026-06-16',
    version:   'v501',
    title:     'HUD refresh & smarter potions',
    summary:
      'The HUD gets a visual overhaul — a combined XP + stats panel, animated potion orbs that show your current HP/mana at a glance, and tapping an orb now uses your potion directly from the HUD. A few lingering bugs were also fixed.',
    items: [
      {
        tag:  'UI',
        text: 'New HUD structure — XP bar and main stat panel are combined into a single cohesive block with improved visual organisation.',
      },
      {
        tag:  'UI',
        text: 'Potion orbs — HP and mana orbs now display your current / max values and fill with animated art. Tapping an orb uses the matching potion directly without opening the backpack.',
      },
      {
        tag:  'Fix',
        text: 'Several minor layout and styling bugs fixed alongside the HUD refresh.',
      },
    ],
  },
  {
    dateLabel: 'Jun 2026',
    dateIso:   '2026-06-08',
    version:   'v500',
    title:     'Ninja hero, bug fixes & polish',
    summary:
      'Ninja is now a fully playable hero. Three trinkets that were silently doing nothing are fixed. Chain Lightning no longer spams console errors. Enemy stat bars no longer clip. Leader flags now appear only after a tile is flipped.',
    items: [
      {
        tag:  'Feature',
        text: 'Ninja hero — fully playable with Shadowstrike, Smoke Bomb, Shuriken abilities and Shadow Step I/II passives. Unlock for 600 gold. Abilities designed around manipulating the parry block/counter window.',
      },
      {
        tag:  'Fix',
        text: 'Lucky Rabbit Foot, Devil\'s Gambit, and Glass Cannon Shard were completely non-functional — hasItem checks had blank IDs. All three now work correctly.',
      },
      {
        tag:  'Fix',
        text: 'Chain Lightning no longer spams SVG errors when the bolt source and target are the same point (overload bounce or detached tile elements).',
      },
      {
        tag:  'Fix',
        text: 'Enemy HP/attack stat bar no longer clips at the tile edge for high-HP enemies (e.g. Rock Golem 176 HP).',
      },
      {
        tag:  'Fix',
        text: 'Leader flag 🚩 now appears only on revealed tiles (was visible on unrevealed tile backs). Repositioned to top-right corner, smaller.',
      },
      {
        tag:  'UX',
        text: 'Tapping a passive trinket in the backpack now opens the Safe Pocket compare modal instead of immediately using the item.',
      },
      {
        tag:  'Balance',
        text: 'TD minigame (experimental) disabled by default. Subfloor entries resume normal combat room behaviour unless CONFIG.subFloor.tdMode is manually enabled.',
      },
    ],
  },
  {
    dateLabel: 'Jun 2026',
    dateIso:   '2026-06-01',
    version:   'v493',
    title:     'Void trial finale boss',
    summary:
      'Void trials now end with the Void Overseer — a unique tentacled boss with custom art on every tier finale (floors 20 / 30 / 50).',
    items: [
      {
        tag:  'Feature',
        text: 'Void Overseer — replaces the rotating main-game boss on void trial finale floors. Scales with void depth and tier multiplier; telegraphs counter-attacks like other bosses.',
      },
    ],
  },
  {
    dateLabel: 'Jun 2026',
    dateIso:   '2026-06-01',
    version:   'v492',
    title:     'Void monsters & trial atmosphere',
    summary:
      'Six void-only enemies with unique mechanics, purple void tile backs and backdrop, and fast ambush enemies now use an attributes tag instead of a separate tile type.',
    items: [
      {
        tag:  'Feature',
        text: 'Void roster — Void Maw (fast + Death Split), Void Ghast (Gaze fizzle stacks), Hook Crawler (Armor Rend on reveal and counter), Shard Ravager (Shatter Shell), Void Behemoth (Obsidian Plate), Rift Lich (Rift Maw mana/HP drain). Void trials spawn these only — no main-game enemies mixed in.',
      },
      {
        tag:  'Feature',
        text: 'Void visuals — crypt floor backdrop and four purple cobblestone tile backs on void trial grids.',
      },
      {
        tag:  'Balance',
        text: 'Fast enemies — collapsed `enemy_fast` tile type into `attributes: ["fast"]`; ~7/29 enemy rolls stay fast with no pre-flip telegraph. Goblin removed from the normal enemy pool.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-31',
    version:   'v486',
    title:     'Overlapping gear tier stat bands',
    summary:
      'Rare/epic/legendary stat floors lowered so tiers overlap — combined with floor scaling, a deep common can out-roll a shallow epic.',
    items: [
      {
        tag:  'Balance',
        text: 'Gear stat bands overlap by tier (e.g. epic damage can roll as low as rare). Floor depth still drives power — F85 common often beats F15 epic on primary stats.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-31',
    version:   'v485',
    title:     'Floor-scaled gear & enemy HP tuning',
    summary:
      'Gear stat bands now scale with drop floor (all tiers and detriments). Enemy HP scaling nudged up slightly; damage unchanged.',
    items: [
      {
        tag:  'Balance',
        text: 'Gear drops scale with floor depth — F80 commons are ~2.7× stronger primaries than F10; detriments scale too. Blacksmith +25% upgrades multiply rolled stats.',
      },
      {
        tag:  'Balance',
        text: 'Enemy HP curve +10% (22%/floor early, 33%/floor late). Damage scaling unchanged.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-31',
    version:   'v483',
    title:     'Loot & merchant balance pass',
    summary:
      'Legendary gear is rarer in deep floors, chests no longer double-drop gear, the travelling merchant is sanctuary-only with fairer Mystery Relic odds, and triple-chest events roll tier-weighted trinkets.',
    items: [
      {
        tag:  'Balance',
        text: 'Legendary gear drop weight — 5% on floors 41–60, 7% on floors 61–100 (down from 8% / 20%).',
      },
      {
        tag:  'Fix',
        text: 'Chests award one item only — removed the 2.5% bonus gear roll on chest open.',
      },
      {
        tag:  'Balance',
        text: 'Travelling Merchant (sanctuary) — HP/Mana potions cost 20g; Mystery Relic rolls Rare 70% / Epic 25% / Legendary 5%.',
      },
      {
        tag:  'Balance',
        text: 'Event tiles no longer spawn a merchant shop — story events fill that slot. Triple Chest: Rare 70% / Epic 25% / Legendary 5% on pick.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-31',
    version:   'v482',
    title:     'The Void unlocks at floor 100',
    summary:
      'Defeating the floor 100 boss for the first time completes the base game, awards a Void Pearl, and unlocks The Void on the main menu.',
    items: [
      {
        tag:  'Feature',
        text: 'Void Pearls — +1 on floor 50 boss (Void becomes playable); +2 on first floor 100 completion. Main menu Void requires at least one Pearl.',
      },
      {
        tag:  'Feature',
        text: 'Main menu — The Void button is visible but locked until completion; pearl count displays once unlocked.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v481',
    title:     'Sanctuary stairs & rope resume fix',
    summary:
      'Resuming on a sanctuary floor no longer leaves the stairs and vault rope untappable after a mid-transition save.',
    items: [
      {
        tag:  'Fix',
        text: 'Sanctuary resume — stale exitResolved / ropeResolved flags from interrupted floor transitions are cleared on load; atRest is restored for 3×3 sanctuary grids.',
      },
      {
        tag:  'Fix',
        text: 'Stairs — confirming descent no longer marks the exit resolved before the floor transition finishes, preventing bricked saves if the tab closes mid-animation.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v480',
    title:     'Update banner dismiss fix',
    summary:
      'The “×” on the update notice now actually hides the banner and keeps it dismissed for this session.',
    items: [
      {
        tag:  'Fix',
        text: 'Update banner — dismiss button now hides the popup (missing CSS rule); dismissed state persists until a newer version is available.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v479',
    title:     'Gambler dice roll fix',
    summary:
      'The Gambler event roll button works reliably on repeat visits and falls back to a simple roll if physics fails to load.',
    items: [
      {
        tag:  'Fix',
        text: 'Gambler — roll button re-enables on each visit; click handler wires immediately; missing Matter.js or DiceRoller errors fall back to a normal random roll instead of a dead button.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v478',
    title:     'Automatic app updates',
    summary:
      'Mobile players no longer need to manually clear cache — the game checks for new versions, shows an update banner, and loads fresh code on each visit.',
    items: [
      {
        tag:  'Fix',
        text: 'Auto-update — version.json + bootstrap loader fetch the latest main.js; service worker polls on focus every 5 minutes; “Update now” banner and Settings → Check for updates apply pending builds.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v477',
    title:     'Full-backpack gear swap fix',
    summary:
      'Swapping gear or trinkets when the backpack is full no longer crashes mid-replace — the same renderBackpack bug that blocked opening the bag is fully fixed and hardened.',
    items: [
      {
        tag:  'Fix',
        text: 'Full backpack — gear and trinket replace flows no longer throw gearPickupMode before initialization when you tap a slot to swap; pending pickup completes correctly.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v476',
    title:     'Floor damage retune',
    summary:
      'Enemy HP scaling is unchanged; compound damage rates were pulled back so floor 100 hits land in a survivable band instead of one-shot territory.',
    items: [
      {
        tag:  'Balance',
        text: 'Floor damage — compound rates tuned to 4.8% / 2.4% (was 6% / 3%). A skeleton at floor 100 now hits for ~41 instead of ~95; HP stays at the doubled curve.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v475',
    title:     'Doubled floor enemy scaling',
    summary:
      'Enemy HP and compound damage rates are both doubled — deeper floors get significantly tougher, with HP keeping pace so fights stay meaningful.',
    items: [
      {
        tag:  'Balance',
        text: 'Floor scaling — damage compound rates 3%→6% (early) and 1.5%→3% (late); HP linear rates 10%→20% and 15%→30%. A skeleton at floor 50 is now 27 HP / 22 dmg (was 15 / 5).',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v474',
    title:     'Steeper floor damage scaling',
    summary:
      'Enemy damage now compounds per floor instead of growing linearly — early floors feel similar, but depth ramps up faster without going off the rails.',
    items: [
      {
        tag:  'Balance',
        text: 'Floor damage — enemy hit damage uses compound scaling (~3% per floor early, ~1.5% above floor 50) instead of flat +5%/+7.5% linear steps. A skeleton at floor 100 hits for ~11 instead of ~9.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v473',
    title:     'Backpack open fix',
    summary:
      'Opening the backpack no longer crashes after the gear-pickup replace flow was added — a variable ordering bug threw before the panel could render.',
    items: [
      {
        tag:  'Fix',
        text: 'Backpack — fixed a crash (Cannot access gearPickupMode before initialization) that blocked the backpack from opening at all.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v469',
    title:     'Biome tile art, floor names & grid variety',
    summary:
      'Every biome now has its own unrevealed tile backs, the HUD shows one consistent name per biome, and each floor rolls a random grid shape between 5×5 and 7×7. Trinket loot also gets a new Epic tier, tighter legendary drops, and a floor-10 gate on legendaries.',
    items: [
      {
        tag:  'Visual',
        text: 'Biome tile backs — jungle, frozen tundra, volcanic cavern, catacombs, corrupted forest, sunken temple, mushroom grotto, crystal cavern, shadow realm, and infernal pit each have custom unrevealed tile art with random variants per floor.',
      },
      {
        tag:  'Fix',
        text: 'Floor names — the HUD now shows one name per biome (e.g. all floors 6–10 read “Jungle Ruins”) instead of cycling through a different name every floor.',
      },
      {
        tag:  'New',
        text: 'Grid variety — each floor rolls its own width and height independently between 5 and 7 tiles (e.g. 5×7, 6×5, 7×7). Size is fixed for that floor for the rest of the run and survives save/resume.',
      },
      {
        tag:  'Balance',
        text: 'Epic trinkets — a new drop tier sits between Rare and Legendary. Eight trinkets were promoted to Epic; chests can roll Epic at low rates on normal and magic chests.',
      },
      {
        tag:  'Balance',
        text: 'Legendary trinkets — only drop from floor 10 onward. Normal and magic chest legendary rates were halved (0.5% / 1%).',
      },
      {
        tag:  'Balance',
        text: 'Smith\'s Tools — drop rate reduced to 0.5% on both chest types.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-30',
    version:   'v450',
    title:     'Travelling merchant, trade overhaul & inventory QoL',
    summary:
      'The travelling merchant now stocks scrap and no longer clutters the magic chest with potions. Trade swaps accept any backpack item, gear shows a stat comparison when swapped, and you can drop a whole potion stack at once. The How to Play screen gains a crafting recipe list, and the Scavenger\'s Bag stacks gold correctly.',
    items: [
      {
        tag:  'Balance',
        text: 'Magic chest — potions no longer appear as chest rewards. The chest pool now focuses on equipment, trinkets, and resources.',
      },
      {
        tag:  'New',
        text: 'Travelling merchant update — the merchant\'s stock has been refreshed with new items and adjusted pricing.',
      },
      {
        tag:  'UI',
        text: 'How to Play — a crafting recipe list has been added so you can look up forge combinations mid-run.',
      },
      {
        tag:  'Fix',
        text: 'Dropping potions — you can now drop an entire potion stack at once instead of one at a time.',
      },
      {
        tag:  'Fix',
        text: 'Trade swaps — any item in your backpack can now be offered in a trade swap, not just specific item types.',
      },
      {
        tag:  'UI',
        text: 'Gear compare on swap — when a trade or chest offers gear, a stat comparison modal shows how it differs from your equipped piece before you commit.',
      },
      {
        tag:  'New',
        text: 'Travelling merchant — now has a chance to stock scrap, giving crafters a reliable way to source forge materials.',
      },
      {
        tag:  'Fix',
        text: 'Scavenger\'s Bag — gold pickups now stack correctly in the bag instead of filling separate slots.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-29',
    version:   'v449',
    title:     'Safe Pocket, backpack fixes & forge polish',
    summary:
      'A protected trinket slot survives death and retreat, backpack stacking and full-bag swaps behave correctly, the sanctuary forge works with a full bag, and dropping common trinkets pays a little gold. Plus compare-modal polish, message-log tap-to-expand, and iPhone layout fixes.',
    items: [
      {
        tag:  'New',
        text: 'Safe Pocket — a fourth slot on the Equipment screen (tap your hero portrait). Equip one passive trinket here; it stays active all run and is kept when you die or retreat. Only gear in the three weapon/armor slots persists the same way.',
      },
      {
        tag:  'Fix',
        text: 'Backpack stacks — drop and use now target the stack you tapped, not the first matching item in the bag. Opening or closing the backpack also merges duplicate stackables (smaller stacks flow into larger ones) to free slots.',
      },
      {
        tag:  'Fix',
        text: 'Full backpack — swapping in a new trinket or gear piece when every slot is full no longer eats the item you meant to keep. Tap the slot you want to replace, or trash the pickup.',
      },
      {
        tag:  'Balance',
        text: 'Dropping a common passive trinket from the backpack grants 1 run gold. The Drop button and confirm prompt show the reward before you commit.',
      },
      {
        tag:  'Fix',
        text: 'Sanctuary Forge — you can forge with a full backpack when you have both ingredients. Forging consumes two items and adds one, so it always frees a slot; the Forge button no longer stays greyed out waiting for empty space.',
      },
      {
        tag:  'UI',
        text: 'Gear compare modal — headers use item icons and tier badges instead of plain text, with a blank tile when nothing is equipped on that side.',
      },
      {
        tag:  'Fix',
        text: 'Message log — tap the combat log again to expand and scroll history; tap outside to collapse.',
      },
      {
        tag:  'Fix',
        text: 'iPhone / PWA — Settings back button and headers respect the notch and Dynamic Island safe area.',
      },
      {
        tag:  'Systems',
        text: 'Corrupted save imports can now recover currencies, hero unlocks, and other progress when a full restore fails.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-26',
    version:   'v352',
    title:     'Hero equipment system, Slam starter unlock & UI polish',
    summary:
      'Heroes now carry gear in three dedicated slots, new players start with Slam already unlocked, and several HUD and How to Play improvements round out the update.',
    items: [
      {
        tag:  'New',
        text: 'Equipment system — tap your hero portrait to open the equipment screen. Three slots (Weapon, Breastplate, Offhand) accept gear found in chests and drops. A comparison modal shows stat changes before you commit to equipping an item.',
      },
      {
        tag:  'New',
        text: 'Slam unlocked by default for new Warriors — no XP spend required to get your first ability. Mastery branches still require XP as before.',
      },
      {
        tag:  'UI',
        text: 'Ability icons on the hero select screen now pulse-glow while there are upgrades still available to purchase. The glow stops once the ability is fully maxed.',
      },
      {
        tag:  'UI',
        text: 'Armor now displays alongside Attack Damage in a paired HUD row, matching the same socket style.',
      },
      {
        tag:  'UI',
        text: 'How to Play — new Equipment and Trinkets sections explain gear slots, stat comparisons, and passive trinket effects.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-12',
    version:   'v349',
    title:     'Block & Parry, hero combat canvas & mastery branches',
    summary:
      'Telegraphing enemies now trigger a real-time parry ring — tap to block or swipe to counter. Heroes animate in the ring arena, mastery trees branch into specialisations, and a new dowsing rod item reveals nearby traps.',
    items: [
      {
        tag:  'New',
        text: 'Block & Parry system — when a telegraphing enemy attacks, a shrinking rune ring appears. Tap while the ring is in the golden zone to Block (half damage, mana neutral) or swipe the indicated direction to Counter (no damage, +1 mana). Miss the zone and take amplified damage with a mana penalty.',
      },
      {
        tag:  'New',
        text: 'Hero combat canvas — your hero\'s attack GIF plays frame-locked to the parry ring as it shrinks, so timing feels connected to the action.',
      },
      {
        tag:  'New',
        text: 'Parry tutorial — first-time players walk through an interactive onboarding that teaches blocking then countering, with practice rounds that must be completed before moving on.',
      },
      {
        tag:  'New',
        text: 'Branching mastery trees — Slam now splits into Hemorrhage, Seismic, and Reverberation branches at the first mastery tier. Engineer, Mage, Necromancer, and Vampire each gain new ability branches with tiered upgrades.',
      },
      {
        tag:  'New',
        text: 'Dowsing Rod item — reveals the category of nearby hidden trap tiles when picked up.',
      },
      {
        tag:  'UI',
        text: 'Full-screen colour flash and screen-shake on parry results; "Blocked / Countered / Missed" text floats up from the ring arena in colour-coded styles.',
      },
    ],
  },
  {
    dateLabel: 'May 2026',
    dateIso:   '2026-05-02',
    version:   'v331',
    title:     'Floor modifiers, gold vault & difficulty stakes',
    summary:
      'Each floor can now carry a curse or boon that changes how you play it, gold banking moves to the sanctuary vault rope, and death now costs you a chunk of your XP depending on difficulty.',
    items: [
      {
        tag:  'New',
        text: 'Floor modifiers — starting from floor 6 a random curse or boon applies for the whole floor (Cursed Fog, Bloodmoon, Mana Spring, The Hunt, Silence, and more). A modal explains the effect when the floor loads.',
      },
      {
        tag:  'New',
        text: 'Gold Vault — the sanctuary rope is now a banking station. After each boss you choose to bank 50%, 75%, or 100% of your current gold as safe gold. Banked gold is kept on death; unbanked gold is lost.',
      },
      {
        tag:  'Balance',
        text: 'XP on death now depends on difficulty: Easy keeps 100%, Normal keeps 50%, Hard keeps 10%.',
      },
      {
        tag:  'Balance',
        text: 'Campfire tiles still restore HP and mana but no longer auto-bank your gold.',
      },
      {
        tag:  'Fix',
        text: 'Trinket info cards now require a confirmation tap before dropping, preventing accidental losses.',
      },
      {
        tag:  'Balance',
        text: 'Mirror of Vanity HP bonus reduced from 20% to 5% of current HP — it was too strong.',
      },
    ],
  },
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
