import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createInitialTelemetry,
  buildLevelSnapshotRecord,
} from '../../js/balance/runTelemetry.js'

test('createInitialTelemetry() has expected shape', () => {
  const t = createInitialTelemetry()
  assert.equal(typeof t.startedAt, 'number')
  assert.deepEqual(t.levelSnapshots, [])
  assert.deepEqual(t.damageByFloor, {})
  assert.deepEqual(t.damageSources, {})
  assert.deepEqual(t.killsByFloor, {})
  assert.deepEqual(t.goldByFloor, {})
  assert.equal(t.totalDamageTaken, 0)
  assert.equal(t.totalDamageDealtToEnemies, 0)
  assert.equal(t.outcome, null)
  assert.equal(t.runStartSnapshotDone, false)
})

test('buildLevelSnapshotRecord() includes all expected fields', () => {
  const player = {
    level: 3,
    xp: 12,
    hp: 40,
    maxHp: 50,
    mana: 20,
    maxMana: 30,
    damageBonus: 2,
    damageReduction: 1,
    gold: 15,
  }
  const rec = buildLevelSnapshotRecord({
    trigger: 'levelUp',
    floor: 5,
    player,
    xpToNext: 100,
    meleeDamageRange: [2, 4],
  })

  assert.equal(typeof rec.at, 'number')
  assert.equal(rec.trigger, 'levelUp')
  assert.equal(rec.characterLevel, 3)
  assert.equal(rec.floor, 5)
  assert.equal(rec.xp, 12)
  assert.equal(rec.xpToNext, 100)
  assert.equal(rec.hp, 40)
  assert.equal(rec.maxHp, 50)
  assert.equal(rec.mana, 20)
  assert.equal(rec.maxMana, 30)
  assert.equal(rec.damageBonus, 2)
  assert.equal(rec.damageReduction, 1)
  assert.equal(rec.gold, 15)
  assert.deepEqual(rec.meleeDamageRange, [2, 4])
})
