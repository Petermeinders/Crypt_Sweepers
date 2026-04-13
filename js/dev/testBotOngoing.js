/**
 * test-bot-ongoing — persistent meta progression + low-HP retreat.
 *
 * Enable: ?testBotOngoing=1
 * Optional: &policy=abilities|random  &runs=50  &levelUpWeights=...  &abilityWeights=...
 *
 * Behavior:
 * - Uses your real save (no preset wipe); abandons in-progress runs on load like balance-bot.
 * - On main menu before each new run: spends persistent gold on global passives, then XP on the
 *   selected hero’s meta upgrades (cheapest affordable first, repeated until broke).
 * - During a run: if HP drops below 10% (and HP > 0), Hasty Retreat — keeps retreat % (20% base;
 *   Iron Will passive can raise it).
 *
 * Debug: window.__balanceBotDebug (includes testBotOngoing: true)
 */
import { startBalanceBotAutopilot } from './balanceBotAutopilot.js'

export function startTestBotOngoing(opts = {}) {
  const runsParam = opts.runs
  const runs =
    runsParam === undefined || runsParam === null
      ? Infinity
      : Number(runsParam)
  const n = Number.isFinite(runs) ? runs : Infinity
  console.log(
    `[test-bot-ongoing] start — runs=${n === Infinity ? '∞' : n} policy=${opts.policy ?? 'abilities'}`,
  )
  startBalanceBotAutopilot({
    ...opts,
    testBotOngoing: true,
    runs: n,
  })
}
