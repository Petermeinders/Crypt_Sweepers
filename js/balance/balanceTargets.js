/**
 * Design pillars for balance iteration (targets for tuning, not enforced in-game).
 * See project plan: Game loop fun, balance, and codebase.
 */

export const BALANCE_PILLARS = [
  {
    id: 'ttk',
    title: 'Time-to-kill',
    summary:
      'Standard enemies should often take more than one melee hit early; one-shots should be earned (meta, items, depth), not the default.',
  },
  {
    id: 'meta-identity',
    title: 'Meta role',
    summary:
      'Persistent upgrades should diversify play (survival, mana, economy, traps) rather than stacking flat damage that trivializes floors.',
  },
  {
    id: 'run-pacing',
    title: 'Run pacing',
    summary:
      'Player power growth within a run should stay in step with floor scaling so reveals stay risky and choices stay meaningful.',
  },
]

/**
 * When numbers are off, change one layer at a time. Snapshot tests help compare before/after.
 * Start with the layer that most directly affects the reported gap (baseline vs full-meta trivial kills).
 */
export const RECOMMENDED_TUNING_ORDER = [
  'Global passive flat damage (js/data/passives.js) — largest swing on melee TTK',
  'Enemy base HP and CONFIG.enemy.floorScaleHP (js/data/enemies.js, js/config.js)',
  'Persistent gold income vs passive prices (economy pacing)',
]
