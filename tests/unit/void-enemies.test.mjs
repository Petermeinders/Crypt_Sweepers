import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ENEMY_DEFS } from '../../js/data/enemies.js'
import {
  applyArmorRend,
  applyRevealArmorRend,
  resolveVoidEnemyIncomingDamage,
  tryDeathSplit,
  pickVoidEnemyId,
  isVoidTrialEnemyDef,
} from '../../js/systems/VoidEnemyMechanics.js'

const VOID_IDS = [
  'void_maw',
  'void_ghast',
  'hook_crawler',
  'shard_ravager',
  'void_behemoth',
  'rift_lich',
]

describe('Void enemies data', () => {
  for (const id of VOID_IDS) {
    it(`${id} is void-trial only`, () => {
      const def = ENEMY_DEFS[id]
      assert.ok(def, `missing ENEMY_DEFS.${id}`)
      assert.equal(def.spawn?.voidTrial, true)
      assert.ok(isVoidTrialEnemyDef(def))
    })
  }
})

describe('VoidEnemyMechanics', () => {
  it('applyArmorRend shaves tile armor', () => {
    const player = { armor: 3 }
    assert.equal(applyArmorRend(player, 2), 2)
    assert.equal(player.armor, 1)
    assert.equal(applyArmorRend(player, 5), 1)
    assert.equal(player.armor, 0)
  })

  it('applyRevealArmorRend uses enemyData.armorRend', () => {
    const player = { armor: 4 }
    const tile = { enemyData: { armorRend: 1 }, element: null }
    assert.equal(applyRevealArmorRend(player, tile), 1)
    assert.equal(player.armor, 3)
  })

  it('obsidian plate absorbs hits until charges exhausted', () => {
    const enemy = { obsidianCharges: 2, hp: 8, currentHP: 8 }
    let r = resolveVoidEnemyIncomingDamage(enemy, 5)
    assert.equal(r.hpDamage, 0)
    assert.equal(enemy.obsidianCharges, 1)
    r = resolveVoidEnemyIncomingDamage(enemy, 3)
    assert.equal(r.hpDamage, 0)
    assert.equal(enemy.obsidianCharges, 0)
    r = resolveVoidEnemyIncomingDamage(enemy, 2)
    assert.equal(r.hpDamage, 2)
  })

  it('shatter shell blocks first hit then pulses player', () => {
    const enemy = { shellIntact: true, shatterPct: 0.25, maxHpAtSpawn: 8, hp: 8, currentHP: 8 }
    const first = resolveVoidEnemyIncomingDamage(enemy, 4)
    assert.equal(first.hpDamage, 0)
    assert.equal(first.playerPulse, 2)
    assert.equal(enemy.shellIntact, false)
    const second = resolveVoidEnemyIncomingDamage(enemy, 4)
    assert.equal(second.hpDamage, 4)
    assert.equal(second.playerPulse, 0)
  })

  it('tryDeathSplit seeds adjacent unrevealed tile', () => {
    const grid = [
      [
        { revealed: true, type: 'empty' },
        { revealed: false, type: 'enemy', row: 0, col: 1 },
      ],
      [
        { revealed: false, type: 'empty', row: 1, col: 0 },
        { revealed: true, type: 'empty' },
      ],
    ]
    assert.equal(tryDeathSplit(grid, 0, 0, 1), true)
    const seeded = grid.flat().find(t => (t.deathSplitTurns ?? 0) > 0)
    assert.ok(seeded)
    assert.equal(seeded.deathSplitBurst, 1)
  })

  it('pickVoidEnemyId respects voidMinTier', () => {
    const run = { isVoidTrial: true, voidTier: 1 }
    const ids = new Set()
    for (let i = 0; i < 40; i++) {
      ids.add(pickVoidEnemyId(5, { run }))
    }
    assert.ok(ids.has('void_maw') || ids.has('void_ghast'))
    assert.ok(!ids.has('rift_lich'))
  })
})
