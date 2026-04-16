// Engineer — XP tree, base stats, and level-up ability pool.
// Apply logic lives in MetaProgression / GameController.

import { WARRIOR_ABILITIES } from './abilities.js'

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

/** Engineer level-up pool — stat picks shared with Paladin, plus turret-specific masteries. */
export const ENGINEER_ABILITIES = {
  vitality: WARRIOR_ABILITIES.vitality,
  'arcane-reserve': WARRIOR_ABILITIES['arcane-reserve'],
  scavenger: WARRIOR_ABILITIES.scavenger,
  'turret-mastery-1': {
    name: 'Turret Mastery I',
    desc: 'Allows your placed turrets to be upgraded to Level 2 (tap your turret, 10 mana).',
    icon: '🔧',
    effect: { type: 'turret-max-level', level: 2 },
    repeatable: false,
    requiresActive: 'construct-turret',
  },
  'turret-mastery-2': {
    name: 'Turret Mastery II',
    desc: 'Allows your placed turrets to be upgraded to Level 3 (tap your turret, 10 mana).',
    icon: '🔩',
    effect: { type: 'turret-max-level', level: 3 },
    repeatable: false,
    requiresActive: 'construct-turret',
    requiresAbility: 'turret-mastery-1',
  },
}

export const ENGINEER_UPGRADES = {
  'construct-turret': {
    name:     'Construct Turret',
    desc:     'Active: tap an empty tile twice to build (Level 1) or relocate. Absorbs enemy strikes while alive. Costs 10 mana. Turret upgrades require Turret Mastery picks at level-up. Unlocks Construct Turret in your level-up choice pool.',
    icon:     '🏗️',
    xpCost:   50,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'construct-turret' },
  },
  'tesla-tower': {
    name:     'Tesla Tower',
    desc:     'After a turret exists: spend 10 mana to convert it to a Tesla tower (one-way). Strikes enemies revealed or fought within its perimeter; radius grows with turret level. Unlocks Tesla Tower in your level-up choice pool.',
    icon:     '⚡',
    xpCost:   80,
    manaCost: 10,
    requires: 'construct-turret',
    effect:   { type: 'active-ability', ability: 'tesla-tower' },
  },
}
