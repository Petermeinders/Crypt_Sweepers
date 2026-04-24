# Crypt Sweepers — Changelog

A summary of features and changes added during development.

---

## UI / HUD

- **Warrior HUD Portrait** — Replaced static icon with animated GIFs that react to game state: idle, attack, hit, run, and death animations.
- **Main Menu Character Preview** — Hero idle GIF shown in character selection block. Character tabs include a small GIF for the Warrior.
- **Stat Display** — Cleaned up HP/mana/damage display. Damage shows as a single value rather than a range stretch. Text made larger and more readable.
- **Translucent Enemy Stat Pill** — Revealed enemy tiles show a small semi-transparent HP/DMG badge. Enemy names removed from tiles — identity conveyed by sprite alone.
- **6-Slot Action Grid** — HUD action bar expanded to a 2×3 grid of square slots that fill the full HUD height.
- **Backpack Button** — Moved to the key item column. Opens a 9-slot backpack modal.
- **Backpack Modal** — Grid of item slots. Occupied slots show the item sprite and a quantity badge for stackable items. Tap to use, hold to inspect.

---

## Combat & Enemies

- **Goblin Sprites** — Idle and strike animated GIFs for goblins and goblin_fast.
- **Ogre Idle GIF** — Programmatically generated from sprite sheet using Node.js + gif-encoder-2 (ping-pong animation).
- **Vine Witch** — Added as a floor 1 enemy with animated GIF.
- **Enemy Bob Removed** — CSS bob animation stripped; replaced by native sprite animations.
- **FireSwordSlash Effect** — GIF plays on the enemy tile when the player strikes.
- **Enemy HP Tracking** — Fixed bug where enemies died in one hit regardless of HP. Each enemy now tracks `currentHP` correctly.
- **Combat Busy Lock** — `_combatBusy` flag prevents overlapping combat actions from rapid tapping.
- **Fast Enemies** — Enemies with the `fast` attribute (goblins) deal a free ambush hit the moment they are revealed.
- **Killing Blow** — Fatal strikes skip the enemy counter-attack.
- **Spell targeting** — Existing spell system maintained; spell button removed from action panel in favour of HUD slots.

---

## Slam Ability

- **Slam** — Warrior active ability unlocked via the XP skill tree. Costs 10 mana. Deals 1 damage to every currently revealed living enemy simultaneously with a staggered hit animation.
- **HammerSlam Overlay** — Full-screen GIF animation plays over the dungeon grid when Slam is cast, fading out rapidly after completion.
- **Slam HUD Slot** — Wired to slot-A; only enabled if the ability has been unlocked.
- **Hold-to-Inspect on Ability Slots** — Long press (380ms) on the Slam button opens an info card describing the ability (mana cost, AOE, damage).

---

## Hold-to-Inspect Info Cards

- **Enemy Info Card** — Long press on a revealed enemy tile slides up a modal with the enemy sprite, name, type, HP/DMG stats, flavour blurb, and attribute tags (e.g. Fast).
- **Tile Info Cards** — Long press on any non-empty revealed tile (gold, chest, trap, merchant, camp, heart, exit) shows a contextual card.
- **Unrevealed Tile** — Long press on an unrevealed tile shows a mystery card.
- **Ability Info Card** — Long press on HUD ability slots shows card for that ability (reuses same modal).
- **Item Info Card** — Long press on backpack item slots shows the item card.
- **Pointer-events fix** — Info card no longer blocks clicks on tiles beneath it after dismissal.

---

## Chest System

- **Two-Tap Chest** — Revealing a chest no longer auto-collects loot. Chest stays active (tappable) until the player taps again to open it.
- **Collect Animation** — On open, the chest icon plays the coin-collect fly-up animation then disappears.
- **Loot Table** — Chest contains exactly one item: 30% Red Potion, 25% Mana Potion, 45% Gold (2–4).
- **Chest-Ready CSS** — Revealed chest tile re-enables pointer events via `.chest-ready` class.

---

## Item System

- **Item Registry** (`js/data/items.js`) — Central data file for all items. Each entry has name, sprite, stackable flag, blurb, detail rows, and an effect definition.
- **Red Potion** — Heals 5 missing HP. Stackable. Dropped from chests.
- **Mana Potion** — Restores 20 mana. Stackable. Dropped from chests.
- **Inventory** — `run.player.inventory` array tracks items across the run. Stackable items share a slot with a quantity badge.
- **Use Items** — Tap item in backpack to use. Guards against using at full HP/mana.

---

## Level-Up Rework

- **New Abilities** — Replaced all previous passive abilities with three simple repeatable picks:
  - ❤️ Vitality — +5 max HP, restore 5 now
  - 🔵 Arcane Reserve — +5 max mana, restore 5 now
  - 🪙 Scavenger — +10 gold immediately
- **Slower Levelling** — XP required to level up doubled (10 → 20 base, scales per level).
- **Fade-In Delay** — Level-up overlay fades in over 0.6s. Ability cards are pointer-locked for 650ms to prevent accidental picks from fast tappers.

---

## Tile System

- **Heart Tile** — Replaces the Shrine. Uses `heart.png` sprite. Grants +10 max HP and heals up to 10 HP. Extremely rare (~2% chance per floor). At most one per floor.
- **Camp (Checkpoint)** — Made rarer (~5% chance per floor). At most one per floor.
- **Rare Tile Cap** — Post-generation pass strips duplicate rare tiles and gates them behind a per-floor probability roll.
- **Starting Tile** — Now always an empty, already-revealed tile. Neighbouring tiles are marked reachable immediately (synchronously) on floor load.
- **Gold Coins** — Floor gold tiles now drop exactly 1 gold (was 1–2).
- **Camp Message** — Updated flavour text for camp discovery.

---

## Difficulty & Settings

- **Difficulty Cards** — Easy/Normal/Hard buttons replaced with stacked cards showing the actual stat modifiers (+/− damage taken, XP, gold multipliers).
- **Cheat Accordion** — Collapsible "Cheats" section in Settings with toggles for: God Mode (no damage), Instant Kill (enemies die in one hit), 999 Gold (injects gold into current run), 999 XP (injects XP into current run). Persisted to save.
- **Delete Save** — Button in Settings with a confirmation step. Clears save data and reloads the page.
- **Tile Colors Setting** — Toggle to colour-code revealed tiles by type.

---

## Death Screen

- **Killer Card** — When the player dies, the run summary now shows a card above "💀 Perished" identifying the enemy that dealt the killing blow: sprite, name, type, HP, damage, and flavour blurb.

---

## PWA / Install

- **iOS Install Support** — On iOS Safari (which never fires `beforeinstallprompt`), the install nudge now shows automatically with a manual guide: *"Tap Share → Add to Home Screen"*.
- **Android / Desktop** — Existing native prompt flow preserved.
- **Already Installed Check** — Nudge hidden if app is already running in standalone mode.

---

## Service Worker

- Cache version bumped incrementally (v1 → v14) as new assets were added.
- Precache list updated to include all monster GIFs, effect GIFs, item sprites, and new JS data files.

---

## Vampire Hero

- **Corrupted Blood** — Each tile flip costs 1 HP; each revealed living enemy on the floor returns 1 HP back (net: −1 + enemies visible). High risk / high reward — more monsters = faster recovery.
- **Dark Eyes** — Passive: each flip reveals category hints (enemy / item / hazard) on unreachable tiles, up to 12 hints per flip.
- **Sanctuary Fix** — Corrupted Blood is suppressed on the Sanctuary floor so the vampire doesn't bleed out while resting.

### Active Abilities (meta-unlocked, then picked at level-up)

- **Blood Tithe** `🩸` *(Slot A)* — Converts 10 HP into 10 mana. Cannot be used if it would kill the player. Mastery II reduces HP cost to 8; Mastery III drops it to 7 and raises mana gain to 11.
- **Mist Form** `🌫️` *(Slot B, 10 mana)* — Suspends Corrupted Blood for 5 tile flips: no HP drain per flip, but non-enemy tiles grant no blood either. Button badge counts down remaining flips. Pure protection mechanism.
- **Blood Pact** `⚖️` *(Slot C, 10 mana)* — Adds 1 HP to every revealed non-boss enemy, then equalizes all of them to the rounded group average. Keeps weak enemies alive longer (sustained draining) while cutting powerful enemies down to size. Bosses are immune.
