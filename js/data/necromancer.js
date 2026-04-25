import { WARRIOR_ABILITIES } from './abilities.js'

export const NECROMANCER_BASE = {
  hp:     35,
  mana:   55,
  damage: 1,
}

/** Minion stats indexed by mastery level (1 = base, 2 = Mastery I, 3 = Mastery II, 4 = Mastery III). */
export const NECROMANCER_MINION = {
  hpByLevel:     [1, 2, 3, 4],
  damageByLevel: [1, 1, 2, 2],
}

export const RAISE_MINION_COST = 10

export const STRENGTHEN_MINION_COST     = 10
export const STRENGTHEN_MINION_HP_GAIN  = 5   // base; overridden by stacks in GameController
export const CORPSE_EXPLOSION_COST      = 10
export const CORPSE_EXPLOSION_DAMAGE    = 3
export const DETONATION_CHAIN_EXTRA_COST = 10

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
    requiresMeta: 'raise-minion-mastery-1',
  },
  'minion-mastery-2': {
    name:      'Minion Mastery II',
    desc:      'Your minions reach peak undead power — 3 HP, 2 damage.',
    icon:      '💀',
    effect:    { type: 'necro-minion-mastery', level: 3 },
    repeatable: false,
    requiresMeta:    'raise-minion-mastery-2',
    requiresAbility: 'minion-mastery-1',
  },
  'minion-mastery-3': {
    name:      'Minion Mastery III',
    desc:      'Your minions are truly fearsome — 4 HP, 2 damage.',
    icon:      '👑',
    effect:    { type: 'necro-minion-mastery', level: 4 },
    repeatable: false,
    requiresMeta:    'raise-minion-mastery-3',
    requiresAbility: 'minion-mastery-2',
  },
  'strengthen-minion-mastery-1': {
    name:      'Strengthen Mastery I',
    desc:      'Grants +10 HP instead of +5.',
    icon:      '💪',
    effect:    { type: 'strengthen-minion-mastery' },
    repeatable: false,
    requiresActive: 'strengthen-minion',
    requiresMeta:   'strengthen-minion-mastery-1',
  },
  'strengthen-minion-mastery-2': {
    name:      'Strengthen Mastery II',
    desc:      'Also grants the minion +1 damage.',
    icon:      '⚔️',
    effect:    { type: 'strengthen-minion-mastery' },
    repeatable: false,
    requiresActive:  'strengthen-minion',
    requiresMeta:    'strengthen-minion-mastery-2',
    requiresAbility: 'strengthen-minion-mastery-1',
  },
}

/** Meta-shop tree. Base actives unlock into the level-up pool; mastery tiers require the base active. */
export const NECROMANCER_UPGRADES = {
  'strengthen-minion': {
    name:     'Strengthen Minion',
    desc:     'Active ability: tap a raised minion to reinforce it with +5 max HP (heals to new max). Unlocks Strengthen Minion in your level-up choice pool.',
    icon:     '💪',
    xpCost:   50,
    manaCost: STRENGTHEN_MINION_COST,
    effect:   { type: 'active-ability', ability: 'strengthen-minion' },
  },
  'strengthen-minion-mastery-1': {
    name:     'Strengthen Mastery I',
    desc:     'Grants +10 HP instead of +5.',
    icon:     '💪',
    xpCost:   40,
    requires: 'strengthen-minion',
    masteryOf:'strengthen-minion',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'strengthen-minion-mastery-2': {
    name:     'Strengthen Mastery II',
    desc:     'Also grants the minion +1 damage.',
    icon:     '⚔️',
    xpCost:   70,
    requires: 'strengthen-minion-mastery-1',
    masteryOf:'strengthen-minion',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'strengthen-minion-mastery-3': {
    name:     'Strengthen Mastery III',
    desc:     'Mana cost reduced from 10 to 6.',
    icon:     '🔵',
    xpCost:   100,
    requires: 'strengthen-minion-mastery-2',
    masteryOf:'strengthen-minion',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'corpse-explosion': {
    name:     'Corpse Explosion',
    desc:     'Active ability: tap a corpse (ash pile) or one of your minions to detonate it — every revealed enemy in the 8 surrounding tiles takes 3 damage. The corpse is consumed. Unlocks Corpse Explosion in your level-up choice pool.',
    icon:     '💥',
    xpCost:   80,
    manaCost: CORPSE_EXPLOSION_COST,
    effect:   { type: 'active-ability', ability: 'corpse-explosion' },
  },
  'corpse-explosion-mastery-1': {
    name:     'Corpse Explosion Mastery I',
    desc:     '+1 to base explosion damage (3 → 4).',
    icon:     '💥',
    xpCost:   40,
    requires: 'corpse-explosion',
    masteryOf:'corpse-explosion',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'abyssal-reach': {
    name:     'Abyssal Reach',
    desc:     '50% chance per cast to also hit the outer ring (distance 2). Mana cost doubles on proc.',
    icon:     '🌑',
    xpCost:   220,
    requires: 'corpse-explosion-mastery-1',
    masteryOf:'corpse-explosion',
    effect:   { type: 'abyssal-reach' },
  },
  'detonation-chain': {
    name:     'Detonation Chain',
    desc:     'Any corpse hit by the blast detonates too (+10 mana per cast). Chains propagate until no unexploded corpses remain in range.',
    icon:     '⛓️',
    xpCost:   180,
    requires: 'abyssal-reach',
    masteryOf:'corpse-explosion',
    effect:   { type: 'detonation-chain' },
  },
  'raise-minion-mastery-1': {
    name:     'Raise Minion Mastery I',
    desc:     'Unlocks Minion Mastery I in level-up picks (2 HP, 1 damage).',
    icon:     '🦴',
    xpCost:   30,
    effect:   { type: 'mastery-tier-unlock' },
  },
  'raise-minion-mastery-2': {
    name:     'Raise Minion Mastery II',
    desc:     'Unlocks Minion Mastery II in level-up picks (3 HP, 2 damage).',
    icon:     '💀',
    xpCost:   50,
    requires: 'raise-minion-mastery-1',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'raise-minion-mastery-3': {
    name:     'Raise Minion Mastery III',
    desc:     'Unlocks Minion Mastery III in level-up picks (4 HP, 2 damage).',
    icon:     '👑',
    xpCost:   80,
    requires: 'raise-minion-mastery-2',
    effect:   { type: 'mastery-tier-unlock' },
  },
}
