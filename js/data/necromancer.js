import { WARRIOR_ABILITIES } from './abilities.js'

export const NECROMANCER_BASE = {
  hp:     35,
  mana:   55,
  damage: 1,
}

/** Minion stats indexed by mastery level (1 = base, 2 = Mastery I, 3 = Mastery II). */
export const NECROMANCER_MINION = {
  hpByLevel:     [1, 2, 3],
  damageByLevel: [1, 1, 2],
}

export const RAISE_MINION_COST = 10

export const NECROMANCER_ABILITIES = {
  vitality:          WARRIOR_ABILITIES.vitality,
  'arcane-reserve':  WARRIOR_ABILITIES['arcane-reserve'],
  scavenger:         WARRIOR_ABILITIES.scavenger,
  'minion-mastery-1': {
    name:      'Minion Mastery I',
    desc:      'Your raised minions grow sturdier — upgraded to 2 HP, 1 damage.',
    icon:      '🦴',
    effect:    { type: 'necro-minion-mastery', level: 2 },
    repeatable: false,
  },
  'minion-mastery-2': {
    name:      'Minion Mastery II',
    desc:      'Your minions reach peak undead power — 3 HP, 2 damage.',
    icon:      '💀',
    effect:    { type: 'necro-minion-mastery', level: 3 },
    repeatable: false,
    requiresAbility: 'minion-mastery-1',
  },
}

/** No meta-unlock tree — Raise Minion is always-on passive. */
export const NECROMANCER_UPGRADES = {}
