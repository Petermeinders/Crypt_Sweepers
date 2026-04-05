import UI              from './ui/UI.js'
import GameController  from './core/GameController.js'
import MetaProgression from './systems/MetaProgression.js'
import SaveManager     from './save/SaveManager.js'
import AudioManager    from './systems/AudioManager.js'
import EventBus        from './core/EventBus.js'
import Logger          from './core/Logger.js'
import { CONFIG }                           from './config.js'
import { WARRIOR_UPGRADES, SHOP_ITEMS }     from './data/upgrades.js'
import { ITEMS }                            from './data/items.js'
import { RANGER_UPGRADES }                  from './data/ranger.js'

// ── Character roster ──────────────────────────────────────────

const CHARACTERS = [
  {
    id:         'warrior',
    name:       'Warrior',
    tagline:    'Battle-hardened fighter. Slow but hits hard.',
    gif:        'assets/sprites/Heroes/Warrior/__Idle.gif',
    attackGif:  'assets/sprites/Heroes/Warrior/__AttackCombo2hit.gif',
    attackMs:   1100,
    emoji:      null,
    upgrades:   WARRIOR_UPGRADES,
    unlockCost: null,
    baseHP:     40,
    baseMana:   30,
    baseDmg:    '1',
  },
  {
    id:         'ranger',
    name:       'Ranger',
    tagline:    "Swift and elusive. Enemy reveals don't lock adjacent tiles.",
    gif:        'assets/sprites/Heroes/Ranger/__Idle.gif',
    attackGif:  'assets/sprites/Heroes/Ranger/__Attack.gif',
    attackMs:   4000,
    emoji:      null,
    upgrades:   RANGER_UPGRADES,
    unlockCost: CONFIG.rangerUnlockCost,
    baseHP:     80,
    baseMana:   80,
    baseDmg:    '1',
  },
]

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
      spriteSrc: WARRIOR_UPGRADES.slam.iconSrc,
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
  _wireAbilityHold(
    document.getElementById('hud-btn-slot-b'),
    () => GameController.blindingLightAction(),
    () => UI.showInfoCard({
      spriteSrc: WARRIOR_UPGRADES['blinding-light'].iconSrc,
      name:   'Blinding Light',
      type:   'Warrior Ability',
      blurb:  'A flash of searing light stuns an enemy for 2 turns. They take damage but cannot counter-attack while stunned.',
      details: [
        { icon: '🔵', label: 'Mana Cost', desc: `${WARRIOR_UPGRADES['blinding-light'].manaCost} mana per use` },
        { icon: '🎯', label: 'Targeting', desc: 'Tap an enemy to stun it' },
        { icon: '⏱️', label: 'Duration',  desc: '2 turns: enemy attacks are suppressed' },
      ],
    })
  )
  document.getElementById('retreat-btn').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.remove('hidden')
  })
  document.getElementById('retreat-confirm-yes').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
    GameController.doRetreat()
  })
  document.getElementById('retreat-confirm-no').addEventListener('click', () => {
    document.getElementById('retreat-confirm').classList.add('hidden')
  })

  // ── Menu button click sound ──────────────────────────────
  document.getElementById('main-menu').addEventListener('click', e => {
    if (e.target.closest('button')) EventBus.emit('audio:play', { sfx: 'menu' })
  })

  // ── Main menu buttons ────────────────────────────────────
  document.getElementById('new-run-btn').addEventListener('click', () => GameController.newGame())

  // Hero select
  document.getElementById('hero-select-open-btn').addEventListener('click', _openHeroSelect)
  document.getElementById('hero-select-back').addEventListener('click', () => {
    document.getElementById('hero-select-overlay').classList.add('hidden')
    _updateMenuHeroPreview()
  })
  document.getElementById('hero-prev').addEventListener('click', () => {
    _heroIdx = Math.max(0, _heroIdx - 1)
    _selectedUpgradeId = null
    _renderHeroSelect()
  })
  document.getElementById('hero-next').addEventListener('click', () => {
    _heroIdx = Math.min(CHARACTERS.length - 1, _heroIdx + 1)
    _selectedUpgradeId = null
    _renderHeroSelect()
  })
  document.getElementById('hero-select-btn').addEventListener('click', () => {
    const s    = GameController.getSave()
    const char = CHARACTERS[_heroIdx]
    const btn  = document.getElementById('hero-select-btn')
    if (btn.dataset.mode === 'unlock') {
      if (char.id === 'ranger' && MetaProgression.unlockRanger(s)) {
        SaveManager.save(s)
        _renderHeroSelect()
      }
    } else {
      s.selectedCharacter = char.id
      SaveManager.save(s)
      _renderHeroSelect()
    }
  })
  // Dismiss upgrade detail on backdrop click
  document.getElementById('hero-upgrade-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('hero-upgrade-backdrop')) {
      _selectedUpgradeId = null
      document.getElementById('hero-upgrade-backdrop').classList.add('hidden')
      const s        = GameController.getSave()
      const char     = CHARACTERS[_heroIdx]
      const charSave = char.id === 'ranger' ? s.ranger : s.warrior
      _renderHeroUpgradeGrid(char, charSave.upgrades ?? [], charSave.totalXP ?? 0, char.id === 'ranger' && !s.ranger.unlocked)
    }
  })

  // Tap hero to play attack animation
  document.getElementById('hero-display-gif').addEventListener('click', () => {
    const char = CHARACTERS[_heroIdx]
    if (!char.attackGif || _heroAttackTimer) return
    const gifEl = document.getElementById('hero-display-gif')
    gifEl.src = char.attackGif + '?t=' + Date.now()
    _heroAttackTimer = setTimeout(() => {
      _heroAttackTimer = null
      if (CHARACTERS[_heroIdx] === char && char.gif) {
        gifEl.src = char.gif + '?t=' + Date.now()
      }
    }, char.attackMs ?? 4000)
  })


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
      _updateMenuHeroPreview()
      UI.setActiveDifficulty(imported.settings.difficulty)
    }
    e.target.value = ''
  })

  // PWA install nudge
  _wireInstallNudge()

  // ── Show main menu ───────────────────────────────────────
  _updateMenuHeroPreview()
  UI.setActiveDifficulty(save.settings.difficulty)
  UI.showMainMenu()
  EventBus.emit('audio:music', { track: 'menu' })

  Logger.debug('[main] boot complete')
}

// ── Hero Select ───────────────────────────────────────────────

let _heroIdx           = 0
let _selectedUpgradeId = null
let _heroAttackTimer   = null

function _openHeroSelect() {
  const s = GameController.getSave()
  _heroIdx = CHARACTERS.findIndex(c => c.id === (s.selectedCharacter ?? 'warrior'))
  if (_heroIdx < 0) _heroIdx = 0
  _selectedUpgradeId = null
  _renderHeroSelect()
  document.getElementById('hero-select-overlay').classList.remove('hidden')
}

function _renderHeroSelect() {
  const s        = GameController.getSave()
  const char     = CHARACTERS[_heroIdx]
  const charSave = char.id === 'ranger' ? s.ranger : s.warrior
  const isLocked = char.id === 'ranger' && !s.ranger.unlocked
  const xp       = charSave.totalXP ?? 0
  const owned    = charSave.upgrades ?? []

  // Header gold
  document.getElementById('hero-select-gold-val').textContent = s.persistentGold

  // Name / tagline / XP
  document.getElementById('hero-select-name').textContent    = char.name
  document.getElementById('hero-select-tagline').textContent = char.tagline
  document.getElementById('hero-select-xp').textContent      = xp

  // Hero GIF or emoji — don't interrupt an in-progress attack animation
  const gifEl   = document.getElementById('hero-display-gif')
  const emojiEl = document.getElementById('hero-display-emoji')
  if (char.gif) {
    if (!_heroAttackTimer) gifEl.src = char.gif + '?t=' + Date.now()
    gifEl.style.display   = 'block'
    emojiEl.style.display = 'none'
  } else {
    gifEl.style.display   = 'none'
    gifEl.src             = ''
    emojiEl.textContent   = char.emoji
    emojiEl.style.display = 'block'
  }

  // Lock overlay
  const lockOverlay = document.getElementById('hero-locked-overlay')
  lockOverlay.classList.toggle('hidden', !isLocked)

  // Nav arrows
  document.getElementById('hero-prev').classList.toggle('hidden', _heroIdx === 0)
  document.getElementById('hero-next').classList.toggle('hidden', _heroIdx === CHARACTERS.length - 1)

  // Upgrade grid
  _renderHeroUpgradeGrid(char, owned, xp, isLocked)

  // Base stats
  document.getElementById('hero-stat-hp').textContent   = char.baseHP
  document.getElementById('hero-stat-mana').textContent = char.baseMana
  document.getElementById('hero-stat-dmg').textContent  = char.baseDmg

  // Select / Unlock button
  const isSelected = s.selectedCharacter === char.id
  const selectBtn  = document.getElementById('hero-select-btn')
  if (isLocked) {
    selectBtn.textContent = `🔓 Unlock (${char.unlockCost}💰)`
    selectBtn.disabled    = s.persistentGold < char.unlockCost
    selectBtn.dataset.mode = 'unlock'
  } else {
    selectBtn.textContent = isSelected ? '✓ Selected' : 'Select Hero'
    selectBtn.disabled    = isSelected
    selectBtn.dataset.mode = 'select'
  }
}

function _renderHeroUpgradeGrid(char, ownedList, xp, isLocked) {
  const grid = document.getElementById('hero-upgrades-grid')
  grid.innerHTML = ''

  for (const [id, def] of Object.entries(char.upgrades)) {
    const isOwned    = ownedList.includes(id)
    const canAfford  = !isOwned && xp >= def.xpCost && !isLocked
    const isSelected = id === _selectedUpgradeId

    const btn = document.createElement('button')
    btn.className = 'hero-upgrade-slot'
      + (isOwned    ? ' owned'    : '')
      + (isSelected ? ' selected' : '')
    const iconHTML = def.iconSrc
      ? `<img class="hero-upgrade-icon-img" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>`
      : `<span class="hero-upgrade-icon">${def.icon}</span>`
    btn.innerHTML = `
      ${iconHTML}
      <span class="hero-upgrade-cost">${isOwned ? '✓' : def.xpCost + ' XP'}</span>
    `
    btn.addEventListener('click', () => {
      _selectedUpgradeId = isSelected ? null : id
      const s        = GameController.getSave()
      const charSave = char.id === 'ranger' ? s.ranger : s.warrior
      const locked   = char.id === 'ranger' && !s.ranger.unlocked
      _renderHeroUpgradeGrid(char, charSave.upgrades ?? [], charSave.totalXP ?? 0, locked)
      _renderUpgradeDetail(id, def, isOwned, canAfford)
    })
    grid.appendChild(btn)
  }

  // If nothing selected, hide detail panel
  if (!_selectedUpgradeId) _renderUpgradeDetail(null)
}

function _renderUpgradeDetail(id, def, isOwned, canAfford) {
  const backdrop = document.getElementById('hero-upgrade-backdrop')
  if (!id || !def) { backdrop.classList.add('hidden'); return }
  backdrop.classList.remove('hidden')
  document.getElementById('hero-upgrade-detail-name').textContent = def.name
  document.getElementById('hero-upgrade-detail-desc').textContent = def.desc

  const buyBtn = document.getElementById('hero-upgrade-buy-btn')
  if (isOwned) {
    buyBtn.textContent = '✓ Owned'
    buyBtn.disabled    = true
    buyBtn.onclick     = null
  } else {
    buyBtn.textContent = `Unlock — ${def.xpCost} XP`
    buyBtn.disabled    = !canAfford
    buyBtn.onclick     = () => {
      const s      = GameController.getSave()
      const char   = CHARACTERS[_heroIdx]
      const bought = char.id === 'ranger'
        ? MetaProgression.buyRangerUpgrade(s, id)
        : MetaProgression.buyUpgrade(s, id)
      if (bought) {
        SaveManager.save(s)
        _selectedUpgradeId = null
        _renderHeroSelect()
      }
    }
  }
}

function _updateMenuHeroPreview() {
  const s    = GameController.getSave()
  const char = CHARACTERS.find(c => c.id === (s.selectedCharacter ?? 'warrior')) ?? CHARACTERS[0]
  const xp   = s.selectedCharacter === 'ranger' ? s.ranger.totalXP : s.warrior.totalXP

  const thumb    = document.getElementById('menu-hero-thumb')
  const emojiEl  = document.getElementById('menu-hero-emoji')
  const nameEl   = document.getElementById('menu-hero-name')
  const goldEl   = document.getElementById('menu-gold-val')
  const xpEl     = document.getElementById('menu-xp-val')
  const xpBarEl  = document.getElementById('menu-xp-bar')

  if (char.gif) {
    thumb.src = char.gif
    thumb.classList.remove('hidden')
    if (emojiEl) emojiEl.classList.add('hidden')
  } else {
    thumb.classList.add('hidden')
    if (emojiEl) { emojiEl.textContent = char.emoji; emojiEl.classList.remove('hidden') }
  }
  if (nameEl)   nameEl.textContent  = char.name
  if (goldEl)   goldEl.textContent  = s.persistentGold
  if (xpEl)     xpEl.textContent    = xp
  if (xpBarEl)  xpBarEl.style.width = ((xp % 100) / 100 * 100) + '%'
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
    (id) => {
      GameController.useItem(id)
      if (ITEMS[id]?.effect?.type === 'lantern') {
        document.getElementById('backpack-overlay').classList.add('hidden')
      } else {
        _renderBackpack()
      }
    },
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
