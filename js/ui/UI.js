import { CONFIG } from '../config.js'
import { ITEM_ICONS_BASE, TILE_SLAIN_ICON } from '../data/tileIcons.js'

// UI module — ALL DOM updates happen here. Zero game logic.
// Cache element references once at init(), expose named update functions.

const el = {}  // element cache

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
    el.retreatBar  = document.getElementById('retreat-bar')
    el.grid        = document.getElementById('grid')
    el.levelUpOverlay  = document.getElementById('level-up-overlay')
    el.abilityChoices  = document.getElementById('ability-choices')
    el.runSummary      = document.getElementById('run-summary')
    el.resetBtn        = document.getElementById('reset-btn')
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
    el.hudSlotA           = document.getElementById('hud-btn-slot-a')
    el.hudSlotB           = document.getElementById('hud-btn-slot-b')
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
    if (el.dmgValue) el.dmgValue.textContent = `${low}–${high}`
  },

  setSlamBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    if (visible) {
      el.hudSlotA.innerHTML   = `
        <span class="ability-btn-wrap">
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

  setBlindingLightBtn(visible, manaCost = 10) {
    if (!el.hudSlotB) return
    if (visible) {
      el.hudSlotB.innerHTML   = `
        <span class="ability-btn-wrap">
          <img src="assets/sprites/abilities/blinding-light.jpg" class="ability-btn-img" alt="Blinding Light" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotB.title       = `Blinding Light — stun an enemy for 2 turns (${manaCost} mana)`
      el.hudSlotB.disabled    = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-blinding-light')
    } else {
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
    const isRanger = characterId === 'ranger'
    el.hudPortraitWrap.classList.toggle('is-ranger', isRanger)
    if (el.hudPortraitImg) {
      el.hudPortraitImg.src = isRanger
        ? 'assets/sprites/Heroes/Ranger/__Idle.gif'
        : 'assets/sprites/Heroes/Warrior/__Idle.gif'
    }
  },

  // State: 'idle' | 'attack' | 'hit' | 'run' | 'death'
  setPortraitAnim(state) {
    if (!el.hudPortraitImg) return
    const MAP = {
      idle:   'assets/sprites/Heroes/Warrior/__Idle.gif',
      attack: 'assets/sprites/Heroes/Warrior/__AttackCombo2hit.gif',
      hit:    'assets/sprites/Heroes/Warrior/__Hit.gif',
      run:    'assets/sprites/Heroes/Warrior/__Run.gif',
      death:  'assets/sprites/Heroes/Warrior/__DeathNoMovement.gif',
    }
    if (MAP[state]) el.hudPortraitImg.src = MAP[state]
  },

  updateGold(amount) {
    el.goldValue.textContent = amount
  },

  updateXP(current, needed) {
    const pct = Math.min(100, (current / needed) * 100)
    el.xpBar.style.width = pct + '%'
  },

  updateFloor(floor) {
    const names = CONFIG.floorNames
    const name = names[(floor - 1) % names.length]
    el.floorInfo.textContent = `Floor ${floor} — ${name}`
  },

  // ── Messages ─────────────────────────────────

  setMessage(msg, isAlert = false) {
    el.messageBox.textContent = msg
    el.messageBox.classList.toggle('alert', isAlert)
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
    el.retreatBar.classList.remove('hidden')
  },

  hideRetreat() {
    el.retreatBar.classList.add('hidden')
  },

  // ── Grid ─────────────────────────────────────

  getGridEl() {
    return el.grid
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

  markTileSlain(tileEl) {
    tileEl.classList.remove('active-combat', 'enemy-alive')
    tileEl.style.pointerEvents = ''
    const front = tileEl.querySelector('.tile-front')
    front.className = 'tile-front type-slain'
    const wrap = front.querySelector('.tile-icon-wrap')
    if (wrap) {
      if (TILE_SLAIN_ICON) {
        wrap.classList.remove('tile-icon-fallback')
        wrap.innerHTML = `<img class="tile-icon-img" src="${ITEM_ICONS_BASE}${TILE_SLAIN_ICON}" alt="" decoding="async" draggable="false"/>`
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

  showInfoCard(data) {
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

    const aboveHeaderHTML = data.spriteSrc
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
    `

    el.infoCardOverlay.classList.add('visible')
  },

  hideInfoCard() {
    el.infoCardOverlay?.classList.remove('visible')
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

  // ── Level-up overlay ─────────────────────────

  // choices: array of { id, name, desc, icon }
  // onPick: callback(abilityId)
  showLevelUpOverlay(choices, onPick) {
    el.abilityChoices.innerHTML = ''
    for (const choice of choices) {
      const card = document.createElement('div')
      card.className = 'ability-card'
      card.innerHTML = `
        <div class="ability-icon">${choice.icon}</div>
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
