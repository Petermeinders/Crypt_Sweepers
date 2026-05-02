/**
 * Floor modifier pool. One modifier is picked per floor at floor start.
 * Static modifiers (stat patches) are applied immediately via `apply()`.
 * Dynamic modifiers are checked inline in GameController via `run.floorModifier.id`.
 *
 * Appearance rules:
 *   - No modifier before floor 6.
 *   - Floors  6–50:  20% chance of a modifier.
 *   - Floors 51–∞:   50% chance of a modifier.
 *
 * Weights:
 *   - Boons  (weight 2): appear ~2× as often as curses within the weighted pool.
 *   - Curses (weight 1): half as likely as boons.
 */

// weight: 2 = boon, 1 = curse
export const MODIFIERS = [
  {
    id:          'cursed-fog',
    name:        'Cursed Fog',
    icon:        '🌫️',
    weight:      1,
    description: 'All enemies have +2 HP this floor.',
    apply(run, grid) {
      for (const row of grid) {
        for (const t of row) {
          if (t.enemyData && !t.revealed) t.enemyData.hp += 2
        }
      }
    },
  },
  {
    id:          'bloodmoon',
    name:        'Bloodmoon',
    icon:        '🩸',
    weight:      1,
    description: 'All enemies deal +1 damage this floor.',
    apply(run, grid) {
      for (const row of grid) {
        for (const t of row) {
          if (!t.enemyData || t.revealed) continue
          if (Array.isArray(t.enemyData.dmg)) {
            t.enemyData.dmg = [t.enemyData.dmg[0] + 1, t.enemyData.dmg[1] + 1]
          } else {
            t.enemyData.dmg = (t.enemyData.dmg ?? 1) + 1
          }
        }
      }
    },
  },
  {
    id:          'weak-horde',
    name:        'Weak Horde',
    icon:        '🧟',
    weight:      2,
    description: 'All enemies have −1 HP (minimum 1).',
    apply(run, grid) {
      for (const row of grid) {
        for (const t of row) {
          if (t.enemyData && !t.revealed) t.enemyData.hp = Math.max(1, t.enemyData.hp - 1)
        }
      }
    },
  },
  {
    id:          'glass-cannon',
    name:        'Glass Cannon',
    icon:        '💥',
    weight:      1,
    description: 'You deal +2 damage, but your max HP is reduced by 10.',
    apply(run) {
      run.player.damageBonus = (run.player.damageBonus ?? 0) + 2
      run.player.maxHp = Math.max(1, run.player.maxHp - 10)
      run.player.hp    = Math.min(run.player.hp, run.player.maxHp)
    },
    clear(run) {
      run.player.damageBonus = Math.max(0, (run.player.damageBonus ?? 0) - 2)
      run.player.maxHp += 10
    },
  },
  {
    id:          'ancient-cache',
    name:        'Ancient Cache',
    icon:        '📦',
    weight:      2,
    description: 'Chests contain double gold this floor.',
    // Checked inline in GameController at chest loot award
    apply() {},
  },
  {
    id:          'hungry-dungeon',
    name:        'Hungry Dungeon',
    icon:        '🪙',
    weight:      1,
    description: 'Gold from enemies and chests is halved this floor.',
    // Checked inline in _gainGold
    apply() {},
  },
  {
    id:          'consecrated-ground',
    name:        'Consecrated Ground',
    icon:        '✨',
    weight:      2,
    description: 'Revealing an empty tile heals 1 HP.',
    // Checked inline in the empty tile case
    apply() {},
  },
  {
    id:          'mana-spring',
    name:        'Mana Spring',
    icon:        '🔮',
    weight:      2,
    description: 'Each enemy kill restores 2 mana.',
    // Checked inline in enemy kill finalization
    apply() {},
  },
  {
    id:          'haunted-ground',
    name:        'Haunted Ground',
    icon:        '💀',
    weight:      1,
    description: 'Traps deal double damage — but guarantee a trinket drop.',
    // Checked inline in the trap case
    apply() {},
  },
  {
    id:          'miasma',
    name:        'Miasma',
    icon:        '☠️',
    weight:      1,
    description: 'Toxic air: every 3 tiles you reveal, take 1 damage.',
    // Checked inline after each tile reveal
    apply(run) {
      run._miasmaCounter = 0
    },
    clear(run) {
      delete run._miasmaCounter
    },
  },
  {
    id:          'crumbling-walls',
    name:        'Crumbling Walls',
    icon:        '🪨',
    weight:      1,
    description: 'Each tile you reveal has a 20% chance to deal 1 damage.',
    // Checked inline after each tile reveal
    apply() {},
  },
  {
    id:          'warded-dungeon',
    name:        'Warded Dungeon',
    icon:        '🔒',
    weight:      1,
    description: 'The exit is sealed — you must reveal 60% of tiles before you can leave.',
    // Checked inline in _confirmExit
    apply() {},
  },
  {
    id:          'the-hunt',
    name:        'The Hunt',
    icon:        '🎯',
    weight:      2,
    description: 'Enemy locations are faintly marked on the grid.',
    apply(run, grid) {
      for (const row of grid) {
        for (const t of row) {
          if (t.enemyData && !t.revealed && t.element) {
            t.element.classList.add('hunt-marked')
          }
        }
      }
    },
    clear(run, grid) {
      if (!grid) return
      for (const row of grid) {
        for (const t of row) {
          t.element?.classList.remove('hunt-marked')
        }
      }
    },
  },
  {
    id:          'silence',
    name:        'Silence',
    icon:        '🤫',
    weight:      1,
    description: 'Active abilities cannot be used this floor.',
    apply(run) {
      run.player.silenced = true
    },
    clear(run) {
      run.player.silenced = false
    },
  },
]

/**
 * Pick one modifier at random. Returns null when no modifier should appear.
 *
 * Appearance chance:
 *   floors  1–5:   0%  (never)
 *   floors  6–50: 20%
 *   floors 51+:   50%
 *
 * Selection uses weighted random — boons (weight 2) appear ~2× as often as curses (weight 1).
 *
 * @param {number}  floor
 * @param {boolean} isRest
 * @param {boolean} isBoss
 */
export function pickModifier(floor, isRest, isBoss) {
  if (isRest || isBoss || floor < 6) return null

  const chance = floor === 6 ? 1.0 : floor <= 50 ? 0.20 : 0.50
  if (Math.random() >= chance) return null

  const totalWeight = MODIFIERS.reduce((s, m) => s + (m.weight ?? 1), 0)
  let roll = Math.random() * totalWeight
  for (const mod of MODIFIERS) {
    roll -= (mod.weight ?? 1)
    if (roll <= 0) return mod
  }
  return MODIFIERS[MODIFIERS.length - 1]
}

export default { MODIFIERS, pickModifier }
