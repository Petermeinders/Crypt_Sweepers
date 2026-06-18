# Crypt Sweepers — Feature Highlights (Latest Updates Panel Source)

> Curated from git history and changelog.js. High-level features only — minor balance tweaks, bug fixes, and small UI polish omitted. Ordered for storytelling (onboarding → depth → endgame).

---

## Panel 1 — Seven Heroes, Seven Playstyles
**Concept:** Every hero brings a fundamentally different way to play — not just stat swaps.
- **Paladin** (starter) — Kill Echo pulses mark nearby enemies; aggressive pathfinding rewarded
- **Ranger** — Arrow Barrage, Poison Arrow, Triple Volley; kiting and trap synergy
- **Mage** — Chain Lightning, Telekinetic Throw, Blinding Light; mana economy mastery
- **Engineer** — Deploy turrets (Ballistic/Tesla), level them mid-run; Seismic Ping reveals nearby tiles
- **Vampire** — Dark Eyes, lifesteal, low max-HP risk/reward sustain kit
- **Necromancer** — Raise Minion army, Corpse Explosion, Bone Armor; full undead horde fantasy
- **Ninja** (newest) — Shadowstrike, Smoke Bomb, Shuriken; Shadow Step passives manipulate the parry window
**Assets:** All hero idle GIFs / portrait PNGs

---

## Panel 2 — Block & Parry
**Concept:** When a telegraphing enemy attacks, a real-time rune ring appears — your timing determines what happens.
- Tap in the golden zone → **Block** (half damage, mana neutral)
- Swipe the indicated direction → **Counter** (no damage, +1 mana)
- Miss → amplified damage + mana penalty
- Hero combat GIF plays frame-locked to the shrinking ring for visceral timing feedback
- Full-screen colour flash and screen-shake on results
- Interactive onboarding tutorial walks new players through blocking then countering
**Assets:** rune-ring.png, rune-ring2.png, warrior-strike.gif

---

## Panel 3 — Branching Mastery Trees
**Concept:** Every hero ability branches into exclusive specialisation paths — you commit to a build, not a checklist.
- Slam splits into Hemorrhage / Seismic / Reverberation branches
- Corpse Explosion picks one of Abyssal Reach / Detonation Chain / Essence Drain per run
- Raise Minion forks into Undying Legion (swarm) vs. Gargantuan (single colossus)
- Engineer, Mage, Necromancer, Vampire each have tiered mastery branches with in-run pick gates
- Abilities enter the level-up pool — you earn them, not just unlock them
**Assets:** ability badge PNGs (slam.png, bone-armor.png, corpse-explosion.png, raise-minion.png)

---

## Panel 4 — The Necromancer's Army
**Concept:** Full undead-horde fantasy with deep build variety and late-game scaling.
- **Raise Minion** — tap enemy corpses; minion HP/damage scale with your max HP and melee
- **Undying Legion** — grow a swarm; III adds combined army damage to your own melee
- **Gargantuan** — fuse floor corpses into a single colossus; grows with Mass Ascension casts
- **Strengthen Minion** — buff any minion's HP; Mastery II adds melee; Mastery III draws from horde total damage
- **Bone Armor** — consume a corpse for a temporary armor layer; expertise tiers add HP recovery and mana return
- **Corpse Explosion** — area blast scaled to melee; choose reach, chain, or drain mastery
**Assets:** raise-minion.png, strengthen-minion.png, corpse-explosion.png, bone-armor.png, necromancer-hero-idle.gif

---

## Panel 5 — Gear, Equipment & the Blacksmith
**Concept:** A full item progression loop that persists across floor transitions.
- Three gear slots: **Weapon** (damage), **Breastplate** (HP), **Offhand** (Negation %)
- **Safe Pocket** — a fourth trinket slot that survives death and retreat
- Stat comparison modal before committing to any gear swap
- **Blacksmith** — spend Gold + Scrap to upgrade gear stats +25%, disassemble for scrap, reduce detriments
- Floor-scaled gear: a floor-80 common often beats a floor-15 epic on raw stats
- Gear tiers overlap: Rare/Epic/Legendary stat bands intentionally cross so depth beats rarity
- **Forge** — combine two items into a crafted result (sanctuary); recipe list in How to Play
**Assets:** armor.png, axe.png, helmet.png, gear-card-frame.png, blacksmith-banner.png

---

## Panel 6 — Floor Modifiers
**Concept:** Every floor from 6 onward can carry a curse or boon that forces tactical adaptation.
- **Cursed Fog** — reduced visibility
- **Bloodmoon** — enemies hit harder; combat is riskier
- **Mana Spring** — mana regeneration bonus
- **The Hunt** — enemies are aggressive or fast
- **Silence** — abilities restricted
- A brief modal explains the floor modifier when the level loads
- Pushes players to adapt builds mid-run rather than following a fixed script
**Assets:** skull.png, relevant tile art

---

## Panel 7 — Ten Biomes
**Concept:** Every 5 floors the world changes — new enemies, unique tile art, backdrop, and music.
1. Dungeon / 2. Jungle Ruins / 3. Frozen Tundra / 4. Volcanic Cavern / 5. Catacombs
6. Corrupted Forest / 7. Sunken Temple / 8. Mushroom Grotto / 9. Crystal Cavern / 10. Shadow Realm / Infernal Pit
- Each biome has custom unrevealed tile backs with random variants per floor
- Backdrop art and music crossfade at each biome boundary
- Each floor rolls its own grid width and height independently (5–7 tiles per axis, e.g. 5×7, 6×5, 7×7)
**Assets:** per-biome tile back PNGs (jungle-tile-back-1.png, frozen-tile-back-1.png, volcanic-tile-back-1.png, etc.)

---

## Panel 8 — Sub-Floors & Special Encounters
**Concept:** Hidden side chambers and mid-floor surprises break up the main grid.
- **Sub-floor entries** — vaults, shrines, ambushes, tunnels; each a self-contained grid
- **War Banner** — enemy floor buff; tear it down before fights snowball
- **Treasure Goblin** — appears revealed with a turn timer; chase it for rare loot or it escapes
- **Event Tiles** — Travelling Merchant, Story Events, Triple Chest, Trinket Trader encounters
- **Deadlock Escape** — if no reachable tiles remain, an adjacent pit pulses amber; tap to climb through
**Assets:** subfloor-entry.png, event-merchant.png, event-story.png, event-triple-chest.png, chest.gif

---

## Panel 9 — Travelling Merchant, Casino & Crafting
**Concept:** Between-floor commerce gives runs a persistent economy to play around.
- **Travelling Merchant** (sanctuary) — stocks potions, scrap, gear, and Mystery Relics (Rare/Epic/Legendary weighted rolls)
- **Casino / Gambler Event** — physics dice roll; win big or bust
- **Blacksmith** — upgrade gear stats, disassemble for scrap, reduce detriments
- **Forge** — combine two backpack items into one crafted result; recipes in How to Play
- Magic chests focus on equipment and trinkets (potions removed from pool)
**Assets:** blacksmith-banner.png, event-merchant.png, bone-dice.png, hammer.png, magic-chest-open.gif

---

## Panel 10 — Banking & Difficulty Stakes
**Concept:** Gold is at risk — how much you protect defines your risk tolerance.
- **Gold Vault** (sanctuary rope) — after each boss, bank 50%, 75%, or 100% of current gold as safe gold; unbanked gold is lost on death
- **Hasty Retreat** — exit early via the rope and keep 20% of gold instead of losing everything
- Death XP penalty scales with difficulty: Easy keeps 100% XP / Normal keeps 50% / Hard keeps 10%
- Difficulty adds real stakes without blocking progression
**Assets:** coin.png, save-seal.png, skull.png

---

## Panel 11 — The Void (Endgame)
**Concept:** Beating floor 100 is the beginning of a harder challenge, not the end.
- Completing floor 100 for the first time awards **Void Pearls** and unlocks The Void on the main menu
- **Void Trials** — three tiers (Achan Passage / Hallow Threshold / Unmaking Void) with enemy stat multipliers (+50% / +100% / +150% HP/DMG) and guaranteed Legendary gear rewards
- Six void-exclusive enemies with unique mechanics: Void Maw, Void Ghast, Hook Crawler, Shard Ravager, Void Behemoth, Rift Lich
- Purple cobblestone tile backs and void backdrop atmosphere
- Every tier finale spawns the **Void Overseer** — a unique tentacled boss
**Assets:** btn-void.png, void-tile-back-1.png, void-overseer.png, void-maw.png, rift-lich.png

---

## Panel 12 — Ninja Hero
**Concept:** The seventh hero is built around timing, stealth, and exploiting the parry system.
- **Shadowstrike** — surprise strike from stealth
- **Smoke Bomb** — disengage and reposition
- **Shuriken** — ranged throw
- **Shadow Step I/II** passives — use stealth to suppress enemy tile locks
- Ranger-sense detects tile categories (enemy/loot); Ninja's stealth suppresses enemy locks
- Unlock for 600 gold
**Assets:** Ninja portrait (characters/thessaly-reed.png or tomas-kade.png), dagger.png

---

## Panel 13 — Combat Flee
**Concept:** When a fight goes wrong, you now have an escape hatch — but it costs you.
- During an active fight, tap 🏃 Flee in the action panel
- Costs 10% max HP (minimum 1)
- Enemy survives; adjacent tiles remain locked until it is slain
- Enables tactical retreating and multi-enemy juggling across the grid
**Assets:** skull.png, relevant combat UI

---

## Panel 14 — Trinkets, Codex & Bestiary
**Concept:** A collectible meta-layer that rewards exploration and knowledge.
- **Epic Trinket tier** — new rarity between Rare and Legendary; eight trinkets promoted at launch
- **Safe Pocket** — equip one passive trinket that persists across death and retreat
- **Bestiary** — log every enemy type encountered; read their full stats and mechanics
- **Trinket Codex** — track discovered trinkets with full effect descriptions
- Trinket drop from common backpack items pays a little gold
**Assets:** lucky-rabbit-foot.png, glass-cannon-shard.png, deathmask.png, abyssal-lens.png

---

## Panel 15 — The HUD & Quality of Life
**Concept:** The heads-up display now gives you everything at a glance.
- **Animated orb system** — HP (red) and Mana (blue) orbs display current/max values with animated GIF fill
- **Tap an orb** → uses the matching potion directly, no backpack required
- **In-run Settings button** — change sound/options without quitting
- **Message log** — tap combat log to expand and scroll full history
- **Auto-updates** — game checks for new versions and updates without manual cache-clearing
- **Hold-to-inspect** ability buttons show full description banners
**Assets:** htp-hud.png, hud-diagram.png, assets/sprites/hud/

---

*End of FeaturesList.md — 15 panels, combined where concepts overlap. Ordered from core (heroes, combat) → build depth (masteries, gear) → world (biomes, events) → economy (merchant, banking) → endgame (Void) → new arrivals (Ninja, Flee) → meta (trinkets, HUD).*
