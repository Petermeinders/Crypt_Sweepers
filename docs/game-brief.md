---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: []
documentCounts:
  brainstorming: 0
  research: 0
  notes: 0
workflowType: 'game-brief'
lastStep: 2
project_name: 'Game2'
user_name: 'Peter'
date: '2026-03-30'
game_name: 'Cryptic Grids'
---

# Game Brief: Cryptic Grids

**Date:** 2026-03-30
**Author:** Peter
**Status:** Draft for GDD Development

---

## Executive Summary

Cryptic Grids is a minesweeper-meets-dungeon-crawler where every tap could reveal treasure or death. Players explore a procedurally generated grid dungeon, battle enemies in turn-based combat, manage a shared mana pool for spells, and decide when to push deeper or make a Hasty Retreat with what they've earned.

**Target Audience:** Mobile-first casual-to-core gamers aged 8+ who love roguelikes, build optimization, and the "just one more run" loop. Portrait touch, 5-10 minute sessions.

**Core Pillars:** Meaningful Decisions & Satisfying Feedback → Rewarding Progression → Accessible Depth

**Key Differentiators:** Mana-based spell system (no cooldowns), Delve-or-Retreat tension, Risky NPC Encounter tiles with dice, Interaction Fidelity First.

**Platform:** PWA — mobile web, portrait, free to play.

**Success Vision:** A shipped game Peter is proud of. Clean, responsive, fun to play. Something worth sharing.

---

## Game Vision

### Core Concept

A minesweeper-meets-dungeon-crawler where every tap could reveal treasure or death.

### Elevator Pitch

Cryptic Grids blends the satisfying simplicity of minesweeper with deep roguelike decision-making — tap to reveal, choose your battles, and build a run that's uniquely yours. Every dungeon is procedurally generated, every upgrade choice matters, and every death teaches you something. One thumb, five minutes, infinite replayability.

### Vision Statement

Cryptic Grids is built around the moments between taps — the anticipation of what's hidden, the temptation of one more run, and the quiet satisfaction of a build finally clicking. Every design decision serves a single goal: give players a reason to come back. A new character to try, an upgrade just out of reach, a dungeon mechanic they haven't seen yet, a gold dilemma with no right answer. The game respects mobile players' time by delivering genuine depth in five-minute sessions — and earns their obsession by always dangling something worth coming back for.

---

## Target Market

### Primary Audience

Mobile-first casual-to-core gamers aged 8+ who enjoy roguelikes, puzzle games, and incremental progression systems. Players who find joy in optimizing builds, unlocking new options, and experimenting with combinations rather than chasing a single "correct" path. They play in portrait mode, 5-10 minute sessions, one hand holding the phone and one hand tapping — on a couch, during a break, or before bed.

**Demographics:**
- Age: 8+ (simple to learn, deep enough for adults)
- Platform: Mobile-first web (PWA), portrait orientation
- Session length: 5-10 minutes per run

**Gaming Preferences:**
- Casual to intermediate roguelike fans
- Enjoys grid/puzzle mechanics (minesweeper, Dungelot)
- Values unlocking and collection for the sake of more options, not just completion
- Appreciates Risk/Reward decisions — willingness to customize run difficulty for better loot odds

**Motivations:**
- Finding the optimal build through experimentation
- Unlocking new items, characters, and abilities to mix and match
- The "just one more run" loop driven by permanent progression
- Risk/Reward decisions that make each run feel personalized

### Secondary Audience

Puzzle and minesweeper fans who are drawn in by the familiar grid-reveal mechanic and stay for the roguelike depth they didn't expect. Also includes lapsed mobile gamers looking for something meatier than match-3 but lighter than a full RPG.

### Market Context

The mobile roguelike and dungeon-crawler space is proven and active — Dungelot, Slay the Spire, and Slice & Dice have all demonstrated strong audiences for deep-but-accessible mobile roguelikes. The web-based PWA space for this genre is underdeveloped, representing a real opportunity for discoverability.

**Similar Successful Games:**
- Dungelot: Shattered Lands (closest mechanical reference)
- Slice & Dice (run-based decisions, permanent upgrades)
- Slay the Spire (build optimization, roguelike loop)
- Solomon's Boneyard (mobile-native feel, upgrade progression)

**Market Opportunity:**
Free-to-play web game with no install friction. If it finds an audience, a future paid client version with expanded content (characters, dungeons, items) serves as a natural upgrade path. Priority is player enjoyment over monetization — a sustainable approach for a passion project that could organically grow into something more.

---

## Game Fundamentals

### Core Gameplay Pillars

1. **Meaningful Decisions & Satisfying Feedback** *(co-equal)* — Every tap, upgrade choice, and run modifier carries a real tradeoff — and every action must feel good to execute. A decision that feels dead to make isn't meaningful, regardless of strategic depth.

2. **Rewarding Progression** — There is always something just out of reach: an upgrade, an unlock, a deeper dungeon. Players always leave a session with something gained.

3. **Accessible Depth** — Simple enough to learn at 8+ through a straightforward starter character and dungeon. Complexity scales naturally through new characters, floors, and dungeons — players teach themselves by playing, not by reading tooltips.

**Pillar Priority:** When pillars conflict, prioritize in order:
Meaningful Decisions & Satisfying Feedback → Rewarding Progression → Accessible Depth

### Primary Mechanics

- **Tap to Reveal** — The core action. Hidden grid cells are tapped to reveal their contents: enemies, loot, traps, shops, exits, checkpoints, or empty rooms. Tension lives in not knowing what's next.

- **Turn-Based Combat** — When an enemy is revealed, a turn begins. Most enemies wait for the player to engage. "Fast" enemies attack immediately on reveal, adding risk to uncertain tiles. If the player engages, combat resolves: enemy attacks first, then the player responds based on stats. After each exchange the player chooses: fight again, reveal another tile, or use an ability/item.

- **Ability & Item Use** — Players carry items (e.g. a lantern to safely peek at tiles) and character abilities usable during combat or exploration, creating tactical options beyond brute-force fighting.

- **Run-Based Level-Up** — Gaining XP triggers level-up choices tied to the current character's ability tree (e.g. a warrior archetype, a rogue archetype). Chosen abilities persist for the run, building a loadout that defines that session's playstyle.

- **Risk/Reward — Delve or Retreat** — The core strategic tension of every run. Players can push deeper into the dungeon for greater rewards, or use the "Hasty Retreat" to escape before reaching a checkpoint and bank ~20% of collected loot. Checkpoints are built into dungeon generation and offer full loot banking plus a safe exit. The further you delve without hitting a checkpoint, the higher the stakes.

- **Run Modifiers** — Before starting a run, players can configure difficulty modifiers. Harder settings increase gold drop rates, loot quality, or other rewards — a deliberate tradeoff for skilled or bold players.

- **Permanent Meta-Upgrades** — Gold spent between runs on persistent upgrades: stronger starting stats, new items, new characters, access to deeper dungeons.

**Core Loop:**
Reveal tiles → Encounter enemy → Decide to fight or reposition → Use abilities/items tactically → Delve deeper or Hasty Retreat → Level up and build your character → Collect gold → Die or complete dungeon → Spend gold on permanent upgrades → Start next run stronger.

### Player Experience Goals

- **Mastery & Growth** — Players feel themselves improving: learning enemy patterns, understanding character synergies, making smarter risk decisions over time.
- **Discovery & Surprise** — New tile types, enemy mechanics, and unlockable content keep even experienced players finding something new deeper in.
- **Tension & Relief** — The unrevealed grid and the delve-or-retreat decision create genuine suspense. Surviving a fast enemy or making it to a checkpoint feels earned.
- **Optimisation Satisfaction** — The quiet pleasure of a build clicking — abilities synergising, a risky run paying off.

**Emotional Journey:** Curiosity on reveal → Tension in combat and risk decisions → Relief and satisfaction on survival → Excitement on level-up choices → The agonizing delve-or-retreat call → Determination after death → Anticipation starting the next run.

---

## Scope and Constraints

### Target Platforms

**Primary:** Mobile web PWA — portrait orientation, touch-first, tap controls. Installable to home screen via browser.

**Secondary:** Desktop web browser — same codebase, mouse/click controls, wider layout adaptation if needed.

**Future (post-traction):** Native mobile app wrapping the web build. Paid content expansion (characters, dungeons, items) as optional IAP layer.

### Development Timeline

Passion project — evenings and weekends. No fixed deadline. MVP first, content expansion iterative.

### Budget Considerations

Zero cash budget. Passion project — all development is sweat equity. Asset strategy:
- **Art:** Free asset packs (itch.io, OpenGameArt) or AI-generated 2D assets. Stylized cartoon illustration style (see Visual Style section).
- **Visual trick:** 2D art rendered on CSS 3D tiles (cube with gradient depth). Tile-flip animation on reveal via CSS `transform: rotateY()`. Achieves premium feel without 3D asset pipeline.
- **Audio:** Free SFX/music packs. No custom composition.
- **Placeholder strategy:** Filler text and CSS shapes for all assets during development. Real assets swapped in later without code changes.
- **Marketing:** Zero budget. Organic sharing, itch.io listing, friends and community.

### Team Resources

**Team:** Solo developer (Peter)
**Availability:** Evenings and weekends
**Skill profile:**
- JavaScript/Web: Intermediate
- Game design: Informed enthusiast with deep genre knowledge
- Art: Reliant on free/generated assets
- Audio: Reliant on free packs

**Skill Gaps:**
- Advanced Canvas/WebGL (acceptable — starting DOM+CSS, Canvas added only if needed)
- Art creation (mitigated by asset strategy above)
- Audio design (mitigated by free packs)
- Game balance/tuning (mitigated by iterative playtesting)

### Technical Constraints

- **Stack:** Vanilla JS + HTML + CSS (DOM-first). Optional Canvas layer added later for particles/effects only.
- **State:** localStorage for all save data. No backend, no accounts, no server.
- **Performance:** Must run smoothly on mid-range modern mobile. 60fps animations for tile flips and UI transitions. Clean, responsive layout.
- **Offline:** Full offline support via PWA service worker. No network required to play. Optional update check on load.
- **Device support:** Modern mobile browsers (iOS Safari, Android Chrome). No legacy device support required.
- **Third-party:** None. No analytics, no ads, no SDKs.
- **File size:** Lean build — fast first load is critical for a web game. Assets lazy-loaded as needed.

### Scope Realities

- MVP scope is intentionally narrow: one character, one dungeon type, core grid loop, basic meta-upgrades.
- All content beyond MVP (characters, dungeons, enemies, items) is additive — the architecture must support expansion without rewrites.
- Visual polish and real assets come after core loop is fun with placeholders.
- The "Hasty Retreat" checkpoint system and run modifiers are core mechanics, not post-MVP features — build them in from day one.

---

## Reference Framework

### Inspiration Games

**Dungelot: Shattered Lands**
- Taking: Grid reveal mechanic, top-down dungeon, tap-to-explore, enemy encounters on tile reveal, dungeon atmosphere
- Not Taking: Dated UI, lack of meaningful run-build decisions, cooldown-based ability system

**Slice & Dice**
- Taking: Run-based decisions that matter, character variety, meaningful mid-run upgrade choices, permanent meta-progression
- Not Taking: Dice as core gameplay loop

**Slay the Spire**
- Taking: Build optimization loop, experimentation to find what works, run variety through character archetypes
- Not Taking: Card mechanic, long session length

**Solomon's Boneyard**
- Taking: Character archetypes with unique ability trees, level-up choices mid-run, mobile-native feel, elemental-style specializations
- Not Taking: Twin-stick real-time action, shooter genre

**Orb of Creation**
- Taking: Permanent meta-progression, always something to unlock just out of reach, satisfying unlock reveals
- Not Taking: Idle/passive gameplay, factory complexity

### Competitive Analysis

**Direct Competitors:**
- Dungelot: Shattered Lands — closest mechanical match
- Pixel Dungeon variants — roguelike dungeon crawlers on mobile
- Minesweeper-style puzzle games — share the grid reveal hook

**Competitor Strengths:**
- Dungelot proved the grid-reveal dungeon concept works on mobile
- Pixel Dungeon has a loyal, deep community
- Minesweeper variants are instantly understandable

**Competitor Weaknesses:**
- Dungelot feels dated — UI, pacing, and ability systems haven't aged well
- Most mobile dungeon crawlers go too simple (no depth) or too complex (overwhelming new players)
- Cooldown-based ability systems reduce tactical flexibility
- Few offer meaningful run customization before starting
- None combine grid-reveal with a mana-based spell system, risky NPC encounters, and delve-or-retreat tension

### Key Differentiators

1. **Mana-Based Spell System** — No cooldowns. A shared mana pool gives players full tactical control: burst all spells at once or space them out. Resource management over arbitrary waiting.

2. **Delve-or-Retreat Risk/Reward** — The "Hasty Retreat" mechanic and checkpoint system make every step deeper a genuine decision. No other grid-reveal dungeon game structures this tension so explicitly.

3. **Risky NPC Encounter Tiles** — Certain tiles reveal dangerous but tempting characters (e.g. the Goblin Merchant: roll to grab offered gold and escape, or fail and get stabbed). Dice appear only at these high-stakes moments — not as core gameplay, but as visceral, memorable events that players talk about. The dice roll is the language of "tempting but dangerous."

4. **Procedural Dungeon with Smart Parameters** — One dungeon that generates differently based on difficulty settings, unlocked content, and progression. No world map or dungeon select screen. The dungeon evolves as the player grows, with a living world layer as a future expansion direction.

5. **Interaction Fidelity First** — Designed for portrait touch from day one. Instant tap response, smooth CSS tile-flip animations, and satisfying feedback on every action build player trust before art ever arrives. Interaction fidelity over visual fidelity — placeholders that respond instantly ship before beautiful art that lags.

**Unique Value Proposition:**
A modern mobile dungeon crawler where every decision carries weight — a mana pool to manage, a merchant to gamble with, a deeper floor to risk, and a dungeon that always has something new waiting. Five minutes that feel like an adventure.

---

## Content Framework

### World and Setting

Cryptic Grids takes place in an ancient, ever-shifting labyrinth known only as the Grid — a dungeon no explorer has ever fully mapped. Light lore only: enough atmosphere to ground the experience without demanding narrative investment. The world exists to serve the gameplay, not the other way around.

**Tone:** Dark, mysterious, dangerous. Flickering torchlight, cold stone, things lurking behind unrevealed tiles.

### Narrative Approach

Emergent and environmental. No cutscenes, no dialogue trees. Story is delivered through:
- **NPC encounter text** — brief, flavourful. The Goblin Merchant has a snarky one-liner before the dice roll. Characters have personality without requiring reading.
- **Item & ability names and descriptions** — short, evocative. "Lantern of Borrowed Time: Peek at one tile without waking what's inside."
- **Environmental implication** — the dungeon tells its own story through tile variety, enemy types, and what you find deeper in.

**Story Delivery:** Text-only, minimal. Players project their own narrative onto the run.

### Content Volume (MVP)

- 1 starter character (simple, no ability complexity)
- 1 dungeon environment (stone/torch aesthetic)
- ~5-8 enemy types with distinct behaviours
- ~10-15 item types
- ~3-5 starter abilities on the first character tree
- 1 NPC encounter type (Goblin Merchant) with dice mechanic
- Basic permanent upgrade tree (5-8 nodes)

All content beyond MVP is additive. Architecture must support expansion without rewrites.

---

## Art and Audio Direction

### Visual Style

Stylized cartoon illustration — bold outlines, expressive characters, warm/cool contrast. Not pixel art, not realistic. Think: illustrated tabletop dungeon brought to life.

**Reference image:** Top-down dungeon room with stone tile grid, warm amber torch glow against cool grey stone, scattered props (chests, barrels, lanterns). Tiles are clearly distinguishable with clean grid lines.

**Key visual mechanics:**
- **Tile back:** Stone texture with subtle gradient — the "face down" state
- **Tile flip:** CSS 3D rotateY() animation on reveal — smooth, satisfying, instant response
- **Tile face:** 2D illustrated content (enemy, loot, trap, NPC) on a flat tile surface
- **Lighting:** Vignette dark edges, warm central glow — creates focus and atmosphere with pure CSS/gradient
- **UI:** Clean, minimal HUD. Health bar, mana pool, gold count. Nothing that clutters the grid.

**Color palette:** Deep charcoal backgrounds, warm amber/orange torch accents, muted stone greys, occasional jewel tones for loot and magic.

### Audio Style

Dark orchestral and ambient dungeon atmosphere.

- **Music:** Slow, tension-building orchestral underscore. Strings, low brass, occasional silence. Free packs from itch.io/OpenGameArt targeting "dungeon ambient" or "dark fantasy."
- **SFX priorities (in order):**
  1. Tile flip (satisfying click/reveal sound)
  2. Combat hit/damage
  3. Gold pickup
  4. Level up
  5. Dice roll tumble
  6. Death/retreat
- **Voice:** None. NPC personality delivered through text and visual design only.

### Production Approach

- Assets sourced from free packs or AI-generated (2D only)
- CSS placeholders with colour coding ship first — core loop validated before art arrives
- Real assets dropped in as swappable files with no code changes required
- Audio implemented last — gameplay feel validated in silence first

---

## Risk Assessment

### Key Risks

| Risk | Likelihood | Impact | Priority |
|------|-----------|--------|----------|
| Scope creep — "just one more feature" | High | High | 🔴 Critical |
| Game balance — mana/combat numbers feeling wrong | High | Medium | 🟡 Medium |
| Solo dev motivation over long passion project | Medium | High | 🟡 Medium |
| Asset quality inconsistency across free packs | Medium | Low | 🟢 Low |
| PWA iOS quirks (audio, install prompt) | Medium | Medium | 🟡 Medium |

### Technical Challenges

- **Procedural dungeon generation** — needs to feel varied but fair. Smart parameter tuning is a non-trivial design and engineering problem.
- **Checkpoint system** — must be baked into dungeon generation from day one, not retrofitted.
- **Mana balance** — a pool system with no cooldowns requires careful tuning so neither hoarding nor spending feels dominant.
- **PWA audio on iOS** — Safari's autoplay restrictions require audio context resumed on first user touch. Known issue, known fix — implement early.
- **CSS 3D tile flip performance** — must hit 60fps on mid-range mobile. Test early on real devices.

### Market Risks

- Saturated mobile roguelike space — mitigated by free web distribution (no store competition, no install friction)
- Discoverability — mitigated by itch.io listing and organic sharing; not a primary concern for a passion project
- Genre expectations — players may expect more content than MVP delivers; manage via clear "early access" framing

### Mitigation Strategies

- **Scope:** Strict MVP definition. Anything not in the MVP list is a post-ship addition. New ideas go on a backlog, not into the build.
- **Balance:** Expose tuning values as a simple config object from day one. Adjust without code changes.
- **Motivation:** Ship playable milestones early and often. A working tile-flip grid with placeholder content is a win worth celebrating.
- **Assets:** Establish a consistent style guide before sourcing assets. One visual reference image (the dungeon floor image) as the north star.
- **PWA/iOS:** Test on real iPhone from the first week of development. Don't wait until the end.

---

## Success Criteria

### MVP Definition

A complete, playable single run containing:
- 5x5 grid dungeon (scaling to 6x6-7x7 on deeper floors)
- Tile reveal with CSS 3D flip animation
- Turn-based combat (enemy attacks first, player responds)
- Fast enemy variant (attacks on reveal)
- Mana pool with 3-5 starter spells for the first character
- ~5 enemy types with distinct behaviours
- Basic loot system (items with names and short descriptions)
- Hasty Retreat mechanic with checkpoint system
- XP gained per tile flipped; gold gained per enemy killed
- Simple permanent upgrade tree (5-8 nodes)
- HUD at bottom: health bar, mana pool, gold count
- LocalStorage save state
- PWA manifest + service worker for offline play

**Not in MVP (post-ship):**
- Goblin Merchant / dice NPC encounter
- Additional characters
- Run modifiers / difficulty selection
- Audio
- Real art assets (CSS placeholders ship first)
- Additional dungeon environments

### Success Metrics

**Primary:** Peter ships something he's proud of and enjoys playing himself.

**Secondary signals (not targets, just indicators):**
- Friends can pick it up without explanation
- At least one person finds it on itch.io and returns for a second session
- The core loop feels fun with placeholder assets — before any art or audio is added

### Launch Goals

- Publish to itch.io as a free PWA
- Shareable URL — no install required to play
- "Early access" framing — sets expectation of ongoing content

---

## Next Steps

### Immediate Actions

1. Set up Game2 project repo and PWA scaffold (manifest, service worker, index.html)
2. Build the grid renderer — 5x5 CSS grid with tile flip animation using placeholder colours
3. Implement tile reveal state machine (hidden → revealed)
4. Add basic combat loop with placeholder enemy stats
5. Validate the core loop is fun before adding anything else

### Research Needs

- Source 2-3 candidate free audio packs (dungeon ambient + SFX) for later integration
- Test CSS 3D tile flip performance on real iPhone/Android early
- Explore itch.io PWA game listings for framing and presentation reference

### Open Questions

- **Grid size:** 5x5 confirmed for MVP. Scale to 6x6/7x7 on deeper floors — validate through playtesting.
- **XP economy:** Tile flips grant XP; enemy kills grant gold. Exact values to be tuned in a balancing config object.
- **Permanent upgrade tree structure:** To be designed in GDD phase.
- **Run modifier system:** Post-MVP. Design in GDD, implement in v1.1.
- **Dungeon generation algorithm:** Decide between pure random, weighted random, or wave function collapse during GDD phase.

---

## Appendices

### A. Research Summary

Visual reference: Stylized cartoon top-down dungeon room — stone tile grid, warm amber torch glow, cool grey stone, scattered props. Source: AI-generated reference image used as north star for art direction.

### B. Stakeholder Input

Solo project — Peter is designer, developer, and primary player. No external stakeholders.

### C. References

- Dungelot: Shattered Lands (primary mechanical reference)
- Slice & Dice (run decision structure)
- Slay the Spire (build optimization loop)
- Solomon's Boneyard (character archetypes, mobile feel)
- Orb of Creation (meta-progression structure)

---

_This Game Brief serves as the foundational input for Game Design Document (GDD) creation._

_Next Steps: Use the `gds-create-gdd` workflow to create detailed game design documentation._
