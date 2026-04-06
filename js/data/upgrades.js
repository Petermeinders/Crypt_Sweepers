// Warrior XP tree definitions and Gold Shop item definitions.
// Plain data only — no functions. Apply logic lives in MetaProgression.js.
//
// XP tree: permanent unlocks purchased with warrior XP between runs.
// Gold shop: per-run boosts purchased with banked gold before each run.

export const WARRIOR_UPGRADES = {
  'slam': {
    name:     'Slam',
    desc:     'Bring your weapon down with crushing force. The next enemy you strike takes double damage and cannot counter-attack.',
    icon:     '💥',
    iconSrc:  'assets/sprites/abilities/slam.png',
    xpCost:   50,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'slam' },
  },
  'blinding-light': {
    name:     'Blinding Light',
    desc:     'A flash of searing light adds stun turns from your attack scaling (no damage). Stunned enemies cannot counter-attack.',
    icon:     '✨',
    iconSrc:  'assets/sprites/abilities/blinding-light.jpg',
    xpCost:   75,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'blinding-light' },
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
  'lucky-coin': {
    name:    'Lucky Coin',
    desc:    'Start this run with +15 gold',
    icon:    '🍀',
    goldCost: 15,
    effect:  { type: 'bonus-starting-gold-run', amount: 15 },
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
