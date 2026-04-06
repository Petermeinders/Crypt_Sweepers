// Warrior ability definitions — plain data only, no functions.
// Apply logic lives in ProgressionSystem.js.

export const WARRIOR_ABILITIES = {
  'vitality': {
    name:  'Vitality',
    desc:  '+5 max HP, restore 5 HP now',
    icon:  '❤️',
    effect: { type: 'buff-hp', maxHp: 5, healNow: 5 },
    repeatable: true,
  },
  'arcane-reserve': {
    name:  'Arcane Reserve',
    desc:  '+5 max mana, restore 5 mana now',
    icon:  '🔵',
    effect: { type: 'buff-mana', maxMana: 5, restoreNow: 5 },
    repeatable: true,
  },
  'scavenger': {
    name:  'Scavenger',
    desc:  '+10 gold',
    icon:  '🪙',
    effect: { type: 'buff-gold', amount: 10 },
    repeatable: true,
  },
  'slam-mastery': {
    name:  'Slam Mastery',
    desc:  '+0.1 to Slam’s damage multiplier per pick (stacks — added to the base 0.3× melee factor)',
    icon:  '🔨',
    effect: { type: 'slam-mult-bonus', amount: 1 },
    repeatable: true,
  },
  'blinding-mastery': {
    name:  'Blinding Mastery',
    desc:  '+0.1 to Blinding Light’s stun-turn multiplier per pick (stacks — added to the base factor on your HUD attack)',
    icon:  '✨',
    effect: { type: 'blinding-mult-bonus', amount: 1 },
    repeatable: true,
  },
}
