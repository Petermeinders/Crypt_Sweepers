import Logger from '../core/Logger.js'
import { APP_VERSION } from '../appVersion.js'

const UPDATE_POLL_MS = 5 * 60 * 1000

let _registration = null
let _bannerVisible = false

export { APP_VERSION }

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    registerAndWatch()
    checkRemoteVersion()
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pingForUpdates()
      checkRemoteVersion()
    }
  })

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) pingForUpdates()
  })

  setInterval(pingForUpdates, UPDATE_POLL_MS)

  document.getElementById('app-update-reload')?.addEventListener('click', () => {
    activateWaitingWorker()
  })
  document.getElementById('app-update-dismiss')?.addEventListener('click', () => {
    hideUpdateBanner()
  })
}

async function registerAndWatch() {
  try {
    const reg = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`)
    _registration = reg
    Logger.debug('[SW] registered', reg.scope)

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner()
        }
      })
    })

    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner()
    }

    await reg.update()
  } catch (err) {
    Logger.error('[SW] registration failed', err)
  }
}

export async function pingForUpdates() {
  try {
    await (_registration?.update() ?? navigator.serviceWorker.getRegistration().then(r => r?.update()))
  } catch { /* offline */ }
}

async function fetchRemoteVersion() {
  const res = await fetch(`./version.json?_=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const remote = String(data?.version ?? '').trim()
  return remote || null
}

export async function checkRemoteVersion() {
  try {
    const remote = await fetchRemoteVersion()
    if (remote && remote !== APP_VERSION) {
      showUpdateBanner()
      await pingForUpdates()
    }
  } catch { /* offline */ }
}

export async function forceCheckForUpdates() {
  await pingForUpdates()
  const reg = _registration ?? await navigator.serviceWorker.getRegistration()
  _registration = reg ?? _registration

  let remote = null
  try {
    remote = await fetchRemoteVersion()
  } catch { /* offline */ }

  if (remote && remote !== APP_VERSION) {
    showUpdateBanner()
    return { status: 'update-available', current: APP_VERSION, remote }
  }

  if (reg?.waiting && navigator.serviceWorker.controller) {
    showUpdateBanner()
    return { status: 'update-ready', current: APP_VERSION }
  }

  return { status: 'current', current: APP_VERSION }
}

async function clearAppCaches() {
  if (!('caches' in window)) return
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
}

async function activateWaitingWorker() {
  const reg = _registration ?? await navigator.serviceWorker.getRegistration()
  const waiting = reg?.waiting
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' })
    return
  }
  await clearAppCaches()
  window.location.reload()
}

function showUpdateBanner() {
  const el = document.getElementById('app-update-banner')
  if (!el || _bannerVisible) return
  _bannerVisible = true
  el.classList.remove('hidden')
  el.setAttribute('aria-hidden', 'false')
}

function hideUpdateBanner() {
  const el = document.getElementById('app-update-banner')
  if (!el) return
  _bannerVisible = false
  el.classList.add('hidden')
  el.setAttribute('aria-hidden', 'true')
}
