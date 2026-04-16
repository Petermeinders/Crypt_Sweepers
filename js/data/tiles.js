// Tile type definitions — plain data only, no functions.
// Factory function lives in TileEngine.js.
// Weights are tuned for floor 1; TileEngine applies floor-depth adjustments.

export const TILE_DEFS = {
  empty:      { emoji: '',     label: '',           cssClass: 'type-empty',      weight: 29, isEnemy: false },
  enemy:      { emoji: '💀',   label: 'enemy',      cssClass: 'type-enemy',      weight: 22, isEnemy: true,  enemyType: 'skeleton'    },
  enemy_fast: { emoji: '⚡',   label: 'fast!',      cssClass: 'type-enemy-fast', weight:  7, isEnemy: true,  enemyType: 'goblin' },
  gold:       { emoji: '🪙',   label: '',           cssClass: 'type-gold',       weight: 16, isEnemy: false },
  chest:      { emoji: '📦',   label: '',           cssClass: 'type-chest',      weight:  7, isEnemy: false },
  trap:       { emoji: '🕸️',   label: '',           cssClass: 'type-trap',       weight:  5, isEnemy: false },
  heart:      { emoji: '❤️',   label: 'heart',      cssClass: 'type-heart',      weight:  2, isEnemy: false },
  event:      { emoji: '❓',   label: 'event',      cssClass: 'type-event',      weight:  3, isEnemy: false },
  blockage:   { emoji: '🪨',   label: '',           cssClass: 'type-blockage',   weight:  4, isEnemy: false },
  /** Open pit — impassable like rubble, but always visible (no flip). */
  hole:       { emoji: '🕳️',  label: '',           cssClass: 'type-hole',       weight:  4, isEnemy: false },
  checkpoint: { emoji: '🏕️',   label: 'camp',       cssClass: 'type-checkpoint', weight:  5, isEnemy: false },
  boss:       { emoji: '☠️',   label: 'BOSS',       cssClass: 'type-boss',       weight:  0, isEnemy: true,  enemyType: 'skeleton_lord' },
  exit:       { emoji: '',     label: '',           cssClass: 'type-exit',       weight:  3, isEnemy: false },
  /** Rest floor only — full heal/mana (see GameController) */
  well:       { emoji: '⛲',   label: '',           cssClass: 'type-well',       weight:  0, isEnemy: false },
  /** Rest floor only — placeholder interaction */
  anvil:      { emoji: '⚒️',   label: '',           cssClass: 'type-anvil',      weight:  0, isEnemy: false },
  /** Rest floor only — climb out with all gold */
  rope:       { emoji: '🧵',   label: '',           cssClass: 'type-rope',       weight:  0, isEnemy: false },
  /** Rest floor only — spend golden keys for premium loot */
  magic_chest: { emoji: '✨',  label: 'Magic Chest', cssClass: 'type-magic-chest', weight: 0, isEnemy: false },
  /** Rest floor only — combine two trinkets into a merged trinket */
  forge:        { emoji: '⚒️',  label: 'Forge',       cssClass: 'type-forge',       weight: 0, isEnemy: false },
  /** Main floor only — entry to a hidden sub-floor (5% chance per floor) */
  sub_floor_entry: { emoji: '🕳️', label: 'Passage',  cssClass: 'type-sub-floor-entry', weight: 0, isEnemy: false },
  /** Sub-floor only — stairs back up to the main floor */
  stairs_up:    { emoji: '🪜',  label: 'Exit',        cssClass: 'type-stairs-up',   weight: 0, isEnemy: false },
  /** Sub-floor only — shrine offering a choice (no combat) */
  shrine:       { emoji: '🗿',  label: 'Shrine',      cssClass: 'type-shrine',      weight: 0, isEnemy: false },
  /** Sub-floor only — depleted passage (already visited) */
  sub_floor_used: { emoji: '',  label: '',             cssClass: 'type-sub-floor-used', weight: 0, isEnemy: false },
  /** Dungeon only — placed by GameController; buffs all enemies until the tile is cleared */
  war_banner: { emoji: '🚩', label: 'War Banner', cssClass: 'type-war-banner', weight: 0, isEnemy: false },
  /** Sub-floor only — map that reveals the main-floor exit when picked up */
  map:    { emoji: '🗺️', label: 'Map',    cssClass: 'type-map',    weight: 0, isEnemy: false },
  /** Sub-floor only — rubble (inert) in cartographer's cache / toxic gas chamber */
  rubble: { emoji: '🪨', label: 'Rubble', cssClass: 'type-rubble', weight: 0, isEnemy: false },
}
