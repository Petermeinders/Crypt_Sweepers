import TileEngine from '../systems/TileEngine.js'
import EventBus from '../core/EventBus.js'
import { resolveEnemySpriteSrc } from '../data/tileIcons.js'
import { getSave } from '../core/RunContext.js'
import { el, loadHeroParryGif } from './uiShared.js'

export function cacheCombatElements() {
    el.parryOverlay         = document.getElementById('parry-overlay')
    el.parryEnemyDisplay    = document.getElementById('parry-enemy-display')
    el.parryEnemyIcon       = document.getElementById('parry-enemy-icon')
    el.parryEnemyName       = document.getElementById('parry-enemy-name')
    el.parryPracticeLabel   = document.getElementById('parry-practice-label')
    el.parryTutorialOverlay = document.getElementById('parry-tutorial-overlay')
    el.parryTutorialBody    = document.getElementById('parry-tutorial-body')
    el.parryTutorialPips    = document.getElementById('parry-tutorial-pips')
    el.parryTutorialNext    = document.getElementById('parry-tutorial-next')
    el.parryTutorialSkip    = document.getElementById('parry-tutorial-skip')
    el.parryRingArena  = document.getElementById('parry-ring-arena')
    el.parryHeroCanvas = document.getElementById('parry-hero-canvas')
    el.parryRingOuter  = document.getElementById('parry-ring-outer')
    el.parryRingTarget = document.getElementById('parry-ring-target')
    el.parryCompassN   = document.getElementById('parry-compass-n')
    el.parryCompassE   = document.getElementById('parry-compass-e')
    el.parryCompassS   = document.getElementById('parry-compass-s')
    el.parryCompassW     = document.getElementById('parry-compass-w')
    el.parryArcCanvas    = document.getElementById('parry-arc-canvas')
    el.parryFlashOverlay = document.getElementById('parry-flash-overlay')
}

export const CombatUiMethods = {
  spawnZap(fromEl, toEl) {
    if (!toEl) return
    toEl.classList.add('zap-flash')
    setTimeout(() => toEl.classList.remove('zap-flash'), 500)

    if (!fromEl) return
    const a = fromEl.getBoundingClientRect()
    const b = toEl.getBoundingClientRect()
    const x1 = a.left + a.width / 2
    const y1 = a.top  + a.height / 2
    const x2 = b.left + b.width / 2
    const y2 = b.top  + b.height / 2
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len === 0) return
    const perpX = -dy / len, perpY = dx / len

    // Build jagged midpoints
    const segments = 8
    const maxOff = Math.min(len * 0.28, 32)
    const pts = [[x1, y1]]
    for (let i = 1; i < segments; i++) {
      const t = i / segments
      const bx = x1 + dx * t, by = y1 + dy * t
      const falloff = 1 - Math.abs(t - 0.5) * 1.6
      const off = (Math.random() * 2 - 1) * maxOff * Math.max(0, falloff)
      pts.push([bx + perpX * off, by + perpY * off])
    }
    pts.push([x2, y2])

    const ptStr = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svg.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:visible'
    svg.classList.add('zap-bolt-svg')

    // Outer glow
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    glow.setAttribute('points', ptStr)
    glow.setAttribute('stroke', 'rgba(100,180,255,0.55)')
    glow.setAttribute('stroke-width', '9')
    glow.setAttribute('fill', 'none')
    glow.setAttribute('stroke-linecap', 'round')
    glow.setAttribute('stroke-linejoin', 'round')
    glow.style.filter = 'blur(5px)'

    // Mid glow
    const mid = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    mid.setAttribute('points', ptStr)
    mid.setAttribute('stroke', 'rgba(180,220,255,0.85)')
    mid.setAttribute('stroke-width', '4')
    mid.setAttribute('fill', 'none')
    mid.setAttribute('stroke-linecap', 'round')
    mid.setAttribute('stroke-linejoin', 'round')

    // Bright white core
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    core.setAttribute('points', ptStr)
    core.setAttribute('stroke', '#ffffff')
    core.setAttribute('stroke-width', '1.5')
    core.setAttribute('fill', 'none')
    core.setAttribute('stroke-linecap', 'round')
    core.setAttribute('stroke-linejoin', 'round')

    svg.appendChild(glow)
    svg.appendChild(mid)
    svg.appendChild(core)
    document.body.appendChild(svg)
    setTimeout(() => svg.remove(), 500)
  },

  spawnSlamRing(tileEl) {
    if (!tileEl) return
    const ring = document.createElement('div')
    ring.className = 'slam-shock'
    tileEl.appendChild(ring)
    setTimeout(() => ring.remove(), 600)
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

  updateEnemyStatus(tileEl, enemyData) {
    if (!tileEl || !enemyData) return
    const front = tileEl.querySelector('.tile-front')
    if (!front) return

    let container = front.querySelector('.tile-status-effects')

    const statuses = []
    if ((enemyData.bleedTurns  ?? 0) > 0) statuses.push({ key: 'bleed',  icon: '🩸', turns: enemyData.bleedTurns })
    if ((enemyData.poisonTurns ?? 0) > 0) statuses.push({ key: 'poison', icon: '☠️', turns: enemyData.poisonTurns })
    if ((enemyData.stunTurns   ?? 0) > 0) statuses.push({ key: 'stun',   icon: '💫', turns: enemyData.stunTurns })
    if ((enemyData.shockedTurns ?? 0) > 0) statuses.push({ key: 'shocked', icon: '⚡', turns: enemyData.shockedTurns })

    if (statuses.length === 0) {
      if (container) container.remove()
      return
    }

    if (!container) {
      container = document.createElement('div')
      container.className = 'tile-status-effects'
      front.appendChild(container)
    }

    container.innerHTML = statuses.map(s => `
      <div class="tile-status-badge status-${s.key}">
        <span class="status-icon">${s.icon}</span>
        <span class="status-turns">${s.turns}</span>
      </div>`).join('')
  },

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

  shakeScreenDamage() {
    const app = document.getElementById('app')
    if (!app) return
    app.classList.remove('take-damage-shake')
    void app.offsetWidth
    app.classList.add('take-damage-shake')
    setTimeout(() => app.classList.remove('take-damage-shake'), 280)
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

  spawnMageAttack(tileEl) {
    const el = document.createElement('img')
    el.src = 'assets/sprites/effects/MageAttack.gif?' + Date.now()
    el.className = 'strike-slash'
    tileEl.appendChild(el)
    setTimeout(() => el.remove(), 750)
  },

  spawnVampireAttack(tileEl) {
    const el = document.createElement('img')
    el.src = 'assets/sprites/effects/VampireAttack.gif?' + Date.now()
    el.className = 'strike-slash'
    tileEl.appendChild(el)
    setTimeout(() => el.remove(), 750)
  },

  spawnNecromancerAttack(tileEl) {
    const el = document.createElement('img')
    el.src = 'assets/sprites/effects/NecromancerAttack.gif?' + Date.now()
    el.className = 'strike-slash'
    tileEl.appendChild(el)
    setTimeout(() => el.remove(), 750)
  },

  showParryOnboarding(onChoice) {
    const ov     = document.getElementById('parry-onboarding-overlay')
    const yesBtn = document.getElementById('parry-onboarding-yes')
    const noBtn  = document.getElementById('parry-onboarding-no')
    if (!ov) { onChoice(true); return }
    let done = false
    const choose = (enabled) => {
      if (done) return
      done = true
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      onChoice(enabled)
    }
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
    yesBtn.addEventListener('click', () => choose(true),  { once: true })
    noBtn.addEventListener('click',  () => choose(false), { once: true })
  },

  showParryTutorial(heroId, onComplete) {
    const ov = el.parryTutorialOverlay
    if (!ov) { onComplete(); return }

    const _self = this
    const _MOCK  = { dmg: [1, 1], label: 'Dummy', enemyId: null }

    const STEPS = [
      {
        nextLabel: 'Next',
        body:
          '<p>When a <strong>telegraphing enemy</strong> attacks, a glowing ring shrinks toward the center. React before it closes.</p>' +
          '<table class="parry-tutorial-table">' +
          '<thead><tr><th>Action</th><th>Mana</th><th>Damage</th></tr></thead>' +
          '<tbody>' +
          '<tr><td>🛡️ <strong>Block</strong> — tap in zone</td><td class="good">±0</td><td class="good">½</td></tr>' +
          '<tr><td>⚡ <strong>Counter</strong> — swipe direction in zone</td><td class="good">+1</td><td class="good">none</td></tr>' +
          '<tr><td>✗ Miss tap</td><td class="bad">−1</td><td class="bad">full</td></tr>' +
          '<tr><td>✗ Miss swipe</td><td class="bad">−2</td><td class="bad">×2</td></tr>' +
          '<tr><td>— Ignore ring</td><td>±0</td><td>full</td></tr>' +
          '</tbody></table>',
      },
      {
        nextLabel: 'Try Blocking →',
        isPractice: true,
        practiceHint: '⚡ PRACTICE — Tap when the ring enters the zone',
        passCondition: r => r === 'block' || r === 'counter',
        body:
          '<p>The ring shrinks toward center. <strong>Tap anywhere</strong> when it overlaps the golden inner ring.</p>' +
          '<p class="parry-tutorial-tip">The outer ring glows green when you\'re in range.</p>',
        retryBody:
          '<p>Not quite! <strong>Tap anywhere</strong> when the ring is inside the glowing zone — don\'t tap early or late.</p>' +
          '<p class="parry-tutorial-tip">The outer ring glows green when you\'re in range.</p>',
      },
      {
        nextLabel: 'Try Countering →',
        isPractice: true,
        practiceHint: '⚡ PRACTICE — Swipe the indicated direction while in the zone',
        passCondition: r => r === 'counter',
        body:
          '<p>A gold arc marks the required direction. <strong>Swipe that way</strong> while the ring is in the zone.</p>' +
          '<p class="parry-tutorial-tip">A counter restores 1 mana and deals bonus damage — the best outcome.</p>',
        retryBody:
          '<p>Not quite! <strong>Swipe in the direction shown</strong> by the gold arc while the ring is in the zone.</p>' +
          '<p class="parry-tutorial-tip">A counter restores 1 mana and deals bonus damage — the best outcome.</p>',
      },
    ]

    let step = 0
    let _done = false
    const pips = el.parryTutorialPips
      ? Array.from(el.parryTutorialPips.querySelectorAll('.parry-tutorial-pip'))
      : []

    function _renderStep() {
      const s = STEPS[step]
      if (el.parryTutorialBody) el.parryTutorialBody.innerHTML = s.body
      if (el.parryTutorialNext) el.parryTutorialNext.textContent = s.nextLabel
      pips.forEach((p, i) => p.classList.toggle('active', i === step))
    }

    function _finish() {
      if (_done) return
      _done = true
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      el.parryTutorialNext?.removeEventListener('click', _onNext)
      el.parryTutorialSkip?.removeEventListener('click', _finish)
      onComplete()
    }

    function _runPractice() {
      const s = STEPS[step]
      ov.classList.add('hidden')
      ov.setAttribute('aria-hidden', 'true')
      _self.showParryWindow(_MOCK, (result) => {
        if (s.passCondition && !s.passCondition(result)) {
          if (s.retryBody && el.parryTutorialBody) el.parryTutorialBody.innerHTML = s.retryBody
          ov.classList.remove('hidden')
          ov.setAttribute('aria-hidden', 'false')
          return
        }
        const next = step + 1
        if (next < STEPS.length) {
          step = next
          ov.classList.remove('hidden')
          ov.setAttribute('aria-hidden', 'false')
          _renderStep()
        } else {
          _finish()
        }
      }, heroId, { practiceMode: true, practiceHint: s.practiceHint })
    }

    function _onNext() {
      const s = STEPS[step]
      if (s.isPractice) {
        _runPractice()
      } else {
        const next = step + 1
        if (next < STEPS.length) {
          step = next
          _renderStep()
        } else {
          _finish()
        }
      }
    }

    el.parryTutorialNext?.addEventListener('click', _onNext)
    el.parryTutorialSkip?.addEventListener('click', _finish)
    _renderStep()
    ov.classList.remove('hidden')
    ov.setAttribute('aria-hidden', 'false')
  },

  showParryWindow(enemyData, onResolve, heroId = 'warrior', opts = {}) {
    if (!el.parryOverlay) { onResolve('ignore'); return }

    const dmg    = enemyData.dmg ?? [1, 2]
    const avgDmg = (dmg[0] + dmg[1]) / 2

    // Difficulty tiers — wide speed variance (4× spread) so timing can't be muscle-memorised
    let baseWindowDur, sweetSpotFraction
    if (avgDmg <= 2) {
      baseWindowDur = 2200; sweetSpotFraction = 0.30
    } else if (avgDmg <= 4) {
      baseWindowDur = 1600; sweetSpotFraction = 0.20
    } else {
      baseWindowDur = 1100; sweetSpotFraction = 0.12
    }
    if (opts.practiceMode) sweetSpotFraction = 0.42
    const windowDur = opts.practiceMode ? 2500 : Math.max(550, baseWindowDur * (0.40 + Math.random() * 1.20))

    // Rune ring is 110px in 320px arena; outer edge at 55px radius → scale = 55/160
    const TARGET_SCALE = 55 / 160
    const zoneMin = TARGET_SCALE - sweetSpotFraction / 2
    const zoneMax = TARGET_SCALE + sweetSpotFraction / 2

    const DIRS = [
      { id: 'e', dx: 1,  dy: 0  },
      { id: 'w', dx: -1, dy: 0  },
      { id: 'n', dx: 0,  dy: -1 },
      { id: 's', dx: 0,  dy: 1  },
    ]
    const requiredDir = DIRS[Math.floor(Math.random() * DIRS.length)]
    const dirAngleDeg = Math.atan2(requiredDir.dy, requiredDir.dx) * 180 / Math.PI

    ;[el.parryCompassN, el.parryCompassE, el.parryCompassS, el.parryCompassW].forEach(a => a?.classList.remove('active'))
    const activeArrow = { n: el.parryCompassN, e: el.parryCompassE, s: el.parryCompassS, w: el.parryCompassW }[requiredDir.id]
    activeArrow?.classList.add('active')

    el.parryRingOuter.classList.remove('parry-result-block', 'parry-result-counter', 'parry-result-miss', 'in-zone')
    el.parryRingOuter.style.transform = 'scale(1) rotate(0deg)'
    el.parryRingOuter.style.opacity   = '1'
    el.parryRingOuter.style.animation = ''
    el.parryRingArena?.querySelectorAll('.parry-feedback-icon').forEach(n => n.remove())

    // Practice mode banner
    if (el.parryPracticeLabel) {
      if (opts.practiceMode && opts.practiceHint) {
        el.parryPracticeLabel.textContent = opts.practiceHint
        el.parryPracticeLabel.classList.remove('hidden')
      } else {
        el.parryPracticeLabel.classList.add('hidden')
      }
    }

    // Enemy idle display (hidden in practice mode — no real enemy)
    if (el.parryEnemyDisplay) {
      if (opts.practiceMode || !enemyData.enemyId) {
        el.parryEnemyDisplay.classList.add('hidden')
      } else {
        el.parryEnemyDisplay.classList.remove('hidden')
        const childMode = getSave()?.settings?.childMode ?? false
        const _gifSrc  = resolveEnemySpriteSrc(enemyData.enemyId, { state: 'idle', childMode })
        if (el.parryEnemyIcon) {
          el.parryEnemyIcon.src          = _gifSrc ? `${_gifSrc}?t=${Date.now()}` : ''
          el.parryEnemyIcon.style.display = _gifSrc ? '' : 'none'
        }
        if (el.parryEnemyName) el.parryEnemyName.textContent = enemyData.label ?? ''
      }
    }

    // Hero canvas: clear previous frame
    const heroCtx = el.parryHeroCanvas?.getContext('2d') ?? null
    if (heroCtx) heroCtx.clearRect(0, 0, 320, 320)

    // Async hero GIF load — frames drawn in tick() once available
    let heroFrames = [], heroGifW = 0, heroGifH = 0
    if (window.GifReader) {
      loadHeroParryGif(heroId)
        .then(d => { heroFrames = d.frames; heroGifW = d.gifW; heroGifH = d.gifH })
        .catch(() => {})
    }

    // Canvas arc: gold direction indicator — scales with the ring
    const arcCtx = el.parryArcCanvas?.getContext('2d') ?? null
    if (arcCtx) arcCtx.clearRect(0, 0, 360, 360)

    function drawArc() {
      if (!arcCtx) return
      arcCtx.clearRect(0, 0, 360, 360)
      const cx = 180, cy = 180, r = 155
      const spanRad   = Math.PI * 0.45
      const centerRad = dirAngleDeg * Math.PI / 180
      const startRad  = centerRad - spanRad / 2
      const endRad    = centerRad + spanRad / 2
      // Soft glow halo
      arcCtx.save()
      arcCtx.globalAlpha = 0.38
      arcCtx.strokeStyle = '#ffd700'
      arcCtx.lineWidth   = 20
      arcCtx.shadowBlur  = 28
      arcCtx.shadowColor = '#ffd700'
      arcCtx.lineCap     = 'round'
      arcCtx.beginPath()
      arcCtx.arc(cx, cy, r, startRad, endRad)
      arcCtx.stroke()
      arcCtx.restore()
      // Sharp arc stroke
      arcCtx.save()
      arcCtx.globalAlpha = 0.92
      arcCtx.strokeStyle = '#ffd700'
      arcCtx.lineWidth   = 7
      arcCtx.shadowBlur  = 14
      arcCtx.shadowColor = '#ffe566'
      arcCtx.lineCap     = 'round'
      arcCtx.beginPath()
      arcCtx.arc(cx, cy, r, startRad, endRad)
      arcCtx.stroke()
      arcCtx.restore()
    }

    el.parryOverlay.classList.remove('hidden')
    el.parryOverlay.setAttribute('aria-hidden', 'false')

    let ringScale = 1
    let startTs   = null
    let rafId     = null
    let resolved  = false

    function tick(ts) {
      if (resolved) return
      if (!startTs) startTs = ts
      const elapsed = ts - startTs
      ringScale = Math.max(0, 1 - elapsed / windowDur)
      const spinDeg = (elapsed / 14000) * 360
      el.parryRingOuter.style.transform = `scale(${ringScale.toFixed(4)}) rotate(${spinDeg.toFixed(1)}deg)`
      el.parryRingOuter.classList.toggle('in-zone', ringScale >= zoneMin && ringScale <= zoneMax)
      // Scale canvas with ring so arc tracks it exactly
      if (el.parryArcCanvas) el.parryArcCanvas.style.transform = `scale(${ringScale.toFixed(4)})`
      drawArc()

      // Hero attack frame — seekable animation tied to ring progress
      if (heroCtx && heroFrames.length > 0) {
        const progress  = 1 - ringScale
        const frameIdx  = Math.min(heroFrames.length - 1, Math.floor(progress * (heroFrames.length - 1)))
        heroCtx.clearRect(0, 0, 320, 320)
        const MAX_PX = 160
        const scale  = MAX_PX / Math.max(heroGifW, heroGifH)
        const sw = Math.round(heroGifW * scale), sh = Math.round(heroGifH * scale)
        heroCtx.drawImage(heroFrames[frameIdx], (320 - sw) / 2, (320 - sh) / 2, sw, sh)
      }

      if (ringScale > 0) {
        rafId = requestAnimationFrame(tick)
      } else {
        resolve(_attempted ? 'miss-block' : 'ignore')
      }
    }
    rafId = requestAnimationFrame(tick)

    function _inZone() { return ringScale >= zoneMin && ringScale <= zoneMax }

    function _swipeDirMatches(dx, dy) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx > 0 ? requiredDir.dx === 1 : requiredDir.dx === -1
      }
      return dy > 0 ? requiredDir.dy === 1 : requiredDir.dy === -1
    }

    // result: 'block' | 'counter' | 'miss-block' | 'miss-parry' | 'ignore'
    function resolve(result) {
      if (resolved) return
      resolved = true
      // Play audio immediately on input — before the 350ms visual delay
      if (result === 'block')                         EventBus.emit('audio:play', { sfx: 'parryBlock' })
      else if (result === 'counter')                  EventBus.emit('audio:play', { sfx: 'parryCounter' })
      else if (result === 'miss-block' || result === 'miss-parry') EventBus.emit('audio:play', { sfx: 'parryMiss' })
      cancelAnimationFrame(rafId)
      clearTimeout(autoMissTimer)
      el.parryOverlay.removeEventListener('touchstart', onTouchStart)
      el.parryOverlay.removeEventListener('touchend',   onTouchEnd)
      el.parryOverlay.removeEventListener('mousedown',  onMouseDown)
      el.parryOverlay.removeEventListener('mouseup',    onMouseUp)

      if (arcCtx) arcCtx.clearRect(0, 0, 360, 360)
      if (el.parryArcCanvas) el.parryArcCanvas.style.transform = ''

      const isMiss = result === 'miss-block' || result === 'miss-parry'
      // 'ignore' = ring expired with no input; skip all feedback
      const visualResult = isMiss ? 'miss' : result === 'ignore' ? null : result

      if (visualResult && el.parryFlashOverlay) {
        el.parryFlashOverlay.className = 'parry-flash-overlay'
        void el.parryFlashOverlay.offsetWidth
        el.parryFlashOverlay.classList.add(`flash-${visualResult}`)
      }

      if (isMiss) {
        document.body.classList.add('screen-shake')
        document.body.addEventListener('animationend', () => document.body.classList.remove('screen-shake'), { once: true })
      }

      el.parryRingOuter.style.animation = ''
      el.parryRingOuter.classList.remove('in-zone')
      ;[el.parryCompassN, el.parryCompassE, el.parryCompassS, el.parryCompassW].forEach(a => a?.classList.remove('active'))
      void el.parryRingOuter.offsetWidth
      if (visualResult) el.parryRingOuter.classList.add(`parry-result-${visualResult}`)

      if (visualResult) {
        const resultWords = { block: 'Blocked', counter: 'Countered', miss: 'Missed' }
        const word = document.createElement('div')
        word.className = `parry-feedback-icon parry-text-${visualResult}`
        word.textContent = resultWords[visualResult]
        el.parryRingArena?.appendChild(word)
      }

      setTimeout(() => {
        el.parryOverlay.classList.add('hidden')
        el.parryOverlay.setAttribute('aria-hidden', 'true')
        if (visualResult) el.parryRingOuter.classList.remove(`parry-result-${visualResult}`)
        el.parryRingArena?.querySelectorAll('.parry-feedback-icon').forEach(n => n.remove())
        if (heroCtx) heroCtx.clearRect(0, 0, 320, 320)
        onResolve(result)
      }, visualResult ? 350 : 0)
    }

    let _attempted = false
    let touchStartX = null, touchStartY = null, mouseStartX = null, mouseStartY = null

    function onTouchStart(e) {
      _attempted = true
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }
    function onTouchEnd(e) {
      if (touchStartX === null) return
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      touchStartX = null; touchStartY = null
      if (Math.hypot(dx, dy) < 20) {
        resolve(_inZone() ? 'block' : 'miss-block')
      } else {
        resolve(_inZone() && _swipeDirMatches(dx, dy) ? 'counter' : 'miss-parry')
      }
    }
    function onMouseDown(e) { _attempted = true; mouseStartX = e.clientX; mouseStartY = e.clientY }
    function onMouseUp(e) {
      if (mouseStartX === null) return
      const dx = e.clientX - mouseStartX
      const dy = e.clientY - mouseStartY
      mouseStartX = null; mouseStartY = null
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        resolve(_inZone() ? 'block' : 'miss-block')
      } else {
        resolve(_inZone() && _swipeDirMatches(dx, dy) ? 'counter' : 'miss-parry')
      }
    }

    el.parryOverlay.addEventListener('touchstart', onTouchStart, { passive: true })
    el.parryOverlay.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.parryOverlay.addEventListener('mousedown',  onMouseDown)
    el.parryOverlay.addEventListener('mouseup',    onMouseUp)

    const autoMissTimer = setTimeout(() => resolve(_attempted ? 'miss-block' : 'ignore'), windowDur)
  }
}
