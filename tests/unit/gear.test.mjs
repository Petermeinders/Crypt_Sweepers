import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { generateGear, pickDropTier, GEAR_SLOT_DEFS, gearFloorMult } from '../../js/data/gear.js'
import { CONFIG } from '../../js/config.js'
import { withRandomSequence } from '../helpers/mockRandom.mjs'

const REQUIRED_KEYS = ['uid', 'slot', 'tier', 'name', 'stats', 'upgradeCount', 'dropFloor']
const TIERS = ['common', 'rare', 'epic', 'legendary']
const SLOTS = Object.keys(GEAR_SLOT_DEFS)

describe('generateGear', () => {
  test('produces valid schema for each slot and tier', () => {
    withRandomSequence([0.5, 0.5, 0.5, 0.99], () => {
      for (const slot of SLOTS) {
        for (const tier of TIERS) {
          const piece = generateGear(slot, tier)
          for (const key of REQUIRED_KEYS) {
            assert.ok(key in piece, `${slot}/${tier} missing ${key}`)
          }
          assert.equal(piece.slot, slot)
          assert.equal(piece.tier, tier)
          assert.equal(typeof piece.name, 'string')
          assert.ok(piece.name.length > 0)
          const primary = GEAR_SLOT_DEFS[slot].primaryStat
          assert.ok(primary in piece.stats, `${slot} missing primary ${primary}`)
        }
      }
    })
  })

  test('UIDs are unique across many generations', () => {
    withRandomSequence(Array.from({ length: 200 }, (_, i) => i / 200), () => {
      const uids = new Set()
      for (let i = 0; i < 100; i++) {
        const piece = generateGear('weapon', 'common')
        assert.ok(!uids.has(piece.uid))
        uids.add(piece.uid)
      }
    })
  })

  test('deeper floors scale primary stats and detriments', () => {
    withRandomSequence([0, 0, 0.99], () => {
      const shallow = generateGear('weapon', 'common', 10)
      const deep = generateGear('weapon', 'common', 80)
      assert.equal(shallow.dropFloor, 10)
      assert.equal(deep.dropFloor, 80)
      assert.ok(deep.stats.damageBonus > shallow.stats.damageBonus)
    })
    withRandomSequence([0, 0, 0, 0.01], () => {
      const shallow = generateGear('breastplate', 'common', 10)
      const deep = generateGear('breastplate', 'common', 80)
      const shallowDet = Object.values(shallow.stats).find(v => v < 0)
      const deepDet = Object.values(deep.stats).find(v => v < 0)
      assert.ok(shallowDet)
      assert.ok(deepDet)
      assert.ok(deepDet < shallowDet)
    })
  })

  test('gearFloorMult matches band endpoints', () => {
    assert.ok(Math.abs(gearFloorMult(10) - 1.225) < 0.001)
    assert.ok(Math.abs(gearFloorMult(80) - 3.275) < 0.001)
  })

  test('tier bands overlap and deep common can beat shallow epic', () => {
    const { damageBonus } = CONFIG.gear.statRanges
    assert.ok(damageBonus.rare[0] <= damageBonus.common[1])
    assert.ok(damageBonus.epic[0] <= damageBonus.rare[1])
    assert.ok(damageBonus.legendary[0] <= damageBonus.epic[1])

    withRandomSequence([0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99], () => {
      const shallowEpic = generateGear('weapon', 'epic', 15)
      const deepCommon = generateGear('weapon', 'common', 85)
      assert.ok(deepCommon.stats.damageBonus > shallowEpic.stats.damageBonus)
    })
  })
})

describe('pickDropTier', () => {
  test('maps roll buckets on floor 1-20 table', () => {
    withRandomSequence([0], () => {
      assert.equal(pickDropTier(1), 'common')
    })
    withRandomSequence([0.799], () => {
      assert.equal(pickDropTier(10), 'common')
    })
    withRandomSequence([0.80], () => {
      assert.equal(pickDropTier(10), 'rare')
    })
    withRandomSequence([0.95], () => {
      assert.equal(pickDropTier(10), 'epic')
    })
    withRandomSequence([0.99], () => {
      assert.equal(pickDropTier(10), 'legendary')
    })
  })

  test('uses 21-40 table for floor 25', () => {
    withRandomSequence([0.59], () => {
      assert.equal(pickDropTier(25), 'common')
    })
    withRandomSequence([0.60], () => {
      assert.equal(pickDropTier(25), 'rare')
    })
  })
})
