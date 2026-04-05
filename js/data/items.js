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
}
