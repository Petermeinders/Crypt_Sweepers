// Item registry — plain data only.
// effect.type is handled by GameController._useItem.

export const ITEMS = {
  'potion-blue': {
    name:      'Mana Potion',
    icon:      '🔵',
    spriteSrc: 'assets/sprites/Items/potionBlue.png',
    rarity:    'common',
    stackable: true,
    maxStack:  5,
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
    rarity:    'common',
    stackable: true,
    maxStack:  5,
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
    rarity:    'common',
    stackable: false,
    blurb:     'Crossed hammer and wrench — just enough kit to tune an edge before the next fight.',
    details: [
      { icon: '⚔️', label: 'Effect',  desc: '+1 attack damage for the rest of this run' },
      { icon: '📦', label: 'Chest',   desc: '~1% chance from normal or magic chests; consumed on find' },
    ],
    effect: { type: 'instant-damage-up', amount: 1 },
  },

  'fire-ring': {
    name:      'Fire Ring',
    icon:      '🔥',
    spriteSrc: 'assets/sprites/Items/fire-ring.png',
    rarity:    'rare',
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
    spriteSrc: 'assets/sprites/Items/lantern.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
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
    spriteSrc: 'assets/sprites/Items/mana-ring.png',
    rarity:    'rare',
    stackable: false,
    blurb:     'An ornate silver band threaded with arcane wire. The inscription reads: "to the attentive, twice the power."',
    details: [
      { icon: '💍', label: 'Passive', desc: '10% chance to gain double mana on each melee hit in combat' },
      { icon: '🔵', label: 'Effect',  desc: 'Each melee hit restores mana; ring procs restore twice as much' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance to appear in chests' },
    ],
    effect: { type: 'passive-mana-ring' },
  },

  'spyglass': {
    name:      'Spyglass',
    icon:      '🔭',
    spriteSrc: 'assets/sprites/Items/spyglass.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Brass and smoked glass — a glimpse through the fog without stepping into it.',
    details: [
      { icon: '🔭', label: 'Use',     desc: 'Activate, then tap one hidden tile to glimpse its nature (no reveal)' },
      { icon: '📦', label: 'Stack',   desc: 'Up to 3 per backpack slot; each use consumes one charge' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'spyglass' },
  },

  'echo-charm': {
    name:      'Echo Charm',
    icon:      '🔔',
    spriteSrc: 'assets/sprites/Items/echo-charm.png',
    rarity:    'rare',
    stackable: false,
    blurb:     'A tiny bell that answers when something falls nearby.',
    details: [
      { icon: '🔔', label: 'Passive', desc: 'When you kill an enemy, orthogonally adjacent hidden tiles show a hint' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-echo-charm' },
  },

  'vampire-fang': {
    name:      'Vampire Fang',
    rarity:    'rare',
    icon:      '🦷',
    spriteSrc: 'assets/sprites/Items/vampire-fang.png',
    stackable: false,
    blurb:     'A chipped tooth that still remembers the taste of victory.',
    details: [
      { icon: '🦷', label: 'Passive', desc: 'Heal 1 HP when you slay an enemy' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-vampire-fang' },
  },

  'glass-cannon-shard': {
    name:      'Glass Cannon Shard',
    rarity:    'rare',
    icon:      '💠',
    spriteSrc: 'assets/sprites/Items/glass-cannon-shard.png',
    stackable: false,
    blurb:     'A razor-sharp fragment of something that shatters beautifully.',
    details: [
      { icon: '⚔️', label: 'Passive', desc: 'Above 50% HP: +50% damage to enemies. Below 50% HP: −50% damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-glass-cannon-shard' },
  },

  'duelists-glove': {
    name:      "Duelist's Glove",
    rarity:    'rare',
    icon:      '🧤',
    spriteSrc: 'assets/sprites/Items/duelists-glove.png',
    stackable: false,
    blurb:     'Worn leather that remembers the first clean line of every duel.',
    details: [
      { icon: '🧤', label: 'Passive', desc: 'Your first melee hit against each enemy deals +1 damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-duelists-glove' },
  },

  'surge-pearl': {
    name:      'Surge Pearl',
    rarity:    'rare',
    icon:      '⚪',
    spriteSrc: 'assets/sprites/Items/surge-pearl.png',
    stackable: false,
    blurb:     'A pearl that pulses when a spell leaves your hand.',
    details: [
      { icon: '🔵', label: 'Passive', desc: '20% chance on basic spell cast to refund half the mana spent' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-surge-pearl' },
  },

  'still-water-amulet': {
    name:      'Still Water Amulet',
    rarity:    'rare',
    icon:      '💧',
    spriteSrc: 'assets/sprites/Items/still-water-amulet.png',
    stackable: false,
    blurb:     'Still water runs deep — and cheap spells, if you wait.',
    details: [
      { icon: '🔵', label: 'Passive', desc: 'After 10 turns without using mana (basic spell or any active ability), your next mana ability costs 35% less' },
      { icon: '⏱️', label: 'Turns',   desc: 'Turns advance on tile flips and melee combat actions' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-still-water-amulet' },
  },

  'greed-tooth': {
    name:      'Greed Tooth',
    rarity:    'rare',
    icon:      '🤑',
    spriteSrc: 'assets/sprites/Items/greed-tooth.png',
    stackable: false,
    blurb:     'A gold tooth that hungers for more — and pays for it in blood.',
    details: [
      { icon: '🪙', label: 'Passive', desc: '+1 gold whenever you kill an enemy' },
      { icon: '🕸️', label: 'Risk',    desc: '+1 damage taken from traps' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-greed-tooth' },
  },

  'lucky-rabbit-foot': {
    name:      'Lucky Rabbit Foot',
    rarity:    'rare',
    icon:      '🐇',
    spriteSrc: 'assets/sprites/Items/lucky-rabbit-foot.png',
    stackable: false,
    blurb:     'A soft charm that steps aside for the worst blows.',
    details: [
      { icon: '🍀', label: 'Passive', desc: '2% chance to completely avoid any incoming damage' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-lucky-rabbit-foot' },
  },

  'cursed-lockpick': {
    name:      'Cursed Lockpick',
    rarity:    'rare',
    icon:      '🗝️',
    spriteSrc: 'assets/sprites/Items/cursed-lockpick.png',
    stackable: false,
    blurb:     'A bent pick that whispers of better locks.',
    details: [
      { icon: '📦', label: 'Passive', desc: 'Chests have a chance to upgrade to a rare or legendary trinket' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-cursed-lockpick' },
  },

  // ── Common Consumables ──────────────────────────────────────

  'rope-coil': {
    name:      'Rope Coil',
    icon:      '🪢',
    spriteSrc: 'assets/sprites/Items/rope-coil.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'A length of sturdy rope. Lash it across a pit, loop it round a snare — whatever it takes.',
    details: [
      { icon: '🪤', label: 'Use',      desc: 'Completely negate the next trap you reveal — no damage taken' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'rope-coil' },
  },

  'bandage-roll': {
    name:      'Bandage Roll',
    icon:      '🩹',
    spriteSrc: 'assets/sprites/Items/bandage-roll.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Clean linen and a steady hand. Stops the bleeding now and keeps mending for the next few steps.',
    details: [
      { icon: '❤️', label: 'Heal',     desc: 'Restores 3 HP immediately, then 1 HP per turn for 3 more turns' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'bandage-roll' },
  },

  'shield-shard': {
    name:      'Shield Shard',
    icon:      '🛡️',
    spriteSrc: 'assets/sprites/Items/shield-shard.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'A broken piece of a palladin\'s shield. Just enough left to catch one blow.',
    details: [
      { icon: '🛡️', label: 'Use',      desc: 'Absorbs the very next enemy hit entirely — then it shatters' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'shield-shard' },
  },

  'smelling-salts': {
    name:      'Smelling Salts',
    icon:      '💨',
    spriteSrc: 'assets/sprites/Items/smelling-salts.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'A sharp ammonia snap that cuts through fog and curse alike.',
    details: [
      { icon: '💨', label: 'Use',      desc: 'Instantly clears all active debuffs (Teary Eyes, burn, poison)' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'smelling-salts' },
  },

  'sonic-ear': {
    name:      'Sonic Ear',
    icon:      '👂',
    spriteSrc: 'assets/sprites/Items/sonic-ear.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Press it to the stone and count the heartbeats. The dungeon doesn\'t lie.',
    details: [
      { icon: '👂', label: 'Use',      desc: 'Reveals the exact number of living enemies still hidden on this floor' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'sonic-ear' },
  },

  'throwing-knife': {
    name:      'Throwing Knife',
    icon:      '🗡️',
    spriteSrc: 'assets/sprites/Items/throwing-knife.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Balanced for the throw, not the follow-up. Strike from a distance — no counter.',
    details: [
      { icon: '🗡️', label: 'Use',      desc: 'Tap to activate, then tap any revealed living enemy — deal 3 damage with no counter-attack' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'throwing-knife' },
  },

  'flash-powder': {
    name:      'Flash Powder',
    icon:      '✨',
    spriteSrc: 'assets/sprites/Items/flash-powder.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'A pinch of alchemist\'s dust. Blind them for two turns — that\'s all you need.',
    details: [
      { icon: '✨', label: 'Use',      desc: 'Stuns the enemy in your current fight for 2 turns — they cannot counter-attack' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'flash-powder' },
  },

  'rusty-nail': {
    name:      'Rusty Nail',
    icon:      '📌',
    spriteSrc: 'assets/sprites/Items/rusty-nail.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Corroded iron, still sharp enough. What it lacks in damage it makes up for in persistence.',
    details: [
      { icon: '📌', label: 'Use',      desc: 'Tap to activate, then tap any revealed living enemy — poisons them for 1 damage per turn for 5 turns' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'rusty-nail' },
  },

  'loose-pouch': {
    name:      'Loose Pouch',
    icon:      '💰',
    spriteSrc: 'assets/sprites/Items/loose-pouch.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'Someone dropped it in a hurry. Their loss.',
    details: [
      { icon: '🪙', label: 'Use',      desc: 'Spills 3–6 gold directly into your purse' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'loose-pouch' },
  },

  'whetstone': {
    name:      'Whetstone',
    icon:      '🪨',
    spriteSrc: 'assets/sprites/Items/whetstone.png',
    rarity:    'common',
    stackable: true,
    maxStack:  3,
    blurb:     'A few strokes on the stone and the edge bites again. Good for three swings.',
    details: [
      { icon: '⚔️', label: 'Use',      desc: '+1 bonus damage on your next 3 melee hits' },
      { icon: '⚡', label: 'One-time', desc: 'Consumed on use; stacks up to 3' },
    ],
    effect: { type: 'whetstone' },
  },

  // ── Legendary consumable ────────────────────────────────────

  'hourglass-sand': {
    name:      'Hourglass Sand',
    rarity:    'legendary',
    icon:      '⏳',
    spriteSrc: 'assets/sprites/Items/hourglass-sand.png',
    stackable: false,
    blurb:     'A pinch of sand that falls upward — once, then again, until you run dry.',
    details: [
      { icon: '⏳', label: 'Use',     desc: 'Undo your last tile reveal (infinite uses)' },
      { icon: '💀', label: 'Cost',    desc: 'Drains all mana, and 1 HP and 1 gold each use' },
      { icon: '🎲', label: 'Legendary', desc: '1% chance from chests' },
    ],
    effect: { type: 'hourglass-sand' },
  },

  'thorn-wrap': {
    name:      'Thorn Wrap',
    rarity:    'rare',
    icon:      '🌿',
    spriteSrc: 'assets/sprites/Items/thorn-wrap.png',
    stackable: false,
    blurb:     'Woven briars still sharp enough to answer back. Every blow you take draws blood from the one who dealt it.',
    details: [
      { icon: '🌿', label: 'Passive', desc: 'Deal 1 damage to any enemy that hits you' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-thorn-wrap' },
  },

  'misers-pouch': {
    name:      "Miser's Pouch",
    rarity:    'rare',
    icon:      '👝',
    spriteSrc: 'assets/sprites/Items/misers-pouch.png',
    stackable: false,
    blurb:     'A coin purse that stretches for gold — but chests feel the pinch.',
    details: [
      { icon: '🪙', label: 'Passive', desc: '+1 gold from every enemy kill' },
      { icon: '📦', label: 'Curse',   desc: 'Chest loot is always gold — no items' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-misers-pouch' },
  },

  'cracked-compass': {
    name:      'Cracked Compass',
    rarity:    'rare',
    icon:      '🧭',
    spriteSrc: 'assets/sprites/Items/cracked-compass.png',
    stackable: false,
    blurb:     'The needle is bent, but it still knows the way out.',
    details: [
      { icon: '🧭', label: 'Passive', desc: 'The exit tile is revealed at the start of every floor' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-cracked-compass' },
  },

  'plague-mask': {
    name:      'Plague Mask',
    rarity:    'rare',
    icon:      '😷',
    spriteSrc: 'assets/sprites/Items/plague-mask.png',
    stackable: false,
    blurb:     'The leather smells of ash and old medicine. It muffles the blows — and your own.',
    details: [
      { icon: '🛡️', label: 'Passive', desc: 'Take 1 less damage from all sources' },
      { icon: '⚔️', label: 'Curse',   desc: 'Deal 1 less damage to enemies (min 1)' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-plague-mask' },
  },

  'soul-candle': {
    name:      'Soul Candle',
    rarity:    'rare',
    icon:      '🕯️',
    spriteSrc: 'assets/sprites/Items/soul-candle.png',
    stackable: false,
    blurb:     'A candle that burns a little brighter each time something dies near it.',
    details: [
      { icon: '🕯️', label: 'Passive', desc: '20% chance to restore 1 mana on every enemy kill' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-soul-candle' },
  },

  'blood-pact': {
    name:      'Blood Pact',
    rarity:    'rare',
    icon:      '🩸',
    spriteSrc: 'assets/sprites/Items/blood-pact.png',
    stackable: false,
    blurb:     'Sign in blood, gain in steel — but the debt is paid the moment you let go.',
    details: [
      { icon: '⚔️', label: 'On Equip', desc: '+2 attack damage; lose 3 max HP (healed proportionally)' },
      { icon: '💔', label: 'On Drop',  desc: 'The +2 damage is lost; 3 max HP is restored' },
      { icon: '🎲', label: 'Rare',     desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-blood-pact' },
  },

  'bone-dice': {
    name:      'Bone Dice',
    rarity:    'rare',
    icon:      '🎲',
    spriteSrc: 'assets/sprites/Items/bone-dice.png',
    stackable: false,
    blurb:     'Carved from something that used to walk. Roll them and watch the dungeon rebalance itself.',
    details: [
      { icon: '🎲', label: 'Use',      desc: 'Re-rolls all revealed living enemies\' HP and damage stats. Costs 10 mana.' },
      { icon: '♾️', label: 'Reusable', desc: 'Can be used every floor, unlimited times' },
      { icon: '🎰', label: 'Legendary', desc: 'Rare find from magic chest' },
    ],
    effect: { type: 'bone-dice' },
  },

  'hunger-stone': {
    name:      'Hunger Stone',
    rarity:    'rare',
    icon:      '🪨',
    spriteSrc: null,
    stackable: false,
    blurb:     'Heavy, cold, and relentless. It feeds on your vitality — and sharpens your edge.',
    details: [
      { icon: '⚔️', label: 'Passive', desc: '+1 max attack damage on each new floor' },
      { icon: '💔', label: 'Cost',    desc: 'Lose 2 HP at the start of each new floor (can be lethal)' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-hunger-stone' },
  },

  'gamblers-mark': {
    name:      "Gambler's Mark",
    rarity:    'rare',
    icon:      '♠️',
    spriteSrc: 'assets/sprites/Items/gamblers-mark.png',
    stackable: false,
    blurb:     'A brand burned into the palm. Every coin you earn is a wager — double or nothing.',
    details: [
      { icon: '🪙', label: 'Passive', desc: 'All gold rewards from enemies and tiles are ×0 or ×2 (coin flip)' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-gamblers-mark' },
  },

  'witching-stone': {
    name:      'Witching Stone',
    rarity:    'rare',
    icon:      '🔮',
    spriteSrc: 'assets/sprites/Items/witching-stone.png',
    stackable: false,
    blurb:     'The stone drinks from you with every incantation. Power has a price paid in flesh.',
    details: [
      { icon: '🔮', label: 'Passive', desc: 'Each spell cast costs an additional 1 HP' },
      { icon: '🎲', label: 'Rare',    desc: '3% chance from magic chest' },
    ],
    effect: { type: 'passive-witching-stone' },
  },

  // ── Legendary Trinkets ──────────────────────────────────────

  'forsaken-idol': {
    name:      'Forsaken Idol',
    rarity:    'legendary',
    icon:      '🗿',
    spriteSrc: 'assets/sprites/Items/forsaken-idol.png',
    stackable: false,
    blurb:     'An ancient effigy that sees everything — and leaves you half the man you were.',
    details: [
      { icon: '👁️', label: 'Passive',   desc: 'All enemies on each floor are revealed the moment you enter' },
      { icon: '💔', label: 'Curse',     desc: 'Your max HP is permanently halved while you hold this' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-forsaken-idol' },
  },

  'stormcallers-fist': {
    name:      "Stormcaller's Fist",
    rarity:    'legendary',
    icon:      '⚡',
    spriteSrc: 'assets/sprites/Items/stormcallers-fist.png',
    stackable: false,
    blurb:     'Every fifth blow calls the storm down. The dungeon shakes.',
    details: [
      { icon: '⚡', label: 'Passive',   desc: 'Every 5th melee hit, lightning strikes all revealed living enemies for 20% of your damage (min 1)' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-stormcallers-fist' },
  },

  'mirror-of-vanity': {
    name:      'Mirror of Vanity',
    rarity:    'legendary',
    icon:      '🪞',
    spriteSrc: 'assets/sprites/Items/mirror-of-vanity.png',
    blurb:     'It shows you at your best — and the reflection strikes for you.',
    details: [
      { icon: '🪞', label: 'Passive',   desc: '+20% of your current HP added as flat bonus damage to every attack and spell' },
      { icon: '📉', label: 'Note',      desc: 'Bonus shrinks as you take damage — stay healthy to hit hard' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-mirror-of-vanity' },
  },

  'deathmask': {
    name:      'Deathmask of the Fallen',
    rarity:    'legendary',
    icon:      '💀',
    spriteSrc: 'assets/sprites/Items/deathmask.png',
    stackable: false,
    blurb:     'Wear the face of the dead and the next one comes to you willingly.',
    details: [
      { icon: '💀', label: 'Passive',   desc: 'On kill: 25% chance — the next enemy you reveal is instantly slain (no combat)' },
      { icon: '🪙', label: 'Note',      desc: 'Instant kills still grant gold and XP' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-deathmask' },
  },

  'traded-codex': {
    name:      'The Traded Codex',
    rarity:    'legendary',
    icon:      '📖',
    spriteSrc: 'assets/sprites/Items/traded-codex.png',
    stackable: false,
    blurb:     'Written in blood on every page: the lower you fall, the louder the words speak.',
    details: [
      { icon: '📖', label: 'Passive',   desc: 'Spell damage scales with missing HP — full HP = 1×, 50% HP = 2×, near death = up to 3×' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-traded-codex' },
  },

  'philosophers-coin': {
    name:      "Philosopher's Coin",
    rarity:    'legendary',
    icon:      '🥇',
    spriteSrc: 'assets/sprites/Items/philosophers-coin.png',
    stackable: false,
    blurb:     'It turns potions into gold and gold into legend.',
    details: [
      { icon: '🥇', label: 'Passive',   desc: 'Potions found are instantly converted to gold instead' },
      { icon: '🪙', label: 'Bonus',     desc: 'All gold tile and enemy gold rewards are worth 5×' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-philosophers-coin' },
  },

  // ── New common ───────────────────────────────────────────────

  "scavengers-bag": {
    name:      "Scavenger's Bag",
    rarity:    'common',
    icon:      '🎒',
    spriteSrc: null,
    stackable: false,
    blurb:     'A well-worn satchel with many pockets. The dungeon gives up more than it seems.',
    details: [
      { icon: '🪙', label: 'Passive', desc: '5% chance each empty tile reveals 1 bonus gold' },
      { icon: '🎲', label: 'Common',  desc: 'Can appear in chests' },
    ],
    effect: { type: 'passive-scavengers-bag' },
  },

  // ── New rare ─────────────────────────────────────────────────

  'spiked-collar': {
    name:      'Spiked Collar',
    rarity:    'rare',
    icon:      '⛓️',
    spriteSrc: null,
    stackable: false,
    blurb:     'Forged for something bigger than you. It bites back — but so do you.',
    details: [
      { icon: '⚔️', label: 'Passive', desc: '+3 melee damage' },
      { icon: '💔', label: 'Cost',    desc: 'Deal 1 damage to yourself on every melee attack' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-spiked-collar' },
  },

  'eagle-eye': {
    name:      'Eagle Eye',
    rarity:    'rare',
    icon:      '🦅',
    spriteSrc: null,
    stackable: false,
    blurb:     'After a kill, you spot a gap in the dungeon\'s pattern. One free move, anywhere.',
    details: [
      { icon: '🦅', label: 'Passive', desc: 'After killing an enemy, your next tile flip ignores adjacency — reach anywhere on the grid' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-eagle-eye' },
  },

  'mending-moss': {
    name:      'Mending Moss',
    rarity:    'rare',
    icon:      '🌿',
    spriteSrc: null,
    stackable: false,
    blurb:     'Damp and faintly warm. Press it to a wound between floors and let nature work.',
    details: [
      { icon: '❤️', label: 'Passive', desc: 'Restore 3 HP at the start of each new floor' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-mending-moss' },
  },

  'hollowed-acorn': {
    name:      'Hollowed Acorn',
    rarity:    'rare',
    icon:      '🌰',
    spriteSrc: null,
    stackable: false,
    blurb:     'Carved into a vessel for arcane energy. Holds more — but the flow is sluggish.',
    details: [
      { icon: '🔵', label: 'Passive', desc: '+10 max mana' },
      { icon: '💔', label: 'Cost',    desc: 'Mana potions restore half their usual amount' },
      { icon: '🎲', label: 'Rare',    desc: '2% chance from chests' },
    ],
    effect: { type: 'passive-hollowed-acorn' },
  },

  'plague-rat-skull': {
    name:      'Plague Rat Skull',
    rarity:    'rare',
    icon:      '🐀',
    spriteSrc: null,
    stackable: false,
    blurb:     'Still festers with something ancient. Your afflictions spread faster and bite harder.',
    details: [
      { icon: '☠️', label: 'Passive', desc: 'All damage-over-time effects (poison, burn) deal +1 damage per tick' },
      { icon: '🎲', label: 'Rare',    desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-plague-rat-skull' },
  },

  // ── New legendary ─────────────────────────────────────────────

  'paupers-crown': {
    name:      "Pauper's Crown",
    rarity:    'legendary',
    icon:      '👑',
    spriteSrc: null,
    stackable: false,
    blurb:     'A crown of thorns and tin. Your gold is your life — literally.',
    details: [
      { icon: '🪙', label: 'Passive',   desc: 'All damage you take drains gold first instead of HP' },
      { icon: '💔', label: 'Cost',      desc: 'When gold runs out, damage hits HP as normal' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-paupers-crown' },
  },

  'soulbound-blade': {
    name:      'Soulbound Blade',
    rarity:    'legendary',
    icon:      '⚔️',
    spriteSrc: null,
    stackable: false,
    blurb:     'It grows with each life it takes. The dungeon is its whetstone.',
    details: [
      { icon: '⚔️', label: 'Passive',   desc: 'Each enemy killed permanently adds +0.1 to your base damage this run' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-soulbound-blade' },
  },

  'twin-fates': {
    name:      'Twin Fates',
    rarity:    'legendary',
    icon:      '🎴',
    spriteSrc: null,
    stackable: false,
    blurb:     'Fortune and ruin walk side by side. Each floor is a coin flip.',
    details: [
      { icon: '🎴', label: 'Passive',   desc: 'At the start of each floor: 50% chance +4 max HP, 50% chance −2 max HP. Compounding.' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-twin-fates' },
  },

  'abyssal-lens': {
    name:      'Abyssal Lens',
    rarity:    'legendary',
    icon:      '🔍',
    spriteSrc: null,
    stackable: false,
    blurb:     'It sees everything. The dungeon notices.',
    details: [
      { icon: '🔍', label: 'Passive',   desc: 'All tile types are visible before you reveal them' },
      { icon: '⚡', label: 'Cost',      desc: 'Every tile reveal also randomly reveals one other tile. Revealed enemies deal 1 ambush damage; fast enemies deal +1 more' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-abyssal-lens' },
  },

  'resurrection-stone': {
    name:      'Resurrection Stone',
    rarity:    'legendary',
    icon:      '💎',
    spriteSrc: null,
    stackable: false,
    blurb:     'It pulses faintly in your palm. Once. Then never again.',
    details: [
      { icon: '💎', label: 'Passive',   desc: 'When you would die, survive with half your max HP restored. One time only — the stone then crumbles.' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-resurrection-stone' },
  },

  'wardens-brand': {
    name:      "Warden's Brand",
    rarity:    'legendary',
    icon:      '🛡️',
    spriteSrc: null,
    stackable: false,
    blurb:     'Burned into the skin of dungeon wardens. Nothing catches you off guard.',
    details: [
      { icon: '🛡️', label: 'Passive',   desc: 'You are never ambushed — enemies deal no damage when first revealed, regardless of type' },
      { icon: '🌟', label: 'Legendary', desc: 'Magic chest only' },
    ],
    effect: { type: 'passive-wardens-brand' },
  },

  // ── Forged (Merged) Trinkets ─────────────────────────────────
  // Created at the Sanctuary Forge by combining two ingredients.
  // spriteSrc is null until art is provided.

  'sanguine-covenant': {
    name:      'Sanguine Covenant',
    rarity:    'merged',
    icon:      '⚗️',
    spriteSrc: null,
    stackable: false,
    blurb:     'Blood and steel, bound by an oath neither party survives alone. The sacrifice is permanent. The power is not.',
    details: [
      { icon: '⚔️', label: 'On Equip', desc: '+3 attack damage; max HP is halved' },
      { icon: '🦷', label: 'Passive',  desc: 'Heal 2 HP on every enemy kill' },
      { icon: '⚒️', label: 'Forged',   desc: 'Vampire Fang + Blood Pact' },
    ],
    effect: { type: 'passive-sanguine-covenant' },
  },

  'inferno-barbs': {
    name:      'Inferno Barbs',
    rarity:    'merged',
    icon:      '🌋',
    spriteSrc: null,
    stackable: false,
    blurb:     'Thorns wreathed in living flame. Strike the hand that reaches for you — and leave it burning.',
    details: [
      { icon: '🌿', label: 'Passive', desc: 'Reflect 2 damage to any enemy that hits you' },
      { icon: '🔥', label: 'Burn',   desc: 'Each reflection also applies 1 burn stack to the attacker' },
      { icon: '⚒️', label: 'Forged', desc: 'Fire Ring + Thorn Wrap' },
    ],
    effect: { type: 'passive-inferno-barbs' },
  },

  'resonance-core': {
    name:      'Resonance Core',
    rarity:    'merged',
    icon:      '🔮',
    spriteSrc: null,
    stackable: false,
    blurb:     'A pearl threaded through a bell that rings twice. The magic remembers — and answers.',
    details: [
      { icon: '🔔', label: 'Passive',  desc: 'On enemy kill: adjacent hidden tiles show an echo hint' },
      { icon: '⚪', label: 'Spell',    desc: '30% chance after any spell to fully refund its mana cost' },
      { icon: '⚒️', label: 'Forged',  desc: 'Echo Charm + Surge Pearl' },
    ],
    effect: { type: 'passive-resonance-core' },
  },

  'devils-gambit': {
    name:      "Devil's Gambit",
    rarity:    'merged',
    icon:      '🃏',
    spriteSrc: null,
    stackable: false,
    blurb:     'Every step is a wager. Most days the house loses.',
    details: [
      { icon: '🐇', label: 'Dodge',  desc: '5% chance to completely avoid any incoming damage' },
      { icon: '🪙', label: 'Gold',   desc: '20% chance enemy gold drops double' },
      { icon: '⚒️', label: 'Forged', desc: 'Lucky Rabbit Foot + Bone Dice' },
    ],
    effect: { type: 'passive-devils-gambit' },
  },

  'navigators-chart': {
    name:      "Navigator's Chart",
    rarity:    'merged',
    icon:      '🗺️',
    spriteSrc: null,
    stackable: false,
    blurb:     'A map stitched from broken instruments. It can only be right once per floor — but once is enough.',
    details: [
      { icon: '🗺️', label: 'Use',     desc: 'Reveals all hidden tiles on the current floor' },
      { icon: '♾️', label: 'Reusable', desc: 'Once per floor — renews when you advance' },
      { icon: '⚒️', label: 'Forged',  desc: 'Spyglass + Cracked Compass' },
    ],
    effect: { type: 'navigators-chart' },
  },

  'temporal-wick': {
    name:      'Temporal Wick',
    rarity:    'merged',
    icon:      '🕯️',
    spriteSrc: null,
    stackable: false,
    blurb:     'The flame burns backward when you need it to. Life and time, spent carefully.',
    details: [
      { icon: '⏳', label: 'Use',     desc: 'Undo your last tile reveal (infinite uses). Costs all mana, 1 gold, and 1 HP — then restores 15% max HP.' },
      { icon: '🕯️', label: 'Passive', desc: '30% chance to restore 1 mana on every enemy kill' },
      { icon: '⚒️', label: 'Forged',  desc: 'Hourglass Sand + Soul Candle' },
    ],
    effect: { type: 'temporal-wick' },
  },

  'infected-blade': {
    name:      'Infected Blade',
    rarity:    'merged',
    icon:      '🗡️',
    spriteSrc: null,
    stackable: false,
    blurb:     'The mask filters what it catches; the blade spreads what it finds. A walking pestilence.',
    details: [
      { icon: '🛡️', label: 'Passive', desc: 'Take 1 less damage from all sources' },
      { icon: '☣️', label: 'On Hit',  desc: 'Every melee hit poisons the enemy (1 dmg/turn × 3 turns)' },
      { icon: '⚒️', label: 'Forged',  desc: 'Plague Mask + Rusty Nail' },
    ],
    effect: { type: 'passive-infected-blade' },
  },

  'vault-key': {
    name:      'Vault Key',
    rarity:    'merged',
    icon:      '🗝️',
    spriteSrc: null,
    stackable: false,
    blurb:     'Opens every door — including the one to the surface. Some of what you carry always finds its way home.',
    details: [
      { icon: '🪙', label: 'Passive', desc: '+2 gold on every enemy kill' },
      { icon: '🏦', label: 'Bank',    desc: '15% of all earned gold auto-deposits to your persistent gold bank' },
      { icon: '⚒️', label: 'Forged',  desc: "Miser's Pouch + Greed Tooth" },
    ],
    effect: { type: 'passive-vault-key' },
  },

  'razors-edge': {
    name:      "Razor's Edge",
    rarity:    'merged',
    icon:      '💠',
    spriteSrc: null,
    stackable: false,
    blurb:     'Sharpened past the point of reason. Every swing lands exactly where the math says it should.',
    details: [
      { icon: '⚔️', label: 'Passive',  desc: 'Always deal maximum possible damage (no random roll)' },
      { icon: '💔', label: 'On Equip', desc: '−10 max HP while held' },
      { icon: '⚒️', label: 'Forged',   desc: 'Whetstone + Glass Cannon Shard' },
    ],
    effect: { type: 'passive-razors-edge' },
  },

  'field-kit': {
    name:      'Field Kit',
    rarity:    'merged',
    icon:      '🧰',
    spriteSrc: null,
    stackable: false,
    blurb:     'Everything a soldier needs to keep moving: a bandage and a sharp snap of something acrid.',
    details: [
      { icon: '🧰', label: 'Use',      desc: 'Heals 5 HP and clears all active debuffs (burn, poison, corruption, freeze, teary eyes)' },
      { icon: '🔵', label: 'Cost',     desc: 'Costs 5 mana per use' },
      { icon: '♾️', label: 'Reusable', desc: 'Never consumed — use as many times as you have mana' },
      { icon: '⚒️', label: 'Forged',   desc: 'Smelling Salts + Bandage Roll' },
    ],
    effect: { type: 'field-kit' },
  },

  'honed-edge': {
    name:      'Honed Edge',
    rarity:    'merged',
    icon:      '⚔️',
    spriteSrc: null,
    stackable: false,
    blurb:     'Two stones, one edge. It will not dull.',
    details: [
      { icon: '⚔️', label: 'Passive', desc: '+1 permanent attack damage for this run (stacks with other bonuses)' },
      { icon: '⚒️', label: 'Forged',  desc: 'Whetstone + Whetstone' },
    ],
    effect: { type: 'passive-honed-edge' },
  },

  'twin-blades': {
    name:      'Twin Blades',
    rarity:    'merged',
    icon:      '⚔️',
    spriteSrc: null,
    stackable: false,
    blurb:     'One knife is a warning. Two is a promise.',
    details: [
      { icon: '⚔️', label: 'Use',      desc: 'Deal 5 damage to any revealed living enemy — no counter-attack' },
      { icon: '🔵', label: 'Cost',     desc: 'Costs 5 mana per use' },
      { icon: '♾️', label: 'Reusable', desc: 'Never consumed' },
      { icon: '⚒️', label: 'Forged',   desc: 'Throwing Knife + Throwing Knife' },
    ],
    effect: { type: 'twin-blades' },
  },

  'smoke-bomb': {
    name:      'Smoke Bomb',
    rarity:    'merged',
    icon:      '💨',
    spriteSrc: null,
    stackable: false,
    blurb:     'Double the powder, double the cloud. Three turns of silence.',
    details: [
      { icon: '💨', label: 'Use',      desc: 'Stun the enemy in your current fight for 3 turns — they cannot counter-attack' },
      { icon: '🔵', label: 'Cost',     desc: 'Costs 5 mana per use' },
      { icon: '♾️', label: 'Reusable', desc: 'Never consumed; only usable during combat' },
      { icon: '⚒️', label: 'Forged',   desc: 'Flash Powder + Flash Powder' },
    ],
    effect: { type: 'smoke-bomb' },
  },
}
