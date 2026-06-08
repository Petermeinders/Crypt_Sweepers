import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { withRandomSequence } from '../helpers/mockRandom.mjs'
import {
  computeRiskScore,
  computeTierWeights,
  rollTier,
  resolveReward,
  canAffordSpin,
  spin,
} from '../../js/systems/CasinoEngine.js'
import { CASINO_CONFIG } from '../../js/data/casinoConfig.js'

// ── computeRiskScore ──────────────────────────────────────────────────────────

describe('computeRiskScore', () => {
  test('returns 0 for zero wager', () => {
    assert.equal(computeRiskScore(0, 0), 0)
  })

  test('returns 1.0 for both currencies at cap', () => {
    const r = computeRiskScore(CASINO_CONFIG.goldCap, CASINO_CONFIG.scrapCap)
    assert.ok(Math.abs(r - 1.0) < 0.0001, `expected ~1.0, got ${r}`)
  })

  test('clamps inputs below zero', () => {
    assert.equal(computeRiskScore(-100, -50), 0)
  })

  test('clamps inputs above cap', () => {
    const rCapped   = computeRiskScore(CASINO_CONFIG.goldCap, CASINO_CONFIG.scrapCap)
    const rOverflow = computeRiskScore(CASINO_CONFIG.goldCap * 10, CASINO_CONFIG.scrapCap * 10)
    assert.ok(Math.abs(rCapped - rOverflow) < 0.0001)
  })

  test('halfway inputs (gold only at cap, scrap=0) equals goldWeight', () => {
    const r = computeRiskScore(CASINO_CONFIG.goldCap, 0)
    assert.ok(Math.abs(r - CASINO_CONFIG.goldWeight) < 0.0001)
  })

  test('scrap only at cap equals scrapWeight', () => {
    const r = computeRiskScore(0, CASINO_CONFIG.scrapCap)
    assert.ok(Math.abs(r - CASINO_CONFIG.scrapWeight) < 0.0001)
  })
})

// ── computeTierWeights ────────────────────────────────────────────────────────

describe('computeTierWeights', () => {
  test('at R=0 returns base weights', () => {
    const w = computeTierWeights(0)
    const base = CASINO_CONFIG.baseTierWeights
    for (const tier of ['common', 'rare', 'epic', 'legendary']) {
      assert.ok(Math.abs(w[tier] - base[tier]) < 0.0001, `${tier}: ${w[tier]} vs ${base[tier]}`)
    }
  })

  test('at R=1 returns max weights', () => {
    const w = computeTierWeights(1)
    const max = CASINO_CONFIG.maxTierWeights
    for (const tier of ['common', 'rare', 'epic', 'legendary']) {
      assert.ok(Math.abs(w[tier] - max[tier]) < 0.0001, `${tier}: ${w[tier]} vs ${max[tier]}`)
    }
  })

  test('R=0.5 interpolates midway', () => {
    const w    = computeTierWeights(0.5)
    const base = CASINO_CONFIG.baseTierWeights
    const max  = CASINO_CONFIG.maxTierWeights
    const mid  = (base.rare + max.rare) / 2
    assert.ok(Math.abs(w.rare - mid) < 0.0001)
  })

  test('clamps R above 1', () => {
    const w1   = computeTierWeights(1)
    const wHigh = computeTierWeights(5)
    for (const tier of ['common', 'rare', 'epic', 'legendary']) {
      assert.ok(Math.abs(w1[tier] - wHigh[tier]) < 0.0001)
    }
  })
})

// ── rollTier ──────────────────────────────────────────────────────────────────

describe('rollTier', () => {
  test('always returns a valid tier', () => {
    const tiers = new Set(['common', 'rare', 'epic', 'legendary'])
    withRandomSequence([0, 0.25, 0.5, 0.75, 0.999], () => {
      for (let i = 0; i < 5; i++) {
        const result = rollTier({ common: 70, rare: 22, epic: 7, legendary: 1 })
        assert.ok(tiers.has(result), `unexpected tier: ${result}`)
      }
    })
  })

  test('samples distribution within tolerance over 10k rolls', () => {
    const weights = { common: 70, rare: 22, epic: 7, legendary: 1 }
    const total   = 10_000
    const counts  = { common: 0, rare: 0, epic: 0, legendary: 0 }
    for (let i = 0; i < total; i++) {
      counts[rollTier(weights)]++
    }
    const tolerance = 0.05 // ±5 percentage points
    for (const tier of ['common', 'rare', 'epic', 'legendary']) {
      const actual   = counts[tier] / total
      const expected = weights[tier] / 100
      assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${tier}: expected ~${expected.toFixed(2)}, got ${actual.toFixed(2)}`
      )
    }
  })
})

// ── resolveReward ─────────────────────────────────────────────────────────────

describe('resolveReward', () => {
  test('gear reward has expected shape', () => {
    withRandomSequence([0], () => {
      const r = resolveReward('rare', { gold: 100, scrap: 50 })
      assert.equal(r.type, 'gear')
      assert.ok(r.gear, 'missing gear object')
      assert.ok('slot' in r.gear)
      assert.ok('tier' in r.gear)
    })
  })

  test('voidFragment reward has fragments 1 or 2', () => {
    // rollRewardType lands on voidFragment when random hits the right bucket
    // Patch: common has gear=80, voidFragment=10 → need roll > 0.80 of 100 total
    withRandomSequence([0.85, 0.0], () => {
      const r = resolveReward('common', { gold: 0, scrap: 0 })
      assert.equal(r.type, 'voidFragment')
      assert.ok(r.fragments === 1 || r.fragments === 2)
    })
  })

  test('currencyEcho reward returns positive gold and scrap', () => {
    withRandomSequence([0.95, 0.5, 0.5], () => {
      const r = resolveReward('common', { gold: 200, scrap: 100 })
      assert.equal(r.type, 'currencyEcho')
      assert.ok(r.gold >= 1)
      assert.ok(r.scrap >= 1)
    })
  })

  test('legendary never rolls currencyEcho', () => {
    // rewardTypeWeights.legendary has currencyEcho: 0
    // so any random value should land on gear or voidFragment
    for (let i = 0; i < 50; i++) {
      const r = resolveReward('legendary', { gold: 500, scrap: 200 })
      assert.notEqual(r.type, 'currencyEcho')
    }
  })
})

// ── canAffordSpin ─────────────────────────────────────────────────────────────

describe('canAffordSpin', () => {
  test('returns true when save has enough', () => {
    const save = { persistentGold: 300, scrap: 200 }
    assert.equal(canAffordSpin(300, 100, save), true)
  })

  test('returns false when gold is insufficient', () => {
    const save = { persistentGold: 400, scrap: 200 }
    assert.equal(canAffordSpin(500, 100, save), false)
  })

  test('returns false when scrap is insufficient', () => {
    const save = { persistentGold: 400, scrap: 50 }
    assert.equal(canAffordSpin(200, 100, save), false)
  })

  test('returns true for zero wager regardless of balance', () => {
    const save = { meta: { gold: 0, scrap: 0 } }
    assert.equal(canAffordSpin(0, 0, save), true)
  })
})

// ── spin ──────────────────────────────────────────────────────────────────────

describe('spin', () => {
  test('returns expected shape', () => {
    const result = spin(0, 0)
    assert.ok('tier' in result)
    assert.ok('riskScore' in result)
    assert.ok('weights' in result)
    assert.ok('reward' in result)
    assert.equal(typeof result.riskScore, 'number')
  })

  test('riskScore is 0 for zero wager', () => {
    const result = spin(0, 0)
    assert.equal(result.riskScore, 0)
  })

  test('riskScore is 1 for max wager', () => {
    const result = spin(CASINO_CONFIG.goldCap, CASINO_CONFIG.scrapCap)
    assert.ok(Math.abs(result.riskScore - 1.0) < 0.0001)
  })
})
