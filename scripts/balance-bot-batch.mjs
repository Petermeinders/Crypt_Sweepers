#!/usr/bin/env node
/**
 * Headless batch: requires `npm start` (serve on port 3456) in another terminal.
 * Usage: npm run balance-bot -- 25
 * Test-bot-ongoing (10 runs, fresh Playwright profile = empty save): npm run test-bot-ongoing -- 10
 * Quick test (1 run): npm run balance-bot:once   or   npm run balance-bot -- 1
 * Env: BALANCE_BOT_URL=http://127.0.0.1:3456
 * Env: BALANCE_BOT_POLL_MS=5000 (status line interval), BALANCE_BOT_TIMEOUT_MS, BALANCE_BOT_FAIL_ON_CONSOLE_ERROR=1
 * Env: BALANCE_BOT_POLICY=abilities — optional URL param `policy` (e.g. abilities vs random taps).
 * Env: BALANCE_BOT_LEVEL_UP_WEIGHTS — URL-encoded JSON for `levelUpWeights` (ability id → weight).
 * Env: BALANCE_BOT_ABILITY_WEIGHTS — URL-encoded JSON for warrior ability weights (slam, blinding-light, spell, divine-light).
 * Env: BALANCE_BOT_PRESET=beginner | end — one-shot save + level-up behavior (see js/dev/balanceBotSavePresets.js).
 * Env: BALANCE_BOT_ONGOING=1 — use test-bot-ongoing (?testBotOngoing=1) instead of balance-bot; meta purchases + low-HP retreat.
 * Args: [runs] [beginner|end] — e.g. `node scripts/balance-bot-batch.mjs 25 end` (preset can also be first: `beginner 25`).
 * Writes: artifacts/balance-bot-report.json, artifacts/balance-bot-runs.ndjson (one JSON object per line)
 *
 * Note: per-run telemetry JSON only exists after each run finishes (see report). While a run is active,
 * npm start logs only show static assets (e.g. audio); use the status line below with `| gameState tap=…`
 * from window.__balanceBotDebug — not the last HTTP line in the server log.
 * The "finished N/M" count stays at 0 until the first run ends (death/retreat/escape); long end-preset runs are normal.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const ALL_HEROES = ['warrior', 'ranger', 'mage', 'engineer', 'vampire', 'necromancer']

function parseArgs(argv) {
  let runs = 20
  let preset = null
  let hero = process.env.BALANCE_BOT_HERO || null
  for (const a of argv) {
    if (a === 'beginner' || a === 'end') preset = a
    else if (ALL_HEROES.includes(a)) hero = a
    else if (/^\d+$/.test(a)) runs = Math.max(1, parseInt(a, 10))
  }
  return { runs, preset, hero }
}

const { runs, preset: presetFromArgv, hero: heroFromArgv } = parseArgs(process.argv.slice(2))
const balanceBotPreset = process.env.BALANCE_BOT_PRESET || presetFromArgv
const balanceBotHero = process.env.BALANCE_BOT_HERO || heroFromArgv
const testBotOngoing = process.env.BALANCE_BOT_ONGOING === '1' || process.env.BALANCE_BOT_ONGOING === 'true'
const base = (process.env.BALANCE_BOT_URL || 'http://127.0.0.1:3456').replace(/\/$/, '')
const maxWaitMs = Number(process.env.BALANCE_BOT_TIMEOUT_MS || 900000)
const pollMs = Math.max(500, Number(process.env.BALANCE_BOT_POLL_MS || 5000))
const failOnConsoleError = process.env.BALANCE_BOT_FAIL_ON_CONSOLE_ERROR === '1'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function progressBar(done, total, width = 28) {
  if (!total || total < 1) return `[${'░'.repeat(width)}]`
  const f = Math.min(1, Math.max(0, done / total))
  const filled = Math.round(f * width)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`
}

function throwFirstPageError(pageErrors) {
  if (pageErrors.length === 0) return
  const first = pageErrors[0]
  pageErrors.length = 0
  if (first instanceof Error) throw first
  throw new Error(String(first))
}

/** How many consecutive polls with no progress before we declare the bot stuck. */
const STUCK_POLL_LIMIT = Math.ceil(30000 / Math.max(500, Number(process.env.BALANCE_BOT_POLL_MS || 5000)))

async function waitForReportWithProgress(page, targetRuns, pageErrors) {
  const start = Date.now()
  const deadline = start + maxWaitMs

  let lastProgressKey = null
  let stuckPolls = 0

  while (Date.now() < deadline) {
    throwFirstPageError(pageErrors)
    if (page.isClosed()) {
      throw new Error('balance-bot: page closed before window.__balanceBotReport was set')
    }

    let state
    try {
      state = await page.evaluate((fallbackTarget) => ({
        done: window.__balanceBotReport !== undefined,
        completed: Array.isArray(window.__balanceBotRuns) ? window.__balanceBotRuns.length : 0,
        target: Number(window.__balanceBotRunsTarget) || fallbackTarget,
        debug: window.__balanceBotDebug ?? null,
      }), targetRuns)
    } catch (e) {
      throw new Error(`balance-bot: polling the page failed: ${e?.message ?? e}`, { cause: e })
    }

    if (state.done) return

    const elapsedSec = ((Date.now() - start) / 1000).toFixed(0)
    const bar = progressBar(state.completed, state.target)
    const d = state.debug
    const extra = d
      ? ` | ${d.gameState ?? '?'} run=${d.runActive ? '1' : '0'} f=${d.floor ?? '—'} tiles=${d.tilesRevealed ?? '—'} tap=${d.tapCandidates ?? '?'} use=${d.useItemCandidates ?? '?'}${d.hp != null ? ` hp=${d.hp}/${d.maxHp}` : ''}${d.meleeDmg != null ? ` dmg=${d.meleeDmg}` : ''}${d.combatBusy ? ' combatBusy' : ''}${d.targeting ? ` [${d.targeting}]` : ''}${d.lastBranch ? ` branch=${d.lastBranch}` : ''}${d.preset ? ` preset=${d.preset}` : ''}`
      : ' | (autopilot not ready)'
    console.log(`[balance-bot] ${elapsedSec}s  ${bar}  finished ${state.completed}/${state.target}${extra}`)

    // Stuck detection: force-retreat the current run if no progress for ~30s (rather than aborting the batch)
    const progressKey = `${state.completed}|${d?.floor ?? '—'}|${d?.tilesRevealed ?? '—'}`
    if (progressKey === lastProgressKey) {
      stuckPolls++
      if (stuckPolls >= STUCK_POLL_LIMIT) {
        console.warn(`[balance-bot] STUCK for ${stuckPolls} polls — force-retreating current run. State: ${extra.trim()}`)
        try {
          await page.evaluate(() => { window.__balanceBotCommand = 'retreat' })
        } catch (_) { /* ignore — page evaluate failure is non-fatal */ }
        stuckPolls = 0
        lastProgressKey = null
      }
    } else {
      lastProgressKey = progressKey
      stuckPolls = 0
    }

    await sleep(pollMs)
  }

  throw new Error(
    `balance-bot: timed out after ${maxWaitMs}ms waiting for window.__balanceBotReport (${targetRuns} run(s)).`,
  )
}

const browser = await chromium.launch()
try {
  const pageErrors = []
  const page = await browser.newPage()
  page.setDefaultTimeout(maxWaitMs)

  page.on('pageerror', err => {
    console.error('[balance-bot] page error (uncaught in page):', err)
    pageErrors.push(err instanceof Error ? err : new Error(String(err)))
  })

  page.on('console', msg => {
    const t = msg.text()
    if (msg.type() === 'error') {
      console.error('[browser console.error]', t)
      if (failOnConsoleError) {
        pageErrors.push(new Error(`[browser console.error] ${t}`))
      }
    } else if (
      /\[balanceBot\]/i.test(t) ||
      /balance-bot/i.test(t) ||
      /\[test-bot-ongoing\]/i.test(t) ||
      /test-bot-ongoing/i.test(t)
    ) {
      console.log('[browser]', t)
    }
  })

  console.log(
    `[balance-bot] Starting: ${runs} run(s)${testBotOngoing ? ' (test-bot-ongoing)' : ''}, max wait ${(maxWaitMs / 60000).toFixed(1)} min, status every ${pollMs / 1000}s`,
  )

  const entryUrl = new URL(base.includes('://') ? base : `http://${base}`)
  if (testBotOngoing) {
    entryUrl.searchParams.set('testBotOngoing', '1')
  } else {
    entryUrl.searchParams.set('balanceBot', '1')
  }
  entryUrl.searchParams.set('runs', String(runs))
  entryUrl.searchParams.set('_', String(Date.now()))
  if (process.env.BALANCE_BOT_POLICY) entryUrl.searchParams.set('policy', process.env.BALANCE_BOT_POLICY)
  if (process.env.BALANCE_BOT_LEVEL_UP_WEIGHTS) {
    entryUrl.searchParams.set('levelUpWeights', process.env.BALANCE_BOT_LEVEL_UP_WEIGHTS)
  }
  if (process.env.BALANCE_BOT_ABILITY_WEIGHTS) {
    entryUrl.searchParams.set('abilityWeights', process.env.BALANCE_BOT_ABILITY_WEIGHTS)
  }
  if (balanceBotPreset === 'beginner' || balanceBotPreset === 'end') {
    entryUrl.searchParams.set('balanceBotPreset', balanceBotPreset)
  }
  if (balanceBotHero && ALL_HEROES.includes(balanceBotHero)) {
    entryUrl.searchParams.set('balanceBotHero', balanceBotHero)
  }
  const pageUrl = entryUrl.toString()
  console.log(`[balance-bot] Loading ${pageUrl} …`)

  const response = await page.goto(pageUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  })
  if (page.url() === 'about:blank') {
    throw new Error(
      'balance-bot: page is still about:blank after goto (server down or wrong BALANCE_BOT_URL?)',
    )
  }
  if (response && !response.ok()) {
    throw new Error(
      `balance-bot: HTTP ${response.status()} ${response.statusText()} for ${response.url()}`,
    )
  }

  await waitForReportWithProgress(page, runs, pageErrors)

  const report = await page.evaluate(() => window.__balanceBotReport)
  if (report == null) {
    throw new Error('balance-bot: window.__balanceBotReport was missing after wait')
  }

  mkdirSync(join(root, 'artifacts'), { recursive: true })
  const heroTag = balanceBotHero ? `-${balanceBotHero}` : ''
  const presetTag = balanceBotPreset ? `-${balanceBotPreset}` : ''
  const outPath = join(root, 'artifacts', `balance-bot-report${heroTag}${presetTag}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log('[balance-bot] Wrote', outPath)
  const ndPath = join(root, 'artifacts', `balance-bot-runs${heroTag}${presetTag}.ndjson`)
  if (Array.isArray(report.runsDetail) && report.runsDetail.length > 0) {
    writeFileSync(ndPath, `${report.runsDetail.map(r => JSON.stringify(r)).join('\n')}\n`)
    console.log('[balance-bot] Wrote', ndPath)
  }
} finally {
  await browser.close()
}
