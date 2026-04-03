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
}
