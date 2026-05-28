import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { generateGear, pickDropTier, GEAR_SLOT_DEFS } from '../../js/data/gear.js'
import { withRandomSequence } from '../helpers/mockRandom.mjs'

const REQUIRED_KEYS = ['uid', 'slot', 'tier', 'name', 'stats', 'upgradeCount']
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
    withRandomSequence([0.49], () => {
      assert.equal(pickDropTier(25), 'common')
    })
    withRandomSequence([0.50], () => {
      assert.equal(pickDropTier(25), 'rare')
    })
  })
})
