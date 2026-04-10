/**
 * Physics-based dice roller using Matter.js (global `Matter` loaded via script tag).
 * Top-down felt-table view. Two chamfered dice bounce off walls with restitution + friction,
 * spin, decelerate, and settle — then reveal their pre-determined face.
 */

const DIE_SIZE      = 52    // px width/height of each die body
const CORNER_RADIUS = 9     // chamfer radius for rounded corners
const RESTITUTION   = 0.62  // bounciness
const FRICTION_AIR  = 0.035 // air drag (slows spin + slide)
const FRICTION      = 0.12  // surface friction
const SETTLE_SPEED  = 0.28  // px/frame below which die is "still"
const SETTLE_ROT    = 0.008 // rad/frame below which rotation is "still"
const SETTLE_FRAMES = 45    // consecutive still frames before resolving

// Pip layout: each entry is [x, y] offset from die center (in die-local space)
const HALF = DIE_SIZE * 0.28   // ~14.5px offset for outer pips
const MID  = 0
const PIPS = {
  1: [[MID, MID]],
  2: [[-HALF, -HALF], [HALF, HALF]],
  3: [[-HALF, -HALF], [MID, MID], [HALF, HALF]],
  4: [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]],
  5: [[-HALF, -HALF], [HALF, -HALF], [MID, MID], [-HALF, HALF], [HALF, HALF]],
  6: [[-HALF, -HALF], [HALF, -HALF], [-HALF, MID], [HALF, MID], [-HALF, HALF], [HALF, HALF]],
}

export function createDiceRoller(canvas) {
  const { Engine, Bodies, Body, World, Events } = Matter

  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')

  // ── Physics world ────────────────────────────────────────────
  const engine = Engine.create({ gravity: { x: 0, y: 0 } })  // top-down: no gravity
  const world  = engine.world

  const wallOpts = { isStatic: true, restitution: RESTITUTION, friction: 0 }
  const walls = [
    Bodies.rectangle(W / 2,  -10,    W,   20, wallOpts),  // top
    Bodies.rectangle(W / 2, H + 10,  W,   20, wallOpts),  // bottom
    Bodies.rectangle(-10,   H / 2,   20,   H, wallOpts),  // left
    Bodies.rectangle(W + 10, H / 2,  20,   H, wallOpts),  // right
  ]

  const dieOpts = {
    restitution:  RESTITUTION,
    friction:     FRICTION,
    frictionAir:  FRICTION_AIR,
    chamfer:      { radius: CORNER_RADIUS },
    label:        'die',
  }
  const die1 = Bodies.rectangle(W / 2 - 28, H / 2, DIE_SIZE, DIE_SIZE, dieOpts)
  const die2 = Bodies.rectangle(W / 2 + 28, H / 2, DIE_SIZE, DIE_SIZE, dieOpts)

  World.add(world, [...walls, die1, die2])

  // ── State ────────────────────────────────────────────────────
  let animId       = null
  let settled      = false
  let framesStill  = 0
  let result1      = 1
  let result2      = 1
  let rollingFace1 = 1
  let rollingFace2 = 1
  let flipTick     = 0
  let onSettle     = null

  // ── Drawing helpers ──────────────────────────────────────────
  function drawFelt() {
    // Dark green felt base
    ctx.fillStyle = '#17402a'
    ctx.fillRect(0, 0, W, H)

    // Subtle woven texture
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x <= W; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y <= H; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Gold felt border
    ctx.strokeStyle = 'rgba(195, 155, 60, 0.55)'
    ctx.lineWidth = 3
    roundRect(ctx, 5, 5, W - 10, H - 10, 10)
    ctx.stroke()
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath()
    c.moveTo(x + r, y)
    c.lineTo(x + w - r, y)
    c.quadraticCurveTo(x + w, y,         x + w, y + r)
    c.lineTo(x + w, y + h - r)
    c.quadraticCurveTo(x + w, y + h,     x + w - r, y + h)
    c.lineTo(x + r, y + h)
    c.quadraticCurveTo(x, y + h,         x, y + h - r)
    c.lineTo(x, y + r)
    c.quadraticCurveTo(x, y,             x + r, y)
    c.closePath()
  }

  function drawDie(body, face, isSettled) {
    ctx.save()
    ctx.translate(body.position.x, body.position.y)
    ctx.rotate(body.angle)

    const s = DIE_SIZE / 2

    // Drop shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur    = 10
    ctx.shadowOffsetX = 3
    ctx.shadowOffsetY = 5

    // Die body — ivory with slight warm tint
    ctx.fillStyle = isSettled ? '#fffbf0' : '#f5f0e2'
    roundRect(ctx, -s, -s, DIE_SIZE, DIE_SIZE, CORNER_RADIUS)
    ctx.fill()

    ctx.shadowColor = 'transparent'

    // Edge highlight (top-left)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.2
    roundRect(ctx, -s + 1, -s + 1, DIE_SIZE - 2, DIE_SIZE - 2, CORNER_RADIUS - 1)
    ctx.stroke()

    // Die border (bottom-right shadow)
    ctx.strokeStyle = 'rgba(120, 90, 50, 0.35)'
    ctx.lineWidth = 1
    roundRect(ctx, -s, -s, DIE_SIZE, DIE_SIZE, CORNER_RADIUS)
    ctx.stroke()

    // Pips
    ctx.fillStyle = '#1a0f05'
    const positions = PIPS[face] || PIPS[1]
    const pipR = DIE_SIZE * 0.076  // ~4px at 52px die
    for (const [px, py] of positions) {
      // Pip inset shadow
      ctx.shadowColor   = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur    = 3
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.beginPath()
      ctx.arc(px, py, pipR, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowColor = 'transparent'

    // Settled glow ring
    if (isSettled) {
      ctx.strokeStyle = 'rgba(255, 215, 60, 0.75)'
      ctx.lineWidth = 2.5
      roundRect(ctx, -s - 2, -s - 2, DIE_SIZE + 4, DIE_SIZE + 4, CORNER_RADIUS + 2)
      ctx.stroke()
    }

    ctx.restore()
  }

  // ── Animation loop ───────────────────────────────────────────
  function speed(b) {
    return Math.sqrt(b.velocity.x ** 2 + b.velocity.y ** 2)
  }

  function tick() {
    Engine.update(engine, 1000 / 60)

    // Randomly cycle face while moving
    flipTick++
    if (flipTick % 4 === 0) {
      rollingFace1 = (Math.floor(Math.random() * 6) + 1)
      rollingFace2 = (Math.floor(Math.random() * 6) + 1)
    }

    const s1 = speed(die1), s2 = speed(die2)
    const r1 = Math.abs(die1.angularVelocity)
    const r2 = Math.abs(die2.angularVelocity)
    const bothStill = s1 < SETTLE_SPEED && s2 < SETTLE_SPEED && r1 < SETTLE_ROT && r2 < SETTLE_ROT

    if (bothStill) framesStill++
    else           framesStill = 0

    const showFinal = framesStill >= SETTLE_FRAMES

    drawFelt()
    drawDie(die1, showFinal ? result1 : rollingFace1, showFinal)
    drawDie(die2, showFinal ? result2 : rollingFace2, showFinal)

    if (showFinal && !settled) {
      settled = true
      onSettle?.(result1, result2)
      return  // stop loop
    }

    animId = requestAnimationFrame(tick)
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    roll(onSettleCallback) {
      settled     = false
      framesStill = 0
      flipTick    = 0
      result1     = Math.ceil(Math.random() * 6)
      result2     = Math.ceil(Math.random() * 6)
      onSettle    = onSettleCallback

      // Start both dice near center with a randomised offset
      const spread = DIE_SIZE * 0.6
      Body.setPosition(die1, { x: W / 2 + (Math.random() - 0.5) * spread, y: H / 2 + (Math.random() - 0.5) * spread })
      Body.setPosition(die2, { x: W / 2 + (Math.random() - 0.5) * spread, y: H / 2 + (Math.random() - 0.5) * spread })
      Body.setAngle(die1, Math.random() * Math.PI * 2)
      Body.setAngle(die2, Math.random() * Math.PI * 2)

      // Launch outward at random angles with randomised speed
      const launch = (b, minSpd, maxSpd) => {
        const a   = Math.random() * Math.PI * 2
        const spd = minSpd + Math.random() * (maxSpd - minSpd)
        Body.setVelocity(b, { x: Math.cos(a) * spd, y: Math.sin(a) * spd })
        Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.55)
      }
      launch(die1, 14, 22)
      launch(die2, 14, 22)

      cancelAnimationFrame(animId)
      tick()
    },

    /** Draw the felt table idle (before first roll). */
    drawIdle() {
      drawFelt()
      // Dice silhouettes
      drawDie(die1, 0, false)
      drawDie(die2, 0, false)
    },

    destroy() {
      cancelAnimationFrame(animId)
      World.clear(world, false)
      Engine.clear(engine)
    },
  }
}
