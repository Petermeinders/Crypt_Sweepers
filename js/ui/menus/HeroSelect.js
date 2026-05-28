import { CHARACTERS } from '../../data/characters.js'
import { WARRIOR_UPGRADES } from '../../data/upgrades.js'
import { RANGER_UPGRADES } from '../../data/ranger.js'
import { ENGINEER_UPGRADES } from '../../data/engineer.js'
import { MAGE_UPGRADES } from '../../data/mage.js'
import { NECROMANCER_UPGRADES } from '../../data/necromancer.js'
import { VAMPIRE_UPGRADES } from '../../data/vampire.js'
import { metaCharSave, heroIsGoldLocked } from './shared.js'

let heroIdx = 0
let selectedUpgradeId = null
let heroAttackTimer = null
let heroScrollSkip = false

function heroSlideGrid(idx) {
  const slide = document.querySelector(`#hero-select-scroll .hero-select-slide[data-hero-index="${idx}"]`)
  return slide?.querySelector('.hero-upgrades-grid') ?? null
}

function onHeroPortraitClick(e) {
  const img = e.target.closest('.hero-display-gif')
  if (!img) return
  const slide = img.closest('.hero-select-slide')
  if (!slide) return
  const i = Number(slide.dataset.heroIndex)
  if (i !== heroIdx) return
  const char = CHARACTERS[heroIdx]
  if (!char.attackGif || heroAttackTimer) return
  const gifEl = slide.querySelector('.hero-display-gif')
  if (!gifEl) return
  gifEl.src = char.attackGif + '?t=' + Date.now()
  heroAttackTimer = setTimeout(() => {
    heroAttackTimer = null
    if (CHARACTERS[heroIdx] === char && char.gif) {
      gifEl.src = char.gif + '?t=' + Date.now()
    }
  }, char.attackMs ?? 4000)
}

function ensureHeroSelectSlides(ctx) {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll) return
  const first = scroll.children[0]
  const structureOk = first?.querySelector('.hero-doorway')
  if (scroll.children.length === CHARACTERS.length && structureOk) return
  scroll.innerHTML = ''
  CHARACTERS.forEach((char, i) => {
    const slide = document.createElement('section')
    slide.className = 'hero-select-slide'
    slide.dataset.heroIndex = String(i)
    slide.dataset.hero      = char.id
    slide.innerHTML = `
      <div class="hero-doorway">
        <div class="altar-ring" aria-hidden="true"></div>
        <div class="altar-ring inner" aria-hidden="true"></div>
        <div class="altar-hero-glow" aria-hidden="true"></div>
        <div class="hero-particles" aria-hidden="true"></div>
        <div class="hero-upgrades-col left" data-col="left"></div>
        <div class="hero-upgrades-col right" data-col="right"></div>
        <div class="hero-display-wrap">
          <img class="hero-display-gif" src="" alt="">
          <div class="hero-display-emoji hidden"></div>
          <div class="hero-locked-overlay hidden">
            <div class="hero-lock-icon">🔒</div>
            <div class="hero-lock-label">Locked</div>
          </div>
        </div>
      </div>
      <div class="hero-select-namewrap">
        <div class="hero-select-name"></div>
        <div class="hero-select-tagline"></div>
        <div class="hero-select-xp-row">
          <span class="hero-stat-gold">💰 <span class="hero-stat-gold-val">0</span></span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-stat-lv">LV <span class="hero-select-lvl">1</span></span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-stat-xp">XP <span class="hero-select-xp">0</span></span>
        </div>
        <div class="hero-select-base-stats-row">
          <span class="hero-base-stat hero-base-hp">❤️ ${char.baseHP}</span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-base-stat hero-base-mana">🔵 ${char.baseMana}</span>
          <span class="hero-stat-sep">·</span>
          <span class="hero-base-stat hero-complexity hero-complexity--${char.complexity.toLowerCase()}">${char.complexity}</span>
        </div>
      </div>
      <div class="hero-upgrades-grid" hidden></div>
      <div class="hero-passive-wrap" hidden>
        <div class="hero-passive-accordion">
          <button type="button" class="hero-passive-accordion-toggle" aria-expanded="false">
            <span>Passives &amp; Extra Upgrades</span>
            <span class="accordion-chevron">▸</span>
          </button>
          <div class="hero-passive-accordion-body">
            <div class="hero-passive-upgrades-grid"></div>
          </div>
        </div>
      </div>
    `
    const particlesEl = slide.querySelector('.hero-particles')
    for (let p = 0; p < 18; p++) {
      const mote = document.createElement('span')
      mote.className = 'hero-particle'
      const size = 1 + Math.random() * 3
      mote.style.left             = (Math.random() * 100) + '%'
      mote.style.width            = size + 'px'
      mote.style.height           = size + 'px'
      mote.style.animationDuration = (6 + Math.random() * 10) + 's'
      mote.style.animationDelay    = (-Math.random() * 10) + 's'
      mote.style.setProperty('--dx', ((Math.random() - 0.5) * 80) + 'px')
      mote.style.opacity           = String(0.4 + Math.random() * 0.5)
      particlesEl.appendChild(mote)
    }
    scroll.appendChild(slide)
  })
  wireHeroSelectScroll(ctx)
}

function wireHeroSelectScroll(ctx) {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll || scroll.dataset.heroScrollWired === '1') return
  scroll.dataset.heroScrollWired = '1'
  const settle = () => {
    if (heroScrollSkip) return
    onHeroScrollSettled(ctx)
  }
  let debounceTimer = null
  scroll.addEventListener('scroll', () => {
    if (heroScrollSkip) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(settle, 200)
  }, { passive: true })
}

function onHeroScrollSettled(ctx) {
  const scroll = document.getElementById('hero-select-scroll')
  if (!scroll) return
  const w = scroll.clientWidth
  if (w <= 0) return
  const idx = Math.round(scroll.scrollLeft / w)
  const clamped = Math.max(0, Math.min(CHARACTERS.length - 1, idx))
  if (clamped === heroIdx) return
  heroIdx = clamped
  selectedUpgradeId = null
  renderHeroSelect(ctx, { skipScrollSync: true })
}

function navHeroSelect(ctx, delta) {
  const next = Math.min(CHARACTERS.length - 1, Math.max(0, heroIdx + delta))
  if (next === heroIdx) return
  heroIdx = next
  selectedUpgradeId = null
  renderHeroSelect(ctx, { scrollBehavior: 'smooth' })
}

function renderHeroDots(ctx, idx) {
  const wrap = document.getElementById('hero-pagination-dots')
  if (!wrap) return
  if (wrap.children.length !== CHARACTERS.length) {
    wrap.innerHTML = ''
    CHARACTERS.forEach((char, i) => {
      const dot = document.createElement('span')
      dot.className = 'hero-dot'
      dot.dataset.hero = char.id
      dot.dataset.heroIndex = String(i)
      dot.addEventListener('click', () => {
        navHeroSelect(ctx, Number(dot.dataset.heroIndex) - heroIdx)
      })
      wrap.appendChild(dot)
    })
  }
  Array.from(wrap.children).forEach((dot, i) => {
    dot.classList.toggle('is-active', i === idx)
  })
}

function openHeroSelect(ctx) {
  const s = ctx.GameController.getSave()
  heroIdx = CHARACTERS.findIndex(c => c.id === (s.selectedCharacter ?? 'warrior'))
  if (heroIdx < 0) heroIdx = 0
  selectedUpgradeId = null
  document.getElementById('hero-select-overlay').classList.remove('hidden')
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ensureHeroSelectSlides(ctx)
      renderHeroSelect(ctx, { scrollBehavior: 'instant' })
    })
  })
}

function renderHeroSelect(ctx, opts = {}) {
  const skipScrollSync  = opts.skipScrollSync === true
  const scrollBehavior  = opts.scrollBehavior ?? 'instant'
  ensureHeroSelectSlides(ctx)
  const s = ctx.GameController.getSave()
  const goldValEl = document.getElementById('hero-select-gold-val')
  if (goldValEl) goldValEl.textContent = s.persistentGold

  const scroll = document.getElementById('hero-select-scroll')
  const overlay = document.getElementById('hero-select-overlay')
  if (overlay) overlay.dataset.hero = CHARACTERS[heroIdx]?.id ?? ''

  CHARACTERS.forEach((char, i) => {
    const slide = scroll?.children[i]
    if (!slide) return
    slide.classList.toggle('is-current', i === heroIdx)
    const charSave  = char.comingSoon ? { totalXP: 0, upgrades: [] }
      : metaCharSave(s, char.id)
    const isLocked  = !char.comingSoon && heroIsGoldLocked(s, char)
    const xp        = charSave.totalXP ?? 0
    const owned     = charSave.upgrades ?? []
    const isCurrent = i === heroIdx

    slide.querySelector('.hero-select-name').textContent    = char.name
    slide.querySelector('.hero-select-tagline').textContent = char.tagline
    slide.querySelector('.hero-select-xp').textContent      = String(xp)
    const goldPill = slide.querySelector('.hero-stat-gold-val')
    if (goldPill) goldPill.textContent = String(s.persistentGold ?? 0)
    const lvlPill  = slide.querySelector('.hero-select-lvl')
    if (lvlPill) lvlPill.textContent = String(1 + Math.floor(xp / 200))
    const xpRow = slide.querySelector('.hero-select-xp-row')
    if (xpRow) xpRow.style.display = char.comingSoon ? 'none' : ''

    const gifEl   = slide.querySelector('.hero-display-gif')
    const emojiEl = slide.querySelector('.hero-display-emoji')
    if (char.gif) {
      if (isCurrent && !heroAttackTimer) gifEl.src = char.gif + '?t=' + Date.now()
      else if (!isCurrent) gifEl.src = char.gif + '?t=' + Date.now()
      gifEl.style.display   = 'block'
      emojiEl.style.display = 'none'
    } else {
      gifEl.style.display   = 'none'
      gifEl.src             = ''
      emojiEl.textContent   = char.emoji
      emojiEl.style.display = 'block'
    }

    slide.querySelector('.hero-locked-overlay').classList.toggle('hidden', !isLocked)

    const grid = slide.querySelector('.hero-upgrades-grid')
    renderHeroUpgradeGrid(ctx, grid, char, owned, xp, isLocked)
  })

  document.getElementById('hero-prev').classList.toggle('hidden', heroIdx === 0)
  document.getElementById('hero-next').classList.toggle('hidden', heroIdx === CHARACTERS.length - 1)

  const char = CHARACTERS[heroIdx]
  renderHeroDots(ctx, heroIdx)

  const isSelected = s.selectedCharacter === char.id
  const isLocked   = !char.comingSoon && heroIsGoldLocked(s, char)
  const selectBtn  = document.getElementById('hero-select-btn')
  const labelEl    = selectBtn.querySelector('.hero-cta-label')
  const subEl      = selectBtn.querySelector('.hero-cta-sub')
  const setCTA = (label, sub, mode, disabled) => {
    if (labelEl) labelEl.textContent = label
    if (subEl) {
      subEl.textContent = sub ?? ''
      subEl.classList.toggle('hidden', !sub)
    }
    selectBtn.dataset.mode = mode
    selectBtn.disabled = disabled
  }
  if (char.comingSoon) {
    setCTA('Coming Soon', '', 'coming-soon', true)
  } else if (isLocked) {
    setCTA('Unlock', `${char.unlockCost}💰`, 'unlock', !ctx.MetaProgression.canUnlockHero(s, char.id))
  } else if (isSelected) {
    setCTA('Selected', '', 'select', true)
  } else {
    setCTA('Select', '', 'select', false)
  }

  if (!skipScrollSync && scroll && scroll.clientWidth > 0) {
    heroScrollSkip = true
    scroll.scrollTo({ left: heroIdx * scroll.clientWidth, behavior: scrollBehavior })
    const ms = scrollBehavior === 'smooth' ? 520 : 60
    setTimeout(() => { heroScrollSkip = false }, ms)
  }
}

function syncHeroUpgradeDetail(ctx, char, ownedList, xp, isLocked) {
  if (!selectedUpgradeId) {
    renderUpgradeDetail(ctx, null)
    return
  }
  const def = char.upgrades[selectedUpgradeId]
  if (!def) {
    selectedUpgradeId = null
    renderUpgradeDetail(ctx, null)
    return
  }
  const isOwned = ownedList.includes(selectedUpgradeId)
  const prereqOk = !def.requires || ownedList.includes(def.requires)
  const canAfford = !isOwned && xp >= def.xpCost && !isLocked && prereqOk
  renderUpgradeDetail(ctx, selectedUpgradeId, def, isOwned, canAfford)
}

function renderHeroUpgradeSimpleSlot(ctx, grid, char, id, def, ownedList, xp, isLocked) {
  const isOwned    = ownedList.includes(id)
  const prereqOk   = !def.requires || ownedList.includes(def.requires)
  const isSelected = id === selectedUpgradeId

  // Glow while the ability or any of its mastery upgrades can still be purchased
  const hasUpgradesAvailable = !isOwned || Object.entries(char.upgrades).some(
    ([uid, udef]) => udef.masteryOf === id && !ownedList.includes(uid)
  )

  const btn = document.createElement('button')
  btn.className = 'hero-upgrade-slot'
    + (isOwned              ? ' owned'              : '')
    + (isSelected           ? ' selected'           : '')
    + (hasUpgradesAvailable ? ' has-upgrades-available' : '')
  const iconHTML = def.iconBgSrc && def.iconSrc
    ? `<span class="hero-upgrade-icon-stack">
         <img class="hero-upgrade-icon-bg" src="${def.iconBgSrc}" alt="" draggable="false"/>
         <img class="hero-upgrade-icon-fg" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>
       </span>`
    : def.iconSrc
      ? `<img class="hero-upgrade-icon-img" src="${def.iconSrc}" alt="${def.name}" draggable="false"/>`
      : `<span class="hero-upgrade-icon">${def.icon}</span>`
  btn.innerHTML = iconHTML
  btn.addEventListener('click', () => {
    selectedUpgradeId = isSelected ? null : id
    const s        = ctx.GameController.getSave()
    const charSave = metaCharSave(s, char.id)
    const locked   = heroIsGoldLocked(s, char)
    const mainGrid = grid.closest('.hero-select-slide')?.querySelector('.hero-upgrades-grid')
    if (mainGrid) {
      renderHeroUpgradeGrid(ctx, mainGrid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, locked)
    }
  })
  grid.appendChild(btn)
}

function renderHeroUpgradeGrid(ctx, grid, char, ownedList, xp, isLocked) {
  if (!grid) return
  grid.innerHTML = ''

  const slide = grid.closest('.hero-select-slide')
  const passiveWrap = slide?.querySelector('.hero-passive-wrap')
  const passiveGrid = slide?.querySelector('.hero-passive-upgrades-grid')
  const colLeft     = slide?.querySelector('.hero-upgrades-col.left')
  const colRight    = slide?.querySelector('.hero-upgrades-col.right')
  if (colLeft)     colLeft.innerHTML     = ''
  if (colRight)    colRight.innerHTML    = ''
  if (passiveGrid) passiveGrid.innerHTML = ''

  // Route perimeter slots: first 6 go around the doorway (3 left, 3 right alternating).
  // Additional slots overflow into the passive/extra accordion.
  let _slotIdx = 0
  const _grid = grid
  const _appendSlot = (el) => {
    const target = (_slotIdx < 6)
      ? ((_slotIdx % 2 === 0 ? colLeft : colRight) ?? _grid)
      : (passiveGrid ?? _grid)
    target.appendChild(el)
    _slotIdx++
  }
  // Shadow grid.appendChild so downstream ricochet/simple-slot code routes automatically.
  grid.appendChild = _appendSlot

  if (char.comingSoon) {
    const msg = document.createElement('p')
    msg.className   = 'passive-coming-soon'
    msg.textContent = 'Abilities & upgrades coming soon…'
    if (colLeft) colLeft.appendChild(msg)
    if (passiveWrap) {
      passiveWrap.hidden = false
      if (passiveGrid) {
        passiveGrid.innerHTML = ''
        const cs = document.createElement('p')
        cs.className   = 'passive-coming-soon'
        cs.textContent = 'Coming Soon…'
        passiveGrid.appendChild(cs)
      }
    }
    return
  }

  for (const [id, def] of Object.entries(char.upgrades)) {
    if (def.masteryOf) continue  // mastery tiers appear in the detail card, not as grid slots
    renderHeroUpgradeSimpleSlot(ctx, grid, char, id, def, ownedList, xp, isLocked)
  }

  if (passiveWrap) {
    passiveWrap.hidden = false
    if (passiveGrid) {
      if (char.id === 'warrior') {
        const killEchoSlot = document.createElement('div')
        killEchoSlot.className = 'hero-passive-builtin'
        killEchoSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">⚔️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Kill Echo <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Each dungeon floor starts by marking the closest unrevealed enemy to the entrance (enemy echo hint). Slaying a marked foe marks the next two closest hidden enemies to that kill; slaying any of those marks up to three at once from the latest kill—capping at three echoes until the floor ends. Fewer valid targets than your limit just marks what exists.</div>
          </div>`
        passiveGrid.appendChild(killEchoSlot)
      }
      if (char.id === 'ranger') {
        const keenEyesSlot = document.createElement('div')
        keenEyesSlot.className = 'hero-passive-builtin'
        keenEyesSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">👁️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Keen Eyes <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Each time you reveal a tile, 50% chance to sense the category of every orthogonally adjacent hidden tile that does not already have a hint (enemy, trap, treasure, etc.).</div>
          </div>`
        passiveGrid.appendChild(keenEyesSlot)
        const trapfinderSlot = document.createElement('div')
        trapfinderSlot.className = 'hero-passive-builtin'
        trapfinderSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🔍</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Trapfinder <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">10% chance on trap damage, fast-tile reveal hits, or fast enemy ambush to reduce that hit by your Trapfinder stack count (starts at rank 1).</div>
          </div>`
        passiveGrid.appendChild(trapfinderSlot)
      }
      if (char.id === 'mage') {
        const phaseWalkSlot = document.createElement('div')
        phaseWalkSlot.className = 'hero-passive-builtin'
        phaseWalkSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🌀</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Phase Walk <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Tiles are reachable diagonally as well as orthogonally — move like a queen, not a rook.</div>
          </div>`
        passiveGrid.appendChild(phaseWalkSlot)
      }
      if (char.id === 'vampire') {
        const cbSlot = document.createElement('div')
        cbSlot.className = 'hero-passive-builtin'
        cbSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🩸</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Corrupted Blood <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">You lose 1 HP on every flip, gain +1 HP per revealed living monster on the board (net = −1 + monsters), and each monster loses 1 HP from its current total — enough damage kills them like a normal defeat (gold/XP, trinkets). Ambush reveals never damage you — tap to fight.</div>
          </div>`
        passiveGrid.appendChild(cbSlot)
        const deSlot = document.createElement('div')
        deSlot.className = 'hero-passive-builtin'
        deSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🌑</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Dark Eyes <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">50% chance per reveal to sense an enemy hint (⚔️) on unrevealed, unreachable enemy tiles only (capped per flip); hints disappear when those tiles become reachable.</div>
          </div>`
        passiveGrid.appendChild(deSlot)
      }
      if (char.id === 'necromancer') {
        const rmSlot = document.createElement('div')
        rmSlot.className = 'hero-passive-builtin'
        rmSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">🧟</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Raise Minion <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">Tap an ash pile (slain enemy) to spend 10 mana and raise one 🧟 minion on that tile — only one per corpse. Minions strike alongside you in combat and absorb the next enemy hit (closest minion takes damage instead of you); when a minion dies, the ash scatters and cannot be raised again. Level-up Minion Mastery picks upgrade their stats.</div>
          </div>`
        passiveGrid.appendChild(rmSlot)

        const msSlot = document.createElement('div')
        msSlot.className = 'hero-passive-builtin'
        msSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">👁️</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Master's Sight <span class="hero-passive-builtin-badge">✓ Applied</span></div>
            <div class="hero-passive-builtin-desc">See through your minions. Whenever you raise a minion, the categories of the tiles surrounding it are revealed (enemy, trap, treasure, etc.) — a glimpse through the minion's dead eyes.</div>
          </div>`
        passiveGrid.appendChild(msSlot)
      }
      if (char.id === 'engineer') {
        const pingSlot = document.createElement('div')
        pingSlot.className = 'hero-passive-builtin'
        pingSlot.innerHTML = `
          <span class="hero-passive-builtin-icon">📡</span>
          <div class="hero-passive-builtin-info">
            <div class="hero-passive-builtin-name">Seismic Ping <span class="hero-passive-builtin-badge">Passive · L1</span></div>
            <div class="hero-passive-builtin-desc">Innate Engineer passive (level 1 from the start). When you finish placing or moving your turret, it <strong>seismic-pings</strong> hidden tiles around it: each shows a category hint (enemy, trap, loot, stairs, etc.) like Keen Eyes, and those tiles briefly pulse. At L1 the ring is the 8 adjacent tiles; future <strong>Seismic Ping masteries</strong> may extend reach.</div>
          </div>`
        passiveGrid.appendChild(pingSlot)
      }
      if (char.id !== 'warrior' && char.id !== 'ranger' && char.id !== 'mage' && char.id !== 'vampire' && char.id !== 'necromancer' && char.id !== 'engineer') {
        const comingSoon = document.createElement('p')
        comingSoon.className = 'passive-coming-soon'
        comingSoon.textContent = 'Coming Soon…'
        passiveGrid.appendChild(comingSoon)
      }
    }
  }

  if (char.id === CHARACTERS[heroIdx].id) {
    syncHeroUpgradeDetail(ctx, char, ownedList, xp, isLocked)
  }
}

function buyUpgradeForChar(ctx, s, charId, upgradeId) {
  if (charId === 'ranger')      return ctx.MetaProgression.buyRangerUpgrade(s, upgradeId)
  if (charId === 'engineer')    return ctx.MetaProgression.buyEngineerUpgrade(s, upgradeId)
  if (charId === 'mage')        return ctx.MetaProgression.buyMageUpgrade(s, upgradeId)
  if (charId === 'necromancer') return ctx.MetaProgression.buyNecromancerUpgrade(s, upgradeId)
  if (charId === 'vampire')     return ctx.MetaProgression.buyVampireUpgrade(s, upgradeId)
  return ctx.MetaProgression.buyUpgrade(s, upgradeId)
}

function renderUpgradeDetail(ctx, id, def, isOwned, canAfford) {
  const backdrop     = document.getElementById('hero-upgrade-backdrop')
  const hintEl       = document.getElementById('hero-upgrade-detail-hint')
  const costEl       = document.getElementById('hero-upgrade-detail-cost')
  const masteriesEl  = document.getElementById('hero-upgrade-detail-masteries')

  if (!id || !def) {
    backdrop.classList.add('hidden')
    return
  }
  backdrop.classList.remove('hidden')
  document.getElementById('hero-upgrade-detail-name').textContent = def.name
  document.getElementById('hero-upgrade-detail-desc').textContent = def.desc

  const char     = CHARACTERS[heroIdx]
  const s        = ctx.GameController.getSave()
  const charSave = metaCharSave(s, char.id)
  const owned    = charSave.upgrades ?? []
  const xp       = charSave.totalXP ?? 0
  const map      = char.id === 'ranger' ? RANGER_UPGRADES
    : char.id === 'engineer' ? ENGINEER_UPGRADES
      : char.id === 'mage' ? MAGE_UPGRADES
        : char.id === 'vampire' ? VAMPIRE_UPGRADES
          : char.id === 'necromancer' ? NECROMANCER_UPGRADES
            : WARRIOR_UPGRADES

  // Cost line
  if (costEl) {
    const parts = []
    if (def.manaCost) parts.push(`${def.manaCost} mana`)
    if (def.hpCost)   parts.push(`${def.hpCost} HP`)
    if (parts.length) {
      costEl.textContent = `Cost: ${parts.join(' / ')} per use`
      costEl.classList.remove('hidden')
    } else {
      costEl.classList.add('hidden')
    }
  }

  // Prereq hint
  const missingPrereq = def.requires && !owned.includes(def.requires)
  if (hintEl) {
    if (missingPrereq && !isOwned) {
      hintEl.textContent = `Requires ${map[def.requires]?.name ?? def.requires} first.`
      hintEl.classList.remove('hidden')
    } else {
      hintEl.classList.add('hidden')
    }
  }

  // Tabbed mastery + expertise system
  const allTiers = Object.entries(map).filter(([, d]) => d.masteryOf === id)
  const tabStrip   = document.getElementById('upgrade-tab-strip')
  const tabContent = document.getElementById('upgrade-tab-content')

  if (masteriesEl && tabStrip && tabContent && allTiers.length > 0) {
    // Separate expertise tiers (no branch field) from named mastery branches
    const expertiseTiers = allTiers.filter(([, d]) => !d.branch)
    const branchMap = {}  // branch name → [[tierId, tierDef], ...]
    for (const [tierId, tierDef] of allTiers) {
      if (!tierDef.branch) continue
      if (!branchMap[tierDef.branch]) branchMap[tierDef.branch] = []
      branchMap[tierDef.branch].push([tierId, tierDef])
    }

    const tabs = []
    if (expertiseTiers.length > 0) tabs.push({ key: 'expertise', label: 'Expertise', kind: 'expertise', tiers: expertiseTiers })
    for (const [branchKey, branchTiers] of Object.entries(branchMap)) {
      const label = branchKey.charAt(0).toUpperCase() + branchKey.slice(1)
      tabs.push({ key: branchKey, label, kind: 'mastery', tiers: branchTiers })
    }

    let activeTab = tabs[0]?.key ?? ''

    function _buildTabContent(tabKey) {
      tabContent.innerHTML = ''
      const tab = tabs.find(t => t.key === tabKey)
      if (!tab) return

      // Mastery path header blurb (not shown for Expertise)
      if (tab.kind === 'mastery') {
        const blurb = document.createElement('div')
        blurb.className = 'upgrade-mastery-blurb'
        blurb.innerHTML = `
          <div class="upgrade-mastery-blurb-title">Mastery: ${tab.label}</div>
          <div class="upgrade-mastery-blurb-note">During a run you can only select one mastery path.</div>`
        tabContent.appendChild(blurb)
      }

      const rail = document.createElement('div')
      rail.className = `upgrade-tier-rail${tab.kind === 'expertise' ? ' tab-expertise-content' : ''}`

      tab.tiers.forEach(([tierId, tierDef], idx) => {
        const tierOwned  = owned.includes(tierId)
        const prereqMet  = !tierDef.requires || owned.includes(tierDef.requires)
        const tierAfford = !tierOwned && prereqMet && xp >= tierDef.xpCost
        const isLast     = idx === tab.tiers.length - 1

        // Roman numerals for the badge
        const numerals = ['I', 'II', 'III', 'IV', 'V']
        const numeral  = numerals[idx] ?? (idx + 1)

        const row = document.createElement('div')
        row.className = 'upgrade-tier-row'

        // Label for the display name — strip branch prefix if present
        // e.g. "Hemorrhage I" → show as "Hemorrhage I" (keep full name)
        const displayName = tierDef.name

        // Button state
        let btnClass, btnText
        if (tierOwned)       { btnClass = 'btn-owned'; btnText = '✓ Owned' }
        else if (tierAfford) { btnClass = 'btn-buy';   btnText = `Unlock: ${tierDef.xpCost} XP` }
        else if (!prereqMet) { btnClass = 'btn-locked'; btnText = 'Locked' }
        else                 { btnClass = 'btn-buy';   btnText = `Unlock: ${tierDef.xpCost} XP` }

        // Connector fill: fill if this tier and next are both owned (visual chain)
        const nextOwned = !isLast && owned.includes(tab.tiers[idx + 1]?.[0])
        const connectorFilled = tierOwned && nextOwned

        row.innerHTML = `
          <div class="upgrade-tier-left">
            <div class="upgrade-tier-badge${tierOwned ? ' owned' : ''}">${numeral}</div>
            ${!isLast ? `<div class="upgrade-tier-connector${connectorFilled ? ' filled' : ''}"></div>` : ''}
          </div>
          <div class="upgrade-tier-body">
            <div class="upgrade-tier-header">
              <span class="upgrade-tier-name${tierOwned ? ' owned' : tierAfford || !prereqMet ? '' : ' locked'}">${displayName}</span>
              <button class="upgrade-tier-btn ${btnClass}" ${tierOwned || (!tierAfford && prereqMet) || !prereqMet ? 'disabled' : ''}>${btnText}</button>
            </div>
            ${tierDef.desc ? `<div class="upgrade-tier-desc${tierOwned ? ' owned' : ''}">${tierDef.desc}</div>` : ''}
          </div>`

        if (!tierOwned && tierAfford) {
          row.querySelector('.upgrade-tier-btn').addEventListener('click', () => {
            const sv = ctx.GameController.getSave()
            if (buyUpgradeForChar(ctx, sv, char.id, tierId)) {
              ctx.SaveManager.save(sv)
              renderHeroSelect(ctx)
            }
          })
        }
        rail.appendChild(row)
      })
      tabContent.appendChild(rail)
    }

    function _buildTabStrip() {
      tabStrip.innerHTML = ''
      tabs.forEach(tab => {
        const btn = document.createElement('button')
        btn.className = `upgrade-tab-btn tab-${tab.kind}${tab.key === activeTab ? ' active' : ''}`
        btn.textContent = tab.label
        btn.addEventListener('click', () => {
          activeTab = tab.key
          _buildTabStrip()
          _buildTabContent(activeTab)
        })
        tabStrip.appendChild(btn)
      })
    }

    _buildTabStrip()
    _buildTabContent(activeTab)
    masteriesEl.classList.remove('hidden')
  } else if (masteriesEl) {
    masteriesEl.classList.add('hidden')
  }

  // Base buy button
  const buyBtn = document.getElementById('hero-upgrade-buy-btn')
  if (isOwned) {
    buyBtn.textContent = '✓ Owned'
    buyBtn.disabled    = true
    buyBtn.onclick     = null
  } else {
    buyBtn.textContent = `Unlock — ${def.xpCost} XP`
    buyBtn.disabled    = !canAfford
    buyBtn.onclick     = () => {
      const sv   = ctx.GameController.getSave()
      const ch   = CHARACTERS[heroIdx]
      if (buyUpgradeForChar(ctx, sv, ch.id, id)) {
        ctx.SaveManager.save(sv)
        selectedUpgradeId = null
        renderHeroSelect(ctx)
      }
    }
  }
}

function updateMenuHeroPreview(ctx) {
  const s    = ctx.GameController.getSave()
  const char = CHARACTERS.find(c => c.id === (s.selectedCharacter ?? 'warrior')) ?? CHARACTERS[0]
  const xp   = metaCharSave(s, s.selectedCharacter ?? 'warrior').totalXP

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

export function wireHeroSelect(ctx) {
  document.getElementById('hero-select-open-btn').addEventListener('click', () => openHeroSelect(ctx))
  document.getElementById('hero-select-back').addEventListener('click', () => {
    document.getElementById('hero-select-overlay').classList.add('hidden')
    updateMenuHeroPreview(ctx)
  })
  document.getElementById('hero-prev').addEventListener('click', () => navHeroSelect(ctx, -1))
  document.getElementById('hero-next').addEventListener('click', () => navHeroSelect(ctx, 1))
  ensureHeroSelectSlides(ctx)
  document.getElementById('hero-select-scroll')?.addEventListener('click', onHeroPortraitClick)
  document.getElementById('hero-select-btn').addEventListener('click', () => {
    const s = ctx.GameController.getSave()
    const char = CHARACTERS[heroIdx]
    const btn = document.getElementById('hero-select-btn')
    if (btn.dataset.mode === 'unlock') {
      if (ctx.MetaProgression.unlockHero(s, char.id)) {
        ctx.SaveManager.save(s)
        renderHeroSelect(ctx)
      }
    } else {
      s.selectedCharacter = char.id
      ctx.SaveManager.save(s)
      renderHeroSelect(ctx)
    }
  })
  document.getElementById('hero-upgrade-backdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('hero-upgrade-backdrop')) {
      selectedUpgradeId = null
      document.getElementById('hero-upgrade-backdrop').classList.add('hidden')
      const s = ctx.GameController.getSave()
      const char = CHARACTERS[heroIdx]
      const charSave = char.comingSoon ? { totalXP: 0, upgrades: [] } : metaCharSave(s, char.id)
      const grid = heroSlideGrid(heroIdx)
      renderHeroUpgradeGrid(ctx, grid, char, charSave.upgrades ?? [], charSave.totalXP ?? 0, !char.comingSoon && heroIsGoldLocked(s, char))
    }
  })
  document.getElementById('hero-select-scroll')?.addEventListener('click', e => {
    const t = e.target.closest('.hero-passive-accordion-toggle')
    if (!t) return
    const acc = t.closest('.hero-passive-accordion')
    if (!acc) return
    const open = acc.classList.toggle('open')
    t.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
}

export { openHeroSelect, renderHeroSelect, updateMenuHeroPreview, ensureHeroSelectSlides }
