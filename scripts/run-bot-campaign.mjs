#!/usr/bin/env node
/**
 * Bot campaign runner — wraps balance-bot-batch in a self-contained folder with:
 *   campaign-overview.json   written at start (criteria) + updated at end (results)
 *   run-NN-save.json         full save state after each run
 *   run-NN-summary.json      floor/level/HP/gear/outcome per run
 *   bot-output.log           full console output
 *
 * Usage:
 *   node scripts/run-bot-campaign.mjs [runs] [heroId]
 *   BALANCE_BOT_SAVE_FILE=path/to/save.json node scripts/run-bot-campaign.mjs 20
 *
 * Env vars:
 *   BALANCE_BOT_SAVE_FILE   — JSON save file to inject into IndexedDB before starting
 *   BALANCE_BOT_HERO        — hero id (warrior, ranger, …)
 *   BALANCE_BOT_URL         — game server URL (default http://127.0.0.1:3456)
 *   BALANCE_BOT_TIMEOUT_MS  — total timeout for all runs (default 60 min)
 *   BALANCE_BOT_POLL_MS     — polling interval (default 5000)
 *   BALANCE_BOT_POLICY      — tap policy (default abilities)
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, appendFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ── Args / env ────────────────────────────────────────────────────────────────
const ALL_HEROES  = ['warrior', 'ranger', 'mage', 'engineer', 'vampire', 'necromancer']

function parseArgs(argv) {
  let runs = 20, hero = null
  for (const a of argv) {
    if (ALL_HEROES.includes(a))  hero = a
    else if (/^\d+$/.test(a))    runs = Math.max(1, parseInt(a, 10))
  }
  return { runs, hero }
}

const { runs: runsTarget, hero: heroArg } = parseArgs(process.argv.slice(2))
const hero        = process.env.BALANCE_BOT_HERO      || heroArg || 'warrior'
const base        = (process.env.BALANCE_BOT_URL      || 'http://127.0.0.1:3456').replace(/\/$/, '')
const maxWaitMs   = Number(process.env.BALANCE_BOT_TIMEOUT_MS || 3600000)  // 60 min total
const pollMs      = Math.max(1000, Number(process.env.BALANCE_BOT_POLL_MS || 5000))
const policy      = process.env.BALANCE_BOT_POLICY    || 'abilities'
const saveFile    = process.env.BALANCE_BOT_SAVE_FILE  || null

// ── Campaign folder ───────────────────────────────────────────────────────────
const ts        = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const campaignId = `campaign-${ts}-${hero}`
const outDir    = join(root, 'artifacts', campaignId)
mkdirSync(outDir, { recursive: true })

const logPath     = join(outDir, 'bot-output.log')
const overviewPath = join(outDir, 'campaign-overview.json')

function log(...args) {
  const line = args.join(' ')
  console.log(line)
  appendFileSync(logPath, line + '\n')
}

function writeOverview(extra = {}) {
  const obj = {
    campaignId,
    startedAt: startedAt.toISOString(),
    criteria: {
      runsTarget,
      hero,
      mode:       'test-bot-ongoing',
      policy,
      spendPriority: ['global-passives', 'hero-xp-upgrades', 'gear-blacksmith'],
      checkpoints: 'always use deepest unlocked checkpoint',
      retreatAt:  'HP < 10% of max',
      savePerRun: true,
      importedSave: saveFile ?? null,
    },
    ...extra,
  }
  writeFileSync(overviewPath, JSON.stringify(obj, null, 2))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function progressBar(done, total, width = 28) {
  if (!total) return `[${'░'.repeat(width)}]`
  const f  = Math.min(1, done / total)
  const filled = Math.round(f * width)
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`
}

/**
 * Inject a save JSON into IndexedDB so the bot picks it up on load.
 * Uses the same DB/store/key as SaveManager.js.
 */
async function injectSave(page, saveData) {
  await page.evaluate((data) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('cryptic-grids', 1)
      req.onupgradeneeded = e => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('save')) {
          db.createObjectStore('save')
        }
      }
      req.onsuccess = e => {
        const db = e.target.result
        const tx = db.transaction('save', 'readwrite')
        tx.objectStore('save').put({ ...data, lastSaved: Date.now() }, 'main')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror    = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, saveData)
}

// ── Main ──────────────────────────────────────────────────────────────────────
const startedAt = new Date()
writeOverview()
log(`[campaign] Started ${campaignId}`)
log(`[campaign] Output folder: ${outDir}`)
log(`[campaign] ${runsTarget} runs · hero=${hero} · policy=${policy}`)
log(`[campaign] Spend order: global passives → XP upgrades → gear`)
if (saveFile) log(`[campaign] Importing save: ${saveFile}`)

// Load save to inject (if provided)
let importedSave = null
if (saveFile) {
  if (!existsSync(saveFile)) {
    console.error(`[campaign] ERROR: save file not found: ${saveFile}`)
    process.exit(1)
  }
  importedSave = JSON.parse(readFileSync(saveFile, 'utf8'))
  log(`[campaign] Save loaded — deepestFloor=${importedSave.meta?.deepestFloor ?? '?'} gold=${importedSave.persistentGold ?? '?'}`)
}

const runSummaries = []
/** Tracks how many runs have been saved to disk — accumulates across page reloads */
let savedRunCount  = 0
let totalStuck = 0
let browser

try {
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page    = await context.newPage()

  page.on('pageerror', err => log(`[browser:error] ${err}`))
  page.on('console', msg => {
    const t = msg.text()
    if (msg.type() === 'error') {
      log(`[browser:console.error] ${t}`)
    } else if (/\[bot:|test-bot-ongoing|balance-bot/i.test(t)) {
      log(`[browser] ${t}`)
    }
  })

  const url = new URL(base.includes('://') ? base : `http://${base}`)
  url.searchParams.set('testBotOngoing', '1')
  url.searchParams.set('runs', String(runsTarget))
  url.searchParams.set('policy', policy)
  url.searchParams.set('_', String(Date.now()))
  if (hero) url.searchParams.set('balanceBotHero', hero)
  const pageUrl = url.toString()

  // Load a blank page first so IndexedDB is available for save injection
  if (importedSave) {
    log(`[campaign] Loading blank page for save injection…`)
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await injectSave(page, importedSave)
    log(`[campaign] Save injected into IndexedDB`)
  }

  log(`[campaign] Loading ${pageUrl}`)
  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  if (!response?.ok()) throw new Error(`HTTP ${response?.status()} for ${pageUrl}`)

  // ── Poll until all runs complete ─────────────────────────────────────────
  const deadline = Date.now() + maxWaitMs
  let lastBrowserCount = 0
  let stuckPolls = 0
  const STUCK_LIMIT = Math.ceil(120000 / pollMs)  // 2 min with no progress = stuck

  while (Date.now() < deadline) {
    await sleep(pollMs)

    const [runSaves, debug] = await page.evaluate(() => [
      window.__balanceBotRunSaves ?? [],
      window.__balanceBotDebug,
    ])

    // Collect any newly completed runs since last poll
    for (const entry of runSaves) {
      if (entry.runIndex > savedRunCount) {
        savedRunCount = entry.runIndex
        const tag = String(entry.runIndex).padStart(2, '0')

        writeFileSync(join(outDir, `run-${tag}-save.json`), JSON.stringify(entry.save, null, 2))

        const rs       = entry.telemetry?.telemetry?.outcome?.runEndSummary ?? entry.telemetry?.runStats ?? {}
        const lvlSnaps = entry.telemetry?.telemetry?.levelSnapshots ?? []
        const summary  = {
          runIndex:      entry.runIndex,
          outcome:       rs.outcome      ?? null,
          floorReached:  rs.floor        ?? null,
          levelReached:  rs.level        ?? null,
          tilesRevealed: rs.tilesRevealed ?? null,
          killedBy:      rs.killerLabel  ?? null,
          hpAtEnd:       rs.hpAtRetreat  ?? rs.hpAtDeath ?? null,
          deepestFloor:  entry.save?.meta?.deepestFloor ?? null,
          persistentGold: entry.save?.persistentGold ?? null,
          scrap:         entry.save?.scrap     ?? null,
          equippedGear:  entry.save?.equippedGear ?? null,
          globalPassives: entry.save?.globalPassives ?? [],
          heroUpgrades:  entry.save?.[entry.save?.selectedCharacter ?? 'warrior']?.upgrades ?? [],
          levelSnapshots: lvlSnaps.map(s => ({
            level:    s.characterLevel,
            floor:    s.floor,
            hp:       s.hp,
            maxHp:    s.maxHp,
            mana:     s.mana,
            maxMana:  s.maxMana,
            dmgRange: s.meleeDamageRange,
            gold:     s.gold,
          })),
        }
        writeFileSync(join(outDir, `run-${tag}-summary.json`), JSON.stringify(summary, null, 2))
        runSummaries.push(summary)
        log(`[campaign] Run ${tag}: outcome=${summary.outcome} floor=${summary.floorReached} level=${summary.levelReached} deepest=${summary.deepestFloor}`)
      }
    }

    const bar = progressBar(savedRunCount, runsTarget)
    const gs  = debug?.gameState ?? '?'
    log(`[campaign] ${bar} ${savedRunCount}/${runsTarget} runs | gameState=${gs}`)

    if (savedRunCount !== lastBrowserCount) {
      stuckPolls    = 0
      lastBrowserCount = savedRunCount
    } else {
      stuckPolls++
    }

    if (stuckPolls >= STUCK_LIMIT) {
      log(`[campaign] WARN: no progress for ${(stuckPolls * pollMs / 1000).toFixed(0)}s — reloading page`)
      totalStuck++
      stuckPolls = 0
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
      // Re-inject save if provided (page reload wipes IndexedDB state written before boot)
      // Actually no — boot.js loads from IndexedDB. The save is already persisted by the
      // game's own SaveManager after the first run, so we don't re-inject here.
      await sleep(3000)
    }

    if (savedRunCount >= runsTarget) {
      log('[campaign] All runs complete')
      break
    }
  }

  // ── Final overview ────────────────────────────────────────────────────────
  const floors   = runSummaries.map(r => r.floorReached).filter(Number.isFinite)
  const levels   = runSummaries.map(r => r.levelReached).filter(Number.isFinite)
  const mean     = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null
  const outcomes = {}
  for (const r of runSummaries) outcomes[r.outcome ?? 'unknown'] = (outcomes[r.outcome ?? 'unknown'] ?? 0) + 1

  const finalSave = runSummaries.at(-1)
  writeOverview({
    finishedAt:    new Date().toISOString(),
    runsCompleted: runSummaries.length,
    stuckRecoveries: totalStuck,
    aggregate: {
      outcomes,
      floorReached: { min: Math.min(...floors), max: Math.max(...floors), mean: mean(floors) },
      levelReached: { min: Math.min(...levels), max: Math.max(...levels), mean: mean(levels) },
    },
    finalState: {
      persistentGold: finalSave?.persistentGold ?? null,
      scrap:          finalSave?.scrap ?? null,
      deepestFloor:   finalSave?.deepestFloor ?? null,
      globalPassives: finalSave?.globalPassives ?? [],
      heroUpgrades:   finalSave?.heroUpgrades ?? [],
      equippedGear:   finalSave?.equippedGear ?? null,
    },
    runSummaries,
  })

  const floorLine = floors.length ? `min=${Math.min(...floors)} max=${Math.max(...floors)} mean=${mean(floors)}` : 'no data'
  log(`[campaign] ✓ Done. ${runSummaries.length} runs. Floors: ${floorLine}`)
  log(`[campaign] Files written to: ${outDir}`)

} catch (err) {
  log(`[campaign] FATAL: ${err.message}`)
  writeOverview({ error: err.message, runsCompleted: runSummaries.length, runSummaries })
  process.exitCode = 1
} finally {
  await browser?.close()
}
