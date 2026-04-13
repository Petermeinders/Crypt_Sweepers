#!/usr/bin/env node
/**
 * Prints balance snapshot tables for quick eyeballing during tuning.
 * Run: npm run balance-report
 */
import { computeBalanceSnapshot } from '../js/balance/snapshot.js'

const snap = computeBalanceSnapshot()

console.log('=== Balance pillars ===')
for (const p of snap.pillars) {
  console.log(`\n[${p.id}] ${p.title}`)
  console.log(p.summary)
}

console.log('\n=== Recommended tuning order (one lever at a time) ===')
snap.recommendedTuningOrder.forEach((line, i) => console.log(`${i + 1}. ${line}`))

console.log('\n=== Profile: baseline vs full-meta (trivial melee = hitsToKill ≤ 1) ===')
console.log(JSON.stringify(snap.profileMetaGap, null, 2))

console.log('\n=== Rows (scenario × floor × enemy) ===')
const byScenario = new Map()
for (const r of snap.rows) {
  if (!byScenario.has(r.scenarioId)) byScenario.set(r.scenarioId, [])
  byScenario.get(r.scenarioId).push(r)
}

for (const [id, rows] of byScenario) {
  console.log(`\n--- ${id} ---`)
  const floors = [...new Set(rows.map(r => r.floor))].sort((a, b) => a - b)
  for (const f of floors) {
    const chunk = rows.filter(r => r.floor === f)
    console.log(`  Floor ${f}:`)
    for (const r of chunk) {
      const flags = [r.trivialKill ? 'TRIVIAL_KILL' : null, r.verySafePlayer ? 'VERY_SAFE' : null]
        .filter(Boolean)
        .join(', ')
      console.log(
        `    ${r.enemyId}: HP=${r.enemyHp} atk=${r.enemyDmgLo}-${r.enemyDmgHi} | ` +
          `player melee=${r.playerMelee} maxHp=${r.playerMaxHp} | ` +
          `hitsToKill=${r.hitsToKill} hitsToDie≈${r.hitsToDieApprox}${flags ? ` [${flags}]` : ''}`,
      )
    }
  }
}
