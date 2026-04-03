// Item registry — plain data only.
// effect.type is handled by GameController._useItem.

export const ITEMS = {
  'potion-blue': {
    name:      'Mana Potion',
    icon:      '🔵',
    spriteSrc: 'assets/sprites/Items/potionBlue.png',
    stackable: true,
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
    stackable: true,
    blurb:     'A small vial of crimson restorative. Smells of iron and elderberries. Drink it when the shadows close in.',
    details: [
      { icon: '❤️', label: 'Restore',  desc: 'Heals 5 HP when used'         },
      { icon: '📦', label: 'Stackable', desc: 'Multiple potions share a slot' },
    ],
    effect: { type: 'heal', amount: 5 },
  },
}
