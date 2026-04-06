import { CONFIG }           from '../config.js'
import TileEngine             from '../systems/TileEngine.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ITEM_ICONS_BASE, TILE_SLAIN_ICON, TILE_SPIRIT_RELEASE, TILE_TYPE_ICON_FILES } from '../data/tileIcons.js'

// UI module — ALL DOM updates happen here. Zero game logic.
// Cache element references once at init(), expose named update functions.

const el = {}  // element cache
const _logHistory = []

/** HUD portrait gifs per animation state (hero-specific). */
const PORTRAIT_ANIM = {
  warrior: {
    idle:   'assets/sprites/Heroes/Warrior/__Idle.gif',
    attack: 'assets/sprites/Heroes/Warrior/__AttackCombo2hit.gif',
    hit:    'assets/sprites/Heroes/Warrior/__Hit.gif',
    run:    'assets/sprites/Heroes/Warrior/__Run.gif',
    death:  'assets/sprites/Heroes/Warrior/__DeathNoMovement.gif',
  },
  // Ranger folder currently has only Idle + Attack; reuse idle for other states.
  ranger: {
    idle:   'assets/sprites/Heroes/Ranger/__Idle.gif',
    attack: 'assets/sprites/Heroes/Ranger/__Attack.gif',
    hit:    'assets/sprites/Heroes/Ranger/__Idle.gif',
    run:    'assets/sprites/Heroes/Ranger/__Idle.gif',
    death:  'assets/sprites/Heroes/Ranger/__Idle.gif',
  },
}

const UI = {
  init() {
    el.hpBar       = document.getElementById('hp-bar')
    el.hpValue     = document.getElementById('hp-value')
    el.manaBar     = document.getElementById('mana-bar')
    el.manaValue   = document.getElementById('mana-value')
    el.dmgValue    = document.getElementById('dmg-value')
    el.goldValue   = document.getElementById('gold-value')
    el.hudPortraitWrap = document.getElementById('hud-portrait-wrap')
    el.hudPortrait = document.getElementById('hud-portrait')
    el.hudPortraitImg = document.getElementById('hud-portrait-img')
    el.xpBar       = document.getElementById('xp-bar')
    el.floorInfo   = document.getElementById('floor-info')
    el.messageBox  = document.getElementById('message-box')
    el.actionBtns  = document.getElementById('action-buttons')
    el.spellBtn    = document.getElementById('spell-btn')
    el.fleeBtn     = document.getElementById('flee-btn')
    el.retreatBtn  = document.getElementById('retreat-btn')
    el.grid        = document.getElementById('grid')
    el.skipFloorBtn = document.getElementById('skip-floor-btn')
    el.floorBanner = document.getElementById('floor-banner')
    el.floorBannerText = document.getElementById('floor-banner-text')
    el.levelUpOverlay  = document.getElementById('level-up-overlay')
    el.abilityChoices  = document.getElementById('ability-choices')
    el.runSummary      = document.getElementById('run-summary')
    // Main menu
    el.mainMenu        = document.getElementById('main-menu')
    el.menuGoldVal     = document.getElementById('menu-gold-val')
    el.menuXpVal       = document.getElementById('menu-xp-val')
    el.menuXpBar       = document.getElementById('menu-xp-bar')
    // Panel overlays
    el.goldShopOverlay    = document.getElementById('gold-shop-overlay')
    el.shopGoldVal        = document.getElementById('shop-gold-val')
    el.shopCartInfo       = document.getElementById('shop-cart-info')
    el.shopList           = document.getElementById('shop-list')
    el.merchantOverlay    = document.getElementById('merchant-overlay')
    el.infoCardOverlay    = document.getElementById('info-card-overlay')
    el.infoCard           = document.getElementById('info-card')
    el.trapModalOverlay   = document.getElementById('trap-modal-overlay')
    el.trapModalBackdrop  = document.getElementById('trap-modal-backdrop')
    el.trapModalBody      = document.getElementById('trap-modal-body')
    el.trapModalTitle     = document.getElementById('trap-modal-title')
    el.trapModalOk        = document.getElementById('trap-modal-ok')
    el.ropeModalOverlay   = document.getElementById('rope-modal-overlay')
    el.ropeModalBackdrop  = document.getElementById('rope-modal-backdrop')
    el.ropeModalBody      = document.getElementById('rope-modal-body')
    el.ropeModalTitle     = document.getElementById('rope-modal-title')
    el.ropeModalConfirm   = document.getElementById('rope-modal-confirm')
    el.ropeModalCancel    = document.getElementById('rope-modal-cancel')
    el.hudSlotA           = document.getElementById('hud-btn-slot-a')
    el.hudSlotB           = document.getElementById('hud-btn-slot-b')
    el.hudSlotC           = document.getElementById('hud-btn-slot-c')
    el.hudSlotD           = document.getElementById('hud-btn-slot-d')
    el.msgLogWrap         = document.getElementById('message-log-wrap')
    el.msgLogExpanded     = document.getElementById('message-log-expanded')
    el.msgLogScroll       = document.getElementById('message-log-scroll')
    el.hudCharacterId     = 'warrior'

    // Toggle log on message-box click
    el.messageBox.addEventListener('click', () => {
      const isOpen = !el.msgLogExpanded.classList.contains('hidden')
      if (isOpen) {
        el.msgLogExpanded.classList.add('hidden')
      } else {
        el.msgLogScroll.innerHTML = _logHistory.map((e, i) =>
          `<div class="log-entry${e.isAlert ? ' log-alert' : ''}${i === 0 ? ' log-latest' : ''}">${e.msg}</div>`
        ).join('')
        el.msgLogExpanded.classList.remove('hidden')
        el.msgLogScroll.scrollTop = 0
      }
    })

    // Collapse log when clicking outside
    document.addEventListener('click', e => {
      if (!el.msgLogWrap.contains(e.target)) {
        el.msgLogExpanded.classList.add('hidden')
      }
    })
  },

  // ── HUD ──────────────────────────────────────

  updateHP(current, max) {
    const pct = Math.max(0, (current / max) * 100)
    el.hpBar.style.width = pct + '%'
    el.hpBar.classList.toggle('critical', pct < 25)
    el.hpValue.textContent = `${current}/${max}`
  },

  updateMana(current, max) {
    const pct = Math.max(0, (current / max) * 100)
    el.manaBar.style.width = pct + '%'
    el.manaValue.textContent = `${current}/${max}`
  },

  updateDamageRange(low, high) {
    if (!el.dmgValue) return
    el.dmgValue.textContent = low === high ? String(low) : `${low}–${high}`
  },

  setSlamBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove('is-ricochet', 'is-ricochet-active')
    if (visible) {
      el.hudSlotA.innerHTML   = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <img src="assets/sprites/abilities/slam.png" class="ability-btn-img" alt="Slam" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotA.title       = `Slam — double damage, no counter (${manaCost} mana)`
      el.hudSlotA.disabled    = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-slam')
    } else {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-slam', 'is-slam-active')
    }
  },

  setSlamActive(active) {
    el.hudSlotA?.classList.toggle('is-slam-active', active)
  },

  setRicochetBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove('is-slam', 'is-slam-active')
    if (visible) {
      el.hudSlotA.innerHTML   = `
        <span class="ability-btn-wrap ability-btn-wrap--ricochet">
          <img src="assets/sprites/abilities/ricochet-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/ricochet-badge.png" class="ability-btn-badge" alt="Ricochet" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotA.title       = `Ricochet — 3rd target fires; with 1–2, tap again (${manaCost} mana)`
      el.hudSlotA.disabled    = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-ricochet')
    } else {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-ricochet', 'is-ricochet-active')
    }
  },

  setRicochetActive(active) {
    el.hudSlotA?.classList.toggle('is-ricochet-active', active)
  },

  clearRicochetMarks() {
    document.querySelectorAll('.ricochet-marker').forEach(n => n.remove())
  },

  refreshRicochetMarks(tiles) {
    this.clearRicochetMarks()
    tiles.forEach((tile, i) => {
      if (!tile.element) return
      const badge = document.createElement('div')
      badge.className = 'ricochet-marker'
      badge.textContent = String(i + 1)
      tile.element.appendChild(badge)
    })
  },

  setGridRicochetMode(active) {
    document.getElementById('grid-container')?.classList.toggle('ricochet-mode', active)
  },

  /** Slot D — Ranger Triple Volley (slot B is Poison Arrow). Warrior uses B for Blinding Light. */
  setArrowBarrageBtn(visible, manaCost = 12) {
    if (!el.hudSlotD) return
    if (visible) {
      el.hudSlotD.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--arrow-barrage">
          <img src="assets/sprites/abilities/arrow-barrage-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/arrow-barrage-badge.png" class="ability-btn-badge" alt="Triple Volley" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotD.title = `Triple Volley — 3×3 blast, 50% attack per enemy (${manaCost} mana)`
      el.hudSlotD.disabled = false
      el.hudSlotD.classList.remove('is-placeholder')
      el.hudSlotD.classList.add('is-arrow-barrage')
      if (el.hudSlotC) {
        el.hudSlotC.textContent = '···'
        el.hudSlotC.title = 'Reserved'
        el.hudSlotC.disabled = true
        el.hudSlotC.classList.add('is-placeholder')
        el.hudSlotC.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
      }
    } else if (el.hudSlotD.classList.contains('is-arrow-barrage')) {
      el.hudSlotD.textContent = '···'
      el.hudSlotD.title = 'Reserved'
      el.hudSlotD.disabled = true
      el.hudSlotD.classList.add('is-placeholder')
      el.hudSlotD.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
    // Legacy: Triple Volley (arrow barrage) used to live on slot B or C
    if (el.hudSlotB?.classList.contains('is-arrow-barrage')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title = 'Reserved'
      el.hudSlotB.disabled = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
    if (el.hudSlotC?.classList.contains('is-arrow-barrage')) {
      el.hudSlotC.textContent = '···'
      el.hudSlotC.title = 'Reserved'
      el.hudSlotC.disabled = true
      el.hudSlotC.classList.add('is-placeholder')
      el.hudSlotC.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
  },

  setArrowBarrageActive(active) {
    el.hudSlotD?.classList.toggle('is-arrow-barrage-active', active)
  },

  setGridArrowBarrageMode(active) {
    document.getElementById('grid-container')?.classList.toggle('arrow-barrage-mode', active)
  },

  clearTripleVolleyAoePreview() {
    document.querySelectorAll('#grid .tile.triple-volley-aoe-preview').forEach(n =>
      n.classList.remove('triple-volley-aoe-preview'),
    )
  },

  /** 3×3 AoE highlight — center tile is included; clips to grid. */
  setTripleVolleyAoePreview(centerRow, centerCol) {
    this.clearTripleVolleyAoePreview()
    const grid = TileEngine.getGrid()
    if (!grid?.length) return
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = centerRow + dr
        const c = centerCol + dc
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue
        document
          .querySelector(`#grid .tile[data-row="${r}"][data-col="${c}"]`)
          ?.classList.add('triple-volley-aoe-preview')
      }
    }
  },

  /** Slot B — Ranger Poison Arrow (2nd unlock). Triple Volley uses slot D. */
  setPoisonArrowShotBtn(visible, manaCost = 12) {
    if (!el.hudSlotB) return
    el.hudSlotB.classList.remove('is-poison-arrow-shot', 'is-poison-arrow-shot-active')
    if (visible) {
      el.hudSlotB.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--poison-arrow-shot">
          <img src="assets/sprites/abilities/poison-arrow-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/poison-arrow-badge.png" class="ability-btn-badge" alt="Poison Arrow" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotB.title = `Poison Arrow — tap one enemy; poison ticks each reveal or melee (${manaCost} mana)`
      el.hudSlotB.disabled = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-poison-arrow-shot')
    } else {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title = 'Reserved'
      el.hudSlotB.disabled = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-poison-arrow-shot', 'is-poison-arrow-shot-active')
    }
    // Legacy: Poison used to live on slot D
    if (el.hudSlotD?.classList.contains('is-poison-arrow-shot')) {
      el.hudSlotD.textContent = '···'
      el.hudSlotD.title = 'Reserved'
      el.hudSlotD.disabled = true
      el.hudSlotD.classList.add('is-placeholder')
      el.hudSlotD.classList.remove('is-poison-arrow-shot', 'is-poison-arrow-shot-active')
    }
  },

  setPoisonArrowShotActive(active) {
    el.hudSlotB?.classList.toggle('is-poison-arrow-shot-active', active)
  },

  setGridPoisonArrowShotMode(active) {
    document.getElementById('grid-container')?.classList.toggle('poison-arrow-shot-mode', active)
  },

  /** Slot B — Warrior Blinding Light (Ranger uses B for Poison Arrow). */
  setBlindingLightBtn(visible, manaCost = 10) {
    if (!el.hudSlotB) return
    if (visible) {
      el.hudSlotB.innerHTML   = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <img src="assets/sprites/abilities/blinding-light.jpg" class="ability-btn-img" alt="Blinding Light" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotB.title       = `Blinding Light — stun scales with HUD attack + mastery; no damage (${manaCost} mana)`
      el.hudSlotB.disabled    = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-blinding-light')
    } else if (el.hudSlotB.classList.contains('is-blinding-light')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title       = 'Reserved'
      el.hudSlotB.disabled    = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-blinding-light', 'is-blinding-light-active')
    }
  },

  setBlindingLightActive(active) {
    el.hudSlotB?.classList.toggle('is-blinding-light-active', active)
  },

  setLanternTargeting(active) {
    document.getElementById('grid-container')?.classList.toggle('lantern-mode', active)
  },

  spawnArrow(tileEl) {
    if (!tileEl) return
    const img = document.createElement('img')
    img.src = 'assets/sprites/effects/ranger-arrow-shot.gif?t=' + Date.now()
    img.className = 'arrow-projectile'
    tileEl.appendChild(img)
    setTimeout(() => img.remove(), 700)
  },

  flashTile(tileEl) {
    if (!tileEl) return
    tileEl.classList.add('flash-blind')
    setTimeout(() => tileEl.classList.remove('flash-blind'), 600)
  },

  splitSlime(tileEl) {
    if (!tileEl) return
    const iconWrap = tileEl.querySelector('.tile-icon-wrap')
    if (!iconWrap) return
    const img = iconWrap.querySelector('.tile-icon-img')
    if (!img) return
    const src = img.src.split('?')[0]
    // Replace single slime with two smaller side-by-side slimes
    iconWrap.classList.add('slime-split')
    iconWrap.innerHTML = `
      <img class="tile-icon-img slime-half" src="${src}?t=${Date.now()}" alt="" draggable="false"/>
      <img class="tile-icon-img slime-half" src="${src}?t=${Date.now() + 1}" alt="" draggable="false"/>
    `
  },

  setHudCharacter(characterId) {
    if (!el.hudPortraitWrap) return
    const id = characterId === 'ranger' ? 'ranger' : 'warrior'
    el.hudCharacterId = id
    const isRanger = id === 'ranger'
    el.hudPortraitWrap.classList.toggle('is-ranger', isRanger)
    if (el.hudPortraitImg) {
      el.hudPortraitImg.src = PORTRAIT_ANIM[id].idle
    }
  },

  // State: 'idle' | 'attack' | 'hit' | 'run' | 'death'
  setPortraitAnim(state) {
    if (!el.hudPortraitImg) return
    const id  = el.hudCharacterId === 'ranger' ? 'ranger' : 'warrior'
    const MAP = PORTRAIT_ANIM[id]
    if (MAP && MAP[state]) el.hudPortraitImg.src = MAP[state]
  },

  updateGold(amount) {
    el.goldValue.textContent = amount
  },

  updateXP(current, needed) {
    if (!needed || needed <= 0) {
      el.xpBar.style.width = '0%'
      return
    }
    const pct = Math.min(100, (current / needed) * 100)
    el.xpBar.style.width = pct + '%'
  },

  /** Cheat: show skip-floor only when cheats.skipFloorButton is true and main menu is hidden */
  refreshSkipFloorButton(save) {
    const btn = el.skipFloorBtn
    if (!btn) return
    const enabled = save?.settings?.cheats?.skipFloorButton === true
    const inGame = el.mainMenu?.classList.contains('hidden')
    const show = enabled && inGame
    btn.classList.toggle('hidden', !show)
    btn.setAttribute('aria-hidden', show ? 'false' : 'true')
  },

  updateFloor(floor, opts = {}) {
    if (opts.rest) {
      el.floorInfo.textContent = 'Sanctuary — Rest'
      UI.applyFloorTheme(floor, { rest: true })
      return
    }
    const names = CONFIG.floorNames
    const name = names[(floor - 1) % names.length]
    el.floorInfo.textContent = `Floor ${floor} — ${name}`
    UI.applyFloorTheme(floor, { rest: false })
  },

  /** Full-screen background: sanctuary uses a dedicated art; dungeon uses floor segment theme. */
  applyFloorTheme(floor, opts = {}) {
    const bg = opts.rest
      ? CONFIG.restSanctuaryBackground
      : CONFIG.floorBackgroundFor(floor)
    // Resolve against the document: relative URLs inside custom props are otherwise resolved
    // relative to css/main.css (where var() is used), which breaks paths like assets/…
    const abs = new URL(bg, window.location.href).href
    document.documentElement.style.setProperty('--floor-bg-image', `url('${abs}')`)
  },

  resetFloorTheme() {
    const abs = new URL('assets/DungeonBackground.png', window.location.href).href
    document.documentElement.style.setProperty('--floor-bg-image', `url('${abs}')`)
  },

  // ── Messages ─────────────────────────────────

  setMessage(msg, isAlert = false) {
    el.messageBox.textContent = msg
    el.messageBox.classList.toggle('alert', isAlert)
    _logHistory.unshift({ msg, isAlert })
    if (_logHistory.length > 80) _logHistory.pop()
  },

  clearLog() {
    _logHistory.length = 0
  },

  // ── Action panel ──────────────────────────────

  showActionPanel(manaCost, canCast) {
    el.actionBtns.classList.remove('hidden')
    if (el.spellBtn) {
      el.spellBtn.disabled = !canCast
      el.spellBtn.textContent = canCast
        ? `✨ Spell (${manaCost}🔵)`
        : `✨ Spell (no mana)`
    }
  },

  hideActionPanel() {
    el.actionBtns.classList.add('hidden')
  },

  setSpellTargeting(active, manaCost) {
    if (!el.spellBtn) return
    el.spellBtn.classList.toggle('targeting', active)
    if (active) {
      el.spellBtn.textContent = '✨ Cancel Spell'
    } else {
      const canCast = el.spellBtn.disabled === false
      el.spellBtn.textContent = manaCost != null
        ? `✨ Spell (${manaCost}🔵)`
        : el.spellBtn.textContent.replace('Cancel Spell', `Spell`)
    }
  },

  showRetreat() {
    el.retreatBtn.classList.remove('hidden')
  },

  hideRetreat() {
    el.retreatBtn.classList.add('hidden')
    document.getElementById('retreat-confirm').classList.add('hidden')
  },

  // ── Grid ─────────────────────────────────────

  getGridEl() {
    return el.grid
  },

  /**
   * Fade the tile grid out, run `mid` (rebuild floor), fade in. Total time = totalMs (half out / half in).
   * If `floorNumber` is set, show a large "Floor N" banner over the grid during fade-in, then fade it out quickly.
   */
  runFloorTransition(totalMs, mid, floorNumber) {
    const grid = el.grid
    const wrap = document.getElementById('grid-container')
    const banner = el.floorBanner
    const bannerText = el.floorBannerText
    const BANNER_OUT_MS = 340

    const hideFloorBanner = () => new Promise(rBanner => {
      if (!banner || !banner.classList.contains('is-visible')) {
        rBanner()
        return
      }
      const done = () => {
        banner.removeEventListener('transitionend', onEnd)
        banner.classList.add('hidden')
        banner.classList.remove('is-visible')
        banner.setAttribute('aria-hidden', 'true')
        rBanner()
      }
      const onEnd = e => {
        if (e.propertyName !== 'opacity') return
        done()
      }
      banner.addEventListener('transitionend', onEnd)
      setTimeout(done, BANNER_OUT_MS + 100)
      banner.classList.remove('is-visible')
    })

    if (!grid) {
      mid()
      return Promise.resolve()
    }
    const half = Math.max(0, totalMs / 2)
    wrap?.classList.add('floor-transition-active')
    grid.style.pointerEvents = 'none'
    grid.style.transition = `opacity ${half}ms ease`
    requestAnimationFrame(() => {
      grid.style.opacity = '0'
    })
    return new Promise(resolve => {
      setTimeout(() => {
        mid()
        grid.style.transition = 'none'
        grid.style.opacity = '0'
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (floorNumber != null && banner && bannerText) {
              bannerText.textContent = `Floor ${floorNumber}`
              banner.classList.remove('hidden')
              banner.setAttribute('aria-hidden', 'false')
              requestAnimationFrame(() => {
                banner.classList.add('is-visible')
              })
            }
            grid.style.transition = `opacity ${half}ms ease`
            grid.style.opacity = '1'
            setTimeout(() => {
              grid.style.transition = ''
              grid.style.opacity = ''
              grid.style.pointerEvents = ''
              hideFloorBanner().then(() => {
                wrap?.classList.remove('floor-transition-active')
                resolve()
              })
            }, half)
          })
        })
      }, half)
    })
  },

  // ── Float text ───────────────────────────────

  spawnFloat(tileEl, text, type) {
    const rect = tileEl.getBoundingClientRect()
    const div = document.createElement('div')
    div.className = `float-text ${type}`
    div.textContent = text
    div.style.left = (rect.left + rect.width  / 2 - 24) + 'px'
    div.style.top  = (rect.top  + rect.height / 2 - 10) + 'px'
    document.body.appendChild(div)
    setTimeout(() => div.remove(), 1200)
  },

  // ── Tile mutations ───────────────────────────

  /** Boss defeated — stairs replace tile (no ashes / spirit). */
  markBossTileAsExit(tileEl) {
    tileEl.classList.remove('active-combat', 'enemy-alive', 'is-enemy')
    tileEl.classList.remove('tile-type-boss')
    tileEl.classList.add('tile-type-exit')
    tileEl.style.pointerEvents = ''
    const front = tileEl.querySelector('.tile-front')
    if (!front) return
    const src = ITEM_ICONS_BASE + TILE_TYPE_ICON_FILES.exit
    front.className = 'tile-front type-exit'
    front.innerHTML = `
      <span class="tile-icon-wrap"><img class="tile-icon-img" src="${src}" alt="" decoding="async" draggable="false"/></span>
      <span class="tile-label"></span>
    `
    const img = front.querySelector('.tile-icon-img')
    if (img) {
      img.addEventListener('error', () => {
        const wrap = front.querySelector('.tile-icon-wrap')
        if (wrap) {
          wrap.innerHTML = '<span class="tile-emoji">🚪</span>'
          wrap.classList.add('tile-icon-fallback')
        }
      }, { once: true })
    }
  },

  markTileSlain(tileEl) {
    tileEl.classList.remove('active-combat', 'enemy-alive')
    tileEl.style.pointerEvents = ''
    const front = tileEl.querySelector('.tile-front')
    front.className = 'tile-front type-slain'
    const wrap = front.querySelector('.tile-icon-wrap')
    if (wrap) {
      if (TILE_SLAIN_ICON) {
        wrap.classList.remove('tile-icon-fallback')
        wrap.innerHTML = `<img class="tile-icon-img" src="${TILE_SLAIN_ICON}" alt="" decoding="async" draggable="false"/>`
        const img = wrap.querySelector('.tile-icon-img')
        if (img) {
          img.addEventListener('error', () => {
            wrap.innerHTML = '<span class="tile-emoji">💨</span>'
            wrap.classList.add('tile-icon-fallback')
          }, { once: true })
        }
      } else {
        wrap.innerHTML = '<span class="tile-emoji">💨</span>'
        wrap.classList.add('tile-icon-fallback')
      }
    }
    const label = front.querySelector('.tile-label')
    if (label) label.textContent = 'slain'
    const hpBar = front.querySelector('.tile-hp-bar')
    if (hpBar) hpBar.remove()
    const stats = front.querySelector('.tile-enemy-stats')
    if (stats) stats.remove()
    if (TILE_SPIRIT_RELEASE) {
      const spirit = document.createElement('img')
      spirit.src = TILE_SPIRIT_RELEASE
      spirit.className = 'enemy-spirit-fx'
      spirit.alt = ''
      spirit.draggable = false
      tileEl.appendChild(spirit)
      setTimeout(() => spirit.remove(), 1600)
    }
  },

  markTileEnemyAlive(tileEl) {
    tileEl.classList.add('enemy-alive')
  },

  setTileActiveCombat(tileEl, isActive) {
    tileEl.classList.toggle('active-combat', isActive)
  },

  updateEnemyHP(tileEl, newHP) {
    const hpEl = tileEl?.querySelector('.stat-hp')
    if (hpEl) hpEl.textContent = `❤️ ${newHP}`
  },

  shakeTile(tileEl) {
    tileEl.classList.add('shaking')
    setTimeout(() => tileEl.classList.remove('shaking'), 400)
  },

  playSlam() {
    const overlay = document.getElementById('slam-overlay')
    const gif     = document.getElementById('slam-gif')
    if (!overlay || !gif) return
    gif.src = 'assets/sprites/effects/HammerSlam.gif?' + Date.now()
    overlay.classList.remove('hidden', 'fading')
    // 36 frames × 80ms = 2880ms; start fade-out just before end
    setTimeout(() => {
      overlay.classList.add('fading')
      setTimeout(() => overlay.classList.add('hidden'), 380)
    }, 2500)
  },

  spawnSlash(tileEl) {
    const slash = document.createElement('img')
    slash.src = 'assets/sprites/effects/FireSwordSlash.gif?' + Date.now()
    slash.className = 'strike-slash'
    tileEl.appendChild(slash)
    // 14 frames × 50ms = 700ms; remove after one cycle
    setTimeout(() => slash.remove(), 750)
  },

  markTileReachable(tileEl) {
    tileEl.classList.add('reachable')
  },

  lockTile(tileEl) {
    tileEl.classList.add('locked')
  },

  unlockTile(tileEl) {
    tileEl.classList.remove('locked')
  },

  // ── Info card ─────────────────────────────────

  /**
   * @param {object} data — card content (name, blurb, details, …)
   * @param {{ onDrop?: () => void }} [opts] — optional Drop action (e.g. backpack item)
   */
  showInfoCard(data, opts = {}) {
    if (!el.infoCardOverlay || !el.infoCard) return

    const ATTR_LABELS = {
      fast: { icon: '⚡', label: 'Fast',  desc: 'Attacks twice per encounter' },
      boss: { icon: '💀', label: 'Boss',  desc: 'Powerful floor guardian' },
    }

    const detailsHTML = (data.details ?? []).map(d =>
      `<div class="card-attr"><span class="card-attr-icon">${d.icon}</span><div class="card-attr-text"><span class="card-attr-name">${d.label}</span>${d.desc ? `<span class="card-attr-desc">${d.desc}</span>` : ''}</div></div>`
    ).join('')

    const attrHTML = (data.attributes ?? []).map(a => {
      const info = ATTR_LABELS[a] ?? { icon: '•', label: a, desc: '' }
      return `<div class="card-attr"><span class="card-attr-icon">${info.icon}</span><div class="card-attr-text"><span class="card-attr-name">${info.label}</span>${info.desc ? `<span class="card-attr-desc">${info.desc}</span>` : ''}</div></div>`
    }).join('')

    const statsHTML = (data.hp != null)
      ? `<div class="card-stats">
           <div class="card-stat"><span class="card-stat-icon">❤️</span><span class="card-stat-val">${data.hp}</span><span class="card-stat-label">HP</span></div>
           <div class="card-stat"><span class="card-stat-icon">⚔️</span><span class="card-stat-val">${data.dmg}</span><span class="card-stat-label">DMG</span></div>
         </div>`
      : ''

    const typeHTML = data.type
      ? `<div class="card-type">${data.type}</div>`
      : ''

    const aboveHeaderHTML = data.spriteSrcBg && data.spriteSrc
      ? `<div class="card-portrait-above card-portrait-stack">
           <img class="card-sprite-bg" src="${data.spriteSrcBg}" alt="" draggable="false"/>
           <img class="card-sprite-large card-sprite-fg-layer" src="${data.spriteSrc}?${Date.now()}" alt="${data.name}" draggable="false"/>
         </div>`
      : data.spriteSrc
        ? `<div class="card-portrait-above"><img class="card-sprite-large" src="${data.spriteSrc}?${Date.now()}" alt="${data.name}"></div>`
        : ''

    const inlinePortrait = !data.spriteSrc
      ? `<div class="card-portrait"><div class="card-emoji-large">${data.emoji ?? ''}</div></div>`
      : ''

    el.infoCard.innerHTML = `
      ${aboveHeaderHTML}
      <div class="card-header">
        ${inlinePortrait}
        <div class="card-header-text">
          <div class="card-name">${data.name}</div>
          ${typeHTML}
          ${statsHTML}
        </div>
      </div>
      <div class="card-divider"></div>
      <p class="card-blurb">${data.blurb}</p>
      ${detailsHTML ? `<div class="card-attrs">${detailsHTML}</div>` : ''}
      ${attrHTML ? `<div class="card-attrs">${attrHTML}</div>` : ''}
      ${typeof opts.onDrop === 'function'
        ? `<div class="card-actions"><button type="button" class="card-btn card-btn-drop">Drop</button></div>`
        : ''}
    `

    if (typeof opts.onDrop === 'function') {
      el.infoCard.querySelector('.card-btn-drop')?.addEventListener('click', (e) => {
        e.stopPropagation()
        opts.onDrop()
      })
    }

    el.infoCardOverlay.classList.add('visible')
  },

  hideInfoCard() {
    el.infoCardOverlay?.classList.remove('visible')
  },

  /** Trap tile: explanation modal. On dismiss runs `onConfirm` (reveal uses noop; hold-to-info only). */
  showTrapModal(onConfirm) {
    const ov = el.trapModalOverlay
    const info = TILE_BLURBS.trap
    if (!ov || typeof onConfirm !== 'function') {
      onConfirm?.()
      return
    }
    el.trapModalTitle.textContent = info.label
    el.trapModalBody.textContent = ''
    const p1 = document.createElement('p')
    p1.textContent = info.blurb
    el.trapModalBody.appendChild(p1)
    if (info.modalSubtext) {
      const p2 = document.createElement('p')
      p2.className = 'trap-modal-sub'
      p2.textContent = info.modalSubtext
      el.trapModalBody.appendChild(p2)
    }
    let done = false
    const close = () => {
      if (done) return
      done = true
      el.trapModalOk.removeEventListener('click', close)
      el.trapModalBackdrop.removeEventListener('click', close)
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      onConfirm()
    }
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
    el.trapModalOk.addEventListener('click', close)
    el.trapModalBackdrop.addEventListener('click', close)
  },

  /** Rope tile: explain escape, then Confirm or Cancel (backdrop = cancel). */
  showRopeModal(onConfirm, onCancel) {
    const ov = el.ropeModalOverlay
    const info = TILE_BLURBS.rope
    if (!ov || typeof onConfirm !== 'function') {
      onConfirm?.()
      return
    }
    el.ropeModalTitle.textContent = info.label
    el.ropeModalBody.textContent = ''
    const p1 = document.createElement('p')
    p1.textContent = info.blurb
    el.ropeModalBody.appendChild(p1)
    if (info.modalSubtext) {
      const p2 = document.createElement('p')
      p2.className = 'trap-modal-sub'
      p2.textContent = info.modalSubtext
      el.ropeModalBody.appendChild(p2)
    }
    let done = false
    const close = () => {
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
    }
    const finishConfirm = () => {
      if (done) return
      done = true
      el.ropeModalConfirm.removeEventListener('click', finishConfirm)
      el.ropeModalCancel.removeEventListener('click', finishCancel)
      el.ropeModalBackdrop.removeEventListener('click', finishCancel)
      close()
      onConfirm()
    }
    const finishCancel = () => {
      if (done) return
      done = true
      el.ropeModalConfirm.removeEventListener('click', finishConfirm)
      el.ropeModalCancel.removeEventListener('click', finishCancel)
      el.ropeModalBackdrop.removeEventListener('click', finishCancel)
      close()
      onCancel?.()
    }
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
    el.ropeModalConfirm.addEventListener('click', finishConfirm)
    el.ropeModalCancel.addEventListener('click', finishCancel)
    el.ropeModalBackdrop.addEventListener('click', finishCancel)
  },

  // ── Backpack ──────────────────────────────────

  renderBackpack(inventory, itemRegistry, onUse, onHold) {
    const grid = document.getElementById('backpack-grid')
    if (!grid) return
    const SLOTS = 9
    grid.innerHTML = ''

    // Build a slot for each occupied item, then fill remainder with empty slots
    const filled = inventory.map(entry => {
      const item = itemRegistry[entry.id]
      if (!item) return null
      const slot = document.createElement('div')
      slot.className = 'backpack-slot occupied'
      const bpIcon = item.spriteSrc
        ? `<img class="bp-item-img" src="${item.spriteSrc}" alt="${item.name}">`
        : `<span class="bp-item-emoji">${item.icon}</span>`
      slot.innerHTML = `
        ${bpIcon}
        ${entry.qty > 1 ? `<span class="bp-item-qty">${entry.qty}</span>` : ''}
      `

      // Hold-to-inspect
      let _timer = null, _didHold = false, _sx = 0, _sy = 0
      slot.addEventListener('pointerdown', e => {
        _didHold = false; _sx = e.clientX; _sy = e.clientY
        _timer = setTimeout(() => { _didHold = true; onHold(entry.id) }, 380)
      })
      slot.addEventListener('pointermove', e => {
        if (!_timer) return
        if (Math.hypot(e.clientX - _sx, e.clientY - _sy) > 8) { clearTimeout(_timer); _timer = null }
      })
      const cancel = () => { clearTimeout(_timer); _timer = null }
      slot.addEventListener('pointerup',     cancel)
      slot.addEventListener('pointercancel', cancel)
      slot.addEventListener('contextmenu',   e => e.preventDefault())
      slot.addEventListener('click', () => { if (!_didHold) onUse(entry.id) })

      return slot
    }).filter(Boolean)

    filled.forEach(s => grid.appendChild(s))
    for (let i = filled.length; i < SLOTS; i++) {
      const empty = document.createElement('div')
      empty.className = 'backpack-slot'
      grid.appendChild(empty)
    }
  },

  /** @param {Array<{ level: number, name: string, icon?: string }>} entries */
  renderBackpackLevelUpLog(entries) {
    const list = document.getElementById('backpack-levelup-list')
    if (!list) return
    if (!entries?.length) {
      list.innerHTML = '<div class="backpack-levelup-empty">No level-ups yet this run.</div>'
      return
    }
    list.innerHTML = entries.map((e, i) => `
      <div class="backpack-levelup-entry">
        <span class="backpack-levelup-idx">${i + 1}.</span>
        <span class="backpack-levelup-lv">Lv ${e.level}</span>
        <span class="backpack-levelup-icon" aria-hidden="true">${e.icon ?? '✨'}</span>
        <span class="backpack-levelup-name">${e.name}</span>
      </div>
    `).join('')
  },

  // ── Level-up overlay ─────────────────────────

  // choices: array of { id, name, desc, icon?, iconSrc?, iconBgSrc? }
  // onPick: callback(abilityId)
  showLevelUpOverlay(choices, onPick) {
    el.abilityChoices.innerHTML = ''
    for (const choice of choices) {
      const card = document.createElement('div')
      card.className = 'ability-card'
      const hasSprite = choice.iconSrc && choice.iconBgSrc
      const iconHtml = hasSprite
        ? `<div class="levelup-ability-icon-wrap">
             <img class="levelup-ability-bg" src="${choice.iconBgSrc}" alt="" draggable="false" />
             <img class="levelup-ability-badge" src="${choice.iconSrc}" alt="" draggable="false" />
           </div>`
        : (choice.icon ?? '')
      const iconClass = `ability-icon${hasSprite ? ' ability-icon--sprite' : ''}`
      card.innerHTML = `
        <div class="${iconClass}">${iconHtml}</div>
        <div class="ability-info">
          <div class="ability-name">${choice.name}</div>
          <div class="ability-desc">${choice.desc}</div>
        </div>`
      card.addEventListener('click', () => onPick(choice.id), { once: true })
      el.abilityChoices.appendChild(card)
    }
    el.levelUpOverlay.classList.add('visible', 'locked')
    setTimeout(() => el.levelUpOverlay.classList.remove('locked'), 650)
  },

  hideLevelUpOverlay() {
    el.levelUpOverlay.classList.remove('visible')
    el.abilityChoices.innerHTML = ''
  },

  // ── Run summary overlay ───────────────────────

  showRunSummary(outcome, stats) {
    // outcome: 'death' | 'escape' | 'retreat'
    const titles = {
      death:   { text: '💀 Perished',       cls: '' },
      escape:  { text: '🚪 Escaped!',       cls: 'escaped' },
      retreat: { text: '🏃 Hasty Retreat!', cls: 'retreated' },
    }
    const subtitles = {
      death:   `You fell in the depths at level ${stats.level}. Only checkpoint gold was kept.`,
      escape:  `You made it out alive with ${stats.gold} gold and ${stats.tilesRevealed} tiles revealed.`,
      retreat: `You fled with ${stats.gold} gold. ${stats.tilesRevealed} tiles revealed.`,
    }
    const t = titles[outcome]
    const earnedLine = stats.xpEarned != null
      ? `<div class="stats">+${stats.xpEarned} XP &nbsp;|&nbsp; +${stats.goldBanked} 💰 banked</div>`
      : ''

    let killerHTML = ''
    if (outcome === 'death' && stats.killer) {
      const k = stats.killer
      const portraitHTML = k.spriteSrc
        ? `<img class="killer-sprite" src="${k.spriteSrc}?${Date.now()}" alt="${k.name}">`
        : `<div class="killer-emoji">${k.emoji}</div>`
      const dmgStr = Array.isArray(k.dmg) ? k.dmg.join('–') : k.dmg
      killerHTML = `
        <div class="killer-card">
          <div class="killer-label">Slain by</div>
          <div class="killer-body">
            ${portraitHTML}
            <div class="killer-info">
              <div class="killer-name">${k.name}</div>
              ${k.type ? `<div class="killer-type">${k.type}</div>` : ''}
              <div class="killer-stats">
                <span>❤️ ${k.hp}</span>
                <span>⚔️ ${dmgStr}</span>
              </div>
            </div>
          </div>
          ${k.blurb ? `<p class="killer-blurb">${k.blurb}</p>` : ''}
        </div>`
    }

    el.runSummary.innerHTML = `
      ${killerHTML}
      <h2 class="${t.cls}">${t.text}</h2>
      <p>${subtitles[outcome]}</p>
      <div class="stats">
        Tiles revealed: ${stats.tilesRevealed} &nbsp;|&nbsp;
        Floor reached: ${stats.floor} &nbsp;|&nbsp;
        Level: ${stats.level}
      </div>
      ${earnedLine}
      <button id="try-again-btn">↺ Back to Menu</button>
    `
    el.runSummary.classList.add('visible')
  },

  hideRunSummary() {
    el.runSummary.classList.remove('visible')
    el.runSummary.innerHTML = ''
  },

  // ── Main menu ─────────────────────────────────

  showMainMenu() {
    UI.resetFloorTheme()
    el.mainMenu.classList.remove('hidden')
  },

  hideMainMenu() {
    el.mainMenu.classList.add('hidden')
  },

  updateMenuStats(persistentGold, totalXP) {
    if (el.menuGoldVal) el.menuGoldVal.textContent = persistentGold
    if (el.menuXpVal)   el.menuXpVal.textContent   = totalXP
    if (el.menuXpBar)   el.menuXpBar.style.width   = ((totalXP % 100) / 100 * 100) + '%'
  },

  setActiveDifficulty(diff) {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === diff)
    })
  },

  // ── XP Tree panel (Warrior or Ranger) ────────

  // showWarriorTree / hideWarriorTree replaced by hero-select-overlay in main.js

  // ── Gold Shop panel ───────────────────────────

  showGoldShop(save, items, onBuy, onRemove) {
    el.shopGoldVal.textContent = `💰 ${save.persistentGold}`
    el.shopCartInfo.classList.toggle('hidden', save.warrior.shopCart.length === 0)
    el.shopList.innerHTML = ''
    for (const [id, def] of Object.entries(items)) {
      const inCart = save.warrior.shopCart.includes(id)
      const canAfford = !inCart && save.persistentGold >= def.goldCost
      const card = document.createElement('div')
      card.className = 'panel-card' + (inCart ? ' in-cart' : '')
      card.innerHTML = `
        <div class="panel-card-icon">${def.icon}</div>
        <div class="panel-card-info">
          <div class="panel-card-name">${def.name}</div>
          <div class="panel-card-desc">${def.desc}</div>
          <div class="panel-card-cost gold-cost">${def.goldCost} 💰</div>
        </div>
        <div class="panel-card-action"></div>`
      const actionEl = card.querySelector('.panel-card-action')
      if (inCart) {
        const btn = document.createElement('button')
        btn.className = 'panel-btn remove'
        btn.textContent = 'Remove'
        btn.addEventListener('click', () => onRemove(id), { once: true })
        actionEl.appendChild(btn)
      } else {
        const btn = document.createElement('button')
        btn.className = 'panel-btn buy gold'
        btn.textContent = 'Buy'
        btn.disabled = !canAfford
        btn.addEventListener('click', () => onBuy(id), { once: true })
        actionEl.appendChild(btn)
      }
      el.shopList.appendChild(card)
    }
    el.goldShopOverlay.classList.remove('hidden')
  },

  hideGoldShop() {
    el.goldShopOverlay.classList.add('hidden')
  },

  // ── Merchant overlay ──────────────────────────

  showMerchant(playerGold, cost, onRoll, onDismiss) {
    if (!el.merchantOverlay) return
    const canAfford = playerGold >= cost
    const resEl = el.merchantOverlay.querySelector('#merchant-result')
    if (resEl) {
      resEl.innerHTML = ''
      resEl.classList.add('hidden')
    }
    el.merchantOverlay.classList.remove('hidden')
    const rollBtn = el.merchantOverlay.querySelector('#merchant-roll-btn')
    rollBtn.disabled = !canAfford
    rollBtn.onclick = onRoll
    rollBtn.classList.remove('hidden')
    el.merchantOverlay.querySelector('#merchant-cost').textContent = cost
    const closeBtn = el.merchantOverlay.querySelector('#merchant-close-btn')
    if (closeBtn) {
      closeBtn.classList.remove('hidden')
      closeBtn.onclick = onDismiss
    }
  },

  showMerchantResult(result, onClose) {
    if (!el.merchantOverlay) return
    const resEl = el.merchantOverlay.querySelector('#merchant-result')
    if (resEl) {
      resEl.innerHTML = `
        <div class="merchant-roll-num">🎲 ${result.roll}</div>
        <div class="merchant-outcome-icon">${result.icon}</div>
        <div class="merchant-outcome-label">${result.label}</div>
      `
      resEl.classList.remove('hidden')
    }
    const closeBtn = el.merchantOverlay.querySelector('#merchant-close-btn')
    if (closeBtn) {
      closeBtn.classList.remove('hidden')
      closeBtn.onclick = onClose
    }
    const rollBtn = el.merchantOverlay.querySelector('#merchant-roll-btn')
    if (rollBtn) rollBtn.classList.add('hidden')
  },

  hideMerchant() {
    if (!el.merchantOverlay) return
    el.merchantOverlay.classList.add('hidden')
    const resEl = el.merchantOverlay.querySelector('#merchant-result')
    if (resEl) {
      resEl.classList.add('hidden')
      resEl.innerHTML = ''
    }
    const closeBtn = el.merchantOverlay.querySelector('#merchant-close-btn')
    if (closeBtn) {
      closeBtn.classList.add('hidden')
      closeBtn.onclick = null
    }
    const rollBtn = el.merchantOverlay.querySelector('#merchant-roll-btn')
    if (rollBtn) {
      rollBtn.classList.remove('hidden')
      rollBtn.onclick = null
    }
  },
}

export default UI
