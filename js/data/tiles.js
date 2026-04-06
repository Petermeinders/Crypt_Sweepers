// Tile type definitions — plain data only, no functions.
// Factory function lives in TileEngine.js.
// Weights are tuned for floor 1; TileEngine applies floor-depth adjustments.

export const TILE_DEFS = {
  empty:      { emoji: '',     label: '',           cssClass: 'type-empty',      weight: 29, isEnemy: false },
  enemy:      { emoji: '💀',   label: 'enemy',      cssClass: 'type-enemy',      weight: 22, isEnemy: true,  enemyType: 'skeleton'    },
  enemy_fast: { emoji: '⚡',   label: 'fast!',      cssClass: 'type-enemy-fast', weight:  7, isEnemy: true,  enemyType: 'goblin_fast' },
  gold:       { emoji: '🪙',   label: '',           cssClass: 'type-gold',       weight: 16, isEnemy: false },
  chest:      { emoji: '📦',   label: '',           cssClass: 'type-chest',      weight:  7, isEnemy: false },
  trap:       { emoji: '🕸️',   label: '',           cssClass: 'type-trap',       weight:  5, isEnemy: false },
  heart:      { emoji: '❤️',   label: 'heart',      cssClass: 'type-heart',      weight:  2, isEnemy: false },
  merchant:   { emoji: '🎲',   label: 'merchant',   cssClass: 'type-merchant',   weight:  3, isEnemy: false },
  checkpoint: { emoji: '🏕️',   label: 'camp',       cssClass: 'type-checkpoint', weight:  5, isEnemy: false },
  boss:       { emoji: '☠️',   label: 'BOSS',       cssClass: 'type-boss',       weight:  0, isEnemy: true,  enemyType: 'skeleton_lord' },
  exit:       { emoji: '',     label: '',           cssClass: 'type-exit',       weight:  3, isEnemy: false },
  /** Rest floor only — full heal/mana (see GameController) */
  well:       { emoji: '⛲',   label: '',           cssClass: 'type-well',       weight:  0, isEnemy: false },
  /** Rest floor only — placeholder interaction */
  anvil:      { emoji: '⚒️',   label: '',           cssClass: 'type-anvil',      weight:  0, isEnemy: false },
  /** Rest floor only — climb out with all gold */
  rope:       { emoji: '🧵',   label: '',           cssClass: 'type-rope',       weight:  0, isEnemy: false },
}
