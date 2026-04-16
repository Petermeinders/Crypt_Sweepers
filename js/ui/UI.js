import { CONFIG }           from '../config.js'
import TileEngine             from '../systems/TileEngine.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ENEMY_DEFS } from '../data/enemies.js'
import Bestiary from '../systems/Bestiary.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import EventBus from '../core/EventBus.js'
import {
  ITEM_ICONS_BASE,
  TILE_SLAIN_ICON,
  TILE_SPIRIT_RELEASE,
  TILE_TYPE_ICON_FILES,
  ENEMY_SPRITES,
  MONSTER_ICONS_BASE,
} from '../data/tileIcons.js'

// UI module — ALL DOM updates happen here. Zero game logic.
// Cache element references once at init(), expose named update functions.

const el = {}  // element cache

function _fillBestiaryCreatureParts(parts, def, enemyId) {
  const sprites = ENEMY_SPRITES[enemyId]
  const gifSrc = sprites?.idle ? `${MONSTER_ICONS_BASE}${sprites.idle}` : null
  if (parts.gif) {
    if (gifSrc) {
      parts.gif.src = `${gifSrc}?t=${Date.now()}`
      parts.gif.classList.remove('hidden')
      parts.gif.alt = def.label
    } else {
      parts.gif.removeAttribute('src')
      parts.gif.classList.add('hidden')
    }
  }
  if (parts.emoji) {
    parts.emoji.textContent = def.emoji ?? ''
    parts.emoji.classList.toggle('hidden', !!gifSrc)
  }
  if (parts.name) parts.name.textContent = def.label
  if (parts.type) {
    const ty = def.type ?? 'unknown'
    parts.type.textContent = ty.charAt(0).toUpperCase() + ty.slice(1)
  }
  if (parts.blurb) parts.blurb.textContent = def.blurb ?? ''
}
function _fillTrinketCard(parts, def) {
  const RARITY_LABEL = { common: 'Common', rare: 'Rare', legendary: 'Legendary' }
  if (parts.rarity) {
    const r = def.rarity ?? 'common'
    parts.rarity.textContent = RARITY_LABEL[r] ?? r
    parts.rarity.className = `trinket-discovery-rarity trinket-rarity-${r}`
  }
  if (parts.name) parts.name.textContent = def.name ?? ''
  if (parts.img) {
    if (def.spriteSrc) {
      parts.img.src = def.spriteSrc
      parts.img.alt = def.name ?? ''
      parts.img.classList.remove('hidden')
      if (parts.emoji) parts.emoji.classList.add('hidden')
    } else {
      parts.img.removeAttribute('src')
      parts.img.classList.add('hidden')
      if (parts.emoji) {
        parts.emoji.textContent = def.icon ?? '?'
        parts.emoji.classList.remove('hidden')
      }
    }
  }
  if (parts.blurb) {
    parts.blurb.textContent = def.blurb ?? ''
    parts.blurb.classList.toggle('hidden', !def.blurb)
  }
  if (parts.effects) {
    parts.effects.innerHTML = ''
    for (const line of (def.details ?? def.tooltipLines ?? [])) {
      const li = document.createElement('li')
      li.className = 'trinket-effect-line'
      li.innerHTML = `<span class="trinket-effect-icon">${line.icon ?? ''}</span><span class="trinket-effect-label">${line.label ?? ''}</span><span class="trinket-effect-desc">${line.desc ?? ''}</span>`
      parts.effects.appendChild(li)
    }
  }
}

/** Draw two settled dice at fixed positions on a canvas — used for the gambler outcome screen. */
function _drawSettledDice(canvas, face1, face2) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const S = 52, R = 9
  const HALF = S * 0.28

  const PIPS = {
    1: [[0, 0]],
    2: [[-HALF, -HALF], [HALF, HALF]],
    3: [[-HALF, -HALF], [0, 0], [HALF, HALF]],
    4: [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]],
    5: [[-HALF, -HALF], [HALF, -HALF], [0, 0], [-HALF, HALF], [HALF, HALF]],
    6: [[-HALF, -HALF], [HALF, -HALF], [-HALF, 0], [HALF, 0], [-HALF, HALF], [HALF, HALF]],
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath()
    c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r)
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  // Felt background
  ctx.fillStyle = '#17402a'; ctx.fillRect(0,0,W,H)
  ctx.strokeStyle = 'rgba(195,155,60,0.55)'; ctx.lineWidth = 3
  rr(ctx,5,5,W-10,H-10,10); ctx.stroke()

  const positions = [
    [W * 0.30, H * 0.5],
    [W * 0.70, H * 0.5],
  ]
  const faces = [face1, face2]

  for (let i = 0; i < 2; i++) {
    const [cx, cy] = positions[i]
    const face = faces[i]
    ctx.save()
    ctx.translate(cx, cy)

    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5
    ctx.fillStyle = '#fffbf0'
    rr(ctx, -S/2, -S/2, S, S, R); ctx.fill()
    ctx.shadowColor = 'transparent'

    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2
    rr(ctx, -S/2+1, -S/2+1, S-2, S-2, R-1); ctx.stroke()

    // Gold glow ring
    ctx.strokeStyle = 'rgba(255,215,60,0.75)'; ctx.lineWidth = 2.5
    rr(ctx, -S/2-2, -S/2-2, S+4, S+4, R+2); ctx.stroke()

    ctx.fillStyle = '#1a0f05'
    const pipR = S * 0.076
    for (const [px, py] of (PIPS[face] || PIPS[1])) {
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 3
      ctx.beginPath(); ctx.arc(px, py, pipR, 0, Math.PI*2); ctx.fill()
    }
    ctx.shadowColor = 'transparent'
    ctx.restore()
  }
}

const _logHistory = []

/** HUD portrait gifs per animation state (hero-specific). */
const PORTRAIT_ANIM = {
  warrior: {
    idle:   'assets/sprites/Heroes/Warrior/warrior-idle.gif',
    attack: 'assets/sprites/Heroes/Warrior/warrior-strike.gif',
    hit:    'assets/sprites/Heroes/Warrior/warrior-idle.gif',
    run:    'assets/sprites/Heroes/Warrior/warrior-idle.gif',
    death:  'assets/sprites/Heroes/Warrior/warrior-idle.gif',
  },
  // Ranger folder currently has only Idle + Attack; reuse idle for other states.
  ranger: {
    idle:   'assets/sprites/Heroes/Ranger/__Idle.gif',
    attack: 'assets/sprites/Heroes/Ranger/__Attack.gif',
    hit:    'assets/sprites/Heroes/Ranger/__Idle.gif',
    run:    'assets/sprites/Heroes/Ranger/__Idle.gif',
    death:  'assets/sprites/Heroes/Ranger/__Idle.gif',
  },
  mage: {
    idle:   'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
    attack: 'assets/sprites/Heroes/Mage/blue-mage-hero-attack-small-speed.gif',
    hit:    'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
    run:    'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
    death:  'assets/sprites/Heroes/Mage/blue-mage-hero-small.gif',
  },
  engineer: {
    idle:   'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
    attack: 'assets/sprites/Heroes/Engineer/engineer-hero-strike.gif',
    hit:    'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
    run:    'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
    death:  'assets/sprites/Heroes/Engineer/engineer-hero-idle.gif',
  },
  vampire: {
    idle:   'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
    attack: 'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
    hit:    'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
    run:    'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
    death:  'assets/sprites/Heroes/Vampire/vampire-hero-idle.png',
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
    el.keyDisplay        = document.getElementById('hud-key-display')
    el.keyValue          = document.getElementById('key-value')
    el.keySlotPlaceholder = document.getElementById('hud-key-slot-placeholder')
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
    el.subFloorOverlay      = document.getElementById('sub-floor-overlay')
    el.subFloorGrid         = document.getElementById('sub-floor-grid')
    el.subFloorMessage      = document.getElementById('sub-floor-message')
    el.shrineOverlay        = document.getElementById('shrine-overlay')
    el.merchantShopOverlay  = document.getElementById('merchant-shop-overlay')
    el.gamblerOverlay       = document.getElementById('gambler-overlay')
    el.tripleChestOverlay   = document.getElementById('triple-chest-overlay')
    el.storyEventOverlay    = document.getElementById('story-event-overlay')
    el.trinketTraderOverlay = document.getElementById('trinket-trader-overlay')
    el.infoCardOverlay    = document.getElementById('info-card-overlay')
    el.infoCard           = document.getElementById('info-card')
    el.bestiaryOverlay         = document.getElementById('bestiary-overlay')
    el.bestiaryList            = document.getElementById('bestiary-list')
    el.bestiaryDiscoveryOverlay = document.getElementById('bestiary-discovery-overlay')
    el.bestiaryDiscoveryBackdrop = document.getElementById('bestiary-discovery-backdrop')
    el.bestiaryDiscoveryGif    = document.getElementById('bestiary-discovery-gif')
    el.bestiaryDiscoveryEmoji  = document.getElementById('bestiary-discovery-emoji')
    el.bestiaryDiscoveryName   = document.getElementById('bestiary-discovery-name')
    el.bestiaryDiscoveryType   = document.getElementById('bestiary-discovery-type')
    el.bestiaryDiscoveryBlurb   = document.getElementById('bestiary-discovery-blurb')
    el.bestiaryDiscoveryOk      = document.getElementById('bestiary-discovery-ok')
    el.bestiaryDetailOverlay    = document.getElementById('bestiary-detail-overlay')
    el.bestiaryDetailBackdrop   = document.getElementById('bestiary-detail-backdrop')
    el.bestiaryDetailGif        = document.getElementById('bestiary-detail-gif')
    el.bestiaryDetailEmoji      = document.getElementById('bestiary-detail-emoji')
    el.bestiaryDetailName       = document.getElementById('bestiary-detail-name')
    el.bestiaryDetailType       = document.getElementById('bestiary-detail-type')
    el.bestiaryDetailBlurb      = document.getElementById('bestiary-detail-blurb')
    el.bestiaryDetailBack       = document.getElementById('bestiary-detail-back')
    el.forgeOverlay             = document.getElementById('forge-overlay')
    el.forgeRecipeList          = document.getElementById('forge-recipe-list')
    el.trinketCodexOverlay      = document.getElementById('trinket-codex-overlay')
    el.trinketCodexList         = document.getElementById('trinket-codex-list')
    el.trinketDiscoveryOverlay  = document.getElementById('trinket-discovery-overlay')
    el.trinketDiscoveryBackdrop = document.getElementById('trinket-discovery-backdrop')
    el.trinketDiscoveryImg      = document.getElementById('trinket-discovery-img')
    el.trinketDiscoveryEmoji    = document.getElementById('trinket-discovery-emoji')
    el.trinketDiscoveryRarity   = document.getElementById('trinket-discovery-rarity')
    el.trinketDiscoveryName     = document.getElementById('trinket-discovery-name')
    el.trinketDiscoveryBlurb    = document.getElementById('trinket-discovery-blurb')
    el.trinketDiscoveryEffects  = document.getElementById('trinket-discovery-effects')
    el.trinketDiscoveryOk       = document.getElementById('trinket-discovery-ok')
    el.trinketDetailOverlay     = document.getElementById('trinket-detail-overlay')
    el.trinketDetailBackdrop    = document.getElementById('trinket-detail-backdrop')
    el.trinketDetailImg         = document.getElementById('trinket-detail-img')
    el.trinketDetailEmoji       = document.getElementById('trinket-detail-emoji')
    el.trinketDetailRarity      = document.getElementById('trinket-detail-rarity')
    el.trinketDetailName        = document.getElementById('trinket-detail-name')
    el.trinketDetailBlurb       = document.getElementById('trinket-detail-blurb')
    el.trinketDetailEffects     = document.getElementById('trinket-detail-effects')
    el.trinketDetailBack        = document.getElementById('trinket-detail-back')
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

    const closeBestiaryDetail = () => {
      el.bestiaryDetailOverlay?.classList.add('hidden')
      el.bestiaryDetailOverlay?.setAttribute('aria-hidden', 'true')
      document.body.classList.remove('bestiary-detail-open')
    }
    el.bestiaryDetailBack?.addEventListener('click', closeBestiaryDetail)
    el.bestiaryDetailBackdrop?.addEventListener('click', closeBestiaryDetail)
  },

  // ── HUD ──────────────────────────────────────

  updateHP(current, max) {
    const pct = Math.max(0, (current / max) * 100)
    el.hpBar.style.width = pct + '%'
    el.hpBar.classList.toggle('critical', pct < 25)
    el.hpValue.textContent = `${current}/${max}`
    this.setBloodOverlay(pct < 10)
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

  /** Slot C — Ranger Triple Volley (3rd slot). Slot A Ricochet, B Poison Arrow. Warrior uses B for Blinding Light. */
  setArrowBarrageBtn(visible, manaCost = 12) {
    if (!el.hudSlotC) return
    if (visible) {
      el.hudSlotC.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--arrow-barrage">
          <img src="assets/sprites/abilities/arrow-barrage-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/arrow-barrage-badge.png" class="ability-btn-badge" alt="Triple Volley" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotC.title = `Triple Volley — 3×3 blast, 50% attack per enemy (${manaCost} mana)`
      el.hudSlotC.disabled = false
      el.hudSlotC.classList.remove('is-placeholder')
      el.hudSlotC.classList.add('is-arrow-barrage')
      if (el.hudSlotD) {
        el.hudSlotD.textContent = '···'
        el.hudSlotD.title = 'Reserved'
        el.hudSlotD.disabled = true
        el.hudSlotD.classList.add('is-placeholder')
        el.hudSlotD.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
      }
    } else if (el.hudSlotC.classList.contains('is-arrow-barrage')) {
      el.hudSlotC.textContent = '···'
      el.hudSlotC.title = 'Reserved'
      el.hudSlotC.disabled = true
      el.hudSlotC.classList.add('is-placeholder')
      el.hudSlotC.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
    // Legacy: Triple Volley used to live on slot B or D
    if (el.hudSlotB?.classList.contains('is-arrow-barrage')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title = 'Reserved'
      el.hudSlotB.disabled = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
    if (el.hudSlotD?.classList.contains('is-arrow-barrage')) {
      el.hudSlotD.textContent = '···'
      el.hudSlotD.title = 'Reserved'
      el.hudSlotD.disabled = true
      el.hudSlotD.classList.add('is-placeholder')
      el.hudSlotD.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    }
  },

  setArrowBarrageActive(active) {
    el.hudSlotC?.classList.toggle('is-arrow-barrage-active', active)
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

  /** Slot B — Ranger Poison Arrow (2nd unlock). Triple Volley uses slot C. */
  setPoisonArrowShotBtn(visible, manaCost = 12) {
    if (!el.hudSlotB) return
    el.hudSlotB.classList.remove('is-poison-arrow-shot', 'is-poison-arrow-shot-active', 'is-blinding-light', 'is-blinding-light-active')
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

  /** Slot A — Engineer construct / relocate / upgrade */
  setEngineerConstructBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove('is-slam', 'is-slam-active', 'is-ricochet', 'is-ricochet-active')
    if (visible) {
      el.hudSlotA.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">🏗️</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotA.title    = `Construct / upgrade turret (${manaCost} mana)`
      el.hudSlotA.disabled = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-engineer-construct')
    } else if (el.hudSlotA.classList.contains('is-engineer-construct')) {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-engineer-construct')
    }
  },

  /** Slot B — Engineer Tesla (optional upgrade) */
  setEngineerTeslaBtn(visible, manaCost = 10, alreadyTesla = false) {
    if (!el.hudSlotB) return
    if (!visible) {
      if (el.hudSlotB.classList.contains('is-engineer-tesla')) {
        el.hudSlotB.textContent = '···'
        el.hudSlotB.title       = 'Reserved'
        el.hudSlotB.disabled    = true
        el.hudSlotB.classList.add('is-placeholder')
        el.hudSlotB.classList.remove('is-engineer-tesla')
      }
      return
    }
    if (alreadyTesla) {
      el.hudSlotB.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">⚡</span>
          <span class="ability-btn-cost">✓</span>
        </span>`
      el.hudSlotB.title    = 'Tesla Tower active'
      el.hudSlotB.disabled = true
      el.hudSlotB.classList.remove('is-placeholder', 'is-poison-arrow-shot', 'is-blinding-light')
      el.hudSlotB.classList.add('is-engineer-tesla')
      return
    }
    el.hudSlotB.innerHTML = `
      <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
        <span class="ability-btn-emoji" aria-hidden="true">⚡</span>
        <span class="ability-btn-cost">${manaCost}</span>
      </span>`
    el.hudSlotB.title    = `Tesla Tower (${manaCost} mana)`
    el.hudSlotB.disabled = false
    el.hudSlotB.classList.remove('is-placeholder', 'is-poison-arrow-shot', 'is-blinding-light')
    el.hudSlotB.classList.add('is-engineer-tesla')
  },

  setEngineerPlaceMode(active) {
    document.getElementById('grid-container')?.classList.toggle('engineer-place-mode', active)
  },

  setDivineLightBtn(visible, manaCost = 10) {
    if (!el.hudSlotC) return
    el.hudSlotC.classList.remove('is-divine-light', 'is-divine-light-active')
    if (visible) {
      el.hudSlotC.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--divine-light">
          <img src="assets/sprites/abilities/ricochet-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/divine-light-badge.jpg" class="ability-btn-badge" alt="Divine Light" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotC.title    = `Divine Light — smite an enemy or heal 10% HP (${manaCost} mana)`
      el.hudSlotC.disabled = false
      el.hudSlotC.classList.remove('is-placeholder')
      el.hudSlotC.classList.add('is-divine-light')
    } else if (el.hudSlotC.classList.contains('is-divine-light')) {
      el.hudSlotC.textContent = '···'
      el.hudSlotC.title       = 'Reserved'
      el.hudSlotC.disabled    = true
      el.hudSlotC.classList.add('is-placeholder')
    }
  },

  setDivineLightActive(active) {
    el.hudSlotC?.classList.toggle('is-divine-light-active', active)
    document.getElementById('hud-portrait-wrap')?.classList.toggle('divine-light-target', active)
  },

  setTearyEyes(turns) {
    const btn = document.getElementById('hud-teary-eyes')
    if (!btn) return
    const n = Number(turns)
    const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
    if (v < 1) {
      btn.classList.add('hidden')
      btn.textContent = '💧'
      return
    }
    btn.classList.remove('hidden')
    btn.textContent = `💧${v}`
  },

  setFreezingHit(stacks) {
    const btn     = document.getElementById('hud-freezing-hit')
    const overlay = document.getElementById('freeze-overlay')
    const v = Math.max(0, Math.floor(Number(stacks) || 0))
    // HUD badge
    if (btn) {
      if (v < 1) {
        btn.classList.add('hidden')
        btn.textContent = '🧊'
      } else {
        btn.classList.remove('hidden')
        btn.textContent = `🧊${v}`
      }
    }
    // Screen border overlay
    if (overlay) {
      if (v < 1) {
        overlay.classList.add('hidden')
        overlay.className = 'freeze-overlay hidden'
      } else {
        overlay.className = `freeze-overlay stacks-${Math.min(v, 5)}`
      }
    }
  },

  setPlayerPoison(stacks) {
    const btn     = document.getElementById('hud-player-poison')
    const overlay = document.getElementById('player-poison-overlay')
    const v = Math.max(0, Math.floor(Number(stacks) || 0))
    if (btn) {
      if (v < 1) { btn.classList.add('hidden'); btn.textContent = '☠️' }
      else        { btn.classList.remove('hidden'); btn.textContent = `☠️${v}` }
    }
    if (overlay) {
      if (v < 1) { overlay.className = 'player-poison-overlay hidden' }
      else        { overlay.className = `player-poison-overlay stacks-${Math.min(v, 5)}` }
    }
  },

  setCorruption(stacks) {
    const btn     = document.getElementById('hud-corruption')
    const overlay = document.getElementById('corruption-overlay')
    const v = Math.max(0, Math.floor(Number(stacks) || 0))
    if (btn) {
      if (v < 1) { btn.classList.add('hidden'); btn.textContent = '☣️' }
      else        { btn.classList.remove('hidden'); btn.textContent = `☣️${v}` }
    }
    if (overlay) {
      if (v < 1) { overlay.className = 'corruption-overlay hidden' }
      else        { overlay.className = `corruption-overlay stacks-${Math.min(v, 5)}` }
    }
  },

  setBurnOverlay(stacks) {
    const btn     = document.getElementById('hud-burn')
    const overlay = document.getElementById('burn-overlay')
    const v = Math.max(0, Math.floor(Number(stacks) || 0))
    if (btn) {
      if (v < 1) { btn.classList.add('hidden'); btn.textContent = '🔥' }
      else        { btn.classList.remove('hidden'); btn.textContent = `🔥${v}` }
    }
    if (overlay) {
      if (v < 1) { overlay.className = 'burn-overlay hidden' }
      else        { overlay.className = `burn-overlay stacks-${Math.min(v, 3)}` }
    }
  },

  setBloodOverlay(active) {
    const el = document.getElementById('blood-overlay')
    if (!el) return
    if (active) {
      el.classList.remove('hidden')
      el.classList.add('active')
    } else {
      el.classList.add('hidden')
      el.classList.remove('active')
    }
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

  spawnArrowRain(tileEls, durationMs = 1200) {
    const ts = Date.now()
    tileEls.forEach(tileEl => {
      if (!tileEl) return
      const img = document.createElement('img')
      img.src = `assets/sprites/effects/arrow-rain.gif?t=${ts}`
      img.className = 'arrow-rain-overlay'
      tileEl.appendChild(img)
      setTimeout(() => img.remove(), durationMs)
    })
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
    const id = characterId === 'ranger'
      ? 'ranger'
      : characterId === 'engineer'
        ? 'engineer'
        : characterId === 'mage'
          ? 'mage'
          : characterId === 'vampire'
            ? 'vampire'
            : 'warrior'
    el.hudCharacterId = id
    const isRanger = id === 'ranger'
    el.hudPortraitWrap.classList.toggle('is-ranger', isRanger)
    el.hudPortraitWrap.classList.toggle('is-engineer', id === 'engineer')
    if (el.hudPortraitImg) {
      el.hudPortraitImg.src = PORTRAIT_ANIM[id].idle
    }
  },

  // State: 'idle' | 'attack' | 'hit' | 'run' | 'death'
  setPortraitAnim(state) {
    if (!el.hudPortraitImg) return
    const id  = el.hudCharacterId === 'ranger'
      ? 'ranger'
      : el.hudCharacterId === 'engineer'
        ? 'engineer'
        : el.hudCharacterId === 'mage'
          ? 'mage'
          : el.hudCharacterId === 'vampire'
            ? 'vampire'
            : 'warrior'
    const MAP = PORTRAIT_ANIM[id]
    if (MAP && MAP[state]) el.hudPortraitImg.src = MAP[state]
  },

  updateGold(amount) {
    el.goldValue.textContent = amount
  },

  updateGoldenKeys(count) {
    const n = Number(count) || 0
    if (el.keyValue) el.keyValue.textContent = n
    const show = n > 0
    if (el.keyDisplay) el.keyDisplay.classList.toggle('hidden', !show)
    if (el.keySlotPlaceholder) el.keySlotPlaceholder.classList.toggle('hidden', show)
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
  runFloorTransition(_totalMs, mid, floorNumber) {
    const grid = el.grid
    const wrap = document.getElementById('grid-container')
    const banner = el.floorBanner
    const bannerText = el.floorBannerText

    const SLIDE_OUT_MS = 380
    const PAUSE_MS     = 160
    const SLIDE_IN_MS  = 420
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

    wrap?.classList.add('floor-transition-active')
    wrap?.classList.add('floor-transition-clipped')
    grid.style.pointerEvents = 'none'

    // Slide current grid upward and out
    grid.style.transition = `transform ${SLIDE_OUT_MS}ms cubic-bezier(0.4, 0, 1, 1)`
    grid.style.transform   = 'rotateX(4deg) translateY(-115%)'

    return new Promise(resolve => {
      setTimeout(() => {
        // Show floor banner
        if (floorNumber != null && banner && bannerText) {
          bannerText.textContent = `Floor ${floorNumber}`
          banner.classList.remove('hidden')
          banner.setAttribute('aria-hidden', 'false')
          requestAnimationFrame(() => banner.classList.add('is-visible'))
        }

        // Build new floor while grid is offscreen
        mid()

        // Snap new grid to below the viewport
        grid.style.transition = 'none'
        grid.style.transform  = 'rotateX(4deg) translateY(115%)'

        requestAnimationFrame(() => requestAnimationFrame(() => {
          // Slide new grid up into place
          grid.style.transition = `transform ${SLIDE_IN_MS}ms cubic-bezier(0, 0, 0.3, 1)`
          grid.style.transform  = 'rotateX(4deg) translateY(0)'

          setTimeout(() => {
            // Restore defaults — CSS rule takes over rotateX again
            grid.style.transition   = ''
            grid.style.transform    = ''
            grid.style.pointerEvents = ''
            wrap?.classList.remove('floor-transition-clipped')
            hideFloorBanner().then(() => {
              wrap?.classList.remove('floor-transition-active')
              resolve()
            })
          }, SLIDE_IN_MS)
        }))
      }, SLIDE_OUT_MS + PAUSE_MS)
    })
  },

  // ── Float text ───────────────────────────────

  spawnFloat(tileEl, text, type) {
    if (!tileEl) return
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
    tileEl.classList.remove('active-combat', 'combat-engaged', 'enemy-alive', 'is-enemy')
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
    tileEl.classList.remove('active-combat', 'combat-engaged', 'enemy-alive')
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

  /** Red border — player is in combat commitment with this living enemy. */
  setTileCombatEngaged(tileEl, isEngaged) {
    tileEl.classList.toggle('combat-engaged', !!isEngaged)
  },

  /**
   * Live enemy HP on the tile. Central place to fix NaN/undefined drift for every enemy type
   * (boss, normal, summons) — callers may pass bad values; we sync `tile.enemyData.currentHP`.
   */
  updateEnemyHP(tileEl, newHP) {
    const hpEl = tileEl?.querySelector('.stat-hp')
    if (!hpEl) return
    const row = tileEl?.dataset?.row
    const col = tileEl?.dataset?.col
    const tile =
      row != null && col != null ? TileEngine.getTile(Number(row), Number(col)) : null
    const e = tile?.enemyData
    let n = Number(newHP)
    if (e && !Number.isFinite(n)) {
      const maxHp = Number(e.hp)
      const cur = Number(e.currentHP)
      n = Number.isFinite(cur)
        ? Math.max(0, Math.floor(cur))
        : (Number.isFinite(maxHp) ? maxHp : 1)
    } else if (!Number.isFinite(n)) {
      n = 0
    } else {
      n = Math.max(0, Math.floor(n))
    }
    if (e) e.currentHP = n
    hpEl.textContent = `❤️ ${n}`
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

  spawnCannonShot(fromTileEl, toTileEl) {
    const grid = document.getElementById('grid-container')
    if (!grid || !fromTileEl || !toTileEl) return
    const gRect = grid.getBoundingClientRect()
    const aRect = fromTileEl.getBoundingClientRect()
    const bRect = toTileEl.getBoundingClientRect()
    const ax = aRect.left + aRect.width  / 2 - gRect.left
    const ay = aRect.top  + aRect.height / 2 - gRect.top
    const bx = bRect.left + bRect.width  / 2 - gRect.left
    const by = bRect.top  + bRect.height / 2 - gRect.top

    const ball = document.createElement('div')
    ball.className = 'cannon-ball'
    ball.style.cssText = `left:${ax}px;top:${ay}px;`
    grid.appendChild(ball)

    // Animate via Web Animations API
    const duration = Math.min(300, 80 + Math.sqrt((bx-ax)**2 + (by-ay)**2) * 0.6)
    ball.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)',   offset: 0 },
        { transform: 'translate(-50%,-50%) scale(1.2)', offset: 0.3 },
        { transform: `translate(calc(${bx-ax}px - 50%), calc(${by-ay}px - 50%)) scale(0.7)`, offset: 1 },
      ],
      { duration, easing: 'ease-in', fill: 'forwards' }
    ).finished.then(() => ball.remove())
  },

  spawnTeslaArc(fromTileEl, toTileEl) {
    const grid = document.getElementById('grid-container')
    if (!grid || !fromTileEl || !toTileEl) return
    const gRect = grid.getBoundingClientRect()
    const aRect = fromTileEl.getBoundingClientRect()
    const bRect = toTileEl.getBoundingClientRect()
    const ax = aRect.left + aRect.width  / 2 - gRect.left
    const ay = aRect.top  + aRect.height / 2 - gRect.top
    const bx = bRect.left + bRect.width  / 2 - gRect.left
    const by = bRect.top  + bRect.height / 2 - gRect.top
    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    const arc = document.createElement('div')
    arc.className = 'tesla-arc'
    arc.style.cssText = `width:${len}px;left:${ax}px;top:${ay}px;transform:rotate(${angle}deg);`
    grid.appendChild(arc)
    setTimeout(() => arc.remove(), 400)
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

  renderBackpack(inventory, itemRegistry, onUse, onHold, replaceMode = false) {
    const grid = document.getElementById('backpack-grid')
    if (!grid) return
    const SLOTS = 9
    grid.innerHTML = ''
    grid.classList.toggle('replace-mode', replaceMode)

    // Build a slot for each occupied item, then fill remainder with empty slots
    const filled = inventory.map(entry => {
      const item = itemRegistry[entry.id]
      if (!item) return null
      const slot = document.createElement('div')
      const rarity = item.rarity ?? 'common'
      slot.className = `backpack-slot occupied rarity-${rarity}${replaceMode ? ' replace-target' : ''}`
      const bpIcon = item.spriteSrc
        ? `<img class="bp-item-img" src="${item.spriteSrc}" alt="${item.name}">`
        : `<span class="bp-item-emoji">${item.icon}</span>`
      slot.innerHTML = `
        ${bpIcon}
        ${entry.qty > 1 ? `<span class="bp-item-qty">${entry.qty}</span>` : ''}
        ${replaceMode ? '<div class="bp-replace-badge">Replace</div>' : ''}
      `

      if (replaceMode) {
        slot.addEventListener('click', () => onUse(entry.id))
      } else {
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
      }

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
  setLevelUpSubtitle(text) {
    const sub = document.getElementById('level-up-subtitle')
    if (sub) sub.textContent = text ?? 'Choose an ability'
  },

  showLevelUpOverlay(choices, onPick) {
    el.abilityChoices.innerHTML = ''
    for (const choice of choices) {
      const card = document.createElement('div')
      card.className = 'ability-card'
      if (choice.id != null) card.dataset.abilityId = String(choice.id)
      const hasSprite = choice.iconSrc && choice.iconBgSrc
      const iconHtml = hasSprite
        ? `<div class="levelup-ability-icon-wrap">
             <img class="levelup-ability-bg" src="${choice.iconBgSrc}" alt="" draggable="false" />
             <img class="levelup-ability-badge" src="${choice.iconSrc}" alt="" draggable="false" />
           </div>`
        : (choice.icon ?? '')
      const iconClass = `ability-icon${hasSprite ? ' ability-icon--sprite' : ''}`
      const tagHtml = choice.tag ? `<span class="ability-tag">${choice.tag}</span>` : ''
      card.innerHTML = `
        <div class="${iconClass}">${iconHtml}</div>
        <div class="ability-info">
          <div class="ability-name">${tagHtml}${choice.name}</div>
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

  /** First-time enemy discovery — Pokémon-style card; resolves when dismissed. */
  showBestiaryDiscovery(enemyId) {
    return new Promise((resolve) => {
      const def = ENEMY_DEFS[enemyId]
      if (!def || !el.bestiaryDiscoveryOverlay) {
        resolve()
        return
      }
      _fillBestiaryCreatureParts({
        gif: el.bestiaryDiscoveryGif,
        emoji: el.bestiaryDiscoveryEmoji,
        name: el.bestiaryDiscoveryName,
        type: el.bestiaryDiscoveryType,
        blurb: el.bestiaryDiscoveryBlurb,
      }, def, enemyId)

      const close = () => {
        el.bestiaryDiscoveryOverlay.classList.add('hidden')
        el.bestiaryDiscoveryOverlay.setAttribute('aria-hidden', 'true')
        document.body.classList.remove('bestiary-discovery-open')
        el.bestiaryDiscoveryOk?.removeEventListener('click', close)
        el.bestiaryDiscoveryBackdrop?.removeEventListener('click', close)
        resolve()
      }

      el.bestiaryDiscoveryOverlay.classList.remove('hidden')
      el.bestiaryDiscoveryOverlay.setAttribute('aria-hidden', 'false')
      document.body.classList.add('bestiary-discovery-open')
      el.bestiaryDiscoveryOk?.addEventListener('click', close)
      el.bestiaryDiscoveryBackdrop?.addEventListener('click', close)
      EventBus.emit('audio:play', { sfx: 'levelup' })
    })
  },

  /** First-time war banner tutorial — same shell as creature discovery. */
  showWarBannerIntro() {
    return new Promise((resolve) => {
      const info = TILE_BLURBS.war_banner
      if (!info || !el.bestiaryDiscoveryOverlay) {
        resolve()
        return
      }
      if (el.bestiaryDiscoveryGif) {
        el.bestiaryDiscoveryGif.removeAttribute('src')
        el.bestiaryDiscoveryGif.classList.add('hidden')
      }
      if (el.bestiaryDiscoveryEmoji) {
        el.bestiaryDiscoveryEmoji.textContent = info.emoji ?? '🚩'
        el.bestiaryDiscoveryEmoji.classList.remove('hidden')
      }
      if (el.bestiaryDiscoveryName) el.bestiaryDiscoveryName.textContent = info.label
      if (el.bestiaryDiscoveryType) el.bestiaryDiscoveryType.textContent = 'Dungeon hazard'
      if (el.bestiaryDiscoveryBlurb) {
        el.bestiaryDiscoveryBlurb.textContent = info.introBlurb ?? info.blurb
      }

      const close = () => {
        el.bestiaryDiscoveryOverlay.classList.add('hidden')
        el.bestiaryDiscoveryOverlay.setAttribute('aria-hidden', 'true')
        document.body.classList.remove('bestiary-discovery-open')
        el.bestiaryDiscoveryOk?.removeEventListener('click', close)
        el.bestiaryDiscoveryBackdrop?.removeEventListener('click', close)
        resolve()
      }

      el.bestiaryDiscoveryOverlay.classList.remove('hidden')
      el.bestiaryDiscoveryOverlay.setAttribute('aria-hidden', 'false')
      document.body.classList.add('bestiary-discovery-open')
      el.bestiaryDiscoveryOk?.addEventListener('click', close)
      el.bestiaryDiscoveryBackdrop?.addEventListener('click', close)
      EventBus.emit('audio:play', { sfx: 'levelup' })
    })
  },

  /** Full-size creature card from Bestiary menu (above list). */
  showBestiaryDetail(enemyId) {
    const def = ENEMY_DEFS[enemyId]
    if (!def || !el.bestiaryDetailOverlay) return
    _fillBestiaryCreatureParts({
      gif: el.bestiaryDetailGif,
      emoji: el.bestiaryDetailEmoji,
      name: el.bestiaryDetailName,
      type: el.bestiaryDetailType,
      blurb: el.bestiaryDetailBlurb,
    }, def, enemyId)
    el.bestiaryDetailOverlay.classList.remove('hidden')
    el.bestiaryDetailOverlay.setAttribute('aria-hidden', 'false')
    document.body.classList.add('bestiary-detail-open')
  },

  showBestiaryPanel(save) {
    if (!el.bestiaryOverlay || !el.bestiaryList) return
    const ids = Bestiary.sortedSeenIds(save)
    el.bestiaryList.innerHTML = ''
    if (ids.length === 0) {
      const p = document.createElement('p')
      p.className = 'bestiary-empty'
      p.textContent = 'No creatures catalogued yet. Reveal enemies in the dungeon to add them here.'
      el.bestiaryList.appendChild(p)
    } else {
      for (const id of ids) {
        const def = ENEMY_DEFS[id]
        if (!def) continue
        const sprites = ENEMY_SPRITES[id]
        const thumb = sprites?.idle ? `${MONSTER_ICONS_BASE}${sprites.idle}` : null
        const ty = def.type ?? 'unknown'
        const typeLabel = ty.charAt(0).toUpperCase() + ty.slice(1)
        const artHtml = thumb
          ? `<img src="${thumb}?t=${Date.now()}" alt="" loading="lazy">`
          : `<span class="bestiary-grid-card-emoji">${def.emoji ?? '?'}</span>`
        const card = document.createElement('button')
        card.type = 'button'
        card.className = 'bestiary-grid-card'
        card.innerHTML = `
          <div class="bestiary-grid-card-art">${artHtml}</div>
          <div class="bestiary-grid-card-head">
            <h3 class="bestiary-grid-card-name">${def.label}</h3>
            <div class="bestiary-grid-card-type">${typeLabel}</div>
          </div>`
        card.addEventListener('click', () => UI.showBestiaryDetail(id))
        el.bestiaryList.appendChild(card)
      }
    }
    el.bestiaryOverlay.classList.remove('hidden')
  },

  hideBestiaryPanel() {
    el.bestiaryOverlay?.classList.add('hidden')
    el.bestiaryDetailOverlay?.classList.add('hidden')
    el.bestiaryDetailOverlay?.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('bestiary-detail-open')
  },

  // ── Trinket Codex ─────────────────────────────

  /** First-time trinket discovery — resolves when dismissed. */
  showTrinketDiscovery(itemId) {
    return new Promise((resolve) => {
      const def = ITEMS[itemId]
      if (!def || !el.trinketDiscoveryOverlay) { resolve(); return }
      _fillTrinketCard({
        img: el.trinketDiscoveryImg, emoji: el.trinketDiscoveryEmoji,
        rarity: el.trinketDiscoveryRarity, name: el.trinketDiscoveryName,
        blurb: el.trinketDiscoveryBlurb, effects: el.trinketDiscoveryEffects,
      }, def)
      const close = () => {
        el.trinketDiscoveryOverlay.classList.add('hidden')
        el.trinketDiscoveryOverlay.setAttribute('aria-hidden', 'true')
        document.body.classList.remove('trinket-discovery-open')
        el.trinketDiscoveryOk?.removeEventListener('click', close)
        el.trinketDiscoveryBackdrop?.removeEventListener('click', close)
        resolve()
      }
      el.trinketDiscoveryOverlay.classList.remove('hidden')
      el.trinketDiscoveryOverlay.setAttribute('aria-hidden', 'false')
      document.body.classList.add('trinket-discovery-open')
      el.trinketDiscoveryOk?.addEventListener('click', close)
      el.trinketDiscoveryBackdrop?.addEventListener('click', close)
      EventBus.emit('audio:play', { sfx: 'levelup' })
    })
  },

  /** Full trinket card from the Codex panel. */
  showTrinketDetail(itemId) {
    const def = ITEMS[itemId]
    if (!def || !el.trinketDetailOverlay) return
    _fillTrinketCard({
      img: el.trinketDetailImg, emoji: el.trinketDetailEmoji,
      rarity: el.trinketDetailRarity, name: el.trinketDetailName,
      blurb: el.trinketDetailBlurb, effects: el.trinketDetailEffects,
    }, def)
    el.trinketDetailOverlay.classList.remove('hidden')
    el.trinketDetailOverlay.setAttribute('aria-hidden', 'false')
  },

  hideTrinketDetail() {
    el.trinketDetailOverlay?.classList.add('hidden')
    el.trinketDetailOverlay?.setAttribute('aria-hidden', 'true')
  },

  /** Render the Codex panel grouped by rarity, then open it. */
  showTrinketCodexPanel(save) {
    if (!el.trinketCodexOverlay || !el.trinketCodexList) return
    TrinketCodex.ensure(save)
    const seen = save.trinketsSeen
    el.trinketCodexList.innerHTML = ''

    const RARITIES = ['common', 'rare', 'legendary', 'merged']
    const RARITY_LABELS = { common: 'Common', rare: 'Rare', legendary: 'Legendary', merged: '⚒️ Forged' }

    let anyShown = false
    for (const rarity of RARITIES) {
      const ids = seen.filter(id => ITEMS[id]?.rarity === rarity)
      if (ids.length === 0) continue
      anyShown = true

      const header = document.createElement('h3')
      header.className = `trinket-codex-section-header trinket-rarity-${rarity}`
      header.textContent = RARITY_LABELS[rarity]
      el.trinketCodexList.appendChild(header)

      const grid = document.createElement('div')
      grid.className = 'trinket-codex-grid'
      for (const id of ids) {
        const def = ITEMS[id]
        if (!def) continue
        const artHtml = def.spriteSrc
          ? `<img src="${def.spriteSrc}" alt="" loading="lazy">`
          : `<span class="trinket-codex-card-emoji">${def.icon ?? '?'}</span>`
        const card = document.createElement('button')
        card.type = 'button'
        card.className = `trinket-codex-card trinket-rarity-border-${rarity}`
        card.innerHTML = `
          <div class="trinket-codex-card-art">${artHtml}</div>
          <div class="trinket-codex-card-name">${def.name}</div>`
        card.addEventListener('click', () => UI.showTrinketDetail(id))
        grid.appendChild(card)
      }
      el.trinketCodexList.appendChild(grid)
    }

    if (!anyShown) {
      const p = document.createElement('p')
      p.className = 'bestiary-empty'
      p.textContent = 'No trinkets discovered yet. Find them in chests and magic chests during your runs.'
      el.trinketCodexList.appendChild(p)
    }

    el.trinketCodexOverlay.classList.remove('hidden')
  },

  hideTrinketCodexPanel() {
    el.trinketCodexOverlay?.classList.add('hidden')
    el.trinketDetailOverlay?.classList.add('hidden')
    el.trinketDetailOverlay?.setAttribute('aria-hidden', 'true')
  },

  // ── Forge overlay ─────────────────────────────────────────────

  showForgeOverlay(recipes, itemDefs, onForge, onLeave) {
    const ov   = el.forgeOverlay
    const list = el.forgeRecipeList
    if (!ov || !list) return
    list.innerHTML = ''

    for (const r of recipes) {
      const defA   = itemDefs[r.ingredientA]
      const defB   = itemDefs[r.ingredientB]
      const defRes = itemDefs[r.result]
      if (!defA || !defB || !defRes) continue

      const row = document.createElement('div')
      row.className = `forge-recipe${r.canForge ? ' forge-can-forge' : ' forge-cannot-forge'}`

      const iconA  = defA.spriteSrc  ? `<img src="${defA.spriteSrc}"   alt="" class="forge-ing-img">` : `<span class="forge-ing-emoji">${defA.icon ?? '?'}</span>`
      const iconB  = defB.spriteSrc  ? `<img src="${defB.spriteSrc}"   alt="" class="forge-ing-img">` : `<span class="forge-ing-emoji">${defB.icon ?? '?'}</span>`
      const iconR  = defRes.spriteSrc ? `<img src="${defRes.spriteSrc}" alt="" class="forge-ing-img">` : `<span class="forge-ing-emoji">${defRes.icon ?? '?'}</span>`

      const missingParts = []
      if (!r.hasA) missingParts.push(defA.name)
      if (!r.hasB && !r.isDupe) missingParts.push(defB.name)
      if (r.isDupe && !r.hasA) missingParts.push(`2× ${defA.name}`)
      const missingHtml = missingParts.length
        ? `<div class="forge-missing">Missing: ${missingParts.join(', ')}</div>`
        : ''
      const btnHtml = r.canForge
        ? `<button class="forge-btn event-btn" data-recipe="${r.id}">⚒️ Forge</button>`
        : `<button class="forge-btn event-btn forge-btn-disabled" disabled>⚒️ Forge</button>`

      row.innerHTML = `
        <div class="forge-ingredients">
          <span class="forge-ing">${iconA}<span class="forge-ing-name">${defA.name}</span></span>
          <span class="forge-plus">+</span>
          <span class="forge-ing">${iconB}<span class="forge-ing-name">${r.isDupe ? defA.name : defB.name}</span></span>
        </div>
        <div class="forge-arrow">→</div>
        <div class="forge-result">
          <span class="forge-result-icon">${iconR}</span>
          <div class="forge-result-text">
            <div class="forge-result-name">${defRes.name}</div>
            <div class="forge-result-hint">${r.hint ?? ''}</div>
          </div>
        </div>
        ${missingHtml}
        ${btnHtml}
      `

      const btn = row.querySelector('.forge-btn')
      if (btn && r.canForge) {
        btn.addEventListener('click', () => onForge(r.id))
      }
      list.appendChild(row)
    }

    // Leave buttons (top + bottom)
    for (const id of ['#forge-leave-btn-top', '#forge-leave-btn']) {
      const btn = ov.querySelector(id)
      if (btn) {
        const fresh = btn.cloneNode(true)
        btn.replaceWith(fresh)
        fresh.addEventListener('click', onLeave)
      }
    }

    ov.classList.remove('hidden')
  },

  hideForgeOverlay() {
    el.forgeOverlay?.classList.add('hidden')
  },

  // ── Event overlays ────────────────────────────

  // ── Sub-floor ─────────────────────────────────────────────

  showSubFloor(sf, onTileTap, onHold) {
    const ov = el.subFloorOverlay
    const gridEl = el.subFloorGrid
    if (!ov || !gridEl) return

    const META = {
      mob_den:          { icon: '💀', title: 'Monster Den',       subtitle: 'One type. Many claws.' },
      boss_vault:       { icon: '☠️', title: 'Boss Vault',        subtitle: 'A single horror guards the treasure.' },
      treasure_vault:   { icon: '💎', title: 'Treasure Vault',    subtitle: 'Riches — if you can bear the cost.' },
      shrine:           { icon: '🗿', title: 'Ancient Shrine',    subtitle: 'An offering awaits.' },
      ambush:              { icon: '⚠️', title: 'Hidden Chamber',       subtitle: 'Something feels wrong…' },
      collapsed_tunnel:    { icon: '🪨', title: 'Collapsed Tunnel',     subtitle: 'Unstable ground. Exit at any time.' },
      cartographers_cache: { icon: '📜', title: "Cartographer's Cache", subtitle: 'A map waits in the rubble.' },
      toxic_gas:           { icon: '☠️', title: 'Toxic Gas Chamber',    subtitle: 'Find the exit before the gas kills you.' },
    }
    const meta = META[sf.type] ?? { icon: '🕳️', title: 'Hidden Chamber', subtitle: '' }
    document.getElementById('sub-floor-icon').textContent  = meta.icon
    document.getElementById('sub-floor-title').textContent = meta.title
    document.getElementById('sub-floor-subtitle').textContent = meta.subtitle

    // Build grid using the unified TileEngine renderer so the sub-floor matches
    // the main grid's DOM, classes, icons, threat clues, and fallbacks.
    TileEngine.renderTileGridInto(gridEl, sf.tiles, onTileTap, onHold)

    ov.classList.remove('hidden')
    ov.removeAttribute('aria-hidden')
  },

  flipSubFloorTile(tile) {
    if (!tile.element) return
    tile.element.classList.add('revealed')
    if (tile.enemyData && !tile.enemyData._slain) tile.element.classList.add('enemy-alive')
  },

  markSubFloorTileReachable(tile) {
    tile.element?.classList.add('reachable')
  },

  lockSubFloorTile(tile) {
    tile.element?.classList.add('locked')
    tile.element?.classList.remove('reachable')
  },

  unlockSubFloorTile(tile) {
    tile.element?.classList.remove('locked')
  },

  markSubFloorTileSlain(tile) {
    if (!tile.element) return
    this.markTileSlain(tile.element)
    tile.element.classList.add('sf-tile-slain')
  },

  updateSubFloorEnemyHP(tile) {
    if (!tile.element || !tile.enemyData) return
    const hpEl = tile.element.querySelector('.stat-hp')
    if (hpEl) hpEl.textContent = `❤️ ${Math.max(0, tile.enemyData.currentHP ?? 0)}`
  },

  setSubFloorMessage(msg) {
    if (el.subFloorMessage) el.subFloorMessage.textContent = msg
  },

  hideSubFloor() {
    el.subFloorOverlay?.classList.add('hidden')
    el.subFloorOverlay?.setAttribute('aria-hidden', 'true')
    if (el.subFloorGrid) el.subFloorGrid.innerHTML = ''
    el.shrineOverlay?.classList.add('hidden')
  },

  hideEventOverlays() {
    ;[el.merchantShopOverlay, el.gamblerOverlay, el.tripleChestOverlay, el.storyEventOverlay, el.trinketTraderOverlay]
      .forEach(o => o?.classList.add('hidden'))
    // Story: outcome "Continue" can outlive the overlay if dismissed without clicking (e.g. bot / session close).
    const storyContinue = el.storyEventOverlay?.querySelector('#story-event-continue')
    if (storyContinue) {
      storyContinue.classList.add('hidden')
      storyContinue.onclick = null
    }
  },

  // Merchant shop
  showMerchantShop(playerGold, items, onBuy, onLeave) {
    const ov = el.merchantShopOverlay
    if (!ov) return
    const goldEl = ov.querySelector('#merchant-shop-gold')
    if (goldEl) goldEl.textContent = playerGold
    const list = ov.querySelector('#merchant-shop-list')
    if (list) {
      list.innerHTML = items.map(item => `
        <div class="merchant-shop-item" data-id="${item.id}">
          <div class="merchant-shop-item-name">${item.label}</div>
          <button class="menu-btn secondary merchant-buy-btn" data-id="${item.id}" ${playerGold < item.price ? 'disabled' : ''}>
            Buy — ${item.price}🪙
          </button>
        </div>
      `).join('')
      list.querySelectorAll('.merchant-buy-btn').forEach(btn => {
        btn.onclick = () => onBuy(btn.dataset.id)
      })
    }
    ov.querySelector('#merchant-shop-leave')?.addEventListener('click', onLeave, { once: true })
    ov.classList.remove('hidden')
  },

  refreshMerchantShopGold(gold) {
    const ov = el.merchantShopOverlay
    if (!ov) return
    const goldEl = ov.querySelector('#merchant-shop-gold')
    if (goldEl) goldEl.textContent = gold
    ov.querySelectorAll('.merchant-buy-btn').forEach(btn => {
      const price = parseInt(btn.textContent.match(/\d+/)?.[0] ?? '0')
      btn.disabled = gold < price
    })
  },

  // Gambler — physics dice
  showGamblerEvent(playerGold, onBetAndRoll, onWalkAway) {
    const ov = el.gamblerOverlay
    if (!ov) return

    // Reset all phases
    ov.querySelector('#gambler-phase-bet').classList.remove('hidden')
    ov.querySelector('#gambler-phase-roll').classList.add('hidden')
    ov.querySelector('#gambler-phase-outcome').classList.add('hidden')

    // Build bet buttons
    const BET_AMOUNTS = [5, 10, 25]
    const btnWrap = ov.querySelector('#gambler-bet-buttons')
    if (btnWrap) {
      btnWrap.innerHTML = ''
      for (const amt of BET_AMOUNTS) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'menu-btn gambler-bet-btn'
        btn.textContent = `${amt}🪙`
        btn.disabled = playerGold < amt
        btn.addEventListener('click', () => onBetAndRoll(amt), { once: true })
        btnWrap.appendChild(btn)
      }
    }

    ov.querySelector('#gambler-walk-away')?.addEventListener('click', onWalkAway, { once: true })
    ov.classList.remove('hidden')
  },

  /** Switch gambler to roll phase and return a function to trigger the physics roll. */
  gamblerShowRollPhase(onRollComplete) {
    const ov = el.gamblerOverlay
    if (!ov) return null
    ov.querySelector('#gambler-phase-bet').classList.add('hidden')
    const rollPhase = ov.querySelector('#gambler-phase-roll')
    rollPhase.classList.remove('hidden')

    const canvas  = ov.querySelector('#gambler-canvas')
    const rollBtn = ov.querySelector('#gambler-roll-btn')
    const hint    = ov.querySelector('#gambler-roll-hint')

    // In headless/bot mode, skip Matter.js physics (rAF doesn't run) and resolve instantly
    const isHeadlessBot = !!(window.__balanceBotRunning || window.__testBotOngoing || navigator.webdriver)

    if (isHeadlessBot) {
      let rolled = false
      const doRoll = () => {
        if (rolled) return
        rolled = true
        rollBtn.disabled = true
        if (hint) hint.textContent = 'Dice are rolling…'
        const r1 = Math.ceil(Math.random() * 6)
        const r2 = Math.ceil(Math.random() * 6)
        setTimeout(() => onRollComplete(r1, r2), 200)
      }
      rollBtn.addEventListener('click', doRoll, { once: true })
      return
    }

    // Lazy-import so Matter.js stays out of the critical path
    import('./DiceRoller.js').then(({ createDiceRoller }) => {
      const roller = createDiceRoller(canvas)
      roller.drawIdle()

      let rolled = false
      const doRoll = () => {
        if (rolled) return
        rolled = true
        rollBtn.disabled = true
        if (hint) hint.textContent = 'Dice are rolling…'
        roller.roll((r1, r2) => {
          roller.destroy()
          onRollComplete(r1, r2)
        })
      }

      rollBtn.addEventListener('click', doRoll, { once: true })
    })
  },

  /** Switch gambler to outcome phase, copying the settled canvas result visually. */
  gamblerShowOutcome(bet, r1, r2, won) {
    const ov = el.gamblerOverlay
    if (!ov) return
    ov.querySelector('#gambler-phase-roll').classList.add('hidden')
    const outcomePhase = ov.querySelector('#gambler-phase-outcome')
    outcomePhase.classList.remove('hidden')

    const total = r1 + r2
    const totalEl   = ov.querySelector('#gambler-outcome-total')
    const textEl    = ov.querySelector('#gambler-outcome-text')

    // Re-render settled dice on the result canvas
    const resultCanvas = ov.querySelector('#gambler-canvas-result')
    if (resultCanvas) {
      import('./DiceRoller.js').then(({ createDiceRoller }) => {
        // Draw single settled frame
        const tmpRoller = createDiceRoller(resultCanvas)
        // Access internals via a quick settled render trick — draw idle then overlay text
        tmpRoller.drawIdle()
        tmpRoller.destroy()
        // Draw the actual result on top
        _drawSettledDice(resultCanvas, r1, r2)
      })
    }

    if (totalEl) {
      totalEl.textContent = `Total: ${total}`
      totalEl.className = `gambler-outcome-total ${won ? 'outcome-win' : 'outcome-lose'}`
    }
    if (textEl) {
      textEl.textContent = won
        ? `You rolled ${r1} + ${r2} = ${total}. You win ${bet}🪙!`
        : `You rolled ${r1} + ${r2} = ${total}. Better luck next time.`
      textEl.className = `gambler-outcome-text ${won ? 'outcome-win' : 'outcome-lose'}`
    }
  },

  // Triple chest
  showTripleChestEvent(chests, onPick, onLeave) {
    const ov = el.tripleChestOverlay
    if (!ov) return
    const list = ov.querySelector('#triple-chest-list')
    if (list) {
      list.innerHTML = chests.map((_, i) => `
        <button class="triple-chest-btn menu-btn primary" data-idx="${i}">
          <img src="assets/sprites/Items/chest-closed.png" class="triple-chest-img" alt="Chest">
        </button>
      `).join('')
      list.querySelectorAll('.triple-chest-btn').forEach(btn => {
        btn.onclick = () => {
          ov.classList.add('hidden')
          onPick(parseInt(btn.dataset.idx))
        }
      })
    }
    ov.querySelector('#triple-chest-leave')?.addEventListener('click', onLeave, { once: true })
    ov.classList.remove('hidden')
  },

  // Story event
  showStoryEvent(scenario, onChoice) {
    const ov = el.storyEventOverlay
    if (!ov) return
    const continueEl = ov.querySelector('#story-event-continue')
    if (continueEl) {
      continueEl.classList.add('hidden')
      continueEl.onclick = null
    }
    const titleEl = ov.querySelector('#story-event-title')
    const textEl  = ov.querySelector('#story-event-text')
    const choicesEl = ov.querySelector('#story-event-choices')
    if (titleEl)   titleEl.textContent   = `'${scenario.title}'`
    if (textEl)    textEl.textContent    = scenario.text
    if (choicesEl) {
      choicesEl.innerHTML = scenario.choices.map((c, i) => `
        <button class="menu-btn secondary story-choice-btn" data-idx="${i}">${c.label}</button>
      `).join('')
      choicesEl.querySelectorAll('.story-choice-btn').forEach(btn => {
        btn.onclick = () => {
          const choiceIdx = parseInt(btn.dataset.idx)
          const outcomes  = scenario.choices[choiceIdx].outcomes
          const roll      = Math.random() * 100
          let cumulative  = 0
          let outcomeIdx  = outcomes.length - 1
          for (let i = 0; i < outcomes.length; i++) {
            cumulative += outcomes[i].weight
            if (roll < cumulative) { outcomeIdx = i; break }
          }
          choicesEl.innerHTML = ''
          onChoice(choiceIdx, outcomeIdx)
        }
      })
    }
    ov.classList.remove('hidden')
  },

  // Trinket Trader
  showTrinketTraderEvent(inventory, itemRegistry, onTrade, onLeave) {
    const ov = el.trinketTraderOverlay
    if (!ov) return
    const list   = ov.querySelector('#trinket-trader-list')
    const blurb  = ov.querySelector('#trinket-trader-blurb')
    const leaveBtn = ov.querySelector('#trinket-trader-leave')

    // Filter to tradeable trinkets (passives only — not consumables like potions)
    const tradeable = inventory.filter(entry => {
      const item = itemRegistry[entry.id]
      return item && item.effect?.type?.startsWith('passive')
    })

    if (list) {
      list.innerHTML = ''
      if (tradeable.length === 0) {
        if (blurb) blurb.textContent = 'You have no trinkets to offer. The trader shrugs and steps back into the shadows.'
      } else {
        if (blurb) blurb.textContent = 'A hooded figure offers a glowing exchange — one trinket for another, unknown. Choose what to give up.'
        for (const entry of tradeable) {
          const item = itemRegistry[entry.id]
          if (!item) continue
          const artHtml = item.spriteSrc
            ? `<img src="${item.spriteSrc}" alt="${item.name}">`
            : `<span class="trinket-trader-card-emoji">${item.icon ?? '?'}</span>`
          const rarity = item.rarity ?? 'common'
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = `trinket-trader-card trinket-rarity-border-${rarity}`
          btn.innerHTML = `
            <div class="trinket-trader-card-art">${artHtml}</div>
            <div class="trinket-trader-card-info">
              <div class="trinket-trader-card-name">${item.name}</div>
              <div class="trinket-trader-card-rarity trinket-rarity-${rarity}">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</div>
            </div>
            <div class="trinket-trader-card-action">Trade →</div>`
          btn.addEventListener('click', () => onTrade(entry.id), { once: true })
          list.appendChild(btn)
        }
      }
    }

    if (leaveBtn) {
      leaveBtn.onclick = onLeave
    }
    ov.classList.remove('hidden')
  },

  showStoryOutcome(text, onContinue) {
    const ov = el.storyEventOverlay
    if (!ov) return
    const textEl    = ov.querySelector('#story-event-text')
    const continueEl = ov.querySelector('#story-event-continue')
    if (textEl)    textEl.textContent = text
    if (continueEl) {
      continueEl.classList.remove('hidden')
      continueEl.onclick = () => {
        continueEl.classList.add('hidden')
        ov.classList.add('hidden')
        onContinue()
      }
    }
  },
}

export default UI
