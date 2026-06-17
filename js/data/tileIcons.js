// Maps tile types / enemy ids to filenames inside assets/sprites/Items/.
// null = always use emoji fallback for that entry.

export const ITEM_ICONS_BASE = 'assets/sprites/Items/'
export const MONSTER_ICONS_BASE = 'assets/sprites/monsters/'

export const MAGIC_CHEST_OPEN_GIF = 'magic-chest-open.gif'
export const MAGIC_CHEST_GIF_DURATION_MS = 1000

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
  hole:       '../tiles/tile-hole.png',
  checkpoint: null,           // no matching sprite — use emoji
  forge:      'sanctuary-forge.webp',
  exit:       'stairs-down.png', // stairs art (tiles.js: no door emoji)
  well:       'sanctuary-fountain.webp',
  anvil:      'sanctuary-anvil.webp',
  rope:       'sanctuary-rope.webp',
  magic_chest: 'magic-chest-closed.png',
}

/** Keys must match enemy ids from enemies.js / TileEngine createEnemy()
 *  idle: shown normally; attack: swapped in when enemy attacks
 *  Both paths relative to MONSTER_ICONS_BASE. null = emoji fallback.
 */
export const ENEMY_SPRITES = {
  skeleton:      { idle: 'skeleton/skeleton-idle.gif', attack: 'skeleton/skeleton-idle.gif' },
  zombie:        { idle: 'zombie/zombie-creature.png', attack: 'zombie/zombie-creature.png' },
  wraith:        { idle: 'wraith/wraith-creature.png', attack: 'wraith/wraith-creature.png' },
  archer_goblin: { idle: 'archer_goblin/archer-goblin-idle.gif', attack: 'archer_goblin/archer-goblin-attack.gif' },
  treasure_goblin: { idle: 'treasure_goblin/treasure-goblin.png', attack: 'treasure_goblin/treasure-goblin.png' },
  goblin:        { idle: 'goblin/goblin-creature.gif', attack: 'goblin/goblin-creature.gif' },
  troll:         { idle: 'troll/troll-creature.png', attack: 'troll/troll-creature.png' },
  vine_witch:    { idle: 'vine_witch/vine-witch-idle.gif', attack: 'vine_witch/vine-witch-idle.gif' },
  slime:         { idle: 'slime/slime-idle.gif', attack: 'slime/slime-idle.gif' },
  toad_beast:    { idle: 'toad_beast/toad-beast-idle.gif', attack: 'toad_beast/toad-beast-idle.gif' },
  onion:         { idle: 'onion/onion-idle.gif', attack: 'onion/onion-idle.gif' },
  gnome:         { idle: 'gnome/gnome-idle.gif', attack: 'gnome/gnome-idle.gif' },
  spider:        null,
  mouse:         { idle: 'mouse/mouse-idle.gif', attack: 'mouse/mouse-idle.gif' },
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
  skeleton_lord: { idle: 'skeleton_lord/skeleton-lord-creature.png', attack: 'skeleton_lord/skeleton-lord-creature.png' },
  goblin_king:   { idle: 'goblin_king/goblin-king-creature.png', attack: 'goblin_king/goblin-king-creature.png' },
  troll_warlord: { idle: 'troll_warlord/troll-warlord-creature.png', attack: 'troll_warlord/troll-warlord-creature.png' },
  void_maw:        { idle: 'void/void-maw.png', attack: 'void/void-maw.png' },
  void_ghast:      { idle: 'void/void-ghast.png', attack: 'void/void-ghast.png' },
  hook_crawler:    { idle: 'void/hook-crawler.png', attack: 'void/hook-crawler.png' },
  shard_ravager:   { idle: 'void/shard-ravager.png', attack: 'void/shard-ravager.png' },
  void_behemoth:   { idle: 'void/void-behemoth.png', attack: 'void/void-behemoth.png' },
  rift_lich:       { idle: 'void/rift-lich.png', attack: 'void/rift-lich.png' },
  void_overseer:   { idle: 'void/void-overseer.png', attack: 'void/void-overseer.png' },
}

/** Static PNG replacements shown when Child Mode is enabled (paths relative to MONSTER_ICONS_BASE). */
export const CHILD_MODE_SPRITES = {
  skeleton:        'child_mode/cat.png',
  goblin:          'child_mode/bee.png',
  archer_goblin:   'child_mode/cow.png',
  vine_witch:      'child_mode/butterfly.png',
  mouse:           'child_mode/corgi.png',
  treasure_goblin: 'child_mode/kitten-purple.png',
  zombie:          'child_mode/owl.png',
  wraith:          'child_mode/owl.png',
  spider:          'child_mode/rabbit.png',
  slime:           'child_mode/turtle.png',
  troll:           'child_mode/bluey.png',
  toad_beast:      'child_mode/parrot.png',
  onion:           'child_mode/fluffy-cat.png',
  gnome:           'child_mode/fluff-ball.png',
  fire_goblin:     'child_mode/bee-3d.png',
  infected_goblin: 'child_mode/cow-3d.png',
  ogre:                  'child_mode/deer.png',
  frost_giant:           'child_mode/whale.png',
  drowned_hulk_pirate:   'child_mode/octopus.png',
  corrupted_pirate:      'child_mode/fish.png',
  mushroom_harvester:    'child_mode/frog.png',
  rock_golem:            'child_mode/bubble.png',
  corrupted_goblin:      'child_mode/pig-cowbell.png',
  corrupted_cyclops:     'child_mode/elephant.png',
  crystal_spider:        'child_mode/ladybug.png',
  fire_centipede:        'child_mode/snake.png',
  molten_spiderling:     'child_mode/mouse-star.png',
  shadow_bat:            'child_mode/bluebird.png',
  dark_bone_demon:       'child_mode/cow-plush.png',
  crystal_bone_demon:    'child_mode/starfish.png',
  skeleton_lord:         'child_mode/tuxedo-cat.png',
  goblin_king:           'child_mode/duck-star.png',
  troll_warlord:         'child_mode/dolphin.png',
}

/**
 * Resolve a monster sprite path relative to MONSTER_ICONS_BASE (or ITEM_ICONS_BASE fallback).
 * @param {string} enemyId
 * @param {{ state?: 'idle'|'attack', childMode?: boolean }} [opts]
 */
export function resolveEnemySpriteRel(enemyId, { state = 'idle', childMode = false } = {}) {
  if (childMode && CHILD_MODE_SPRITES[enemyId]) {
    return CHILD_MODE_SPRITES[enemyId]
  }
  const sprites = ENEMY_SPRITES[enemyId]
  if (!sprites) return null
  return state === 'attack' ? sprites.attack : sprites.idle
}

/** Full URL path for an enemy tile/combat sprite, or null for emoji fallback. */
export function resolveEnemySpriteSrc(enemyId, { state = 'idle', childMode = false } = {}) {
  const rel = resolveEnemySpriteRel(enemyId, { state, childMode })
  if (rel) return MONSTER_ICONS_BASE + rel
  const file = ENEMY_ICON_FILES[enemyId]
  return file ? ITEM_ICONS_BASE + file : null
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
