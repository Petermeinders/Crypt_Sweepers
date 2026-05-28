/**
 * Critical integration scenarios — loads fixtures from tests/fixtures/scenarios/
 * and drives the in-browser test harness via Playwright.
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  startServer,
  launchGame,
  evalHarness,
  getRunSnapshot,
  waitForCombatIdle,
  attachConsoleGuards,
  throwFirstPageError,
  chromium,
  sleep,
} from '../helpers/playwrightHarness.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const scenariosDir = join(__dirname, '..', 'fixtures', 'scenarios')
const scenarioFiles = readdirSync(scenariosDir).filter(f => f.endsWith('.json'))

/** @type {{ base: string, proc: import('node:child_process').ChildProcess | null }} */
let server
/** @type {import('playwright').Browser} */
let browser

before(async () => {
  server = await startServer()
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  server?.proc?.kill('SIGTERM')
})

/**
 * @param {import('playwright').Page} page
 * @param {object} step
 * @param {object} fixture
 */
async function runStep(page, step, fixture) {
  switch (step.action) {
    case 'setupRun':
      await evalHarness(page, f => {
        window.__testHarness.setupRun({
          hero: f.hero,
          floor: f.floor ?? 1,
          saveOverrides: f.saveOverrides ?? {},
          playerOverrides: f.playerOverrides ?? {},
        })
      }, fixture)
      return
    case 'importGrid':
      await evalHarness(page, snapshot => {
        window.__testHarness.importGrid(snapshot)
      }, fixture.gridSnapshot)
      return
    case 'onTileTap':
    case 'fightAction':
      await evalHarness(page, async ({ row, col, waitMs }) => {
        window.__testHarness.onTileTap(row, col)
        if (waitMs) await new Promise(r => setTimeout(r, waitMs))
      }, { row: step.row, col: step.col, waitMs: step.waitMs ?? 0 })
      return
    case 'forceLevelUp':
      await evalHarness(page, () => {
        const ok = window.__testHarness.forceLevelUp()
        if (!ok) throw new Error('forceLevelUp failed')
      })
      return
    case 'pickLevelUp':
      await evalHarness(page, ability => {
        const ok = window.__testHarness.pickLevelUp(ability)
        if (!ok) throw new Error(`pickLevelUp(${ability}) failed`)
      }, step.ability)
      return
    case 'setRandom':
      await evalHarness(page, values => {
        let i = 0
        const seq = values ?? [0]
        window.__testHarnessRandomSeq = seq
        Math.random = () => {
          const v = seq[Math.min(i, seq.length - 1)]
          i++
          return v
        }
      }, step.values ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      return
    case 'waitCombat':
      await waitForCombatIdle(page, step.timeoutMs ?? 5000)
      return
    case 'wait':
      await sleep(step.ms ?? 500)
      return
    default:
      throw new Error(`Unknown scenario step action: ${step.action}`)
  }
}

/** @param {object} snap @param {object} expectSpec */
function assertExpectations(snap, expectSpec) {
  if (expectSpec.gameState != null) {
    assert.equal(snap.gameState, expectSpec.gameState, `gameState expected ${expectSpec.gameState}`)
  }
  if (expectSpec.playerHp != null) {
    assert.equal(snap.playerHp, expectSpec.playerHp, `playerHp expected ${expectSpec.playerHp}`)
  }
  if (expectSpec.playerMaxHp != null) {
    assert.equal(snap.playerMaxHp, expectSpec.playerMaxHp, `playerMaxHp expected ${expectSpec.playerMaxHp}`)
  }
  if (expectSpec.playerGold != null) {
    assert.equal(snap.playerGold, expectSpec.playerGold, `playerGold expected ${expectSpec.playerGold}`)
  }
  if (expectSpec.floor != null) {
    assert.equal(snap.floor, expectSpec.floor, `floor expected ${expectSpec.floor}`)
  }
  if (expectSpec.enemySlain) {
    const { row, col } = expectSpec.enemySlain
    assert.equal(snap.grid?.[row]?.[col]?.enemySlain, true, `enemy at ${row},${col} should be slain`)
  }
  if (expectSpec.chestLooted) {
    const { row, col } = expectSpec.chestLooted
    assert.equal(snap.grid?.[row]?.[col]?.chestLooted, true, `chest at ${row},${col} should be looted`)
  }
  if (expectSpec.inventoryIncludes) {
    assert.ok(
      snap.inventory?.includes(expectSpec.inventoryIncludes),
      `inventory should include ${expectSpec.inventoryIncludes}`,
    )
  }
}

for (const file of scenarioFiles) {
  const fixturePath = join(scenariosDir, file)
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))

  test(`scenario: ${fixture.id}`, { timeout: 120000 }, async () => {
    const pageErrors = []
    const page = await browser.newPage()
    attachConsoleGuards(page, pageErrors)

    try {
      await launchGame(page, { base: server.base })

      for (const step of fixture.steps) {
        throwFirstPageError(pageErrors)
        await runStep(page, step, fixture)
        throwFirstPageError(pageErrors)
      }

      // Allow async combat / floor transition timers to settle
      await sleep(200)
      throwFirstPageError(pageErrors)

      const snap = await getRunSnapshot(page)
      assertExpectations(snap, fixture.expect)
      throwFirstPageError(pageErrors)
    } finally {
      await page.close()
    }
  })
}
