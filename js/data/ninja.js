// Ninja character definition and ability tree.
// Passives: (1) Shadow Step — every melee kill grants 1 stack of Concealment (max 3);
//           next reveal while concealed is silent (no adjacent-lock pulse, +1 dmg bonus).
//           (2) Starts every run with 1 free Shuriken throw.

export const NINJA_BASE = {
  hp:     38,
  mana:   42,
  damage: [1, 1],
  gold:   0,
}

export const NINJA_UPGRADES = {
  // ── Shadowstrike ─────────────────────────────────────────────
  'shadowstrike': {
    name:     'Shadowstrike',
    desc:     'Active ability: vanish and reappear behind a revealed enemy, striking for 1.75× your attack damage with no counter-attack window. Costs 10 mana. Unlocks in your level-up choice pool.',
    icon:     '🥷',
    xpCost:   1200,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'shadowstrike' },
  },
  'shadowstrike-mastery-1': {
    name:     'Shadowstrike Mastery I',
    desc:     '+0.25× damage multiplier on Shadowstrike.',
    icon:     '🥷',
    xpCost:   350,
    manaCost: 12,
    requires: 'shadowstrike',
    masteryOf:'shadowstrike',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'shadowstrike-mastery-2': {
    name:     'Shadowstrike Mastery II',
    desc:     '+0.25× damage multiplier on Shadowstrike.',
    icon:     '🥷',
    xpCost:   500,
    manaCost: 14,
    requires: 'shadowstrike-mastery-1',
    masteryOf:'shadowstrike',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'shadowstrike-mastery-3': {
    name:     'Shadowstrike Mastery III',
    desc:     '+0.25× damage multiplier on Shadowstrike. Shadowstrike no longer costs mana.',
    icon:     '🥷',
    xpCost:   700,
    manaCost: 0,
    requires: 'shadowstrike-mastery-2',
    masteryOf:'shadowstrike',
    effect:   { type: 'mastery-tier-unlock' },
  },

  // ── Smoke Bomb ───────────────────────────────────────────────
  'smoke-bomb': {
    name:     'Smoke Bomb',
    desc:     'Active ability: throw a smoke bomb — all enemies on the current floor lose their lock on adjacent tiles for 1 reveal (they cannot trigger ambush on the next tile you flip). Costs 12 mana.',
    icon:     '💨',
    xpCost:   1500,
    manaCost: 12,
    effect:   { type: 'active-ability', ability: 'smoke-bomb' },
  },
  'smoke-bomb-mastery-1': {
    name:     'Smoke Bomb Mastery I',
    desc:     'Smoke Bomb now suppresses enemy locks for 2 reveals instead of 1.',
    icon:     '💨',
    xpCost:   400,
    manaCost: 14,
    requires: 'smoke-bomb',
    masteryOf:'smoke-bomb',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'smoke-bomb-mastery-2': {
    name:     'Smoke Bomb Mastery II',
    desc:     'Smoke Bomb now suppresses enemy locks for 3 reveals and costs 4 less mana.',
    icon:     '💨',
    xpCost:   600,
    manaCost: 8,
    requires: 'smoke-bomb-mastery-1',
    masteryOf:'smoke-bomb',
    effect:   { type: 'mastery-tier-unlock' },
  },

  // ── Shuriken ─────────────────────────────────────────────────
  'shuriken': {
    name:     'Shuriken',
    desc:     'Active ability: hurl a shuriken at any revealed enemy tile — deals 80% of your attack damage at range, no counter. Costs 6 mana. Unlocks in your level-up choice pool.',
    icon:     '⭐',
    xpCost:   800,
    manaCost: 6,
    effect:   { type: 'active-ability', ability: 'shuriken' },
  },
  'shuriken-mastery-1': {
    name:     'Shuriken Mastery I',
    desc:     '+20% Shuriken damage.',
    icon:     '⭐',
    xpCost:   250,
    manaCost: 8,
    requires: 'shuriken',
    masteryOf:'shuriken',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'shuriken-mastery-2': {
    name:     'Shuriken Mastery II',
    desc:     '+20% Shuriken damage. Shuriken now pierces: if the target dies, deal 50% overflow damage to the nearest revealed enemy.',
    icon:     '⭐',
    xpCost:   450,
    manaCost: 10,
    requires: 'shuriken-mastery-1',
    masteryOf:'shuriken',
    effect:   { type: 'mastery-tier-unlock' },
  },
  'shuriken-mastery-3': {
    name:     'Shuriken Mastery III',
    desc:     '+20% Shuriken damage. Throw 2 shurikens per use.',
    icon:     '⭐',
    xpCost:   700,
    manaCost: 12,
    requires: 'shuriken-mastery-2',
    masteryOf:'shuriken',
    effect:   { type: 'mastery-tier-unlock' },
  },

  // ── Concealment stacks ────────────────────────────────────────
  'shadow-step': {
    name:     'Shadow Step I',
    desc:     'Raise the Shadow Step Concealment cap from 3 to 4 stacks. Each stack makes your next reveal silent (+1 dmg, no adjacent lock pulse).',
    icon:     '🌑',
    xpCost:   600,
    useCostNone: true,
    effect:   { type: 'ninja-passive', passive: 'shadow-step', tier: 1 },
  },
  'shadow-step-2': {
    name:     'Shadow Step II',
    desc:     'Raise the Concealment cap to 5 stacks. Killing a concealed enemy restores 4 mana.',
    icon:     '🌑',
    xpCost:   900,
    useCostNone: true,
    requires: 'shadow-step',
    effect:   { type: 'ninja-passive', passive: 'shadow-step', tier: 2 },
  },
}
