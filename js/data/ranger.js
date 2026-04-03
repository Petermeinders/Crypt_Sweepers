// Ranger character definition and ability tree.
// Ranger unique mechanic: enemy reveals do NOT lock adjacent tiles.

export const RANGER_BASE = {
  hp:      80,
  mana:    80,
  damage:  [8, 18],   // slightly lower than Warrior
  gold:    0,
}

export const RANGER_ABILITIES = {
  'hunters-eye': {
    name:  "Hunter's Eye",
    desc:  'Fight damage +7',
    icon:  '🏹',
    effect: { type: 'buff-damage', amount: 7 },
    repeatable: true,
  },
  'shadow-step': {
    name:  'Shadow Step',
    desc:  'Flee costs at most 1 HP',
    icon:  '🌑',
    effect: { type: 'reduce-flee-cost', max: 1 },
    repeatable: false,
  },
  'trapfinder': {
    name:  'Trapfinder',
    desc:  'Take 3 less damage from traps',
    icon:  '🔍',
    effect: { type: 'trap-reduction', amount: 3 },
    repeatable: false,
  },
  'survival-instinct': {
    name:  'Survival Instinct',
    desc:  '+15 max HP, restore 10 HP now',
    icon:  '🛡️',
    effect: { type: 'buff-hp', maxHp: 15, healNow: 10 },
    repeatable: true,
  },
  'arcane-quiver': {
    name:  'Arcane Quiver',
    desc:  '+15 max mana, restore 10 mana now',
    icon:  '🔮',
    effect: { type: 'buff-mana', maxMana: 15, restoreNow: 10 },
    repeatable: true,
  },
  'beast-slayer': {
    name:  'Beast Slayer',
    desc:  '2× damage vs beast enemies',
    icon:  '🐾',
    effect: { type: 'beast-bonus', multiplier: 2 },
    repeatable: false,
  },
  'poison-arrow': {
    name:  'Poison Arrow',
    desc:  'Spell costs 2 less mana',
    icon:  '🗡️',
    effect: { type: 'reduce-spell-cost', amount: 2 },
    repeatable: false,
  },
  'resourceful': {
    name:  'Resourceful',
    desc:  'Restore 4 HP on each enemy kill',
    icon:  '🌿',
    effect: { type: 'on-kill-heal', amount: 4 },
    repeatable: false,
  },
}

export const RANGER_UPGRADES = {
  'keen-senses': {
    name:  'Keen Senses',
    desc:  'Start each run with +8 max HP',
    icon:  '👁️',
    xpCost: 45,
    effect: { type: 'bonus-max-hp', amount: 8 },
  },
  'swift-shot': {
    name:  'Swift Shot',
    desc:  'Start each run with +5 fight damage',
    icon:  '🏹',
    xpCost: 70,
    effect: { type: 'bonus-damage', amount: 5 },
  },
  'forest-lore': {
    name:  'Forest Lore',
    desc:  'Start each run with +12 max mana',
    icon:  '🌿',
    xpCost: 55,
    effect: { type: 'bonus-max-mana', amount: 12 },
  },
  'ghost-walk': {
    name:  'Ghost Walk',
    desc:  'Hasty Retreat keeps 30% gold instead of 20%',
    icon:  '👣',
    xpCost: 80,
    effect: { type: 'better-retreat', percent: 0.30 },
  },
  'bark-skin': {
    name:  'Bark Skin',
    desc:  'Start each run with 1 permanent damage reduction',
    icon:  '🌳',
    xpCost: 95,
    effect: { type: 'bonus-damage-reduction', amount: 1 },
  },
  'mana-arrow': {
    name:  'Mana Arrow',
    desc:  'Spells cost 1 less mana each run',
    icon:  '💫',
    xpCost: 85,
    effect: { type: 'bonus-spell-reduction', amount: 1 },
  },
  'coin-pouch': {
    name:  'Coin Pouch',
    desc:  'Start each run with 20 extra gold',
    icon:  '🪙',
    xpCost: 110,
    effect: { type: 'bonus-starting-gold', amount: 20 },
  },
}
