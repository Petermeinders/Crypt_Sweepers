import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeBalanceSnapshot } from '../js/balance/snapshot.js'
import { BALANCE_PILLARS, RECOMMENDED_TUNING_ORDER } from '../js/balance/balanceTargets.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, 'fixtures', 'balance-snapshot.json')

test('balance snapshot matches committed fixture', () => {
  const snap = computeBalanceSnapshot()
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

  assert.deepEqual(snap.pillars, fixture.pillars)
  assert.deepEqual(snap.recommendedTuningOrder, fixture.recommendedTuningOrder)
  assert.deepEqual(snap.profileMetaGap, fixture.profileMetaGap)
  assert.deepEqual(snap.floors, fixture.floors)
  assert.deepEqual(snap.referenceEnemyIds, fixture.referenceEnemyIds)
  assert.deepEqual(snap.rows, fixture.rows)
})

test('design pillars are defined', () => {
  assert.equal(BALANCE_PILLARS.length >= 3, true)
  for (const p of BALANCE_PILLARS) {
    assert.ok(p.id && p.title && p.summary)
  }
})

test('tuning order lists at least one lever', () => {
  assert.ok(Array.isArray(RECOMMENDED_TUNING_ORDER))
  assert.ok(RECOMMENDED_TUNING_ORDER.length >= 1)
})
