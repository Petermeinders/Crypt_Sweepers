# Cryptic Grids - Development Epics

## Epic Overview

| # | Epic Name | Dependencies | Est. Stories |
|---|-----------|--------------|--------------|
| 1 | Foundation & Core Loop | None | 6-8 |
| 2 | Combat System | Epic 1 | 6-8 |
| 3 | Run Economy | Epic 2 | 5-7 |
| 4 | Meta Progression & Save | Epic 3 | 6-8 |
| 5 | Content — Enemies & Tiles | Epic 2 | 6-8 |
| 6 | Ranger & Second Character | Epic 4 | 4-6 |
| 7 | Difficulty & Polish | Epic 5 | 5-7 |
| 8 | Art & Audio Pass | Epic 7 | 5-7 |
| 9 | PWA & Launch | Epic 8 | 4-6 |

---

## Epic 1: Foundation & Core Loop

### Goal
Establish the playable skeleton — a generated grid the player can tap through with
tile reveals, basic HUD, and floor progression.

### Scope

**Includes:**
- 5x5 procedural grid generation with weighted tile placement
- CSS 3D tile flip animation on reveal
- Tile types: empty, gold (visual only), exit
- HUD: HP bar, mana bar, gold counter
- Floor advance on exit tile reveal
- Basic game state (new game, floor number)
- CONFIG object for all tunable values

**Excludes:**
- Combat, spells, enemies
- XP, level-up, abilities
- Persistence/save
- All tile types beyond empty, gold, exit

### Dependencies
None — this is the foundation.

### Deliverable
A tappable 5x5 grid that generates, reveals tiles with CSS flip animations, shows
a basic HUD, and advances to a new floor on exit. Not yet winnable or loseable.

### Stories
- As a player, I can see a 5x5 grid of face-down tiles so that I have a dungeon to explore
- As a player, I can tap a tile to flip it with a CSS 3D animation so that revealing tiles feels satisfying
- As a player, I can see my HP, mana, and gold in a HUD so that I know my current status
- As a player, I can reveal an exit tile to advance to the next floor so that runs have progression
- As a developer, all game values are in a CONFIG object so that balancing is easy
- As a player, each floor generates a fresh grid so that no two floors feel identical

---

## Epic 2: Combat System

### Goal
Full tap-to-fight combat loop with enemy lock zones, mana pool spell system, flee,
and death state.

### Scope

**Includes:**
- Enemy tile type with visible HP and DMG stats
- Adjacent tile locking on enemy reveal
- Tap revealed enemy to initiate combat
- Combat flow: enemy attacks first, player responds
- Player actions: Fight, Cast Spell, Flee
- Mana cost per spell, mana depletion
- Flee: costs HP, enemy remains, tiles stay locked
- Enemy death: tiles unlock, gold awarded
- Player death: HP reaches 0, run ends
- Action panel UI (Spell + Flee buttons)
- Float text for damage/events
- Screen shake on hit

**Excludes:**
- Multiple enemy types (one placeholder enemy)
- Spell variety (one placeholder spell)
- XP from combat
- Persistence

### Dependencies
Epic 1

### Deliverable
A complete combat encounter — reveal enemy, fight or flee, win or die. The core
risk/reward tension of the game is functional.

### Stories
- As a player, I can reveal an enemy tile that shows HP and DMG so that I can assess the threat
- As a player, revealed enemy tiles lock adjacent tiles so that I must engage or leave them
- As a player, I can tap a revealed enemy to initiate combat so that fighting is a deliberate choice
- As a player, the enemy attacks first each round so that combat feels dangerous
- As a player, I can choose to fight back, cast a spell, or flee so that combat has meaningful decisions
- As a player, casting a spell costs mana so that spell use requires resource management
- As a player, fleeing costs HP and leaves the enemy active so that avoidance has consequences
- As a player, when my HP reaches 0 I see a death state so that runs have a clear end
- As a player, I see float text for damage and events so that feedback is immediate and clear

---

## Epic 3: Run Economy

### Goal
Complete the run loop — XP, level-up with ability choices, gold economy, checkpoint
banking, and Hasty Retreat.

### Scope

**Includes:**
- XP awarded on every tile reveal
- XP threshold triggers level-up
- Level-up ability choice UI (2-3 options, Warrior-specific)
- Warrior starter ability tree (full MVP set)
- Gold awarded from enemy kills and gold tiles
- Chest tile type (gold + possible item placeholder)
- Checkpoint tile: banks 100% current gold, restores partial HP/mana
- Hasty Retreat button: banks 20% run gold, ends run
- Run summary screen (tiles revealed, gold banked, floor reached, cause of end)
- "Try Again" one-tap restart

**Excludes:**
- Persistent gold/XP (resets each run — meta-progression is Epic 4)
- Items beyond placeholder
- Multiple characters

### Dependencies
Epic 2

### Deliverable
A fully playable run with a reason to fight (gold/XP), meaningful level-up decisions,
and the Hasty Retreat tension. The vertical slice is complete.

### Stories
- As a player, I earn XP for every tile I reveal so that exploration is always rewarded
- As a player, reaching an XP threshold triggers a level-up with ability choices so that runs feel build-defining
- As a player, I earn gold from enemies and gold tiles so that fighting has an economic reward
- As a player, I can reach a checkpoint to bank my loot and restore resources so that risk management is meaningful
- As a player, I can trigger a Hasty Retreat to bank 20% of my gold so that escaping is a legitimate strategy
- As a player, I see a run summary on death or retreat so that I understand what I achieved
- As a player, I can restart with one tap so that the "just one more run" loop is frictionless

---

## Epic 4: Meta Progression & Save

### Goal
Persistent progress between runs — IndexedDB save, character XP trees, main screen
upgrade shop, and export/import save for player data safety.

### Scope

**Includes:**
- IndexedDB as primary storage layer (replaces any prototype localStorage)
- Save/load: banked gold, character XP, purchased upgrades, settings
- Main screen: character select, upgrade shop, difficulty select
- Warrior character XP tree (permanent stat upgrades, new ability unlocks)
- Gold shop: one-time run boosts (starting HP, starting gold, etc.)
- Export save: download JSON save file to device
- Import save: restore from JSON save file
- Auto-save after every run end and checkpoint

**Excludes:**
- Ranger character (Epic 6)
- Cloud sync (post-MVP)
- Full item unlock system (post-MVP)

### Dependencies
Epic 3

### Deliverable
Full meta-loop: bank gold, spend on upgrades, grow the Warrior's permanent power,
export save for safety. The game is now genuinely replayable with persistent stakes.

### Stories
- As a player, my banked gold and character XP persist between runs so that progress is never lost
- As a player, I can spend gold and XP to unlock permanent Warrior upgrades so that each run makes me stronger
- As a player, I can buy one-time run boosts from the main screen shop so that I can tailor my run start
- As a player, I can export my save as a JSON file so that I can back up my progress
- As a player, I can import a save file to restore my progress so that switching devices doesn't mean starting over
- As a player, the game auto-saves after every run end and checkpoint so that I never lose progress unexpectedly
- As a developer, all save data uses IndexedDB so that storage is robust against browser purges

---

## Epic 5: Content — Enemies & Tiles

### Goal
Full enemy roster and complete tile set for MVP — all tile types functional with
unique behaviours.

### Scope

**Includes:**
- 4-6 distinct enemy types with unique stats and behaviours (including undead type for Warrior bonus)
- Fast enemy (attacks twice per round)
- Boss enemy (boss floor tile, elite combat, high reward)
- All tile types: trap, healing shrine, NPC (Goblin Merchant with dice-roll outcomes)
- Goblin Merchant: dice-roll trade UI, outcome resolution
- Trap: instant damage, no combat
- Healing shrine: HP (and optionally mana) restore

**Excludes:**
- Illustrated art (Epic 8)
- New character (Epic 6)

### Dependencies
Epic 2 (combat system must exist for enemy behaviours)

### Deliverable
A fully populated dungeon — every tile type is functional, enemies have distinct
identities, and the Goblin Merchant adds memorable NPC moments.

### Stories
- As a player, I encounter multiple enemy types with distinct stats so that combat variety keeps runs interesting
- As a player, fast enemies attack twice per round so that I must prioritise them differently
- As a player, undead enemies take double damage from the Warrior so that character choice has tactical implications
- As a player, I can encounter a boss tile on every 10th floor so that depth milestones feel climactic
- As a player, stepping on a trap deals instant damage so that unrevealed tiles always carry risk
- As a player, I can use a healing shrine to restore HP so that resource recovery is a meaningful find
- As a player, I can trade with the Goblin Merchant via a dice-roll so that NPC encounters are memorable and risky

---

## Epic 6: Ranger & Second Character

### Goal
Unlock the Ranger as a second playable character with unique stats, ability tree,
and silent-reveal mechanic.

### Scope

**Includes:**
- Ranger character data: base stats (HP, DMG, mana — TBD balance)
- Ranger unlock via gold spend on character screen
- Ranger unique mechanic: enemy reveals do not lock adjacent tiles
- Ranger ability tree (MVP set)
- Character select screen updated with Ranger
- Ranger XP progression tracked separately from Warrior

**Excludes:**
- Additional characters (post-MVP)

### Dependencies
Epic 4 (character unlock system must exist)

### Deliverable
Two meaningfully different characters — the Warrior plays as a brawler managing
lock zones; the Ranger plays as a navigator who avoids spatial pressure but has
different resource trade-offs.

### Stories
- As a player, I can unlock the Ranger by spending gold so that character variety is a meta goal
- As a player, the Ranger's enemy reveals don't lock adjacent tiles so that their playstyle is fundamentally different
- As a player, the Ranger has distinct base stats so that character choice affects run feel from the start
- As a player, I can level up the Ranger's separate ability tree so that mastering each character is a distinct journey
- As a player, Ranger XP is tracked separately so that I'm incentivised to play both characters

---

## Epic 7: Difficulty & Polish

### Goal
Easy/Normal/Hard difficulty tiers, floor scaling, boss floors, run summary polish,
and general gameplay feel improvements.

### Scope

**Includes:**
- Difficulty select at run start (Easy/Normal/Hard) with trade-off table applied
- Floor grid scaling: 6x6 at floor 7, 7x7 at floor 10+
- Boss floor cadence: every 10th floor
- Enemy stat scaling formula per floor depth
- Death screen polish: run summary with stats
- Tile distribution tuning per floor depth
- General feel pass: animation timing, feedback tuning

**Excludes:**
- Stacking run modifiers (post-MVP)
- Challenge runs (post-MVP)

### Dependencies
Epic 5

### Deliverable
A tuned, balanced game across three difficulty tiers with meaningful floor
escalation and boss moments.

### Stories
- As a player, I can select Easy/Normal/Hard before a run so that the challenge suits my preference
- As a player, Easy gives reduced difficulty but lower rewards so that it doesn't trivialise progression
- As a player, Hard gives increased difficulty but higher rewards so that skilled play is recognised
- As a player, the grid expands on deeper floors so that spatial complexity increases with depth
- As a player, every 10th floor has a boss encounter so that depth milestones feel earned
- As a player, enemy stats scale with floor depth so that the dungeon always feels threatening

---

## Epic 8: Art & Audio Pass

### Goal
Replace placeholder CSS/emoji visuals with illustrated tile art, enemy portraits,
and add full audio (ambient music + SFX).

### Scope

**Includes:**
- Illustrated tile front faces (~11 sprites, WebP)
- Enemy portrait sprites (4-6, WebP)
- Unrevealed tile back face texture
- Character portraits for select screen (Warrior + Ranger)
- Dungeon ambient music loop (Stone Dungeon theme)
- Boss floor music track
- Full SFX set: tile flip, hit, spell, gold, level-up, death, checkpoint, retreat
- Audio context activation on first touch (iOS)
- Sprite atlas for performance

**Excludes:**
- UI illustration (CSS remains for MVP)
- Additional dungeon themes (post-MVP)

### Dependencies
Epic 7 (mechanics stable before art pass)

### Deliverable
The game looks and sounds like Cryptic Grids — cartoonish illustrated dungeon
aesthetic with full audio feedback.

### Stories
- As a player, each tile type has a distinct illustrated sprite so that the dungeon feels alive
- As a player, enemies have portrait art so that combat encounters have personality
- As a player, I hear a satisfying sound on every tile reveal so that exploration has audio feedback
- As a player, combat hits, spells, and death all have distinct sounds so that every action feels impactful
- As a player, ambient dungeon music loops during play so that the atmosphere is immersive
- As a player, the boss floor has a distinct music track so that the encounter feels climactic

---

## Epic 9: PWA & Launch

### Goal
Harden the PWA, pass performance targets, and deploy to a shareable URL.

### Scope

**Includes:**
- Service worker: offline caching of all assets
- Web manifest: name, icons, theme colour, portrait orientation lock
- Performance pass: 60fps validation on iPhone 12, load time under 3s
- Bundle size audit: under 5MB total
- iOS "Add to Home Screen" nudge (subtle in-game prompt)
- Cross-browser testing: Chrome, Safari, Firefox, Edge
- Deploy to static host (GitHub Pages, Netlify, or Vercel)
- Final IndexedDB save validation across browsers

**Excludes:**
- App store submission (post-MVP)
- Analytics (post-MVP)
- Cloud sync (post-MVP)

### Dependencies
Epic 8

### Deliverable
Cryptic Grids is live at a shareable URL, installable as a PWA, playable offline,
and performing at target on mobile.

### Stories
- As a player, the game works offline after first load so that I can play anywhere
- As a player, I can install Cryptic Grids to my home screen so that it feels like a native app
- As a player, the game loads in under 3 seconds on a decent connection so that first impressions are good
- As a player, the game runs at 60fps on my mid-range mobile so that animations feel smooth
- As a developer, the game is deployed to a public URL so that it can be shared with anyone
