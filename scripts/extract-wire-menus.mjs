import fs from 'fs'

const mainLines = fs.readFileSync('js/main.js', 'utf8').split(/\n/)

const clickSoundBlock = mainLines.slice(561, 573).join('\n')
const newRunBlock = mainLines.slice(575, 576).join('\n')
const menuOverlays = mainLines.slice(741, 812).join('\n')

let body = [
  clickSoundBlock,
  newRunBlock,
  menuOverlays,
].join('\n\n')

body = body
  .replace(/\bGameController\./g, 'ctx.GameController.')
  .replace(/\bSaveManager\./g, 'ctx.SaveManager.')
  .replace(/\bMetaProgression\./g, 'ctx.MetaProgression.')
  .replace(/\bUI\./g, 'ctx.UI.')
  .replace(/\bEventBus\./g, 'ctx.EventBus.')
  .replace(/renderChangelogEntries\(\)/g, 'renderChangelogEntries()')
  .replace(/_openShop/g, 'openShop')
  .replace(/_openPassiveUpgrades/g, 'openPassiveUpgrades')
  .replace(/_openBlacksmith/g, 'openBlacksmith')
  .replace(/_closeBlacksmith/g, 'closeBlacksmith')
  .replace(/_openHeroSelect/g, 'openHeroSelect')
  .replace(/_updateMenuHeroPreview/g, 'updateMenuHeroPreview')
  .replace(/_wireInstallNudge/g, 'wireInstallNudge')

const header = `import { CHARACTERS } from '../data/characters.js'
import { renderChangelogEntries } from '../ui/menus/Changelog.js'
import { wireGoldShopPanel, openShop, openPassiveUpgrades } from '../ui/menus/GoldShopPanel.js'
import { wireBlacksmithPanel, openBlacksmith, closeBlacksmith } from '../ui/menus/BlacksmithPanel.js'
import { wireHeroSelect, openHeroSelect, updateMenuHeroPreview } from '../ui/menus/HeroSelect.js'
import { wireSettingsPanel } from '../ui/menus/SettingsPanel.js'
import Logger from '../core/Logger.js'

let deferredInstallPrompt = null

function wireInstallNudge() {
  const nudge      = document.getElementById('install-nudge')
  const installBtn = document.getElementById('install-btn')

  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  if (isIOS) {
    if (nudge) nudge.classList.remove('hidden')
    if (installBtn) {
      installBtn.textContent = '📲 Add to Home Screen'
      installBtn.addEventListener('click', () => {
        document.getElementById('ios-install-tip').classList.toggle('hidden')
      })
    }
    return
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredInstallPrompt = e
    if (nudge) nudge.classList.remove('hidden')
  })

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return
      deferredInstallPrompt.prompt()
      const { outcome } = await deferredInstallPrompt.userChoice
      Logger.debug(\`[main] PWA install: \${outcome}\`)
      deferredInstallPrompt = null
      if (nudge) nudge.classList.add('hidden')
    })
  }
}

/** Main menu, pause overlays, export/import, PWA nudge, boot finale. */
export function wireMenus(ctx) {
  const { GameController, SaveManager, MetaProgression, UI, EventBus } = ctx

  wireGoldShopPanel(ctx)
  wireBlacksmithPanel(ctx)
  wireHeroSelect(ctx)
  wireSettingsPanel(ctx)

`

const finale = `
}

/** Post-wiring menu state: hero preview, difficulty, music, resume vs main menu. */
export function finishBootMenu(ctx, save, devFlags) {
  const { GameController, UI, EventBus } = ctx
  const { hasBalanceBot, hasTestBotOngoing, hasTestHarness, isHeadlessBotSession } = devFlags

  updateMenuHeroPreview(ctx)
  UI.setActiveDifficulty(save.settings.difficulty)
  EventBus.emit('audio:music', { track: 'menu' })
  if (GameController.hasActiveRun()) {
    if (hasBalanceBot || hasTestBotOngoing || hasTestHarness) {
      GameController.abandonRun()
      UI.showMainMenu()
    } else {
      GameController.resumeRun()
    }
  } else {
    UI.showMainMenu()
  }

  if (!isHeadlessBotSession) {
    wireInstallNudge()
  }
}
`

fs.writeFileSync('js/main/wireMenus.js', header + body + finale)
console.log('wireMenus.js lines:', (header + body + finale).split('\n').length)
