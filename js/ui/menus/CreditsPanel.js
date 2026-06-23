import { CREDITS } from '../../data/credits.js'
import { applyDevOptionsVisibility } from './SettingsPanel.js'

const DEV_UNLOCK_MSG = 'Debug and Cheats have been enabled in Settings.'

function _showDevUnlockMessage() {
  const msgEl = document.getElementById('credits-dev-unlock-msg')
  if (!msgEl) return
  msgEl.textContent = DEV_UNLOCK_MSG
  msgEl.classList.remove('hidden')
}

function _tryUnlockDevOptions(ctx) {
  const { GameController, SaveManager } = ctx
  const save = GameController.getSave()
  if (save.settings?.devOptionsUnlocked) {
    _showDevUnlockMessage()
    return
  }
  save.settings.devOptionsUnlocked = true
  SaveManager.save(save)
  applyDevOptionsVisibility(true)
  _showDevUnlockMessage()
}

export function renderCredits() {
  const creatorEl = document.getElementById('credits-creator')
  const listEl    = document.getElementById('credits-testers-list')
  const msgEl     = document.getElementById('credits-dev-unlock-msg')
  if (creatorEl) creatorEl.textContent = `Created by ${CREDITS.creator}`
  if (listEl) {
    listEl.innerHTML = CREDITS.testers.map(name => `<li>${name}</li>`).join('')
  }
  msgEl?.classList.add('hidden')
  if (msgEl) msgEl.textContent = ''
}

export function wireCreditsPanel(ctx) {
  document.getElementById('credits-back')?.addEventListener('click', () => {
    const ov = document.getElementById('credits-overlay')
    ov?.classList.add('hidden')
    ov?.setAttribute('aria-hidden', 'true')
  })

  const creatorEl = document.getElementById('credits-creator')
  creatorEl?.addEventListener('click', () => _tryUnlockDevOptions(ctx))
  creatorEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      _tryUnlockDevOptions(ctx)
    }
  })
}

export function openCredits() {
  renderCredits()
  const ov = document.getElementById('credits-overlay')
  ov?.classList.remove('hidden')
  ov?.setAttribute('aria-hidden', 'false')
}
