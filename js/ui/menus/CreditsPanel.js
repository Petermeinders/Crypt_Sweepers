import { CREDITS } from '../../data/credits.js'

export function renderCredits() {
  const creatorEl = document.getElementById('credits-creator')
  const listEl    = document.getElementById('credits-testers-list')
  if (creatorEl) creatorEl.textContent = `Created by ${CREDITS.creator}`
  if (listEl) {
    listEl.innerHTML = CREDITS.testers.map(name => `<li>${name}</li>`).join('')
  }
}

export function wireCreditsPanel() {
  document.getElementById('credits-back')?.addEventListener('click', () => {
    const ov = document.getElementById('credits-overlay')
    ov?.classList.add('hidden')
    ov?.setAttribute('aria-hidden', 'true')
  })
}

export function openCredits() {
  renderCredits()
  const ov = document.getElementById('credits-overlay')
  ov?.classList.remove('hidden')
  ov?.setAttribute('aria-hidden', 'false')
}
