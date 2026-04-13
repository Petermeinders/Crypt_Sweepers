// Warrior XP tree definitions and Gold Shop item definitions.
// Plain data only — no functions. Apply logic lives in MetaProgression.js.

export const WARRIOR_UPGRADES = {
  'slam': {
    name:     'Slam',
    desc:     'Bring your weapon down with crushing force. Deals damage to all visible enemies — no counter-attack.',
    icon:     '💥',
    iconSrc:  'assets/sprites/abilities/slam.png',
    xpCost:   200,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'slam' },
  },
  'blinding-light': {
    name:     'Blinding Light',
    desc:     'A flash of searing light adds stun turns from your attack scaling (no damage). Stunned enemies cannot counter-attack.',
    icon:     '✨',
    iconSrc:  'assets/sprites/abilities/blinding-light.jpg',
    xpCost:   500,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'blinding-light' },
  },
  'divine-light': {
    name:     'Divine Light',
    desc:     'Two uses: tap an enemy to smite it for damage, or tap your hero portrait to restore 10% of your max HP.',
    icon:     '🌟',
    iconSrc:  'assets/sprites/abilities/divine-light-badge.jpg',
    iconBgSrc:'assets/sprites/abilities/ricochet-bg.png',
    xpCost:   1000,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'divine-light' },
  },
}

export const SHOP_ITEMS = {
  'healing-draft': {
    name:    'Healing Draft',
    desc:    'Start this run with +25 HP',
    icon:    '🧪',
    goldCost: 30,
    effect:  { type: 'bonus-hp-this-run', amount: 25 },
  },
  'mana-crystal': {
    name:    'Mana Crystal',
    desc:    'Start this run with +20 mana',
    icon:    '💎',
    goldCost: 25,
    effect:  { type: 'bonus-mana-this-run', amount: 20 },
  },
  'sturdy-shield': {
    name:    'Sturdy Shield',
    desc:    'Take 3 less damage this run',
    icon:    '🛡️',
    goldCost: 40,
    effect:  { type: 'bonus-damage-reduction-run', amount: 3 },
  },
  'scholars-notes': {
    name:    "Scholar's Notes",
    desc:    'Level-up shows 4 choices this run',
    icon:    '📜',
    goldCost: 35,
    effect:  { type: 'extra-ability-choice' },
  },
}
