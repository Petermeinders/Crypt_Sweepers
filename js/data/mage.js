// Mage character definition and ability tree.
// Passive: Phase Walk — tiles are reachable diagonally as well as orthogonally
// (applied via TileEngine.setDiagonalMovement; not represented in this file).

import { WARRIOR_ABILITIES } from './abilities.js'

export const MAGE_BASE = {
  hp:     30,
  mana:   60,
  damage: 1,   // base melee; bonuses come from damageBonus
  gold:   0,
}

/** Level-up pool — Vitality / Arcane Reserve / Scavenger shared with other heroes.
 *  Mastery stacks for the Mage's active abilities are only offered after the active is picked. */
export const MAGE_ABILITIES = {
  vitality:         WARRIOR_ABILITIES.vitality,
  'arcane-reserve': WARRIOR_ABILITIES['arcane-reserve'],
  scavenger:        WARRIOR_ABILITIES.scavenger,
  'chain-lightning-mastery': {
    name:  'Chain Lightning Practice',
    desc:  'Each pick: +10% Chain Lightning damage per zap (stacks).',
    icon:  '⚡',
    effect: { type: 'mage-active-mastery', ability: 'chain-lightning' },
    repeatable: true,
    requiresActive: 'chain-lightning',
  },
  'telekinetic-throw-mastery': {
    name:  'Telekinetic Practice',
    desc:  'Each pick: +10% Telekinetic Throw slam damage (stacks).',
    icon:  '🌀',
    effect: { type: 'mage-active-mastery', ability: 'telekinetic-throw' },
    repeatable: true,
    requiresActive: 'telekinetic-throw',
  },
}

export const MAGE_UPGRADES = {
  'chain-lightning': {
    name:  'Chain Lightning',
    desc:  'Active ability: tap an enemy — a lightning bolt strikes them, then arcs to up to 2 random revealed enemies (each zap deals equal damage). Unlocks Chain Lightning in your level-up choice pool.',
    icon:  '⚡',
    xpCost:   50,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'chain-lightning' },
  },
  'telekinetic-throw': {
    name:  'Telekinetic Throw',
    desc:  'Active ability: tap an enemy, then tap a revealed empty tile — the enemy is picked up and slammed down for heavy damage. Adjacent tile locks reset to the new landing tile. Unlocks Telekinetic Throw in your level-up choice pool.',
    icon:  '🌀',
    xpCost:   80,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'telekinetic-throw' },
  },
}
