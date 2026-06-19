import { computeRiskScore, computeTierWeights } from '../../systems/CasinoEngine.js'
import { CASINO_CONFIG } from '../../data/casinoConfig.js'
import { runSlotAnimation, resetSlots } from './SlotMachine.js'

const TIERS = ['common', 'rare', 'epic', 'legendary']

function _el(id) { return document.getElementById(id) }

// ── Balances ──────────────────────────────────────────────────────────────────

function _renderBalances(save) {
  _el('casino-gold-balance').textContent     = save.persistentGold ?? 0
  _el('casino-scrap-balance').textContent    = save.scrap ?? 0
  _el('casino-fragment-balance').textContent = save.meta?.casino?.voidFragments ?? 0
}

// ── Live odds + drop probability component ────────────────────────────────────

function _updateOdds(gold, scrap) {
  const riskScore = computeRiskScore(gold, scrap)
  const weights   = computeTierWeights(riskScore)

  // Normalise to 100%
  const total = TIERS.reduce((s, t) => s + weights[t], 0)
  const pcts  = {}
  TIERS.forEach(t => { pcts[t] = total > 0 ? (weights[t] / total) * 100 : 0 })

  // Stacked bar
  TIERS.forEach(t => {
    const bar = _el(`casino-bar-${t}`)
    if (bar) bar.style.width = `${pcts[t].toFixed(1)}%`
  })

  // Sum label
  const sum = TIERS.reduce((s, t) => s + pcts[t], 0)
  const sumEl = _el('casino-prob-sum')
  if (sumEl) sumEl.textContent = `Sum: ${sum.toFixed(1)}%`

  // Per-tier cards
  TIERS.forEach(t => {
    const base   = CASINO_CONFIG.baseTierWeights[t]
    const pct    = pcts[t]
    const delta  = pct - base

    const pctEl  = _el(`casino-pct-${t}`)
    const diffEl = _el(`casino-diff-${t}`)
    if (pctEl)  pctEl.textContent  = `${pct.toFixed(1)}%`
    if (diffEl) {
      if (Math.abs(delta) < 0.05) {
        diffEl.textContent  = 'Base'
        diffEl.className    = 'casino-prob-diff'
      } else if (delta > 0) {
        diffEl.textContent  = `+${delta.toFixed(1)}% vs Base`
        diffEl.className    = 'casino-prob-diff casino-prob-diff--up'
      } else {
        diffEl.textContent  = `${delta.toFixed(1)}% vs Base`
        diffEl.className    = 'casino-prob-diff casino-prob-diff--down'
      }
    }
  })
}

// ── Input sync helpers ────────────────────────────────────────────────────────

function _syncGold(gold, maxGold) {
  const clamped = Math.min(Math.max(gold, 100), maxGold)
  _el('casino-gold-input').value  = clamped
  _el('casino-gold-slider').value = clamped
  return clamped
}

function _syncScrap(scrap, maxScrap) {
  const clamped = Math.min(Math.max(scrap, 0), maxScrap)
  _el('casino-scrap-input').value  = clamped
  _el('casino-scrap-slider').value = clamped
  return clamped
}

function _readGold()  { return Math.max(100, parseInt(_el('casino-gold-input').value,  10) || 100) }
function _readScrap() { return Math.max(0, parseInt(_el('casino-scrap-input').value, 10) || 0) }

// ── Result views ──────────────────────────────────────────────────────────────

function _showNonGearResult(reward, tierRolled, save) {
  const tierLabel = { common: 'Common', rare: 'Rare!', epic: 'Epic!!', legendary: 'LEGENDARY!!!' }
  let desc = ''
  if (reward.type === 'voidFragment') {
    if (reward.pearlsAwarded) {
      _showVoidPearlCelebration(reward.pearlsAwarded, save)
      return
    }
    const current = save?.meta?.casino?.voidFragments ?? 0
    desc = `You found ${reward.fragments} Void Fragment${reward.fragments > 1 ? 's' : ''}! (${current} / 5 toward a Void Pearl)`
  } else {
    desc = `+${reward.gold} Gold, +${reward.scrap} Scrap returned`
  }
  _el('casino-result-tier').textContent = tierLabel[tierRolled] ?? tierRolled
  _el('casino-result-desc').textContent = desc
  _el('casino-result').classList.remove('hidden')
}

function _showVoidPearlCelebration(pearlsAwarded, save) {
  const totalPearls = save?.meta?.voidPearls ?? pearlsAwarded
  const el = _el('casino-result')
  const tierEl = _el('casino-result-tier')
  const descEl = _el('casino-result-desc')
  tierEl.textContent = '🌑 VOID PEARL!'
  tierEl.style.color = '#c084fc'
  descEl.innerHTML = `
    <div>5 Void Fragments merged into a <strong style="color:#c084fc">Void Pearl</strong>!</div>
    <div style="margin-top:4px;color:#a1a1aa">You now have <strong>${totalPearls}</strong> Void Pearl${totalPearls !== 1 ? 's' : ''}.</div>
  `
  el.classList.remove('hidden')
  el.classList.add('casino-result--pearl')
}

function _showSpinAgainPrompt(tierLabel, desc) {
  _el('casino-result-tier').textContent = tierLabel
  _el('casino-result-desc').textContent = desc
  _el('casino-result').classList.remove('hidden')
}

function _resetBetView(save) {
  const maxGold  = save?.persistentGold ?? 0
  const maxScrap = save?.scrap ?? 0
  _syncGold(100, maxGold)
  _syncScrap(0, maxScrap)
  const result = _el('casino-result')
  result?.classList.add('hidden')
  result?.classList.remove('casino-result--pearl')
  const tierEl = _el('casino-result-tier')
  if (tierEl) tierEl.style.color = ''
  _el('casino-spin-btn').disabled = false
  _updateOdds(100, 0)
  resetSlots()
}

// ── Gear compare modal ────────────────────────────────────────────────────────

function _showGearCompare(deps, piece, tierRolled) {
  const { GameController, UI } = deps
  const save     = GameController.getSave()
  const equipped = (save.equippedGear ?? {})[piece.slot] ?? null
  const tierLabel = { common: 'Common', rare: 'Rare!', epic: 'Epic!!', legendary: 'LEGENDARY!!!' }

  UI.renderCompareModal(
    piece,
    equipped,
    () => {
      GameController.casinoEquipGear(piece)
      UI.hideCompareModal()
      _renderBalances(GameController.getSave())
      _showSpinAgainPrompt(tierLabel[tierRolled] ?? tierRolled, `${piece.name} equipped!`)
    },
    () => {
      UI.hideCompareModal()
      _showSpinAgainPrompt(tierLabel[tierRolled] ?? tierRolled, `${piece.name} kept for later.`)
    },
    () => {
      GameController.casinoScrapGear(piece)
      UI.hideCompareModal()
      _renderBalances(GameController.getSave())
      _showSpinAgainPrompt(tierLabel[tierRolled] ?? tierRolled, `${piece.name} scrapped.`)
    },
    { hideCancel: true },
  )
}

// ── Wire ──────────────────────────────────────────────────────────────────────

export function wireCasinoPanel(deps) {
  const { GameController } = deps

  _el('casino-back')?.addEventListener('click', () => _el('casino-overlay').classList.add('hidden'))

  // Gold slider ↔ number input
  _el('casino-gold-slider')?.addEventListener('input', e => {
    const max = GameController.getSave().persistentGold ?? 0
    const g   = _syncGold(parseInt(e.target.value, 10) || 0, max)
    _updateOdds(g, _readScrap())
  })
  _el('casino-gold-input')?.addEventListener('input', () => {
    const max = GameController.getSave().persistentGold ?? 0
    const g   = _syncGold(_readGold(), max)
    _updateOdds(g, _readScrap())
  })

  // Scrap slider ↔ number input
  _el('casino-scrap-slider')?.addEventListener('input', e => {
    const max = GameController.getSave().scrap ?? 0
    const s   = _syncScrap(parseInt(e.target.value, 10) || 0, max)
    _updateOdds(_readGold(), s)
  })
  _el('casino-scrap-input')?.addEventListener('input', () => {
    const max = GameController.getSave().scrap ?? 0
    const s   = _syncScrap(_readScrap(), max)
    _updateOdds(_readGold(), s)
  })

  // Spin
  _el('casino-spin-btn')?.addEventListener('click', async () => {
    const gold  = _readGold()
    const scrap = _readScrap()
    const result = GameController.spinCasino(gold, scrap)
    if (result?.error) return

    const spinBtn = _el('casino-spin-btn')
    spinBtn.disabled = true
    spinBtn.textContent = '🎰 Spinning…'

    await runSlotAnimation(result.tierRolled)

    spinBtn.textContent = '🎰 Spin'
    spinBtn.disabled = false
    _renderBalances(GameController.getSave())

    if (result.reward.type === 'gear') {
      _showGearCompare(deps, result.reward.gear, result.tierRolled)
    } else {
      _showNonGearResult(result.reward, result.tierRolled, GameController.getSave())
    }
  })
}

export function openCasino(deps) {
  const save = deps.GameController.getSave()
  _el('casino-overlay')?.classList.remove('hidden')
  _renderBalances(save)
  _resetBetView(save)
}
