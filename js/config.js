// ============================================================
// CONFIG — all tunable gameplay values
// SETTINGS — player preferences (overwritten by SaveManager on boot)
// ============================================================

export const CONFIG = {
  debug: false,

  grid: {
    // Base size — 5 wide × 6 tall (portrait-friendly). Scaling: see gridSize()
    cols: 5,
    rows: 6,
  },

  // Returns grid dimensions for a given floor number
  gridSize(floor, opts = {}) {
    if (opts.rest) return { cols: 3, rows: 3 }
    if (floor >= 10) return { cols: 7, rows: 7 }
    if (floor >= 7)  return { cols: 6, rows: 6 }
    return { cols: 5, rows: 6 }
  },

  player: {
    baseHP:          50,
    baseMana:        30,
    startGold:       0,
    baseDamage:      1,
    baseDefense:     [0, 0],
    /** Legacy: XP/tile reveal no longer restores mana — use manaPerMeleeHit in combat. */
    manaRegenPerTile: 0,
    manaPerMeleeHit:  1,
  },

  enemy: {
    damage:     [1, 1],        // fallback; most enemies use their own def
    fastDamage: [1, 2],
    goldDrop:   [1, 2],
    // Stat scaling per floor: each floor adds this fraction of base stats
    floorScaleHP:  0.10,       // +10% HP per floor
    floorScaleDmg: 0.05,       // +5% DMG per floor
  },

  spell: {
    manaCost: 4,
    damage:   [3, 5],
  },

  /**
   * Slot-A actives (Slam / Ricochet): damage scales with melee potency — the average
   * of the HUD damage range (same inputs as normal attacks: base + damageBonus).
   * Slam: mult = (round(slamPerTargetMult×10) + slamMasteryStacks) / 10 — integer tenths, no float drift.
   * Blinding Light: same multiplier pattern, but output is stun turns (no HP damage).
   * Mults are < 1 baseline so multi-hit / AOE does not outscale single-target melee.
   */
  ability: {
    slamPerTargetMult: 0.3,   // Slam: max(1, round(avgMelee × _slamMultFromStacks(stacks)))
    ricochetUnitMult:  0.5,   // unit = max(1, round(avgMelee × this)); shots 3×, 2×, 1× unit
    /** Triple Volley: max(1, round(avgMelee × this × rangerActiveStacks mult)) to each enemy in 3×3 */
    tripleVolleyHeroDamagePct: 0.5,
    /** Blinding Light stun turns: max(2, round(avgMelee × (this + blindingLightMasteryStacks/10))) — no damage */
    blindingLightStunMult: 0.25,
    /** Ranger Trapfinder: chance per qualifying hit (trap, fast reveal, ambush) to reduce damage by trapfinderStacks */
    trapfinderProcChance: 0.10,
  },

  xp: {
    perTileReveal: 1,
    levelUpAt:     20,
    manaPerLevel:  5,
    manaOnLevelUp: 10,
  },

  /**
   * Orthogonal-adjacent threat clue on revealed non-combat tiles: sum of living enemies'
   * threatLevel plus trapThreat for each neighboring trap (4 directions only, not diagonals).
   */
  threatClues: {
    enabled: true,
    /** Integer weight per adjacent trap tile (tuned vs CONFIG.trap.damage band). */
    trapThreat: 2,
  },

  retreat: {
    goldKeepPercent: 0.20,
  },

  checkpoint: {
    healPercent:  0.30,
    manaRestore:  5,
  },

  trap: {
    damage: [1, 3],
  },

  chest: {
    goldDrop: [2, 4],
  },

  heart: {
    maxHpBonus: 10,
    healAmount: 10,
  },

  // Boss floors cadence — boss appears on these floor numbers
  bossFloors: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],

  /** Enemy war banner — rare tile that buffs all foes on the floor until destroyed */
  warBanner: {
    /** Floor 1 always gets a banner; on deeper floors, this chance per non-boss dungeon floor */
    spawnChance: 0.2,
    /** Multiplier for enemy HP and damage while the banner stands */
    statMult: 1.25,
  },

  /** Dungeon Mouse — pre-revealed creature that unflips tiles when the player flips */
  mouse: {
    /** Floor 1 always gets a mouse; on deeper floors, this chance per non-boss dungeon floor */
    spawnChance: 0.10,
  },

  /** Treasure Goblin — rare pre-revealed 1 HP foe; drops a rare trinket if slain before its timer expires */
  treasureGoblin: {
    /** Per non-boss dungeon floor (excluding boss floors) */
    spawnChance: 0.05,
  },

  subFloor: {
    /** Probability a non-boss, non-sanctuary floor spawns one sub-floor entry tile */
    spawnChance: 0.05,
    /**
     * Type weights (must sum to 100).
     * mob_den      — 4×4, one enemy type, 1 chest
     * boss_vault   — 3×3, boss center locked, all-positive tiles on kill
     * treasure_vault — 3×3, 1 trap center, rest positive
     * shrine       — 3×3, choice room (no combat)
     * ambush       — 4×4, looks safe but all enemies
     * collapsed_tunnel — 1×6, all traps, stairs at both ends, chest at far end
     */
    typeWeights: {
      mob_den:              30,
      boss_vault:           22,
      treasure_vault:       18,
      shrine:               11,
      ambush:                5,
      collapsed_tunnel:      3,
      cartographers_cache:   7,
      toxic_gas:             4,
    },
    toxicGasDamagePerFlip: 2,
    shrine: {
      bloodSacrificeDmgBonus: 1,   // +N damage
      bloodSacrificeHpPct:    0.20, // cost: 20% max HP
      goldOfferingCost:       50,
      goldOfferingHpBonus:    5,
    },
  },

  /**
   * Biome definitions — one per theme segment.
   * id       : unique key used for CSS classes and asset filenames
   * label    : display name shown to the player
   * floors   : [min, max] inclusive floor range
   * image    : background asset path (relative to index.html)
   * floorTag : short subtitle shown on the floor HUD (e.g. "Floors 1–5")
   *
   * TODO — The Void: after completing floor 100 unlock a new game mode
   *   accessible from the main menu. The Void is an endless, escalating
   *   challenge with unique mechanics (reality-bending events, mirror
   *   enemies, inverted rules). Implement as a separate run type that
   *   never ends — track depth score on the meta-progression save.
   */
  biomes: [
    { id: 'dungeon',          label: 'Standard Dungeon', floors: [1,   5],  image: 'assets/DungeonBackground.png',               floorTag: 'Floors 1–5'   },
    { id: 'jungle',           label: 'Jungle Ruins',     floors: [6,  10],  image: 'assets/DungeonBackgroundJungle.png',          floorTag: 'Floors 6–10'  },
    { id: 'frozen-tundra',    label: 'Frozen Tundra',    floors: [11, 20],  image: 'assets/DungeonBackgroundFrozen.png',          floorTag: 'Floors 11–20' },
    { id: 'volcanic-cavern',  label: 'Volcanic Cavern',  floors: [21, 30],  image: 'assets/DungeonBackgroundVolcanic.png',        floorTag: 'Floors 21–30' },
    { id: 'catacombs',        label: 'Catacombs',        floors: [31, 40],  image: 'assets/DungeonBackgroundCatacombs.png',       floorTag: 'Floors 31–40' },
    { id: 'corrupted-forest', label: 'Corrupted Forest', floors: [41, 50],  image: 'assets/DungeonBackgroundCorrupted.png',       floorTag: 'Floors 41–50' },
    { id: 'sunken-temple',    label: 'Sunken Temple',    floors: [51, 60],  image: 'assets/DungeonBackgroundSunken.png',          floorTag: 'Floors 51–60' },
    { id: 'mushroom-grotto',  label: 'Mushroom Grotto',  floors: [61, 70],  image: 'assets/DungeonBackgroundMushroom.png',        floorTag: 'Floors 61–70' },
    { id: 'crystal-cavern',   label: 'Crystal Cavern',   floors: [71, 80],  image: 'assets/DungeonBackgroundCrystal.png',         floorTag: 'Floors 71–80' },
    { id: 'shadow-realm',     label: 'Shadow Realm',     floors: [81, 90],  image: 'assets/DungeonBackgroundShadow.png',          floorTag: 'Floors 81–90' },
    { id: 'infernal-pit',     label: 'Infernal Pit',     floors: [91, 100], image: 'assets/DungeonBackgroundInfernal.png',        floorTag: 'Floors 91–100'},
  ],

  /**
   * Full-screen dungeon backgrounds per floor range.
   * Derived automatically from biomes — kept for quick lookup.
   */
  get floorThemeBackgrounds() {
    return this.biomes.map(b => ({ min: b.floors[0], max: b.floors[1], image: b.image }))
  },

  /** Rest / sanctuary floors between boss segments (path relative to index.html). */
  restSanctuaryBackground: 'assets/SanctuaryBackground.png',

  /** @param {number} floor */
  floorBackgroundFor(floor) {
    for (const b of this.biomes) {
      if (floor >= b.floors[0] && floor <= b.floors[1]) return b.image
    }
    // Beyond floor 100 — stay in Infernal Pit until The Void is implemented
    return this.biomes[this.biomes.length - 1].image
  },

  /** @param {number} floor — returns the biome object for that floor */
  biomeFor(floor) {
    for (const b of this.biomes) {
      if (floor >= b.floors[0] && floor <= b.floors[1]) return b
    }
    return this.biomes[this.biomes.length - 1]
  },

  difficulty: {
    easy:   { damageTakenMult: 0.70, xpMult: 0.50, goldMult: 0.50, label: 'Easy'   },
    normal: { damageTakenMult: 1.00, xpMult: 1.00, goldMult: 1.00, label: 'Normal' },
    hard:   { damageTakenMult: 1.35, xpMult: 1.25, goldMult: 1.25, label: 'Hard'   },
  },

  // Goblin Merchant dice outcomes (d6)
  merchant: {
    dice: [
      { roll: [1, 1], icon: '💀', label: 'Cursed!',   effect: 'damage',     value: 3 },
      { roll: [2, 3], icon: '🪙', label: 'Fair Trade', effect: 'gold',       value: 4 },
      { roll: [4, 4], icon: '🧪', label: 'Healing!',   effect: 'heal',       value: 5 },
      { roll: [5, 5], icon: '🔮', label: 'Mana!',      effect: 'mana',       value: 5 },
      { roll: [6, 6], icon: '🎁', label: 'Jackpot!',   effect: 'gold',       value: 10 },
    ],
    cost: 2,    // gold cost to roll with the merchant
  },

  // Ranger character unlock cost (persistent gold)
  rangerUnlockCost: 20,

  // Legacy — kept for any code that still reads floorNames by index.
  // The source of truth for floor theming is now CONFIG.biomes.
  floorNames: [
    'The Shallow Dark',       // 1
    'The Forgotten Halls',    // 2
    'The Dripping Dark',      // 3
    'The Bone Corridor',      // 4
    'The Ancient Deep',       // 5
    'Jungle Ruins',           // 6
    'The Overgrown Path',     // 7
    'Temple of Thorns',       // 8
    'The Verdant Depths',     // 9
    'Heart of the Jungle',    // 10
  ],
}

// Player preferences — persisted via SaveManager
export const SETTINGS = {
  difficulty:  'normal',
  musicVolume: 0.5,
  sfxVolume:   0.8,
}
