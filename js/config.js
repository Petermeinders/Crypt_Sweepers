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
    manaRegenPerTile: 1,
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
    manaCost: 3,
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
    /** Blinding Light stun turns: max(2, round(avgMelee × (this + blindingLightMasteryStacks/10))) — no damage */
    blindingLightStunMult: 0.25,
  },

  xp: {
    perTileReveal: 1,
    levelUpAt:     20,
    manaPerLevel:  5,
    manaOnLevelUp: 10,
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
  bossFloors: [5, 10, 15, 20, 25],

  /**
   * Full-screen dungeon backgrounds per floor range (theme segments after each boss).
   * First matching range wins; paths are relative to index.html.
   */
  floorThemeBackgrounds: [
    { min: 6, max: 10, image: 'assets/DungeonBackgroundJungle.png' },
  ],

  /** Rest / sanctuary floors between boss segments (path relative to index.html). */
  restSanctuaryBackground: 'assets/SanctuaryBackground.png',

  /** @param {number} floor */
  floorBackgroundFor(floor) {
    for (const t of this.floorThemeBackgrounds) {
      if (floor >= t.min && floor <= t.max) return t.image
    }
    return 'assets/DungeonBackground.png'
  },

  difficulty: {
    easy:   { damageTakenMult: 0.70, xpMult: 0.80, goldMult: 0.80, label: 'Easy'   },
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

  floorNames: [
    'The Shallow Dark',
    'The Forgotten Halls',
    'The Dripping Dark',
    'The Bone Corridor',
    'The Ancient Deep',
    'The Abyssal Dark',
    'The Sunken Crypts',
    'The Void Below',
    'The Eternal Night',
    'The Abyss',
  ],
}

// Player preferences — persisted via SaveManager
export const SETTINGS = {
  difficulty:  'normal',
  musicVolume: 0.5,
  sfxVolume:   0.8,
}
