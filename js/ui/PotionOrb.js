const gsap = typeof window !== 'undefined' ? window.gsap : null

let _hpImg, _manaImg, _hpBadge, _manaBadge, _hpCur, _hpMax, _manaCur, _manaMax

// ── Public API ────────────────────────────────────────────────────────────
export function initPotionOrb() {
  const wrap = document.getElementById('hud-orb-wrap')
  if (!wrap) return

  wrap.innerHTML = `
    <div class="orb-container">
      <div class="orb-dark"></div>
      <img class="orb-fill orb-fill--hp"   id="pc-orb-hp"   src="assets/sprites/hud/orb-hp.gif"    alt="" draggable="false">
      <img class="orb-fill orb-fill--mana" id="pc-orb-mana" src="assets/sprites/hud/orb-mana.gif"  alt="" draggable="false">
      <img class="orb-frame"               src="assets/sprites/hud/orb-frame.png" alt=""            draggable="false">
      <button class="orb-tap orb-tap--hp"   id="pc-tap-hp"   aria-label="Use HP Potion">
        <span class="orb-val orb-val--hp">
          <span class="orb-val-cur" id="pc-val-hp-cur"></span>
          <span class="orb-val-max" id="pc-val-hp-max"></span>
        </span>
        <span class="orb-badge" id="pc-hp-badge">0</span>
      </button>
      <button class="orb-tap orb-tap--mana" id="pc-tap-mana" aria-label="Use Mana Potion">
        <span class="orb-val orb-val--mana">
          <span class="orb-val-cur" id="pc-val-mana-cur"></span>
          <span class="orb-val-max" id="pc-val-mana-max"></span>
        </span>
        <span class="orb-badge" id="pc-mana-badge">0</span>
      </button>
    </div>`

  _hpImg     = document.getElementById('pc-orb-hp')
  _manaImg   = document.getElementById('pc-orb-mana')
  _hpBadge   = document.getElementById('pc-hp-badge')
  _manaBadge = document.getElementById('pc-mana-badge')
  _hpCur     = document.getElementById('pc-val-hp-cur')
  _hpMax     = document.getElementById('pc-val-hp-max')
  _manaCur   = document.getElementById('pc-val-mana-cur')
  _manaMax   = document.getElementById('pc-val-mana-max')

  // Start fully filled
  _hpImg.style.clipPath   = 'inset(0% 0 0 0)'
  _manaImg.style.clipPath = 'inset(0% 0 0 0)'
}

export function updateOrbHpFill(hp, maxHp) {
  if (!_hpImg) return
  const pct  = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
  const clip = `inset(${((1 - pct) * 100).toFixed(2)}% 0 0 0)`
  if (gsap) gsap.to(_hpImg,   { clipPath: clip, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  else _hpImg.style.clipPath = clip
  if (_hpCur) _hpCur.textContent = hp
  if (_hpMax) _hpMax.textContent = maxHp
}

export function updateOrbManaFill(mana, maxMana) {
  if (!_manaImg) return
  const pct  = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0
  const clip = `inset(${((1 - pct) * 100).toFixed(2)}% 0 0 0)`
  if (gsap) gsap.to(_manaImg, { clipPath: clip, duration: 0.4, ease: 'power2.out', overwrite: 'auto' })
  else _manaImg.style.clipPath = clip
  if (_manaCur) _manaCur.textContent = mana
  if (_manaMax) _manaMax.textContent = maxMana
}

export function updateOrbPotions(hpCount, manaCount) {
  if (_hpBadge)   _hpBadge.textContent   = hpCount
  if (_manaBadge) _manaBadge.textContent = manaCount
  document.getElementById('pc-tap-hp')  ?.classList.toggle('orb-empty', hpCount   <= 0)
  document.getElementById('pc-tap-mana')?.classList.toggle('orb-empty', manaCount <= 0)
}
