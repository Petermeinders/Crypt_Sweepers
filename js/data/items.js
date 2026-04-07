// Item registry — plain data only.
// effect.type is handled by GameController._useItem.

export const ITEMS = {
  'potion-blue': {
    name:      'Mana Potion',
    icon:      '🔵',
    spriteSrc: 'assets/sprites/Items/potionBlue.png',
    stackable: true,
    blurb:     'A vial of concentrated arcane essence. The liquid hums faintly against your fingers. Restores focus and magical reserves.',
    details: [
      { icon: '🔵', label: 'Restore',   desc: 'Restores 20 mana when used'      },
      { icon: '📦', label: 'Stackable', desc: 'Multiple potions share a slot'   },
    ],
    effect: { type: 'mana', amount: 20 },
  },

  'potion-red': {
    name:      'Red Potion',
    icon:      '🧪',
    spriteSrc: 'assets/sprites/Items/potionRed.png',
    stackable: true,
    blurb:     'A small vial of crimson restorative. Smells of iron and elderberries. Drink it when the shadows close in.',
    details: [
      { icon: '❤️', label: 'Restore',  desc: 'Heals 5 HP when used'         },
      { icon: '📦', label: 'Stackable', desc: 'Multiple potions share a slot' },
    ],
    effect: { type: 'heal', amount: 5 },
  },

  'smiths-tools': {
    name:      "Smith's Tools",
    icon:      '🔧',
    spriteSrc: 'assets/sprites/Items/smiths-tools.png',
    stackable: false,
    blurb:     'Crossed hammer and wrench — just enough kit to tune an edge before the next fight.',
    details: [
      { icon: '⚔️', label: 'Effect',  desc: '+1 attack damage for the rest of this run' },
      { icon: '📦', label: 'Chest',   desc: '~5% chance from chests; consumed on find; stacks each find' },
    ],
    effect: { type: 'instant-damage-up', amount: 1 },
  },

  'fire-ring': {
    name:      'Fire Ring',
    icon:      '🔥',
    spriteSrc: null,
    stackable: false,
    blurb:     'A band of blackened iron still warm to the touch. Faint embers swirl inside the stone. Something burns within it.',
    details: [
      { icon: '🔥', label: 'Passive',  desc: '10% chance on attack to ignite the enemy' },
      { icon: '💀', label: 'Burn',     desc: 'Burns for 3 turns: each turn deals 20% of current HP' },
      { icon: '🎲', label: 'Rare',     desc: '2% chance to appear in chests' },
    ],
    effect: { type: 'passive-fire-ring' },
  },

  'lantern': {
    name:      'Lantern',
    icon:      '🏮',
    spriteSrc: null,
    stackable: false,
    blurb:     'A dim glow that cuts through dungeon dark. Once lit, you can see what hides behind any single tile — but it only burns once.',
    details: [
      { icon: '🏮', label: 'Use',     desc: 'Activate, then tap any unrevealed tile to reveal it for free' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use' },
      { icon: '🎲', label: 'Common',  desc: '10% chance to appear in chests' },
    ],
    effect: { type: 'lantern' },
  },

  'mana-ring': {
    name:      'Mana Ring',
    icon:      '💍',
    spriteSrc: null,
    stackable: false,
    blurb:     'An ornate silver band threaded with arcane wire. The inscription reads: "to the attentive, twice the power."',
    details: [
      { icon: '💍', label: 'Passive', desc: '10% chance to gain double mana when a tile is flipped' },
      { icon: '🔵', label: 'Effect',  desc: 'Normally +1 mana per tile; ring procs give +2 instead' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance to appear in chests' },
    ],
    effect: { type: 'passive-mana-ring' },
  },

  'spyglass': {
    name:      'Spyglass',
    icon:      '🔭',
    spriteSrc: null,
    stackable: false,
    blurb:     'Brass and smoked glass — a glimpse through the fog without stepping into it.',
    details: [
      { icon: '🔭', label: 'Use',     desc: 'Activate, then tap one hidden tile to glimpse its nature (no reveal)' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'spyglass' },
  },

  'echo-charm': {
    name:      'Echo Charm',
    icon:      '🔔',
    spriteSrc: null,
    stackable: false,
    blurb:     'A tiny bell that answers when something falls nearby.',
    details: [
      { icon: '🔔', label: 'Passive', desc: 'When you kill an enemy, orthogonally adjacent hidden tiles show a hint' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-echo-charm' },
  },

  'vampire-fang': {
    name:      'Vampire Fang',
    icon:      '🦷',
    spriteSrc: null,
    stackable: false,
    blurb:     'A chipped tooth that still remembers the taste of victory.',
    details: [
      { icon: '🦷', label: 'Passive', desc: 'Heal 1 HP when you slay an enemy' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-vampire-fang' },
  },

  'glass-cannon-shard': {
    name:      'Glass Cannon Shard',
    icon:      '💠',
    spriteSrc: null,
    stackable: false,
    blurb:     'A razor-sharp fragment of something that shatters beautifully.',
    details: [
      { icon: '⚔️', label: 'Passive', desc: 'Above 50% HP: +50% damage to enemies. Below 50% HP: −50% damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-glass-cannon-shard' },
  },

  'duelists-glove': {
    name:      "Duelist's Glove",
    icon:      '🧤',
    spriteSrc: null,
    stackable: false,
    blurb:     'Worn leather that remembers the first clean line of every duel.',
    details: [
      { icon: '🧤', label: 'Passive', desc: 'Your first melee hit against each enemy deals +1 damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-duelists-glove' },
  },

  'surge-pearl': {
    name:      'Surge Pearl',
    icon:      '⚪',
    spriteSrc: null,
    stackable: false,
    blurb:     'A pearl that pulses when a spell leaves your hand.',
    details: [
      { icon: '🔵', label: 'Passive', desc: '20% chance on basic spell cast to refund half the mana spent' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-surge-pearl' },
  },

  'still-water-amulet': {
    name:      'Still Water Amulet',
    icon:      '💧',
    spriteSrc: null,
    stackable: false,
    blurb:     'Still water runs deep — and cheap spells, if you wait.',
    details: [
      { icon: '🔵', label: 'Passive', desc: 'After 10 turns without using mana (basic spell or any active ability), your next mana ability costs 35% less' },
      { icon: '⏱️', label: 'Turns',   desc: 'Turns advance on tile flips and melee combat actions' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-still-water-amulet' },
  },

  'greed-tooth': {
    name:      'Greed Tooth',
    icon:      '🤑',
    spriteSrc: null,
    stackable: false,
    blurb:     'A gold tooth that hungers for more — and pays for it in blood.',
    details: [
      { icon: '🪙', label: 'Passive', desc: '+1 gold whenever you kill an enemy' },
      { icon: '🕸️', label: 'Risk',    desc: '+1 damage taken from traps' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-greed-tooth' },
  },

  'lucky-rabbit-foot': {
    name:      'Lucky Rabbit Foot',
    icon:      '🐇',
    spriteSrc: null,
    stackable: false,
    blurb:     'A soft charm that steps aside for the worst blows.',
    details: [
      { icon: '🍀', label: 'Passive', desc: '2% chance to completely avoid any incoming damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-lucky-rabbit-foot' },
  },

  'cursed-lockpick': {
    name:      'Cursed Lockpick',
    icon:      '🗝️',
    spriteSrc: null,
    stackable: false,
    blurb:     'A bent pick that whispers of better locks.',
    details: [
      { icon: '📦', label: 'Passive', desc: 'Chests have a chance to upgrade to a rare or legendary trinket' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-cursed-lockpick' },
  },

  'hourglass-sand': {
    name:      'Hourglass Sand',
    icon:      '⏳',
    spriteSrc: null,
    stackable: false,
    blurb:     'A pinch of sand that falls upward — once, then again, until you run dry.',
    details: [
      { icon: '⏳', label: 'Use',     desc: 'Undo your last tile reveal (infinite uses)' },
      { icon: '💀', label: 'Cost',    desc: 'Drains all mana, and 1 HP and 1 gold each use' },
      { icon: '🎲', label: 'Legendary', desc: '1% chance from chests' },
    ],
    effect: { type: 'hourglass-sand' },
  },
}
