// Ranger character definition and ability tree.
// Passives: (1) each enemy reveal has a 10% chance to skip locking adjacent tiles.
// (2) starts every run with Trapfinder at rank 1 — see buildRunState trapfinderStacks + abilities.

import { WARRIOR_ABILITIES } from './abilities.js'

export const RANGER_BASE = {
  hp:      40,
  mana:    35,
  damage:  [1, 1],    // base per strike; variance comes from damageBonus (abilities, chest, etc.)
  gold:    0,
}

/** Level-up pool — same Vitality / Arcane Reserve / Scavenger as Warrior; Trapfinder is Ranger-only. */
export const RANGER_ABILITIES = {
  vitality: WARRIOR_ABILITIES.vitality,
  'arcane-reserve': WARRIOR_ABILITIES['arcane-reserve'],
  scavenger: WARRIOR_ABILITIES.scavenger,
  trapfinder: {
    name:  'Trapfinder',
    desc:  '10% chance on trap damage, fast-tile reveal hits, or fast ambush on reveal: reduce that hit by 1 per stack (pick again to stack).',
    icon:  '🔍',
    effect: { type: 'trapfinder-stack', amount: 1 },
    repeatable: true,
  },
  /** Meta XP tree also unlocks these; each level-up pick stacks +10% damage for that active (run-only). */
  'ricochet-mastery': {
    name:  'Ricochet Practice',
    desc:  'Each pick: +10% Ricochet damage (stacks).',
    icon:  '🔁',
    iconSrc:   'assets/sprites/abilities/ricochet-badge.png',
    iconBgSrc: 'assets/sprites/abilities/ricochet-bg.png',
    effect: { type: 'ranger-active-mastery', ability: 'ricochet' },
    repeatable: true,
    requiresMetaUpgrade: 'ricochet',
  },
  'poison-arrow-mastery': {
    name:  'Poison Arrow Practice',
    desc:  'Each pick: +10% Poison Arrow hit and poison tick damage (stacks).',
    icon:  '☠️',
    iconSrc:   'assets/sprites/abilities/poison-arrow-badge.png',
    iconBgSrc: 'assets/sprites/abilities/poison-arrow-bg.png',
    effect: { type: 'ranger-active-mastery', ability: 'poison-arrow-shot' },
    repeatable: true,
    requiresMetaUpgrade: 'poison-arrow-shot',
  },
  'arrow-barrage-mastery': {
    name:  'Triple Volley Practice',
    desc:  'Each pick: +10% Triple Volley damage per enemy in the 3×3 (stacks).',
    icon:  '🎯',
    iconSrc:   'assets/sprites/abilities/arrow-barrage-badge.png',
    iconBgSrc: 'assets/sprites/abilities/arrow-barrage-bg.png',
    effect: { type: 'ranger-active-mastery', ability: 'arrow-barrage' },
    repeatable: true,
    requiresMetaUpgrade: 'arrow-barrage',
  },
}


export const RANGER_UPGRADES = {
  'ricochet': {
    name:  'Ricochet',
    desc:  'Active ability: tap up to 3 enemies in order — the third pick fires, or tap Ricochet again with 1–2 marked (3 / 2 / 1 damage scaling).',
    icon:  '🔁',
    iconSrc:   'assets/sprites/abilities/ricochet-badge.png',
    iconBgSrc: 'assets/sprites/abilities/ricochet-bg.png',
    xpCost:  50,
    manaCost: 10,
    effect:  { type: 'active-ability', ability: 'ricochet' },
  },
  /** Second-tier Ricochet upgrade — requires base Ricochet. Combat checks save.ranger.upgrades. */
  'ricochet-arc-mastery': {
    name:  'Ricochet Mastery',
    desc:  'Ricochet shots use 4 : 3 : 2 scaling per unit instead of 3 : 2 : 1. Requires the Ricochet upgrade.',
    icon:  '🔁',
    iconSrc:   'assets/sprites/abilities/ricochet-badge.png',
    iconBgSrc: 'assets/sprites/abilities/ricochet-bg.png',
    xpCost:    180,
    requires:  'ricochet',
    effect:    { type: 'ricochet-arc-mastery' },
  },
  /** Active ability (HUD) — id must differ from any future passive named `poison-arrow`. */
  'poison-arrow-shot': {
    name:  'Poison Arrow',
    desc:  'Active ability: tap an enemy for an immediate hit plus poison — each tick deals damage on the next 3 turns (any tile flip or starting melee vs an enemy; min. 1 per tick; scales like Ricochet).',
    icon:  '☠️',
    iconSrc:   'assets/sprites/abilities/poison-arrow-badge.png',
    iconBgSrc: 'assets/sprites/abilities/poison-arrow-bg.png',
    xpCost:  80,
    manaCost: 12,
    effect:  { type: 'active-ability', ability: 'poison-arrow-shot' },
  },
  'arrow-barrage': {
    name:  'Triple Volley',
    desc:  'Active ability: 3×3 blast centered on your tile — 50% of your attack damage (min 1) to each revealed enemy in the area. First tap places the zone; tap the same tile again to fire.',
    icon:  '🎯',
    iconSrc:   'assets/sprites/abilities/arrow-barrage-badge.png',
    iconBgSrc: 'assets/sprites/abilities/arrow-barrage-bg.png',
    xpCost:  65,
    manaCost: 12,
    effect:  { type: 'active-ability', ability: 'arrow-barrage' },
  },
}
