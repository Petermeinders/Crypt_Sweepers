// Global passive upgrades — apply to every hero regardless of class.
// Purchased with persistentGold from the Passive Upgrades screen on the main menu.

export const GLOBAL_PASSIVE_IDS = [
  'courage',
  'weapon-sharpening',
  'holy-grail',
  'trap-training',
  'reflexes',
  'iron-skin',
  'arcane-efficiency',
  'iron-will',
  'endurance',
  'mana-reservoir',
]

export const GLOBAL_PASSIVE_UPGRADES = {
  'courage': {
    name:   'Courage',
    desc:   'Start each run with 10 more HP.',
    icon:   '🦁',
    goldCost: 120,
    effect: { type: 'bonus-max-hp', amount: 10 },
  },
  'weapon-sharpening': {
    name:   'Weapon Sharpening',
    desc:   'Start each run with +1 fight damage.',
    icon:   '🗡️',
    goldCost: 105,
    effect: { type: 'bonus-damage', amount: 1 },
  },
  'holy-grail': {
    name:   'Holy Grail',
    desc:   'Start each run with +5 max mana.',
    icon:   '🏺',
    goldCost: 90,
    effect: { type: 'bonus-max-mana', amount: 5 },
  },
  'trap-training': {
    name:   'Trap Training',
    desc:   '5% chance to avoid trap damage entirely.',
    icon:   '🪤',
    goldCost: 180,
    effect: { type: 'trap-dodge', chance: 0.05 },
  },
  'reflexes': {
    name:   'Reflexes',
    desc:   '10% chance to dodge the ambush strike when revealing a fast enemy.',
    icon:   '⚡',
    goldCost: 195,
    effect: { type: 'reflex-dodge', chance: 0.10 },
  },
  'iron-skin': {
    name:   'Iron Skin',
    desc:   'Start each run with 1 permanent damage reduction.',
    icon:   '🛡️',
    goldCost: 150,
    effect: { type: 'bonus-damage-reduction', amount: 1 },
  },
  'arcane-efficiency': {
    name:   'Arcane Efficiency',
    desc:   'Spells cost 1 less mana each run.',
    icon:   '💫',
    goldCost: 255,
    effect: { type: 'bonus-spell-reduction', amount: 1 },
  },
  'iron-will': {
    name:   'Iron Will',
    desc:   'Hasty Retreat keeps 30% gold instead of 20%.',
    icon:   '🔰',
    goldCost: 240,
    effect: { type: 'better-retreat', percent: 0.30 },
  },
  'endurance': {
    name:   'Endurance',
    desc:   'Start each run with +2 fight damage.',
    icon:   '⚔️',
    goldCost: 210,
    effect: { type: 'bonus-damage', amount: 2 },
  },
  'mana-reservoir': {
    name:   'Mana Reservoir',
    desc:   'Start each run with +15 max mana.',
    icon:   '💧',
    goldCost: 165,
    effect: { type: 'bonus-max-mana', amount: 15 },
  },
}
