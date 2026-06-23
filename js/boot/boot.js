import UI              from '../ui/UI.js'
import GameController  from '../core/GameController.js'
import MetaProgression from '../systems/MetaProgression.js'
import SaveManager     from '../save/SaveManager.js'
import AudioManager    from '../systems/AudioManager.js'
import EventBus        from '../core/EventBus.js'
import Logger          from '../core/Logger.js'
import { migrateSave } from './SaveMigrator.js'
import { parseDevUrlFlags, prepareSaveForDevSession, loadDevToolsAtBootEnd } from './DevToolsLoader.js'
import { wirePersistenceListeners } from './persistenceListeners.js'
import { wireHud } from '../main/wireHud.js'
import { wireMenus, finishBootMenu } from '../main/wireMenus.js'
import { wireKeyboard } from '../main/wireKeyboard.js'
import {
  wireBackpackPanel,
  renderBackpack,
  setBackpackOpen,
  toggleBackpack,
  openBackpackFiltered,
  openBackpackFilteredTrinkets,
  clearPendingGear,
  getPendingGearPiece,
} from '../ui/menus/BackpackPanel.js'
import {
  wireEquipmentOverlay,
  openEquipment,
  closeEquipment,
  openCompareModal,
  openSafePocketCompareModal,
  openGearPickupCompareModal,
} from '../ui/menus/EquipmentOverlay.js'

/** Boot orchestration: save load, GameController init, wire all shell modules. */
export async function boot() {
  Logger.debug('[main] boot start')

  UI.init()

  let save = await SaveManager.load()
  if (!save) {
    save = MetaProgression.defaultSave()
    await SaveManager.save(save)
  }
  {
    const migrated = migrateSave(save)
    save = migrated.save
    if (migrated.changed) await SaveManager.save(save)
  }
  document.body.classList.toggle('cheat-increase-stats', save.settings.cheats?.increaseStats === true)

  AudioManager.setMusicEnabled(save.settings.musicOn ?? true)
  AudioManager.setSfxEnabled(save.settings.sfxOn ?? true)

  const devFlags = parseDevUrlFlags()
  if (await prepareSaveForDevSession(save, devFlags)) {
    await SaveManager.save(save)
  }

  GameController.init(save)
  UI.refreshSkipFloorButton(save)

  const ctx = {
    GameController,
    SaveManager,
    MetaProgression,
    UI,
    EventBus,
    AudioManager,
    renderBackpack: (opts) => renderBackpack(ctx, opts),
    setBackpackOpen: (open) => setBackpackOpen(ctx, open),
    toggleBackpack: () => toggleBackpack(ctx),
    openBackpackFiltered: (slot) => openBackpackFiltered(ctx, slot),
    openBackpackFilteredTrinkets: () => openBackpackFilteredTrinkets(ctx),
    openCompareModal: (idx) => openCompareModal(ctx, idx),
    openGearPickupCompareModal: (idx) => openGearPickupCompareModal(ctx, idx),
    openSafePocketCompareModal: (idx) => openSafePocketCompareModal(ctx, idx),
    getPendingGearPiece,
    clearPendingGear: () => clearPendingGear(ctx),
    openEquipment: () => openEquipment(ctx),
    closeEquipment: () => closeEquipment(ctx),
  }

  wirePersistenceListeners(ctx)
  wireBackpackPanel(ctx)
  wireEquipmentOverlay(ctx)
  wireHud(ctx)
  wireMenus(ctx)
  wireKeyboard(ctx)

  AudioManager.init()

  finishBootMenu(ctx, save, devFlags)

  await loadDevToolsAtBootEnd(devFlags)

  Logger.debug('[main] boot complete')
}
