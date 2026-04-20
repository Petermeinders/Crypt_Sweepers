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

export const STRENGTHEN_MINION_COST   = 10
export const STRENGTHEN_MINION_HP_GAIN = 5
export const CORPSE_EXPLOSION_COST    = 10
export const CORPSE_EXPLOSION_DAMAGE  = 3
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
  'corpse-explosion': {
    name:     'Corpse Explosion',
    desc:     'Active ability: tap a corpse (ash pile) or one of your minions to detonate it — every revealed enemy in the 8 surrounding tiles takes 3 damage. The corpse is consumed. Unlocks Corpse Explosion in your level-up choice pool.',
    icon:     '💥',
    xpCost:   80,
    manaCost: CORPSE_EXPLOSION_COST,
    effect:   { type: 'active-ability', ability: 'corpse-explosion' },
  },
  'detonation-chain': {
    name:     'Detonation Chain',
    desc:     'Corpse Explosion chains: any corpse hit by the blast detonates too (+10 mana per cast). Chains propagate until no unexploded corpses remain in range. Requires Corpse Explosion.',
    icon:     '⛓️',
    xpCost:   180,
    requires: 'corpse-explosion',
    effect:   { type: 'detonation-chain' },
  },
  'abyssal-reach': {
    name:     'Abyssal Reach',
    desc:     'Corpse Explosion reaches deeper: 50% chance per cast to also hit the outer ring (distance 2) of tiles. If it procs, mana cost is doubled; if it fails, you pay the base cost. Requires Corpse Explosion.',
    icon:     '🌑',
    xpCost:   220,
    requires: 'corpse-explosion',
    effect:   { type: 'abyssal-reach' },
  },
}
