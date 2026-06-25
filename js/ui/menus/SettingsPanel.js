/** Settings overlay toggles + cheat switches. */

import Logger from '../../core/Logger.js'
import { applyImportedSave } from './saveTransfer.js'
import { APP_VERSION, forceCheckForUpdates } from '../../boot/serviceWorker.js'

export function applyDevOptionsVisibility(unlocked) {
  document.getElementById('debug-accordion')?.classList.toggle('hidden', !unlocked)
  document.getElementById('cheat-accordion')?.classList.toggle('hidden', !unlocked)
}

function _refreshRunBackupSection(ctx) {
  const section = document.getElementById('run-backup-section')
  const status  = document.getElementById('run-backup-status')
  if (!section) return

  const { GameController } = ctx
  const run = GameController.getRun?.() ?? null
  const inRun = !!run
  const hasCheckpoint = GameController.hasActiveRun()
  const show = inRun || hasCheckpoint

  section.classList.toggle('hidden', !show)
  if (!status) return

  if (inRun) {
    const floor = run.floor ?? '?'
    const place = run.atRest ? 'sanctuary' : 'dungeon'
    status.textContent = `Floor ${floor} (${place}) — export includes your current grid, inventory, and gear. Import the file later to resume this run.`
  } else if (hasCheckpoint) {
    const info = GameController.getActiveRunInfo?.()
    const floor = info?.floor ?? '?'
    status.textContent = `Saved checkpoint (floor ${floor}) — export to back up, or import to restore after a reload.`
  }
}

function _populateSettingsForm(s) {
  const c = s.settings.cheats ?? {}
  document.getElementById('setting-music').checked        = s.settings.musicOn    ?? true
  document.getElementById('setting-sfx').checked          = s.settings.sfxOn      ?? true
  document.getElementById('setting-haptic').checked       = s.settings.hapticFeedback ?? true
  document.getElementById('setting-sub-levels').checked   = s.settings.subLevelsEnabled ?? true
  document.getElementById('setting-auto-potions').checked = s.settings.autoPotions ?? false
  document.getElementById('setting-parry').checked         = s.settings.parryEnabled ?? true
  document.getElementById('setting-auto-block').checked    = s.settings.autoBlockEnabled ?? true
  document.getElementById('setting-child-mode').checked   = s.settings.childMode    ?? false
  document.getElementById('cheat-reveal-all-tiles').checked = c.revealAllTiles ?? false
  document.getElementById('cheat-god-mode').checked       = c.godMode      ?? false
  document.getElementById('cheat-instant-kill').checked   = c.instantKill  ?? false
  document.getElementById('cheat-999-gold').checked       = c.gold999      ?? false
  document.getElementById('cheat-999-xp').checked         = c.xp999        ?? false
  document.getElementById('cheat-skip-floor-btn').checked = c.skipFloorButton ?? false
  document.getElementById('cheat-generate-gear-btn').checked = c.generateGearButton ?? false
  document.getElementById('cheat-grant-gem-btn').checked = c.grantGemButton ?? false
  document.getElementById('cheat-increase-stats').checked = c.increaseStats ?? false
}

function _openSettingsOverlay(ctx) {
  const save = ctx.GameController.getSave()
  _populateSettingsForm(save)
  applyDevOptionsVisibility(!!save.settings?.devOptionsUnlocked)
  _refreshRunBackupSection(ctx)
  const versionEl = document.getElementById('settings-cache-version')
  if (versionEl) versionEl.textContent = `v${APP_VERSION}`
  document.getElementById('settings-update-status').textContent = 'Check for the latest fixes and balance changes.'
  document.getElementById('settings-overlay').classList.remove('hidden')
}

export function wireSettingsPanel(ctx) {
  const { GameController, SaveManager, AudioManager } = ctx

  applyDevOptionsVisibility(!!GameController.getSave()?.settings?.devOptionsUnlocked)

  document.getElementById('hud-settings-btn').addEventListener('click', () => _openSettingsOverlay(ctx))
  document.getElementById('settings-btn').addEventListener('click', () => _openSettingsOverlay(ctx))
  document.getElementById('settings-back').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('hidden')
  })

  document.getElementById('settings-check-updates-btn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('settings-update-status')
    if (statusEl) statusEl.textContent = 'Checking…'
    const result = await forceCheckForUpdates()
    if (!statusEl) return
    if (result.status === 'current') {
      statusEl.textContent = `You’re on the latest version (v${result.current}).`
    } else if (result.status === 'update-ready') {
      statusEl.textContent = 'Update downloaded — tap “Update now” on the banner, or reload the page.'
    } else {
      statusEl.textContent = `Update available (v${result.remote}). Use the banner or reload when you can.`
    }
  })

  document.getElementById('setting-music').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.musicOn = e.target.checked
    AudioManager.setMusicEnabled(e.target.checked)
    SaveManager.save(s)
  })
  document.getElementById('setting-sfx').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.sfxOn = e.target.checked
    AudioManager.setSfxEnabled(e.target.checked)
    SaveManager.save(s)
  })

  document.getElementById('setting-haptic').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.hapticFeedback = e.target.checked
    SaveManager.save(s)
    if (e.target.checked && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(22) } catch (_) { /* Firefox / privacy mode may block */ }
    }
  })

  document.getElementById('setting-sub-levels').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.subLevelsEnabled = e.target.checked
    SaveManager.save(s)
  })

  document.getElementById('setting-auto-potions').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.autoPotions = e.target.checked
    SaveManager.save(s)
  })

  document.getElementById('setting-parry').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.parryEnabled = e.target.checked
    SaveManager.save(s)
  })

  document.getElementById('setting-auto-block').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.autoBlockEnabled = e.target.checked
    SaveManager.save(s)
  })

  document.getElementById('setting-child-mode').addEventListener('change', e => {
    const s = GameController.getSave()
    s.settings.childMode = e.target.checked
    SaveManager.save(s)
    GameController.refreshChildModeSprites()
  })

  const _cheatMap = [
    { id: 'cheat-reveal-all-tiles', key: 'revealAllTiles' },
    { id: 'cheat-god-mode',     key: 'godMode'     },
    { id: 'cheat-instant-kill', key: 'instantKill' },
    { id: 'cheat-999-gold',     key: 'gold999'     },
    { id: 'cheat-999-xp',       key: 'xp999'       },
    { id: 'cheat-skip-floor-btn', key: 'skipFloorButton' },
    { id: 'cheat-generate-gear-btn', key: 'generateGearButton' },
    { id: 'cheat-grant-gem-btn', key: 'grantGemButton' },
    { id: 'cheat-increase-stats', key: 'increaseStats' },
  ]
  _cheatMap.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', e => {
      GameController.applyCheat(key, e.target.checked)
      SaveManager.save(GameController.getSave())
    })
  })

  document.getElementById('cheat-add-void-pearl-btn')?.addEventListener('click', () => {
    GameController.cheatAddVoidPearl()
  })

  document.getElementById('debug-accordion-toggle').addEventListener('click', () => {
    document.getElementById('debug-accordion').classList.toggle('open')
  })

  document.getElementById('cheat-accordion-toggle').addEventListener('click', () => {
    document.getElementById('cheat-accordion').classList.toggle('open')
  })

  document.getElementById('delete-save-btn').addEventListener('click', () => {
    document.getElementById('delete-save-confirm').classList.remove('hidden')
    document.getElementById('delete-save-btn').classList.add('hidden')
  })
  document.getElementById('delete-save-no').addEventListener('click', () => {
    document.getElementById('delete-save-confirm').classList.add('hidden')
    document.getElementById('delete-save-btn').classList.remove('hidden')
  })
  document.getElementById('delete-save-yes').addEventListener('click', async () => {
    await SaveManager.clear()
    location.reload()
  })

  document.getElementById('settings-export-run-btn')?.addEventListener('click', () => {
    if (GameController.getRun?.()) GameController.persistActiveRun()
    else if (GameController.hasActiveRun()) { /* checkpoint already in save */ }
    SaveManager.exportJSON(GameController.getSave())
    ctx.UI.setMessage('Run backup exported — keep the JSON file safe to resume later.')
    document.getElementById('settings-overlay').classList.add('hidden')
  })

  document.getElementById('settings-import-run-btn')?.addEventListener('click', () => {
    document.getElementById('settings-import-file-input').click()
  })

  document.getElementById('settings-import-file-input')?.addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    let result
    try {
      result = await SaveManager.importJSON(text)
    } catch (err) {
      Logger.error('[Import] Settings run import failed', err)
      ctx.UI.setMessage('Import failed — could not read that save file.', true)
      e.target.value = ''
      return
    }
    await applyImportedSave(ctx, result, { resumeIfPossible: true })
    document.getElementById('settings-overlay').classList.add('hidden')
    e.target.value = ''
  })
}
