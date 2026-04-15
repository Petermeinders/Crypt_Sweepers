Here is a summarized list of the features and updates added to the game, organized by category for easier reading:

**Core Gameplay & Mechanics**
* **Threat Clues:** Added an orthogonal threat clue system to help players deduce nearby enemies and traps.
* **Combat Engagement:** Implemented "combat lock" mechanics with visual feedback so players know when they are committed to a fight.
* **Retreat System:** Added a retreat button in the header with a confirmation dialog to allow players to flee the dungeon.
* **Status Effects & Debuffs:** Introduced several new debuffs including Poison, Burn, Corruption, Teary Eyes (affects mana costs), and Freezing Hit. 
* **The Forge:** Added a new mechanic and overlay allowing players to combine trinkets into powerful merged items.
* **Magic Chests & Keys:** Magic Chests now dispense dynamic gold based on floor depth and require newly introduced Golden Keys to open.
* **Run Resumption:** Implemented grid snapshot functionality so players can resume active, ongoing runs.
* **War Banner:** Rare floor hazard that strengthens enemies until the banner tile is destroyed; tearing it down removes the stat buff from living enemies on the floor. Banner placement avoids special tiles (chests, hearts, gold, etc.), and loot fields are cleared when the banner replaces a cell. After loading a saved grid, banner coordinates are reconciled with the actual `war_banner` tile so resume state cannot point at the wrong cell. Destroying the banner always clears the **tapped** banner cell (not stale saved coordinates), preventing the wrong tile from turning empty or “coming back” as a chest.
* **War Banner — teardown visuals:** Tearing down the banner updates only that tile’s DOM instead of rebuilding the entire grid, so slain-enemy spirit effects and chest or coin tile animations do not replay board-wide.

**Characters & Abilities**
* **Palladin (formerly Warrior):** Renamed the Warrior class to Palladin. Added new abilities including *Divine Light* (smite and healing), *Blinding Light*, and *Slam*.
* **Ranger:** Introduced a suite of new abilities including *Triple Volley* (a 3x3 blast that replaced Arrow Barrage), *Poison Arrow*, and *Ricochet*. Added a passive/meta upgrade UI specific to the Ranger.
* **Engineer:** Introduced a brand-new character class with unique turret mechanics, allowing players to construct, upgrade, and activate "Tesla mode" for their turrets.

**Content & World Elements**
* **Bestiary:** Added a discovery and tracking system to view details on encountered enemies.
* **Trinket Codex & Inventory:** Implemented a Codex for tracking items and a "pending item bar" for better backpack management. Added new loot like the Echo Charm and Spyglass.
* **New Enemies:** Expanded the roster with the Frost Giant, Drowned Hulk, Mushroom Harvester, and **Archer Goblin** (ranged goblin with idle/attack sprites; spawns by replacing a random unrevealed enemy tile—guaranteed on floor 1, then a chance on later non-boss dungeon floors—not from the normal enemy spawn table).
* **Interactive Events:** Added a fully-fledged Merchant Shop interface, alongside new overlays for Gambler events, Triple Chests, and Story events. 

**UI, UX, & Polish**
* **Hero Selection:** Revamped the main menu with a Hero Carousel, featuring character previews and an integrated upgrade interface.
* **Tutorialization:** Added a comprehensive "How to Play" section explaining resources and mechanics.
* **Audio Overhaul:** Replaced old sound effects with MP3s, added crossfade transitions for music, and introduced an Audio Settings menu to toggle music and SFX.
* **Visual Feedback:** Added a floor banner to indicate the current level, blood effects, improved CSS animations for traps/ropes, and floating text for HUD stat increases.
* **Haptics:** Integrated vibration patterns/haptic feedback for damage events and combat interactions.
* **Rebranding:** Officially renamed the project from "Dungeon Sweepers" to "Crypt Sweepers".

**Technical & Architecture**
* **Testing Suite:** Integrated Playwright and added headless testing bots (`test-bot-ongoing`) to automate balance testing for player HP and combat behavior.
* **PWA Enhancements:** Added mobile web app capabilities, updated the manifest, and continuously refined the Service Worker (network-first HTML, robust asset caching).
* **Event-Driven UI:** Refactored inventory and audio management to use event emissions rather than direct UI updates for cleaner state handling.