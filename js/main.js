import UI              from './ui/UI.js'
import GameController  from './core/GameController.js'
import MetaProgression from './systems/MetaProgression.js'
import SaveManager     from './save/SaveManager.js'
import AudioManager    from './systems/AudioManager.js'
import EventBus        from './core/EventBus.js'
import Logger          from './core/Logger.js'
import { WARRIOR_UPGRADES, SHOP_ITEMS } from './data/upgrades.js'
import { ITEMS }                        from './data/items.js'
import { RANGER_UPGRADES }              from './data/ranger.js'

// ── Boot sequence ─────────────────────────────────────────────

async function boot() {
  Logger.debug('[main] boot start')

  UI.init()

  // Load or create save
  let save = await SaveManager.load()
  if (!save) {
    save = MetaProgression.defaultSave()
    await SaveManager.save(save)
  }
  // Migrate old saves missing keys
  if (save.settings.tileColors === undefined) save.settings.tileColors = false
  if (save.settings.musicOn === undefined)    save.settings.musicOn    = true
  if (save.settings.sfxOn   === undefined)    save.settings.sfxOn      = true
  if (!save.settings.cheats) save.settings.cheats = {}

  // Apply saved visual/audio settings immediately
  if (save.settings.tileColors) document.body.classList.add('tile-colors')
  AudioManager.setMusicEnabled(save.settings.musicOn ?? true)
  AudioManager.setSfxEnabled(save.settings.sfxOn ?? true)

  // Migrate old saves missing ranger key
  if (!save.ranger) {
    save.ranger = { unlocked: false, totalXP: 0, upgrades: [] }
    await SaveManager.save(save)
  }
  if (!save.selectedCharacter) {
    save.selectedCharacter = 'warrior'
  }

  GameController.init(save)

  // ── Audio ────────────────────────────────────────────────
  AudioManager.init()

  // ── In-run buttons ───────────────────────────────────────
  document.getElementById('reset-btn').addEventListener('click', () => GameController.newGame())
  document.getElementById('info-card-overlay').addEventListener('pointerdown', () => UI.hideInfoCard())
  document.getElementById('hud-backpack-btn').addEventListener('click', () => {
    _openBackpack()
  })
  document.getElementById('backpack-close').addEventListener('click', () => {
    document.getElementById('backpack-overlay').classList.add('hidden')
  })
  _wireAbilityHold(
    document.getElementById('hud-btn-slot-a'),
    () => GameController.slamAction(),
    () => UI.showInfoCard({
      emoji:  '💥',
      name:   'Slam',
      type:   'Warrior Ability',
      blurb:  'Bring your weapon down with crushing force. Strikes every revealed enemy on the floor for 1 damage.',
      details: [
        { icon: '🔵', label: 'Mana Cost',  desc: `${WARRIOR_UPGRADES.slam.manaCost} mana per use` },
        { icon: '🌀', label: 'AOE',         desc: 'Hits all revealed enemies simultaneously' },
        { icon: '💥', label: 'Damage',      desc: '1 damage per target' },
      ],
    })
  )
  document.getElementById('retreat-btn').addEventListener('click', () => GameController.doRetreat())

  // ── Menu button click sound ──────────────────────────────
  document.getElementById('main-menu').addEventListener('click', e => {
    if (e.target.closest('button')) EventBus.emit('audio:play', { sfx: 'menu' })
  })

  // ── Main menu buttons ────────────────────────────────────
  document.getElementById('new-run-btn').addEventListener('click', () => GameController.newGame())

  // Character tabs
  document.querySelectorAll('.char-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const s = GameController.getSave()
      if (tab.dataset.char === 'ranger' && !s.ranger.unlocked) return
      s.selectedCharacter = tab.dataset.char
      SaveManager.save(s)
      const xp = tab.dataset.char === 'ranger' ? s.ranger.totalXP : s.warrior.totalXP
      UI.updateMenuStats(s.persistentGold, xp, tab.dataset.char, s)
    })
  })

  // Ranger unlock
  const unlockRangerBtn = document.getElementById('unlock-ranger-btn')
  if (unlockRangerBtn) {
    unlockRangerBtn.addEventListener('click', () => {
      const s = GameController.getSave()
      if (MetaProgression.unlockRanger(s)) {
        SaveManager.save(s)
        UI.updateMenuStats(s.persistentGold, s.warrior.totalXP, s.selectedCharacter, s)
      }
    })
  }

  document.getElementById('settings-btn').addEventListener('click', () => {
    const s = GameController.getSave()
    const c = s.settings.cheats ?? {}
    document.getElementById('setting-music').checked        = s.settings.musicOn    ?? true
    document.getElementById('setting-sfx').checked          = s.settings.sfxOn      ?? true
    document.getElementById('setting-tile-colors').checked  = s.settings.tileColors ?? false
    document.getElementById('cheat-god-mode').checked       = c.godMode      ?? false
    document.getElementById('cheat-instant-kill').checked   = c.instantKill  ?? false
    document.getElementById('cheat-999-gold').checked       = c.gold999      ?? false
    document.getElementById('cheat-999-xp').checked         = c.xp999        ?? false
    document.getElementById('settings-overlay').classList.remove('hidden')
  })
  document.getElementById('settings-back').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('hidden')
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

  const tileColorsCb = document.getElementById('setting-tile-colors')
  tileColorsCb.addEventListener('change', () => {
    const s = GameController.getSave()
    s.settings.tileColors = tileColorsCb.checked
    document.body.classList.toggle('tile-colors', tileColorsCb.checked)
    SaveManager.save(s)
  })

  // Cheat toggles
  const _cheatMap = [
    { id: 'cheat-god-mode',     key: 'godMode'     },
    { id: 'cheat-instant-kill', key: 'instantKill' },
    { id: 'cheat-999-gold',     key: 'gold999'     },
    { id: 'cheat-999-xp',       key: 'xp999'       },
  ]
  _cheatMap.forEach(({ id, key }) => {
    document.getElementById(id).addEventListener('change', e => {
      GameController.applyCheat(key, e.target.checked)
      SaveManager.save(GameController.getSave())
    })
  })

  // Cheat accordion toggle
  document.getElementById('cheat-accordion-toggle').addEventListener('click', () => {
    document.getElementById('cheat-accordion').classList.toggle('open')
  })

  // Delete save
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

  document.getElementById('warrior-tree-btn').addEventListener('click', _openTree)
  document.getElementById('warrior-tree-back').addEventListener('click', () => UI.hideWarriorTree())

  document.getElementById('gold-shop-btn').addEventListener('click', _openShop)
  document.getElementById('gold-shop-back').addEventListener('click', () => UI.hideGoldShop())

  // Difficulty
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = GameController.getSave()
      s.settings.difficulty = btn.dataset.diff
      SaveManager.save(s)
      UI.setActiveDifficulty(btn.dataset.diff)
    })
  })

  // Export / Import
  document.getElementById('export-save-btn').addEventListener('click', () => {
    SaveManager.exportJSON(GameController.getSave())
  })
  document.getElementById('import-save-btn').addEventListener('click', () => {
    document.getElementById('import-file-input').click()
  })
  document.getElementById('import-file-input').addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const imported = await SaveManager.importJSON(text)
    if (imported) {
      GameController.init(imported)
      const xp = imported.selectedCharacter === 'ranger'
        ? imported.ranger.totalXP
        : imported.warrior.totalXP
      UI.updateMenuStats(imported.persistentGold, xp, imported.selectedCharacter, imported)
      UI.setActiveDifficulty(imported.settings.difficulty)
    }
    e.target.value = ''
  })

  // PWA install nudge
  _wireInstallNudge()

  // ── Show main menu ───────────────────────────────────────
  const char = save.selectedCharacter ?? 'warrior'
  const xp   = char === 'ranger' ? save.ranger.totalXP : save.warrior.totalXP
  UI.updateMenuStats(save.persistentGold, xp, char, save)
  UI.setActiveDifficulty(save.settings.difficulty)
  UI.showMainMenu()
  // Music starts on first user interaction (AudioManager unlocks AudioContext on click/touch)
  EventBus.emit('audio:music', { track: 'menu' })

  Logger.debug('[main] boot complete')
}

// ── Skill tree panel ──────────────────────────────────────────

function _openTree() {
  const s       = GameController.getSave()
  const char    = s.selectedCharacter ?? 'warrior'
  const upgrades = char === 'ranger' ? RANGER_UPGRADES : WARRIOR_UPGRADES
  const buyFn   = char === 'ranger'
    ? (id) => MetaProgression.buyRangerUpgrade(s, id)
    : (id) => MetaProgression.buyUpgrade(s, id)

  UI.showWarriorTree(s, upgrades, (id) => {
    if (buyFn(id)) {
      SaveManager.save(s)
      UI.hideWarriorTree()
      _openTree()
    }
  }, char)
}

// ── Gold shop panel ───────────────────────────────────────────

function _openShop() {
  const s = GameController.getSave()
  UI.showGoldShop(
    s,
    SHOP_ITEMS,
    (id) => { MetaProgression.buyShopItem(s, id); SaveManager.save(s); _openShop() },
    (id) => { MetaProgression.removeShopItem(s, id); SaveManager.save(s); _openShop() },
  )
}

// ── Backpack panel ───────────────────────────────────────────

function _renderBackpack() {
  UI.renderBackpack(
    GameController.getInventory(),
    ITEMS,
    (id) => { GameController.useItem(id); _renderBackpack() },
    (id) => { const item = ITEMS[id]; if (item) UI.showInfoCard({ ...item }) },
  )
}

function _openBackpack() {
  _renderBackpack()
  document.getElementById('backpack-overlay').classList.remove('hidden')
}

// ── Ability button hold-to-inspect ───────────────────────────
// onTap fires on a normal click; onHold fires after 380ms hold.

function _wireAbilityHold(btn, onTap, onHold) {
  let _timer   = null
  let _didHold = false
  let _startX  = 0
  let _startY  = 0

  btn.addEventListener('pointerdown', e => {
    _didHold = false
    _startX  = e.clientX
    _startY  = e.clientY
    _timer = setTimeout(() => {
      _didHold = true
      onHold()
    }, 380)
  })

  btn.addEventListener('pointermove', e => {
    if (!_timer) return
    const dx = e.clientX - _startX
    const dy = e.clientY - _startY
    if (Math.hypot(dx, dy) > 8) { clearTimeout(_timer); _timer = null }
  })

  const _cancel = () => { clearTimeout(_timer); _timer = null }
  btn.addEventListener('pointerup',     _cancel)
  btn.addEventListener('pointercancel', _cancel)
  btn.addEventListener('contextmenu', e => e.preventDefault())

  btn.addEventListener('click', () => { if (!_didHold) onTap() })
}

// ── PWA install nudge ─────────────────────────────────────────

let _deferredInstallPrompt = null

function _wireInstallNudge() {
  const nudge      = document.getElementById('install-nudge')
  const installBtn = document.getElementById('install-btn')

  // Already installed as standalone — hide nudge entirely
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  if (isIOS) {
    // iOS Safari never fires beforeinstallprompt — show manual instructions
    if (nudge) nudge.classList.remove('hidden')
    if (installBtn) {
      installBtn.textContent = '📲 Add to Home Screen'
      installBtn.addEventListener('click', () => {
        document.getElementById('ios-install-tip').classList.toggle('hidden')
      })
    }
    return
  }

  // Android Chrome / desktop — use the native prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    _deferredInstallPrompt = e
    if (nudge) nudge.classList.remove('hidden')
  })

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return
      _deferredInstallPrompt.prompt()
      const { outcome } = await _deferredInstallPrompt.userChoice
      Logger.debug(`[main] PWA install: ${outcome}`)
      _deferredInstallPrompt = null
      if (nudge) nudge.classList.add('hidden')
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}

// ── Service worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => Logger.debug('[SW] registered', reg.scope))
      .catch(err => Logger.error('[SW] registration failed', err))
  })
}
