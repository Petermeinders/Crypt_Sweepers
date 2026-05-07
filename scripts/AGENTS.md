# AGENTS.md — scripts/

The scripts directory contains Node.js tooling for headless balance analysis. These are run from the command line and require `npm start` (game server on port 3456) to be running first.

## Key Files

| File | Purpose |
|------|---------|
| `balance-bot-batch.mjs` | Playwright headless runner. Launches Chrome, loads the game with `?balanceBot=1`, waits for `window.__balanceBotReport` to be populated, and writes results to `artifacts/balance-bot-report.json` and `artifacts/balance-bot-runs.ndjson`. |
| `balance-report.mjs` | Node-only static analysis. Calls `computeBalanceSnapshot()` directly (no browser) and prints a formatted Markdown report to stdout. No Playwright required. |
| `set-ongoing-env.cjs` | CJS shim that sets `BALANCE_BOT_ONGOING=1` before the batch script runs. Used by `npm run test-bot-ongoing`. |

## Patterns

- **`balance-bot-batch.mjs` requires a running server.** The default URL is `http://127.0.0.1:3456` (override via `BALANCE_BOT_URL` env var). Start with `npm start` in a separate terminal.
- **CLI args:** `node scripts/balance-bot-batch.mjs [runs] [beginner|end] [heroId]` — args can be in any order. `runs` defaults to 20.
- **Key env vars:**
  - `BALANCE_BOT_PRESET=beginner|end` — save preset (overrides CLI arg)
  - `BALANCE_BOT_HERO=warrior|ranger|...` — hero to test
  - `BALANCE_BOT_ONGOING=1` — use ongoing-meta mode instead of preset wipe
  - `BALANCE_BOT_TIMEOUT_MS` — per-run timeout (default: 15 min)
  - `BALANCE_BOT_POLL_MS` — status poll interval (default: 5000ms)
  - `BALANCE_BOT_FAIL_ON_CONSOLE_ERROR=1` — treat browser console errors as failures
- **Output files** land in `artifacts/`. The directory is created automatically. These files are not committed — they are analysis scratch space.
- **`balance-report.mjs` is fast** (pure Node, no browser). Use it for quick number-checks after editing `js/data/` files. `balance-bot-batch.mjs` is slow (real gameplay simulation) — use it for full run-distribution analysis.
- **`set-ongoing-env.cjs` is CJS** because it uses `require()` to set `process.env` before the ES module script starts. Do not convert it to ESM.

## External Dependencies

- **`balance-bot-batch.mjs`** — imports `playwright`, writes to `artifacts/`; drives `js/dev/balanceBotAutopilot.js` indirectly via browser
- **`balance-report.mjs`** — imports `js/balance/snapshot.js` directly in Node
- **Required external:** `npm start` must be running for `balance-bot-batch.mjs`
