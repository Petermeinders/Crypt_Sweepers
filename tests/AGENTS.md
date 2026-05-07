# AGENTS.md — tests/

The tests directory contains automated tests for the balance system. The framework is Node's built-in test runner (`node:test`) — no external test library.

## Key Files

| File | Purpose |
|------|---------|
| `balance-snapshot.test.mjs` | Compares the live output of `computeBalanceSnapshot()` against a committed fixture. Asserts that balance pillars, tuning order, meta gap profile, and all per-floor/per-enemy rows match exactly. |
| `fixtures/balance-snapshot.json` | Golden-file fixture. The source of truth for what balance numbers should be. Committed intentionally — a diff here means balance values changed. |

## Patterns

- **Run with:** `npm test`
- **Framework:** `node:test` + `node:assert/strict` — no Jest, no Vitest.
- **The snapshot test is a regression gate, not a pass/fail oracle.** When you intentionally change balance values, regenerate the fixture and commit it alongside the code change. A failing snapshot means "something changed" — it's your job to decide if the change was intended.
- **Regenerate fixture:** compute the new snapshot and overwrite the file:
  ```bash
  node --input-type=module <<'EOF' > tests/fixtures/balance-snapshot.json
  import { computeBalanceSnapshot } from './js/balance/snapshot.js'
  process.stdout.write(JSON.stringify(computeBalanceSnapshot(), null, 2))
  EOF
  ```
- **Test files use `.mjs` extension** (ES module). The `package.json` `"type": "module"` field applies, but the explicit `.mjs` makes the runner unambiguous.
- **No DOM in tests.** `computeBalanceSnapshot()` is Node-safe by design (see `js/balance/AGENTS.md`). If a new test needs browser APIs, use Playwright via `scripts/balance-bot-batch.mjs` instead.

## External Dependencies

- **Imports:** `js/balance/snapshot.js`, `js/balance/balanceTargets.js`
- **Run by:** `npm test` → `node --test tests/**/*.test.mjs`
- **Playwright tests** (if added) belong in `tests/` and require `npm start` running first
