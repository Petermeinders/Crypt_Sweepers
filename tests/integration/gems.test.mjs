/**
 * Gem smoke tests — all 15 parry gems, verifying each fires its effect.
 *
 * Key design decisions:
 *   - Math.random=0.5 → block outcome; Math.random=0.1 → counter outcome
 *   - enemy hitDamage=0: no player HP loss on block, so armor gems are not consumed by takeDamage
 *   - Streak-based gems: pre-seed gemStreaks[gemId]=minStreak-1 so ONE fight fires the effect
 *   - tickPoisonArrowDotOnGlobalTurn fires at fight start (decrements poisonTurns); Venom
 *     Shard pre-sets poisonTurns=2 so tick(2->1)+gem(+1)=2 turns for the "stack 2" assertion
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  startServer,
  launchGame,
  evalHarness,
  waitForCombatIdle,
  attachConsoleGuards,
  throwFirstPageError,
  chromium,
  sleep,
} from '../helpers/playwrightHarness.mjs'

let server
let browser

before(async () => {
  server = await startServer()
  browser = await chromium.launch()
})

after(async () => {
  await browser?.close()
  server?.proc?.kill('SIGTERM')
})

// ── Grid helpers ──────────────────────────────────────────────────────────────

function makeTestGrid({ enemyHp = 500, hitDamage = 0, extraCells = {} } = {}) {
  const ROWS = 6, COLS = 5
  const empty = () => ({
    type: 'empty', revealed: false, locked: false, reachable: false,
    enemyData: null, itemData: null, chestLoot: null,
  })
  const grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => empty()),
  )
  grid[0][0] = { ...empty(), revealed: true, reachable: true }
  grid[0][1] = {
    type: 'enemy', revealed: false, locked: false, reachable: true,
    itemData: null, chestLoot: null,
    enemyData: {
      enemyId: 'skeleton', hp: enemyHp, currentHP: enemyHp,
      dmg: [1, 1], hitDamage,
      type: 'undead', behaviour: 'standard',
      emoji: '💀', label: 'Skeleton',
      goldDrop: [0, 0], xpDrop: 0, threatLevel: 0, attributes: [],
    },
  }
  for (const [key, cell] of Object.entries(extraCells)) {
    const [r, c] = key.split(',').map(Number)
    grid[r][c] = cell
  }
  return grid
}

const emptyCell = () => ({
  type: 'empty', revealed: false, locked: false, reachable: false,
  enemyData: null, itemData: null, chestLoot: null,
})

const enemyCell = (hp = 50) => ({
  type: 'enemy', revealed: false, locked: false, reachable: false,
  itemData: null, chestLoot: null,
  enemyData: {
    enemyId: 'skeleton', hp, currentHP: hp, dmg: [1, 1], hitDamage: 0,
    type: 'undead', behaviour: 'standard', emoji: '💀', label: 'Skeleton',
    goldDrop: [0, 0], xpDrop: 0, threatLevel: 0, attributes: [],
  },
})

const revealedEnemyCell = (hp = 200) => ({
  ...enemyCell(hp), revealed: true, reachable: true,
})

// ── Page helpers ──────────────────────────────────────────────────────────────

async function setupGemRun(page, opts = {}) {
  const { blockGem = null, counterGem = null, randomVal = 0.5, grid = null, playerOverrides = {} } = opts
  await evalHarness(page, ({ blockGem, counterGem, randomVal, grid, playerOverrides }) => {
    const v = randomVal
    Math.random = () => v
    window.__testHarness.setupRun({ hero: 'warrior', floor: 1, playerOverrides })
    if (grid) window.__testHarness.importGrid(grid)
    const run = window.__testHarness.GameController.getRun()
    run.equippedGems = { block: blockGem, counter: counterGem }
    run.gemStreaks = {}
  }, { blockGem, counterGem, randomVal, grid, playerOverrides })
}

async function setGemStreak(page, gemId, streak) {
  await evalHarness(page, ({ gemId, streak }) => {
    const run = window.__testHarness.GameController.getRun()
    if (!run.gemStreaks) run.gemStreaks = {}
    run.gemStreaks[gemId] = streak
  }, { gemId, streak })
}

async function readGemState(page, { enemyRow = 0, enemyCol = 1 } = {}) {
  return evalHarness(page, ({ er, ec }) => {
    const run = window.__testHarness.GameController.getRun()
    const grid = window.__testHarness.TileEngine.getGrid()
    const ed = grid?.[er]?.[ec]?.enemyData
    return {
      playerHp:      run.player.hp,
      playerMaxHp:   run.player.maxHp,
      playerMana:    run.player.mana,
      playerMaxMana: run.player.maxMana,
      playerArmor:   run.player.armor ?? 0,
      freeCharge:    run.player.gemFreeAbilityCharge ?? 0,
      enemyHp:          ed?.currentHP ?? null,
      enemyPoisonTurns: ed?.poisonTurns ?? 0,
      enemyPoisonPct:   ed?.poisonPctDmg ?? 0,
      enemyStunTurns:   ed?.stunTurns ?? 0,
      gemStreaks:    run.gemStreaks ?? {},
      floorBuffs:    run.floorBuffs ?? [],
      revealedCount: grid?.flat().filter(t => t.revealed).length ?? 0,
    }
  }, { er: enemyRow, ec: enemyCol })
}

async function tap(page, row, col) {
  await evalHarness(page, ({ row, col }) => window.__testHarness.onTileTap(row, col), { row, col })
}

async function reveal(page) {
  await tap(page, 0, 1)
  await waitForCombatIdle(page)
  await sleep(80)
}

async function fight(page) {
  await tap(page, 0, 1)
  await waitForCombatIdle(page)
  await sleep(200)
}

async function withPage(fn) {
  const pageErrors = []
  const page = await browser.newPage()
  attachConsoleGuards(page, pageErrors)
  try {
    await launchGame(page, { base: server.base })
    throwFirstPageError(pageErrors)
    await fn(page)
    throwFirstPageError(pageErrors)
  } finally {
    await page.close()
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK GEMS (randomVal=0.5 → "block" auto-block outcome)
// ════════════════════════════════════════════════════════════════════════════

test("gem: Warden's Opal — negate block damage", { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid({ hitDamage: 4 })
    await setupGemRun(page, { blockGem: 'gem-wardens-opal', randomVal: 0.2, grid })
    const before = await readGemState(page)
    await reveal(page)
    await fight(page)
    const after = await readGemState(page)
    assert.equal(after.playerHp, before.playerHp,
      `Opal: HP unchanged. before=${before.playerHp} after=${after.playerHp}`)
    assert.equal(after.gemStreaks['gem-wardens-opal'], 1, 'Opal: streak=1')
  }),
)

test('gem: Venom Shard — poison stacks on block', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { blockGem: 'gem-venom-shard', randomVal: 0.2, grid })
    await reveal(page)
    await fight(page)
    const s1 = await readGemState(page)
    assert.equal(s1.enemyPoisonTurns, 1, 'Venom Shard: 1st block -> poisonTurns=1')
    assert.equal(s1.enemyPoisonPct, 2, 'Venom Shard: 1st block -> poisonPct=2%')

    // Pre-set poisonTurns=2; tick(2->1), gem adds 1 -> turns=2, pct=4
    await evalHarness(page, () => {
      const grid = window.__testHarness.TileEngine.getGrid()
      if (grid[0][1] && grid[0][1].enemyData) grid[0][1].enemyData.poisonTurns = 2
    })
    await fight(page)
    const s2 = await readGemState(page)
    assert.equal(s2.enemyPoisonPct, 4, 'Venom Shard: block at 2 pre-set turns -> poisonPct=4%')
    assert.equal(s2.gemStreaks['gem-venom-shard'], 2, 'Venom Shard: streak=2')
  }),
)

test('gem: Stalwart Stone — +1 armor at block streak >= 2', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { blockGem: 'gem-stalwart-stone', randomVal: 0.2, grid })
    await setGemStreak(page, 'gem-stalwart-stone', 1)
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    assert.equal(s.playerArmor, 1, 'Stalwart Stone: streak 2 -> +1 armor')
    assert.equal(s.gemStreaks['gem-stalwart-stone'], 2, 'Stalwart Stone: streak=2')
  }),
)

test('gem: Patience Crystal — streak-count armor at streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { blockGem: 'gem-patience-crystal', randomVal: 0.2, grid })
    await setGemStreak(page, 'gem-patience-crystal', 2)
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    assert.equal(s.playerArmor, 3, 'Patience Crystal: streak 3 -> +3 armor')
    assert.equal(s.gemStreaks['gem-patience-crystal'], 3, 'Patience Crystal: streak=3')
  }),
)

test('gem: Manaback Gem — restores streak mana on block', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { blockGem: 'gem-manaback-gem', randomVal: 0.2, grid })
    await evalHarness(page, () => {
      window.__testHarness.GameController.getRun().player.mana = 0
    })
    await reveal(page)
    await fight(page)
    const s1 = await readGemState(page)
    assert.equal(s1.playerMana, 2, 'Manaback Gem: streak 1 -> mana=2 (base:1 + gem:1)')
    await fight(page)
    const s2 = await readGemState(page)
    assert.equal(s2.playerMana, 5, 'Manaback Gem: streak 2 -> mana=5 (base:1+gem:1) + (base:1+gem:2)')
  }),
)

test('gem: Steadfast Shard — floor block-chance buff at streak >= 2', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { blockGem: 'gem-steadfast-shard', randomVal: 0.2, grid })
    await setGemStreak(page, 'gem-steadfast-shard', 1)
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    const buff = s.floorBuffs.find(b => b.type === 'gem-steadfast-block-chance')
    assert.ok(buff, 'Steadfast Shard: streak 2 -> floor buff added')
    assert.equal(buff.effectValue, 2, 'Steadfast Shard: buff effectValue=2%')
  }),
)

test('gem: Fortress Stone — reveal + armor at block streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid({
      extraCells: {
        '0,2': enemyCell(50), '1,0': enemyCell(50), '1,1': enemyCell(50), '1,2': enemyCell(50),
      },
    })
    await setupGemRun(page, { blockGem: 'gem-fortress-stone', randomVal: 0.2, grid })
    await setGemStreak(page, 'gem-fortress-stone', 2)
    await reveal(page)
    const afterReveal = await readGemState(page)
    await fight(page)
    const s = await readGemState(page)
    assert.ok(s.revealedCount > afterReveal.revealedCount,
      `Fortress Stone: streak 3 -> tiles revealed (${afterReveal.revealedCount} -> ${s.revealedCount})`)
    assert.ok(s.playerArmor > 0, 'Fortress Stone: streak 3 -> armor gained')
  }),
)

// ════════════════════════════════════════════════════════════════════════════
// COUNTER GEMS (randomVal=0.1 → "parry/counter" auto-block outcome)
// ════════════════════════════════════════════════════════════════════════════

test('gem: Riposte Ruby — stun on counter', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { counterGem: 'gem-riposte-ruby', randomVal: 0.05, grid })
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    assert.ok(s.enemyStunTurns >= 2, `Riposte Ruby: enemy stunned (stunTurns=${s.enemyStunTurns})`)
    assert.equal(s.gemStreaks['gem-riposte-ruby'], 1, 'Riposte Ruby: streak=1')
  }),
)

test("gem: Berserker's Fang — 20% damage bonus at counter streak >= 2", { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, {
      counterGem: 'gem-berserkers-fang', randomVal: 0.05, grid,
      playerOverrides: { damageBonus: 9 },
    })
    await reveal(page)
    const base = await readGemState(page)
    await fight(page)  // streak=1, no bonus
    const s1 = await readGemState(page)
    const drop1 = base.enemyHp - s1.enemyHp
    await fight(page)  // streak=2, +20% bonus
    const s2 = await readGemState(page)
    const drop2 = s1.enemyHp - s2.enemyHp
    assert.ok(drop1 > 0, `Berserker's Fang: fight 1 deals damage (${drop1})`)
    assert.ok(drop2 > drop1, `Berserker's Fang: fight 2 deals more (${drop2} vs ${drop1})`)
  }),
)

test('gem: Momentum Emerald — free ability charge at counter streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { counterGem: 'gem-momentum-emerald', randomVal: 0.05, grid })
    await setGemStreak(page, 'gem-momentum-emerald', 2)
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    assert.equal(s.freeCharge, 1, 'Momentum Emerald: streak 3 -> 1 free charge')
    assert.equal(s.gemStreaks['gem-momentum-emerald'], 3, 'Momentum Emerald: streak=3')
  }),
)

test('gem: Echo Gem — repeat counter strike deals extra damage', { timeout: 30000 }, () =>
  withPage(async page => {
    // damageBonus=9 -> playerDmg=10, echoHit=round(10*0.5)=5 -> total=15
    const grid = makeTestGrid()
    await setupGemRun(page, {
      counterGem: 'gem-echo-gem', randomVal: 0.05, grid,
      playerOverrides: { damageBonus: 9 },
    })
    await reveal(page)
    const before = await readGemState(page)
    await fight(page)
    const after = await readGemState(page)
    const totalDrop = before.enemyHp - after.enemyHp
    assert.ok(totalDrop > 10,
      `Echo Gem: enemy took ${totalDrop} damage; expected > 10 (player 10 + echo 5)`)
    assert.equal(after.gemStreaks['gem-echo-gem'], 1, 'Echo Gem: streak=1')
  }),
)

test("gem: Predator's Eye — reveals a random tile on counter", { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { counterGem: 'gem-predators-eye', randomVal: 0.05, grid })
    await reveal(page)
    const afterReveal = await readGemState(page)
    await fight(page)
    const s = await readGemState(page)
    assert.ok(s.revealedCount > afterReveal.revealedCount,
      `Predator's Eye: tile revealed (${afterReveal.revealedCount} -> ${s.revealedCount})`)
  }),
)

test('gem: Chain Fang — reveal + chain damage at counter streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid({
      extraCells: {
        '0,2': enemyCell(50), '1,0': enemyCell(50), '1,1': enemyCell(50), '1,2': enemyCell(50),
      },
    })
    await setupGemRun(page, { counterGem: 'gem-chain-fang', randomVal: 0.05, grid })
    await setGemStreak(page, 'gem-chain-fang', 2)
    await reveal(page)
    const afterReveal = await readGemState(page)
    await fight(page)
    const s = await readGemState(page)
    assert.ok(s.revealedCount > afterReveal.revealedCount,
      `Chain Fang: streak 3 -> tiles revealed (${afterReveal.revealedCount} -> ${s.revealedCount})`)
    assert.equal(s.gemStreaks['gem-chain-fang'], 3, 'Chain Fang: streak=3')
  }),
)

test('gem: Bloodthirst Crystal — heals 5% max HP at counter streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid()
    await setupGemRun(page, { counterGem: 'gem-bloodthirst-crystal', randomVal: 0.05, grid })
    await setGemStreak(page, 'gem-bloodthirst-crystal', 2)
    await evalHarness(page, () => {
      const run = window.__testHarness.GameController.getRun()
      run.player.hp = Math.max(1, run.player.hp - 30)
    })
    const before = await readGemState(page)
    await reveal(page)
    await fight(page)
    const s = await readGemState(page)
    assert.ok(s.playerHp > before.playerHp,
      `Bloodthirst Crystal: HP healed (before=${before.playerHp} after=${s.playerHp})`)
    assert.equal(s.gemStreaks['gem-bloodthirst-crystal'], 3, 'Bloodthirst Crystal: streak=3')
  }),
)

test('gem: Storm Gem — lightning hits all revealed enemies at counter streak >= 3', { timeout: 30000 }, () =>
  withPage(async page => {
    const grid = makeTestGrid({ extraCells: { '2,0': revealedEnemyCell(200) } })
    await setupGemRun(page, { counterGem: 'gem-storm-gem', randomVal: 0.05, grid })
    await setGemStreak(page, 'gem-storm-gem', 2)
    const before2 = await readGemState(page, { enemyRow: 2, enemyCol: 0 })
    await reveal(page)
    await fight(page)
    const after2 = await readGemState(page, { enemyRow: 2, enemyCol: 0 })
    assert.ok(after2.enemyHp < before2.enemyHp,
      `Storm Gem: streak 3 -> lightning hit second enemy (${before2.enemyHp} -> ${after2.enemyHp})`)
    assert.equal(
      (await readGemState(page)).gemStreaks['gem-storm-gem'], 3,
      'Storm Gem: streak=3',
    )
  }),
)
