import { renderChangelogEntries } from '../ui/menus/Changelog.js'
import { wireGoldShopPanel } from '../ui/menus/GoldShopPanel.js'
import { wireBlacksmithPanel } from '../ui/menus/BlacksmithPanel.js'
import { wireHeroSelect, openHeroSelect, updateMenuHeroPreview } from '../ui/menus/HeroSelect.js'
import { wireSettingsPanel } from '../ui/menus/SettingsPanel.js'
import { applyImportedSave } from '../ui/menus/saveTransfer.js'
import Logger from '../core/Logger.js'
import { FORGE_RECIPES } from '../data/combinations.js'
import { ITEMS } from '../data/items.js'

let deferredInstallPrompt = null

function wireInstallNudge() {
  const nudge      = document.getElementById('install-nudge')
  const installBtn = document.getElementById('install-btn')

  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  if (isIOS) {
    if (nudge) nudge.classList.remove('hidden')
    if (installBtn) {
      installBtn.textContent = '📲 Add to Home Screen'
      installBtn.addEventListener('click', () => {
        document.getElementById('ios-install-tip').classList.toggle('hidden')
      })
    }
    return
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredInstallPrompt = e
    if (nudge) nudge.classList.remove('hidden')
  })

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return
      deferredInstallPrompt.prompt()
      const { outcome } = await deferredInstallPrompt.userChoice
      Logger.debug(`[main] PWA install: ${outcome}`)
      deferredInstallPrompt = null
      if (nudge) nudge.classList.add('hidden')
    })
  }
}

function _populateForgeRecipeList() {
  const container = document.getElementById('htp-forge-recipe-list')
  if (!container || container.dataset.populated) return
  container.dataset.populated = '1'
  container.innerHTML = FORGE_RECIPES.map(r => {
    const nameA = ITEMS[r.ingredientA]?.name ?? r.ingredientA
    const nameB = ITEMS[r.ingredientB]?.name ?? r.ingredientB
    const resultName = ITEMS[r.result]?.name ?? r.result
    const isDupe = r.ingredientA === r.ingredientB
    const ingredients = isDupe ? `${nameA} ×2` : `${nameA} + ${nameB}`
    return `
      <div class="htp-forge-row">
        <div class="htp-forge-ingredients">${ingredients}</div>
        <div class="htp-forge-arrow">→</div>
        <div class="htp-forge-result"><strong>${resultName}</strong></div>
        <div class="htp-forge-hint">${r.hint}</div>
      </div>`
  }).join('')
}

/** Main menu, pause overlays, export/import, PWA nudge, boot finale. */
export function wireMenus(ctx) {
  const { GameController, SaveManager, MetaProgression, UI, EventBus } = ctx

  wireGoldShopPanel(ctx)
  wireBlacksmithPanel(ctx)
  wireHeroSelect(ctx)
  wireSettingsPanel(ctx)

  // ── UI button click sound (same as New Run) — panels, back, retreat, Heroes, etc. ──
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (!btn || btn.disabled) return
    if (btn.closest('.hud-actions')) return
    if (btn.classList.contains('card-btn-drop')) return
    const id = btn.id
    if (id === 'retreat-confirm-yes') return
    if (id === 'merchant-roll-btn') return
    if (id === 'rope-modal-confirm') return
    ctx.EventBus.emit('audio:play', { sfx: 'menu' })
  })

  document.getElementById('new-run-btn').addEventListener('click', () => ctx.GameController.newGame())

  document.getElementById('void-btn')?.addEventListener('click', () => {
    const save = ctx.GameController.getSave()
    if (!save?.meta?.gameCompleted) return
    ctx.UI.showVoidStubModal()
  })
  document.getElementById('void-stub-ok')?.addEventListener('click', () => ctx.UI.hideVoidStubModal())
  document.getElementById('void-stub-backdrop')?.addEventListener('click', () => ctx.UI.hideVoidStubModal())

  const _openHowToPlay = () => {
    _populateForgeRecipeList()
    document.getElementById('how-to-play-overlay')?.classList.remove('hidden')
  }
  document.getElementById('how-to-play-btn')?.addEventListener('click', _openHowToPlay)
  document.getElementById('hud-how-to-play-btn')?.addEventListener('click', _openHowToPlay)
  document.getElementById('how-to-play-back')?.addEventListener('click', () => {
    document.getElementById('how-to-play-overlay')?.classList.add('hidden')
  })
  document.getElementById('htp-practice-parry-btn')?.addEventListener('click', () => {
    const heroId = (ctx.GameController.getSave()?.selectedCharacter) ?? 'warrior'
    ctx.UI.showParryWindow({ dmg: [1, 1], label: 'Dummy', enemyId: null }, () => {}, heroId, { practiceMode: true, practiceHint: '⚡ PRACTICE — Tap or swipe to block / counter' })
  })

  document.getElementById('latest-updates-btn')?.addEventListener('click', () => {
    renderChangelogEntries()
    const ov = document.getElementById('latest-updates-overlay')
    ov?.classList.remove('hidden')
    ov?.setAttribute('aria-hidden', 'false')
  })
  document.getElementById('latest-updates-back')?.addEventListener('click', () => {
    const ov = document.getElementById('latest-updates-overlay')
    ov?.classList.add('hidden')
    ov?.setAttribute('aria-hidden', 'true')
  })

  document.getElementById('bestiary-btn')?.addEventListener('click', () => {
    ctx.UI.showBestiaryPanel(ctx.GameController.getSave())
  })
  document.getElementById('bestiary-back')?.addEventListener('click', () => ctx.UI.hideBestiaryPanel())
  document.getElementById('trinket-codex-btn')?.addEventListener('click', () => {
    ctx.UI.showTrinketCodexPanel(ctx.GameController.getSave())
  })
  document.getElementById('trinket-codex-back')?.addEventListener('click', () => ctx.UI.hideTrinketCodexPanel())
  document.getElementById('trinket-detail-back')?.addEventListener('click', () => ctx.UI.hideTrinketDetail())

  // Difficulty
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = ctx.GameController.getSave()
      s.settings.difficulty = btn.dataset.diff
      ctx.SaveManager.save(s)
      ctx.UI.setActiveDifficulty(btn.dataset.diff)
    })
  })

  // Export / Import
  document.getElementById('export-save-btn').addEventListener('click', () => {
    ctx.SaveManager.exportJSON(ctx.GameController.getSave())
  })
  document.getElementById('import-save-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click()
  })
  document.getElementById('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    let result
    try {
      result = await ctx.SaveManager.importJSON(text)
    } catch (err) {
      Logger.error('[Import] Save import failed', err)
      ctx.UI.setMessage('Import failed — could not read that save file.', true)
      e.target.value = ''
      return
    }
    const outcome = await applyImportedSave(ctx, result)
    if (outcome.ok && !outcome.resumed) updateMenuHeroPreview(ctx)
    e.target.value = ''
  })
}

/** Post-wiring menu state: hero preview, difficulty, music, resume vs main menu. */
export function finishBootMenu(ctx, save, devFlags) {
  const { GameController, UI, EventBus } = ctx
  const { hasBalanceBot, hasTestBotOngoing, hasTestHarness, isHeadlessBotSession } = devFlags

  updateMenuHeroPreview(ctx)
  UI.updateVoidMenu(save)
  UI.setActiveDifficulty(save.settings.difficulty)
  EventBus.emit('audio:music', { track: 'menu' })
  if (GameController.hasActiveRun()) {
    if (hasBalanceBot || hasTestBotOngoing || hasTestHarness) {
      GameController.abandonRun()
      UI.showMainMenu()
    } else {
      GameController.resumeRun()
    }
  } else {
    UI.showMainMenu()
  }

  if (!isHeadlessBotSession) {
    wireInstallNudge()
  }
}
