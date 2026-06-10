/** URL-param dev tooling — balance bot, test harness, test-bot-ongoing. */

export function parseDevUrlFlags(search = typeof location !== 'undefined' ? location.search : '') {
  const urlParams = new URLSearchParams(search)
  const hasTestHarness = urlParams.has('testHarness')
  const hasTestBotOngoing = urlParams.has('testBotOngoing')
  const hasBalanceBot = urlParams.has('balanceBot') && !hasTestBotOngoing && !hasTestHarness
  const balanceBotPreset =
    urlParams.get('balanceBotPreset') ||
    (urlParams.has('balanceBotBeginner') ? 'beginner' : null) ||
    (urlParams.has('balanceBotEnd') ? 'end' : null) ||
    (hasBalanceBot ? 'beginner' : null)
  // ?applyPreset=maxed — applies a save preset without starting the bot (for manual play)
  const applyPreset = urlParams.get('applyPreset') || null

  return {
    urlParams,
    hasTestHarness,
    hasTestBotOngoing,
    hasBalanceBot,
    balanceBotPreset,
    applyPreset,
    isHeadlessBotSession: hasTestHarness || hasTestBotOngoing || hasBalanceBot,
  }
}

/** Apply balance-bot save preset and test-harness save tweaks before GameController.init. */
export async function prepareSaveForDevSession(save, flags) {
  const { hasTestHarness, hasBalanceBot, balanceBotPreset, applyPreset, urlParams } = flags

  if (hasBalanceBot && balanceBotPreset) {
    const { applyBalanceBotSavePreset, VALID_PRESETS } = await import('../dev/balanceBotSavePresets.js')
    if (VALID_PRESETS.includes(balanceBotPreset)) {
      const balanceBotHero = urlParams.get('balanceBotHero') || 'warrior'
      applyBalanceBotSavePreset(save, balanceBotPreset, balanceBotHero)
      return true
    }
  }

  // ?applyPreset=maxed — one-shot save mutation for manual play, no bot started
  if (applyPreset) {
    const { applyBalanceBotSavePreset, VALID_PRESETS } = await import('../dev/balanceBotSavePresets.js')
    if (VALID_PRESETS.includes(applyPreset)) {
      const hero = urlParams.get('hero') || 'warrior'
      applyBalanceBotSavePreset(save, applyPreset, hero)
      return true
    }
  }

  if (hasTestHarness) {
    save.settings = save.settings ?? {}
    save.settings.firstRunIntroDismissed = true
    save.settings.parryChoiceDismissed = true
    save.settings.parryEnabled = false
    save.settings.autoBlockEnabled = true
  }

  return false
}

function _parseJsonParam(urlParams, key) {
  const raw = urlParams.get(key)
  if (!raw) return null
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch (_) {
    return null
  }
}

/** Dynamic-import and start dev autopilot modules after boot wiring completes. */
export async function loadDevToolsAtBootEnd(flags) {
  const { urlParams, hasTestHarness, hasTestBotOngoing, hasBalanceBot, balanceBotPreset } = flags

  if (hasTestHarness) {
    const { attachTestHarness } = await import('../dev/testHarness.js')
    attachTestHarness()
    window.__testHarnessReady = true
    return
  }

  if (hasTestBotOngoing) {
    const policy = urlParams.get('policy') || 'abilities'
    const levelUpWeights = _parseJsonParam(urlParams, 'levelUpWeights') ?? undefined
    const abilityWeights = _parseJsonParam(urlParams, 'abilityWeights') ?? undefined
    const runsQ = urlParams.get('runs')
    const runsParsed = runsQ != null && runsQ !== '' ? parseInt(runsQ, 10) : NaN
    const runs = Number.isFinite(runsParsed) ? runsParsed : undefined
    const { startTestBotOngoing } = await import('../dev/testBotOngoing.js')
    startTestBotOngoing({
      policy,
      runs,
      levelUpWeights,
      abilityWeights,
    })
    return
  }

  if (hasBalanceBot) {
    const policy = urlParams.get('policy') || 'random'
    let levelUpWeights = _parseJsonParam(urlParams, 'levelUpWeights')
    if ((balanceBotPreset === 'end' || balanceBotPreset === 'full' || balanceBotPreset === 'late' || balanceBotPreset === 'maxed' || balanceBotPreset === 'hero') && levelUpWeights == null) {
      levelUpWeights = { vitality: 1000 }
    }
    const abilityWeights = _parseJsonParam(urlParams, 'abilityWeights') ?? undefined
    const { startBalanceBotAutopilot } = await import('../dev/balanceBotAutopilot.js')
    startBalanceBotAutopilot({
      runs: parseInt(urlParams.get('runs') ?? '10', 10) || 1,
      policy,
      preset: balanceBotPreset ?? undefined,
      levelUpWeights: levelUpWeights ?? undefined,
      abilityWeights,
    })
  }
}
