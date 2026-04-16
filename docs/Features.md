Here is a summarized list of features and design direction for the game. Much of this is **live** in builds today; some items are **directional** and subject to heavy rebalance or future iteration.

---

## Design pillars (recent direction)

The game has been pushed in three overlapping directions:

1. **Harder** — Encounters, floor pressure, and hazards ask more of positioning and resource use.
2. **Meaningful choices** — Less autopilot: when to push, when to clear, how to spend mana and picks matters more.
3. **Unique discovery per hero** — Each hero is meant to *see* the dungeon differently so runs feel distinct, not just different stat sheets.

*All of the below numbers, proc rates, and ability wiring are expected to move as balance and feel are tuned.*

---

## Core gameplay & mechanics

* **Threat clues (Minesweeper-style):** Orthogonal threat totals show on revealed tiles so you can reason about nearby danger (and traps add to the count where configured).
* **Combat engagement:** Combat lock with clear feedback when you are committed to a fight.
* **Retreat:** Header retreat with confirmation to leave the dungeon run.
* **Status effects & debuffs:** Poison, burn, corruption, teary eyes (mana costs), freezing hit, and related systems.
* **The Forge:** Combine trinkets into merged items.
* **Magic chests & keys:** Dynamic gold by depth; golden keys to open special chests.
* **Run resumption:** Grid snapshots so ongoing runs can be resumed.

### Hero-specific discovery (feel unique per class)

* **Paladin — Sense Evil:** At least one unrevealed enemy on the floor can be marked with an echo-style hint. If that enemy is slain, another valid target can be marked when possible so the “lens” on danger keeps renewing.
* **Ranger — Keen Eyes:** On revealing a tile, a chance to sense the **category** of orthogonally adjacent hidden tiles (enemy / trap / loot-style buckets, etc.), stacking with other hint systems.
* **Mage — Phase Step (concept / WIP):** Intended direction — when it **activates**, half the time the Mage may **move diagonally** (exact rules and tuning TBD). *Subject to full redesign and rebalance.*

### Floor-wide pressure

* **War flags (War Banner):** A special tile can spawn that **buffs HP and damage of every living enemy** on the floor until the flag is destroyed—encouraging aggressive pathing to tear it down before the floor snowballs. Placement avoids critical specials where possible; teardown uses targeted updates so the rest of the board does not “replay” VFX. Saved runs reconcile flag coordinates with the grid.
* **Goblin Archer:** Spawns on **floor 1 always** and with a chance on **later non-boss dungeon floors**, replacing a random unrevealed enemy tile. It is revealed immediately and **harasses the player each turn** until dealt with—pushing fast movement, melee commitment, or spell/ability snipes.

### Spaces within spaces

* **Sub-floors (“floorception”):** Enterable pockets (mob dens, boss vaults, treasure rooms, shrines, ambushes, collapsed tunnels, and other variants) as a **floor inside the floor** with its own small grid and rules.

### Hazards & terrain

* **Open pits (holes):** Impassable like rubble, but **always visible** when placed—no flip required. Path around them like other blockers.

---

## Characters & abilities

* **Paladin (formerly Warrior):** Divine Light, Blinding Light, Slam, and the holy-warrior baseline tuned for melee commitment.
* **Ranger:** Ricochet, Triple Volley (3×3), Poison Arrow, **Trapfinder** mitigation, and **Keen Eyes** as above.
* **Engineer:** Turrets, upgrades, Tesla vs ballistic modes.

### Meta / progression direction (not final)

* **Active abilities in the level-up pool:** Directionally, **class actives may move into the pool of level-up choices** instead of being granted upfront, so a run **specializes in one or two** actives with some **RNG** on which upgrades appear—reducing “same loadout every time” and adding build variety. *Implementation and timing TBD.*

---

## Content & world

* **Bestiary:** Track and inspect encountered foes.
* **Trinket codex & inventory:** Codex tracking, pending item bar, items like Echo Charm and Spyglass.
* **Enemy roster:** Includes Frost Giant, Drowned Hulk, Mushroom Harvester, **Archer / Goblin Archer**, and others.
* **Events & shops:** Merchant, gambler-style events, triple chests, story beats.

---

## UI, UX & polish

* Hero carousel, How to Play, audio settings, haptics, floor banners, combat feedback.
* **Hero Passives** (hero select): Built-in passives such as Paladin **Sense Evil**, Ranger **Keen Eyes** + **Trapfinder**, described in the carousel—not to be confused with account-wide **Passive Upgrades** on the main menu.

---

## Technical & architecture

* Tests, PWA / service worker caching, event-driven UI patterns where appropriate.

---

## Disclaimer

Balance, proc rates (e.g. 50% on Keen Eyes or Phase Step), spawn rules (archer, flags), and whether actives come from level-ups or defaults **will change**. This document is a snapshot of intent and shipped features, not a contract for final numbers.
