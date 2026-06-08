// Tower-Defense minigame piece definitions — plain data, no functions.
// radiusType drives getRadiusCells() in TDPathfinder.js.

export const TD_PIECES = {
  monster_goblin: {
    emoji: '👺',
    label: 'Goblin',
    dmg: 8,
    radiusType: 'orthogonal_1',
    description: 'Melee blocker. Attacks the 4 adjacent tiles.',
  },
  monster_archer: {
    emoji: '🏹',
    label: 'Archer',
    dmg: 5,
    radiusType: 'diagonal_all',
    description: 'Ranged flanker. Covers all diagonal lines to the grid edge.',
  },
  monster_skeleton: {
    emoji: '💀',
    label: 'Skeleton',
    dmg: 6,
    radiusType: 'orthogonal_2',
    description: 'Spear reach. Covers straight lines 2 tiles out in each direction.',
  },
  monster_troll: {
    emoji: '👹',
    label: 'Troll',
    dmg: 12,
    radiusType: 'orthogonal_1_plus_self',
    description: 'Slow bruiser. High damage on adjacent tiles and its own cell.',
  },
  rock: {
    emoji: '🪨',
    label: 'Rock',
    dmg: 0,
    radiusType: 'none',
    description: 'Forces the hero to route around it. No damage.',
  },
}
