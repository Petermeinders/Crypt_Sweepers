// Shared UI element cache and cross-cutting helpers.
import { ENEMY_DEFS } from '../data/enemies.js'
import { ITEMS } from '../data/items.js'
import { ENEMY_SPRITES, MONSTER_ICONS_BASE } from '../data/tileIcons.js'

export const el = {}

// ── Hero attack GIF pre-rendering (parry window sprite) ──────────────────────
// omggif.js loaded as a plain <script> tag exposes window.GifReader globally.
// Frames are parsed once per hero and cached as ImageBitmaps for zero-cost draws.
const HERO_ATTACK_GIFS = {
  warrior:     'assets/sprites/Heroes/Warrior/warrior-strike.gif',
  ranger:      'assets/sprites/Heroes/Ranger/__Attack.gif',
  mage:        'assets/sprites/Heroes/Mage/blue-mage-hero-attack-small-speed.gif',
  engineer:    'assets/sprites/Heroes/Engineer/engineer-hero-strike.gif',
  necromancer: 'assets/sprites/Heroes/Necromancer/necromancer-hero-strike.gif',
  vampire:     'assets/sprites/effects/VampireAttack.gif',
}
const heroGifCache = {}   // heroId → { frames: ImageBitmap[], gifW, gifH }
const heroGifPending = {} // heroId → Promise (deduplicates concurrent loads)

export async function loadHeroParryGif(heroId) {
  if (heroGifCache[heroId])  return heroGifCache[heroId]
  if (heroGifPending[heroId]) return heroGifPending[heroId]

  const url = HERO_ATTACK_GIFS[heroId] ?? HERO_ATTACK_GIFS.warrior
  heroGifPending[heroId] = (async () => {
    const resp      = await fetch(url)
    const buf       = await resp.arrayBuffer()
    const gr        = new window.GifReader(new Uint8Array(buf))
    const gifW      = gr.width, gifH = gr.height
    const n         = gr.numFrames()
    const composite = new Uint8ClampedArray(gifW * gifH * 4)
    const offscreen = new OffscreenCanvas(gifW, gifH)
    const offCtx    = offscreen.getContext('2d')
    const frames    = []

    for (let i = 0; i < n; i++) {
      const info  = gr.frameInfo(i)
      const saved = (info.disposal === 3) ? new Uint8ClampedArray(composite) : null
      gr.decodeAndBlitFrameRGBA(i, composite)
      offCtx.putImageData(new ImageData(new Uint8ClampedArray(composite), gifW, gifH), 0, 0)
      frames.push(await createImageBitmap(offscreen))
      if      (info.disposal === 2) composite.fill(0)
      else if (info.disposal === 3 && saved) composite.set(saved)
    }

    const result = { frames, gifW, gifH }
    heroGifCache[heroId] = result
    delete heroGifPending[heroId]
    return result
  })()
  return heroGifPending[heroId]
}

export function fillBestiaryCreatureParts(parts, def, enemyId) {
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
export function fillTrinketCard(parts, def) {
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
export function drawSettledDice(canvas, face1, face2) {
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

export const logHistory = []

/** HUD portrait gifs per animation state (hero-specific). */
export const PORTRAIT_ANIM = {
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
  necromancer: {
    idle:   'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
    attack: 'assets/sprites/Heroes/Necromancer/necromancer-hero-strike.gif',
    hit:    'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
    run:    'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
    death:  'assets/sprites/Heroes/Necromancer/necromancer-hero-idle.gif',
  },
}


