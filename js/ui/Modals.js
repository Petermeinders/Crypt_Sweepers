import { CONFIG } from '../config.js'
import { trinketTrashDropSuffix, trinketTrashRewardText } from '../controllers/GearController.js'
import TileEngine from '../systems/TileEngine.js'
import { TILE_BLURBS } from '../data/tileBlurbs.js'
import { ENEMY_DEFS } from '../data/enemies.js'
import Bestiary from '../systems/Bestiary.js'
import TrinketCodex from '../systems/TrinketCodex.js'
import { ITEMS } from '../data/items.js'
import EventBus from '../core/EventBus.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'
import { el, fillBestiaryCreatureParts, fillTrinketCard, drawSettledDice, PORTRAIT_ANIM } from './uiShared.js'

const CMP_GEAR_IMGS = {
  weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
  breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
  offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
}
const CMP_TIER_LABELS   = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }
const CMP_RARITY_LABELS = { common: 'Common', rare: 'Rare', legendary: 'Legendary', merged: 'Merged' }
const CMP_TIER_ART_BG = {
  common:    "url('assets/ui/common-tile.png')",
  rare:      "url('assets/ui/rare-tile.png')",
  epic:      "url('assets/ui/rare-tile.png')",
  legendary: "url('assets/ui/legendary-tile.png')",
}

function _cmpGearImg(slot, tier) {
  return CMP_GEAR_IMGS[slot]?.[tier] ?? CMP_GEAR_IMGS[slot]?.default ?? ''
}

/** Gear or trinket item chip for compare modal header (icon + tier + name). */
function _renderCompareItemSide(sideEl, item, mode = 'gear') {
  if (!sideEl) return
  sideEl.innerHTML = ''
  const card = document.createElement('div')

  if (!item) {
    card.className = 'cmp-item-card cmp-item-empty'
    card.innerHTML = '<div class="cmp-item-art cmp-item-art-empty" aria-hidden="true"></div>'
    sideEl.appendChild(card)
    return
  }

  if (mode === 'gear') {
    const tier = item.tier ?? 'common'
    const artBg = CMP_TIER_ART_BG[tier] ?? CMP_TIER_ART_BG.common
    card.className = `cmp-item-card gear-tier-${tier}`
    card.innerHTML = `
      <div class="cmp-item-art" style="background-image:${artBg}">
        <img class="cmp-item-img" src="${_cmpGearImg(item.slot, tier)}" alt="">
        <span class="cmp-item-tier-badge tier-${tier}">${CMP_TIER_LABELS[tier] ?? tier}</span>
      </div>
      <div class="cmp-item-name">${item.name ?? ''}</div>
    `
  } else {
    const rarity = item.rarity ?? 'common'
    const artBg = CMP_TIER_ART_BG[rarity] ?? CMP_TIER_ART_BG.common
    const artInner = item.spriteSrc
      ? `<img class="cmp-item-img" src="${item.spriteSrc}" alt="">`
      : `<span class="cmp-item-emoji">${item.icon ?? '🧿'}</span>`
    card.className = `cmp-item-card trinket-rarity-${rarity}`
    card.innerHTML = `
      <div class="cmp-item-art" style="background-image:${artBg}">
        ${artInner}
        <span class="cmp-item-tier-badge tier-${rarity}">${CMP_RARITY_LABELS[rarity] ?? rarity}</span>
      </div>
      <div class="cmp-item-name">${item.name ?? ''}</div>
    `
  }
  sideEl.appendChild(card)
}

export function cacheModalElements() {
    el.levelUpOverlay  = document.getElementById('level-up-overlay')
    el.abilityChoices  = document.getElementById('ability-choices')
    el.runSummary      = document.getElementById('run-summary')
    el.mainMenu        = document.getElementById('main-menu')
    el.menuGoldVal     = document.getElementById('menu-gold-val')
    el.menuXpVal       = document.getElementById('menu-xp-val')
    el.menuXpBar       = document.getElementById('menu-xp-bar')
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
    el.ropeModalBody      = document.getElementById('rope-modal-body')
    el.equipmentOverlay   = document.getElementById('equipment-overlay')
    el.gearCompareModal   = document.getElementById('gear-compare-modal')
}

export function wireModalListeners() {
const closeBestiaryDetail = () => {
      el.bestiaryDetailOverlay?.classList.add('hidden')
      el.bestiaryDetailOverlay?.setAttribute('aria-hidden', 'true')
      document.body.classList.remove('bestiary-detail-open')
    }
    el.bestiaryDetailBack?.addEventListener('click', closeBestiaryDetail)
    el.bestiaryDetailBackdrop?.addEventListener('click', closeBestiaryDetail)
  
}

export const ModalsMethods = {
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
        ? `<div class="card-actions"></div>`
        : ''}
    `

    if (typeof opts.onDrop === 'function') {
      const dropSuffix = trinketTrashDropSuffix(data)
      const rewardText = trinketTrashRewardText(data)
      const _wireDropBtn = (actions) => {
        actions.innerHTML = `<button type="button" class="card-btn card-btn-drop">Drop${dropSuffix}</button>`
        actions.querySelector('.card-btn-drop').addEventListener('click', (e) => {
          e.stopPropagation()
          actions.innerHTML = `
            <span class="card-drop-confirm-label">Drop this item?${rewardText ? ` You'll receive ${rewardText}.` : ''}</span>
            <div class="card-drop-confirm-btns">
              <button type="button" class="card-btn card-btn-drop-confirm">Yes, drop${dropSuffix}</button>
              <button type="button" class="card-btn card-btn-drop-cancel">Cancel</button>
            </div>`
          actions.querySelector('.card-btn-drop-confirm').addEventListener('click', (e2) => {
            e2.stopPropagation()
            opts.onDrop()
          })
          actions.querySelector('.card-btn-drop-cancel').addEventListener('click', (e2) => {
            e2.stopPropagation()
            _wireDropBtn(actions)
          })
        })
      }
      const actions = el.infoCard.querySelector('.card-actions')
      if (actions) _wireDropBtn(actions)
    }

    el.infoCardOverlay.classList.add('visible')
  },

  hideInfoCard() {
    el.infoCardOverlay?.classList.remove('visible')
  },

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

  showFirstRunIntro(onDismiss) {
    const ov = document.getElementById('first-run-intro-overlay')
    const okBtn = document.getElementById('first-run-intro-ok')
    const backdrop = document.getElementById('first-run-intro-backdrop')
    if (!ov) { onDismiss?.(); return }
    let done = false
    const close = () => {
      if (done) return
      done = true
      okBtn.removeEventListener('click', close)
      backdrop.removeEventListener('click', close)
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      onDismiss?.()
    }
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
    okBtn.addEventListener('click', close)
    backdrop.addEventListener('click', close)
  },

  showFloorModifierModal(modifier, onDismiss) {
    const ov     = document.getElementById('floor-modifier-overlay')
    const okBtn  = document.getElementById('floor-modifier-ok')
    const backdrop = document.getElementById('floor-modifier-backdrop')
    if (!ov) { onDismiss?.(); return }
    document.getElementById('floor-modifier-modal-icon').textContent = modifier.icon
    document.getElementById('floor-modifier-title').textContent      = modifier.name
    document.getElementById('floor-modifier-modal-desc').textContent = modifier.description
    let done = false
    const close = () => {
      if (done) return
      done = true
      okBtn.removeEventListener('click', close)
      backdrop.removeEventListener('click', close)
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      onDismiss?.()
    }
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
    okBtn.addEventListener('click', close)
    backdrop.addEventListener('click', close)
  },

  showRopeModal(onBank, onCancel) {
    const ov       = el.ropeModalOverlay
    if (!ov) { onCancel?.(); return }
    const btn50    = document.getElementById('rope-modal-bank-50')
    const btn75    = document.getElementById('rope-modal-bank-75')
    const btn100   = document.getElementById('rope-modal-bank-100')
    const btnCancel = document.getElementById('rope-modal-cancel')
    const backdrop = document.getElementById('rope-modal-backdrop')

    el.ropeModalBody.innerHTML =
      '<p>Stash gold in the vault before pushing deeper. Banked gold is kept even if you die.</p>'

    let done = false
    const close = () => {
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
    }
    const pick = (pct) => {
      if (done) return
      done = true
      ;[btn50, btn75, btn100, btnCancel, backdrop].forEach(b =>
        b?.removeEventListener('click', b._ropeHandler)
      )
      close()
      onBank(pct)
    }
    const cancel = () => {
      if (done) return
      done = true
      ;[btn50, btn75, btn100, btnCancel, backdrop].forEach(b =>
        b?.removeEventListener('click', b._ropeHandler)
      )
      close()
      onCancel?.()
    }
    btn50._ropeHandler    = () => pick(0.50)
    btn75._ropeHandler    = () => pick(0.75)
    btn100._ropeHandler   = () => pick(1.00)
    btnCancel._ropeHandler = cancel
    backdrop._ropeHandler  = cancel
    ;[btn50, btn75, btn100, btnCancel, backdrop].forEach(b =>
      b?.addEventListener('click', b._ropeHandler)
    )
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
  },

  renderBackpack(inventory, itemRegistry, onUse, onHold, replaceMode = false, opts = {}) {
    const grid = document.getElementById('backpack-grid')
    if (!grid) return
    const SLOTS = 9
    grid.innerHTML = ''
    grid.classList.toggle('replace-mode', replaceMode)

    const { filterSlot, filterTrinket, onCompare, onCompareTrinket, onUnequip, onReplaceIndex, onReplaceGearIndex, onSwapWithEquipped, gearPickupMode } = opts

    const isPassiveTrinketEntry = (e) => {
      if (!e?.id) return false
      const item = itemRegistry[e.id]
      return !!(item && !item.stackable && item.effect?.type?.startsWith('passive-'))
    }

    // Slot label banner when filtered
    const filterLabel = document.getElementById('backpack-filter-label')
    if (filterLabel) {
      if (filterTrinket) {
        filterLabel.textContent = 'Showing: Trinkets (Safe Pocket)'
        filterLabel.classList.remove('hidden')
      } else if (filterSlot) {
        const labels = { weapon: 'Weapons', breastplate: 'Breastplates', offhand: 'Offhands' }
        filterLabel.textContent = `Showing: ${labels[filterSlot] ?? filterSlot}`
        filterLabel.classList.remove('hidden')
      } else {
        filterLabel.classList.add('hidden')
      }
    }

    const isGear    = e => e && typeof e === 'object' && e.slot !== undefined
    const isTrinket = e => e && typeof e === 'object' && e.id  !== undefined
    const isEmpty   = e => e === null || e === undefined

    const GEAR_IMGS = {
      weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
      breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
      offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
    }
    const _gImg = (slot, tier) => GEAR_IMGS[slot]?.[tier] ?? GEAR_IMGS[slot]?.default ?? ''

    // Pad inventory to SLOTS with null
    const padded = [...inventory]
    while (padded.length < SLOTS) padded.push(null)

    padded.slice(0, SLOTS).forEach((entry, index) => {
      const slot = document.createElement('div')

      if (isEmpty(entry)) {
        if (filterSlot && onUnequip) {
          slot.className = 'backpack-slot backpack-cell-empty backpack-cell-unequip-target'
          slot.setAttribute('title', 'Move equipped item here')
          slot.addEventListener('click', () => onUnequip(index))
        } else {
          slot.className = 'backpack-slot backpack-cell-empty'
          slot.setAttribute('aria-hidden', 'true')
        }
        grid.appendChild(slot)
        return
      }

      if (isGear(entry)) {
        const filteredOut = filterSlot && entry.slot !== filterSlot
        if (filterTrinket || filteredOut || (replaceMode && !gearPickupMode)) {
          slot.className = 'backpack-slot backpack-cell-filtered-out'
          grid.appendChild(slot)
          return
        }
        slot.className = `backpack-slot backpack-cell-gear gear-tier-${entry.tier}`
        const slotImg = _gImg(entry.slot, entry.tier)
        slot.innerHTML = `
          ${slotImg ? `<img class="bp-gear-slot-img" src="${slotImg}" alt="">` : ''}
          <span class="bp-gear-name">${entry.name}</span>
        `
        if (gearPickupMode && onReplaceGearIndex) {
          slot.classList.add('replace-target')
          slot.addEventListener('click', () => onReplaceGearIndex(index))
        } else {
          slot.addEventListener('click', () => onCompare?.(index))
        }
        grid.appendChild(slot)
        return
      }

      if (isTrinket(entry)) {
        if (filterSlot || (filterTrinket && !isPassiveTrinketEntry(entry))) {
          slot.className = 'backpack-slot backpack-cell-filtered-out'
          grid.appendChild(slot)
          return
        }
        const item = itemRegistry[entry.id]
        if (!item) { grid.appendChild(slot); return }
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
        if (filterTrinket && onCompareTrinket) {
          slot.addEventListener('click', () => onCompareTrinket(index))
          grid.appendChild(slot)
          return
        }
        if (replaceMode && onReplaceIndex) {
          slot.addEventListener('click', () => onReplaceIndex(index))
        } else if (replaceMode) {
          slot.addEventListener('click', () => onUse(index))
        } else {
          let _timer = null, _didHold = false, _sx = 0, _sy = 0
          slot.addEventListener('pointerdown', e => {
            _didHold = false; _sx = e.clientX; _sy = e.clientY
            _timer = setTimeout(() => { _didHold = true; onHold(index) }, 380)
          })
          slot.addEventListener('pointermove', e => {
            if (!_timer) return
            if (Math.hypot(e.clientX - _sx, e.clientY - _sy) > 8) { clearTimeout(_timer); _timer = null }
          })
          const cancel = () => { clearTimeout(_timer); _timer = null }
          slot.addEventListener('pointerup',     cancel)
          slot.addEventListener('pointercancel', cancel)
          slot.addEventListener('contextmenu',   e => e.preventDefault())
          slot.addEventListener('click', () => { if (!_didHold) onUse(index) })
        }
        grid.appendChild(slot)
        return
      }

      // Fallback empty
      slot.className = 'backpack-slot'
      grid.appendChild(slot)
    })

    // No-matching-gear message in filtered view
    if (filterTrinket) {
      const hasMatch = inventory.some(e => isPassiveTrinketEntry(e))
      if (!hasMatch) {
        const msg = document.createElement('div')
        msg.className = 'backpack-filter-empty'
        msg.textContent = 'No trinkets in backpack'
        grid.appendChild(msg)
      }
    } else if (filterSlot) {
      const hasMatch = inventory.some(e => isGear(e) && e.slot === filterSlot)
      const label = { weapon: 'Weapon', breastplate: 'Breastplate', offhand: 'Offhand' }[filterSlot] ?? filterSlot
      if (!hasMatch) {
        const msg = document.createElement('div')
        msg.className = 'backpack-filter-empty'
        msg.textContent = `No ${label} in backpack`
        grid.appendChild(msg)
        if (gearPickupMode && onSwapWithEquipped) {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'backpack-swap-equipped-btn'
          btn.textContent = `Replace equipped ${label.toLowerCase()}`
          btn.addEventListener('click', () => onSwapWithEquipped())
          grid.appendChild(btn)
        }
      }
    }
  },

  showGearFoundToast(piece) {
    const TIER_LABELS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }
    const SLOT_ICONS  = { weapon: '⚔️', breastplate: '🧥', offhand: '🛡️' }
    const TIER_COLORS = { common: '#aaa', rare: '#00c8ff', epic: '#c084fc', legendary: '#ffd700' }
    const icon  = SLOT_ICONS[piece.slot] ?? '🎁'
    const label = TIER_LABELS[piece.tier] ?? piece.tier
    this.setMessage(`${icon} ${label} ${piece.name} found! Check your backpack.`)

    // Floating loot badge near the backpack button
    const anchor = document.getElementById('hud-backpack-btn')
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const div = document.createElement('div')
    div.className = 'float-text gear-loot'
    div.textContent = `${icon} ${piece.name}`
    div.style.color = TIER_COLORS[piece.tier] ?? '#fff'
    div.style.textShadow = `0 0 8px ${TIER_COLORS[piece.tier] ?? '#fff'}88`
    div.style.left = (rect.left + rect.width / 2 - 60) + 'px'
    div.style.top  = (rect.top - 10) + 'px'
    div.style.fontSize = '0.78rem'
    document.body.appendChild(div)
    div.addEventListener('animationend', () => div.remove())
  },

  renderEquipmentSlots(equippedGear, heroId = 'warrior', safePocketTrinket = null) {
    const ov = el.equipmentOverlay
    if (!ov) return

    ov.dataset.hero = heroId
    const particlesEl = document.getElementById('equipment-hero-particles')
    if (particlesEl && particlesEl.dataset.forHero !== heroId) {
      particlesEl.innerHTML = ''
      particlesEl.dataset.forHero = heroId
      for (let p = 0; p < 16; p++) {
        const mote = document.createElement('span')
        mote.className = 'hero-particle'
        const size = 1 + Math.random() * 3
        mote.style.left              = (Math.random() * 100) + '%'
        mote.style.width             = size + 'px'
        mote.style.height            = size + 'px'
        mote.style.animationDuration = (6 + Math.random() * 10) + 's'
        mote.style.animationDelay    = (-Math.random() * 12) + 's'
        mote.style.setProperty('--dx', ((Math.random() - 0.5) * 60) + 'px')
        mote.style.opacity           = String(0.4 + Math.random() * 0.55)
        particlesEl.appendChild(mote)
      }
    }

    const SLOT_LABEL = { weapon: 'Weapon', breastplate: 'Breastplate', offhand: 'Offhand' }
    const GEAR_IMGS = {
      weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
      breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
      offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
    }
    const _gImg = (slot, tier) => GEAR_IMGS[slot]?.[tier] ?? GEAR_IMGS[slot]?.default ?? ''
    const TIER_LABELS = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }
    // Stat definitions: label + colored dot
    const STAT_DEFS = {
      damageBonus:     { label: 'Attack',    dot: '#ff6633' },
      maxHpPct:        { label: 'HP',        dot: '#e74c3c' },
      maxManaPct:      { label: 'MANA',      dot: '#7766ff' },
      negation:        { label: 'Block',        dot: '#44aaff' },
      damageReduction: { label: 'DEF',         dot: '#44cc88' },
      brittleArmor:    { label: 'Brittle Guard', dot: '#ff8833', bad: true },
      barbedGear:      { label: 'THORNS',    dot: '#cc4444', bad: true },
      manaDrain:       { label: 'DRAIN',     dot: '#aa44cc', bad: true },
    }
    // Tile-image backgrounds per tier for the icon art box
    const TIER_ART_BG = {
      common:    "url('assets/ui/common-tile.png')",
      rare:      "url('assets/ui/rare-tile.png')",
      legendary: "url('assets/ui/legendary-tile.png')",
    }

    // Hero portrait
    const heroImg = document.getElementById('equipment-hero-img')
    if (heroImg) heroImg.src = PORTRAIT_ANIM[heroId]?.idle ?? ''

    // Gear cards
    const gearRow = document.getElementById('equipment-gear-row')
    if (!gearRow) return
    gearRow.innerHTML = ''

    const _statHtml = (stat, val) => {
      const def = STAT_DEFS[stat]
      if (!def) return ''
      const isNeg     = stat === 'negation'
      const isBarbed  = stat === 'barbedGear'
      const isBrittle = stat === 'brittleArmor'
      const isPct     = stat === 'maxHpPct' || stat === 'maxManaPct'
      const isBad     = val < 0 || def.bad
      const display   = isNeg     ? `${Math.round(Math.abs(val) * 100)}%`
                      : isBarbed  ? `${val}HP`
                      : isBrittle ? `${val}%`
                      : isPct     ? (val > 0 ? `+${val}%` : `${val}%`)
                      : (val > 0 ? `+${val}` : `${val}`)
      return `<div class="eq-stat-row">
        <span class="eq-stat-dot" style="background:${def.dot}"></span>
        <span class="eq-stat-label">${def.label}</span>
        <span class="eq-stat-value${isBad ? ' bad' : ''}">${display}</span>
      </div>`
    }

    for (const slotKey of ['weapon', 'breastplate', 'offhand']) {
      const piece = equippedGear?.[slotKey] ?? null
      const card  = document.createElement('div')
      card.className = `eq-card${piece ? ` gear-tier-${piece.tier}` : ' eq-card-empty'}`
      card.dataset.slot = slotKey

      if (piece) {
        const DETRIM_SET = new Set(['brittleArmor', 'barbedGear', 'manaDrain'])
        const statsHtml = Object.entries(piece.stats ?? {})
          .sort(([a], [b]) => (DETRIM_SET.has(a) ? 1 : 0) - (DETRIM_SET.has(b) ? 1 : 0))
          .map(([s, v]) => _statHtml(s, v)).filter(Boolean).join('')
        const artBg = TIER_ART_BG[piece.tier] ?? ''
        card.innerHTML = `
          <div class="eq-card-name">${piece.name}</div>
          <div class="eq-card-art" style="background-image:${artBg}"><img class="eq-slot-img" src="${_gImg(slotKey, piece.tier)}" alt=""></div>
          <div class="eq-card-tier-badge tier-${piece.tier}">${TIER_LABELS[piece.tier] ?? piece.tier}</div>
          <div class="eq-card-stats">${statsHtml}</div>
          <div class="eq-card-tap">Tap to swap</div>
        `
      } else {
        card.innerHTML = `
          <div class="eq-card-name">${SLOT_LABEL[slotKey]}</div>
          <div class="eq-card-art eq-card-art-empty"><img class="eq-slot-img" src="${_gImg(slotKey, 'default')}" alt=""></div>
          <div class="eq-card-empty-label">Empty</div>
          <div class="eq-card-tap">Tap to equip</div>
        `
      }
      gearRow.appendChild(card)
    }

    // Summary: HP+Thorns collapsed → Health; NegDrain+DmgNeg collapsed → Dmg Neg
    const summaryEl = document.getElementById('equipment-stats-summary')
    if (summaryEl) {
      const totals = {}
      for (const piece of Object.values(equippedGear ?? {})) {
        if (!piece) continue
        for (const [stat, val] of Object.entries(piece.stats ?? {})) {
          totals[stat] = (totals[stat] ?? 0) + val
        }
      }
      const _chip = (label, dot, display, bad) =>
        `<span class="equip-sum-stat"><span class="equip-sum-dot" style="background:${dot}"></span><span class="equip-sum-label">${label}</span><span class="equip-sum-val${bad ? ' bad' : ''}">${display}</span></span>`
      const parts = []
      const atk = totals.damageBonus ?? 0
      if (atk !== 0) parts.push(_chip('Attack', '#ff6633', atk > 0 ? `+${atk}` : `${atk}`, atk < 0))
      const hp = (totals.maxHpPct ?? 0) + (totals.barbedGear ?? 0)
      if (hp !== 0) parts.push(_chip('Health', '#e74c3c', `${hp > 0 ? '+' : ''}${hp}%`, hp < 0))
      const neg = Math.round((totals.negation ?? 0) * 100) + (totals.brittleArmor ?? 0)
      if (neg !== 0) parts.push(_chip('Block', '#44aaff', `${neg > 0 ? '+' : ''}${neg}%`, neg < 0))
      const mana = totals.maxManaPct ?? 0
      if (mana !== 0) parts.push(_chip('Mana', '#7766ff', mana > 0 ? `+${mana}%` : `${mana}%`, mana < 0))
      const def = totals.damageReduction ?? 0
      if (def !== 0) parts.push(_chip('Def', '#44cc88', def > 0 ? `+${def}` : `${def}`, def < 0))
      const drain = totals.manaDrain ?? 0
      if (drain !== 0) parts.push(_chip('Drain', '#aa44cc', `${drain}`, true))
      summaryEl.innerHTML = parts.join('')
    }

    const spEl = document.getElementById('equipment-safe-pocket')
    if (spEl) {
      const spId = safePocketTrinket?.id
      const item = spId ? ITEMS[spId] : null
      if (item) {
        const rarity = item.rarity ?? 'common'
        spEl.className = `eq-safe-pocket eq-safe-pocket-filled rarity-${rarity}`
        const art = item.spriteSrc
          ? `<img class="eq-safe-pocket-img" src="${item.spriteSrc}" alt="">`
          : `<span class="eq-safe-pocket-emoji">${item.icon ?? '🧿'}</span>`
        spEl.innerHTML = `
          <div class="eq-safe-pocket-label">Safe Pocket</div>
          ${art}
          <div class="eq-safe-pocket-name">${item.name}</div>
          <div class="eq-safe-pocket-tap">Tap to swap</div>
        `
      } else {
        spEl.className = 'eq-safe-pocket eq-safe-pocket-empty'
        spEl.innerHTML = `
          <div class="eq-safe-pocket-label">Safe Pocket</div>
          <span class="eq-safe-pocket-emoji">🧿</span>
          <div class="eq-safe-pocket-empty-label">Empty</div>
          <div class="eq-safe-pocket-tap">Tap to equip</div>
        `
      }
    }

    ov.classList.add('is-open')
    ov.setAttribute('aria-hidden', 'false')
  },

  hideEquipmentOverlay() {
    if (!el.equipmentOverlay) return
    el.equipmentOverlay.classList.remove('is-open')
    el.equipmentOverlay.setAttribute('aria-hidden', 'true')
  },

  renderCompareModal(candidate, equipped, onEquip, onCancel, onTrash) {
    const modal = el.gearCompareModal
    if (!modal) return
    modal.querySelector('.cmp-stat-panel')?.classList.remove('hidden')
    document.getElementById('cmp-trinket-details')?.classList.add('hidden')
    modal.querySelector('.cmp-trash-row')?.classList.remove('hidden')
    const STAT_LABELS = {
      damageBonus:     'Attack',
      maxHpPct:        'Max HP',
      maxManaPct:      'Max Mana',
      negation:        'Block Chance',
      damageReduction: 'Dmg Reduction',
      brittleArmor:    'Brittle Guard',
      barbedGear:      'Thorns',
      manaDrain:       'Mana Drain',
    }

    const allStats = new Set([
      ...Object.keys(candidate.stats ?? {}),
      ...Object.keys(equipped?.stats ?? {}),
    ])

    const _valCls = v => (v > 0 ? 'cmp-val-pos' : v < 0 ? 'cmp-val-neg' : '')
    const rows = [...allStats].map(stat => {
      const newVal = candidate.stats?.[stat] ?? 0
      const oldVal = equipped?.stats?.[stat]  ?? 0
      const delta  = newVal - oldVal
      const sign   = delta > 0 ? '+' : ''
      const dCls   = delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : ''
      const label  = STAT_LABELS[stat] ?? stat
      const fmtVal = v => stat === 'negation' ? `${Math.round(v * 100)}%` : stat === 'barbedGear' ? `${v}HP` : stat === 'brittleArmor' ? `${v}%` : v
      return `<tr>
        <td class="cmp-stat-label">${label}</td>
        <td class="cmp-new-val ${_valCls(newVal)}">${fmtVal(newVal)}</td>
        <td class="cmp-old-val ${equipped ? _valCls(oldVal) : ''}">${equipped ? fmtVal(oldVal) : '—'}</td>
        <td class="cmp-delta ${dCls}">${delta !== 0 ? sign + fmtVal(delta) : '—'}</td>
      </tr>`
    }).join('')

    _renderCompareItemSide(modal.querySelector('.cmp-candidate'), candidate, 'gear')
    _renderCompareItemSide(modal.querySelector('.cmp-equipped'), equipped, 'gear')
    modal.querySelector('.cmp-stat-table tbody').innerHTML = rows

    const equipBtn  = modal.querySelector('.cmp-equip-btn')
    const cancelBtn = modal.querySelector('.cmp-cancel-btn')
    const trashBtn  = modal.querySelector('.cmp-trash-btn')
    const newEquipBtn  = equipBtn.cloneNode(true)
    const newCancelBtn = cancelBtn.cloneNode(true)
    const newTrashBtn  = trashBtn.cloneNode(true)
    newEquipBtn.textContent = 'Equip'
    equipBtn.replaceWith(newEquipBtn)
    cancelBtn.replaceWith(newCancelBtn)
    const scrapGain = CONFIG?.blacksmith?.trashScrapYield?.[candidate?.tier] ?? 1
    newTrashBtn.textContent = `🗑 Trash (+${scrapGain} ⚙️ scrap)`
    trashBtn.replaceWith(newTrashBtn)
    newEquipBtn.addEventListener('click',  onEquip)
    newCancelBtn.addEventListener('click', onCancel)
    newTrashBtn.addEventListener('click',  onTrash ?? onCancel)

    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  },

  renderSafePocketCompareModal(candidateDef, equippedDef, onEquip, onCancel) {
    const modal = el.gearCompareModal
    if (!modal || !candidateDef) return
    modal.querySelector('.cmp-stat-panel')?.classList.add('hidden')
    modal.querySelector('.cmp-trash-row')?.classList.add('hidden')
    const detailsEl = document.getElementById('cmp-trinket-details')
    if (detailsEl) {
      detailsEl.classList.remove('hidden')
      const effects = (candidateDef.details ?? []).map(d =>
        `<div class="cmp-trinket-effect"><strong>${d.label}:</strong> ${d.desc}</div>`,
      ).join('')
      detailsEl.innerHTML = `
        <p class="cmp-trinket-blurb">${candidateDef.blurb ?? ''}</p>
        <div class="cmp-trinket-effects">${effects}</div>
      `
    }
    _renderCompareItemSide(modal.querySelector('.cmp-candidate'), candidateDef, 'trinket')
    _renderCompareItemSide(modal.querySelector('.cmp-equipped'), equippedDef, 'trinket')

    const equipBtn  = modal.querySelector('.cmp-equip-btn')
    const cancelBtn = modal.querySelector('.cmp-cancel-btn')
    const newEquipBtn  = equipBtn.cloneNode(true)
    const newCancelBtn = cancelBtn.cloneNode(true)
    newEquipBtn.textContent = 'Equip to Safe Pocket'
    equipBtn.replaceWith(newEquipBtn)
    cancelBtn.replaceWith(newCancelBtn)
    newEquipBtn.addEventListener('click', onEquip)
    newCancelBtn.addEventListener('click', onCancel)

    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
  },

  hideCompareModal() {
    if (!el.gearCompareModal) return
    el.gearCompareModal.classList.add('hidden')
    el.gearCompareModal.setAttribute('aria-hidden', 'true')
  },

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
    let earnedLine = ''
    if (stats.xpEarned != null) {
      const xpLost = stats.xpLost ?? 0
      const xpPart = xpLost > 0
        ? `+${stats.xpEarned} XP earned &nbsp;→&nbsp; <span class="xp-kept">+${stats.xpRetained} kept</span> <span class="xp-lost">(−${xpLost} lost)</span>`
        : `+${stats.xpEarned} XP`
      earnedLine = `<div class="stats">${xpPart} &nbsp;|&nbsp; +${stats.goldBanked} 💰 banked</div>`
    }

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

  showMainMenu() {
    this.resetFloorTheme()
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
    const positions = { easy: 'pos-0', normal: 'pos-1', hard: 'pos-2' }
    const xpLabels  = { easy: 'Keep all XP on death', normal: 'Keep 50% XP on death', hard: 'Keep 10% XP on death' }
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === diff)
    })
    const skull = document.getElementById('diff-skull')
    if (skull) {
      skull.classList.remove('pos-0', 'pos-1', 'pos-2')
      skull.classList.add(positions[diff] ?? 'pos-1')
    }
    const label = document.getElementById('diff-label')
    if (label) label.textContent = xpLabels[diff] ?? ''
  },

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

  renderBlacksmithScreen(equippedGear, gold, scrap, selectedSlot, callbacks) {
    const overlay = document.getElementById('blacksmith-overlay')
    if (!overlay) return
    overlay.classList.remove('hidden')

    // Currencies
    const goldEl  = document.getElementById('bs-gold-display')
    const scrapEl = document.getElementById('bs-scrap-display')
    if (goldEl)  goldEl.textContent  = `🪙 ${gold}`
    if (scrapEl) scrapEl.textContent = `⚙️ ${scrap}`

    const GEAR_IMGS = {
      weapon:     { default: 'assets/sprites/Items/sword.png', common: 'assets/sprites/gear/weapon/common.webp', rare: 'assets/sprites/gear/weapon/rare.webp', epic: 'assets/sprites/gear/weapon/epic.webp', legendary: 'assets/sprites/gear/weapon/legendary.webp' },
      breastplate:{ default: 'assets/sprites/Items/armor.png', common: 'assets/sprites/gear/breastplate/common.webp', rare: 'assets/sprites/gear/breastplate/rare.webp', epic: 'assets/sprites/gear/breastplate/epic.webp', legendary: 'assets/sprites/gear/breastplate/legendary.webp' },
      offhand:    { default: 'assets/sprites/Items/shield.png', common: 'assets/sprites/gear/offhand/common.webp', rare: 'assets/sprites/gear/offhand/rare.webp', epic: 'assets/sprites/gear/offhand/epic.webp', legendary: 'assets/sprites/gear/offhand/legendary.webp' },
    }
    const _gImg = (slot, tier) => GEAR_IMGS[slot]?.[tier] ?? GEAR_IMGS[slot]?.default ?? ''

    const STAT_LABELS = {
      damageBonus:     'Attack',
      maxHpPct:        'Max HP',
      maxManaPct:      'Max Mana',
      negation:        'Block Chance',
      damageReduction: 'Dmg Reduction',
      brittleArmor:    'Brittle Guard',
      barbedGear:      'Barbed Gear',
      manaDrain:       'Mana Drain',
    }
    const STAT_SHORT = {
      damageBonus: 'Atk', maxHpPct: 'HP', maxManaPct: 'Mana',
      negation: 'Block', damageReduction: 'Def',
      brittleArmor: 'BG', barbedGear: 'Thorns', manaDrain: 'Drain',
    }
    const PCT_KEYS      = new Set(['maxHpPct', 'maxManaPct', 'xpPct', 'goldPct', 'brittleArmor', 'barbedGear', 'manaDrain'])
    const DETRIMENT_KEYS = new Set(['brittleArmor', 'barbedGear', 'manaDrain'])
    const TIER_COLOR    = { common: '#888', rare: '#4a9eff', epic: '#a855f7', legendary: '#ffd700' }
    const TIER_LABELS   = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

    function fmtVal(key, val) {
      if (val === 0 || val == null) return '—'
      if (key === 'negation') return `${Math.round(val * 100)}%`
      const sign = val > 0 ? '+' : ''
      return PCT_KEYS.has(key) ? `${sign}${val}%` : `${sign}${val}`
    }
    function projectVal(key, val) {
      if (val < 0) return val
      if (key === 'negation') return Math.round(val * 1.25 * 1000) / 1000
      return Math.max(1, Math.round(val * 1.25))
    }

    const piece = selectedSlot ? (equippedGear[selectedSlot] ?? null) : null

    // ── Forge slot ──────────────────────────────────
    const forgeSlot = document.getElementById('bs-forge-slot')
    const forgeImg  = document.getElementById('bs-forge-img')
    const forgeHint = document.getElementById('bs-forge-hint')
    if (forgeSlot) {
      if (piece) {
        forgeSlot.classList.add('has-piece')
        if (forgeImg) { forgeImg.src = _gImg(piece.slot, piece.tier); forgeImg.style.display = 'block' }
        if (forgeHint) forgeHint.textContent = ''
      } else {
        forgeSlot.classList.remove('has-piece')
        if (forgeImg) forgeImg.style.display = 'none'
        if (forgeHint) forgeHint.textContent = 'Select a piece below'
      }
    }

    // ── Upgrade gems ────────────────────────────────
    const upgradeCount = piece?.upgradeCount ?? 0
    document.getElementById('bs-gems')?.querySelectorAll('.bs-gem').forEach(gem => {
      const n = parseInt(gem.dataset.gem)
      gem.classList.remove('done', 'next', 'locked')
      if (n <= upgradeCount)           gem.classList.add('done')
      else if (n === upgradeCount + 1) gem.classList.add('next')
      else                             gem.classList.add('locked')
    })

    // ── Item details ────────────────────────────────
    const detailEl = document.getElementById('bs-detail-content')
    if (detailEl) {
      if (!piece) {
        detailEl.innerHTML = '<p class="bs-detail-hint">Select a gear piece to view details</p>'
      } else {
        const atMax     = piece.upgradeCount >= 3
        const tierLabel = TIER_LABELS[piece.tier] ?? piece.tier
        const curHdr    = piece.upgradeCount === 0 ? 'Base' : `Current (T${piece.upgradeCount})`
        const newHdr    = atMax ? 'MAX' : `New (T${piece.upgradeCount + 1})`
        const newColor  = atMax ? 'rgba(255,255,255,0.3)' : '#ffd070'
        const statRows  = Object.entries(piece.stats).map(([k, v]) => {
          const label  = STAT_LABELS[k] ?? k
          const curFmt = fmtVal(k, v)
          const newFmt = fmtVal(k, projectVal(k, v))
          const curCls = v < 0 ? 'bs-val-neg' : 'bs-val-pos'
          const newCls = v < 0 ? 'bs-val-same' : (atMax ? 'bs-val-same' : 'bs-val-upg')
          return `<tr><td>${label}</td><td class="${curCls}">${curFmt}</td><td class="${newCls}">${newFmt}</td></tr>`
        }).join('')
        detailEl.innerHTML = `
          <p class="bs-detail-title">${piece.name} <span style="color:${TIER_COLOR[piece.tier] ?? '#888'};font-size:0.8em">(${tierLabel})</span></p>
          <table class="bs-stat-tbl">
            <thead><tr>
              <th>Stat</th><th>${curHdr}</th><th style="color:${newColor}">${newHdr}</th>
            </tr></thead>
            <tbody>${statRows}</tbody>
          </table>`
      }
    }

    // ── Gear cards ──────────────────────────────────
    const gearRow = document.getElementById('bs-gear-row')
    if (gearRow) {
      gearRow.innerHTML = ''
      for (const slot of ['weapon', 'breastplate', 'offhand']) {
        const p   = equippedGear[slot]
        const card = document.createElement('div')
        const isSelected = slot === selectedSlot
        card.className = `bs-gear-card${isSelected ? ' bs-selected' : ''}${!p ? ' bs-empty' : ` bs-tier-${p.tier}`}`
        const lbl = slot.charAt(0).toUpperCase() + slot.slice(1)
        if (!p) {
          card.innerHTML = `<span class="bs-card-slot-lbl">${lbl}</span>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.3;font-size:1.6rem">–</div>
            <span class="bs-card-stats" style="color:rgba(255,255,255,0.2);font-style:italic">Empty</span>`
        } else {
          const statLines = Object.entries(p.stats).slice(0, 3).map(([k, v]) => {
            const s = STAT_SHORT[k] ?? k
            const neg = v < 0
            const d = k === 'negation' ? `${Math.round(v*100)}%` : PCT_KEYS.has(k) ? `${v>0?'+':''}${v}%` : `${v>0?'+':''}${v}`
            return `<span class="${neg ? 'bs-card-stat-neg' : ''}">${s}: ${d}</span>`
          }).join('<br>')
          card.innerHTML = `<span class="bs-card-slot-lbl">${lbl}</span>
            <img class="bs-card-img" src="${_gImg(p.slot, p.tier)}" alt="${p.name}">
            <div class="bs-card-stats">${statLines}</div>`
          card.addEventListener('click', () => callbacks.onSelectSlot(slot))
        }
        gearRow.appendChild(card)
      }
    }

    // ── Action buttons ──────────────────────────────
    const upgradeBtn  = document.getElementById('bs-upgrade-btn')
    const upgradeCost = document.getElementById('bs-upgrade-cost')
    const refineBtn   = document.getElementById('bs-refine-btn')
    if (!upgradeBtn || !refineBtn) return

    if (!piece) {
      upgradeBtn.disabled = true
      refineBtn.disabled  = true
      if (upgradeCost) upgradeCost.textContent = ''
      upgradeBtn.onclick = null
      refineBtn.onclick  = null
      return
    }

    const atMax   = piece.upgradeCount >= 3
    const nextNum = piece.upgradeCount + 1
    const cost    = CONFIG?.blacksmith?.upgradeCosts?.[piece.tier]?.[nextNum]
    const canUpg  = !atMax && cost && gold >= cost.gold && scrap >= cost.scrap
    upgradeBtn.disabled = !canUpg
    if (upgradeCost) {
      upgradeCost.textContent = atMax
        ? '✓ Fully Upgraded'
        : cost ? `🪙${cost.gold}  ⚙️${cost.scrap}  (${Math.round(cost.rate * 100)}%)` : ''
    }
    upgradeBtn.onclick = canUpg ? () => callbacks.onUpgrade(selectedSlot) : null

    // Refine = reduce first eligible detriment (post-T3)
    const firstDetrim = atMax
      ? Object.entries(piece.stats).find(([k, v]) => DETRIMENT_KEYS.has(k) && v < -1)
      : null
    const dcost    = firstDetrim ? CONFIG?.blacksmith?.detrimentReduceCost?.[piece.tier] : null
    const canRefine = !!(firstDetrim && dcost && gold >= dcost.gold && scrap >= dcost.scrap)
    refineBtn.disabled = !canRefine
    refineBtn.onclick  = canRefine
      ? () => callbacks.onReduceDetriment(selectedSlot, firstDetrim[0])
      : null
  },

  showBlacksmithResult(success, piece) {
    const el2 = document.getElementById('blacksmith-result-msg')
    if (!el2) return
    el2.textContent = success
      ? `✅ ${piece?.name ?? 'Gear'} upgraded successfully!`
      : `❌ Upgrade failed — materials lost.`
    el2.className = `blacksmith-result ${success ? 'success' : 'fail'}`
    el2.classList.remove('hidden')
    clearTimeout(el2._timeout)
    el2._timeout = setTimeout(() => el2.classList.add('hidden'), 3000)
  },

  showBestiaryDiscovery(enemyId) {
    return new Promise((resolve) => {
      const def = ENEMY_DEFS[enemyId]
      if (!def || !el.bestiaryDiscoveryOverlay) {
        resolve()
        return
      }
      fillBestiaryCreatureParts({
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

  showMouseIntro() {
    return new Promise((resolve) => {
      const info = TILE_BLURBS.mouse
      if (!info || !el.bestiaryDiscoveryOverlay) { resolve(); return }
      if (el.bestiaryDiscoveryGif) {
        el.bestiaryDiscoveryGif.removeAttribute('src')
        el.bestiaryDiscoveryGif.classList.add('hidden')
      }
      if (el.bestiaryDiscoveryEmoji) {
        el.bestiaryDiscoveryEmoji.textContent = info.emoji ?? '🐭'
        el.bestiaryDiscoveryEmoji.classList.remove('hidden')
      }
      if (el.bestiaryDiscoveryName) el.bestiaryDiscoveryName.textContent = info.label
      if (el.bestiaryDiscoveryType) el.bestiaryDiscoveryType.textContent = 'Dungeon hazard'
      if (el.bestiaryDiscoveryBlurb) el.bestiaryDiscoveryBlurb.textContent = info.introBlurb ?? info.blurb

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

  showBestiaryDetail(enemyId) {
    const def = ENEMY_DEFS[enemyId]
    if (!def || !el.bestiaryDetailOverlay) return
    fillBestiaryCreatureParts({
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
        card.addEventListener('click', () => this.showBestiaryDetail(id))
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

  showTrinketDiscovery(itemId) {
    return new Promise((resolve) => {
      const def = ITEMS[itemId]
      if (!def || !el.trinketDiscoveryOverlay) { resolve(); return }
      fillTrinketCard({
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

  showTrinketDetail(itemId) {
    const def = ITEMS[itemId]
    if (!def || !el.trinketDetailOverlay) return
    fillTrinketCard({
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
        card.addEventListener('click', () => this.showTrinketDetail(id))
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
        drawSettledDice(resultCanvas, r1, r2)
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
          const descHtml = item.blurb
            ? `<div class="trinket-trader-card-desc">${item.blurb}</div>`
            : ''
          btn.innerHTML = `
            <div class="trinket-trader-card-art">${artHtml}</div>
            <div class="trinket-trader-card-info">
              <div class="trinket-trader-card-name">${item.name}</div>
              <div class="trinket-trader-card-rarity trinket-rarity-${rarity}">${rarity.charAt(0).toUpperCase() + rarity.slice(1)}</div>
              ${descHtml}
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
  }
}
