import { CONFIG } from '../config.js'
import { el, logHistory, PORTRAIT_ANIM } from './uiShared.js'

export function cacheHudElements() {
    el.hpBar       = document.getElementById('hp-bar')
    el.hpValue     = document.getElementById('hp-value')
    el.manaBar     = document.getElementById('mana-bar')
    el.manaValue   = document.getElementById('mana-value')
    el.dmgValue    = document.getElementById('dmg-value')
    el.goldValue   = document.getElementById('gold-value')
    el.scrapValue  = document.getElementById('scrap-value')
    el.keyDisplay        = document.getElementById('hud-key-display')
    el.keyValue          = document.getElementById('key-value')
    el.keySlotPlaceholder = document.getElementById('hud-key-slot-placeholder')
    el.hudPortraitWrap = document.getElementById('hud-portrait-wrap')
    el.hudPortrait = document.getElementById('hud-portrait')
    el.hudPortraitImg = document.getElementById('hud-portrait-img')
    el.xpBar       = document.getElementById('xp-bar')
    el.floorInfo          = document.getElementById('floor-info')
    el.floorModifierBadge = document.getElementById('floor-modifier-badge')
    el.messageBox  = document.getElementById('message-box')
    el.actionBtns  = document.getElementById('action-buttons')
    el.spellBtn    = document.getElementById('spell-btn')
    el.fleeBtn     = document.getElementById('flee-btn')
    el.retreatBtn  = document.getElementById('retreat-btn')
    el.hudSettingsBtn = document.getElementById('hud-settings-btn')
    el.hudHowToPlayBtn = document.getElementById('hud-how-to-play-btn')
    el.skipFloorBtn = document.getElementById('skip-floor-btn')
    el.generateGearBtn = document.getElementById('generate-gear-btn')
    el.cheatDebugStack = document.getElementById('cheat-debug-stack')
    el.floorBanner = document.getElementById('floor-banner')
    el.floorBannerText = document.getElementById('floor-banner-text')
    el.armorValue         = document.getElementById('armor-value')
    el.hudSlotA           = document.getElementById('hud-btn-slot-a')
    el.hudSlotB           = document.getElementById('hud-btn-slot-b')
    el.hudSlotC           = document.getElementById('hud-btn-slot-c')
    el.hudSlotD           = document.getElementById('hud-btn-slot-d')
    el.msgLogWrap         = document.getElementById('message-log-wrap')
    el.msgLogExpanded     = document.getElementById('message-log-expanded')
    el.msgLogScroll       = document.getElementById('message-log-scroll')
    el.hudCharacterId     = 'warrior'
}

export function wireHudListeners() {
  if (!el.messageBox || !el.msgLogExpanded || !el.msgLogScroll) return

  el.messageBox.addEventListener('click', () => {
    const isOpen = !el.msgLogExpanded.classList.contains('hidden')
    if (isOpen) {
      el.msgLogExpanded.classList.add('hidden')
    } else {
      el.msgLogScroll.innerHTML = logHistory.map((e, i) =>
        `<div class="log-entry${e.isAlert ? ' log-alert' : ''}${i === 0 ? ' log-latest' : ''}">${e.msg}</div>`
      ).join('')
      el.msgLogExpanded.classList.remove('hidden')
      el.msgLogScroll.scrollTop = 0
    }
  })

  document.addEventListener('click', (e) => {
    if (!el.msgLogWrap?.contains(e.target)) {
      el.msgLogExpanded.classList.add('hidden')
    }
  })
}

export const HudMethods = {
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

  updateArmor(n) {
    if (!el.armorValue) return
    const display = Math.min(Math.max(0, Math.floor(n)), 99)
    el.armorValue.textContent = display
    el.armorValue.closest('.hud-stat-armor')?.classList.toggle('armor-empty', display === 0)
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

  setEngineerManaGeneratorBtn(visible, active = false) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove('is-slam', 'is-slam-active', 'is-ricochet', 'is-ricochet-active')
    if (visible) {
      el.hudSlotA.innerHTML = active
        ? `<span class="ability-btn-wrap ability-btn-wrap--mana-corner">
             <span class="ability-btn-emoji" aria-hidden="true">🔋</span>
             <span class="ability-btn-cost">✓</span>
           </span>`
        : `<span class="ability-btn-wrap">
             <span class="ability-btn-emoji" aria-hidden="true">🔋</span>
           </span>`
      el.hudSlotA.title    = active ? 'Mana Generator active — tap to deactivate' : 'Mana Generator — tap to activate'
      el.hudSlotA.disabled = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-engineer-mana-generator')
    } else if (el.hudSlotA.classList.contains('is-engineer-mana-generator')) {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-engineer-mana-generator')
    }
  },

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

  setEngineerTeslaBtn(visible, active = false) {
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
    el.hudSlotB.innerHTML = active
      ? `<span class="ability-btn-wrap ability-btn-wrap--mana-corner">
           <span class="ability-btn-emoji" aria-hidden="true">⚡</span>
           <span class="ability-btn-cost">✓</span>
         </span>`
      : `<span class="ability-btn-wrap">
           <span class="ability-btn-emoji" aria-hidden="true">⚡</span>
         </span>`
    el.hudSlotB.title    = active ? 'Tesla Tower active — tap to deactivate' : 'Tesla Tower — tap to activate'
    el.hudSlotB.disabled = false
    el.hudSlotB.classList.remove('is-placeholder', 'is-poison-arrow-shot', 'is-blinding-light')
    el.hudSlotB.classList.add('is-engineer-tesla')
  },

  setChainLightningBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove(
      'is-slam', 'is-slam-active',
      'is-ricochet', 'is-ricochet-active',
      'is-engineer-construct',
    )
    if (visible) {
      el.hudSlotA.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">⚡</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotA.title    = `Chain Lightning — zap an enemy; arcs to 2 more (${manaCost} mana)`
      el.hudSlotA.disabled = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-chain-lightning')
    } else if (el.hudSlotA.classList.contains('is-chain-lightning')) {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-chain-lightning', 'is-chain-lightning-active')
    }
  },

  setChainLightningActive(active) {
    el.hudSlotA?.classList.toggle('is-chain-lightning-active', active)
  },

  setStrengthenMinionBtn(visible, manaCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove(
      'is-slam', 'is-slam-active',
      'is-ricochet', 'is-ricochet-active',
      'is-engineer-construct',
      'is-chain-lightning', 'is-chain-lightning-active',
    )
    if (visible) {
      el.hudSlotA.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">💪</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotA.title    = `Strengthen Minion — +5 max HP to a minion (${manaCost} mana)`
      el.hudSlotA.disabled = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-strengthen-minion')
    } else if (el.hudSlotA.classList.contains('is-strengthen-minion')) {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-strengthen-minion', 'is-strengthen-minion-active')
    }
  },

  setStrengthenMinionActive(active) {
    el.hudSlotA?.classList.toggle('is-strengthen-minion-active', active)
  },

  setBloodTitheBtn(visible, hpCost = 10) {
    if (!el.hudSlotA) return
    el.hudSlotA.classList.remove(
      'is-slam', 'is-slam-active',
      'is-ricochet', 'is-ricochet-active',
      'is-engineer-construct',
      'is-chain-lightning', 'is-chain-lightning-active',
      'is-strengthen-minion', 'is-strengthen-minion-active',
    )
    if (visible) {
      el.hudSlotA.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">🩸</span>
          <span class="ability-btn-cost">-${hpCost}❤</span>
        </span>`
      el.hudSlotA.title    = `Blood Tithe — spend ${hpCost} HP to gain 10 mana`
      el.hudSlotA.disabled = false
      el.hudSlotA.classList.remove('is-placeholder')
      el.hudSlotA.classList.add('is-blood-tithe')
    } else if (el.hudSlotA.classList.contains('is-blood-tithe')) {
      el.hudSlotA.textContent = '···'
      el.hudSlotA.title       = 'Reserved'
      el.hudSlotA.disabled    = true
      el.hudSlotA.classList.add('is-placeholder')
      el.hudSlotA.classList.remove('is-blood-tithe')
    }
  },

  setMistFormBtn(visible, manaCost = 10, flipsRemaining = 0) {
    if (!el.hudSlotB) return
    el.hudSlotB.classList.remove(
      'is-poison-arrow-shot', 'is-poison-arrow-shot-active',
      'is-blinding-light', 'is-blinding-light-active',
      'is-engineer-tesla',
    )
    if (visible) {
      const label = flipsRemaining > 0 ? String(flipsRemaining) : String(manaCost)
      el.hudSlotB.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">🌫️</span>
          <span class="ability-btn-cost">${label}</span>
        </span>`
      el.hudSlotB.title    = flipsRemaining > 0
        ? `Mist Form active — ${flipsRemaining} flip${flipsRemaining !== 1 ? 's' : ''} remaining`
        : `Mist Form — 5 protected flips, no HP drain (${manaCost} mana)`
      el.hudSlotB.disabled = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-mist-form')
    } else if (el.hudSlotB.classList.contains('is-mist-form')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title       = 'Reserved'
      el.hudSlotB.disabled    = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-mist-form', 'is-mist-form-active')
    }
  },

  setMistFormActive(active) {
    el.hudSlotB?.classList.toggle('is-mist-form-active', active)
  },

  setBloodPactBtn(visible, manaCost = 10) {
    if (!el.hudSlotC) return
    el.hudSlotC.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    if (visible) {
      el.hudSlotC.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">⚖️</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotC.title    = `Blood Pact — equalize all revealed enemy HP (${manaCost} mana)`
      el.hudSlotC.disabled = false
      el.hudSlotC.classList.remove('is-placeholder')
      el.hudSlotC.classList.add('is-blood-pact')
    } else if (el.hudSlotC.classList.contains('is-blood-pact')) {
      el.hudSlotC.textContent = '···'
      el.hudSlotC.title       = 'Reserved'
      el.hudSlotC.disabled    = true
      el.hudSlotC.classList.add('is-placeholder')
      el.hudSlotC.classList.remove('is-blood-pact')
    }
  },

  setCorpseExplosionBtn(visible, manaCost = 10) {
    if (!el.hudSlotB) return
    el.hudSlotB.classList.remove(
      'is-blinding-light', 'is-blinding-light-active',
      'is-poison-arrow-shot', 'is-poison-arrow-shot-active',
      'is-engineer-tesla',
      'is-telekinetic-throw', 'is-telekinetic-throw-active',
    )
    if (visible) {
      el.hudSlotB.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">💥</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotB.title    = `Corpse Explosion — detonate a corpse or minion; 8-tile blast (${manaCost} mana)`
      el.hudSlotB.disabled = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-corpse-explosion')
    } else if (el.hudSlotB.classList.contains('is-corpse-explosion')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title       = 'Reserved'
      el.hudSlotB.disabled    = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-corpse-explosion', 'is-corpse-explosion-active')
    }
  },

  setCorpseExplosionActive(active) {
    el.hudSlotB?.classList.toggle('is-corpse-explosion-active', active)
  },

  setTelekineticThrowBtn(visible, manaCost = 10) {
    if (!el.hudSlotB) return
    el.hudSlotB.classList.remove(
      'is-poison-arrow-shot', 'is-poison-arrow-shot-active',
      'is-blinding-light', 'is-blinding-light-active',
      'is-engineer-tesla',
    )
    if (visible) {
      el.hudSlotB.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">🌀</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotB.title    = `Telekinetic Throw — grab an enemy, slam them onto an empty tile (${manaCost} mana)`
      el.hudSlotB.disabled = false
      el.hudSlotB.classList.remove('is-placeholder')
      el.hudSlotB.classList.add('is-telekinetic-throw')
    } else if (el.hudSlotB.classList.contains('is-telekinetic-throw')) {
      el.hudSlotB.textContent = '···'
      el.hudSlotB.title       = 'Reserved'
      el.hudSlotB.disabled    = true
      el.hudSlotB.classList.add('is-placeholder')
      el.hudSlotB.classList.remove('is-telekinetic-throw', 'is-telekinetic-throw-active')
    }
  },

  setTelekineticThrowActive(active) {
    el.hudSlotB?.classList.toggle('is-telekinetic-throw-active', active)
  },

  setManaShieldBtn(visible, manaCost = 5, active = false) {
    if (!el.hudSlotC) return
    el.hudSlotC.classList.remove(
      'is-arrow-barrage', 'is-arrow-barrage-active',
      'is-divine-light', 'is-divine-light-active',
      'is-blood-pact',
    )
    if (visible) {
      el.hudSlotC.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--mana-corner">
          <span class="ability-btn-emoji" aria-hidden="true">🔵</span>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotC.title    = `Mana Shield — toggle: absorb damage as mana drain (${manaCost} mana to activate)`
      el.hudSlotC.disabled = false
      el.hudSlotC.classList.remove('is-placeholder')
      el.hudSlotC.classList.add('is-mana-shield')
      el.hudSlotC.classList.toggle('is-mana-shield-active', active)
    } else if (el.hudSlotC.classList.contains('is-mana-shield')) {
      el.hudSlotC.textContent = '···'
      el.hudSlotC.title       = 'Reserved'
      el.hudSlotC.disabled    = true
      el.hudSlotC.classList.add('is-placeholder')
      el.hudSlotC.classList.remove('is-mana-shield', 'is-mana-shield-active')
    }
  },

  setManaShieldActive(active) {
    el.hudSlotC?.classList.toggle('is-mana-shield-active', active)
  },

  setLifeTapBtn(visible, active = false) {
    if (!el.hudSlotD) return
    el.hudSlotD.classList.remove('is-arrow-barrage', 'is-arrow-barrage-active')
    if (visible) {
      el.hudSlotD.innerHTML = `
        <span class="ability-btn-wrap">
          <span class="ability-btn-emoji" aria-hidden="true">🔴</span>
        </span>`
      el.hudSlotD.title    = 'Life Tap — toggle: each flip costs HP, grants mana (free to activate)'
      el.hudSlotD.disabled = false
      el.hudSlotD.classList.remove('is-placeholder')
      el.hudSlotD.classList.add('is-life-tap')
      el.hudSlotD.classList.toggle('is-life-tap-active', active)
    } else if (el.hudSlotD.classList.contains('is-life-tap')) {
      el.hudSlotD.textContent = '···'
      el.hudSlotD.title       = 'Reserved'
      el.hudSlotD.disabled    = true
      el.hudSlotD.classList.add('is-placeholder')
      el.hudSlotD.classList.remove('is-life-tap', 'is-life-tap-active')
    }
  },

  setLifeTapActive(active) {
    el.hudSlotD?.classList.toggle('is-life-tap-active', active)
  },

  setDivineLightBtn(visible, manaCost = 10, healRate = 0.03) {
    if (!el.hudSlotC) return
    el.hudSlotC.classList.remove('is-divine-light', 'is-divine-light-active')
    if (visible) {
      const healPct = Math.round(healRate * 100)
      el.hudSlotC.innerHTML = `
        <span class="ability-btn-wrap ability-btn-wrap--divine-light">
          <img src="assets/sprites/abilities/ricochet-bg.png" class="ability-btn-bg" alt="" draggable="false"/>
          <img src="assets/sprites/abilities/divine-light-badge.jpg" class="ability-btn-badge" alt="Divine Light" draggable="false"/>
          <span class="ability-btn-cost">${manaCost}</span>
        </span>`
      el.hudSlotC.title    = `Divine Light — smite an enemy or heal ${healPct}% HP (${manaCost} mana)`
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
            : characterId === 'necromancer'
              ? 'necromancer'
              : 'warrior'
    el.hudCharacterId = id
    const isRanger = id === 'ranger'
    el.hudPortraitWrap.classList.toggle('is-ranger', isRanger)
    el.hudPortraitWrap.classList.toggle('is-engineer', id === 'engineer')
    if (el.hudPortraitImg) {
      el.hudPortraitImg.src = PORTRAIT_ANIM[id].idle
    }
  },

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
            : el.hudCharacterId === 'necromancer'
              ? 'necromancer'
              : 'warrior'
    const MAP = PORTRAIT_ANIM[id]
    if (MAP && MAP[state]) el.hudPortraitImg.src = MAP[state]
  },

  updateGold(amount) {
    el.goldValue.textContent = amount
  },

  updateScrap(amount) {
    if (el.scrapValue) el.scrapValue.textContent = amount
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

  refreshSkipFloorButton(save) {
    const stack = el.cheatDebugStack
    const skipBtn = el.skipFloorBtn
    const genBtn = el.generateGearBtn
    const cheats = save?.settings?.cheats ?? {}
    const skipOn = cheats.skipFloorButton === true
    const genOn = cheats.generateGearButton === true
    const inGame = el.mainMenu?.classList.contains('hidden')
    const showStack = inGame && (skipOn || genOn)

    if (stack) {
      stack.classList.toggle('hidden', !showStack)
      stack.setAttribute('aria-hidden', showStack ? 'false' : 'true')
    }
    if (skipBtn) {
      const show = skipOn && inGame
      skipBtn.classList.toggle('hidden', !show)
      skipBtn.setAttribute('aria-hidden', show ? 'false' : 'true')
    }
    if (genBtn) {
      const show = genOn && inGame
      genBtn.classList.toggle('hidden', !show)
      genBtn.setAttribute('aria-hidden', show ? 'false' : 'true')
    }
  },

  setFloorModifier(modifier) {
    if (!el.floorModifierBadge) return
    el.floorModifierBadge.textContent = `${modifier.icon} ${modifier.name}`
    el.floorModifierBadge.title       = modifier.description
    el.floorModifierBadge.classList.remove('hidden')
  },

  clearFloorModifier() {
    if (!el.floorModifierBadge) return
    el.floorModifierBadge.classList.add('hidden')
    el.floorModifierBadge.textContent = ''
  },

  updateFloor(floor, opts = {}) {
    if (opts.rest) {
      el.floorInfo.textContent = 'Sanctuary — Rest'
      this.applyFloorTheme(floor, { rest: true })
      return
    }
    const name = CONFIG.floorLabelFor(floor)
    el.floorInfo.textContent = `Floor ${floor} — ${name}`
    this.applyFloorTheme(floor, { rest: false, isVoidTrial: !!opts.isVoidTrial })
  },

  applyFloorTheme(floor, opts = {}) {
    const bg = opts.isVoidTrial
      ? CONFIG.void.floorBackground
      : opts.rest
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

  setMessage(msg, isAlert = false) {
    el.messageBox.textContent = msg
    el.messageBox.classList.toggle('alert', isAlert)
    logHistory.unshift({ msg, isAlert })
    if (logHistory.length > 80) logHistory.pop()
    if (isAlert) {
      el.messageBox.classList.remove('message-shake')
      void el.messageBox.offsetWidth
      el.messageBox.classList.add('message-shake')
    } else {
      el.messageBox.classList.remove('message-shake')
    }
  },

  clearLog() {
    logHistory.length = 0
  },

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
    el.hudSettingsBtn?.classList.remove('hidden')
    el.hudHowToPlayBtn?.classList.remove('hidden')
  },

  hideRetreat() {
    el.retreatBtn.classList.add('hidden')
    el.hudSettingsBtn?.classList.add('hidden')
    el.hudHowToPlayBtn?.classList.add('hidden')
    document.getElementById('retreat-confirm').classList.add('hidden')
  },

  getHudCharacterId() {
    return el.hudCharacterId ?? 'warrior'
  },

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
  }
}
