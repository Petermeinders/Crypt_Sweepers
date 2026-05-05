# Four-Pillar Update — BMAD Stories

Each pillar is a self-contained epic with user stories ready for independent implementation. Items marked **[DISCUSS]** need design sign-off before coding begins.

---

## Epic A: Choices Matter — Branching Mastery Paths

### Goal
Give each hero's abilities two divergent upgrade paths that the player unlocks in the meta menu and chooses between during a run. Each branch changes *how* the ability works — not just its numbers — so the choice reflects a playstyle commitment, not a power comparison.

### Design Rules

1. **Per-ability, not per-tier.** Each base ability (Slam, Blinding Light, Divine Light, etc.) has exactly two named branch paths. Base abilities stay linear.
2. **Meta unlock gates in-run availability.** Branch paths are unlocked in the hero upgrade menu just like any other mastery. A branch only appears in the level-up pool if the player has unlocked it in the meta.
3. **Branches appear after the base ability.** A branch path can only be offered in a level-up if the player has already chosen the base ability in the current run.
4. **One path per ability per run.** Once the player picks Branch A for Slam, Branch B is removed from that run's offer pool for the rest of the run. If only one branch is unlocked in the meta, only that one can appear.
5. **Branches can be multi-level.** A branch path may have 1–3 upgrade tiers of its own (e.g., Slam: Thunderclap I → II → III), each unlockable and purchasable separately in the meta menu.
6. **Each hero is its own story.** Branch design is greenlit per hero before implementation. Heroes are tackled in order: Paladin → Mage → Ranger → Engineer → Vampire → Necromancer.

### Meta Menu Flow (per branch upgrade)
```
Hero Select → [Hero Name] Upgrades
  └─ Slam                        [unlocked / cost X XP]
       ├─ Branch A: Thunderclap  [unlocked / cost Y XP]  ← shows once Slam is unlocked
       │    ├─ Thunderclap I     [unlocked / cost Y XP]
       │    ├─ Thunderclap II    [locked   / cost Z XP]
       │    └─ Thunderclap III   [locked   / cost Z XP]
       └─ Branch B: Cleave       [locked   / cost Y XP]  ← shows once Slam is unlocked
            ├─ Cleave I          [locked   / cost Y XP]
            ├─ Cleave II         [locked   / cost Z XP]
            └─ Cleave III        [locked   / cost Z XP]
```

### In-Run Level-Up Flow
```
Player levels up →
  If Slam not yet chosen:    offer Slam (base)
  If Slam chosen, branch not yet chosen:
    offer Branch A (if meta-unlocked) and/or Branch B (if meta-unlocked)
  If Branch A chosen:        offer Thunderclap II, Thunderclap III (if meta-unlocked)
    Branch B is excluded for the rest of this run
```

### Scope

**Includes:**
- Branch path definitions in each hero's ability data file (`conflictsWith` reference, `requiresBranch` prerequisite chain)
- Level-up pool logic respects branch exclusivity within a run
- Meta upgrade menu shows branches nested under their parent ability, unlockable independently
- Each hero's branches designed and greenlit before coding
- Paladin is the first hero implemented (replaces all "warrior" references throughout the codebase)

**Excludes:**
- Changes to base ability behavior (Slam, Blinding Light, Divine Light remain unchanged until a branch is chosen)
- Changes to stat pick options (HP, mana, damage up) — those stay in the pool
- New abilities that don't already exist — branches modify existing mechanics

### Hero Implementation Order
| Hero | Status |
|------|--------|
| Paladin | In progress — Slam paths next |
| Mage | Pending design |
| Ranger | Pending design |
| Engineer | Pending design |
| Vampire | Pending design |
| Necromancer | Pending design |

### Stories

- As a player, after I unlock a branch in the meta I can choose it during a run level-up so meta investment shapes my in-run options
- As a player, once I choose Branch A for an ability, Branch B is no longer offered that run so each path is a real fork, not a menu
- As a player, each branch path is described clearly at level-up time (what it changes, not just numbers) so I can choose based on strategy not luck
- As a player, I can unlock both branches for an ability in the meta and choose between them each run so replayability grows with investment
- As a developer, branch paths in ability data include `conflictsWith: 'branch-id'` and `requiresBase: 'ability-id'` so the level-up pool system can enforce rules without hero-specific code
- As a developer, chosen branches are stored in `run.chosenBranches` (a map of `abilityId → branchId`) so exclusivity is enforced in a single lookup during pool assembly

---

## Epic B: Each Run Feels Unique — Floor Modifiers

### Goal
Apply one randomly chosen modifier to each floor, shown to the player before they start revealing tiles. Modifiers are stat patches — no new tile types required.

### Scope

**Includes:**
- Modifier pool of 5–8 entries **[DISCUSS — exact list below for sign-off]**
- Modifier displayed in the floor transition / pre-floor UI before the first tile flip
- Modifier applied at floor start and cleared at floor end
- Modifiers affect existing systems only (enemy HP, loot quantity, trap damage, etc.)
- Modifier icon + name + one-line description shown in HUD during the floor

**Excludes:**
- Permanent modifiers that carry between floors
- Modifiers that add new tile types or new enemies
- Stacking multiple modifiers on one floor (one per floor for MVP)

### Proposed Modifier Pool **[DISCUSS]**

| Name | Effect |
|------|--------|
| Cursed Fog | All enemies on this floor have +2 HP |
| Ancient Cache | Chests on this floor contain double gold |
| Haunted Ground | Traps deal double damage but guarantee a trinket drop |
| Bloodmoon | Vampire: +1 dmg this floor. All other heroes: take +1 dmg from every enemy attack |
| Ember Floor | All enemies have Burn status from turn 1 |
| Warded Dungeon | The exit tile is locked until at least 60% of tiles are revealed |
| Enriched Vein | Every coin tile is worth 2× gold |
| Silence | No abilities can be cast this floor (mana costs are waived; abilities are simply unavailable) |

### Stories

- As a player, I see the floor modifier before I flip my first tile so I can factor it into my reveal order
- As a player, the modifier name and effect are visible in the HUD while I explore so I don't forget what's active
- As a player, each floor has at most one modifier so the rules stay legible
- As a player, some modifiers create danger (Cursed Fog, Bloodmoon) while others create opportunity (Ancient Cache, Enriched Vein) so the variety feels meaningful rather than purely punishing
- As a developer, a `FloorModifier` system applies its effect at floor start via the existing enemy stats and tile configuration so no new tile types are needed
- As a developer, the modifier is seeded from the floor RNG so the same seed produces the same modifier (reproducible for bug reports)

---

## Epic C: Each Run Feels Unique — Merged Trinket Expansion

### Goal
Add 8–12 new merged trinket combinations to the existing forge system, focusing on cross-class synergies and high-discovery appeal.

### Scope

**Includes:**
- 8–12 new merged trinket entries in `js/data/items.js`
- Combinations drawn from existing Common and Rare trinkets already in the pool
- At least 3 cross-class synergy merges (e.g., Engineer + Scavenger, Ranger + Trapfinder)
- Each merged trinket has a distinct name, flavour description, and combined effect

**Excludes:**
- New base (non-merged) trinkets
- UI changes to the forge — existing merge UI is reused
- New trinket rarity tier

### Candidate Merge Pairs **[DISCUSS — confirm combinations before implementation]**

| Component A | Component B | Merged Name (draft) | Draft Effect |
|-------------|-------------|---------------------|--------------|
| Scavenger's Pouch | Turret Schematic | Salvage Engine | Turret kills drop +1 gold |
| Trapfinder's Kit | Keen Eye Lens | Cartographer's Intuition | Traps revealed at floor start; Keen Eyes triggers on every reveal |
| Blood Vial | Bone Dust | Necrotic Ichor | +2 dmg vs undead; heal 1 HP on undead kill |
| Lucky Coin | Gold Magnet | Gilded Fortune | Double coin tile value; 15% chance any enemy drops 1 gold |
| Mana Crystal | Spell Scroll | Arcane Codex | Mana costs –1 (min 1); Chain Lightning bounces +1 time |
| Iron Skin | Spiked Pauldron | Fortress Plate | –1 dmg taken (min 1); deal 1 dmg back to melee attackers |
| Poison Gland | Smoke Bomb | Toxic Cloud | Flee no longer costs HP; enemies take 2 poison dmg when you flee |
| Dark Eye | Kill Echo Rune | Hunter's Focus | Kill Echo mark range +1 tile; Dark Eye reveals 2 extra tiles |

### Stories

- As a player, I can discover new trinket combinations by experimenting in the forge so that each run has a "what if I combine these?" moment
- As a player, each new merged trinket has a thematic name and clear description so the effect is immediately understandable
- As a player, cross-class synergy merges (e.g., Engineer + Trapfinder parts) reward playing a hero deeply so mastery is reflected in loot decisions
- As a developer, new merged trinkets are data-only additions to `js/data/items.js` with `type: 'merged'` and a `components: []` array so no system code changes are required

---

## Epic D: Player Mastery Rewarded — Sub-Floor Rework

### Goal
Rework sub-floors so each type has a distinct identity, meaningful decision points, and clearer reward/risk communication. Currently sub-floors feel like speed bumps rather than meaningful moments. **[DISCUSS — full sub-floor rework scope TBD]**

### Scope **[DISCUSS]**

**High-level directions to discuss:**
- Each sub-floor type should communicate its risk and reward before the player commits to entering
- Some sub-floor types should be skippable (player chooses not to enter) with a visible trade-off
- Boss vault and treasure vault should feel like high-risk, high-reward events, not mandatory detours
- Shrine sub-floors should present a choice (e.g., two different boons, pick one)
- Ambush sub-floors should have an escape route so they aren't just a damage tax

**Excludes (until design is locked):**
- New sub-floor types
- Sub-floor tile set changes

### Stories **[PLACEHOLDERS — to be detailed after design discussion]**

- As a player, I can see what type of sub-floor I'm about to enter before I commit so the decision is informed
- As a player, I can choose to skip optional sub-floors so avoidance is a legitimate strategy
- As a player, shrine sub-floors offer two distinct boons so I make a meaningful choice rather than just receiving a reward
- As a player, ambush sub-floors have a visible retreat tile so I'm not trapped
- As a player, treasure vault sub-floors have higher-tier loot than normal chests so deep exploration feels rewarded
- As a developer, sub-floor entry shows a preview banner (type + risk level) before the grid is rendered so the player has information before committing

---

## Epic E: Death Loop — Difficulty XP Retention

### Goal
Replace the current always-retain-XP system with a difficulty-gated XP retention model that gives death consequences to players who want them.

### Scope

**Includes:**
- Three difficulty tiers: Easy / Normal / Hard (selectable at run start, locked in for the run)
- Easy: 100% XP retained on death (current behaviour)
- Normal: 50% of banked XP retained on death
- Hard: 10% of banked XP retained on death
- Difficulty selection screen updated to clearly explain XP retention rates before the player commits
- Run summary screen shows XP earned, XP retained, and XP lost
- Difficulty setting persisted per save (last used), not locked globally

**Excludes:**
- Separate difficulty for gold retention (covered in Epic F)
- Separate leaderboards per difficulty (post-MVP)
- Achievements tied to difficulty (post-MVP)

### Stories

- As a player, I can select Easy, Normal, or Hard before each run so the challenge matches my preference
- As a player, I can see the XP retention rate for each difficulty before I choose so I know the stakes
- As a player, on Easy I retain all XP on death so new players are never set back by a bad run
- As a player, on Normal I retain 50% of banked XP on death so dying has a consequence I can recover from
- As a player, on Hard I retain only 10% of banked XP on death so death is a serious setback that rewards careful play
- As a player, my run summary shows exactly how much XP I earned, how much I'm keeping, and how much was lost so the consequence feels fair and visible
- As a developer, XP loss on death is calculated from `run.xpEarned` at the moment of death and subtracted from persistent XP in `SaveManager` so the formula is auditable

---

## Epic F: Death Loop — Gold Checkpoint at Shrines

### Goal
Replace the automatic safe-gold checkpoint with a deliberate, paid banking action available at shrine tiles. The player spends gold to protect gold — a meaningful tension.

### Scope

**Includes:**
- Shrine tiles gain a "Bank Gold" action: spend 10–15g (configurable) to convert current run gold to safeGold
- The cost scales with the amount banked: a small flat fee (not a percentage, to avoid feel-bad on large windfalls) **[DISCUSS cost tuning]**
- Player can bank multiple times per run (each visit to any shrine)
- If player retreats or dies without banking, only previously banked gold survives
- HUD shows current run gold vs safeGold so the split is always visible
- Existing auto-checkpoint behaviour removed

**Excludes:**
- Banking gold at non-shrine tiles
- Per-run banking limits

### Stories

- As a player, I can visit a shrine to bank my current gold for a small fee so protecting my gold is a deliberate choice
- As a player, the banking fee is visible before I confirm so there are no surprises
- As a player, I can see my banked gold vs run gold in the HUD at all times so I always know my exposure
- As a player, if I die or retreat without banking my run gold is lost so every floor push beyond a shrine carries genuine risk
- As a player, I can bank multiple times across different shrine visits so deep runners can manage gold across floors
- As a developer, `run.safeGold` is updated immediately on bank confirmation and written to the save so a crash between bank and death doesn't lose the player's banked gold

---

## Epic G: Death Loop — Per-Run Consumable Shop

### Goal
Add a consumable shop accessible at shrines (or a dedicated shop sub-floor) selling single-use items that spend run gold and don't persist after the run. This gives gold ongoing in-run utility.

### Scope

**Includes:**
- Shop UI on shrine tiles (alongside Bank Gold action) **[DISCUSS — or a separate shop tile type?]**
- Initial consumable roster **[DISCUSS — see candidates below]**
- Items are single-use, affect the current run only, and are not added to the trinket inventory
- Shop stock is randomized each shrine visit (2–3 items from the pool)
- Items purchased immediately apply or are held in a consumable slot

**Excludes:**
- Persistent consumables that carry between runs
- Hero-specific consumable variants (post-MVP)

### Candidate Consumables **[DISCUSS]**

| Name | Effect | Cost |
|------|--------|------|
| Health Potion | Restore 15 HP | 8g |
| Mana Draught | Restore 20 mana | 6g |
| Enchanted Whetstone | +1 dmg for this floor | 12g |
| Scroll of Recall | Advance to next floor safely (no enemies triggered) | 20g |
| Smoke Pellet | Next flee costs 0 HP | 10g |
| Reinforced Bandage | Block the next 5 HP of incoming damage | 9g |

### Stories

- As a player, I can visit a shrine and spend gold on single-use consumables so gold has ongoing in-run value
- As a player, the shrine shop shows 2–3 randomly selected consumables each visit so the shop feels varied
- As a player, consumable prices are visible before I buy so I can weigh spending vs banking
- As a player, consumables take effect immediately (healing) or are held for manual use (Whetstone, Smoke Pellet) so the interaction is intuitive
- As a player, consumables do not appear in my trinket inventory so there's no confusion between permanent trinkets and single-use items
- As a developer, consumable effects are applied through the existing stat/combat hooks in `GameController` so no parallel item system is needed
