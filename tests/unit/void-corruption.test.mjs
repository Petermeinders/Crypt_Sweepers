import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  rollCorruptionTriplet,
  getCorruptionModifiers,
  applyCorruptionPick,
  needsCorruptionPick,
} from '../../js/systems/VoidCorruption.js'
import { rollVoidCompletionCard } from '../../js/systems/VoidCompletion.js'
import { scaleEnemyDef } from '../../js/systems/EnemyScaling.js'
import { ENEMY_DEFS } from '../../js/data/enemies.js'
import {
  voidEffectiveEnemyFloor,
  voidTrialBonusPct,
  voidTrialBannerDisplay,
} from '../../js/systems/VoidTrial.js'
import { getActiveCorruptionEntries } from '../../js/systems/VoidCorruption.js'

describe('VoidCorruption', () => {
  it('rollCorruptionTriplet has no duplicate ids when pool >= 3', () => {
    const pool = ['hp_pct', 'mp_pct', 'miss_strike', 'loot_drop', 'block_fail']
    const triplet = rollCorruptionTriplet(pool, 3)
    assert.equal(triplet.length, 3)
    assert.equal(new Set(triplet).size, 3)
  })

  it('getCorruptionModifiers stacks hp_pct picks', () => {
    const run = { isVoidTrial: true, voidTier: 1, corruption: { stacks: { hp_pct: 2 }, pickedFloors: [] } }
    const mods = getCorruptionModifiers(run)
    assert.equal(mods.maxHpMult, -0.02)
  })

  it('applyCorruptionPick increments stack and marks floor', () => {
    const run = {
      floor: 3,
      isVoidTrial: true,
      voidTier: 1,
      corruption: { stacks: {}, pickedFloors: [], pendingTriplet: ['a', 'b', 'c'], introShown: true },
    }
    applyCorruptionPick(run, 'enemy_dmg')
    assert.equal(run.corruption.stacks.enemy_dmg, 1)
    assert.ok(run.corruption.pickedFloors.includes(3))
    assert.equal(run.corruption.pendingTriplet, null)
  })

  it('needsCorruptionPick false on sanctuary', () => {
    const run = { isVoidTrial: true, voidTier: 1, atRest: true, floor: 19, corruption: { pickedFloors: [] } }
    assert.equal(needsCorruptionPick(run), false)
  })

  it('needsCorruptionPick false after floor picked', () => {
    const run = { isVoidTrial: true, voidTier: 1, atRest: false, floor: 2, corruption: { pickedFloors: [2] } }
    assert.equal(needsCorruptionPick(run), false)
  })
})

describe('VoidTrial enemy scaling', () => {
  it('voidEffectiveEnemyFloor starts at CONFIG enemyBaseFloor and climbs per void floor', () => {
    const run = { isVoidTrial: true, voidTier: 1, floor: 3 }
    assert.equal(voidEffectiveEnemyFloor(run, 1), 50)
    assert.equal(voidEffectiveEnemyFloor(run, 3), 52)
  })

  it('void trial floor 1 tier 1 skeleton matches main floor 50 × tier mult', () => {
    const floor50 = scaleEnemyDef(ENEMY_DEFS.skeleton, 50)
    const run = { isVoidTrial: true, voidTier: 1 }
    const eff = voidEffectiveEnemyFloor(run, 1)
    assert.equal(eff, 50)
    const scaled = scaleEnemyDef(ENEMY_DEFS.skeleton, eff)
    const mult = 1.5
    assert.equal(Math.ceil(scaled.hp * mult), Math.ceil(floor50.hp * mult))
  })
})

describe('VoidTrial banner display', () => {
  it('voidTrialBonusPct converts mult to bonus percent', () => {
    assert.equal(voidTrialBonusPct(1.5), 50)
    assert.equal(voidTrialBonusPct(2), 100)
    assert.equal(voidTrialBonusPct(2.5), 150)
    assert.equal(voidTrialBonusPct(1.25), 25)
  })

  it('voidTrialBannerDisplay reads CONFIG.void.trials', () => {
    const t2 = voidTrialBannerDisplay(2)
    assert.equal(t2.name, 'Hollow Threshold')
    assert.equal(t2.roman, 'II')
    assert.equal(t2.tierLabel, 'TIER II')
    assert.equal(t2.enemyPct, 100)
    assert.equal(t2.lootPct, 50)
    assert.equal(t2.maxFloor, 30)
    assert.equal(t2.flavor, 'The punishing challenge.')
  })
})

describe('VoidCorruption entries', () => {
  it('getActiveCorruptionEntries returns stacks and descriptions', () => {
    const run = {
      isVoidTrial: true,
      voidTier: 1,
      corruption: { stacks: { hp_pct: 2, enemy_dmg: 1 }, pickedFloors: [1] },
    }
    const entries = getActiveCorruptionEntries(run)
    assert.equal(entries.length, 2)
    const frailty = entries.find(e => e.id === 'hp_pct')
    assert.equal(frailty.stacks, 2)
    assert.equal(frailty.label, 'Frailty')
    assert.ok(frailty.description.includes('max HP'))
    assert.ok(frailty.summary.includes('2%'))
  })
})

describe('VoidCompletion', () => {
  it('rollVoidCompletionCard returns gear piece with slot and tier', () => {
    const piece = rollVoidCompletionCard(2)
    assert.ok(piece.slot)
    assert.ok(piece.tier)
    assert.ok(piece.stats)
    assert.equal(piece.voidCompletionReward, true)
  })
})
