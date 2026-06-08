const CHECKPOINTS = [
  { floor: 1,  label: 'Floor 1',  sub: 'Standard start',          cls: 'checkpoint-btn--floor1'  },
  { floor: 25, label: 'Floor 25', sub: 'The Depths — checkpoint', cls: 'checkpoint-btn--floor25' },
  { floor: 50, label: 'Floor 50', sub: 'The Abyss — checkpoint',  cls: 'checkpoint-btn--floor50' },
  { floor: 75, label: 'Floor 75', sub: 'The Void Gate — checkpoint', cls: 'checkpoint-btn--floor75' },
]

function _el(id) { return document.getElementById(id) }

function _buildList(deepestFloor, onSelect) {
  const list = _el('checkpoint-list')
  if (!list) return
  list.innerHTML = ''
  CHECKPOINTS.forEach(({ floor, label, sub, cls }) => {
    if (floor > 1 && deepestFloor < floor) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `checkpoint-btn ${cls}`
    btn.innerHTML = `
      <span class="checkpoint-btn-label">
        <span class="checkpoint-btn-floor">${label}</span>
        <span class="checkpoint-btn-sub">${sub}</span>
      </span>
      <span>▶</span>
    `
    btn.addEventListener('click', () => onSelect(floor))
    list.appendChild(btn)
  })
}

export function openCheckpointSelect(deps) {
  const { GameController } = deps
  const save = GameController.getSave()
  const deepestFloor = save?.meta?.deepestFloor ?? 1

  if (deepestFloor < 25) {
    // No checkpoints unlocked yet — skip straight to floor 1
    GameController.newGame()
    return
  }

  _buildList(deepestFloor, (floor) => {
    _el('checkpoint-overlay').classList.add('hidden')
    GameController.newGame({ startFloor: floor })
  })
  _el('checkpoint-overlay').classList.remove('hidden')
}

export function wireCheckpointPanel(deps) {
  // No permanent listeners needed — panel is opened directly by wireMenus
}
