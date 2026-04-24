// Vampire hero — base stats and tuning knobs (see GameController + CombatResolver).

export const VAMPIRE_BASE = {
  hp:    45,
  mana:  25,
  /** Fixed melee damage before damageBonus / items (matches hero-select display). */
  damage: 2,
}

/** Max category hints applied per flip for Dark Eyes (unreachable tiles). */
export const VAMPIRE_DARK_EYES_MAX_TILES = 12

export const VAMPIRE_UPGRADES = {
  'blood-tithe': {
    name:     'Blood Tithe',
    desc:     'Convert 10 HP into 10 mana. Cannot be used if it would kill you.',
    icon:     '🩸',
    xpCost:   40,
    hpCost:   10,
    manaGain: 10,
    effect:   { type: 'active-ability', ability: 'blood-tithe' },
  },
  'mist-form': {
    name:     'Mist Form',
    desc:     'Dissolve into crimson mist. For your next 5 tile flips, Corrupted Blood is suspended — no HP drain per flip, but non-enemy tiles grant no blood either.',
    icon:     '🌫️',
    xpCost:   50,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'mist-form' },
  },
  'blood-pact': {
    name:     'Blood Pact',
    desc:     'Seal a pact with your prey. Add 1 HP to each revealed enemy (non-boss), then equalize all to the group average. Weaklings sustain longer; behemoths are brought low.',
    icon:     '⚖️',
    xpCost:   60,
    manaCost: 10,
    effect:   { type: 'active-ability', ability: 'blood-pact' },
  },
}

/** In-run mastery picks gated behind Blood Tithe being unlocked this run. */
export const VAMPIRE_MASTERY_ABILITIES = {
  'blood-tithe-mastery-2': {
    name:           'Blood Tithe II',
    desc:           'Reduces Blood Tithe HP cost from 10 to 8.',
    icon:           '🩸',
    requiresActive: 'blood-tithe',
    repeatable:     false,
    effect:         { type: 'blood-tithe-mastery', tier: 2 },
  },
  'blood-tithe-mastery-3': {
    name:            'Blood Tithe III',
    desc:            'Reduces HP cost to 7 and increases mana gain to 11.',
    icon:            '🩸',
    requiresAbility: 'blood-tithe-mastery-2',
    repeatable:      false,
    effect:          { type: 'blood-tithe-mastery', tier: 3 },
  },
}

// TODO: When implementing the Druid, use the "Dominate" ability (or a nature-themed rename like
// "Enthrall" / "Verdant Bond") as one of their first active abilities. Mechanic: take control of
// a revealed enemy for the floor — it fights alongside you, adding its damage to your next attack
// against another enemy. Only one thrall at a time; re-casting replaces the current thrall.
