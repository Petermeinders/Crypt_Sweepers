---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
inputDocuments:
  - '_bmad-output/game-brief.md'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
workflowType: 'gdd'
lastStep: 0
project_name: 'Game2'
user_name: 'Peter'
date: '2026-03-30'
game_type: 'roguelike'
game_name: 'Cryptic Grids'
---

# Cryptic Grids - Game Design Document

**Author:** Peter
**Game Type:** Roguelike Dungeon Crawler
**Target Platform(s):** PWA (Mobile Web, Portrait) — Desktop browser secondary (fixed portrait column)

---

## Executive Summary

### Core Concept

Cryptic Grids is a minesweeper-meets-dungeon-crawler where every tap could reveal treasure or death. Players explore a procedurally generated 5x5 grid dungeon, tapping hidden tiles to reveal enemies, loot, traps, NPCs, and exits. Combat is turn-based with full player agency — tap an enemy to engage, use mana-powered spells, or flee to fight another day. The further you delve without hitting a checkpoint, the greater the risk — and reward.

Every run ends in death, escape, or a Hasty Retreat (banking 20% of loot). Gold earned funds permanent meta-upgrades between runs. XP earned from tile reveals triggers mid-run level-ups with character-specific ability choices that define each run's playstyle.

Cryptic Grids is built for mobile-first 5-10 minute sessions, designed around the "just one more run" loop — always something to unlock, always a build to try, always a deeper floor waiting.

### Game Type

**Type:** Roguelike Dungeon Crawler
**Framework:** This GDD uses the roguelike template with type-specific sections for: Run Structure, Procedural Generation, Permadeath & Progression, Item & Upgrade System, Character Selection, and Difficulty Modifiers.

### Target Audience

Mobile-first casual-to-core gamers aged 8+. Players who enjoy build optimisation, the satisfaction of unlocking new options, and risk/reward decisions. Portrait touch, 5-10 minute sessions.

### Unique Selling Points (USPs)

1. Mana-based spell system (no cooldowns — full resource control)
2. Delve-or-Retreat tension with Hasty Retreat mechanic
3. Risky NPC Encounter tiles (Goblin Merchant dice rolls)
4. Single adaptive dungeon — no world map, evolves with player
5. Interaction fidelity first — tap enemy to fight, instant response, smooth CSS 3D tile flips

---

## Target Platform(s)

### Primary Platform

**PWA — Mobile Web (Portrait)**
- Delivered as a Progressive Web App via browser
- Installable to home screen on iOS and Android
- No app store required — shareable via URL
- Offline play via service worker
- Portrait orientation locked — no landscape support in v1

### Platform Considerations

- **iOS Safari:** Audio context requires first-touch activation. Implement on first user interaction. Test early.
- **Android Chrome:** Primary test target alongside iOS Safari.
- **PWA install:** Android shows native install prompt. iOS requires manual "Add to Home Screen" — no prompt available.
- **Performance:** Must maintain 60fps CSS animations on mid-range modern mobile (iPhone 12 / mid-range Android equiv.)
- **Storage:** localStorage for all save state. No backend, no accounts, no cloud sync in v1.

### Secondary Platform

**Desktop Browser (Same Codebase)**
- Fixed portrait column centred on screen (max-width: 480px)
- No responsive scaling or widescreen layout in v1
- Mouse click replaces touch tap — no other control changes
- Players can enjoy it on desktop but it is not the design focus

### Control Scheme

**Primary (Mobile):** Single-hand hold, one finger tap.
- Tap hidden tile → reveal
- Tap revealed enemy → initiate combat
- Tap Spell / Flee buttons → combat actions
- Tap Hasty Retreat button → exit run with 20% loot
- No drag, no swipe, no virtual joystick required

**Secondary (Desktop):** Left mouse click replaces all taps. Identical interaction model.

---

## Target Audience

### Demographics

- **Age:** 8+ (simple to learn, deep enough for adults)
- **Platform:** Mobile-first, casual to core gamers
- **Geography:** No regional targeting — English language v1

### Gaming Experience

Casual to intermediate — players who enjoy mobile games with meaningful decisions. Does not require prior roguelike knowledge. The first character and dungeon teach mechanics through play, not tutorials.

### Genre Familiarity

Genre-curious players welcome. Veterans of Dungelot, Slay the Spire, or Slice & Dice will recognise the roguelike loop immediately. Minesweeper players will find the grid reveal intuitive. Neither is required.

### Session Length

5-10 minutes per run. Designed for commutes, breaks, and couch sessions. State is always saved — the game can be backgrounded and resumed without loss.

### Player Motivations

- Build optimisation — finding what character/ability combinations work best
- Unlock progression — always something just out of reach
- Risk/reward decisions — how deep is too deep?
- "Just one more run" — low friction to start again

---

## Goals and Context

### Project Goals

1. **Ship something to be proud of** — The primary measure of success is personal satisfaction. A complete, polished MVP that Peter enjoys playing and is not embarrassed to share.

2. **Validate DOM+CSS as a viable game stack** — Prove that a genuinely fun, responsive, mobile-first game can be built without a game engine or heavy framework. The prototype already validates the approach; the full game confirms it.

3. **Build a reusable architecture** — Code and structure that supports future content expansion (new characters, dungeons, enemies, items) without rewrites. Every system is built to be extended, not replaced.

4. **Deliver interaction fidelity** — Every tap responds instantly. Animations run at 60fps. The game feels native, not web. This is a non-negotiable quality bar.

### Background and Rationale

Cryptic Grids exists because Dungelot — the closest game to this concept — hasn't aged well. The grid-reveal dungeon mechanic is fundamentally satisfying but the execution feels dated: clunky UI, cooldown-based abilities, and limited build decisions. Meanwhile the mobile web PWA space for this genre is essentially empty.

This is a passion project built by a solo developer who plays the games he's trying to make. The design decisions come from genuine frustration with what's missing in the genre and real affection for what makes it work.

---

## Unique Selling Points (USPs)

1. **Mana Pool, Not Cooldowns**
   Every spell draws from a shared mana pool. Players decide whether to burst all resources at once or ration carefully. This single change makes combat feel like resource chess rather than waiting for timers.

2. **Delve-or-Retreat Tension**
   The Hasty Retreat mechanic makes every unrevealed tile a risk/reward decision. Banking 20% of loot and escaping is a legitimate strategy — not just failure. No other grid-reveal dungeon game frames this tension so explicitly.

3. **Risky NPC Encounter Tiles**
   The Goblin Merchant and similar NPCs offer tempting deals with dice-roll outcomes. Players can ignore them, engage safely, or gamble for bigger rewards. These moments are rare, memorable, and shareable.

4. **One Adaptive Dungeon**
   No world map. No dungeon select screen. One dungeon that generates differently every run based on difficulty, unlocks, and progression depth. The dungeon grows with the player.

5. **Tap-to-Fight Combat**
   No Fight button. Tapping the revealed enemy tile IS the fight action. The enemy is the button. This keeps the UI minimal and the interaction model intuitive for any age.

### Competitive Positioning

Cryptic Grids sits between Dungelot (too simple, dated) and Slay the Spire (too complex, long sessions). It targets the gap: a modern, mobile-native dungeon crawler with meaningful decisions, genuine risk/reward tension, and sessions that respect the player's time. Free, no install, shareable URL.

---

## Core Gameplay

### Game Pillars

1. **Meaningful Decisions & Satisfying Feedback** *(co-equal, highest priority)*
   Every tap, upgrade choice, and run modifier carries a real tradeoff — and every action must feel good to execute. A decision that feels dead to make isn't meaningful regardless of strategic depth. Feedback IS the perception of meaning.

2. **Rewarding Progression**
   There is always something just out of reach: an upgrade, an unlock, a deeper floor. Players always leave a session with something gained, even on a bad run.

3. **Accessible Depth**
   Simple enough to learn at age 8+ through a straightforward starter character and dungeon. Complexity scales naturally through new characters, floors, and enemies — players teach themselves by playing, not by reading tooltips.

**Pillar Priority:** When pillars conflict, prioritize:
Meaningful Decisions & Satisfying Feedback → Rewarding Progression → Accessible Depth

### Core Gameplay Loop

**Micro Loop (one tile, ~5 seconds):**
Tap hidden tile → CSS flip reveals content → Resolve effect (loot/combat/trap/NPC) → Choose next action

**Combat Loop (~30 seconds):**
Reveal enemy tile → Decide to engage or skip → Tap enemy to fight (enemy attacks first, player responds) → Choose: fight again / cast spell / flee → Enemy slain or player retreats

**Run Loop (5-10 minutes):**
Select character → Enter dungeon → Reveal tiles / fight enemies / collect loot → Level up and choose abilities → Reach checkpoint OR attempt Hasty Retreat OR die → Bank gold → Spend on permanent upgrades → Start new run

**Meta Loop (across sessions):**
Unlock new characters / items / abilities → Experiment with new builds → Push deeper → Unlock next tier of content

```
Tap tile ──► Reveal content
    │              │
    │         ┌────▼─────┐
    │         │ Resolve  │
    │         │ effect   │
    │         └────┬─────┘
    │              │
    │    ┌─────────▼──────────┐
    │    │  Combat / Loot /   │
    │    │  NPC / Trap / Empty│
    │    └─────────┬──────────┘
    │              │
    ▼◄─────────────┘
Choose next tile
    │
    ▼
Checkpoint? ──► Bank loot ──► Continue or exit
    │
    ▼
All tiles revealed / HP = 0 / Hasty Retreat
    │
    ▼
Run ends ──► Spend gold ──► New run
```

**Loop Timing:** Micro loop ~5s | Combat ~30s | Full run 5-10min

**Loop Variation:** Character ability trees, procedural tile placement, run modifier settings, and NPC dice outcomes ensure no two runs feel identical.

### Win/Loss Conditions

#### Victory Conditions

- **Run Win:** Reach the exit tile on the current floor
- **Extraction Win:** Execute Hasty Retreat before dying (bank 20% of run loot)
- **Checkpoint Win:** Reach a checkpoint tile (bank 100% of loot collected so far, restore some HP/mana)
- **Meta Win:** Unlock all characters / reach max dungeon depth (long-term, post-MVP)

#### Failure Conditions

- **Run Loss (Permadeath):** HP reaches 0. All gold and items collected during the run are lost.
- **Soft Failure:** Fleeing combat costs HP. Running low on mana limits spell options. Poor tile choices drain resources.

#### Failure Recovery

Death is fast and low-friction. Run summary shows tiles revealed, gold lost, level reached. Permanent meta-upgrades carry over — the player is always stronger than last time. "Try Again" is one tap away. Death teaches: enemy patterns, when to retreat, which abilities to prioritise.

---

## Game Mechanics

### Primary Mechanics

#### 1. Tap-to-Reveal (Grid Exploration)
- **When:** Constantly — the core action of every run
- **What it tests:** Risk assessment, spatial reasoning, resource awareness
- **How it feels:** Snappy, instant — CSS 3D flip reveals tile content in ~300ms
- **Progression:** Grid size scales (5x5 → 6x6 → 7x7) on deeper floors; tile distribution shifts toward harder content
- **XP reward:** Every tile revealed grants XP regardless of content — encourages exploration

#### 2. Tap-to-Fight (Combat)
- **When:** Situationally — when a revealed enemy tile is tapped again
- **What it tests:** Resource management, spatial prioritisation, risk/reward judgment
- **How it feels:** Weighty, consequential — enemy attacks first, then player responds
- **Reveal effect:** When an enemy tile is revealed, it immediately **locks all adjacent tiles** — they cannot be tapped or revealed until the enemy is defeated or the player flees. This forces engagement and prevents avoidance through grid navigation.
- **Combat Flow:** Enemy tile revealed → Adjacent tiles locked → Player decides to engage or skip (enemy remains) → Tap enemy tile again → Enemy attacks → Player chooses: fight back / cast spell / flee
- **Flee consequence:** If player flees, the enemy tile remains revealed and adjacent tiles stay locked — the threat persists.
- **Stats:**
  | Entity | HP | DMG |
  |--------|-----|-----|
  | Player (Warrior) | 100 | 1 (base, + abilities) |
  | Enemies | Visible on tile | Visible on tile |
- **Progression:** Enemies scale per floor; abilities modify player DMG and combat options

#### 3. Mana Pool Spell System
- **When:** Situationally during combat — player choice each turn
- **What it tests:** Resource management, prioritisation, spell timing
- **How it feels:** Strategic — no cooldowns, full control of when to burst or conserve
- **Mana regen:** Passive — each tile revealed restores mana
- **Progression:** New spells unlocked through character ability trees at level-up

#### 4. XP & Level-Up
- **When:** Ongoing — XP ticks on every tile reveal
- **What it tests:** Nothing — automatic reward for exploration
- **How it feels:** Satisfying — level-up triggers an ability choice that defines the run
- **Progression:** Each level-up offers 2-3 ability choices specific to the character class

#### 5. Hasty Retreat
- **When:** Rare — strategic decision when the run is going badly
- **What it tests:** Risk assessment — when is 20% of something better than 0% of everything?
- **How it feels:** Tense, deliberate — visible button always available outside combat
- **Mechanic:** Banks 20% of current run gold. Run ends. No other penalty.
- **Progression:** Meta-upgrades can increase the Retreat percentage

#### 6. Floor Progression
- **When:** Upon revealing the exit tile
- **What it tests:** Tile prioritisation — find the exit vs. fully clear for XP
- **How it feels:** Milestone — brief fanfare, then new procedurally generated floor
- **Structure:** One 5x5 grid = one floor. New floor generates fresh grid with harder distribution.
- **Boss Floors:** Designated floors feature a boss tile instead of standard exit

### Tile Types

| Tile | Effect |
|------|--------|
| Empty | XP only |
| Enemy | Combat encounter (HP + DMG visible after flip); locks adjacent tiles on reveal |
| Fast Enemy | Attacks twice per round; locks adjacent tiles on reveal |
| Trap | Instant damage, no combat option |
| Gold | Currency added to run total |
| Chest | Gold + possible item/ability |
| Healing Shrine | Restore HP (and optionally mana) |
| NPC (Goblin Merchant) | Dice-roll trade — safe deal or gamble |
| Checkpoint | Bank current loot; restore partial HP/mana |
| Exit | Advance to next floor |
| Boss | Elite combat encounter; high reward; locks adjacent tiles on reveal |

### Mechanic Interactions

- **Enemy Lock Zones:** Multiple revealed enemies can create compound locked areas, cutting off large grid sections — forces strategic sequencing of which enemy to fight first
- **Mana ↔ Combat:** Spending all mana for a burst kill saves HP but leaves player vulnerable on subsequent floors
- **XP ↔ Retreat:** Delving further for XP/level-ups increases run power but raises the stakes for retreat value
- **Tile Reveal ↔ Mana Regen:** Skipping dangerous tiles (enemies near death) also skips mana recovery — creates tension
- **Checkpoint ↔ Hasty Retreat:** Checkpoints bank 100%; Retreat banks 20%. Reaching a checkpoint before retreating is always better — but not always possible
- **Boss ↔ Floor Progression:** Boss tile must be defeated (or fled) before exit generates on boss floors

### Mechanic Progression

- **Early runs:** Warrior with 1 base DMG. Every combat is meaningful. Mana is precious.
- **Mid runs:** Ability tree choices compound. Spells become viable burst options. Retreat strategy matures.
- **Meta progression:** Permanent gold upgrades raise base stats (HP, mana pool, retreat %). New characters unlock different combat feel.

---

## Controls and Input

### Control Scheme (PWA — Mobile Portrait)

| Action | Mobile | Desktop |
|--------|--------|---------|
| Reveal tile | Tap hidden tile | Left click |
| Initiate combat | Tap revealed enemy tile | Left click |
| Cast spell | Tap spell button (action panel) | Left click |
| Flee combat | Tap Flee button (action panel) | Left click |
| Hasty Retreat | Tap Retreat button (HUD) | Left click |
| Advance floor | Auto on exit tile reveal | Auto |

**No drag. No swipe. No virtual joystick. Single hand, one finger.**

### Input Feel

- **Tile reveal:** Immediate — no delay, CSS flip begins on touchstart
- **Combat tap:** Snappy acknowledgement — enemy HP bar updates instantly
- **Spell cast:** Visual mana drain + float text + enemy HP reduction in sequence (~500ms total)
- **Retreat:** Confirmation-free — one tap exits (intentionally decisive, not accidental)

### Accessibility Controls

- All tap targets minimum 48×48px (WCAG AA touch target guideline)
- HP and mana bars use colour + label (not colour alone)
- Float text readable at base font size
- No time-pressure inputs — all turns are player-initiated
- Future: configurable tile flip speed, high-contrast mode

---

## Roguelike Specific Design

### Run Structure

- **Run length:** 5-10 minutes across multiple 5x5 floors
- **Starting conditions:** Character select → Floor 1 with full HP/mana and character base stats
- **Difficulty scaling per floor:** Enemy HP/DMG increases, tile distribution shifts toward enemies and traps, grid expands (5x5 → 6x6 → 7x7)
- **Victory conditions:** Reach exit tile (floor clear and advance), Checkpoint (bank loot mid-run), Hasty Retreat (bank 20% of run gold and exit), Full dungeon completion (post-MVP long-term goal)

### Procedural Generation

- **Level generation:** Weighted random tile placement per floor. Distribution is tuned per floor depth — early floors are exploration-friendly, deep floors are combat-heavy.
- **Enemy placement:** Random within grid, weighted by floor depth. No guaranteed safe paths.
- **Loot distribution:** Gold and chest tiles weighted by depth. Guaranteed checkpoint every N floors (exact value TBD in balance pass).
- **Biome/theme variation:** Single dungeon theme for MVP. Biome variation (ice, fire, undead) post-MVP.
- **Seed system:** No deterministic seed in MVP — pure random per run.

### Permadeath and Progression

- **Permadeath:** Full — all run loot and items are lost on death. Only gold banked at checkpoints or via Hasty Retreat persists.
- **What persists between runs:** Banked gold, purchased meta-upgrades, unlocked characters
- **Meta-progression:** Gold spent at the between-run upgrade screen on permanent stat boosts (base HP, mana pool size, Hasty Retreat %, starting gold, etc.)
- **Unlock conditions:** Characters and items unlocked by reaching floor milestones or spending gold at the upgrade screen

### Item and Upgrade System

**Item Types:**

| Type | Example | Behaviour |
|------|---------|-----------|
| **Consumable** | Lantern | Limited uses (Lantern: 1 use, reveals a cluster of tiles without flipping) |
| **Equipment** | Iron Sword | Permanent buff for the rest of the run (e.g. +2 base DMG) |
| **Passive Ring** | Mana Ring | Ongoing effect active for the full run (e.g. +1 mana per tile reveal) |

- **Rarity system:** Coded in from the start (Common, Rare, Epic tiers). MVP ships Common items only. Rare/Epic items introduced in post-MVP content drops.
- **Item synergies:** Post-MVP scope. MVP items are standalone with no intentional cross-item combos.
- **Curse/trade-off items:** Planned post-MVP (e.g. Cursed Blade: +20 DMG / -30 max HP). Framework stubbed in.
- **Acquisition:** Found in Chest tiles; occasionally offered by NPC (Goblin Merchant)

### Character Selection

| Character | Status | HP | DMG | Mana | Unique Mechanic |
|-----------|--------|-----|-----|------|-----------------|
| **Warrior** | Starter | 100 | 1 | 60 | Double damage vs. undead enemy type |
| **Ranger** | Unlockable (gold) | TBD | TBD | TBD | Reveals tiles silently — no adjacent tile lock on enemy reveal |

- **Character differentiation:** Each character has distinct base stats and a unique ability tree. The Ranger's silent reveal changes the fundamental threat model — enemy tiles become less spatially punishing, shifting strategy toward resource management over grid navigation. The Warrior's undead bonus rewards dungeon knowledge and creates build incentives around undead-heavy floors.
- **Unlock method:** Gold spend at the between-run upgrade screen
- **Future characters:** Additional classes post-MVP (Mage, Rogue, etc.), each with a unique mechanic

### Difficulty Modifiers

| Tier | Enemy Stats | Checkpoints | Mana Regen | Gold/Item Drops | XP Gain |
|------|-------------|-------------|------------|-----------------|---------|
| **Easy** | Reduced | More frequent | Higher | -50% | -25% |
| **Normal** | Baseline | Baseline | Baseline | Baseline | Baseline |
| **Hard** | Increased | Fewer | Lower | +50% | +25% |

- **Design intent:** Easy is accessible but costs progression currency — no free ride to meta-upgrades. Hard is genuinely rewarding, not just punishing.
- **Stacking modifiers:** Post-MVP framework for optional per-run risk/reward challenge modifiers that players can stack for higher stakes and bigger rewards.

---

## Progression and Balance

### Player Progression

Cryptic Grids uses three interlocking progression layers:

#### Progression Types

| Type | System | Scope |
|------|--------|-------|
| **Skill** | Player learns enemy patterns, grid reading, retreat timing | Permanent (player knowledge) |
| **Power (in-run)** | Ability tree choices at level-up, item pickups | Resets on death |
| **Power (meta)** | Character upgrade trees, main screen shop boosts | Permanent |
| **Content** | New characters, items, floors unlock over time | Permanent |

#### In-Run Progression

- XP earned per tile revealed → triggers level-up → player chooses from 2-3 character-specific abilities
- Items found in chests or purchased from Goblin Merchant modify the run permanently
- Ability choices and items compound — each run's build is defined by these decisions

#### Meta Progression

**Character XP Trees (per character):**
- XP carries over between runs, tied to the character played
- Each character has their own XP-gated upgrade tree (passive stat boosts, new ability options, enhanced unique mechanics)
- Upgrades cost both XP (earned by playing that character) and gold — rewards mastery of each character specifically

**Gold Uses:**
- **Main screen shop:** One-time run boosts purchased before a run starts (e.g. start with a healing potion, +10 starting HP, guaranteed first-floor chest)
- **NPC trades:** Spent during runs at Goblin Merchant tiles
- **Character upgrades:** Combined cost with XP to unlock character tree nodes

#### Progression Pacing

- First run: Warrior only, no upgrades — raw skill challenge
- After run 1: First gold banked, first character XP logged — immediate sense of progress
- Sessions 2-5: Warrior tree begins filling out, shop options become available
- Session 10+: Ranger unlockable, build variety expands significantly
- Long-term: Character mastery depth, harder floors, post-MVP content tiers

### Difficulty Curve

**Pattern:** Sawtooth within a run, flattened over sessions by meta-progression

- Each floor ramps in enemy density and stats, then resets tension when a new floor begins
- The player stays ahead of the curve through good decisions: ability choices, item use, mana management, knowing when to retreat
- Meta-progression (character upgrades, shop boosts) gradually widens the margin for error — without removing the challenge

#### Challenge Scaling

| Floor Range | Grid | Tile Distribution | Enemy Scaling |
|-------------|------|-------------------|---------------|
| 1-3 | 5x5 | Exploration-friendly | Low HP/DMG |
| 4-6 | 5x5 | Balanced | Medium HP/DMG |
| 7-9 | 6x6 | Combat-heavy | High HP/DMG |
| 10+ | 7x7 | Trap/enemy dense | Boss-tier scaling |

- **Difficulty spikes:** Boss floors — fixed challenge gates that require using all available tools
- **Soft difficulty:** Multiple revealed enemy lock zones create compounding spatial pressure

#### Difficulty Options

- Easy / Normal / Hard selected at run start (see Difficulty Modifiers table in Roguelike Specific Design)
- No mid-run difficulty change

### Economy and Resources

#### Resources

| Resource | Earned By | Spent On | Persists? |
|----------|-----------|----------|-----------|
| **Gold** | Enemy kills, chest tiles, Goblin Merchant | Run boosts (shop), NPC trades, character upgrade costs | Yes — banked gold only |
| **XP** | Tile reveals (all types) | Character upgrade trees (combined with gold) | Yes — per character |
| **Mana** | Passive regen per tile revealed | Spell casting in combat | No — resets per run |
| **HP** | Healing shrines, checkpoints | Lost in combat and traps | No — resets per run |

#### Economy Flow

```
Tile revealed → XP gained → mid-run level-up → ability choice
Enemy killed → gold gained → checkpoint/retreat → gold banked
Banked gold → main screen shop (run boosts) OR character upgrade tree
Character XP → character upgrade tree (combined cost with gold)
```

- **Gold scarcity:** Gold lost on death (unbanked) creates meaningful checkpoint/retreat decisions
- **XP scarcity:** XP only accumulates for the character you play — incentivises sticking with a character to master their tree
- **No premium currency:** Free game, no IAP in MVP

---

## Level Design Framework

### Structure Type

**Procedural Floors** — each floor is a self-contained procedurally generated grid played sequentially. No world map, no branching paths, no level select screen. One dungeon that gets harder the deeper you go.

### Floor Types

| Floor Type | Cadence | Description |
|------------|---------|-------------|
| **Standard Floor** | Every floor except boss floors | Weighted random tile placement, scaling with depth |
| **Boss Floor** | Every 10th floor (10, 20, 30...) | Boss tile replaces exit; must be defeated or fled before exit generates |
| **Special Floors** | Post-MVP | Merchant floors, trap gauntlets, loot vaults — framework planned |

- Floor 1 is always a standard floor — no special tutorial layout, pure random
- Special first-floor experience may be added post-MVP

### Tutorial Integration

**Teach through play — no text tutorials.**

- The Warrior's simple stat profile (1 DMG, standard HP/mana) makes early floors naturally forgiving without hand-holding
- New mechanics surface organically: first trap teaches trap tiles, first enemy teaches lock zones, first NPC tile teaches dice-roll risk
- Enemy and mechanic density in early floors naturally lower due to tile distribution weighting

### Level Progression

**Linear sequence** — floors advance automatically on exit tile reveal. No player choice of floor order.

#### Unlock System

Floors are not unlocked — they are reached by surviving. The dungeon simply gets deeper. Post-MVP floor milestones may trigger content unlocks (new characters, special items).

#### New Threat Introduction

- **Early floors (1-5):** New enemy types and mechanics appear frequently — one new element introduced roughly every 1-2 floors
- **Mid floors (6-15):** Introduction rate slows; challenge comes from combining known threats in new spatial configurations
- **Deep floors (16+):** No new elements — pure mastery test of everything learned. Enemy density and stats are the only escalating variables

#### Replayability

Every run generates a fresh floor sequence — no two runs share the same tile layouts. Character choice, ability tree decisions, and item draws ensure each run feels distinct even on familiar floor depths.

### Level Design Principles

1. **New threats arrive early, mastery comes late** — front-load discovery, back-load difficulty
2. **Spatial pressure over stat walls** — difficulty from lock zones and tile positioning, not just enemy stat inflation
3. **Every floor is a decision tree** — tile reveal order always presents meaningful choices

---

## Art and Audio Direction

### Art Style

**Cartoonish illustrated dungeon** — top-down perspective, chunky hand-drawn objects with clear silhouettes, readable at mobile scale. Warm and characterful, not grimdark. Styled after Dungelot's tile grid aesthetic.

#### Visual References

- **Primary:** Dungelot: Shattered Lands — tile grid layout, top-down dungeon view, illustrated tile content
- **Style reference image:** Cartoonish top-down dungeon room — cracked stone floor tiles, wooden chests, barrels, torches, warm amber torchlight against cool stone. Chunky illustrative style with visible texture and depth.

#### Color Palette — Dungeon Themes

Palette shifts per dungeon theme as players delve deeper:

| Theme | Floors | Palette |
|-------|--------|---------|
| **Stone Dungeon** | 1-9 | Warm amber/red torchlight, grey cracked stone, dark shadows |
| **Jungle Ruins** | 10-19 (post-MVP) | Greens, mossy stone, dappled light |
| **Crystal Cavern** | 20+ (post-MVP) | Deep purple, glowing crystal blues, black rock |

MVP ships Stone Dungeon theme only. Theme framework built to support future additions.

#### Camera and Perspective

- **Top-down, fixed** — no camera movement, no zoom
- Grid fills the portrait viewport
- Tile back face (unrevealed): uniform dungeon stone texture
- Tile front face (revealed): illustrated content — enemy portrait, gold pile, chest, trap mechanism, NPC, etc.

### Audio and Music

**Dark orchestral ambient** — atmospheric tension, not melodic hooks. Designed to fade into the background during play and surface during key moments.

#### Music Style

- **Exploration:** Looping ambient dungeon track — slow strings, distant percussion, environmental texture. Low intensity, non-distracting.
- **Combat:** Same track with tension layer added (or swap to higher-intensity variant)
- **Boss floor:** Distinct track — heavier, more dramatic
- **Generation approach:** AI-generated via Suno/Udio with prompts targeting "dark orchestral dungeon ambient loop, atmospheric tension, no strong melody"

#### Sound Design

Priority sound effects for MVP:

| Sound | Trigger | Feel |
|-------|---------|------|
| Tile flip | Any tile reveal | Satisfying stone-on-stone thud + reveal chime |
| Combat hit | Enemy or player takes damage | Punchy, impactful |
| Spell cast | Spell used | Magical whoosh, distinct per spell type if possible |
| Gold pickup | Gold tile revealed or enemy killed | Classic coin chime, brief |
| Level up | XP threshold reached | Ascending tone, celebratory but short |
| Death | HP reaches 0 | Low, heavy — run-ending weight |
| Checkpoint | Checkpoint tile revealed | Positive, secure — progress banked |
| Hasty Retreat | Retreat button tapped | Urgent whoosh — escape feel |

- **Generation approach:** jsfxr (sfxr.me) for UI/combat SFX — full set generatable in ~20 minutes
- **Ambient layers:** freesound.org or Pixabay for torch crackle, dripping water (royalty-free, no attribution required)
- **iOS audio note:** Audio context requires first-touch activation — implement on first user interaction (already noted in platform considerations)

#### Voice / Dialogue

No voice acting. NPCs communicate via text only. Goblin Merchant uses brief flavour text for dice-roll outcomes.

### Aesthetic Goals

- **Readable first:** Every tile must be instantly identifiable at mobile scale — silhouette clarity over detail
- **Warm and inviting, not oppressive:** Cartoonish style keeps the dungeon fun, not anxiety-inducing — serves *Accessible Depth*
- **Feedback through aesthetics:** Float text, screen shake, tile flip animation, and audio work together to make every action feel satisfying — serves *Meaningful Decisions & Satisfying Feedback*
- **Theme progression as reward:** Palette shifts when entering new dungeon themes signal player achievement visually

---

## Technical Specifications

### Performance Requirements

#### Frame Rate Target
- **60fps** for all CSS animations (tile flips, float text, shake effects)
- Target hardware: iPhone 12 / mid-range Android equivalent
- No real-time game loop — turn-based, so CPU load is minimal between interactions
- All animation via CSS transitions and keyframes (GPU-accelerated, not JS-driven)

#### Resolution Support
- **Primary:** Portrait mobile, variable viewport height, max-width 480px
- **Secondary:** Desktop browser, fixed 480px column centred on screen
- No landscape support in MVP
- No resolution scaling — responsive within portrait column only

#### Load Time
- **Target:** Under 3 seconds on a decent mobile connection (4G/WiFi)
- **Maximum acceptable:** 5 seconds
- No heavy framework or engine — vanilla JS + CSS keeps baseline small
- Illustrated tile assets will be the primary load weight; optimise via sprite atlasing and WebP format

### Platform-Specific Details

#### PWA — Mobile Web (iOS Safari / Android Chrome)

- **Offline play:** Required — service worker caches all assets on first load
- **localStorage:** All game state, meta-progression, banked gold, character XP, and settings persisted locally. No backend, no accounts, no cloud sync in MVP.
- **iOS Safari:** Audio context requires first-touch activation — implemented on first user interaction
- **PWA install:** Android shows native install prompt. iOS requires manual "Add to Home Screen" — no prompt available, consider subtle in-game nudge.
- **iOS minimum:** iOS 14+ (Safari with adequate CSS 3D transform support)
- **Android minimum:** Chrome 80+ / Android 8.0+
- **Portrait lock:** CSS `orientation: portrait` media query + manifest orientation lock
- **No IAP:** Free, no in-app purchases in MVP

#### Desktop Browser (Secondary)

- **Supported browsers:** Chrome, Firefox, Safari, Edge — modern versions only
- **Input:** Mouse click replaces touch tap, identical interaction model
- **No additional features:** Desktop is a bonus, not a design target

### Asset Requirements

#### Art Assets (MVP)

| Category | Count | Format | Notes |
|----------|-------|--------|-------|
| Tile front faces | ~11 | WebP/PNG | One illustrated sprite per tile type |
| Enemy portraits | 4-6 | WebP/PNG | Displayed on revealed enemy tile |
| Tile back face | 1 | WebP/PNG | Uniform unrevealed stone texture |
| Character portraits | 2 | WebP/PNG | Warrior + Ranger (select screen) |
| UI elements | CSS | — | HUD, buttons, action panel — CSS-rendered for MVP, illustrated post-MVP |

- All sprites optimised for mobile display at ~80-120px tile size
- Sprite atlas recommended to reduce HTTP requests
- Cartoonish illustrated style — reference image on file

#### Audio Assets (MVP)

| Category | Count | Format | Notes |
|----------|-------|--------|-------|
| Dungeon ambient loop | 1 | MP3/OGG | AI-generated (Suno/Udio) |
| Sound effects | 8 | MP3/OGG | Tile flip, hit, spell, gold, level-up, death, checkpoint, retreat |
| Boss floor track | 1 | MP3/OGG | Distinct from ambient loop |

- Dual format (MP3 + OGG) for cross-browser compatibility
- All audio preloaded after first touch to satisfy iOS autoplay policy

#### External Assets

- Sound effects: jsfxr (sfxr.me) — generated, royalty-free
- Ambient audio: Suno/Udio AI generation or freesound.org (CC-licensed)
- Tile/enemy illustrations: AI-generated (Stable Diffusion / Midjourney) or commissioned — cartoonish Dungelot style

### Technical Constraints

- **No game engine** — vanilla JS, DOM, CSS only. Validated via working prototype.
- **No backend** — localStorage is the persistence layer. Single-player only in MVP.
- **No canvas/WebGL** — all rendering via DOM elements and CSS transforms
- **Bundle size target:** Under 5MB total including all assets (initial load)
- **No build toolchain required for MVP** — plain HTML/CSS/JS files, served via static host or PWA

---

## Development Epics

### Epic Overview

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

### Recommended Sequence

1. **Epics 1-3** — Vertical slice: fully playable run with combat, economy, and win/loss
2. **Epic 4** — Meta-loop: reason to replay, persistent progress with robust save
3. **Epics 5-6** — Content depth: enemy variety and second character
4. **Epics 7-8** — Polish: difficulty tuning, art, audio
5. **Epic 9** — Ship: PWA hardening, performance, deploy

### Vertical Slice

**First playable milestone (end of Epic 3):** A complete run of Cryptic Grids — tap to reveal a 5x5 grid, fight enemies with the mana/spell system, collect gold, level up with ability choices, reach the exit or die. Hasty Retreat and checkpoint banking functional. No meta-progression yet — each run starts fresh.

---

## Success Metrics

### Technical Metrics

#### Key Technical KPIs

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Frame rate | Consistent 60fps during tile flips and combat | Manual test on iPhone 12 / mid-range Android |
| First load time | Under 3 seconds on 4G/WiFi | Browser DevTools Network tab |
| Max load time | Under 5 seconds | Browser DevTools Network tab |
| Bundle size | Under 5MB total | DevTools / build output |
| Offline play | Full game playable with no connection | Airplane mode test |
| Save integrity | Zero data loss across sessions | Manual test: play, close, reopen |
| Cross-browser | Plays correctly on Chrome, Safari, Firefox, Edge | Manual test each browser |

### Gameplay Metrics

**Primary success signal: The "just one more run" test.**

> After dying or retreating, do you immediately want to start another run?
> If yes — the game is working. If no — something in the loop is broken.

This is the single most important metric for Cryptic Grids. All other gameplay
metrics are diagnostic tools to identify *why* the loop is or isn't working.

#### Key Gameplay KPIs

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| "One more run" compulsion | Felt consistently after death/retreat | Personal playtesting gut check |
| Run length | 5-10 minutes median | Stopwatch during playtesting sessions |
| Level-up feel | Ability choices feel meaningful, not random | Personal + any external playtest feedback |
| Retreat usage | Players discover and use Hasty Retreat | Observe during any playtesting sessions |
| Combat tension | Enemy lock zones create real spatial decisions | Personal playtesting observation |
| Death feel | Death feels fair and instructive, not frustrating | Personal + external feedback |

### Qualitative Success Criteria

The game has succeeded if:

- **You can't stop playing it yourself** — the primary and non-negotiable bar
- **Someone you share it with says "one more run"** unprompted
- **Players reference specific moments** — "the Goblin Merchant screwed me", "I almost made it to floor 10"
- **The Hasty Retreat creates genuine tension** — players agonise over the decision
- **Death teaches something** — players immediately know what they'd do differently

### Metric Review Cadence

- **During development:** After completing each epic, personal playtest of the full loop to date. Does the "one more run" feeling exist yet?
- **At vertical slice (Epic 3):** First external playtest. Share with 2-3 people. Watch them play without instruction.
- **Pre-launch (Epic 8-9):** Extended personal playtest session. If you're not enjoying it, find out why before shipping.
- **Post-launch:** Organic — feedback from anyone you share the URL with. No formal analytics in MVP.

---

## Out of Scope

The following are explicitly not in scope for Cryptic Grids v1.0:

**Features:**
- Multiplayer / co-op
- Stacking run modifiers / challenge runs
- Cloud save / account system
- Analytics / telemetry
- Rare/Epic item tiers
- Item synergy system
- Curse/trade-off items

**Content:**
- Additional dungeon themes beyond Stone Dungeon (Jungle Ruins, Crystal Cavern — post-MVP)
- Additional characters beyond Warrior + Ranger
- Special floor types (merchant floors, trap gauntlets, loot vaults)
- Additional enemy types beyond 4-6 MVP set

**Platform:**
- App store submission (iOS App Store / Google Play)
- Landscape orientation support
- Console or desktop-native versions

**Polish:**
- UI illustration (CSS-rendered for MVP)
- Full voice acting
- Localization (English only v1.0)

### Deferred to Post-Launch

- Biome/theme variation (Jungle Ruins, Crystal Cavern)
- Stacking difficulty modifiers
- Additional characters (Mage, Rogue, etc.)
- Cloud sync / account system
- Special floor types
- Rare/Epic item tiers and synergies
- Curse/trade-off items

---

## Assumptions and Dependencies

### Key Assumptions

- **Tech stack validated:** Vanilla JS + DOM + CSS is sufficient for a fun, performant mobile game — confirmed by working prototype
- **Solo developer:** Evenings and weekends only — scope is set accordingly
- **AI art pipeline:** Tile and enemy illustrations generated via AI tools (Stable Diffusion / Midjourney) — no commissioned artist budget required
- **AI/free audio pipeline:** Music via Suno/Udio, SFX via jsfxr, ambient via freesound.org — no audio budget required
- **Modern mobile browsers:** Players on iOS 14+ / Android Chrome 80+ — no legacy browser support needed
- **No backend required:** IndexedDB sufficient for all persistence in v1.0 — no server costs or infrastructure

### External Dependencies

- **AI image generation:** Stable Diffusion / Midjourney for tile and enemy art
- **AI music generation:** Suno or Udio for ambient dungeon tracks
- **jsfxr:** Browser-based SFX generation (sfxr.me) — royalty-free
- **freesound.org / Pixabay:** CC-licensed ambient audio layers
- **Static host:** GitHub Pages, Netlify, or Vercel for deployment — free tier sufficient

### Risk Factors

- **iOS storage purge:** Mitigated by IndexedDB (more robust than localStorage) + Export/Import save feature
- **AI art consistency:** Generated assets may vary in style — mitigated by using consistent prompts and reference image
- **Solo dev scope creep:** GDD explicitly defines out of scope — refer back to this document when tempted to add features
- **Audio on iOS:** First-touch activation required — documented and planned for in Epic 9

---

## Document Information

**Document:** Cryptic Grids - Game Design Document
**Version:** 1.0
**Created:** 2026-03-30
**Author:** Peter
**Status:** Complete

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-30 | Initial GDD complete |
