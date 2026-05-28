// UI facade — single public import path; delegates to surface-area modules.
import { cacheHudElements, wireHudListeners, HudMethods } from './Hud.js'
import { cacheGridElements, GridMethods } from './Grid.js'
import { cacheCombatElements, CombatUiMethods } from './CombatUi.js'
import { cacheModalElements, wireModalListeners, ModalsMethods } from './Modals.js'

const UI = {
  init() {
    cacheHudElements()
    cacheGridElements()
    cacheCombatElements()
    cacheModalElements()
    wireHudListeners()
    wireModalListeners()
  },

  ...HudMethods,
  ...GridMethods,
  ...CombatUiMethods,
  ...ModalsMethods,
}

export default UI
