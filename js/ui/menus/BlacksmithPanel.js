let _bsSelectedSlot = null

function _spawnBlacksmithEmbers() {
  const container = document.querySelector('.bs-embers')
  if (!container || container.dataset.spawned) return
  container.dataset.spawned = '1'
  const bannerH = document.querySelector('.bs-forge-section')?.offsetHeight ?? 280
  const colors  = ['#ff8c00', '#ffa520', '#ff6600', '#ffbb44', '#ff7722']
  for (let i = 0; i < 24; i++) {
    const mote = document.createElement('span')
    mote.className = 'bs-ember'
    const size = 1.5 + Math.random() * 3.5
    mote.style.left              = (Math.random() * 90) + '%'
    mote.style.top               = (bannerH - 12 + Math.random() * 20) + 'px'
    mote.style.width             = size + 'px'
    mote.style.height            = size + 'px'
    mote.style.animationDuration = (4 + Math.random() * 8) + 's'
    mote.style.animationDelay   = (-Math.random() * 10) + 's'
    mote.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'px')
    mote.style.setProperty('--dy', (120 + Math.random() * 200) + 'px')
    mote.style.background        = colors[Math.floor(Math.random() * colors.length)]
    mote.style.opacity           = String(0.5 + Math.random() * 0.5)
    container.appendChild(mote)
  }
}

export function wireBlacksmithPanel(deps) {
  document.getElementById('blacksmith-btn')?.addEventListener('click', () => openBlacksmith(deps))
  document.getElementById('blacksmith-close')?.addEventListener('click', () => closeBlacksmith())
}

export function openBlacksmith(deps) {
  const { GameController, UI } = deps
  const s    = GameController.getSave()
  const gear = s.equippedGear ?? { weapon: null, breastplate: null, offhand: null }
  _spawnBlacksmithEmbers()

  if (!_bsSelectedSlot || !gear[_bsSelectedSlot]) {
    _bsSelectedSlot = ['weapon', 'breastplate', 'offhand'].find(sl => gear[sl]) ?? null
  }

  UI.renderBlacksmithScreen(
    gear,
    s.persistentGold,
    s.scrap ?? 0,
    _bsSelectedSlot,
    {
      onSelectSlot(slot) {
        _bsSelectedSlot = slot
        openBlacksmith(deps)
      },
      onUpgrade(slot) {
        const result = GameController.upgradeGear(slot)
        if (result.success)     UI.showBlacksmithResult(true,  result.piece)
        else if (result.failed) UI.showBlacksmithResult(false, result.piece)
        openBlacksmith(deps)
      },
      onDisassemble(slot) {
        GameController.disassembleGear(slot)
        openBlacksmith(deps)
      },
      onReduceDetriment(slot, statKey) {
        GameController.reduceDetriment(slot, statKey)
        openBlacksmith(deps)
      },
    },
  )
}

export function closeBlacksmith() {
  document.getElementById('blacksmith-overlay')?.classList.add('hidden')
  _bsSelectedSlot = null
}
