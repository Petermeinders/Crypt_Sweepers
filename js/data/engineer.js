// Engineer — XP tree and base stats. Apply logic lives in MetaProgression / GameController.

export const ENGINEER_BASE = {
  hp:     40,
  mana:   40,
  /** Melee damage: same model as warrior (fixed base + bonus). */
  damage: 1,
}

/** Turret tier stats (level 1–3). */
export const ENGINEER_TURRET = {
  maxHpByLevel: [5, 10, 15],
  damageByLevel: [1, 2, 3],
  /** Tesla: Manhattan distance from turret tile to target. */
  teslaRadiusByLevel: [1, 2, 3],
}

export const ENGINEER_UPGRADES = {
  'construct-turret': {
    name:     'Construct / Upgrade Turret',
    desc:     'Active: tap an empty tile twice to build or relocate (level 1). Tap your turret once to upgrade. Absorbs enemy strikes while alive. Costs 10 mana.',
    icon:     '🏗️',
    xpCost:   50,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'construct-turret' },
  },
  'tesla-tower': {
    name:     'Tesla Tower',
    desc:     'After a turret exists: spend 10 mana to convert it to a Tesla tower (one-way). Strikes enemies revealed or fought within its perimeter; radius grows with turret level.',
    icon:     '⚡',
    xpCost:   80,
    manaCost: 10,
    requires: 'construct-turret',
    effect:   { type: 'active-ability', ability: 'tesla-tower' },
  },
}
