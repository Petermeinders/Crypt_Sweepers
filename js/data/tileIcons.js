// Maps tile types / enemy ids to filenames inside assets/sprites/Items/.
// null = always use emoji fallback for that entry.

export const ITEM_ICONS_BASE = 'assets/sprites/Items/'
export const MONSTER_ICONS_BASE = 'assets/sprites/monsters/'

export const MAGIC_CHEST_OPEN_GIF = 'magic-chest-open.gif'
export const MAGIC_CHEST_GIF_DURATION_MS = 4000

/** Non-enemy tile types */
export const TILE_TYPE_ICON_FILES = {
  empty:      null,           // nothing to show
  gold:       'coin.png',     // coins = gold
  chest:      'chest-closed.png', // static closed; swapped to chest.gif on open
  trap:       null,           // cobweb emoji (tiles.js)
  heart:      'heart.png',    // heart container tile
  shrine:     null,           // removed — kept for safety
  event:      null,           // question mark emoji
  blockage:   '../tiles/rubble.png',
  checkpoint: null,           // no matching sprite — use emoji
  forge:      null,           // emoji ⚒️ fallback
  exit:       'stairs-down.png', // stairs art (tiles.js: no door emoji)
  well:       null,
  anvil:      null,
  rope:       null,
  magic_chest: 'magic-chest-closed.png',
}

/** Keys must match enemy ids from enemies.js / TileEngine createEnemy()
 *  idle: shown normally; attack: swapped in when enemy attacks
 *  Both paths relative to MONSTER_ICONS_BASE. null = emoji fallback.
 */
export const ENEMY_SPRITES = {
  skeleton:      { idle: 'skeleton/skeleton-idle.gif', attack: 'skeleton/skeleton-idle.gif' },
  zombie:        null,
  wraith:        null,
  archer_goblin: { idle: 'archer_goblin/archer-goblin-idle.gif', attack: 'archer_goblin/archer-goblin-attack.gif' },
  goblin:        { idle: 'goblin/goblin-creature.gif', attack: 'goblin/goblin-creature.gif' },
  troll:         { idle: 'ogre/ogre-idle.gif', attack: 'ogre/ogre-idle.gif' },
  vine_witch:    { idle: 'vine_witch/vine-witch-idle.gif', attack: 'vine_witch/vine-witch-idle.gif' },
  slime:         { idle: 'slime/slime-idle.gif', attack: 'slime/slime-idle.gif' },
  toad_beast:    { idle: 'toad_beast/toad-beast-idle.gif', attack: 'toad_beast/toad-beast-idle.gif' },
  onion:         { idle: 'onion/onion-idle.gif', attack: 'onion/onion-idle.gif' },
  gnome:         { idle: 'gnome/gnome-idle.gif', attack: 'gnome/gnome-idle.gif' },
  spider:        null,
  frost_giant:   { idle: 'frost_giant/frost-giant-idle.gif', attack: 'frost_giant/frost-giant-idle.gif' },
  fire_goblin:        { idle: 'fire_goblin/fire-goblin-creature.gif',               attack: 'fire_goblin/fire-goblin-creature.gif' },
  molten_spiderling:  { idle: 'molten_spiderling/molten-spiderling-creature.gif',   attack: 'molten_spiderling/molten-spiderling-creature.gif' },
  fire_centipede:     { idle: 'fire_centipede/fire-centipede.gif',                 attack: 'fire_centipede/fire-centipede.gif' },
  crystal_spider: { idle: 'crystal_spider/crystal-spider-creature.gif', attack: 'crystal_spider/crystal-spider-creature.gif' },
  rock_golem:          { idle: 'rock_golem/rock-golem-creature.gif',                     attack: 'rock_golem/rock-golem-creature.gif' },
  mushroom_harvester:  { idle: 'mushroom_harvester/mushroom-harvester-creature.gif',     attack: 'mushroom_harvester/mushroom-harvester-creature.gif' },
  shadow_bat:          { idle: 'shadow_bat/shadow-bat-creature.gif',                     attack: 'shadow_bat/shadow-bat-creature.gif' },
  ogre:            { idle: 'ogre/ogre-creature.gif',                     attack: 'ogre/ogre-creature.gif' },
  infected_goblin:    { idle: 'infected_goblin/infected-goblin-creature.gif',       attack: 'infected_goblin/infected-goblin-creature.gif' },
  corrupted_cyclops:  { idle: 'corrupted_cyclops/corrupted-cyclops.gif',             attack: 'corrupted_cyclops/corrupted-cyclops.gif' },
  corrupted_goblin:   { idle: 'corrupted_goblin/corrupted-goblin-creature.gif',      attack: 'corrupted_goblin/corrupted-goblin-creature.gif' },
  corrupted_pirate:      { idle: 'corrupted_pirate/corrupted-pirate-creature.gif',            attack: 'corrupted_pirate/corrupted-pirate-creature.gif' },
  drowned_hulk_pirate:   { idle: 'drowned_hulk_pirate/drowned-hulk-pirate-creature.gif',     attack: 'drowned_hulk_pirate/drowned-hulk-pirate-creature.gif' },
  dark_bone_demon:       { idle: 'dark_bone_demon/dark-bone-demon-creature.gif',           attack: 'dark_bone_demon/dark-bone-demon-creature.gif' },
  crystal_bone_demon:    { idle: 'crystal_bone_demon/crystal-bone-demon-creature.gif',         attack: 'crystal_bone_demon/crystal-bone-demon-creature.gif' },
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
  troll:         null,
  vine_witch:    null,
  toad_beast:    null,
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
