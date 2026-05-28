/**
 * Playwright helpers for ?testHarness=1 integration scenarios.
 * Reuses patterns from scripts/balance-bot-batch.mjs.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..', '..')

const DEFAULT_BASE = (process.env.BALANCE_BOT_URL || 'http://127.0.0.1:3456').replace(/\/$/, '')

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function parseBaseUrl(base = DEFAULT_BASE) {
  return new URL(base.includes('://') ? base : `http://${base}`)
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host }, () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })
}

async function waitForPort(port, host = '127.0.0.1', timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portOpen(port, host)) return true
    await sleep(250)
  }
  return false
}

/**
 * Spawn `npx serve@14 . -p 3456` when nothing is listening (or use BALANCE_BOT_URL).
 * @returns {{ base: string, proc: import('node:child_process').ChildProcess | null }}
 */
export async function startServer(opts = {}) {
  const base = (opts.base ?? DEFAULT_BASE).replace(/\/$/, '')
  const { port, hostname } = parseBaseUrl(base)
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname

  if (await portOpen(Number(port), host)) {
    return { base, proc: null }
  }

  const proc = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'serve@14', '.', '-p', String(port)],
    { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' },
  )

  const ready = await waitForPort(Number(port), host)
  if (!ready) {
    proc.kill()
    throw new Error(`playwrightHarness: server did not start on ${base} within 30s`)
  }

  return { base, proc }
}

/**
 * @param {import('playwright').Page} page
 * @param {{ base?: string, timeoutMs?: number }} [opts]
 */
export async function launchGame(page, opts = {}) {
  const base = (opts.base ?? DEFAULT_BASE).replace(/\/$/, '')
  const timeoutMs = opts.timeoutMs ?? 120000
  page.setDefaultTimeout(timeoutMs)

  const url = new URL(base)
  url.searchParams.set('testHarness', '1')
  url.searchParams.set('_', String(Date.now()))

  const response = await page.goto(url.toString(), {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  })

  if (page.url() === 'about:blank') {
    throw new Error('playwrightHarness: page stayed about:blank (server down?)')
  }
  if (response && !response.ok()) {
    throw new Error(`playwrightHarness: HTTP ${response.status()} for ${response.url()}`)
  }

  await page.waitForFunction(() => window.__testHarnessReady === true, null, { timeout: timeoutMs })
}

/**
 * Safe page.evaluate wrapper — fn receives a single serializable arg.
 * @template T, R
 * @param {import('playwright').Page} page
 * @param {(arg: T) => R} fn
 * @param {T} [arg]
 * @returns {Promise<R>}
 */
export async function evalHarness(page, fn, arg) {
  return page.evaluate(fn, arg)
}

/**
 * @param {import('playwright').Page} page
 */
export async function getRunSnapshot(page) {
  return evalHarness(page, () => {
    const h = window.__testHarness
    if (h?.getSnapshot) return h.getSnapshot()
    const save = h?.GameController?.getSave?.()
    const active = save?.activeRun
    return {
      gameState: h?.GameState?.current?.() ?? null,
      playerHp: active?.player?.hp ?? null,
      playerGold: active?.player?.gold ?? null,
      floor: active?.floor ?? null,
      grid: active?.gridSnapshot ?? null,
    }
  })
}

export async function waitForCombatIdle(page, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const diag = await evalHarness(page, () => window.__testHarness.getDiagnostics())
    if (!diag?.combatBusy) return
    await sleep(50)
  }
  throw new Error('playwrightHarness: combat still busy after timeout')
}

export function attachConsoleGuards(page, pageErrors) {
  page.on('pageerror', err => {
    pageErrors.push(err instanceof Error ? err : new Error(String(err)))
  })
  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error') {
      pageErrors.push(new Error(`[browser console.error] ${text}`))
    } else if (/\[GameState\] Invalid transition/.test(text)) {
      pageErrors.push(new Error(text))
    }
  })
}

export function throwFirstPageError(pageErrors) {
  if (pageErrors.length === 0) return
  const first = pageErrors[0]
  pageErrors.length = 0
  throw first
}

export { chromium, sleep, root, DEFAULT_BASE }
