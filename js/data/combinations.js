// Forge combination recipes — pairs of items merged at the Sanctuary Forge.
// ingredientA and ingredientB are unordered (either can be in either slot).
// Duplicate recipes (same ID twice) require two of that item.

export const FORGE_RECIPES = [
  // ── Pair combinations ────────────────────────────────────────
  {
    id:          'recipe-sanguine-covenant',
    result:      'sanguine-covenant',
    ingredientA: 'vampire-fang',
    ingredientB: 'blood-pact',
    hint:        '+3 dmg · heal 2 HP on kill · max HP halved',
  },
  {
    id:          'recipe-inferno-barbs',
    result:      'inferno-barbs',
    ingredientA: 'fire-ring',
    ingredientB: 'thorn-wrap',
    hint:        'Reflect 2 dmg when hit · burn the attacker',
  },
  {
    id:          'recipe-resonance-core',
    result:      'resonance-core',
    ingredientA: 'echo-charm',
    ingredientB: 'surge-pearl',
    hint:        'Echo hints on kill · 30% chance to refund full mana on spell',
  },
  {
    id:          'recipe-devils-gambit',
    result:      'devils-gambit',
    ingredientA: 'lucky-rabbit-foot',
    ingredientB: 'bone-dice',
    hint:        '5% dodge all damage · 20% chance enemy gold drops double',
  },
  {
    id:          'recipe-navigators-chart',
    result:      'navigators-chart',
    ingredientA: 'spyglass',
    ingredientB: 'cracked-compass',
    hint:        'Reveals all tiles on the floor once per floor',
  },
  {
    id:          'recipe-temporal-wick',
    result:      'temporal-wick',
    ingredientA: 'hourglass-sand',
    ingredientB: 'soul-candle',
    hint:        'Rewind + restore 15% HP · 30% chance +1 mana on kill',
  },
  {
    id:          'recipe-infected-blade',
    result:      'infected-blade',
    ingredientA: 'plague-mask',
    ingredientB: 'rusty-nail',
    hint:        'Take 1 less dmg · melee hits poison the enemy for 3 turns',
  },
  {
    id:          'recipe-vault-key',
    result:      'vault-key',
    ingredientA: 'misers-pouch',
    ingredientB: 'greed-tooth',
    hint:        '+2 gold on kill · 15% of gold earned auto-banks to persistent gold',
  },
  {
    id:          'recipe-razors-edge',
    result:      'razors-edge',
    ingredientA: 'whetstone',
    ingredientB: 'glass-cannon-shard',
    hint:        'Always deal max damage · −10 max HP',
  },
  {
    id:          'recipe-field-kit',
    result:      'field-kit',
    ingredientA: 'smelling-salts',
    ingredientB: 'bandage-roll',
    hint:        'Reusable (5 mana): +5 HP and clear all player debuffs',
  },
  // ── Duplicate combinations ───────────────────────────────────
  {
    id:          'recipe-honed-edge',
    result:      'honed-edge',
    ingredientA: 'whetstone',
    ingredientB: 'whetstone',
    hint:        'Passive +1 attack damage for the entire run',
  },
  {
    id:          'recipe-twin-blades',
    result:      'twin-blades',
    ingredientA: 'throwing-knife',
    ingredientB: 'throwing-knife',
    hint:        'Reusable (5 mana): deal 5 dmg to any revealed enemy, no counter',
  },
  {
    id:          'recipe-smoke-bomb',
    result:      'smoke-bomb',
    ingredientA: 'flash-powder',
    ingredientB: 'flash-powder',
    hint:        'Reusable (5 mana): stun current combat enemy for 3 turns',
  },
]
