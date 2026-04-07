// Maps tile types / enemy ids to filenames inside assets/sprites/Items/.
// null = always use emoji fallback for that entry.

export const ITEM_ICONS_BASE = 'assets/sprites/Items/'
export const MONSTER_ICONS_BASE = 'assets/sprites/monsters/'

/** Non-enemy tile types */
export const TILE_TYPE_ICON_FILES = {
  empty:      null,           // nothing to show
  gold:       'coin.png',     // coins = gold
  chest:      'chest-closed.png', // static closed; swapped to chest.gif on open
  trap:       null,           // cobweb emoji (tiles.js)
  heart:      'heart.png',    // heart container tile
  shrine:     null,           // removed — kept for safety
  merchant:   null,           // no matching sprite — use emoji
  checkpoint: null,           // no matching sprite — use emoji
  exit:       'stairs-down.png', // stairs art (tiles.js: no door emoji)
  well:       null,
  anvil:      null,
  rope:       null,
}

/** Keys must match enemy ids from enemies.js / TileEngine createEnemy()
 *  idle: shown normally; attack: swapped in when enemy attacks
 *  Both paths relative to MONSTER_ICONS_BASE. null = emoji fallback.
 */
export const ENEMY_SPRITES = {
  skeleton:      { idle: 'skeleton/skeleton-idle.gif', attack: 'skeleton/skeleton-idle.gif' },
  zombie:        null,
  wraith:        null,
  goblin:        { idle: 'goblin/goblin-idle.gif', attack: 'goblin/goblin-strike.gif' },
  goblin_fast:   { idle: 'goblin/goblin-idle.gif', attack: 'goblin/goblin-strike.gif' },
  troll:         { idle: 'ogre/ogre-idle.gif', attack: 'ogre/ogre-idle.gif' },
  vine_witch:    { idle: 'vine_witch/vine-witch-idle.gif', attack: 'vine_witch/vine-witch-idle.gif' },
  slime:         { idle: 'slime/slime-idle.gif', attack: 'slime/slime-idle.gif' },
  onion:         { idle: 'onion/onion-idle.gif', attack: 'onion/onion-idle.gif' },
  gnome:         { idle: 'gnome/gnome-idle.gif', attack: 'gnome/gnome-idle.gif' },
  spider:        null,
  skeleton_lord: null,
  goblin_king:   null,
  troll_warlord: null,
}

// Legacy single-file map (kept for non-animated enemies using Items/ path)
export const ENEMY_ICON_FILES = {
  skeleton:      null,
  zombie:        null,
  wraith:        null,
  goblin:        null,
  goblin_fast:   null,
  troll:         null,
  vine_witch:    null,
  onion:         null,
  gnome:         null,
  spider:        null,
  skeleton_lord: null,
  goblin_king:   null,
  troll_warlord: null,
}

/** Shown when an enemy tile is defeated */
export const TILE_SLAIN_ICON = 'assets/sprites/effects/ashes.png'

/** One-shot VFX: spirit rises and fades over the tile (plays with ashes) */
export const TILE_SPIRIT_RELEASE = 'assets/sprites/effects/dead-spirit-release.png'
