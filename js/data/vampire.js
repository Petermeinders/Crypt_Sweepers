// Vampire hero — base stats and tuning knobs (see GameController + CombatResolver).

export const VAMPIRE_BASE = {
  hp:    45,
  mana:  25,
  /** Fixed melee damage before damageBonus / items (matches hero-select display). */
  damage: 2,
}

/** Max category hints applied per flip for Dark Eyes (unreachable tiles). */
export const VAMPIRE_DARK_EYES_MAX_TILES = 12
