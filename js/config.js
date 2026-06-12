// ============================================================
// CONFIG — all tunable gameplay values
// SETTINGS — player preferences (overwritten by SaveManager on boot)
// Floor difficulty: js/data/balance/floor-difficulty.json
// Void corruption: js/data/balance/void-corruption.json
// ============================================================

import { loadFloorDifficulty } from './data/balance/loadFloorDifficulty.js'
import { loadVoidCorruption } from './data/balance/loadVoidCorruption.js'

const _floorDifficulty = loadFloorDifficulty()
const _voidCorruption = loadVoidCorruption()

function _randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

export const CONFIG = {
  debug: false,

  grid: {
    minDim: 5,
    maxDim: 7,
    // Legacy defaults — used only when no run-scoped size is available (e.g. docs)
    cols: 5,
    rows: 6,
    /** Floors 1–N always use fixedCols × fixedRows; floor N+1+ rolls random per axis. */
    fixedSizeThroughFloor: 5,
    fixedCols: 5,
    fixedRows: 6,
  },

  /** Per-floor enemy tile density — see js/data/balance/floor-difficulty.json */
  enemyDensity: _floorDifficulty.enemyDensity,

  /** Random cols/rows in [grid.minDim, grid.maxDim] — independent per axis. */
  rollGridSize() {
    const { minDim, maxDim } = this.grid
    return {
      cols: _randInt(minDim, maxDim),
      rows: _randInt(minDim, maxDim),
    }
  },

  /** Dungeon grid size for a floor number (before run persistence). */
  gridSizeForFloor(floor) {
    const g = this.grid
    if (floor >= 1 && floor <= (g.fixedSizeThroughFloor ?? 0)) {
      return { cols: g.fixedCols ?? g.cols, rows: g.fixedRows ?? g.rows }
    }
    return this.rollGridSize()
  },

  /**
   * Grid dimensions for a floor. Rest sanctuary is always 3×3.
   * Pass explicit cols/rows, or a run with floorGridSizes populated via ensureFloorGridSize.
   */
  gridSize(floor, opts = {}) {
    if (opts.rest) return { cols: 3, rows: 3 }
    if (opts.cols != null && opts.rows != null) return { cols: opts.cols, rows: opts.rows }
    const stored = opts.run?.floorGridSizes?.[floor]
    if (stored) return stored
    return this.gridSizeForFloor(floor)
  },

  /**
   * Roll (once) and persist grid size for a floor on the active run.
   * @param {number} floor
   * @param {{ floorGridSizes?: Record<number, { cols: number, rows: number }> } | null} run
   */
  ensureFloorGridSize(floor, run, opts = {}) {
    if (opts.rest) return { cols: 3, rows: 3 }
    if (!run) return this.gridSizeForFloor(floor)
    run.floorGridSizes ??= {}
    if (!run.floorGridSizes[floor]) {
      run.floorGridSizes[floor] = this.gridSizeForFloor(floor)
    }
    return run.floorGridSizes[floor]
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
    ..._floorDifficulty.enemyScaling,
    leader: _floorDifficulty.enemyLeaders,
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
    /** Blinding Light stun turns: max(2, round(√avgMelee × (this + blindingLightMasteryStacks/10))) — no damage */
    blindingLightStunMult: 1.0,
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
    /** Per non-boss dungeon floor (boss floors & sanctuary excluded); floor 1 unchanged in FloorController */
    spawnChance: 0.15,
  },

  /** Treasure Goblin — rare pre-revealed 1 HP foe; drops a rare trinket if slain before its timer expires */
  treasureGoblin: {
    /** Per non-boss dungeon floor (excluding boss floors) */
    spawnChance: 0.05,
  },

  /** Pre-revealed archer; harasses each global turn until killed (see FloorController) */
  archerGoblin: {
    /** First floor that may roll spawnChance (floors 1–5 are archer-free). */
    minSpawnFloor: 6,
    spawnChance: 0.15,
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
    /** (experimental) When true, all subfloor entries launch the TD minigame instead of combat rooms */
    tdMode: false,
    tdCols: 6,
    tdRows: 6,
    /** ms delay between each hero step in simulation */
    tdHeroStepMs: 450,
    /** Hero HP = player.maxHp * this ratio */
    tdHeroHpRatio: 0.5,
    /** Minimum hero HP regardless of ratio */
    tdHeroHpMin: 10,
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
   * tileBacks: optional array of unrevealed tile back textures (random per tile)
   * tileBackBorderSlice: optional 9-slice inset (px) — border-image on tile backs
   * tileBackBorderRepeat: border-image-repeat (default 'round')
   *
   * TODO — The Void: after completing floor 100 unlock a new game mode
   *   accessible from the main menu. The Void is an endless, escalating
   *   challenge with unique mechanics (reality-bending events, mirror
   *   enemies, inverted rules). Implement as a separate run type that
   *   never ends — track depth score on the meta-progression save.
   */
  defaultTileBacks: [
    'assets/sprites/tiles/tile-unflipped2.1.png',
    'assets/sprites/tiles/tile-unflipped3.png',
  ],

  biomes: [
    { id: 'dungeon',          label: 'Standard Dungeon', floors: [1,   5],  image: 'assets/DungeonBackground.png',               floorTag: 'Floors 1–5'   },
    { id: 'jungle',           label: 'Jungle Ruins',     floors: [6,  10],  image: 'assets/DungeonBackgroundJungle.png',          floorTag: 'Floors 6–10',
      tileBacks: [
        'assets/sprites/tiles/jungle-tile-back-1.png',
        'assets/sprites/tiles/jungle-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'frozen-tundra',    label: 'Frozen Tundra',    floors: [11, 20],  image: 'assets/DungeonBackgroundFrozen.png',          floorTag: 'Floors 11–20',
      tileBacks: [
        'assets/sprites/tiles/frozen-tile-back-1.png',
        'assets/sprites/tiles/frozen-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'volcanic-cavern',  label: 'Volcanic Cavern',  floors: [21, 30],  image: 'assets/DungeonBackgroundVolcanic.png',        floorTag: 'Floors 21–30',
      tileBacks: [
        'assets/sprites/tiles/volcanic-tile-back-1.png',
        'assets/sprites/tiles/volcanic-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'catacombs',        label: 'Catacombs',        floors: [31, 40],  image: 'assets/DungeonBackgroundCatacombs.png',       floorTag: 'Floors 31–40',
      tileBacks: [
        'assets/sprites/tiles/catacombs-tile-back-1.png',
        'assets/sprites/tiles/catacombs-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'corrupted-forest', label: 'Corrupted Forest', floors: [41, 50],  image: 'assets/DungeonBackgroundCorrupted.png',       floorTag: 'Floors 41–50',
      tileBacks: [
        'assets/sprites/tiles/corrupted-forest-tile-back-1.png',
        'assets/sprites/tiles/corrupted-forest-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'sunken-temple',    label: 'Sunken Temple',    floors: [51, 60],  image: 'assets/DungeonBackgroundSunken.png',          floorTag: 'Floors 51–60',
      tileBacks: [
        'assets/sprites/tiles/sunken-temple-tile-back-1.png',
        'assets/sprites/tiles/sunken-temple-tile-back-2.png',
        'assets/sprites/tiles/sunken-temple-tile-back-3.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'mushroom-grotto',  label: 'Mushroom Grotto',  floors: [61, 70],  image: 'assets/DungeonBackgroundMushroom.png',        floorTag: 'Floors 61–70',
      tileBacks: [
        'assets/sprites/tiles/mushroom-grotto-tile-back-1.png',
        'assets/sprites/tiles/mushroom-grotto-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'crystal-cavern',   label: 'Crystal Cavern',   floors: [71, 80],  image: 'assets/DungeonBackgroundCrystal.png',         floorTag: 'Floors 71–80',
      tileBacks: [
        'assets/sprites/tiles/crystal-tile-back-1.png',
        'assets/sprites/tiles/crystal-tile-back-2.png',
        'assets/sprites/tiles/crystal-tile-back-3.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'shadow-realm',     label: 'Shadow Realm',     floors: [81, 90],  image: 'assets/DungeonBackgroundShadow.png',          floorTag: 'Floors 81–90',
      tileBacks: [
        'assets/sprites/tiles/shadow-tile-back-1.png',
        'assets/sprites/tiles/shadow-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
    { id: 'infernal-pit',     label: 'Infernal Pit',     floors: [91, 100], image: 'assets/DungeonBackgroundInfernal.png',        floorTag: 'Floors 91–100',
      tileBacks: [
        'assets/sprites/tiles/infernal-pit-tile-back-1.png',
        'assets/sprites/tiles/infernal-pit-tile-back-2.png',
      ],
      tileBackBorderSlice: 30,
      tileBackBorderRepeat: 'round',
    },
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

  /** @param {number} floor — display name for the biome segment (constant within each biome) */
  floorLabelFor(floor) {
    return this.biomeFor(floor).label
  },

  /** Highest playable floor (last biome max). */
  get maxFloor() {
    return this.biomes[this.biomes.length - 1].floors[1]
  },

  /** @param {number} floor — returns the biome object for that floor */
  biomeFor(floor) {
    for (const b of this.biomes) {
      if (floor >= b.floors[0] && floor <= b.floors[1]) return b
    }
    return this.biomes[this.biomes.length - 1]
  },

  tileBacksFor(floor, opts = {}) {
    if (opts.isVoidTrial) return this.void.tileBacks
    return this.biomeFor(floor).tileBacks ?? this.defaultTileBacks
  },

  tileBackBorderFor(floor) {
    const biome = this.biomeFor(floor)
    if (biome.tileBackBorderSlice == null) return null
    return {
      slice: biome.tileBackBorderSlice,
      repeat: biome.tileBackBorderRepeat ?? 'round',
    }
  },

  armor: {
    negationCap: 0.45,
  },

  blacksmith: {
    // upgradeCosts[tier][upgradeNumber] — upgradeNumber is 1, 2, or 3
    upgradeCosts: {
      common:    { 1: { gold: 10,  scrap: 5,   rate: 1.00 },
                   2: { gold: 20,  scrap: 10,  rate: 0.95 },
                   3: { gold: 30,  scrap: 20,  rate: 0.85 } },
      rare:      { 1: { gold: 30,  scrap: 15,  rate: 1.00 },
                   2: { gold: 40,  scrap: 30,  rate: 0.85 },
                   3: { gold: 60,  scrap: 60,  rate: 0.70 } },
      epic:      { 1: { gold: 60,  scrap: 30,  rate: 1.00 },
                   2: { gold: 90,  scrap: 60,  rate: 0.85 },
                   3: { gold: 150, scrap: 90,  rate: 0.75 } },
      legendary: { 1: { gold: 200, scrap: 90,  rate: 0.95 },
                   2: { gold: 400, scrap: 200, rate: 0.85 },
                   3: { gold: 600, scrap: 400, rate: 0.70 } },
    },
    // Scrap yield range when disassembling a piece [min, max]
    scrapYield: {
      common:    [3,  5],
      rare:      [10, 18],
      epic:      [25, 40],
      legendary: [60, 100],
    },
    // Fixed scrap yield when trashing gear from the in-run inventory
    trashScrapYield: {
      common:    1,
      rare:      5,
      epic:      10,
      legendary: 30,
      void:      50,
    },
    // Fixed scrap when dropping/trashing passive trinkets (by item rarity)
    trinketTrashScrapYield: {
      rare:      2,
      epic:      5,
      legendary: 10,
      merged:    30,
    },
    // Run gold when dropping/trashing passive trinkets (by item rarity)
    trinketTrashGoldYield: {
      common: 1,
    },
    // Cost per post-T3 detriment reduction application (placeholder = T3 cost)
    detrimentReduceCost: {
      common:    { gold: 30,  scrap: 20  },
      rare:      { gold: 60,  scrap: 60  },
      epic:      { gold: 150, scrap: 90  },
      legendary: { gold: 600, scrap: 400 },
    },
  },

  gear: {
    statRanges: {
      // Primary stats — each tier's lo overlaps the tier below (floor scale widens gaps deep).
      damageBonus:     { common: [1, 4],    rare: [2, 7],    epic: [1, 11],   legendary: [3, 17]  },
      maxHpPct:        { common: [5, 14],   rare: [8, 24],   epic: [10, 36],  legendary: [16, 52] },
      negation:        { common: [0.005, 0.020], rare: [0.010, 0.030], epic: [0.020, 0.045], legendary: [0.030, 0.060] },
      // Secondary stats
      maxManaPct:      { common: [4, 10],   rare: [6, 18],   epic: [8, 26],   legendary: [14, 42] },
      damageReduction: { epic: [1, 2],      legendary: [1, 3] },
      abilityPower:    { common: [1, 2],    rare: [1, 3],    epic: [2, 4],    legendary: [2, 5]   },
      // Detriment range sources (rolled negative; low end overlaps = milder bad rolls on high tiers)
      brittleArmor:    { common: [1, 4],    rare: [1, 7],    epic: [1, 10],   legendary: [3, 12]  },
      barbedGear:      { common: [1, 6],    rare: [1, 9],    epic: [2, 14],   legendary: [4, 18]  },
      manaDrain:       { common: [3, 6],    rare: [3, 9],    epic: [4, 12],   legendary: [6, 16]  },
    },
    levelDropTables: {
      '1-20':   { common: 80, rare: 15, epic: 4,  legendary: 1  },
      '21-40':  { common: 60, rare: 25, epic: 12, legendary: 3  },
      '41-60':  { common: 40, rare: 35, epic: 20, legendary: 5  },
      '61-100': { common: 30, rare: 38, epic: 25, legendary: 7  },
    },
    /** Chance a normal (non-boss) enemy kill drops a gear piece. Boss drops are always 100%. */
    enemyDropChance: 0.05,
    /** Chance a normal enemy kill drops a random potion (independent of gear roll). */
    enemyPotionDropChance: 0.10,
    /**
     * Stat-band multiplier at drop time — applies to all tiers and detriment rolls.
     * F10 ≈ 1.23×, F80 ≈ 3.28× vs F1 baseline (~2.7× common primary stats F80 vs F10).
     */
    floorMult(floor) {
      const f = Math.max(1, Math.floor(Number(floor) || 1))
      if (f <= 20) return 1 + (f - 1) * 0.025
      if (f <= 40) return 1.475 + (f - 20) * 0.03
      if (f <= 60) return 2.075 + (f - 40) * 0.035
      return 2.775 + (f - 60) * 0.025
    },
  },

  difficulty: {
    easy:   { damageTakenMult: 0.70, xpMult: 0.50, goldMult: 0.50, label: 'Easy',   xpDeathRetain: 1.0 },
    normal: { damageTakenMult: 1.00, xpMult: 1.00, goldMult: 1.00, label: 'Normal', xpDeathRetain: 0.5 },
    hard:   { damageTakenMult: 1.35, xpMult: 1.25, goldMult: 1.25, label: 'Hard',   xpDeathRetain: 0.1 },
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

  // Character unlock costs (persistent gold)
  rangerUnlockCost:    100,
  mageUnlockCost:      200,
  vampireUnlockCost:   300,
  engineerUnlockCost:     400,
  necromancerUnlockCost:  500,
  ninjaUnlockCost:        600,

  /** Epic 12 — The Void (see docs/epics/the-void/implementation-decisions.md) */
  void: {
    /** Full-screen background during void trial dungeon floors (not trial selection UI). */
    floorBackground: 'assets/ui/void/void-floor-background.png',
    /** Unrevealed tile backs — one picked at random per tile on void dungeon floors. */
    tileBacks: [
      'assets/sprites/tiles/void-tile-back-1.png',
      'assets/sprites/tiles/void-tile-back-2.png',
      'assets/sprites/tiles/void-tile-back-3.png',
      'assets/sprites/tiles/void-tile-back-4.png',
    ],
    /** Void trial floor 1 uses main-game enemy scaling at this depth; each void floor adds +1. */
    enemyBaseFloor: _floorDifficulty.voidTrial.enemyBaseFloor,
    /** Main-game boss floor that awards the first Void Pearl (once per account). */
    pearlAwardFloor: 50,
    /** Pearls granted on first floor-100 completion (main game). */
    floor100PearlReward: 2,
    merchantPearlChance: 0.01,
    merchantPearlPrice: 1000,
    trashScrapVoid: 50,
    completionVoidChance: { 1: 0.2, 2: 0.3, 3: 0.4 },
    /** Multiplier on positive rolled stats for completion gear */
    completionPositiveStatMult: { 1: 1.1, 2: 1.2, 3: 1.3 },
    /** Floor depth used when rolling completion gear stat bands */
    completionStatFloor: 95,
    trials: {
      1: {
        id: 1,
        name: 'Ashen Passage',
        enemyStatMult: 1.5,
        lootMult: 1.25,
        maxFloor: 20,
        flavor: 'A warm-up; still punishing.',
      },
      2: {
        id: 2,
        name: 'Hollow Threshold',
        enemyStatMult: 2.0,
        lootMult: 1.5,
        maxFloor: 30,
        flavor: 'The punishing challenge.',
      },
      3: {
        id: 3,
        name: 'Unmaking Void',
        enemyStatMult: 2.5,
        lootMult: 1.75,
        maxFloor: 50,
        flavor: 'Near-impossible without strong gear.',
      },
    },
    corruption: _voidCorruption,
  },
}

// Player preferences — persisted via SaveManager
export const SETTINGS = {
  difficulty:  'normal',
  childMode:   false,
  musicVolume: 0.5,
  sfxVolume:   0.8,
}
