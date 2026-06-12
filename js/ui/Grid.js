import TileEngine from '../systems/TileEngine.js'
import { ITEM_ICONS_BASE, TILE_SLAIN_ICON, TILE_SPIRIT_RELEASE, TILE_TYPE_ICON_FILES } from '../data/tileIcons.js'
import { el } from './uiShared.js'

export function cacheGridElements() {
    el.grid        = document.getElementById('grid')
}

export const GridMethods = {
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

  setGridArrowBarrageMode(active) {
    document.getElementById('grid-container')?.classList.toggle('arrow-barrage-mode', active)
  },

  clearTripleVolleyAoePreview() {
    document.querySelectorAll('#grid .tile.triple-volley-aoe-preview').forEach(n =>
      n.classList.remove('triple-volley-aoe-preview'),
    )
  },

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

  setGridPoisonArrowShotMode(active) {
    document.getElementById('grid-container')?.classList.toggle('poison-arrow-shot-mode', active)
  },

  setEngineerPlaceMode(active) {
    document.getElementById('grid-container')?.classList.toggle('engineer-place-mode', active)
  },

  setGridChainLightningMode(active) {
    document.getElementById('grid-container')?.classList.toggle('chain-lightning-mode', active)
  },

  setGridCorpseExplosionMode(active) {
    document.getElementById('grid-container')?.classList.toggle('corpse-explosion-mode', active)
  },

  setGridTelekineticThrowMode(mode) {
    const gc = document.getElementById('grid-container')
    if (!gc) return
    gc.classList.remove('telekinetic-throw-mode', 'telekinetic-throw-mode-enemy', 'telekinetic-throw-mode-dest')
    if (mode === 'enemy') {
      gc.classList.add('telekinetic-throw-mode', 'telekinetic-throw-mode-enemy')
    } else if (mode === 'dest') {
      gc.classList.add('telekinetic-throw-mode', 'telekinetic-throw-mode-dest')
    }
  },

  clearTelekineticMarks() {
    document.querySelectorAll('.telekinetic-origin').forEach(n => n.classList.remove('telekinetic-origin'))
  },

  markTelekineticOrigin(tileEl) {
    if (!tileEl) return
    tileEl.classList.add('telekinetic-origin')
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

  getGridEl() {
    return el.grid
  },

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
    const statusEffects = front.querySelector('.tile-status-effects')
    if (statusEffects) statusEffects.remove()
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

  setTileCombatEngaged(tileEl, isEngaged) {
    tileEl.classList.toggle('combat-engaged', !!isEngaged)
  },

  setTileCombatBlocked(tileEl, isBlocked) {
    tileEl.classList.toggle('combat-blocked', !!isBlocked)
  },

  markTileReachable(tileEl) {
    tileEl.classList.add('reachable')
  },

  lockTile(tileEl) {
    tileEl.classList.add('locked')
  },

  unlockTile(tileEl) {
    tileEl.classList.remove('locked')
  }
}
