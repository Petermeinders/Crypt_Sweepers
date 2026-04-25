// Engineer — XP tree, base stats, and level-up ability pool.
// Apply logic lives in MetaProgression / GameController.

import { WARRIOR_ABILITIES } from './abilities.js'

export const ENGINEER_BASE = {
  hp:     40,
  mana:   30,
  /** Melee damage: same model as warrior (fixed base + bonus). */
  damage: 1,
}

/** Turret tier stats (level 1–3). */
export const ENGINEER_TURRET = {
  maxHpByLevel:  [5, 12, 20],
  damageByLevel: [1,  2,  3],
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
    desc: 'Unlocks turret Level 2 upgrades (tap turret, 10 mana). More HP, same damage.',
    icon: '🔧',
    effect: { type: 'turret-max-level', level: 2 },
    repeatable: false,
    requiresActive: 'construct-turret',
    requiresMeta:   'construct-turret-mastery-1',
  },
  'turret-mastery-2': {
    name: 'Turret Mastery II',
    desc: 'Unlocks turret Level 3 upgrades (tap turret, 10 mana). More HP + scales damage with your attack.',
    icon: '🔩',
    effect: { type: 'turret-max-level', level: 3 },
    repeatable: false,
    requiresActive:  'construct-turret',
    requiresMeta:    'construct-turret-mastery-2',
    requiresAbility: 'turret-mastery-1',
  },
  'turret-mastery-3': {
    name: 'Turret Mastery III',
    desc: 'Heals you for 3% of max HP (min 1) on any kill while your turret is active at Level 3.',
    icon: '💚',
    effect: { type: 'turret-kill-heal' },
    repeatable: false,
    requiresActive:  'construct-turret',
    requiresMeta:    'construct-turret-mastery-3',
    requiresAbility: 'turret-mastery-2',
  },
  'mana-generator-mastery-1': {
    name: 'Mana Generator Mastery I',
    desc: '25% chance your Mana Generator grants 2 mana per flip instead of 1.',
    icon: '🔋',
    effect: { type: 'mana-generator-mastery' },
    repeatable: false,
    requiresActive: 'mana-generator',
    requiresMeta:   'mana-generator-mastery-1',
  },
  'mana-generator-mastery-2': {
    name: 'Mana Generator Mastery II',
    desc: '25% chance your Mana Generator grants 3 mana per flip instead.',
    icon: '⚡',
    effect: { type: 'mana-generator-mastery' },
    repeatable: false,
    requiresActive:  'mana-generator',
    requiresMeta:    'mana-generator-mastery-2',
    requiresAbility: 'mana-generator-mastery-1',
  },
  'mana-generator-mastery-3': {
    name: 'Mana Generator Mastery III',
    desc: 'When mana is already full, each flip instead heals 1 HP.',
    icon: '💚',
    effect: { type: 'mana-generator-mastery' },
    repeatable: false,
    requiresActive:  'mana-generator',
    requiresMeta:    'mana-generator-mastery-3',
    requiresAbility: 'mana-generator-mastery-2',
  },
  'tesla-tower-mastery-1': {
    name: 'Tesla Mastery I',
    desc: 'Tesla radius expands to 2 tiles. 25% chance to arc to a second random revealed enemy.',
    icon: '⚡',
    effect: { type: 'engineer-active-mastery', ability: 'tesla-tower' },
    repeatable: false,
    requiresActive: 'tesla-tower',
    requiresMeta:   'tesla-tower-mastery-1',
  },
  'tesla-tower-mastery-2': {
    name: 'Tesla Mastery II',
    desc: 'Tesla radius expands to 3 tiles. Arc chance increases to 50%.',
    icon: '⚡',
    effect: { type: 'engineer-active-mastery', ability: 'tesla-tower' },
    repeatable: false,
    requiresActive:  'tesla-tower',
    requiresMeta:    'tesla-tower-mastery-2',
    requiresAbility: 'tesla-tower-mastery-1',
  },
  'tesla-tower-mastery-3': {
    name: 'Tesla Mastery III',
    desc: 'Tesla radius expands to 4 tiles. Arc chance increases to 75%.',
    icon: '⚡',
    effect: { type: 'engineer-active-mastery', ability: 'tesla-tower' },
    repeatable: false,
    requiresActive:  'tesla-tower',
    requiresMeta:    'tesla-tower-mastery-3',
    requiresAbility: 'tesla-tower-mastery-2',
  },
}

/** Mana cost to build or upgrade a turret. */
export const ENGINEER_CONSTRUCT_MANA_COST = 10
/** Mana cost to relocate an existing turret. */
export const ENGINEER_MOVE_MANA_COST = 5

/** Innate Engineer passive — Seismic Ping (category hints + pulse when the turret is placed or moved).
 *  Level 1 is granted from the start (`player.seismicPingLevel === 1`). Future masteries may raise
 *  that level to widen scan reach (Chebyshev radius: 1 = 8 adjacent tiles, 2 = 24 tiles, etc.). */
export const ENGINEER_SEISMIC_PING = {
  id: 'seismic-ping',
  defaultLevel: 1,
  /** Clamp for safety until mastery tiers are implemented. */
  maxLevel: 3,
}

export const ENGINEER_UPGRADES = {
  'tesla-tower': {
    name:     'Tesla Tower',
    desc:     'Toggle your turret into Tesla mode: it strikes enemies revealed or fought within its perimeter. Radius grows with turret level. Toggle off to return to ballistic mode. Unlocks Tesla Tower in your level-up choice pool.',
    icon:     '⚡',
    xpCost:   80,
    effect:   { type: 'active-ability', ability: 'tesla-tower' },
  },
  'tesla-tower-mastery-1': {
    name:     'Tesla Mastery I',
    desc:     'Tesla radius expands to 2 tiles. 25% chance to arc to a second random revealed enemy.',
    icon:     '⚡',
    xpCost:   60,
    requires: 'tesla-tower',
    masteryOf:'tesla-tower',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'tesla-tower-mastery-2': {
    name:     'Tesla Mastery II',
    desc:     'Tesla radius expands to 3 tiles. Arc chance increases to 50%.',
    icon:     '⚡',
    xpCost:   100,
    requires: 'tesla-tower-mastery-1',
    masteryOf:'tesla-tower',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'tesla-tower-mastery-3': {
    name:     'Tesla Mastery III',
    desc:     'Tesla radius expands to 4 tiles. Arc chance increases to 75%.',
    icon:     '⚡',
    xpCost:   150,
    requires: 'tesla-tower-mastery-2',
    masteryOf:'tesla-tower',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'mana-generator': {
    name:     'Mana Generator',
    desc:     'Toggle your turret into Mana Generator mode: it stops firing and instead grants +1 mana every time you flip a tile. Toggle off to resume firing. Unlocks Mana Generator in your level-up choice pool.',
    icon:     '🔋',
    xpCost:   80,
    effect:   { type: 'active-ability', ability: 'mana-generator' },
  },
  'mana-generator-mastery-1': {
    name:     'Mana Generator Mastery I',
    desc:     '25% chance to grant 2 mana per flip instead of 1.',
    icon:     '🔋',
    xpCost:   40,
    requires: 'mana-generator',
    masteryOf:'mana-generator',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'mana-generator-mastery-2': {
    name:     'Mana Generator Mastery II',
    desc:     '25% chance to grant 3 mana per flip instead.',
    icon:     '⚡',
    xpCost:   70,
    requires: 'mana-generator-mastery-1',
    masteryOf:'mana-generator',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'mana-generator-mastery-3': {
    name:     'Mana Generator Mastery III',
    desc:     'When mana is already full, each flip instead heals 1 HP.',
    icon:     '💚',
    xpCost:   110,
    requires: 'mana-generator-mastery-2',
    masteryOf:'mana-generator',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'construct-turret-mastery-1': {
    name:     'Turret Mastery I',
    desc:     'Unlocks turret Level 2 upgrades. Increases turret HP.',
    icon:     '🔧',
    xpCost:   50,
    effect:   { type: 'mastery-tier-unlock' },
  },
  'construct-turret-mastery-2': {
    name:     'Turret Mastery II',
    desc:     'Unlocks turret Level 3 upgrades. More HP + damage scales with your attack.',
    icon:     '🔩',
    xpCost:   80,
    requires: 'construct-turret-mastery-1',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'construct-turret-mastery-3': {
    name:     'Turret Mastery III',
    desc:     'Heals 3% max HP (min 1) on any kill while turret is active at Level 3.',
    icon:     '💚',
    xpCost:   120,
    requires: 'construct-turret-mastery-2',
    effect:   { type: 'mastery-tier-unlock' },
  },
}
