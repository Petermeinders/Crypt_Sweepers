import { GLOBAL_PASSIVE_UPGRADES, GLOBAL_PASSIVE_IDS } from '../../data/passives.js'
import { SHOP_ITEMS } from '../../data/upgrades.js'

export function wireGoldShopPanel(deps) {
  const { GameController, SaveManager, MetaProgression, UI } = deps

  document.getElementById('gold-shop-btn').addEventListener('click', () => openShop(deps))
  document.getElementById('passive-upgrades-btn').addEventListener('click', () => openPassiveUpgrades(deps))
  document.getElementById('passive-upgrades-back').addEventListener('click', () => {
    document.getElementById('passive-upgrades-overlay').classList.add('hidden')
  })
  document.getElementById('gold-shop-back').addEventListener('click', () => UI.hideGoldShop())
}

export function openPassiveUpgrades(deps) {
  const { GameController, SaveManager, MetaProgression } = deps
  const s = GameController.getSave()
  const overlay = document.getElementById('passive-upgrades-overlay')
  const goldEl  = document.getElementById('passive-upgrades-gold-val')
  const list    = document.getElementById('passive-upgrades-list')
  if (!overlay || !list) return

  goldEl.textContent = s.persistentGold
  list.innerHTML = ''

  for (const id of GLOBAL_PASSIVE_IDS) {
    const def = GLOBAL_PASSIVE_UPGRADES[id]
    if (!def) continue
    const owned   = (s.globalPassives ?? []).includes(id)
    const canAfford = !owned && s.persistentGold >= def.goldCost

    const item = document.createElement('div')
    item.className = `panel-card${owned ? ' owned' : ''}`
    item.innerHTML = `
      <span class="panel-card-icon">${def.icon}</span>
      <div class="panel-card-info">
        <div class="panel-card-name">${def.name}</div>
        <div class="panel-card-desc">${def.desc}</div>
      </div>
      <div class="panel-card-action">
        <button class="panel-btn buy gold" ${owned || !canAfford ? 'disabled' : ''}>
          ${owned ? '✓ Owned' : `💰 ${def.goldCost}`}
        </button>
      </div>`

    if (!owned && canAfford) {
      item.querySelector('.panel-btn').addEventListener('click', () => {
        MetaProgression.buyGlobalPassive(s, id)
        SaveManager.save(s)
        openPassiveUpgrades(deps)
      })
    }
    list.appendChild(item)
  }

  overlay.classList.remove('hidden')
}

export function openShop(deps) {
  const { GameController, SaveManager, MetaProgression, UI } = deps
  const s = GameController.getSave()
  UI.showGoldShop(
    s,
    SHOP_ITEMS,
    (id) => {
      MetaProgression.buyShopItem(s, id)
      const run = GameController.getRun()
      if (run?.player) MetaProgression.applyShopCartToPlayer(run.player, s)
      SaveManager.save(s)
      openShop(deps)
    },
    (id) => { MetaProgression.removeShopItem(s, id); SaveManager.save(s); openShop(deps) },
  )
}
