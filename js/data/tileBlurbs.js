// Info card content for non-enemy tile types

export const TILE_BLURBS = {
  gold:       { label: 'Gold Coins',      emoji: '🪙', blurb: 'Loose coins dropped by those who came before. Every piece counts.' },
  chest:      { label: 'Treasure Chest',  emoji: '📦', blurb: 'A battered chest bound with iron. Something valuable waits inside.' },
  trap:       {
    label: 'Trap',
    emoji: '🕸️',
    blurb: 'A hidden snare left by dungeon dwellers. Cobwebs mark where careless explorers tripped the mechanism.',
    modalSubtext: 'When you continue, the trap springs — you take damage. Trap reduction from abilities still applies.',
  },
  heart:      { label: 'Sacred Heart',    emoji: '❤️', blurb: 'A pulsing relic of ancient life magic. Incredibly rare. Those who find one feel their very blood strengthen.' },
  merchant:   { label: 'Goblin Merchant', emoji: '🎲', blurb: 'A suspiciously cheerful goblin with wares of dubious origin. Roll the dice and see.' },
  checkpoint: { label: 'Camp',            emoji: '🏕️', blurb: 'A safe alcove worn smooth by weary adventurers. Rest and push deeper.' },
  exit:       { label: 'Exit',            emoji: '', blurb: 'A passage leading deeper into the dark. There is no turning back.' },
  empty:      { label: 'Stone Floor',     emoji: '·',  blurb: 'Worn flagstone, cold and silent.' },
  well:       { label: 'Healing Well',      emoji: '⛲', blurb: 'Clear water that restores body and spirit.' },
  anvil:      { label: 'Anvil',             emoji: '⚒️', blurb: 'Temper your weapon — +1 attack damage for this run when you reveal this tile.' },
  magic_chest: {
    label: 'Magic Chest',
    emoji: '✨',
    blurb: 'A golden chest that opens with a Golden Key. Earn keys by clearing every enemy on a dungeon floor — spend them here for rare loot.',
  },
  rope:       {
    label: 'Escape Rope',
    emoji: '🧵',
    blurb: 'A sturdy rope leads up toward daylight — a way out of the dungeon.',
    modalSubtext: 'Climbing out ends this run and banks all gold you are carrying (like escaping through a normal exit). You will not descend further on this run.',
  },
}
