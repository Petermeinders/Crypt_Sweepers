// BackpackTabs — horizontal swipe carousel for Materials / Backpack / Transmutation.

const BACKPACK_TAB_IDS = ['tab-materials', 'tab-backpack', 'tab-tran']

let _backpackTabIdx = 1
let _backpackScrollSkip = false
let _onTabActivated = null

export function setBackpackTabHandlers(handlers = {}) {
  _onTabActivated = handlers.onTabActivated ?? null
}

export function getBackpackTabIndex() {
  return _backpackTabIdx
}

export function activateBackpackTab(tabId, opts = {}) {
  const idx = BACKPACK_TAB_IDS.indexOf(tabId)
  if (idx < 0) return
  _backpackTabIdx = idx
  _syncBackpackTabUi(opts)
}

export function resetBackpackTabOnOpen() {
  _backpackTabIdx = 1
  activateBackpackTab('tab-backpack', { scrollBehavior: 'instant' })
  const scroll = document.getElementById('backpack-panels-scroll')
  if (scroll?.clientWidth <= 0) {
    requestAnimationFrame(() => activateBackpackTab('tab-backpack', { scrollBehavior: 'instant' }))
  }
}

function _syncBackpackTabUi(opts = {}) {
  const skipScrollSync = opts.skipScrollSync === true
  const scrollBehavior = opts.scrollBehavior ?? 'smooth'

  for (let i = 0; i < BACKPACK_TAB_IDS.length; i++) {
    const tab = document.getElementById(BACKPACK_TAB_IDS[i])
    if (!tab) continue
    tab.classList.toggle('active', i === _backpackTabIdx)
    tab.setAttribute('aria-selected', i === _backpackTabIdx ? 'true' : 'false')
  }

  const scroll = document.getElementById('backpack-panels-scroll')
  if (!skipScrollSync && scroll && scroll.clientWidth > 0) {
    _backpackScrollSkip = true
    scroll.scrollTo({ left: _backpackTabIdx * scroll.clientWidth, behavior: scrollBehavior })
    const ms = scrollBehavior === 'smooth' ? 520 : 60
    setTimeout(() => { _backpackScrollSkip = false }, ms)
  }

  _onTabActivated?.(_backpackTabIdx)
}

export function wireBackpackPanelsScroll() {
  const scroll = document.getElementById('backpack-panels-scroll')
  if (!scroll || scroll.dataset.backpackScrollWired === '1') return
  scroll.dataset.backpackScrollWired = '1'

  const settle = () => {
    if (_backpackScrollSkip) return
    _onBackpackScrollSettled()
  }
  let debounceTimer = null
  scroll.addEventListener('scroll', () => {
    if (_backpackScrollSkip) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(settle, 200)
  }, { passive: true })
}

function _onBackpackScrollSettled() {
  const scroll = document.getElementById('backpack-panels-scroll')
  if (!scroll) return
  const w = scroll.clientWidth
  if (w <= 0) return
  const idx = Math.round(scroll.scrollLeft / w)
  const clamped = Math.max(0, Math.min(BACKPACK_TAB_IDS.length - 1, idx))
  if (clamped === _backpackTabIdx) return
  _backpackTabIdx = clamped
  _syncBackpackTabUi({ skipScrollSync: true })
}
