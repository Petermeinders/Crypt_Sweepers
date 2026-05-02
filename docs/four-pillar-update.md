Pillar 1 — Choices Matter

 Current state: Heroes have unique passives (good). Level-up picks are weighted but largely additive (stat boost vs
 mastery).

 Proposal: Mutually Exclusive Mastery Paths
 Instead of a linear mastery tree per hero, give each hero 2 branching paths at Tier 2 and Tier 3. The player picks one
  path per tier and is locked out of the other for that run. Example for Warrior:
 - Tier 2A: Divine Shield (reduce incoming damage) vs Tier 2B: War Cry (boost outgoing damage)
 - Tier 3A: Atonement (heal on kill) vs Tier 3B: Reckless Strike (deal 50% more damage, take 25% more)

 This makes each level-up a genuine strategic decision with a lasting consequence, not just stat accumulation.
 
 Response: I like this! I want to be very meticulous about the upgrades are. I'm open to ideas but don't implement without getting it greenlit by me.


 ---
 Pillar 2 — Each Run Feels Unique

 Current state: 67 trinkets cover a lot of ground. Sub-floors and story events add variety but are somewhat predictable once the player knows the pool.

 Proposal: Floor Modifier (Curse/Boon)
 At the start of each floor, randomly apply one modifier from a small pool (5–8 options). Show the modifier to the
 player before they start flipping tiles. Examples:
 - Cursed Fog: All enemies have +2 HP this floor
 - Ancient Cache: Every 4th chest contains double gold
 - Haunted Ground: Trap tiles deal double damage but drop rare loot
 - Bloodmoon: Vampire deals +1 dmg; all other heroes take 1 extra dmg from enemies

Response: These are great ideas. We can discuss what the modifiers might be/look like. 


 Proposal: More Merged Trinkets
 Currently merged trinkets exist (js/data/items.js) but there are few. Add 8–12 more merged combinations from existing
 trinkets, especially cross-class synergies (Engineer + Scavenger, Ranger + Trapfinder). The merge discovery loop ("I
 wonder if these combine?") is intrinsically motivating.

Response: Yes we need more combinations. 

 ---
 Pillar 3 — Player Mastery Is Rewarded

 Current state: Meta unlocks (upgrades and hero masteries) create a good progression ramp. The learning curve around
 sub-floors and event choices could be more meaningful.
Response: Sub-floors need to be reworked. 

 Proposal: Codex / Enemy Glossary
 After killing an enemy type for the first time, unlock its stat card in a Codex (accessible from pause menu). Show HP,
  damage, behaviour type, and which heroes have bonuses vs it. This rewards experience — a veteran player plans around
 knowing enemy HP values, a new player discovers them organically.
 Response: This is already partially implemented with the bestiary. 

 Proposal: Floor Scouting Mechanic
 Add a rare tile or sub-floor reward that reveals the enemy layout of the next floor (like a map). Expert players will
 use this to plan their reveal order; new players will ignore it and still have fun. This also gives the Ranger's
 Trapfinder mastery a new layer — they can pre-route around traps they knew were coming.
 Response: I'm open to discussion about this. 

 ---
 Pillar 4 — Death Loop (Gold + XP Rework)

 Current state:
 - XP is always retained (death has no consequence for progression)
 - Gold is lost on death except safeGold checkpointed mid-run
 - Gold uses: 8 global passives (90–255g)
 - Gold income: coin tiles + Scavenger trinket + events

 The core tension: XP retention means players never feel set back. The safe gold mechanic creates some loss anxiety but not enough because the shop costs are fixed and eventually bought out.

 Proposed changes:

 A. Consumable Shop (Gold Sink Each Run)

 Add a per-run shop accessible between floors (or at shrines) selling consumables — single-use items that don't
 persist:
 - Health Potion (restore 15 HP) — 8 gold
 - Recall Scroll (skip current floor, advance safely) — 20 gold
 - Enchanted Whetstone (bonus damage this floor) — 12 gold

 This gives gold ongoing value throughout a run, not just between campaigns. It also makes the "push on vs. leave"
 decision richer: you might spend your last 12g on a whetstone and push, or save it as a potion fund.
 Response: Yes, let's discuss it. 

 B. XP Debt on Death (Optional Hard Mode)

 Add an opt-in mode (unlocked after first hero mastered): on death, lose 20% of your banked XP. This creates genuine
 stakes without being punishing to new players. The player chooses to engage with it.
 Resposne: I want to update this. Easy mode will retain all xp, normal will only retain 50%? on death. Hard mode only keep 10% on death

 C. Gold-for-Checkpoint Mechanic
 Reframe the safe gold system: instead of auto-checkpointing, let the player spend gold (e.g., 10–15g) at shrine tiles
 to "bank" their current run gold as safeGold. This makes the checkpoint a deliberate choice with a cost, which is more
  satisfying than an invisible auto-save.
  Response: This is a great idea. 