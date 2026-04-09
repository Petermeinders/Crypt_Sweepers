// Random encounter event pool.
// Each story event has: id, title, text, choices[]
// Each choice has: label, outcomes[] (each: weight 0-100, effect, effectValue, text)
// effect types: 'nothing' | 'damage' | 'heal' | 'gold' | 'mana' | 'golden-key' | 'item'

export const STORY_EVENTS = [
  {
    id: 'dead-skeleton-key',
    title: 'A Curious Find',
    text: 'A skeleton slumped against the wall clutches a tarnished key in its bony fist. It hasn\'t moved — yet.',
    choices: [
      {
        label: 'Take the key',
        outcomes: [
          { weight: 50, effect: 'golden-key', effectValue: 1, text: 'The bones crumble to dust. You pocket the key.' },
          { weight: 50, effect: 'damage',     effectValue: 5, text: 'It lurches to life and drives a blade into your side before collapsing!' },
        ],
      },
      {
        label: 'Leave it',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You step around it and press on.' },
        ],
      },
    ],
  },

  {
    id: 'glowing-fountain',
    title: 'A Strange Fountain',
    text: 'A small stone fountain trickles with faintly glowing water. It smells of old magic — possibly restorative, possibly dangerous.',
    choices: [
      {
        label: 'Drink from it',
        outcomes: [
          { weight: 60, effect: 'heal',   effectValue: 6, text: 'A warm rush courses through you. Your wounds close.' },
          { weight: 40, effect: 'damage', effectValue: 4, text: 'The water burns! Whatever was in that fountain, it wasn\'t kind.' },
        ],
      },
      {
        label: 'Walk past',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You resist the temptation and move on.' },
        ],
      },
    ],
  },

  {
    id: 'dying-adventurer',
    title: 'A Fallen Hero',
    text: 'A wounded adventurer lies against a crumbling pillar, barely breathing. A coin pouch rests in their open hand.',
    choices: [
      {
        label: 'Help them',
        outcomes: [
          { weight: 70, effect: 'gold',   effectValue: 8,  text: 'They weakly press their pouch into your hands. "Take it... you\'ll need it more."' },
          { weight: 30, effect: 'damage', effectValue: 3,  text: 'It\'s a trap. They swipe at you with a hidden dagger before fleeing into the dark.' },
        ],
      },
      {
        label: 'Take the pouch',
        outcomes: [
          { weight: 100, effect: 'gold', effectValue: 12, text: 'They don\'t resist. You pocket the gold and move on.' },
        ],
      },
      {
        label: 'Move on',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Not your problem. You press deeper.' },
        ],
      },
    ],
  },

  {
    id: 'mysterious-mushroom',
    title: 'A Curious Growth',
    text: 'A cluster of bioluminescent mushrooms grows from a crack in the wall. Dungeon foragers say some are curative — others are not.',
    choices: [
      {
        label: 'Eat one',
        outcomes: [
          { weight: 50, effect: 'heal',   effectValue: 5, text: 'It tastes earthy but pleasant. Your body feels renewed.' },
          { weight: 30, effect: 'mana',   effectValue: 10, text: 'A tingle runs up your spine. Your mind sharpens.' },
          { weight: 20, effect: 'damage', effectValue: 4,  text: 'Wrong kind. Your stomach lurches and you retch in the dark.' },
        ],
      },
      {
        label: 'Leave it',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Better safe than sorry.' },
        ],
      },
    ],
  },

  {
    id: 'glowing-rune-circle',
    title: 'An Ancient Ward',
    text: 'A perfect circle of glowing runes is carved into the floor. Stepping inside might imbue you with power — or trigger a trap.',
    choices: [
      {
        label: 'Step inside',
        outcomes: [
          { weight: 40, effect: 'mana',   effectValue: 15, text: 'The runes flare and power floods through you.' },
          { weight: 35, effect: 'heal',   effectValue: 4,  text: 'The runes pulse warmly. You feel steadied.' },
          { weight: 25, effect: 'damage', effectValue: 6,  text: 'The ward rejects you. A bolt of force sends you flying back!' },
        ],
      },
      {
        label: 'Study it but don\'t touch',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Fascinating, but you leave it undisturbed.' },
        ],
      },
    ],
  },

  {
    id: 'pit-with-glow',
    title: 'A Glowing Pit',
    text: 'A narrow pit in the floor emits a faint golden glow from below. Something valuable may have fallen in — or something waits at the bottom.',
    choices: [
      {
        label: 'Reach in',
        outcomes: [
          { weight: 55, effect: 'gold',   effectValue: 15, text: 'Your hand closes around a handful of ancient coins.' },
          { weight: 45, effect: 'damage', effectValue: 5,  text: 'Something bites down hard. You yank your arm back.' },
        ],
      },
      {
        label: 'Ignore it',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Some things are best left alone.' },
        ],
      },
    ],
  },

  {
    id: 'sleeping-ogre',
    title: 'A Sleeping Giant',
    text: 'A massive ogre sleeps propped against the corridor wall, snoring. A fat coin purse hangs from its belt.',
    choices: [
      {
        label: 'Steal the purse',
        outcomes: [
          { weight: 55, effect: 'gold',   effectValue: 18, text: 'Nimble fingers, steady breath. You slip away with the gold.' },
          { weight: 45, effect: 'damage', effectValue: 8,  text: 'It stirs. A massive fist catches you before you can run!' },
        ],
      },
      {
        label: 'Sneak past quietly',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You tiptoe past without disturbing it.' },
        ],
      },
    ],
  },

  {
    id: 'crow-with-trinket',
    title: 'A Clever Crow',
    text: 'A crow perches on a broken torch bracket, clutching something shiny in its beak. It tilts its head and watches you.',
    choices: [
      {
        label: 'Offer it food',
        outcomes: [
          { weight: 65, effect: 'gold',    effectValue: 5,  text: 'It drops the shiny object — a small gold nugget — and snatches your food.' },
          { weight: 35, effect: 'nothing', text: 'It bobs its head, pockets the food, and flies off with its prize.' },
        ],
      },
      {
        label: 'Grab for it',
        outcomes: [
          { weight: 40, effect: 'gold',    effectValue: 5,  text: 'It startles and drops the trinket. Lucky.' },
          { weight: 60, effect: 'damage',  effectValue: 2,  text: 'It goes for your eyes. Scratches across your face.' },
        ],
      },
    ],
  },

  {
    id: 'sealed-vial',
    title: 'An Alchemist\'s Vial',
    text: 'A sealed glass vial sits upright in a wall nook, perfectly preserved. No label. The liquid inside shifts color slowly.',
    choices: [
      {
        label: 'Drink it',
        outcomes: [
          { weight: 35, effect: 'heal',   effectValue: 8,  text: 'A sweet warmth — it\'s a healing compound.' },
          { weight: 35, effect: 'mana',   effectValue: 15, text: 'Your mind clears and mana surges back.' },
          { weight: 30, effect: 'damage', effectValue: 5,  text: 'Acid. You spit it out but the damage is done.' },
        ],
      },
      {
        label: 'Pocket it for later',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You tuck it away but find no opportunity to use it. It evaporates.' },
        ],
      },
    ],
  },

  {
    id: 'abandoned-shrine',
    title: 'A Forgotten Shrine',
    text: 'A small shrine to a forgotten god sits in an alcove, its offering bowl empty. The inscription reads: "Give, and receive."',
    choices: [
      {
        label: 'Leave 5 gold',
        outcomes: [
          { weight: 70, effect: 'heal',   effectValue: 8,  text: 'A warmth spreads through you. The god, it seems, still listens.' },
          { weight: 30, effect: 'nothing', text: 'Silence. The gold sits in the bowl. Nothing happens.' },
        ],
      },
      {
        label: 'Take from the bowl',
        outcomes: [
          { weight: 50, effect: 'gold',   effectValue: 6,  text: 'Someone left an offering. You pocket it.' },
          { weight: 50, effect: 'damage', effectValue: 5,  text: 'The shrine cracks. A burst of energy flings you back.' },
        ],
      },
      {
        label: 'Move on',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You give the shrine a wide berth.' },
        ],
      },
    ],
  },

  {
    id: 'shifting-bones',
    title: 'The Bone Pile',
    text: 'A heap of bones in the corner seems larger than it should be. You could have sworn it shifted just now.',
    choices: [
      {
        label: 'Investigate',
        outcomes: [
          { weight: 45, effect: 'gold',   effectValue: 7,  text: 'Just bones — and a pouch of gold someone hid beneath them.' },
          { weight: 55, effect: 'damage', effectValue: 6,  text: 'Definitely not just bones. Something was sleeping in there.' },
        ],
      },
      {
        label: 'Back away slowly',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Wise. You leave it alone.' },
        ],
      },
    ],
  },

  {
    id: 'inscription-wall',
    title: 'Words in Stone',
    text: 'A wall inscription reads: "Only the brave survive the deep." Below it, a loose stone juts out like a button.',
    choices: [
      {
        label: 'Press the stone',
        outcomes: [
          { weight: 50, effect: 'gold',   effectValue: 10, text: 'A hidden compartment opens. Inside: a cache of old coins.' },
          { weight: 30, effect: 'damage', effectValue: 4,  text: 'Darts. Of course it\'s darts.' },
          { weight: 20, effect: 'mana',   effectValue: 10, text: 'A gust of enchanted air washes over you. You feel sharp.' },
        ],
      },
      {
        label: 'Ignore it',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Not every mystery needs solving.' },
        ],
      },
    ],
  },

  {
    id: 'child-toy',
    title: 'A Child\'s Toy',
    text: 'A small wooden doll sits propped against the dungeon wall. It has a tiny painted smile. Why is this here?',
    choices: [
      {
        label: 'Pick it up',
        outcomes: [
          { weight: 60, effect: 'nothing', text: 'Just a toy. You set it back down, unsettled.' },
          { weight: 40, effect: 'heal',    effectValue: 3, text: 'A faint warmth passes through you as you hold it, then fades.' },
        ],
      },
      {
        label: 'Leave it',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'Some things deserve to stay where they are.' },
        ],
      },
    ],
  },

  {
    id: 'trapped-trapdoor',
    title: 'A Hidden Trapdoor',
    text: 'A trapdoor in the floor is slightly ajar. A ladder leads down. You\'re already in a dungeon — how much worse can below be?',
    choices: [
      {
        label: 'Climb down',
        outcomes: [
          { weight: 50, effect: 'gold',   effectValue: 20, text: 'A forgotten stash. Whoever hid it isn\'t coming back.' },
          { weight: 30, effect: 'damage', effectValue: 7,  text: 'The ladder gives way. You fall hard.' },
          { weight: 20, effect: 'heal',   effectValue: 5,  text: 'A quiet chamber with a healing pool. A lucky find.' },
        ],
      },
      {
        label: 'Leave it closed',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You kick it shut and keep moving.' },
        ],
      },
    ],
  },

  {
    id: 'mirror-in-hallway',
    title: 'A Cracked Mirror',
    text: 'A tall mirror leans against the wall, cracked down the middle. Your reflection stares back — but it moved before you did.',
    choices: [
      {
        label: 'Smash it',
        outcomes: [
          { weight: 40, effect: 'gold',    effectValue: 5,  text: 'Silver fragments glitter. You scoop up what you can.' },
          { weight: 60, effect: 'damage',  effectValue: 4,  text: 'Bad luck. Seven years? Shards cut your hand deep.' },
        ],
      },
      {
        label: 'Turn away',
        outcomes: [
          { weight: 100, effect: 'nothing', text: 'You walk past without looking back.' },
        ],
      },
    ],
  },
]

/** Merchant shop items — fixed 3-slot offer each visit. */
export const MERCHANT_ITEMS = [
  { id: 'potion-red',  label: 'Red Potion',  price: 5  },
  { id: 'potion-blue', label: 'Mana Potion', price: 5  },
  { id: '__trinket__', label: 'Mystery Relic', price: 20 }, // resolved at runtime to rare/legendary
]

/** Weighted event type roll. */
export function rollEventType() {
  const r = Math.random() * 100
  if (r < 5)  return 'merchant'
  if (r < 10) return 'gambler'
  if (r < 15) return 'triple-chest'
  return 'story'
}
