import { CONFIG }     from '../config.js'
import { TILE_DEFS }  from '../data/tiles.js'
import { ENEMY_DEFS, BOSS_POOL } from '../data/enemies.js'
import {
  ITEM_ICONS_BASE,
  MONSTER_ICONS_BASE,
  TILE_TYPE_ICON_FILES,
  ENEMY_ICON_FILES,
  ENEMY_SPRITES,
} from '../data/tileIcons.js'
import Logger         from '../core/Logger.js'

// ── Grid state ───────────────────────────────────────────────
let _grid = []
let _currentFloor = 1
/** 'dungeon' | 'rest' — rest floors are 3×3 between boss and next dungeon */
let _gridMode = 'dungeon'

// ── Factories ────────────────────────────────────────────────

function _randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

/**
 * Display string for enemy attack on tiles / cards.
 * After reveal, `hitDamage` is set once (see rollEnemyHitDamage); until then shows potential range from `dmg`.
 */
function formatEnemyDamageDisplay(dmg, hitDamage) {
  if (hitDamage != null) return String(hitDamage)
  if (dmg == null) return '—'
  if (!Array.isArray(dmg)) return String(dmg)
  const [lo, hi] = dmg
  return lo === hi ? String(lo) : `${lo}–${hi}`
}

/** Roll once from scaled `dmg` [lo, hi]; idempotent. Call when the tile is revealed. */
function rollEnemyHitDamage(enemyData) {
  if (!enemyData || enemyData.hitDamage != null) return enemyData?.hitDamage
  const raw = enemyData.dmg
  const [lo, hi] = Array.isArray(raw) ? raw : [Number(raw), Number(raw)]
  enemyData.hitDamage = _randInt(lo, hi)
  return enemyData.hitDamage
}

/** Update ⚔️ line after hitDamage is rolled (tile already in DOM). */
function refreshEnemyDamageOnTile(tile) {
  if (!tile?.element || !tile.enemyData) return
  const el = tile.element.querySelector('.stat-dmg')
  if (!el) return
  const str = formatEnemyDamageDisplay(tile.enemyData.dmg, tile.enemyData.hitDamage)
  el.textContent = `⚔️ ${str}`
}

function _scaleEnemy(def, floor) {
  // Scale HP and damage per floor depth
  const hpMult  = 1 + CONFIG.enemy.floorScaleHP  * (floor - 1)
  const dmgMult = 1 + CONFIG.enemy.floorScaleDmg * (floor - 1)
  const hp = Math.round(def.hp * hpMult)
  const dmg = def.dmg.map(v => Math.round(v * dmgMult))
  return { ...def, hp, dmg, currentHP: hp }
}

function createEnemy(type, floor = 1) {
  const def = ENEMY_DEFS[type]
  if (!def) { Logger.error(`[TileEngine] Unknown enemy type: ${type}`); return null }
  return { ..._scaleEnemy(def, floor), enemyId: type }
}

function createTile(type, row, col, floor = 1) {
  const def = TILE_DEFS[type]
  return {
    row,
    col,
    type,
    revealed:  false,
    locked:    false,
    enemyData: def.isEnemy ? createEnemy(def.enemyType, floor) : null,
    itemData:  null,
    element:   null,
  }
}

// ── Weighted random ──────────────────────────────────────────

function weightedRandom(types, weights, total) {
  let r = Math.random() * total
  for (let i = 0; i < types.length; i++) {
    r -= weights[i]
    if (r <= 0) return types[i]
  }
  return types[types.length - 1]
}

// Tile weight adjustments by floor depth: deeper = more enemies, fewer empties
function _adjustedWeights(floor) {
  const defs = { ...TILE_DEFS }
  const weights = {}
  for (const [t, d] of Object.entries(defs)) {
    // Rest-only tile types never roll on dungeon floors
    if (t === 'well' || t === 'anvil' || t === 'rope') continue
    weights[t] = d.weight
  }
  // Boss weight is always 0 (placed explicitly)
  weights.boss = 0
  // Deeper floors: ramp enemy density, reduce empty
  if (floor >= 5) {
    weights.enemy      = Math.min(32, weights.enemy      + (floor - 4) * 2)
    weights.enemy_fast = Math.min(14, weights.enemy_fast + (floor - 4))
    weights.empty      = Math.max(10, weights.empty      - (floor - 4) * 2)
  }
  return weights
}

// Pick enemy type for standard enemy slot, scaling by floor
function _pickEnemyType(floor, tileType) {
  if (tileType === 'boss') {
    const idx = Math.floor((floor - 1) / 5) % BOSS_POOL.length
    return BOSS_POOL[idx]
  }
  // Pool of available non-boss enemies unlocked by floor
  const pool = ['skeleton', 'goblin', 'vine_witch']
  if (floor >= 2) pool.push('zombie', 'goblin_fast', 'slime')
  if (floor >= 3) pool.push('spider')
  if (floor >= 4) pool.push('wraith')
  if (floor >= 6) pool.push('troll')

  if (tileType === 'enemy_fast') {
    const fastPool = pool.filter(e => ENEMY_DEFS[e]?.behaviour === 'fast')
    return fastPool.length ? fastPool[Math.floor(Math.random() * fastPool.length)] : 'goblin_fast'
  }
  // Standard enemy — prefer non-fast types
  const stdPool = pool.filter(e => ENEMY_DEFS[e]?.behaviour !== 'fast')
  return stdPool[Math.floor(Math.random() * stdPool.length)]
}

// ── Grid generation ──────────────────────────────────────────

function _generateRestGrid(floor) {
  const rows = 3
  const cols = 3
  _grid = []
  const layout = [
    ['empty', 'anvil', 'empty'],
    ['rope', 'well', 'empty'],
    ['empty', 'exit', 'empty'],
  ]
  for (let r = 0; r < rows; r++) {
    _grid[r] = []
    for (let c = 0; c < cols; c++) {
      const type = layout[r][c]
      _grid[r][c] = _createTileWithEnemy(type, r, c, floor)
    }
  }
  Logger.debug(`[TileEngine] Rest sanctuary grid (3×3)`)
}

function generateGrid(floor = 1, opts = {}) {
  _currentFloor = floor
  _gridMode = opts.rest ? 'rest' : 'dungeon'
  if (_gridMode === 'rest') {
    _generateRestGrid(floor)
    return
  }

  const { cols, rows } = CONFIG.gridSize(floor)
  const isBossFloor = CONFIG.bossFloors.includes(floor)

  const weights   = _adjustedWeights(floor)
  const types     = Object.keys(weights).filter(t => t !== 'boss')
  const totalW    = types.reduce((s, t) => s + weights[t], 0)
  const count     = cols * rows

  _grid = []
  let exitPlaced = false
  let bossPlaced = false

  for (let r = 0; r < rows; r++) {
    _grid[r] = []
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      let type

      // Boss floor: force a boss tile at a mid-grid position (row 2, col 2)
      if (isBossFloor && !bossPlaced && r === Math.floor(rows / 2) && c === Math.floor(cols / 2)) {
        type = 'boss'
        bossPlaced = true
      } else if (i === count - 1 && !exitPlaced && !isBossFloor) {
        type = 'exit'
        exitPlaced = true
      } else {
        // Never roll a second exit — exclude 'exit' from the pool once one exists.
        // Boss floors: no random exits — only the stairs that replace the boss when slain.
        const poolTypes = types.filter(t => t !== 'exit' || (!exitPlaced && !isBossFloor))
        const poolWeights = poolTypes.map(t => weights[t])
        const poolTotal = poolWeights.reduce((s, w) => s + w, 0)
        type = weightedRandom(poolTypes, poolWeights, poolTotal)
        if (type === 'exit') exitPlaced = true
      }

      // For enemy tiles, pick a floor-appropriate enemy type
      const tile = _createTileWithEnemy(type, r, c, floor)
      _grid[r][c] = tile
    }
  }

  // Re-roll if no exit was placed (shouldn't happen, but safety net)
  if (!exitPlaced && !isBossFloor) {
    _grid[rows - 1][cols - 1] = _createTileWithEnemy('exit', rows - 1, cols - 1, floor)
  }

  // ── Rare tile caps ───────────────────────────────────────────
  // Each rare type may appear AT MOST ONCE per floor, gated by a per-floor
  // probability roll. Extras (or the sole one if the roll fails) become empty.
  const RARE_CAPS = {
    checkpoint: 0.05,   // 1-in-20 chance the floor has a camp at all
    heart:      0.02,   // 1-in-50 chance the floor has a heart at all
  }

  for (const [type, floorChance] of Object.entries(RARE_CAPS)) {
    const allowed = Math.random() < floorChance   // true = one may appear this floor
    let kept = false
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = _grid[r][c]
        if (t.type !== type) continue
        if (allowed && !kept) {
          kept = true   // keep the first one found, strip the rest
        } else {
          _grid[r][c] = _createTileWithEnemy('empty', r, c, floor)
        }
      }
    }
  }

  Logger.debug(`[TileEngine] Floor ${floor} grid generated (${cols}x${rows})${isBossFloor ? ' [BOSS]' : ''}`)
}

function _createTileWithEnemy(type, row, col, floor) {
  const def = TILE_DEFS[type]
  if (!def) return createTile('empty', row, col, floor)

  let enemyData = null
  if (def.isEnemy) {
    const enemyType = _pickEnemyType(floor, type)
    enemyData = createEnemy(enemyType, floor)
  }

  return {
    row,
    col,
    type,
    revealed:  false,
    locked:    false,
    reachable: false,
    enemyData,
    itemData:  null,
    element:   null,
  }
}

// ── Tile face icons (Items/) ─────────────────────────────────

function _resolveTileIconSrc(tile, def) {
  if (def.isEnemy && tile.enemyData?.enemyId) {
    const sprites = ENEMY_SPRITES[tile.enemyData.enemyId]
    if (sprites?.idle) return MONSTER_ICONS_BASE + sprites.idle
    const file = ENEMY_ICON_FILES[tile.enemyData.enemyId]
    return file ? ITEM_ICONS_BASE + file : null
  }
  const file = TILE_TYPE_ICON_FILES[tile.type]
  return file ? ITEM_ICONS_BASE + file : null
}

function _tileFaceIconHTML(tile, def) {
  const emoji = tile.enemyData?.emoji ?? def.emoji
  const src = _resolveTileIconSrc(tile, def)
  if (!src) {
    if (!emoji) return ''
    return `<span class="tile-icon-wrap tile-icon-fallback"><span class="tile-emoji">${emoji}</span></span>`
  }
  return `<span class="tile-icon-wrap"><img class="tile-icon-img" src="${src}" alt="" decoding="async" draggable="false"/></span>`
}

function _wireTileIconFallback(tileEl, emojiFallback) {
  const img = tileEl.querySelector('.tile-icon-img')
  if (!img) return
  img.addEventListener('error', function onIconErr() {
    img.removeEventListener('error', onIconErr)
    const wrap = img.closest('.tile-icon-wrap')
    if (!wrap) return
    wrap.innerHTML = `<span class="tile-emoji">${emojiFallback}</span>`
    wrap.classList.add('tile-icon-fallback')
  })
}

// ── DOM render ───────────────────────────────────────────────

function renderGrid(gridEl, onTap, onHold) {
  const { cols, rows } = CONFIG.gridSize(_currentFloor, { rest: _gridMode === 'rest' })
  gridEl.innerHTML = ''

  // Set CSS grid columns dynamically
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = _grid[r][c]
      const def  = TILE_DEFS[tile.type]

      const div = document.createElement('div')
      div.className = 'tile tile-type-' + tile.type + (def.isEnemy ? ' is-enemy' : '')
      div.dataset.row = r
      div.dataset.col = c
      div.setAttribute('aria-label', 'hidden tile')

      // Random back-face texture — picked now, applied after innerHTML is set
      const _backImages = [
        'assets/sprites/tiles/tile-unflipped2.1.png',
        'assets/sprites/tiles/tile-unflipped3.png',
      ]
      const backSrc = _backImages[Math.floor(Math.random() * _backImages.length)]

      const isBoss = tile.enemyData?.isBoss
      const hpBarHTML = ''

      const emojiFallback = tile.enemyData?.emoji ?? def.emoji
      const iconHTML = _tileFaceIconHTML(tile, def)

      let enemyStatsHTML = ''
      if (def.isEnemy && tile.enemyData) {
        const hp  = tile.enemyData.currentHP ?? tile.enemyData.hp
        const dmg = tile.enemyData.dmg
        const dmgStr = formatEnemyDamageDisplay(dmg, tile.enemyData.hitDamage)
        enemyStatsHTML = `<div class="tile-enemy-stats">
          <span class="stat-hp">❤️ ${hp}</span>
          <span class="stat-dmg">⚔️ ${dmgStr}</span>
        </div>`
      }

      div.innerHTML = `
        <div class="tile-inner">
          <div class="tile-back"></div>
          <div class="tile-front ${def.cssClass}${isBoss ? ' is-boss' : ''}">
            ${iconHTML}
            ${def.isEnemy ? '' : `<span class="tile-label">${def.label}</span>`}
            ${enemyStatsHTML}
            ${hpBarHTML}
          </div>
        </div>`

      // Apply random back texture directly to the .tile-back element
      div.querySelector('.tile-back').style.backgroundImage = `url('${backSrc}')`

      _wireTileIconFallback(div, emojiFallback)

      // ── Tap / Hold ──
      let _holdTimer = null
      let _didHold   = false
      let _startX    = 0
      let _startY    = 0
      const HOLD_MS  = 380
      const MOVE_THRESHOLD = 8   // px — ignore micro-movements from finger settle

      const _cancelHold = () => {
        if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null }
      }

      div.addEventListener('pointerdown', e => {
        _didHold = false
        _startX  = e.clientX
        _startY  = e.clientY
        _holdTimer = setTimeout(() => {
          _holdTimer = null
          _didHold   = true
          if (onHold) onHold(r, c)
        }, HOLD_MS)
      })

      div.addEventListener('pointermove', e => {
        if (!_holdTimer) return
        const dx = e.clientX - _startX
        const dy = e.clientY - _startY
        if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) _cancelHold()
      })

      div.addEventListener('pointerup',     _cancelHold)
      div.addEventListener('pointercancel', _cancelHold)

      // Suppress native long-press context menu (Android/iOS)
      div.addEventListener('contextmenu', e => e.preventDefault())

      div.addEventListener('click', () => { if (!_didHold) onTap(r, c) })
      div.addEventListener('touchend', e => {
        e.preventDefault()
        if (!_didHold) onTap(r, c)
        // Reset after touchend so next interaction starts clean
        _didHold = false
      }, { passive: false })

      tile.element = div
      gridEl.appendChild(div)
    }
  }
}

// ── Flip animation ───────────────────────────────────────────

function flipTile(tile) {
  return new Promise(resolve => {
    const inner = tile.element.querySelector('.tile-inner')
    tile.element.classList.add('revealed')
    inner.addEventListener('transitionend', function handler(e) {
      if (e.propertyName === 'transform') {
        inner.removeEventListener('transitionend', handler)
        resolve()
      }
    })
  })
}

// ── Adjacency helpers ────────────────────────────────────────

function getAdjacentTiles(row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
  return dirs
    .map(([dr, dc]) => _grid[row + dr]?.[col + dc])
    .filter(Boolean)
}

function getOrthogonalTiles(row, col) {
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
  return dirs
    .map(([dr, dc]) => _grid[row + dr]?.[col + dc])
    .filter(Boolean)
}

function markReachable(row, col, uiMark) {
  for (const adj of getOrthogonalTiles(row, col)) {
    if (!adj.revealed && !adj.reachable) {
      adj.reachable = true
      if (adj.element) uiMark(adj.element)
    }
  }
}

function lockAdjacent(row, col, uiLock) {
  for (const adj of getAdjacentTiles(row, col)) {
    if (!adj.revealed) {
      adj.locked = true
      if (adj.element) uiLock(adj.element)
    }
  }
  Logger.debug(`[TileEngine] Locked adjacent to [${row},${col}]`)
}

function unlockAdjacent(row, col, uiUnlock) {
  for (const adj of getAdjacentTiles(row, col)) {
    adj.locked = false
    if (adj.element) uiUnlock(adj.element)
  }
  Logger.debug(`[TileEngine] Unlocked adjacent to [${row},${col}]`)
}

// ── Getters ──────────────────────────────────────────────────

function getGrid()     { return _grid }
function getTile(r, c) { return _grid[r]?.[c] }
function getCurrentFloor() { return _currentFloor }

export default {
  generateGrid,
  renderGrid,
  flipTile,
  lockAdjacent,
  unlockAdjacent,
  markReachable,
  getGrid,
  getTile,
  getCurrentFloor,
  formatEnemyDamageDisplay,
  rollEnemyHitDamage,
  refreshEnemyDamageOnTile,
}
